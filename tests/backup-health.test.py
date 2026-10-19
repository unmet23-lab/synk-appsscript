"""Backup alarms tested with synthetic receipts; no cloud writes or notifications."""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
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


class SpaceGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.now = dt.datetime(2026, 10, 19, 12, tzinfo=dt.timezone.utc)
        self.task = {'id': 'space', 'exists': True, 'enabled': True, 'state': 'Ready', 'result': 0,
                     'lastRunAt': lib.stamp(self.now - dt.timedelta(minutes=20, seconds=3))}

    def tearDown(self): self.temp.cleanup()

    def receipt(self, status='ok', age=dt.timedelta(minutes=20), free=386 * 10**9):
        lib.atomic_json(self.root / health.SPACE_GUARD['receipt'], {'schemaVersion': 1, 'checkedAt': lib.stamp(self.now - age),
            'status': status, 'freeBefore': free, 'freeAfter': free, 'floor': 300 * 10**9})

    def guard(self, **task):
        return health.space_guard(self.root, lib, dict(self.task, **task), self.now)

    def test_recent_check_is_healthy_even_below_cleanup_start(self):
        self.receipt()
        row = self.guard()
        self.assertEqual((row['status'], row['codes']), ('healthy', []))
        self.assertEqual(row['lastSuccessAt'], lib.stamp(self.now - dt.timedelta(minutes=20)))
        self.receipt('low', free=312 * 10**9)
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
        self.receipt('attention', free=285 * 10**9)
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
