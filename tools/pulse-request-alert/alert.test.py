# -*- coding: utf-8 -*-
"""PULSE 새 의뢰 텔레그램 알림(alert.py) 시험 — 임시 폴더 · 임시 SQLite · 가짜 docker · 가짜 텔레그램만 쓴다.

  python3 -B tools/pulse-request-alert/alert.test.py      (tests/pulse-request-alert.test.js가 부른다)
"""
import importlib.util
import io
import json
import os
import pathlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('pulse_request_alert', HERE / 'alert.py')
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)
TOKEN = '1234567890:' + 'A' * 35


def at(minutes_ago):
    return A.iso(NOW - timedelta(minutes=minutes_ago))


def row(number, minutes_ago=5, **more):
    return {'number': number, 'status': 'submitted', 'submittedAt': at(minutes_ago), 'stage': 'received', 'title': '오미톡 스파클링', **more}


class Sender:
    def __init__(self, answers=None):
        self.sent, self.answers = [], list(answers or [])

    def __call__(self, text):
        self.sent.append(text)
        return self.answers.pop(0) if self.answers else (True, 'OK')


class TitleAndMessage(unittest.TestCase):
    def test_clean_title_keeps_plain_product_names(self):
        self.assertEqual(A.clean_title('  오미톡\n오미자   스파클링 '), '오미톡 오미자 스파클링')
        self.assertEqual(A.clean_title('오미자 스파클링 500ml 2개 1+1'), '오미자 스파클링 500ml 2개 1+1')
        self.assertEqual(A.clean_title('2026 신상 립밤'), '2026 신상 립밤')
        self.assertEqual(A.clean_title('오미\u202e자\u200b 세트'), '오미 자 세트')
        self.assertEqual(A.clean_title('\uff2f\uff2d\uff29 오미자'), 'OMI 오미자', '전각 글자는 접는다')
        self.assertEqual(A.clean_title('가' * 200), '가' * 80)
        self.assertEqual(A.clean_title(None), '')
        self.assertEqual(A.clean_title(123), '')

    def test_clean_title_drops_the_whole_title_when_it_may_hold_contact_or_link(self):
        # 검수 GA1(두 회차) — 나라 · 구분자 · 글자 사이에 끼운 번호까지, 숫자가 일곱 개 이상이면 제목을 통째로 뺀다.
        for phone in ('010-1234-5678', '010\u20111234\u20115678', '010\u20131234\u20145678', '010\u00a01234\u00a05678', '010\u30001234\u30005678',
                      '\uff10\uff11\uff10-\uff11\uff12\uff13\uff14-\uff15\uff16\uff17\uff18', '010 . 1234 . 5678', '(010)1234-5678',
                      '+82 10 1234 5678', '+82\u201110\u20111234\u20115678', '02-123-4567', '1588-1234', '01012345678',
                      '+1 (202) 555-0123', '+44 20 7946 0958', '555 0123 4', '010x1234x5678', '\u2460\u2461\u2462\u2463\u2464\u2465\u2466'):
            self.assertEqual(A.clean_title(f'연락 {phone} 오미자'), '', repr(phone))
        for linkish in ('오미톡 https://shop.example.com/x?y=1 신상', '브랜드 www.omitok.kr 오미자', '브랜드 omitok.co.kr/abc 끝',
                        '문의 kim@omitok.com 오미자', '문의 kim\uff20omitok 끝', '인스타 @omitok', 't.me/omitok 오미자', '오미톡\uff0ecom 끝', '오미톡.com 끝'):
            self.assertEqual(A.clean_title(linkish), '', repr(linkish))
        # 숫자가 많은 제품명 · 날짜도 빠진다(알림은 의뢰 번호만 싣는다) — 받아들인 손해.
        self.assertEqual(A.clean_title('2026-11-14 출시 오미자'), '')
        self.assertEqual(A.clean_title('오미자 ' + '1' * 6), '오미자 111111', '여섯 개까지는 싣는다')
        self.assertEqual(A.clean_title('오미자 ' + '1' * 7), '')

    def test_message_has_number_and_title_but_no_link_or_contact(self):
        self.assertEqual(A.message('P-1114-AB12', A.clean_title('연락 +1 (202) 555-0123')), 'PULSE 새 의뢰 P-1114-AB12\n' + A.FOOTER)
        text = A.message('P-1114-AB12', '오미톡')
        self.assertTrue(text.startswith('PULSE 새 의뢰 P-1114-AB12 · 오미톡\n'))
        self.assertNotRegex(text, r'https?:|@|www\.')
        self.assertTrue(A.message('P-1114-AB12', '').startswith('PULSE 새 의뢰 P-1114-AB12\n'))


