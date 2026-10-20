"""Backup alarms tested with synthetic receipts; no cloud writes or notifications."""
import contextlib
import ctypes
import datetime as dt
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import tempfile
import time
import unittest
import subprocess
import sys
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('health', REPO / 'tools' / 'backup-health.py')
health = importlib.util.module_from_spec(spec); spec.loader.exec_module(health)
lib = health.load_legacy(REPO.parent / 'SYNK_원본창고')


class HealthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.now = dt.datetime(2026, 10, 18, 4, tzinfo=dt.timezone.utc)
        self.item = {'id': 'onedrive', 'receipt': 'receipt.json', 'maxAgeHours': 2, 'maxRunHours': 1}
        self.ok = {'status': 'healthy', 'lastSuccessAt': lib.stamp(self.now)}
        self.task = {'exists': True, 'enabled': True, 'result': 0}

    def tearDown(self): self.temp.cleanup()

    def evaluate(self, receipt, **kwargs):
        return health.evaluate(self.item, receipt, self.now, lib, kwargs.pop('task', self.task), **kwargs)

    def summary(self, state='failed'):
        return {'status': 'healthy' if state == 'healthy' else 'attention',
                'components': [{'id': 'onedrive', 'label': 'OneDrive', 'status': state, 'codes': ['FIXTURE_FAILED'] if state != 'healthy' else []}], 'issues': []}

    def test_recent_success_does_not_hide_disabled_schedule(self):
        row = self.evaluate(self.ok, task={'exists': True, 'enabled': False, 'result': 0})
        self.assertEqual(row['status'], 'attention')
        self.assertIn('SCHEDULE_MISSING_OR_DISABLED', row['codes'])

    def test_new_scope_does_not_inherit_failure_from_before_installation(self):
        self.item['installedAt'] = lib.stamp(self.now)
        task = dict(self.task, result=1, state='Ready', lastRunAt=lib.stamp(self.now-dt.timedelta(hours=2)))
        self.assertEqual(self.evaluate(None, installed_at=self.now, task=task)['status'], 'pending')
        task['lastRunAt'] = lib.stamp(self.now+dt.timedelta(seconds=1))
        self.assertEqual(self.evaluate(None, installed_at=self.now, task=task)['status'], 'attention')

    def test_disabled_auxiliary_upload_schedule_is_visible(self):
        task=dict(self.task,auxiliaryTasks=[{'id':'gitarchive','exists':True,'enabled':False,'result':0}])
        row=self.evaluate(self.ok,task=task)
        self.assertEqual(row['status'],'attention')
        self.assertIn('SCHEDULE_MISSING_OR_DISABLED',row['codes'])

    def test_stale_success_and_never_ran_become_actionable(self):
        self.assertEqual(self.evaluate({'status':'success','lastSuccessAt':lib.stamp(self.now-dt.timedelta(hours=3))})['status'], 'missed')
        self.assertEqual(self.evaluate(None)['status'], 'unknown')
        self.assertEqual(self.evaluate(None, installed_at=self.now)['status'], 'pending')
        self.assertEqual(self.evaluate(None, installed_at=self.now-dt.timedelta(hours=3))['status'], 'unknown')

    def test_pending_does_not_reset_last_success_deadline(self):
        receipt = {'status':'pending','checkedAt':lib.stamp(self.now),'lastSuccessAt':lib.stamp(self.now-dt.timedelta(hours=3))}
        self.assertEqual(self.evaluate(receipt)['status'], 'missed')

    def test_running_dead_process_is_not_healthy(self):
        with patch.object(lib,'process_alive',return_value=False):
            self.assertEqual(self.evaluate({'status':'running','pid':999,'startedAt':lib.stamp(self.now),'heartbeatAt':lib.stamp(self.now)})['status'], 'interrupted')

    def ago(self, minutes): return self.now - dt.timedelta(minutes=minutes)

    def running(self, heartbeat, start=None, pid=999):
        return {'status': 'running', 'pid': pid, 'startedAt': lib.stamp(self.ago(start or heartbeat)), 'heartbeatAt': lib.stamp(self.ago(heartbeat))}

    @contextlib.contextmanager
    def live(self, started=180, alive=True):
        # The run's process is alive and was created `started` minutes ago.
        with patch.object(lib, 'process_alive', return_value=alive), \
             patch.object(health, 'process_started', return_value=self.ago(started) if started is not None else None):
            yield

    def test_suspended_time_is_left_out_of_the_heartbeat_age(self):
        # 10-20 12:01: the PC slept 46 minutes while the OneDrive run waited on one long call, then it wrote again.
        receipt, slept = self.running(40), [(self.ago(38), self.ago(2))]
        with self.live():
            row = self.evaluate(receipt, suspended=slept)
            self.assertEqual((row['status'], row['codes'], row['suspendedSinceHeartbeatSeconds']), ('running', [], 36 * 60))
            # Without the record, or with no sleep in it, the wall clock judges as before.
            for record in (None, []):
                row = self.evaluate(receipt, suspended=record)
                self.assertEqual((row['status'], row['codes']), ('interrupted', ['PROCESS_OR_HEARTBEAT_MISSING']))
            self.assertNotIn('suspendedSinceHeartbeatSeconds', self.evaluate(receipt)); self.assertEqual(row['suspendedSinceHeartbeatSeconds'], 0)
            # A sleep shorter than the gap, before the heartbeat, or after this check took its time (the PC slept during the
            # check and the record was read on waking) does not hide a run that stopped writing.
            for spans in ([(self.ago(30), self.ago(20))], [(self.ago(70), self.ago(41))], [(self.ago(-1), self.ago(-40))]):
                self.assertEqual(self.evaluate(receipt, suspended=spans)['codes'], ['PROCESS_OR_HEARTBEAT_MISSING'])
        with self.live(alive=False):
            self.assertEqual(self.evaluate(receipt, suspended=slept)['codes'], ['PROCESS_OR_HEARTBEAT_MISSING'])

    def test_suspended_time_is_left_out_of_the_run_length(self):
        receipt = self.running(1, start=90)  # the fixture limit is one hour
        with self.live():
            self.assertEqual(self.evaluate(receipt, suspended=[(self.ago(80), self.ago(40))])['status'], 'running')
            self.assertEqual(self.evaluate(receipt, suspended=[(self.ago(80), self.ago(65))])['codes'], ['RUN_OVERRUN'])
            self.assertEqual(self.evaluate(receipt, suspended=[])['codes'], ['RUN_OVERRUN'])

    def test_backup_age_counts_the_time_the_pc_was_awake(self):
        # A lid closed overnight: OneDrive (2 hours) last succeeded 9 hours ago, 7 awake minutes of them, and the first
        # check after waking must not report 「최신 백업 지연」 before its next half-hour run.
        receipt, night, calls = {'status': 'success', 'lastSuccessAt': lib.stamp(self.ago(540))}, [(self.ago(538), self.ago(5))], []
        record = lambda spans: lambda: calls.append(1) or spans
        row = self.evaluate(receipt, suspended=record(night))
        self.assertEqual((row['status'], row['codes'], calls), ('healthy', [], [1]))
        # Without the record, with no sleep, with more than 2 awake hours, or with the sleep before the success: reported.
        for spans in (None, [], [(self.ago(538), self.ago(180))], [(self.ago(600), self.ago(541))]):
            with self.subTest(spans=spans):
                self.assertEqual(self.evaluate(receipt, suspended=spans)['codes'], ['BACKUP_STALE'])
        calls.clear()  # a fresh success never reads the System log
        self.assertEqual((self.evaluate(self.ok, suspended=record(night))['status'], calls), ('healthy', []))
        # A scope installed before the sleep waits as many awake hours for its first receipt.
        self.assertEqual(self.evaluate(None, installed_at=self.ago(540), suspended=night)['status'], 'pending')
        self.assertEqual(self.evaluate(None, installed_at=self.ago(540))['codes'], ['RECEIPT_MISSING'])

    def kst(self, day, hour): return dt.datetime(2026, 10, day, hour, tzinfo=lib.KST)

    def test_daily_run_counts_awake_hours_after_its_time(self):
        # Asleep 04:00–12:00: the 05:30 run starts on waking, and 13:00 is one awake hour after its time (6 allowed).
        self.item.update(id='server', maxAgeHours=36); self.now = self.kst(18, 13)
        receipt = {'status': 'success', 'lastSuccessAt': lib.stamp(self.kst(17, 6))}
        for spans, codes in (([(self.kst(18, 4), self.kst(18, 12))], []), (None, ['DAILY_RUN_MISSED']), ([], ['DAILY_RUN_MISSED']),
                             ([(self.kst(18, 4), self.kst(18, 6))], ['DAILY_RUN_MISSED'])):  # awake since 06:00: 7 hours
            with self.subTest(spans=spans):
                self.assertEqual(self.evaluate(receipt, suspended=spans)['codes'], codes)

    def test_server_missed_by_its_own_rule_is_asked_again_without_the_sleep(self):
        # 백업상태.py says 'missed' 6 wall-clock hours after the 05:30 run; asked at the same awake time it is not.
        config = {'components': [{'id': 'server', 'receipt': 'backup-status.json', 'maxAgeHours': 36, 'maxRunHours': 6}]}
        tasks = {'server': {'exists': True, 'enabled': True, 'result': 0}}
        lib.atomic_json(self.root / 'backup-status.json', {'status': 'success', 'lastSuccessAt': lib.stamp(self.kst(17, 6))})
        real = lib.derive_status  # this PC's stop file and backup key left out
        summary = lambda root, at=None: real(lib.read_json(Path(root) / 'backup-status.json'), {}, at)
        def server(spans, answer=summary):
            with patch.object(lib, 'local_summary', side_effect=answer):
                return health.gather(self.root, lib, config, tasks, self.kst(18, 13), lambda: spans)['components'][0]
        row = server([(self.kst(18, 4), self.kst(18, 12))])
        self.assertEqual((row['status'], row['codes']), ('healthy', []))
        for spans in (None, [], [(self.kst(18, 4), self.kst(18, 6))]):
            with self.subTest(spans=spans):
                self.assertEqual(server(spans)['codes'], ['BACKUP_MISSED'])
        # The second answer may only clear the wall-clock 'missed', never turn it into another state.
        answers = iter([None, {'status': 'running', 'issues': []}])
        self.assertEqual(server([(self.kst(18, 4), self.kst(18, 12))], lambda root, at: next(answers) or summary(root, at))['codes'],
                         ['BACKUP_MISSED'])

    def test_sleep_record_reaches_past_the_longest_age_judged(self):
        # The weekly archive check allows 8 days; sleep older than the record stays in the ages (stricter).
        window = int(re.search(r'timediff\(@SystemTime\) <= (\d+)', health.SUSPEND_QUERY).group(1))
        self.assertGreaterEqual(window, 8 * 24 * 3600 * 1000)

    def test_sleep_from_before_the_process_started_is_not_taken_off(self):
        # A shutdown with fast startup also resumes from hibernation but ends every program; a later process with the
        # dead run's id did not sleep through that gap. Without the process start time nothing is taken off.
        receipt, slept = self.running(40), [(self.ago(38), self.ago(2))]
        for started in (1, 37, None):
            with self.subTest(started=started), self.live(started):
                self.assertEqual(self.evaluate(receipt, suspended=slept)['codes'], ['PROCESS_OR_HEARTBEAT_MISSING'])
        for started in (38, 45):
            with self.subTest(started=started), self.live(started):
                self.assertEqual(self.evaluate(receipt, suspended=slept)['status'], 'running')

    def test_server_run_is_judged_by_its_own_rule_without_the_suspended_time(self):
        # 백업상태.py says interrupted after 10 wall-clock minutes; it is asked again with the sleep moved out.
        config = {'components': [{'id': 'server', 'receipt': 'backup-status.json', 'maxAgeHours': 36, 'maxRunHours': 6}]}
        tasks = {'server': {'exists': True, 'enabled': True, 'result': 0}}
        def server(heartbeat, spans):
            lib.atomic_json(self.root / 'backup-status.json', self.running(heartbeat, start=60, pid=os.getpid()))
            calls = []
            summary = health.gather(self.root, lib, config, tasks, self.now, lambda: calls.append(1) or spans)
            return summary['components'][0], calls
        with self.live():
            row, calls = server(20, [(self.ago(18), self.ago(3))])
            self.assertEqual((row['status'], row['codes'], calls), ('running', [], [1]))
            for spans in (None, [], [(self.ago(18), self.ago(12))]):  # 14 awake minutes are more than its 10
                with self.subTest(spans=spans):
                    self.assertEqual(server(20, spans)[0]['codes'], ['BACKUP_INTERRUPTED'])
        with self.live(alive=False):
            self.assertEqual(server(20, [(self.ago(18), self.ago(3))])[0]['codes'], ['BACKUP_INTERRUPTED'])
        # The second answer may only clear the wall-clock interruption, never turn it into another state.
        real, answers = lib.derive_status, iter([None, {'status': 'paused', 'issues': [{'code': 'BACKUP_STOPPED'}]}])
        with self.live(), patch.object(lib, 'derive_status', side_effect=lambda *a, **k: next(answers) or real(*a, **k)):
            self.assertEqual(server(20, [(self.ago(18), self.ago(3))])[0]['codes'], ['BACKUP_INTERRUPTED'])
        # Nothing running: the System log is not read.
        lib.atomic_json(self.root / 'backup-status.json', {'status': 'success', 'lastSuccessAt': lib.stamp(self.now)})
        calls = []
        health.gather(self.root, lib, config, tasks, self.now, lambda: calls.append(1))
        self.assertEqual(calls, [])

    def test_sleep_record_is_the_resume_spans_of_the_system_log(self):
        def event(reason, old, new, computer='Guts'):
            return ("<Event xmlns='http://schemas.microsoft.com/win/2004/08/events/event'><System>"
                    f"<Provider Name='Microsoft-Windows-Kernel-General'/><EventID>1</EventID><Computer>{computer}</Computer></System>"
                    f"<EventData><Data Name='NewTime'>{new}</Data><Data Name='OldTime'>{old}</Data>"
                    f"<Data Name='Reason'>{reason}</Data><Data Name='CmosTime'>{new}</Data></EventData></Event>")
        out = ''.join([  # newest first, as /rd:true gives them; wevtutil writes the ANSI code page
            event(2, '2026-10-20T07:28:55.8785610Z', '2026-10-20T08:13:00.5000000Z', '작업용-노트북'),
            event(1, '2026-10-20T04:00:00.0000000Z', '2026-10-20T04:30:00.0000000Z'),  # set by a program
            event(2, 'broken', '2026-10-20T04:10:00.5000000Z'),
            event(2, '2026-10-20T03:10:00.0000000Z', '2026-10-20T03:50:00.0000000Z'),  # overlaps the next one
            event(2, '2026-10-20T03:01:59.5301968Z', '2026-10-20T03:47:31.5000000Z'),
            event(2, '2026-10-20T03:01:30.6355543Z', '2026-10-20T03:01:29.5000000Z'),  # just before that sleep
        ]).encode('cp949')
        seen = {}
        def run(args, **kwargs):
            seen.update(args=args, **kwargs)
            return subprocess.CompletedProcess(args, 0, out, b'')
        t = lambda value: dt.datetime.fromisoformat('2026-10-20T' + value + '+00:00')
        self.assertEqual(health.suspensions(run), [(t('03:01:59.530196'), t('03:50:00')), (t('07:28:55.878561'), t('08:13:00.5'))])
        self.assertEqual((seen['args'][:2], seen['args'][3], seen['timeout']), (['wevtutil.exe', 'qe'], '/q:' + health.SUSPEND_QUERY, 20))
        self.assertEqual(health.suspensions(lambda *_, **__: subprocess.CompletedProcess([], 0, b'', b'')), [])
        # A failed, slow or broken query is no record, so the wall clock judges.
        def slow(*_, **__): raise subprocess.TimeoutExpired('wevtutil.exe', 20)
        for result in (subprocess.CompletedProcess([], 15007, b'', b''), subprocess.CompletedProcess([], 0, b'<Event', b'')):
            self.assertIsNone(health.suspensions(lambda *_, **__: result))
        self.assertIsNone(health.suspensions(slow))

    @unittest.skipUnless(os.name == 'nt', 'Windows System log and clocks')
    def test_this_pc_gives_its_sleep_record_and_process_start(self):
        now = dt.datetime.now(dt.timezone.utc)
        spans = health.suspensions()
        self.assertIsInstance(spans, list)  # None here would leave every run on the wall clock
        self.assertTrue(all(a < b <= now + dt.timedelta(minutes=1) for a, b in spans))
        self.assertEqual(spans, sorted(spans)); self.assertTrue(all(x[1] < y[0] for x, y in zip(spans, spans[1:])))
        self.assertTrue(now - dt.timedelta(days=1) < health.process_started(os.getpid()) <= now)
        self.assertIsNone(health.process_started(0)); self.assertGreaterEqual(health.suspended_seconds(), 0)

    def main_once(self, attempts, asleep):
        # main() with check() raising or returning as listed and the PC's suspended seconds as listed.
        attempts, calls = list(attempts), []
        def check(root, lib_, now):
            calls.append(now); outcome = attempts.pop(0)
            if isinstance(outcome, Exception): raise outcome
            return outcome
        with patch.object(health, 'load_legacy', return_value=lib), patch.object(health, 'check', side_effect=check), \
             patch.object(health, 'suspended_seconds', side_effect=list(asleep)), \
             patch.object(sys, 'argv', ['backup-health.py', '--root', str(self.root)]), contextlib.redirect_stdout(io.StringIO()):
            code = health.main()
        return code, len(calls), lib.read_json(self.root / 'backup-health.json')

    def test_check_the_pc_slept_through_runs_once_more(self):
        # 10-20 14:02: the check began while the PC was going to sleep and failed 4 seconds after it woke.
        healthy = {'schemaVersion': 1, 'status': 'healthy', 'components': [], 'issues': []}
        code, calls, written = self.main_once([RuntimeError('SCHEDULE_QUERY_FAILED'), healthy], [100.0, 291.0])
        self.assertEqual((code, calls, written['status']), (0, 2, 'healthy'))
        # Awake all along, failing again, or with no clock: the failure is reported as before.
        for attempts, asleep in (([RuntimeError('X')], [100.0, 100.5]), ([RuntimeError('X'), RuntimeError('X')], [100.0, 291.0]),
                                 ([RuntimeError('X')], [None, None])):
            with self.subTest(asleep=asleep):
                code, calls, written = self.main_once(attempts, asleep)
                self.assertEqual((code, calls, written['issues']), (1, len(attempts), [{'component': 'monitor', 'code': 'MONITOR_FAILED'}]))

    def notified_main(self, outcome, at, sent):
        # main() --notify once at `at`, with check() raising or returning `outcome`; delivered titles go to `sent`.
        real = health.update_notifications
        def notify(root, summary, lib_, now):
            return real(root, summary, lib_, now, lambda r, event, l: sent.append(event['title']) or {'accepted': True})
        def check(*_):
            if isinstance(outcome, Exception): raise outcome
            return json.loads(json.dumps(outcome))
        with patch.object(health, 'load_legacy', return_value=lib), patch.object(health, 'check', side_effect=check), \
             patch.object(lib, 'utcnow', return_value=at), patch.object(health, 'suspended_seconds', return_value=5.0), \
             patch.object(health, 'update_notifications', side_effect=notify), \
             patch.object(sys, 'argv', ['backup-health.py', '--root', str(self.root), '--notify']), contextlib.redirect_stdout(io.StringIO()):
            code = health.main()
        return code, lib.read_json(self.root / 'backup-health.json')

    def test_one_schedule_query_that_does_not_answer_waits_for_the_next_check(self):
        # 10-20 18:47 and 19:17: with the CPU full the query passed its 45 s once; 19:02 answered again.
        healthy = {'schemaVersion': 1, 'checkedAt': lib.stamp(self.now), 'status': 'healthy', 'issues': [],
                   'components': [{'id': 'onedrive', 'label': 'OneDrive', 'status': 'healthy', 'codes': []}]}
        timeout, sent, at = health.CheckError('SCHEDULE_QUERY_TIMEOUT'), [], lambda minutes: self.now + dt.timedelta(minutes=minutes)
        self.notified_main(healthy, at(0), sent)
        state = (self.root / 'backup-notification-state.json').read_bytes()
        code, written = self.notified_main(timeout, at(15), sent)
        # Not reported: the last result stays with this attempt beside it, and the notification state is untouched.
        self.assertEqual((code, sent), (1, []))
        self.assertEqual(written, dict(healthy, notification=written['notification'],
                         lastAttempt={'at': lib.stamp(at(15)), 'codes': ['MONITOR_FAILED', 'SCHEDULE_QUERY_TIMEOUT']}))
        self.assertEqual((self.root / 'backup-notification-state.json').read_bytes(), state)
        # The check after it also fails: reported as before, now with the reason.
        code, written = self.notified_main(timeout, at(30), sent)
        self.assertEqual((code, sent), (1, ['SYNK 백업 확인 필요']))
        self.assertEqual(written['components'][0]['codes'], ['MONITOR_FAILED', 'SCHEDULE_QUERY_TIMEOUT'])
        self.assertEqual(written['issues'], [{'component': 'monitor', 'code': 'MONITOR_FAILED'},
                                             {'component': 'monitor', 'code': 'SCHEDULE_QUERY_TIMEOUT'}])
        code, written = self.notified_main(timeout, at(45), sent)  # still failing: kept as a failure, no second notice
        self.assertEqual((written['checkedAt'], 'lastAttempt' in written, sent), (lib.stamp(at(45)), False, ['SYNK 백업 확인 필요']))
        self.notified_main(healthy, at(60), sent)
        self.assertEqual(sent, ['SYNK 백업 확인 필요', 'SYNK 백업 정상 복구'])
        # Failing and answering in turn never reports; neither does a failure after the PC slept past two rounds.
        for minutes, outcome in ((75, timeout), (90, healthy), (105, health.CheckError('SCHEDULE_QUERY_FAILED')),
                                 (106 + 41, health.CheckError('SCHEDULE_QUERY_UNREADABLE'))):
            self.assertEqual(self.notified_main(outcome, at(minutes), sent)[0], 1 if outcome is not healthy else 0)
        self.assertEqual(len(sent), 2)

    def test_a_monitor_without_a_previous_result_or_failing_otherwise_reports_at_once(self):
        sent = []
        code, written = self.notified_main(health.CheckError('SCHEDULE_QUERY_TIMEOUT'), self.now, sent)
        self.assertEqual((code, sent, written['components'][0]['codes']), (1, ['SYNK 백업 확인 필요'], ['MONITOR_FAILED', 'SCHEDULE_QUERY_TIMEOUT']))
        (self.root / 'backup-health.json').write_text('{broken', encoding='utf-8')
        code, written = self.notified_main(health.CheckError('SCHEDULE_QUERY_TIMEOUT'), self.now + dt.timedelta(hours=3), sent)
        self.assertEqual((code, written['checkedAt'], written['status'], 'lastAttempt' in written),
                         (1, lib.stamp(self.now + dt.timedelta(hours=3)), 'attention', False))
        healthy = {'schemaVersion': 1, 'status': 'healthy', 'components': [], 'issues': []}
        for error, codes in ((health.CheckError('BACKUP_HEALTH_CONFIG_MISSING'), ['MONITOR_FAILED', 'BACKUP_HEALTH_CONFIG_MISSING']),
                             (KeyError('SECRET=value'), ['MONITOR_FAILED'])):
            with self.subTest(error=type(error).__name__):
                self.notified_main(healthy, self.now, [])
                code, written = self.notified_main(error, self.now + dt.timedelta(minutes=15), sent)
                self.assertEqual((code, written['components'][0]['codes']), (1, codes))
                self.assertNotIn('SECRET', json.dumps(written))
        self.assertEqual(written['components'][0]['error'], 'KeyError')  # the kind of failure only

    def test_schedule_query_keeps_a_code_for_why_it_did_not_answer(self):
        config = self.root / 'backup-health-config.json'
        config.write_text(json.dumps({'components': []}), encoding='utf-8')
        def query(outcome):
            seen = {}
            def run(args, **kwargs):
                seen.update(kwargs, path=Path(args[args.index('-ConfigPath') + 1]))
                if isinstance(outcome, BaseException): raise outcome
                return subprocess.CompletedProcess(args, *outcome)
            with patch.object(health.subprocess, 'run', side_effect=run):
                try:
                    return health.task_snapshot(config, (health.SPACE_GUARD,)), seen
                except health.CheckError as error:
                    return error.args[0], seen
                finally:
                    self.assertFalse(seen['path'].exists())  # the temporary copy is gone either way
        for outcome, expected in ((subprocess.TimeoutExpired('powershell.exe', 45), 'SCHEDULE_QUERY_TIMEOUT'),
                                  (OSError('no powershell'), 'SCHEDULE_QUERY_FAILED'), ((1, b'', b'boom'), 'SCHEDULE_QUERY_FAILED'),
                                  ((0, b'not json', b''), 'SCHEDULE_QUERY_UNREADABLE'), ((0, b'{"id": "space"}', b''), 'SCHEDULE_QUERY_UNREADABLE'),
                                  ((0, b'[{"exists": false}]', b''), 'SCHEDULE_QUERY_UNREADABLE')):
            with self.subTest(expected=expected, outcome=repr(outcome)[:40]):
                self.assertEqual(query(outcome)[0], expected)
        tasks, seen = query((0, json.dumps([{'id': 'space', 'exists': False}]).encode(), b''))
        self.assertEqual((tasks, seen['timeout'], seen['creationflags']), ({'space': {'id': 'space', 'exists': False}}, 45, health.HELPER_FLAGS))
        # The notification starts the same way.
        with patch.object(health.subprocess, 'run', side_effect=lambda args, **kwargs: seen.update(kwargs) or
                          subprocess.CompletedProcess(args, 0, b'{"accepted": true}', b'')):
            health.deliver(self.root, {'id': 'a' * 64}, lib)
        self.assertEqual((seen['timeout'], seen['creationflags']), (20, health.HELPER_FLAGS))

    @unittest.skipUnless(os.name == 'nt', 'Windows priority classes')
    def test_helper_processes_get_normal_cpu_priority_under_the_below_normal_task(self):
        # The scheduled task runs at priority 7 (below normal); a child takes that class unless it asks for another.
        child = ("import ctypes; k = ctypes.WinDLL('kernel32'); k.GetCurrentProcess.restype = ctypes.c_void_p; "
                 "k.GetPriorityClass.argtypes = [ctypes.c_void_p]; print(k.GetPriorityClass(k.GetCurrentProcess()))")
        parent = ("import subprocess, sys; print(subprocess.run([sys.executable, '-c', sys.argv[2]], capture_output=True, "
                  "creationflags=int(sys.argv[1])).stdout.decode().strip())")
        for flags, expected in ((health.HELPER_FLAGS, 0x20), (0x08000000, 0x4000)):
            with self.subTest(flags=hex(flags)):
                result = subprocess.run([sys.executable, '-c', parent, str(flags), child], capture_output=True, timeout=60,
                                        creationflags=0x4000 | 0x08000000)
                self.assertEqual(int(result.stdout.split()[-1]), expected)
        self.assertTrue(health.HELPER_FLAGS & 0x08000000)  # still no console window every 15 minutes

    def test_onedrive_normal_sync_pending_is_not_immediate_failure(self):
        task={'exists':True,'enabled':True,'result':2,'lastRunAt':lib.stamp(self.now)}
        self.assertEqual(self.evaluate({'status':'pending'},task=task,installed_at=self.now)['status'],'pending')

    def test_intentional_pause_is_not_overridden_by_old_task_failure(self):
        task={'exists':True,'enabled':True,'result':1,'lastRunAt':lib.stamp(self.now-dt.timedelta(hours=1))}
        row=self.evaluate({'status':'paused','issues':[{'code':'BACKUP_STOPPED'}]},task=task)
        self.assertEqual(row['status'],'paused')
        self.assertNotIn('SCHEDULE_LAST_RUN_FAILED',row['codes'])

    def test_task_failure_cleared_only_by_later_verified_success(self):
        task = {'exists':True,'enabled':True,'result':1,'lastRunAt':lib.stamp(self.now)}
        receipt = {'status':'success','lastSuccessAt':lib.stamp(self.now-dt.timedelta(minutes=1))}
        self.assertEqual(self.evaluate(receipt,task=task)['status'],'attention')
        receipt['lastSuccessAt']=lib.stamp(self.now+dt.timedelta(minutes=1))
        self.assertEqual(self.evaluate(receipt,task=task)['status'],'healthy')

    def test_repair_requires_exact_run_failed_steps_and_all_success(self):
        self.item['id']='server'
        receipt={'runId':'a','status':'partial_failure','finishedAt':lib.stamp(self.now-dt.timedelta(minutes=1)), 'steps':[{'id':'talk','status':'failed'}]}
        repair={'status':'success','repairOfRunId':'other','finishedAt':lib.stamp(self.now),'repairedStepIds':['talk'],'steps':[{'status':'success'}]}
        self.assertEqual(self.evaluate(receipt,repair=repair)['status'],'partial_failure')
        repair['repairOfRunId']='a';repair['repairedStepIds']=[]
        self.assertEqual(self.evaluate(receipt,repair=repair)['status'],'partial_failure')
        repair['repairedStepIds']=['talk'];repair['steps']=[{'status':'failed'}]
        self.assertEqual(self.evaluate(receipt,repair=repair)['status'],'partial_failure')
        repair['steps']=[{'status':'success'}]
        self.assertTrue(self.evaluate(receipt,repair=repair)['repaired'])
        receipt['steps'].append({'id':'uncompleted','status':'running'})
        self.assertFalse(self.evaluate(receipt,repair=repair)['repaired'])

    def test_repaired_daily_run_does_not_hide_tomorrows_missed_run(self):
        self.item.update(id='server',maxAgeHours=36)
        yesterday=self.now-dt.timedelta(hours=24)
        self.assertIn('DAILY_RUN_MISSED',self.evaluate({'status':'success','lastSuccessAt':lib.stamp(yesterday)})['codes'])

    def test_old_repair_never_clears_current_operational_block(self):
        self.item.update(id='server',maxAgeHours=36)
        repair={'status':'success','repairOfRunId':'a','finishedAt':lib.stamp(self.now),
                'repairedStepIds':['talk'],'steps':[{'status':'success'}]}
        for status, code in [('blocked','BACKUP_PUBLIC_KEY_MISSING'),('paused','BACKUP_STOPPED')]:
            with self.subTest(status=status):
                receipt={'runId':'a','status':status,'issues':[{'code':code}],
                         'finishedAt':lib.stamp(self.now-dt.timedelta(minutes=1)),
                         'steps':[{'id':'talk','status':'failed'}]}
                row=self.evaluate(receipt,repair=repair)
                self.assertEqual(row['status'],status)
                self.assertIn(code,row['codes'])
                self.assertFalse(row['repaired'])

    def test_late_partial_repair_preserves_original_data_age(self):
        self.item.update(id='server',maxAgeHours=36)
        original=self.now-dt.timedelta(hours=32)
        receipt={'runId':'a','status':'partial_failure','startedAt':lib.stamp(original),
                 'finishedAt':lib.stamp(original+dt.timedelta(hours=5)),
                 'steps':[{'id':'talk','status':'failed'}]}
        repair={'status':'success','repairOfRunId':'a','finishedAt':lib.stamp(self.now),
                'repairedStepIds':['talk'],'steps':[{'status':'success'}]}
        row=self.evaluate(receipt,repair=repair,task={'exists':True,'enabled':True,'result':1,'lastRunAt':lib.stamp(original)})
        self.assertTrue(row['repaired'])
        self.assertEqual(row['lastSuccessAt'],lib.stamp(original))
        self.assertEqual(row['repairedAt'],lib.stamp(self.now))
        self.assertIn('DAILY_RUN_MISSED',row['codes'])
        self.assertNotIn('SCHEDULE_LAST_RUN_FAILED',row['codes'])

    def test_failed_delivery_retries_and_success_deduplicates(self):
        calls=[]
        def fail(*args): calls.append(1);return {'accepted':False}
        def success(*args): calls.append(1);return {'accepted':True}
        health.update_notifications(self.root,self.summary(),lib,self.now,fail)
        health.update_notifications(self.root,self.summary(),lib,self.now+dt.timedelta(minutes=15),success)
        health.update_notifications(self.root,self.summary(),lib,self.now+dt.timedelta(minutes=30),success)
        self.assertEqual(len(calls),2)
        state=lib.read_json(self.root/'backup-notification-state.json')
        self.assertIsNone(state['pendingEvent'])

    def test_recovery_notification_failure_retries(self):
        success=lambda *_:{'accepted':True}
        health.update_notifications(self.root,self.summary(),lib,self.now,success)
        health.update_notifications(self.root,self.summary('healthy'),lib,self.now+dt.timedelta(minutes=1),lambda *_:{'accepted':False})
        calls=[]
        health.update_notifications(self.root,self.summary('healthy'),lib,self.now+dt.timedelta(minutes=2),lambda *_:calls.append(1) or {'accepted':True})
        self.assertEqual(len(calls),1)

    def test_resolved_failure_is_not_retried_during_normal_pending(self):
        health.update_notifications(self.root,self.summary(),lib,self.now,lambda *_:{'accepted':False})
        pending={'status':'pending','components':[{'id':'onedrive','label':'OneDrive','status':'pending','codes':[]}],'issues':[]}
        calls=[];sender=lambda *_:calls.append(1) or {'accepted':True}
        health.update_notifications(self.root,pending,lib,self.now+dt.timedelta(minutes=1),sender)
        self.assertEqual(calls,[])
        # The failure was never shown, so its recovery is not announced either (10-20 18:47).
        health.update_notifications(self.root,self.summary('healthy'),lib,self.now+dt.timedelta(minutes=2),sender)
        self.assertEqual(calls,[])

    def test_recovery_is_announced_only_after_a_failure_notice_was_shown(self):
        def run(steps):
            sent = []
            for minute, (state, accepted) in enumerate(steps):
                health.update_notifications(self.root, self.summary(state), lib, self.now + dt.timedelta(minutes=minute),
                                            lambda root, event, _: sent.append(event['title']) or {'accepted': accepted})
            return sent
        shown = run([('failed', True), ('healthy', True)])
        self.assertEqual(shown, ['SYNK 백업 확인 필요', 'SYNK 백업 정상 복구'])
        (self.root / 'backup-notification-state.json').unlink()
        # Shown once, then a changed failure that was not delivered: the owner still waits for the recovery.
        self.assertEqual(run([('failed', True), ('attention', False), ('healthy', True)])[-1], 'SYNK 백업 정상 복구')
        (self.root / 'backup-notification-state.json').unlink()
        self.assertEqual(run([('failed', False), ('failed', False), ('healthy', True)]), ['SYNK 백업 확인 필요'] * 2)
        state = lib.read_json(self.root / 'backup-notification-state.json')
        self.assertEqual((state['hasUnresolved'], state['pendingEvent'], state['schemaVersion']), (False, None, 2))

    def test_state_from_before_reads_the_last_delivered_notice(self):
        # Until 10-20 any failure set hasUnresolved; the live state then had it after the undelivered 18:47 failure.
        saved = {'healthy': 'a' * 64, 'attention': 'b' * 64}
        for status, event_id in saved.items():
            lib.atomic_json(self.root / '상태' / '알림' / (event_id + '.json'), {'id': event_id, 'status': status})
        def recovery(event_id, **state):
            lib.atomic_json(self.root / 'backup-notification-state.json', dict({'lastDeliveredEventId': event_id,
                'fingerprint': 'old', 'hasUnresolved': True, 'pendingEvent': None}, **state))
            sent = []
            health.update_notifications(self.root, self.summary('healthy'), lib, self.now,
                                        lambda root, event, _: sent.append(event['title']) or {'accepted': True})
            return sent
        self.assertEqual(recovery(saved['healthy']), [])
        written = lib.read_json(self.root / 'backup-notification-state.json')
        self.assertEqual((written['schemaVersion'], written['hasUnresolved']), (2, False))
        self.assertEqual(recovery(saved['attention']), ['SYNK 백업 정상 복구'])
        self.assertEqual(recovery('c' * 64), ['SYNK 백업 정상 복구'])  # no saved copy: as before
        lib.atomic_json(self.root / '상태' / 'decoy.json', {'status': 'healthy'})
        self.assertEqual(recovery('../decoy'), ['SYNK 백업 정상 복구'])  # only an event id names a saved notice
        # Read once: a state already in the new form keeps its own answer.
        self.assertEqual(recovery(saved['healthy'], schemaVersion=2), ['SYNK 백업 정상 복구'])

    def test_persistent_failure_reminder_daily_not_every_poll(self):
        calls=[];sender=lambda *_:calls.append(1) or {'accepted':True}
        health.update_notifications(self.root,self.summary(),lib,self.now,sender)
        health.update_notifications(self.root,self.summary(),lib,self.now+dt.timedelta(hours=23),sender)
        health.update_notifications(self.root,self.summary(),lib,self.now+dt.timedelta(hours=24),sender)
        self.assertEqual(len(calls),2)

    def test_raw_provider_errors_never_enter_notification(self):
        row=self.evaluate({'status':'failed','error':'SECRET','issues':[{'code':'SECRET=value'}, {'code':'AUTH_FAILED'}]})
        self.assertNotIn('SECRET',json.dumps(row))
        self.assertEqual(row['codes'],['AUTH_FAILED'])

    def test_corrupt_notification_state_does_not_silence_failure(self):
        (self.root/'backup-notification-state.json').write_text('{broken',encoding='utf-8')
        calls=[]
        health.update_notifications(self.root,self.summary(),lib,self.now,lambda *_:calls.append(1) or {'accepted':True})
        self.assertEqual(len(calls),1)

    def test_scheduled_command_preserves_child_failure_exit(self):
        config=self.root/'config with spaces.json'
        config.write_text(json.dumps({'components':[{'id':'fixture','command':[sys.executable,'-c','raise SystemExit(7)'],
            'workingDirectory':str(self.root),'maxRunHours':0.01}]}),encoding='utf-8')
        result=subprocess.run([sys.executable,str(REPO/'tools'/'backup-command.py'),'--config',str(config),'--id','fixture'],
            capture_output=True,timeout=10)
        self.assertEqual(result.returncode,7)
        data=json.loads(config.read_text(encoding='utf-8'))
        data['auxiliaryTasks']=data.pop('components');data['components']=[]
        config.write_text(json.dumps(data),encoding='utf-8')
        result=subprocess.run([sys.executable,str(REPO/'tools'/'backup-command.py'),'--config',str(config),'--id','fixture'],
            capture_output=True,timeout=10)
        self.assertEqual(result.returncode,7)

    def tree_config(self, marker, hours):
        # The child starts a grandchild (as node starts git or pwsh); both would sleep far past the limit.
        child=[sys.executable,'-c','import os, subprocess, sys, time; g=subprocess.Popen([sys.executable,"-c","import time; time.sleep(120)"]); '
               f'open({str(marker)!r},"w").write(str(os.getpid())+" "+str(g.pid)); time.sleep(120)']
        config=self.root/'config.json'
        config.write_text(json.dumps({'components':[{'id':'fixture','command':child,'workingDirectory':str(self.root),'maxRunHours':hours}]}),encoding='utf-8')
        return config

    @unittest.skipUnless(os.name=='nt','Windows job object')
    def test_scheduled_command_limit_ends_the_whole_backup_tree_with_124(self):
        # 10-20: under load taskkill.exe started too slowly, its 20-second timeout escaped and only the wrapper ended.
        # The limit ends the child and its children through the job, without starting a new process.
        marker=self.root/'pids.txt'; started=time.monotonic()
        result=subprocess.run([sys.executable,str(REPO/'tools'/'backup-command.py'),'--config',str(self.tree_config(marker,4/3600)),'--id','fixture'],
            capture_output=True,timeout=60)
        self.assertEqual(result.returncode,124); self.assertLess(time.monotonic()-started,30)
        pids=list(map(int,marker.read_text().split()))
        self.assertTrue(wait_until(lambda: not any(map(alive,pids)),10))
        trace=[json.loads(line) for line in (self.root/'상태'/'예약실행'/'fixture.jsonl').read_text(encoding='utf-8').splitlines()]
        self.assertEqual([x['event'] for x in trace],['start','stopped','end']); self.assertTrue(trace[0]['job'])
        self.assertEqual((trace[-1]['exitCode'],trace[-1]['reason']),(124,'limit'))


