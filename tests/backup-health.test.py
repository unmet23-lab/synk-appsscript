"""Backup alarms tested with synthetic receipts; no cloud writes or notifications."""
import contextlib
import ctypes
import datetime as dt
import importlib.util
import io
import json
import os
from pathlib import Path
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
        health.update_notifications(self.root,self.summary('healthy'),lib,self.now+dt.timedelta(minutes=2),sender)
        self.assertEqual(len(calls),1)

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