class Pending(unittest.TestCase):
    def test_only_new_valid_recent_unarchived_once_in_order(self):
        rows = [row('P-1114-0002', 3), row('P-1114-0001', 30), row('P-1114-0001', 2), row('../P-1114-0003'), row('P-1114-0004', 60 * 73),
                row('P-1114-0005', -30), row('P-1114-0006', stage='archived'), row('P-1114-0007', status='draft'), row('P-1114-0008'),
                row('P-1114-0009', submittedAt='어제'), 'x', row(None)]
        got = A.pending(rows, {'P-1114-0008': at(1)}, NOW)
        self.assertEqual([item['number'] for item in got], ['P-1114-0001', 'P-1114-0002'])
        self.assertEqual(got[0]['title'], '오미톡 스파클링')
        self.assertEqual(A.pending(None, {}, NOW), [])

    def test_asking_and_confirmed_requests_still_count_once(self):
        rows = [row('P-1114-00A1', status='asking'), row('P-1114-00A2', status='confirmed')]
        self.assertEqual(len(A.pending(rows, {}, NOW)), 2)


class Tick(unittest.TestCase):
    def test_sends_each_number_once(self):
        send = Sender()
        state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': [row('P-1114-0001'), row('P-1114-0002')]}, NOW, send)
        self.assertEqual(summary['sent'], ['P-1114-0001', 'P-1114-0002'])
        self.assertEqual(len(send.sent), 2)
        state, summary = A.tick(state, {'ok': True, 'rows': [row('P-1114-0001'), row('P-1114-0002')]}, NOW + timedelta(minutes=1), send)
        self.assertEqual(summary['sent'], [])
        self.assertEqual(len(send.sent), 2)
        self.assertEqual(set(state['alerted']), {'P-1114-0001', 'P-1114-0002'})

    def test_failed_send_is_not_recorded_and_retried(self):
        send = Sender([(False, 'URLERROR')])
        state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': [row('P-1114-0001')]}, NOW, send)
        self.assertEqual((summary['sent'], summary['failed'], summary['waiting']), ([], ['P-1114-0001'], 1))
        self.assertNotIn('P-1114-0001', state['alerted'])
        self.assertEqual(state['failures']['P-1114-0001']['count'], 1)
        state, summary = A.tick(state, {'ok': True, 'rows': [row('P-1114-0001')]}, NOW + timedelta(minutes=1), send)
        self.assertEqual(summary['sent'], ['P-1114-0001'])
        self.assertEqual(state['failures'], {})

    def test_any_failure_stops_the_run(self):
        for code in ('HTTP_401', 'URLERROR', 'TIMEOUTERROR', 'INCOMPLETEREAD'):
            send = Sender([(False, code)])
            state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': [row('P-1114-0001', 3), row('P-1114-0002', 2)]}, NOW, send)
            self.assertEqual(len(send.sent), 1, code)
            self.assertEqual((summary['failed'], summary['waiting']), (['P-1114-0001'], 2), code)

    def test_send_that_raises_is_a_failure_not_a_crash(self):
        def boom(text):
            raise RuntimeError('http.client.IncompleteRead 같은 것')
        state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': [row('P-1114-0001')]}, NOW, boom)
        self.assertEqual(state['failures']['P-1114-0001']['code'], 'RUNTIMEERROR')
        state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': [row('P-1114-0001')]}, NOW, lambda text: None)
        self.assertEqual(state['failures']['P-1114-0001']['code'], 'SEND_RESULT_INVALID')

    def test_each_success_is_saved_at_once_and_time_budget_stops_new_sends(self):
        saved = []
        rows = [row(f'P-1114-00{i:02X}', 10 - i) for i in range(4)]
        calls = {'n': 0}

        def out_of_time():
            calls['n'] += 1
            return calls['n'] >= 2
        state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': rows}, NOW, Sender(), save=lambda st: saved.append(sorted(st['alerted'])), out_of_time=out_of_time)
        self.assertEqual(summary['sent'], ['P-1114-0000', 'P-1114-0001'])
        self.assertEqual(saved, [['P-1114-0000'], ['P-1114-0000', 'P-1114-0001']])
        self.assertEqual(summary['waiting'], 2)
        # 시작부터 시간이 다 갔어도 첫 건은 시도한다(검수 b A3).
        state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': rows}, NOW, Sender(), out_of_time=lambda: True)
        self.assertEqual((summary['sent'], summary['waiting']), (['P-1114-0000'], 3))

    def test_at_most_five_per_run(self):
        rows = [row(f'P-1114-00{i:02X}', 10 - i) for i in range(8)]
        send = Sender()
        state, summary = A.tick(A.empty_state(), {'ok': True, 'rows': rows}, NOW, send)
        self.assertEqual((len(summary['sent']), summary['waiting']), (5, 3))
        state, summary = A.tick(state, {'ok': True, 'rows': rows}, NOW, send)
        self.assertEqual((len(summary['sent']), summary['waiting']), (3, 0))

    def test_read_trouble_is_told_once_after_twenty_minutes_then_recovery_once(self):
        send = Sender()
        state = A.empty_state()
        for minute in range(0, 20):
            state, summary = A.tick(state, {'ok': False, 'code': 'APP_NOT_RUNNING'}, NOW + timedelta(minutes=minute), send)
        self.assertEqual(send.sent, [], '배포 몇 분 · 짧은 멈춤은 알리지 않는다')
        state, summary = A.tick(state, {'ok': False, 'code': 'APP_NOT_RUNNING'}, NOW + timedelta(minutes=20), send)
        self.assertEqual(summary['notice'], 'trouble')
        self.assertEqual(len(send.sent), 1)
        self.assertIn('20분째', send.sent[0])
        self.assertIn('APP_NOT_RUNNING', send.sent[0])
        for minute in range(21, 30):
            state, _ = A.tick(state, {'ok': False, 'code': 'DB_READ_FAILED'}, NOW + timedelta(minutes=minute), send)
        self.assertEqual(len(send.sent), 1)
        state, summary = A.tick(state, {'ok': True, 'rows': [row('P-1114-0001', -25)]}, NOW + timedelta(minutes=30), send)
        self.assertEqual(summary['notice'], 'recovered')
        self.assertEqual(send.sent[1], A.RECOVERED_TEXT)
        self.assertTrue(send.sent[2].startswith('PULSE 새 의뢰 P-1114-0001'))
        self.assertIsNone(state['trouble'])

    def test_recovery_message_retried_when_it_fails(self):
        state = A.empty_state()
        state['trouble'] = {'since': at(40), 'code': 'APP_NOT_RUNNING', 'notified': at(20)}
        send = Sender([(False, 'URLERROR')])
        state, summary = A.tick(state, {'ok': True, 'rows': []}, NOW, send)
        self.assertIsNotNone(state['trouble'])
        state, summary = A.tick(state, {'ok': True, 'rows': []}, NOW, send)
        self.assertIsNone(state['trouble'])
        self.assertEqual(send.sent, [A.RECOVERED_TEXT, A.RECOVERED_TEXT])

    def test_short_trouble_is_cleared_quietly(self):
        send = Sender()
        state, _ = A.tick(A.empty_state(), {'ok': False, 'code': 'DB_NOT_OPEN_BY_APP'}, NOW, send)
        state, _ = A.tick(state, {'ok': True, 'rows': []}, NOW + timedelta(minutes=5), send)
        self.assertIsNone(state['trouble'])
        self.assertEqual(send.sent, [])

    def test_prune_keeps_every_number_in_the_window_and_drops_old_ones(self):
        state = A.empty_state()
        rows = []
        for i in range(600):  # 72시간 안에 600건 — 수로 잘라 다시 보내는 순환이 없어야 한다(검수 GA4)
            number = f'P-1114-{i:04X}'
            state['alerted'][number] = A.iso(NOW - timedelta(minutes=i))
            rows.append(row(number, i))
        state['alerted']['P-1110-0001'] = A.iso(NOW - timedelta(days=5))
        state['failures']['P-1113-FFFF'] = {'count': 3, 'code': 'URLERROR', 'at': A.iso(NOW - timedelta(hours=80))}
        A.prune(state, NOW)
        self.assertEqual(len(state['alerted']), 600)
        self.assertNotIn('P-1110-0001', state['alerted'])
        self.assertEqual(state['failures'], {})
        send = Sender()
        state, summary = A.tick(state, {'ok': True, 'rows': rows}, NOW, send)
        self.assertEqual((send.sent, summary['sent']), ([], []))

    def test_reopen_marks_the_current_list_without_sending(self):
        send = Sender()
        state = {**A.empty_state(), 'reopen': A.iso(NOW)}
        state, summary = A.tick(state, {'ok': True, 'rows': [row('P-1114-0001'), row('P-1114-0002')]}, NOW, send)
        self.assertEqual((send.sent, summary['notice'], state['reopen']), ([], 'reopened', None))
        self.assertEqual(set(state['alerted']), {'P-1114-0001', 'P-1114-0002'})
        state, summary = A.tick(state, {'ok': True, 'rows': [row('P-1114-0001'), row('P-1114-0003', 1)]}, NOW + timedelta(minutes=1), send)
        self.assertEqual(summary['sent'], ['P-1114-0003'])

    def test_reopen_waits_through_read_trouble_and_still_tells_trouble(self):
        send = Sender()
        state = {**A.empty_state(), 'reopen': A.iso(NOW)}
        for minute in range(0, 21):
            state, summary = A.tick(state, {'ok': False, 'code': 'APP_NOT_RUNNING'}, NOW + timedelta(minutes=minute), send)
        self.assertEqual(len(send.sent), 1)
        self.assertIn('APP_NOT_RUNNING', send.sent[0])
        self.assertTrue(state['reopen'], '읽기 전에는 다시 열기 표시가 남는다')
        rows = [row('P-1114-0000', 30), row('P-1114-0001', -15)]
        state, summary = A.tick(state, {'ok': True, 'rows': rows}, NOW + timedelta(minutes=21), send)
        self.assertEqual(send.sent[1], A.RECOVERED_TEXT)
        self.assertEqual(len(send.sent), 3, '다시 연 시각 전 의뢰는 보내지 않고, 장애 중 들어온 의뢰는 보낸다(검수 b A4)')
        self.assertTrue(send.sent[2].startswith('PULSE 새 의뢰 P-1114-0001'))
        self.assertEqual(set(state['alerted']), {'P-1114-0000', 'P-1114-0001'})
        self.assertIsNone(state['reopen'])

    def test_normalize_drops_bad_rows(self):
        got = A.normalize({'alerted': {'P-1114-0001': at(1), '../x': at(1), 'P-1114-0002': 3}, 'failures': [], 'trouble': {'since': '어제'}})
        self.assertEqual(got['alerted'], {'P-1114-0001': at(1)})
        self.assertEqual((got['failures'], got['trouble']), ({}, None))
        self.assertEqual(A.normalize('x'), A.empty_state())


