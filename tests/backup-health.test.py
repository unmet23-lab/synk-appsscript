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


if __name__ == '__main__': unittest.main()
