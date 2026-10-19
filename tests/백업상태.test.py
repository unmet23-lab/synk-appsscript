"""Exercise the installed local backup tools without credentials, transfer, or real messages."""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

TOOLS = Path(os.environ.get('SYNK_BACKUP_TOOL_ROOT', str(Path(__file__).resolve().parents[2] / 'SYNK_원본창고')))
sys.path.insert(0, str(TOOLS))


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@unittest.skipUnless((TOOLS / '백업상태.py').exists(), 'Local backup tools are not installed on this host')
class BackupStatusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.status = load('backup_status_test', '백업상태.py')
        cls.daily = load('backup_daily_test', '매일백업.py')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='synk-backup-fixture-')
        self.root = Path(self.temp.name)
        self.now = dt.datetime(2026, 10, 18, 0, 0, tzinfo=dt.timezone.utc)
        self.config = {'firstExpectedAt': '2026-10-17T20:30:00Z'}

    def tearDown(self):
        self.temp.cleanup()

    def test_first_run_before_deadline_then_missed(self):
        initial = self.status.derive_status(None, self.config, self.now)
        self.assertEqual(initial['status'], 'first_run_pending')
        missed = self.status.derive_status(None, self.config, self.now + dt.timedelta(hours=3))
        self.assertEqual(missed['status'], 'missed')

    def test_failure_stop_missing_key_and_interrupted_are_not_success(self):
        self.assertEqual(self.status.derive_status({'status':'partial_failure'}, self.config, self.now)['status'], 'partial_failure')
        self.assertEqual(self.status.derive_status(None, self.config, self.now, stopped=True)['status'], 'paused')
        self.assertEqual(self.status.derive_status(None, self.config, self.now, key_exists=False)['status'], 'blocked')
        run = {'status':'running','pid':123,'startedAt':self.status.stamp(self.now),'heartbeatAt':self.status.stamp(self.now)}
        self.assertEqual(self.status.derive_status(run, self.config, self.now, alive=lambda _:False)['status'], 'interrupted')

    def test_failed_event_is_deduplicated_and_private_fields_excluded(self):
        receipt = {'status':'failed','runId':'one','providerError':'SECRET','steps':[]}
        result = self.status.derive_status(receipt, self.config, self.now)
        self.assertNotIn('SECRET', json.dumps(result))
        self.assertIsNotNone(self.status.record_event(self.root,result))
        self.assertIsNone(self.status.record_event(self.root,result))
        self.assertEqual(len((self.root/'backup-events.jsonl').read_text(encoding='utf-8').splitlines()),1)

    def test_intentional_stop_runs_real_daily_entry_without_subprocess(self):
        (self.root/'upload.stop').touch()
        with patch.object(self.daily,'HERE',self.root), patch.object(self.daily,'PUB',self.root/'missing-key'), patch.object(self.daily,'monitor',lambda *_:None), patch.object(self.daily.subprocess,'Popen',side_effect=AssertionError('must not start')):
            self.assertEqual(self.daily.main(),0)
        receipt=json.loads((self.root/'backup-status.json').read_text(encoding='utf-8'))
        self.assertEqual(receipt['status'],'paused')
        self.assertIsNone(receipt['lastSuccessAt'])

    def test_process_exit_zero_with_verify_mismatch_is_failure(self):
        receipt={'status':'running','steps':[]}
        with patch.object(self.daily,'HERE',self.root),patch.object(self.daily,'LOG',self.root/'daily.log'):
            ok=self.daily.run('fixture verify',[sys.executable,'-c','print("{\\"missing_or_bad\\": 2}")'],receipt,'verify',verify=True)
        self.assertFalse(ok)
        self.assertEqual(receipt['steps'][0]['code'],'VERIFY_MISMATCH')

    def test_successful_exit_without_verify_result_is_not_verified(self):
        receipt={'status':'running','steps':[]}
        with patch.object(self.daily,'HERE',self.root),patch.object(self.daily,'LOG',self.root/'daily.log'):
            ok=self.daily.run('fixture verify',[sys.executable,'-c','print("done")'],receipt,'verify',verify=True)
        self.assertFalse(ok)
        self.assertEqual(receipt['steps'][0]['code'],'VERIFY_RESULT_MISSING')

    def test_missing_planned_upload_detected_even_when_remote_upload_list_is_clean(self):
        folder=self.root/'상태'/'fixture';folder.mkdir(parents=True)
        (folder/'목록.json').write_text(json.dumps([{'path':'a','bytes':1,'sha256':'123'}]),encoding='utf-8')
        with patch.object(self.daily,'HERE',self.root):
            self.assertFalse(self.daily.check_uploaded('fixture'))
        (folder/'upload-done.jsonl').write_text(json.dumps({'path':'a','bytes':1,'sha256':'123','ok':True})+'\n',encoding='utf-8')
        with patch.object(self.daily,'HERE',self.root):
            self.assertTrue(self.daily.check_uploaded('fixture'))

    def test_atomic_receipt_and_os_lock_prevent_duplicate_execution(self):
        self.status.atomic_json(self.root/'receipt.json', {'status':'success'})
        self.assertEqual(self.status.read_json(self.root/'receipt.json')['status'],'success')
        with self.status.LocalLock(self.root/'locked'):
            with self.assertRaises(BlockingIOError):
                with self.status.LocalLock(self.root/'locked'):
                    pass

    def test_daily_partial_failure_keeps_previous_success_and_records_every_stage(self):
        public=self.root/'public.pem';public.touch()
        self.status.atomic_json(self.root/'backup-status.json',{'lastSuccessAt':'2026-10-16T23:00:00Z'})
        def fake_run(name, command, receipt, step_id, verify=False):
            passed=step_id!='talk'
            receipt['steps'].append({'id':step_id,'label':name,'status':'success' if passed else 'failed'})
            return passed
        with patch.object(self.daily,'HERE',self.root),patch.object(self.daily,'PUB',public),patch.object(self.daily,'LOG',self.root/'daily.log'),patch.object(self.daily,'monitor',lambda *_:None),patch.object(self.daily,'run',fake_run),patch.object(self.daily,'check_uploaded',lambda _:True):
            self.assertEqual(self.daily.main(),1)
        receipt=self.status.read_json(self.root/'backup-status.json')
        self.assertEqual(receipt['status'],'partial_failure')
        self.assertEqual(receipt['lastSuccessAt'],'2026-10-16T23:00:00Z')
        # 매일백업.py의 받기 명령 7개 다음에 묶음(GROUPS)마다 목록·올리기·대조·예정 파일 대조가 온다. talk 하나가 실패해도 모두 돈다.
        commands=['company','talk','hermes','radio-config','radio-cron','workspace','argon']
        groups=[f'group-{index}-{action}' for index in range(len(self.daily.GROUPS)) for action in ('plan','files','verify','coverage')]
        self.assertEqual([step['id'] for step in receipt['steps']],commands+groups)
        self.assertEqual(len(receipt['steps']),31)
        self.assertEqual([step['id'] for step in receipt['steps'] if step['status']!='success'],['talk'])


if __name__ == '__main__':
    unittest.main()