def make_db(folder, docs):
    db = os.path.join(folder, 'company.sqlite')
    writer = sqlite3.connect(db)
    writer.execute('PRAGMA journal_mode=WAL')
    writer.execute('CREATE TABLE documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id))')
    writer.execute('CREATE TABLE credentials (id TEXT PRIMARY KEY, ciphertext TEXT NOT NULL)')
    writer.execute("INSERT INTO credentials VALUES ('x','비밀')")
    for kind, ident, body in docs:
        writer.execute('INSERT INTO documents VALUES (?,?,?)', (kind, ident, json.dumps(body, ensure_ascii=False)))
    writer.commit()
    return db, writer


def docker(mount, running=True):
    payload = json.dumps([{'State': {'Running': running}, 'Mounts': [{'Destination': '/other', 'Source': '/x'}, {'Destination': '/data', 'Source': mount}]}])
    return lambda args, **kw: subprocess.CompletedProcess(args, 0, payload, '')


class ReadRows(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.mkdtemp(prefix='pulse-alert-db-')
        project = {'title': '오미톡', 'stage': 'received', 'contact': '김 · kim@omitok.com · 010-1234-5678',
                   'studio': {'request': {'number': 'P-1114-AB12', 'status': 'submitted', 'submittedAt': at(2), 'answers': {'email': 'kim@omitok.com'}}}}
        self.db, self.writer = make_db(self.folder, [
            ('clientProjects', 'a', project),
            ('clientProjects', 'b', {'title': '요청 없음', 'stage': 'received', 'studio': {}}),
            ('pulseRequestDrafts', 'c', {'number': 'P-1114-CD34', 'status': 'submitted'}),
        ])
        self.mount = self.folder.replace('\\', '/') if os.name == 'nt' else self.folder

    def tearDown(self):
        self.writer.close()

    def test_reads_only_five_fields_of_requests(self):
        got = A.read_rows(run=docker(self.folder))
        self.assertTrue(got['ok'], got)
        self.assertEqual(got['rows'], [{'number': 'P-1114-AB12', 'status': 'submitted', 'submittedAt': at(2), 'stage': 'received', 'title': '오미톡'}])
        self.assertNotIn('kim@', json.dumps(got, ensure_ascii=False))

    def test_skips_when_app_is_down_or_db_not_open(self):
        self.assertEqual(A.read_rows(run=docker(self.folder, running=False)), {'ok': False, 'code': 'APP_NOT_RUNNING'})
        self.assertEqual(A.read_rows(run=lambda a, **k: subprocess.CompletedProcess(a, 1, '', 'no such object')), {'ok': False, 'code': 'APP_NOT_RUNNING'})
        self.assertEqual(A.read_rows(run=lambda a, **k: subprocess.CompletedProcess(a, 0, '{깨짐', '')), {'ok': False, 'code': 'DOCKER_INSPECT_INVALID'})
        self.assertEqual(A.read_rows(run=docker('relative/path')), {'ok': False, 'code': 'DATA_MOUNT_MISSING'})
        no_shm = lambda p: not p.endswith('-shm')  # noqa: E731
        self.assertEqual(A.read_rows(run=docker(self.folder), exists=no_shm), {'ok': False, 'code': 'DB_NOT_OPEN_BY_APP'})

        def boom(args, **kw):
            raise subprocess.TimeoutExpired(args, 20)
        self.assertEqual(A.read_rows(run=boom), {'ok': False, 'code': 'DOCKER_INSPECT_FAILED'})

    def test_read_does_not_write(self):
        before = os.path.getmtime(self.db), os.path.getsize(self.db)
        A.read_rows(run=docker(self.folder))
        self.assertEqual(before, (os.path.getmtime(self.db), os.path.getsize(self.db)))
        count = self.writer.execute('SELECT COUNT(*) FROM documents').fetchone()[0]
        self.assertEqual(count, 3)

    def test_schema_drift_is_a_read_failure(self):
        folder = tempfile.mkdtemp(prefix='pulse-alert-db2-')
        db = os.path.join(folder, 'company.sqlite')
        writer = sqlite3.connect(db)
        writer.execute('PRAGMA journal_mode=WAL')
        writer.execute('CREATE TABLE other (x TEXT)')
        writer.commit()
        try:
            self.assertEqual(A.read_rows(run=docker(folder)), {'ok': False, 'code': 'DB_READ_FAILED'})
        finally:
            writer.close()


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def read(self, n=-1):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class SendTelegram(unittest.TestCase):
    def test_success_and_failure_codes_hide_the_token(self):
        seen = []

        def ok(request, timeout):
            seen.append((request.full_url, json.loads(request.data.decode()), timeout))
            return FakeResponse(b'{"ok":true,"result":{"message_id":1}}')
        config = {'token': TOKEN, 'chat': '6017495834'}
        self.assertEqual(A.send_telegram(config, '안녕', opener=ok), (True, 'OK'))
        self.assertTrue(seen[0][0].startswith('https://api.telegram.org/bot'))
        self.assertEqual(seen[0][1], {'chat_id': '6017495834', 'text': '안녕', 'link_preview_options': {'is_disabled': True}})

        def http401(request, timeout):
            raise urllib.error.HTTPError(request.full_url, 401, 'Unauthorized', {}, io.BytesIO(b''))
        result = A.send_telegram(config, 'x', opener=http401)
        self.assertEqual(result, (False, 'HTTP_401'))

        def down(request, timeout):
            raise urllib.error.URLError('down ' + request.full_url)
        result = A.send_telegram(config, 'x', opener=down)
        self.assertEqual(result, (False, 'URLERROR'))
        self.assertNotIn(TOKEN.split(':')[1], json.dumps(result))
        self.assertEqual(A.send_telegram(config, 'x', opener=lambda r, timeout: FakeResponse(b'{"ok":false}')), (False, 'TELEGRAM_NOT_OK'))
        self.assertEqual(A.send_telegram(config, 'x', opener=lambda r, timeout: FakeResponse(b'<html>')), (False, 'JSONDECODEERROR'))

    def test_redirects_are_refused(self):
        handler = A._NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, 'Found', {}, 'https://elsewhere.example/'))


