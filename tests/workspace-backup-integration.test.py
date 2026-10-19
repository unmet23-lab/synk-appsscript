"""Ensure a new backup scope cannot inherit old success or overwrite its receipt."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2] / 'SYNK_원본창고'
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location('daily_workspace_test', ROOT / '매일백업.py')
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)


class WorkspaceIntegrationTests(unittest.TestCase):
    def test_old_success_does_not_cover_new_sources(self):
        receipt = {'runId': 'old', 'status': 'success', 'finishedAt': 'new', 'steps': [
            {'id': 'company', 'status': 'success'}]}
        result = daily.workspace_summary(receipt, {'lastSuccessAt': 'prior'})
        self.assertEqual(result['status'], 'partial_failure')
        self.assertEqual(result['lastSuccessAt'], 'prior')

    def steps(self):
        return [{'id': x, 'status': 'success'} for x in ['workspace', 'argon'] + [
            f'group-{daily.GROUPS.index(group)}-{action}'
            for group in daily.WORKSPACE_GROUPS for action in ('plan', 'files', 'verify', 'coverage')]]

    def test_remote_verification_is_required_for_both_groups(self):
        receipt = {'runId': 'new', 'status': 'success', 'finishedAt': 'now', 'steps': self.steps()}
        self.assertEqual(daily.workspace_summary(receipt)['status'], 'success')
        receipt['steps'][-1]['status'] = 'failed'
        self.assertEqual(daily.workspace_summary(receipt)['status'], 'partial_failure')
        receipt['steps'] = self.steps()[1:]
        self.assertEqual(daily.workspace_summary(receipt)['status'], 'partial_failure')

    def test_first_scope_keeps_original_daily_receipt(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(daily, 'HERE', Path(temp)):
            original = Path(temp) / 'backup-status.json'
            original.write_text('{"runId":"original-failed-run"}')
            daily.save_receipt({'scope': 'workspace', 'status': 'running'})
            self.assertEqual(json.loads(original.read_text())['runId'], 'original-failed-run')
            self.assertEqual(json.loads((Path(temp) / 'workspace-backup-status.json').read_text())['status'], 'running')

    def test_fetch_failure_cannot_be_hidden_by_successfully_uploading_old_ciphertext(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(daily, 'HERE', Path(temp)), \
                patch.object(daily, 'PUB', Path(temp) / 'public.pem'), \
                patch.object(daily, 'monitor'), patch.object(daily, 'log'), \
                patch.object(daily, 'snapshot'), patch.object(daily, 'check_uploaded', return_value=True):
            daily.PUB.write_text('fixture')
            invoked = []
            def fake_run(name, cmd, receipt, step_id, verify=False):
                invoked.append(step_id)
                receipt['steps'].append({'id': step_id, 'status': 'failed' if step_id == 'workspace' else 'success'})
                return step_id != 'workspace'
            with patch.object(daily, 'run', side_effect=fake_run):
                self.assertEqual(daily.execute('workspace'), 1)
            result = json.loads((Path(temp) / 'workspace-backup-status.json').read_text())
            self.assertEqual(result['status'], 'partial_failure')
            self.assertIsNone(result['lastSuccessAt'])
            self.assertNotIn('company', invoked)
            self.assertFalse((Path(temp) / 'backup-status.json').exists())


if __name__ == '__main__':
    unittest.main()
