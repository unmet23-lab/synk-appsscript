#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PULSE 새 의뢰 · 고객 소식 텔레그램 알림 — 회사 주 노드의 systemd 타이머 synk-pulse-request-alert.timer가 1분마다 부른다(2026-11-14).

PC 예약 작업 「SYNK PULSE 의뢰 확인」이 보내던 「새 의뢰」 한 줄을 회사 서버로 옮겼다. 그 작업은 10분마다 PC에서만 돌아서,
PC가 꺼져 있으면 의뢰가 들어와도 알림이 늦었다. 의뢰서는 회사 DB에 바로 저장되므로 같은 서버가 1분 안에 알린다.

- 회사 DB(company.sqlite)는 읽기만 한다. 앱 컨테이너가 돌고 -wal · -shm이 이미 있을 때만 mode=ro · query_only로 열고,
  clientProjects 문서의 칸 다섯(번호 · 상태 · 접수 시각 · 단계 · 제목)만 읽는다. 연락처 · 답 · 파일 · 인증 표는 읽지 않는다.
  SQLite는 root로 열어도 새로 만드는 -wal · -shm을 DB 주인 소유로 돌린다(os_unix.c robustFchown). 그래도 앱이 연 뒤에만 연다.
- 알림은 의뢰 번호마다 한 번이다. 접수 72시간 안의 의뢰만 알린다(상태 파일을 잃어도 옛 의뢰를 한꺼번에 다시 보내지 않게).
  보관(archived)된 프로젝트는 알리지 않는다.
- 글에는 번호와 제목(손님이 적은 제품 · 브랜드 이름)만 넣는다. 링크와 손님 연락처는 넣지 않고, 제목 속 주소 · 메일 · 전화번호 꼴도 지운다.
- 보내지 못하면 장부에 적지 않고 다음 회차에 다시 보낸다. 의뢰 목록을 20분 넘게 못 읽으면 그 사실을 한 번 알리고, 다시 읽히면 한 번 알린다.
- 고객 소식(2026-11-26, 유호님 「응, 만들어」): 고객이 글을 남기거나 답 · 승인을 하면 프로젝트마다 한 통으로 묶어 알린다. 앱이 이미 남기는
  내용 없는 사건(clientProjects.notificationEvents)만 읽고 글 본문은 읽지 않는다. 담당자가 작업실에서 그 알림을 이미 읽었으면 보내지 않는다.
  고객 소식 쪽이 막혀도 새 의뢰 알림은 그대로 간다.
- 손님에게는 아무것도 보내지 않는다. 운영 쓰기는 없다. 상태 파일에는 번호와 시각, 사건 번호의 해시만 남긴다.

  python3 -I alert.py                 한 회차(타이머가 부른다)
  python3 -I alert.py --dry-run       알릴 번호만 보인다(보내지 않고 장부도 안 쓴다)
  python3 -I alert.py --status        마지막 회차 요약(번호 · 시각 · 까닭 코드만)
  python3 -I alert.py --test          시험 한 줄을 보낸다(의뢰 · 장부와 상관없음)
  python3 -I alert.py --seed -        처음 설치 때 PC 장부({"P-…": "시각"})를 표준 입력으로 받아 장부를 연다(장부가 있으면 거절)