class Config(unittest.TestCase):
    def write(self, text):
        folder = tempfile.mkdtemp(prefix='pulse-alert-cfg-')
        path = os.path.join(folder, 'telegram.env')
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(text)
        return path

    def test_reads_two_lines_and_rejects_bad_values(self):
        self.assertEqual(A.read_config(self.write(f'# 주석\nTELEGRAM_BOT_TOKEN={TOKEN}\nTELEGRAM_CHAT_ID=6017495834\n')), {'token': TOKEN, 'chat': '6017495834'})
        self.assertEqual(A.read_config(self.write(f'TELEGRAM_BOT_TOKEN="{TOKEN}"\nTELEGRAM_CHAT_ID=\'6017495834\'\n'))['chat'], '6017495834')
        for text, code in ((f'TELEGRAM_BOT_TOKEN=abc\nTELEGRAM_CHAT_ID=6017495834\n', 'CONFIG_TOKEN_INVALID'),
                           (f'TELEGRAM_BOT_TOKEN={TOKEN}\nTELEGRAM_CHAT_ID=me\n', 'CONFIG_CHAT_INVALID')):
            with self.assertRaises(ValueError) as caught:
                A.read_config(self.write(text))
            self.assertEqual(str(caught.exception), code)
        with self.assertRaises(ValueError) as caught:
            A.read_config(os.path.join(tempfile.mkdtemp(), 'none.env'))
        self.assertEqual(str(caught.exception), 'CONFIG_MISSING')


