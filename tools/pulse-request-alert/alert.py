#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PULSE 새 의뢰 텔레그램 알림 — 회사 주 노드의 systemd 타이머 synk-pulse-request-alert.timer가 1분마다 부른다(2026-11-14).

PC 예약 작업 「SYNK PULSE 의뢰 확인」이 보내던 「새 의뢰」 한 줄을 회사 서버로 옮겼다. 그 작업은 10분마다 PC에서만 돌아서,
PC가 꺼져 있으면 의뢰가 들어와도 알림이 늦었다. 의뢰서는 회사 DB에 바로 저장되므로 같은 서버가 1분 안에 알린다.

- 회사 DB(company.sqlite)는 읽기만 한다. 앱 컨테이너가 돌고 -wal · -shm이 이미 있을 때만 mode=ro · query_only로 열고,
  clientProjects 문서의 칸 다섯(번호 · 상태 · 접수 시각 · 단계 · 제목)만 읽는다. 연락처 · 답 · 파일 · 인증 표는 읽지 않는다.
  SQLite는 root로 열어도 새로 만드는 -wal · -shm을 DB 주인 소유로 돌린다(os_unix.c robustFchown). 그래도 앱이 연 뒤에만 연다.
- 알림은 의뢰 번호마다 한 번이다. 접수 72시간 안의 의뢰만 알린다(상태 파일을 잃어도 옛 의뢰를 한꺼번에 다시 보내지 않게).
  보관(archived)된 프로젝트는 알리지 않는다.
- 글에는 번호와 제목(손님이 적은 제품 · 브랜드 이름)만 넣는다. 링크와 손님 연락처는 넣지 않고, 제목 속 주소 · 메일 · 전화번호 꼴도 지운다.
- 보내지 못하면 장부에 적지 않고 다음 회차에 다시 보낸다. 의뢰 목록을 20분 넘게 못 읽으면 그 사실을 한 번 알리고, 다시 읽히면 한 번 알린다.
- 손님에게는 아무것도 보내지 않는다. 운영 쓰기는 없다. 상태 파일에는 번호와 시각만 남긴다.

  python3 -I alert.py                 한 회차(타이머가 부른다)
  python3 -I alert.py --dry-run       알릴 번호만 보인다(보내지 않고 장부도 안 쓴다)
  python3 -I alert.py --status        마지막 회차 요약(번호 · 시각 · 까닭 코드만)
  python3 -I alert.py --test          시험 한 줄을 보낸다(의뢰 · 장부와 상관없음)
  python3 -I alert.py --seed -        처음 설치 때 PC 장부({"P-…": "시각"})를 표준 입력으로 받아 장부를 연다(장부가 있으면 거절)
"""
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
TROUBLE_TEXT = 'PULSE 새 의뢰 알림이 회사 서버에서 의뢰 목록을 {minutes}분째 읽지 못하고 있어요(까닭 {code}). 그동안 새 의뢰는 작업실 PULSE에서 직접 봐 주세요.'
RECOVERED_TEXT = 'PULSE 새 의뢰 알림이 다시 의뢰 목록을 읽어요. 그사이 들어온 의뢰는 이어서 알려 드려요.'

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


def read_rows(run=subprocess.run, connect=sqlite3.connect, exists=os.path.isfile):
    """→ {'ok': True, 'rows': […]} 또는 {'ok': False, 'code': …}. 컨테이너가 돌고 앱이 DB를 연 뒤에만 읽는다."""
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
    if not all(exists(db + side) for side in ('', '-wal', '-shm')):
        return {'ok': False, 'code': 'DB_NOT_OPEN_BY_APP'}
    try:
        connection = connect(pathlib.Path(db).as_uri() + '?mode=ro', uri=True, timeout=5)
    except sqlite3.Error:
        return {'ok': False, 'code': 'DB_OPEN_FAILED'}
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
    return {'ok': True, 'rows': rows}


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


def empty_state():
    return {'version': 1, 'alerted': {}, 'failures': {}, 'trouble': None, 'lastReadOkAt': None, 'reopen': None}


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
    return base


def prune(state, now):
    kept = [(k, v) for k, v in state['alerted'].items() if now - (parse_time(v) or now) <= KEEP_FOR]
    state['alerted'] = dict(sorted(kept, key=lambda item: item[1])[-HARD_CAP:])
    state['failures'] = {k: v for k, v in state['failures'].items()
                         if k not in state['alerted'] and (parse_time(v.get('at')) or now) > now - MAX_AGE}
    return state


def _safe(send, text):
    try:
        result = send(text)
    except Exception as error:  # noqa: BLE001 — 보내기가 던져도 회차를 끝까지 적는다(검수 A1)
        return False, type(error).__name__.upper()[:40]
    if not (isinstance(result, tuple) and len(result) == 2):
        return False, 'SEND_RESULT_INVALID'
    return bool(result[0]), str(result[1])[:40]


def tick(state, read, now, send, save=None, out_of_time=lambda: False):
    """한 회차. send(text) → (보냄, 코드). save(state)는 한 건을 보낼 때마다 장부를 바로 쓴다
    (systemd가 회차를 끊어도 보낸 번호가 남아 다시 보내지 않게, 검수 A2). → (새 상태, 요약)."""
    state = normalize(state)
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
            ok, _ = _safe(send, RECOVERED_TEXT)
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
            ok, code = _safe(send, message(item['number'], item['title']))
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
    else:
        code = str(read.get('code') or 'UNKNOWN')[:40]
        trouble = state['trouble'] or {'since': iso(now), 'code': code, 'notified': None}
        trouble['code'] = code
        since = parse_time(trouble.get('since')) or now
        if not trouble.get('notified') and now - since >= TROUBLE_AFTER:
            ok, _ = _safe(send, TROUBLE_TEXT.format(minutes=int((now - since).total_seconds() // 60), code=code))
            if ok:
                trouble['notified'] = iso(now)
                summary['notice'] = 'trouble'
        state['trouble'] = trouble
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
            'trouble': state['trouble'], 'lastReadOkAt': state['lastReadOkAt']}


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


def main(argv, *, state_dir=STATE_DIR, config_path=CONFIG, reader=read_rows, sender=send_telegram, clock=utc_now, stdin=sys.stdin):
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
        alerted = normalize(loaded if isinstance(loaded, dict) else None)['alerted']
        emit('SYNK_PULSE_ALERT_DRY_RUN', read='ok', state='ok' if isinstance(loaded, dict) else (loaded or 'none'),
             requests=len(read['rows']), wouldSend=[item['number'] for item in pending(read['rows'], alerted, clock())])
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
        state, summary = tick(loaded, reader(), now, send, save=lambda current: write_json(state_path, current),
                              out_of_time=lambda: time.monotonic() - started > SEND_BUDGET_SECONDS)
        write_json(state_path, state)
        write_json(os.path.join(state_dir, 'latest.json'), latest_of(state, summary))
        if summary['sent'] or summary['failed'] or summary['waiting'] or summary['notice'] or summary['read'] != 'ok':
            emit('SYNK_PULSE_ALERT', **{k: summary[k] for k in ('read', 'sent', 'failed', 'waiting', 'notice')})
        return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