def alive(pid):
    k32=ctypes.WinDLL('kernel32'); k32.OpenProcess.restype=ctypes.c_void_p
    k32.GetExitCodeProcess.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_ulong)]; k32.CloseHandle.argtypes=[ctypes.c_void_p]
    handle=k32.OpenProcess(0x1000,False,pid)
    if not handle: return False
    try:
        code=ctypes.c_ulong(); return bool(k32.GetExitCodeProcess(handle,ctypes.byref(code))) and code.value==259
    finally: k32.CloseHandle(handle)


def wait_until(test, seconds):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        if test(): return True
        time.sleep(0.2)
    return test()


class SpaceGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.now = dt.datetime(2026, 10, 19, 12, tzinfo=dt.timezone.utc)
        self.task = {'id': 'space', 'exists': True, 'enabled': True, 'state': 'Ready', 'result': 0,
                     'lastRunAt': lib.stamp(self.now - dt.timedelta(minutes=20, seconds=3))}

    def tearDown(self): self.temp.cleanup()

    def receipt(self, status='ok', age=dt.timedelta(minutes=20), free=386 * 1024**3):
        # The guard counts GB as Explorer does (1024³) since 10-20, so its floor is 300 * 1024³ bytes.
        lib.atomic_json(self.root / health.SPACE_GUARD['receipt'], {'schemaVersion': 1, 'checkedAt': lib.stamp(self.now - age),
            'status': status, 'freeBefore': free, 'freeAfter': free, 'floor': 300 * 1024**3})

    def guard(self, **task):
        return health.space_guard(self.root, lib, dict(self.task, **task), self.now)

    def test_recent_check_is_healthy_even_below_cleanup_start(self):
        self.receipt()
        row = self.guard()
        self.assertEqual((row['status'], row['codes']), ('healthy', []))
        self.assertEqual(row['lastSuccessAt'], lib.stamp(self.now - dt.timedelta(minutes=20)))
        self.receipt('low', free=312 * 1024**3)
        self.assertEqual(self.guard()['status'], 'healthy')

    def test_stalled_check_is_a_problem_unless_a_run_is_still_inside_its_limit(self):
        self.receipt(age=dt.timedelta(hours=2, minutes=1))
        row = self.guard()
        self.assertEqual((row['status'], row['codes'], row['detail']), ('attention', ['SPACE_GUARD_STALE'], '2시간째 점검 없음'))
        self.assertEqual(self.guard(state='Running', lastRunAt=lib.stamp(self.now-dt.timedelta(minutes=50)))['status'], 'healthy')
        self.assertEqual(self.guard(state='Running', lastRunAt=lib.stamp(self.now-dt.timedelta(hours=2, minutes=5)))['status'], 'attention')
        # A failed run after the last receipt is reported before the 2-hour mark.
        self.receipt(age=dt.timedelta(minutes=40))
        row = self.guard(result=1, lastRunAt=lib.stamp(self.now-dt.timedelta(minutes=10)))
        self.assertEqual((row['status'], row['codes']), ('attention', ['SCHEDULE_LAST_RUN_FAILED']))

    def test_check_age_and_run_window_count_awake_hours(self):
        # A night asleep is not a stalled guard; without the record the wall clock judges as before.
        guard = lambda spans, **task: health.space_guard(self.root, lib, dict(self.task, **task), self.now, suspended=spans)
        hours = lambda value: self.now - dt.timedelta(hours=value)
        self.receipt(age=dt.timedelta(hours=9))
        self.assertEqual(guard([(hours(8.8), hours(0.1))])['status'], 'healthy')
        for spans in (None, [], [(hours(8), hours(4))]):
            with self.subTest(spans=spans):
                self.assertEqual(guard(spans)['codes'], ['SPACE_GUARD_STALE'])
        # The whole check hands the guard the same record.
        summary = health.gather(self.root, lib, {'components': []}, {'space': self.task}, self.now, lambda: [(hours(8.8), hours(0.1))])
        self.assertEqual((summary['status'], summary['components'][0]['status']), ('healthy', 'healthy'))
        # A run that slept an hour is still inside its 2-hour limit 2.5 wall-clock hours after it started.
        self.receipt(age=dt.timedelta(hours=5))
        run = dict(state='Running', lastRunAt=lib.stamp(hours(2.5)))
        self.assertEqual(guard([(hours(2), hours(1))], **run)['status'], 'healthy')
        self.assertEqual(guard(None, **run)['codes'], ['SPACE_GUARD_STALE'])

    def test_free_space_below_floor_is_reported_with_the_numbers(self):
        self.receipt('attention', free=285 * 1024**3)  # 10억 바이트로 나누면 306GB(지킬 선 322GB)로 보인다
        row = self.guard()
        self.assertEqual((row['status'], row['codes']), ('attention', ['DISK_FREE_BELOW_FLOOR']))
        event, _, unresolved = health.choose_event({'status': 'attention', 'components': [row], 'issues': []}, {}, self.now, lib)
        self.assertTrue(unresolved)
        self.assertEqual(event['body'], '공간 지킴이(C: 여유 300GB): 남은 공간 285GB(지킬 선 300GB)')

    def test_unregistered_schedule_waits_without_failing_or_blocking_recovery(self):
        self.receipt(age=dt.timedelta(hours=30))  # only the one manual check
        row = health.space_guard(self.root, lib, None, self.now)
        self.assertEqual((row['status'], row['codes']), ('not_ready', ['SPACE_GUARD_SCHEDULE_NOT_REGISTERED']))
        self.assertNotIn('not_ready', health.BAD)
        lib.atomic_json(self.root / 'onedrive.json', {'status': 'healthy', 'lastSuccessAt': lib.stamp(self.now)})
        config = {'components': [{'id': 'onedrive', 'receipt': 'onedrive.json', 'maxAgeHours': 2}]}
        summary = health.gather(self.root, lib, config, {'onedrive': {'exists': True, 'enabled': True, 'result': 0}}, self.now)
        self.assertEqual([x['id'] for x in summary['components']], ['onedrive', 'space'])
        self.assertEqual((summary['status'], summary['issues']), ('healthy', []))
        (self.root / health.SPACE_GUARD['receipt']).write_text('{broken', encoding='utf-8')
        self.assertEqual(health.space_guard(self.root, lib, None, self.now)['status'], 'not_ready')
        self.assertEqual(self.guard()['codes'], ['RECEIPT_UNREADABLE'])
        # Registered but disabled means nothing guards the disk.
        self.assertEqual(self.guard(enabled=False)['codes'], ['SCHEDULE_MISSING_OR_DISABLED'])

    def test_just_registered_schedule_waits_for_its_first_run(self):
        self.receipt(age=dt.timedelta(hours=30))  # the old manual check
        first = dict(lastRunAt=None, result=267011, nextRunAt=lib.stamp(self.now + dt.timedelta(minutes=3)))
        row = self.guard(**first)
        self.assertEqual((row['status'], row['codes']), ('not_ready', ['SPACE_GUARD_FIRST_RUN_PENDING']))
        # A task that never ran and has no upcoming run is a stalled guard, not a pending one.
        self.assertEqual(self.guard(**dict(first, nextRunAt=None))['codes'], ['SPACE_GUARD_STALE'])

    def test_ledger_nearing_the_onedrive_limit_warns_first(self):
        self.receipt()
        with (self.root / health.SPACE_GUARD['ledger']).open('wb') as ledger: ledger.truncate(health.SPACE_LEDGER_WARN_BYTES - 1)
        self.assertEqual(self.guard()['status'], 'healthy')
        with (self.root / health.SPACE_GUARD['ledger']).open('ab') as ledger: ledger.write(b'\n')
        self.assertEqual(self.guard()['codes'], ['SPACE_LEDGER_NEAR_ONEDRIVE_LIMIT'])

    def test_ledger_parts_are_each_checked_including_the_one_being_written(self):
        # The guard continues the ledger in 내려놓은목록-002.jsonl, -003… at 4MiB. A part that still grows to 8MiB is reported.
        self.receipt()
        base = self.root / health.SPACE_GUARD['ledger']
        base.write_bytes(b'{}\n')
        part = base.with_name('내려놓은목록-002.jsonl')
        with part.open('wb') as ledger: ledger.truncate(health.SPACE_LEDGER_WARN_BYTES - 1)
        for other in ('내려놓은목록-02.jsonl', '내려놓은목록-002.jsonl.tmp', '점검.log'):  # not ledger parts
            with base.with_name(other).open('wb') as f: f.truncate(health.SPACE_LEDGER_WARN_BYTES)
        self.assertEqual(self.guard()['status'], 'healthy')
        with part.open('ab') as ledger: ledger.write(b'\n')
        row = self.guard()
        self.assertEqual((row['status'], row['codes']), ('attention', ['SPACE_LEDGER_NEAR_ONEDRIVE_LIMIT']))
        self.assertEqual(row['detail'], '내려놓은 장부 내려놓은목록-002.jsonl 8.0MiB(OneDrive 10MiB 한도 전에 나눠야 함)')
        self.assertEqual([p.name for p in sorted(health.ledger_parts(self.root))], ['내려놓은목록-002.jsonl', '내려놓은목록.jsonl'])

    def test_schedule_query_adds_the_guard_to_a_temporary_copy_only(self):
        config = self.root / 'backup-health-config.json'
        original = json.dumps({'components': [{'id': 'onedrive', 'taskName': 'SYNK OneDrive 문서 백업'}]}, ensure_ascii=False)
        config.write_text(original, encoding='utf-8')
        seen = {}
        def run(args, **_):
            seen['path'] = Path(args[args.index('-ConfigPath') + 1])
            seen['query'] = json.loads(seen['path'].read_text(encoding='utf-8'))
            return subprocess.CompletedProcess(args, 0, json.dumps([{'id': 'space', 'exists': False}]).encode(), b'')
        with patch.object(health.subprocess, 'run', side_effect=run):
            tasks = health.task_snapshot(config, (health.SPACE_GUARD,))
        self.assertEqual(seen['query']['additionalChecks'], [{'id': 'space', 'taskName': 'SYNK 공간 지킴이'}])
        self.assertEqual(tasks, {'space': {'id': 'space', 'exists': False}})
        self.assertFalse(seen['path'].exists())
        self.assertEqual(config.read_text(encoding='utf-8'), original)


if __name__ == '__main__': unittest.main()