"""
import hashlib
import json
import os
import pathlib
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

try:
    import fcntl
except ImportError:  # 윈도우에서 시험만 돌릴 때 — 서버(리눅스)에는 늘 있다
    fcntl = None

CONTAINER = 'synk-company-company-1'
CONFIG = '/etc/synk-pulse-request-alert/telegram.env'
STATE_DIR = '/var/lib/synk-pulse-request-alert'
NUMBER = re.compile(r'^P-\d{4}-[0-9A-F]{4}$')
TOKEN = re.compile(r'^\d{5,20}:[A-Za-z0-9_-]{30,80}$')
CHAT = re.compile(r'^-?\d{5,20}$')
MAX_AGE = timedelta(hours=72)
FUTURE_SLACK = timedelta(minutes=10)
TROUBLE_AFTER = timedelta(minutes=20)
MAX_PER_RUN = 5
# 알린 시각이 72시간 + 하루를 넘은 번호만 지운다(그 의뢰는 다시 알릴 대상이 아니다). 창 안 번호를 수로 자르면 다시 보내는 순환이 생긴다(검수 GA4).
KEEP_FOR = MAX_AGE + timedelta(days=1)
HARD_CAP = 5000
SEND_TIMEOUT = 10
# 한 회차에 보내기를 시작해도 되는 시간 — 서비스 TimeoutStartSec=90 안에서 docker · DB 읽기와 마지막 보내기(주소 둘 × 10초)가 끝나게(검수 A2).
SEND_BUDGET_SECONDS = 40

FOOTER = '작업실 PULSE에 들어왔어요. 1차 확인 메모는 PC가 켜져 있을 때 이어서 남겨요.'
TEST_TEXT = 'PULSE 새 의뢰 알림 시험이에요. 회사 서버에서 보냈고, 손님 의뢰가 아니에요.'
TROUBLE_TEXT = 'PULSE 새 의뢰 알림이 회사 서버에서 의뢰 목록을 {minutes}분째 읽지 못하고 있어요(까닭 {code}). 그동안 새 의뢰와 고객 글은 작업실 PULSE에서 직접 봐 주세요.'
RECOVERED_TEXT = 'PULSE 새 의뢰 알림이 다시 의뢰 목록을 읽어요. 그사이 들어온 의뢰와 고객 글은 이어서 알려 드려요.'
TALK_TROUBLE_TEXT = 'PULSE 고객 소식 알림이 회사 서버에서 고객 소식을 {minutes}분째 읽지 못하고 있어요(까닭 {code}). 새 의뢰 알림은 그대로 가요. 그동안 고객 글은 작업실 PULSE에서 직접 봐 주세요.'
TALK_RECOVERED_TEXT = 'PULSE 고객 소식 알림이 다시 고객 소식을 읽어요. 그사이 온 소식은 이어서 알려 드려요.'
TALK_FOOTER = '작업실 PULSE에서 확인해 주세요.'

# 고객 소식 — 앱의 사건 종류(client-notifications.mjs)와 알림에 쓰는 말. 여기 없는 종류는 보내지 않는다.
# 고객이 하는 일의 사건이 새로 생기면 alert.test.py가 이 표나 아래 TALK_SILENT에 넣으라고 멈춘다.
TALK_LABELS = {
    'customer_support': '문의',
    'customer_feedback': '시안 수정 의견',
    'customer_feedback_round': '모아 보낸 수정 의견',
    'customer_approval': '시안 승인',
    'customer_comment': '기획 의견',
    'customer_scene': '장면 의견',
    'customer_reference': '참고 자료 의견',
    'customer_concept': '콘셉트 고름',
    'customer_strategy_confirmed': '제작 설계 확인',
    'customer_request_answer': '되물은 내용의 답',
    'customer_request_file': '자료 보냄',
    'customer_request_edit': '의뢰서 고침',
    'customer_model_answer': '모델 답',
    'customer_direction_answer': '방향 답',
    'customer_draft_review': '1차안 의견',
    'customer_draft_approved': '1차안 확인',
    'customer_people_request': '인플루언서 광고 의뢰',
    'customer_people_agree': '인플루언서 광고 값 동의',
    'customer_people_cancel': '인플루언서 광고 의뢰 거둠',
    'customer_delivery_receipt': '최종본 받음',
}
# 새 의뢰는 위의 「새 의뢰」 한 줄이 맡는다. 취향 · 제작 설계는 고객이 칸을 채우며 여러 번 저장하는 것이라 알리지 않는다.
TALK_SILENT = {'request_received', 'customer_preferences', 'customer_strategy'}
# 고객이 이어서 쓰는 동안은 기다렸다가 한 통으로 묶는다 — 마지막 글 뒤 1분 조용하거나 첫 글 뒤 3분이 지나면 보낸다.
TALK_QUIET = timedelta(seconds=60)
TALK_WAIT_MAX = timedelta(seconds=180)
# 같은 프로젝트는 5분에 한 통까지.
TALK_GAP = timedelta(minutes=5)
TALK_MAX_KINDS = 4
# 고객 소식 읽기가 길어져 새 의뢰 알림까지 막지 않게(서비스 제한 90초 안에서) 이 시간이 지나면 읽기를 끊는다.
TALK_READ_SECONDS = 15
MARK = re.compile(r'^[0-9a-f]{24}$')

# 보이지 않는 글자 · 방향 바꿈 글자 — 소스에는 \u 꼴로만 적는다.
CONTROL = re.compile('[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]')
LINKISH = re.compile(
    r'(?i)(?:https?://|www\.)\S*'                                   # 주소
    r'|\S+@\S+'                                                      # 메일 · 핸들
    r'|(?<![\w.-])[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|kr|co|io|me|im|shop|store|app|link|ly|gl|to|xyz|biz|info|page|site)\b\S*'
)
# 제목에 숫자가 이보다 많으면 제목을 통째로 뺀다. 전화번호는 어느 나라 꼴이든 숫자가 일곱 개를 넘는다.
MAX_TITLE_DIGITS = 6
DASHES = re.compile('[\u2010-\u2015\u2212\ufe58\ufe63\uff0d]')


def utc_now():
    return datetime.now(timezone.utc)


def iso(moment):
    return moment.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def parse_time(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        moment = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    return moment if moment.tzinfo else None


def clean_title(value):
    """제목은 통째로 싣거나 통째로 뺀다. 숫자가 일곱 개 이상이거나 주소 · 메일 꼴이 있으면 빈 글을 돌려주고, 그러면 알림은 의뢰 번호만 싣는다.
    전화번호 꼴을 찾아 지우던 첫 설계는 구분자(U+2011 하이픈)와 나라(+1 (202) 555-0123)마다 새어 나갔다(검수 GA1 두 회차) — 그래서 문으로 바꿨다.
    날짜 · 숫자가 많은 제품명도 제목 없이 가지만, 의뢰 번호로 작업실에서 찾을 수 있다. 제어 문자는 지우고 한 줄 80자로 자른다."""
    if not isinstance(value, str):
        return ''
    text = unicodedata.normalize('NFKC', value)  # 전각 숫자 · 전각 @ · 동그라미 숫자를 보통 글자로 접은 뒤 센다
    text = CONTROL.sub(' ', text)
    text = DASHES.sub('-', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if sum(ch.isdigit() for ch in text) > MAX_TITLE_DIGITS or '@' in text or LINKISH.search(text):
        return ''
    return text[:80].strip()


def message(number, title):
    return f'PULSE 새 의뢰 {number}' + (f' · {title}' if title else '') + '\n' + FOOTER


def mark(value):
    """사건 · 프로젝트 번호의 해시 — 장부에는 이것만 남긴다."""
    return hashlib.sha256(value.encode('utf-8', 'surrogatepass')).hexdigest()[:24]


def talk_message(group):
    """프로젝트 하나에 한 통. 번호 · 제목 · 사건 종류와 수만 싣고 글 본문 · 이름 · 연락처 · 링크는 넣지 않는다."""
    head = ' · '.join(part for part in (group['number'], group['title']) if part) or '의뢰 번호 없는 프로젝트'
    counts = list(group['kinds'].items())
    shown = [f'{label} {count}건' for label, count in counts[:TALK_MAX_KINDS]]
    rest = sum(count for _, count in counts[TALK_MAX_KINDS:])
    if rest:
        shown.append(f'그 밖 {rest}건')
    return f'PULSE 고객 소식 {head}\n' + ' · '.join(shown) + '\n' + TALK_FOOTER


def read_config(path=CONFIG):
    """TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID 두 줄. 틀리면 ValueError(코드만)."""
    values = {}
    try:
        with open(path, encoding='utf-8') as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    except FileNotFoundError:
        raise ValueError('CONFIG_MISSING') from None
    except OSError:
        raise ValueError('CONFIG_UNREADABLE') from None
    token, chat = values.get('TELEGRAM_BOT_TOKEN', ''), values.get('TELEGRAM_CHAT_ID', '')
    if not TOKEN.match(token):
        raise ValueError('CONFIG_TOKEN_INVALID')
    if not CHAT.match(chat):
        raise ValueError('CONFIG_CHAT_INVALID')
    return {'token': token, 'chat': chat}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # 열쇠가 든 주소를 다른 곳으로 넘기지 않는다
        return None


def send_telegram(config, text, opener=None):
    """→ (보냄, 코드). 코드에는 주소 · 열쇠를 넣지 않는다."""
    body = json.dumps({'chat_id': config['chat'], 'text': text, 'link_preview_options': {'is_disabled': True}}).encode('utf-8')
    request = urllib.request.Request(f'https://api.telegram.org/bot{config["token"]}/sendMessage', data=body,
                                     headers={'content-type': 'application/json'}, method='POST')
    open_url = opener or urllib.request.build_opener(_NoRedirect).open
    try:
        with open_url(request, timeout=SEND_TIMEOUT) as response:
            data = json.loads(response.read(65536).decode('utf-8', 'replace') or '{}')
    except urllib.error.HTTPError as error:
        code = f'HTTP_{int(error.code)}'
        error.close()
        return False, code
    except Exception as error:  # noqa: BLE001 — URLError · OSError · ValueError · http.client.HTTPException(IncompleteRead 따위)까지 모두 코드로(검수 A1)
        return False, type(error).__name__.upper()[:40]
    return (True, 'OK') if isinstance(data, dict) and data.get('ok') is True else (False, 'TELEGRAM_NOT_OK')


# 고객이 한 일의 사건만. 글 본문은 읽지 않고, 담당자의 읽음 기록이 있는지만 함께 본다.
# 「담당자가 그 뒤 답했으면 보내지 않는다」는 두지 않는다 — 답 하나를 그 일과 상관없는 다른 고객 글의 답으로 보아 글을 놓치게 된다(검수 GA2 · c GA1 · d GA2).
TALK_SQL = (
    "SELECT json_extract(d.body,'$.id'), json_extract(d.body,'$.studio.request.number'), json_extract(d.body,'$.stage'), json_extract(d.body,'$.title'),"
    " json_extract(e.value,'$.id'), json_extract(e.value,'$.type'), json_extract(e.value,'$.createdAt'),"
    " EXISTS(SELECT 1 FROM documents r WHERE r.kind='clientNotificationReads'"
    "  AND r.id=json_extract(d.body,'$.ownerId')||'|'||json_extract(e.value,'$.id'))"
    " FROM documents d, json_each(d.body,'$.notificationEvents') e"
    " WHERE d.kind='clientProjects' AND json_extract(d.body,'$.updatedAt')>=?"
    " AND json_extract(e.value,'$.actorId')='customer' AND json_extract(e.value,'$.createdAt')>=?"
)


def open_db(db, connect, exists):
    """앱이 열어 둔 DB만 읽기 전용으로 연다. → (연결, None) 또는 (None, 코드)"""
    if not all(exists(db + side) for side in ('', '-wal', '-shm')):
        return None, 'DB_NOT_OPEN_BY_APP'
    try:
        return connect(pathlib.Path(db).as_uri() + '?mode=ro', uri=True, timeout=5), None
    except sqlite3.Error:
        return None, 'DB_OPEN_FAILED'


def read_talk(db, now, connect=sqlite3.connect, exists=os.path.isfile, steps=20000):
    """→ {'talk': […]} 또는 {'talkCode': …}. 새 의뢰를 다 보낸 뒤에 따로 부른다 — 오래 걸려도 새 의뢰를 늦추지 않게(검수 GA1)."""
    connection, code = open_db(db, connect, exists)
    if code:
        return {'talkCode': code}
    cutoff, deadline = iso(now - MAX_AGE), time.monotonic() + TALK_READ_SECONDS
    try:
        connection.execute('PRAGMA query_only=ON')
        connection.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, steps)
        found = connection.execute(TALK_SQL, (cutoff, cutoff)).fetchall()
    except (sqlite3.Error, MemoryError):
        return {'talkCode': 'TALK_READ_TIMEOUT' if time.monotonic() > deadline else 'TALK_READ_FAILED'}
    finally:
        connection.close()
    return {'talk': [{'project': r[0], 'number': r[1], 'stage': r[2], 'title': r[3], 'event': r[4], 'type': r[5], 'at': r[6], 'read': bool(r[7])}
                     for r in found]}


def read_rows(run=subprocess.run, connect=sqlite3.connect, exists=os.path.isfile):
    """→ {'ok': True, 'rows': […], 'db': 자리} 또는 {'ok': False, 'code': …}. 컨테이너가 돌고 앱이 DB를 연 뒤에만 읽는다."""
    try:
        inspected = run(['docker', 'inspect', CONTAINER], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return {'ok': False, 'code': 'DOCKER_INSPECT_FAILED'}
    try:
        info = json.loads(inspected.stdout or '[]')
    except ValueError:
        return {'ok': False, 'code': 'DOCKER_INSPECT_INVALID'}
    app = info[0] if isinstance(info, list) and info and isinstance(info[0], dict) else None
    if not app or (app.get('State') or {}).get('Running') is not True:
        return {'ok': False, 'code': 'APP_NOT_RUNNING'}
    mount = next((m.get('Source') for m in app.get('Mounts') or [] if isinstance(m, dict) and m.get('Destination') == '/data'), None)
    if not isinstance(mount, str) or not os.path.isabs(mount):
        return {'ok': False, 'code': 'DATA_MOUNT_MISSING'}
    db = os.path.join(mount, 'company.sqlite')
    connection, code = open_db(db, connect, exists)
    if code:
        return {'ok': False, 'code': code}
    try:
        connection.execute('PRAGMA query_only=ON')
        connection.execute('BEGIN')
        found = connection.execute(
            "SELECT json_extract(body,'$.studio.request.number'), json_extract(body,'$.studio.request.status'),"
            " json_extract(body,'$.studio.request.submittedAt'), json_extract(body,'$.stage'), json_extract(body,'$.title')"
            " FROM documents WHERE kind='clientProjects' AND json_extract(body,'$.studio.request.number') IS NOT NULL").fetchall()
    except sqlite3.Error:
        return {'ok': False, 'code': 'DB_READ_FAILED'}
    finally:
        try:
            connection.rollback()
        finally:
            connection.close()
    rows = [{'number': r[0], 'status': r[1], 'submittedAt': r[2], 'stage': r[3], 'title': r[4]} for r in found]
    return {'ok': True, 'rows': rows, 'db': db}


def pending(rows, alerted, now):
    """알릴 의뢰 — 번호 꼴이 맞고, 아직 안 알렸고, 접수 72시간 안이고, 보관되지 않은 것. 접수 순서."""
    seen, out = set(), []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        number = row.get('number')
        if not isinstance(number, str) or not NUMBER.match(number) or number in alerted or number in seen:
            continue
        at = parse_time(row.get('submittedAt'))
        if at is None or at > now + FUTURE_SLACK or now - at > MAX_AGE:
            continue
        if row.get('stage') == 'archived' or row.get('status') == 'draft':
            continue
        seen.add(number)
        out.append({'number': number, 'title': clean_title(row.get('title')), 'at': at})
    out.sort(key=lambda item: item['at'])
    return out


def talk_groups(rows, talk, now):
    """→ (프로젝트마다 묶은 소식, 보내지 않고 본 것으로 적을 해시). 이미 알렸거나 72시간이 지났거나 보관한 프로젝트의 사건은 뺀다.
    담당자가 작업실에서 읽은 사건과 다시 연 시각까지의 사건은 본 것으로 적는다. 묶음의 ready는 지금 보낼 때가 됐는지다."""
    reopen, groups, quiet, taken = parse_time(talk.get('reopen')), {}, [], set()
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        project, event, kind = row.get('project'), row.get('event'), row.get('type')
        label = TALK_LABELS.get(kind) if isinstance(kind, str) else None
        if not label or not isinstance(project, str) or not project or not isinstance(event, str) or not event:
            continue
        at = parse_time(row.get('at'))
        if at is None or at > now + FUTURE_SLACK or now - at > MAX_AGE:
            continue
        key = mark(event)
        if key in talk['seen'] or key in taken:
            continue
        taken.add(key)
        # 다시 연 시각까지의 사건은 보관한 프로젝트의 것도 적는다 — 나중에 보관을 풀어도 켜기 전 글을 보내지 않게(검수 GA3).
        if (reopen and at <= reopen) or row.get('read') is True:
            quiet.append(key)
            continue
        if row.get('stage') == 'archived':
            continue
        number = row.get('number')
        group = groups.setdefault(project, {
            'project': mark(project), 'number': number if isinstance(number, str) and NUMBER.match(number) else '',
            'title': clean_title(row.get('title')), 'kinds': {}, 'keys': [], 'first': at, 'last': at})
        group['kinds'][label] = group['kinds'].get(label, 0) + 1
        group['keys'].append(key)
        group['first'], group['last'] = min(group['first'], at), max(group['last'], at)
    for group in groups.values():
        group['settled'] = now - group['last'] >= TALK_QUIET or now - group['first'] >= TALK_WAIT_MAX
        group['ready'] = group['settled'] and gap_ok(talk, group, now)
    return sorted(groups.values(), key=lambda group: group['first']), quiet


def gap_ok(talk, group, moment):
    """같은 프로젝트는 보낸 때부터 5분이 지나야 다음 한 통이다."""
    before = parse_time(talk['lastSent'].get(group['project']))
    return before is None or moment - before >= TALK_GAP


def empty_talk():
    return {'seen': {}, 'lastSent': {}, 'lastFailure': None, 'trouble': None, 'reopen': None}


def normalize_talk(value):
    """없거나 꼴이 틀리면 None — 다음 회차가 그 시각을 다시 연 시각으로 적는다."""
    if not isinstance(value, dict) or not isinstance(value.get('seen'), dict):
        return None
    talk = empty_talk()
    for name in ('seen', 'lastSent'):
        found = value.get(name) if isinstance(value.get(name), dict) else {}
        talk[name] = {k: v for k, v in found.items() if isinstance(k, str) and MARK.match(k) and parse_time(v)}
    talk['lastFailure'] = value['lastFailure'] if isinstance(value.get('lastFailure'), dict) else None
    trouble = value.get('trouble')
    talk['trouble'] = trouble if isinstance(trouble, dict) and parse_time(trouble.get('since')) else None
    talk['reopen'] = value.get('reopen') if parse_time(value.get('reopen')) else None
    return talk


def empty_state():
    return {'version': 1, 'alerted': {}, 'failures': {}, 'trouble': None, 'lastReadOkAt': None, 'reopen': None, 'talk': None}


def normalize(state):
    base = empty_state()
    if not isinstance(state, dict):
        return base
    alerted = state.get('alerted') if isinstance(state.get('alerted'), dict) else {}
    base['alerted'] = {k: v for k, v in alerted.items() if isinstance(k, str) and NUMBER.match(k) and isinstance(v, str)}
    failures = state.get('failures') if isinstance(state.get('failures'), dict) else {}
    base['failures'] = {k: v for k, v in failures.items() if isinstance(k, str) and NUMBER.match(k) and isinstance(v, dict)}
    trouble = state.get('trouble')
    base['trouble'] = trouble if isinstance(trouble, dict) and parse_time(trouble.get('since')) else None
    base['lastReadOkAt'] = state.get('lastReadOkAt') if isinstance(state.get('lastReadOkAt'), str) else None
    # 다시 연 시각 — 이 시각 전에 접수된 의뢰만 보내지 않고 알린 것으로 적는다(그 뒤 의뢰는 보낸다, 검수 b A4).
    base['reopen'] = state.get('reopen') if parse_time(state.get('reopen')) else None
    base['talk'] = normalize_talk(state.get('talk'))
    return base


def prune(state, now):
    kept = [(k, v) for k, v in state['alerted'].items() if now - (parse_time(v) or now) <= KEEP_FOR]
    state['alerted'] = dict(sorted(kept, key=lambda item: item[1])[-HARD_CAP:])
    state['failures'] = {k: v for k, v in state['failures'].items()
                         if k not in state['alerted'] and (parse_time(v.get('at')) or now) > now - MAX_AGE}
    talk = state.get('talk')
    if talk:
        for name in ('seen', 'lastSent'):
            kept = [(k, v) for k, v in talk[name].items() if now - (parse_time(v) or now) <= KEEP_FOR]
            talk[name] = dict(sorted(kept, key=lambda item: item[1])[-HARD_CAP:])
    return state


def _safe(send, text):
    try:
        result = send(text)
    except Exception as error:  # noqa: BLE001 — 보내기가 던져도 회차를 끝까지 적는다(검수 A1)
        return False, type(error).__name__.upper()[:40]
    if not (isinstance(result, tuple) and len(result) == 2):
        return False, 'SEND_RESULT_INVALID'
    return bool(result[0]), str(result[1])[:40]


def note_trouble(trouble, code, now, send, text):
    """읽기 장애를 적고 20분이 넘으면 한 번 알린다. → (장애 기록, 이번에 알렸나)"""
    code = str(code or 'UNKNOWN')[:40]
    trouble = trouble or {'since': iso(now), 'code': code, 'notified': None}
    trouble['code'] = code
    since = parse_time(trouble.get('since')) or now
    if trouble.get('notified') or now - since < TROUBLE_AFTER:
        return trouble, False
    ok, _ = _safe(send, text.format(minutes=int((now - since).total_seconds() // 60), code=code))
    if ok:
        trouble['notified'] = iso(now)
    return trouble, ok


def talk_result(read):
    return {'read': read, 'sent': 0, 'failed': 0, 'waiting': 0, 'notice': None}


def talk_round(state, talker, now, send, save, can_send, clock):
    """고객 소식 한 회차. 여기서 무엇이 던져져도 새 의뢰 장부와 회차는 그대로 끝난다. 던지기 전에 보낸 수는 요약에 남긴다(검수 c GA3)."""
    before, result = state['talk']['trouble'], talk_result('ok')
    try:
        return talk_step(state, talker(), now, send, save, can_send, clock, result)
    except Exception as error:  # noqa: BLE001 — 고객 소식의 고장이 새 의뢰 알림을 막지 않게
        result['read'] = ('TALK_STEP_' + type(error).__name__.upper())[:40]
        if result['notice'] == 'recovered':
            before = None  # 이번 회차에 이미 복구 알림을 보냈다 — 다음 회차가 다시 보내지 않게(Fable 설계 검토 F2)
        state['talk']['trouble'], told = note_trouble(before, result['read'], now, send if can_send() else _later, TALK_TROUBLE_TEXT)
        if told:
            result['notice'] = 'trouble'
        return result


def _later(text):
    return False, 'LATER'


def talk_step(state, read, now, send, save, can_send, clock, result=None):
    """can_send()가 거짓이면 이번에는 보내지 않고 다음 회차로 넘긴다. → 요약"""
    result, talk = result if result is not None else talk_result('ok'), state['talk']
    if not isinstance(read.get('talk'), list):
        result['read'] = str(read.get('talkCode') or 'TALK_MISSING')[:40]
        talk['trouble'], told = note_trouble(talk['trouble'], result['read'], now, send if can_send() else _later, TALK_TROUBLE_TEXT)
        if told:
            result['notice'] = 'trouble'
        return result
    groups, quiet = talk_groups(read['talk'], talk, now)
    if talk['trouble'] and talk['trouble'].get('notified'):
        if can_send() and _safe(send, TALK_RECOVERED_TEXT)[0]:
            talk['trouble'] = None
            result['notice'] = 'recovered'
    else:
        talk['trouble'] = None
    for key in quiet:
        talk['seen'][key] = iso(now)
    # 다시 연 시각은 72시간 동안 둔다 — 그 시각 전에 때가 정해진 사건이 늦게 DB에 들어와도 보내지 않게(검수 c GA6 · d GA3).
    # 그보다 오래된 사건은 어차피 보내지 않는다.
    if talk['reopen'] and now - (parse_time(talk['reopen']) or now) > MAX_AGE:
        talk['reopen'] = None
    for group in groups:
        # 5분은 지금 보내려는 때로 다시 잰다 — 회차 시작이 아니라(검수 GA4 · c GA2).
        if not group['settled'] or not gap_ok(talk, group, clock()) or result['failed'] or result['sent'] >= MAX_PER_RUN or not can_send():
            result['waiting'] += 1
            continue
        ok, code = _safe(send, talk_message(group))
        if not ok:
            talk['lastFailure'] = {'code': code, 'at': iso(now)}
            result['failed'] += 1
            result['waiting'] += 1
            continue
        for key in group['keys']:
            talk['seen'][key] = iso(now)
        talk['lastSent'][group['project']] = iso(clock())  # 회차를 시작한 때가 아니라 보낸 때부터 5분을 센다(검수 GA4)
        talk['lastFailure'] = None
        result['sent'] += 1
        if save:
            save(state)
    return result


def tick(state, read, now, send, save=None, out_of_time=lambda: False, talker=None, clock=None):
    """한 회차. send(text) → (보냄, 코드). save(state)는 한 건을 보낼 때마다 장부를 바로 쓴다
    (systemd가 회차를 끊어도 보낸 번호가 남아 다시 보내지 않게, 검수 A2). talker()는 새 의뢰를 다 보낸 뒤 고객 소식을 읽는다. → (새 상태, 요약)."""
    state = normalize(state)
    calls = []

    def counted(text):
        calls.append(1)
        return send(text)
    if state['talk'] is None:
        # 고객 소식을 처음 켜는 회차(또는 이 칸을 잃은 장부) — 지금까지의 소식은 보내지 않고, 읽히는 첫 회차에 본 것으로 적는다.
        state['talk'] = {**empty_talk(), 'reopen': iso(now)}
    summary = {'checkedAt': iso(now), 'read': 'ok' if read.get('ok') else read.get('code', 'UNKNOWN'), 'sent': [], 'failed': [], 'waiting': 0, 'notice': None}
    if read.get('ok'):
        if state['reopen']:
            # 장부가 없거나 깨져서 다시 여는 중 — 다시 연 시각 전에 접수된 의뢰는 보내지 않고 알린 것으로 적는다(옛 의뢰를 한꺼번에
            # 다시 보내지 않게). 그 뒤에 들어온 의뢰는 아래에서 보통처럼 보낸다(읽기 장애가 길어도 그사이 의뢰를 버리지 않게, 검수 b A4).
            cutoff = parse_time(state['reopen'])
            for item in pending(read.get('rows'), state['alerted'], now):
                if item['at'] <= cutoff:
                    state['alerted'][item['number']] = iso(now)
            state['reopen'] = None
            summary['notice'] = 'reopened'
        trouble = state['trouble']
        if trouble and trouble.get('notified'):
            ok, _ = _safe(counted, RECOVERED_TEXT)
            if ok:
                state['trouble'] = None
                summary['notice'] = 'recovered'
        else:
            state['trouble'] = None
        state['lastReadOkAt'] = iso(now)
        todo = pending(read.get('rows'), state['alerted'], now)
        for index, item in enumerate(todo[:MAX_PER_RUN]):
            if index and out_of_time():
                break  # 첫 건은 늘 시도한다 — 읽기가 느려도 알림이 소리 없이 밀리지 않게(검수 b A3)
            ok, code = _safe(counted, message(item['number'], item['title']))
            if ok:
                state['alerted'][item['number']] = iso(now)
                state['failures'].pop(item['number'], None)
                summary['sent'].append(item['number'])
                if save:
                    save(state)
                continue
            before = state['failures'].get(item['number']) or {}
            state['failures'][item['number']] = {'count': int(before.get('count') or 0) + 1, 'code': code, 'at': iso(now)}
            summary['failed'].append(item['number'])
            break  # 한 번 실패하면 이 회차는 멈춘다 — 열쇠 · 망이 막혔으면 뒤 의뢰도 같이 막힌다(검수 A2)
        summary['waiting'] = len(todo) - len(summary['sent'])
        if talker:
            # 새 의뢰가 먼저다. 의뢰 보내기가 막혔거나(열쇠 · 망) 시간이 다 갔으면 고객 소식은 읽지도 않고 다음 회차로 넘긴다.
            # 이번 회차의 첫 보내기는 늘 시도한다.
            in_time = lambda: not (calls and out_of_time())  # noqa: E731
            summary['talk'] = talk_result('later') if summary['failed'] or not in_time() else \
                talk_round(state, talker, now, counted, save, in_time, clock or (lambda: now))
    else:
        state['trouble'], told = note_trouble(state['trouble'], read.get('code'), now, counted, TROUBLE_TEXT)
        if told:
            summary['notice'] = 'trouble'
    return prune(state, now), summary


def load_state(directory=STATE_DIR):
    """→ 장부 dict, 없으면 None, 읽을 수 없거나 꼴이 틀리면 'BROKEN'(검수 GA3 — {} · [] 같은 JSON도 깨진 장부다)."""
    try:
        with open(os.path.join(directory, 'state.json'), encoding='utf-8') as handle:
            loaded = json.load(handle)
    except FileNotFoundError:
        return None
    except (OSError, ValueError):
        return 'BROKEN'
    if not isinstance(loaded, dict) or loaded.get('version') != 1 or not isinstance(loaded.get('alerted'), dict):
        return 'BROKEN'
    return loaded


def write_json(path, value):
    directory = os.path.dirname(path)
    fd, temp = tempfile.mkstemp(prefix='.tmp-', dir=directory)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(value, handle, ensure_ascii=False, indent=1, sort_keys=True)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp, 0o600)
        os.replace(temp, path)
    except BaseException:
        try:
            os.unlink(temp)
        except OSError:
            pass
        raise


def latest_of(state, summary):
    return {**summary, 'alertedCount': len(state['alerted']), 'failures': {k: v.get('code') for k, v in state['failures'].items()},
            'trouble': state['trouble'], 'lastReadOkAt': state['lastReadOkAt'],
            'talkState': {'seenCount': len(state['talk']['seen']), 'lastFailure': state['talk']['lastFailure'], 'trouble': state['talk']['trouble']}}


def seed(text, now):
    """PC 장부 {"P-…": "시각"} → 새 장부. 번호 꼴이 아닌 줄은 버린다."""
    data = json.loads(text or '{}')
    if not isinstance(data, dict):
        raise ValueError('SEED_NOT_OBJECT')
    state = empty_state()
    for number, at in data.items():
        if isinstance(number, str) and NUMBER.match(number):
            state['alerted'][number] = at if isinstance(at, str) and parse_time(at) else iso(now)
    return prune(state, now)


def emit(event, **fields):
    print(json.dumps({'event': event, **fields}, ensure_ascii=False, sort_keys=True), flush=True)


def main(argv, *, state_dir=STATE_DIR, config_path=CONFIG, reader=read_rows, talk_reader=read_talk, sender=send_telegram, clock=utc_now, stdin=sys.stdin):
    mode = argv[0] if argv else ''
    if mode not in ('', '--dry-run', '--status', '--test', '--seed'):
        emit('SYNK_PULSE_ALERT_USAGE')
        return 2
    if mode == '--status':
        try:
            with open(os.path.join(state_dir, 'latest.json'), encoding='utf-8') as handle:
                emit('SYNK_PULSE_ALERT_STATUS', state='ok', latest=json.load(handle))
        except (OSError, ValueError):
            emit('SYNK_PULSE_ALERT_STATUS', state='none')
        return 0
    if mode == '--dry-run':
        # 읽기만 — 잠금 · 장부 폴더를 만들지 않는다.
        loaded = load_state(state_dir)
        read = reader()
        if not read.get('ok'):
            emit('SYNK_PULSE_ALERT_DRY_RUN', read=read.get('code'))
            return 0
        current = normalize(loaded if isinstance(loaded, dict) else None)
        talk_read = talk_reader(read['db'], clock()) if read.get('db') else {}
        talk = talk_groups(talk_read.get('talk'), current['talk'], clock())[0] if current['talk'] else None
        emit('SYNK_PULSE_ALERT_DRY_RUN', read='ok', state='ok' if isinstance(loaded, dict) else (loaded or 'none'),
             requests=len(read['rows']), wouldSend=[item['number'] for item in pending(read['rows'], current['alerted'], clock())],
             talkRead='ok' if isinstance(talk_read.get('talk'), list) else talk_read.get('talkCode', 'TALK_MISSING'), talkEvents=len(talk_read.get('talk') or []),
             talkWaiting=None if talk is None else [{'number': g['number'], 'kinds': g['kinds'], 'ready': g['ready']} for g in talk])
        return 0
    os.makedirs(state_dir, mode=0o700, exist_ok=True)
    with open(os.path.join(state_dir, 'lock'), 'a') as lock:
        try:
            if fcntl:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            emit('SYNK_PULSE_ALERT_BUSY')
            return 0
        now = clock()
        if mode == '--seed':
            if load_state(state_dir) is not None:
                emit('SYNK_PULSE_ALERT_SEED_REFUSED', reason='STATE_EXISTS')
                return 1
            state = seed(stdin.read(), now)
            write_json(os.path.join(state_dir, 'state.json'), state)
            emit('SYNK_PULSE_ALERT_SEEDED', alerted=len(state['alerted']))
            return 0
        try:
            config = read_config(config_path)
        except ValueError as error:
            emit('SYNK_PULSE_ALERT_CONFIG', code=str(error))
            return 1
        send = lambda text: sender(config, text)  # noqa: E731
        if mode == '--test':
            ok, code = send(TEST_TEXT)
            emit('SYNK_PULSE_ALERT_TEST', ok=ok, code=code)
            return 0 if ok else 1
        started = time.monotonic()
        state_path = os.path.join(state_dir, 'state.json')
        loaded = load_state(state_dir)
        if loaded is None or loaded == 'BROKEN':
            # 장부가 없거나 깨졌으면 「다시 열기」 표시를 단 빈 장부로 시작한다. 처음 읽히는 회차가 지금 목록을 보내지 않고 알린 것으로 적어
            # 옛 의뢰를 한꺼번에 다시 알리지 않는다. 그 사이 읽기가 실패해도 장애 알림 시계가 돈다(검수 A3).
            emit('SYNK_PULSE_ALERT_STATE_REOPENING', was=loaded or 'none')
            loaded = {**empty_state(), 'reopen': iso(now)}
        read = reader()
        state, summary = tick(loaded, read, now, send, save=lambda current: write_json(state_path, current),
                              out_of_time=lambda: time.monotonic() - started > SEND_BUDGET_SECONDS,
                              talker=(lambda: talk_reader(read['db'], now)) if read.get('db') else None, clock=clock)
        write_json(state_path, state)
        write_json(os.path.join(state_dir, 'latest.json'), latest_of(state, summary))
        talk = summary.get('talk') or {}
        if summary['sent'] or summary['failed'] or summary['waiting'] or summary['notice'] or summary['read'] != 'ok' \
                or talk.get('sent') or talk.get('failed') or talk.get('notice') or talk.get('read', 'ok') not in ('ok', 'later'):
            emit('SYNK_PULSE_ALERT', **{k: summary[k] for k in ('read', 'sent', 'failed', 'waiting', 'notice')}, talk=talk or None)
        return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