class Main(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix='pulse-alert-state-')
        self.state_dir = os.path.join(self.dir, 'state')
        self.config = os.path.join(self.dir, 'telegram.env')
        with open(self.config, 'w', encoding='utf-8') as handle:
            handle.write(f'TELEGRAM_BOT_TOKEN={TOKEN}\nTELEGRAM_CHAT_ID=6017495834\n')
        self.rows = [row('P-1114-0001', 30), row('P-1114-0002', 3)]
        self.sent = []

    def run_main(self, argv, rows=None, stdin=''):
        def sender(config, text):
            self.assertEqual(config['token'], TOKEN)
            self.sent.append(text)
            return True, 'OK'
        reader = (lambda: {'ok': True, 'rows': rows if rows is not None else self.rows})
        out = io.StringIO()
        old = sys.stdout
        sys.stdout = out
        try:
            code = A.main(argv, state_dir=self.state_dir, config_path=self.config, reader=reader, sender=sender, clock=lambda: NOW, stdin=io.StringIO(stdin))
        finally:
            sys.stdout = old
        lines = [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]
        return code, lines

    def state(self):
        with open(os.path.join(self.state_dir, 'state.json'), encoding='utf-8') as handle:
            return json.load(handle)

    def test_seed_from_pc_ledger_then_only_new_ones_are_sent(self):
        code, lines = self.run_main(['--seed', '-'], stdin=json.dumps({'P-1114-0001': at(29), '../bad': 'x', 'P-1113-0009': 3}))
        self.assertEqual((code, lines[-1]['event'], lines[-1]['alerted']), (0, 'SYNK_PULSE_ALERT_SEEDED', 2))
        code, lines = self.run_main([])
        self.assertEqual(code, 0)
        self.assertEqual(len(self.sent), 1)
        self.assertTrue(self.sent[0].startswith('PULSE 새 의뢰 P-1114-0002'))
        self.assertEqual(lines[-1]['sent'], ['P-1114-0002'])
        code, lines = self.run_main([])
        self.assertEqual((len(self.sent), lines), (1, []), '조용한 회차는 한 줄도 찍지 않는다')
        with open(os.path.join(self.state_dir, 'latest.json'), encoding='utf-8') as handle:
            latest = json.load(handle)
        self.assertEqual((latest['read'], latest['alertedCount']), ('ok', 3))
        self.assertNotIn('오미톡', json.dumps(self.state(), ensure_ascii=False) + json.dumps(latest, ensure_ascii=False), '장부에는 번호와 시각만')
        code, lines = self.run_main(['--seed', '-'], stdin='{}')
        self.assertEqual((code, lines[-1]['event']), (1, 'SYNK_PULSE_ALERT_SEED_REFUSED'))

    def test_missing_or_broken_state_reopens_without_sending(self):
        code, lines = self.run_main([])
        self.assertEqual((code, self.sent), (0, []))
        self.assertEqual((lines[0]['event'], lines[0]['was']), ('SYNK_PULSE_ALERT_STATE_REOPENING', 'none'))
        self.assertEqual((lines[-1]['event'], lines[-1]['notice']), ('SYNK_PULSE_ALERT', 'reopened'))
        self.assertEqual(set(self.state()['alerted']), {'P-1114-0001', 'P-1114-0002'})
        with open(os.path.join(self.state_dir, 'state.json'), 'w', encoding='utf-8') as handle:
            handle.write('{깨짐')
        code, lines = self.run_main([], rows=self.rows + [row('P-1114-0003', 1)])
        self.assertEqual((lines[0]['was'], self.sent), ('BROKEN', []))
        for shape in ('{}', '[]', '{"version": 1, "alerted": []}', '{"version": 2, "alerted": {}}', 'null'):  # 검수 GA3
            with open(os.path.join(self.state_dir, 'state.json'), 'w', encoding='utf-8') as handle:
                handle.write(shape)
            code, lines = self.run_main([], rows=self.rows + [row('P-1114-0003', 1)])
            self.assertEqual((lines[0]['was'], self.sent), ('BROKEN', []), shape)
        code, lines = self.run_main([], rows=self.rows + [row('P-1114-0003', 1), row('P-1114-0004', 0)])
        self.assertEqual(len(self.sent), 1)
        self.assertTrue(self.sent[0].startswith('PULSE 새 의뢰 P-1114-0004'))

    def test_missing_state_with_failing_read_is_still_tracked(self):
        def reader():
            return {'ok': False, 'code': 'DB_NOT_OPEN_BY_APP'}
        out = io.StringIO()
        old = sys.stdout
        sys.stdout = out
        try:
            code = A.main([], state_dir=self.state_dir, config_path=self.config, reader=reader, sender=lambda c, t: (True, 'OK'), clock=lambda: NOW)
        finally:
            sys.stdout = old
        self.assertEqual(code, 0)
        state = self.state()
        self.assertTrue(state['reopen'])
        self.assertEqual(state['trouble']['code'], 'DB_NOT_OPEN_BY_APP')
        with open(os.path.join(self.state_dir, 'latest.json'), encoding='utf-8') as handle:
            self.assertEqual(json.load(handle)['read'], 'DB_NOT_OPEN_BY_APP')

    def test_dry_run_and_status_do_not_write(self):
        code, lines = self.run_main(['--dry-run'])
        self.assertEqual((code, lines[-1]['wouldSend'], lines[-1]['state']), (0, ['P-1114-0001', 'P-1114-0002'], 'none'))
        self.assertFalse(os.path.exists(self.state_dir))
        code, lines = self.run_main(['--status'])
        self.assertEqual(lines[-1], {'event': 'SYNK_PULSE_ALERT_STATUS', 'state': 'none'})
        self.assertFalse(os.path.exists(self.state_dir))

    def test_test_message_and_missing_config(self):
        code, lines = self.run_main(['--test'])
        self.assertEqual((code, self.sent, lines[-1]['ok']), (0, [A.TEST_TEXT], True))
        os.remove(self.config)
        self.sent.clear()
        code, lines = self.run_main([])
        self.assertEqual((code, lines[-1], self.sent), (1, {'event': 'SYNK_PULSE_ALERT_CONFIG', 'code': 'CONFIG_MISSING'}, []))
        code, lines = self.run_main(['--모름'])
        self.assertEqual(code, 2)

    def test_state_files_are_private(self):
        self.run_main(['--seed', '-'], stdin='{}')
        if os.name != 'nt':
            self.assertEqual(os.stat(os.path.join(self.state_dir, 'state.json')).st_mode & 0o777, 0o600)
            self.assertEqual(os.stat(self.state_dir).st_mode & 0o777, 0o700)


class UnitFiles(unittest.TestCase):
    def test_service_runs_the_installed_script_read_only_and_timer_every_minute(self):
        service = (HERE / 'synk-pulse-request-alert.service').read_text(encoding='utf-8')
        timer = (HERE / 'synk-pulse-request-alert.timer').read_text(encoding='utf-8')
        self.assertIn('ExecStart=/usr/bin/python3 -I /opt/synk-pulse-request-alert/alert.py\n', service)
        self.assertIn('Type=oneshot', service)
        self.assertIn('StateDirectory=synk-pulse-request-alert', service)
        self.assertNotRegex(service, r'(?i)backup|restore|deploy|release|rearm|disarm|maintenance', '여유 공간 도구 · 배포 관문의 「바쁜 서비스」 이름과 겹치지 않게')
        self.assertIn('OnCalendar=*-*-* *:*:20', timer)
        self.assertIn('Unit=synk-pulse-request-alert.service', timer)
        self.assertEqual(A.CONFIG, '/etc/synk-pulse-request-alert/telegram.env')
        self.assertEqual(A.STATE_DIR, '/var/lib/synk-pulse-request-alert')


if __name__ == '__main__':
    unittest.main(verbosity=1)
