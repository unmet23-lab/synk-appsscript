#!/usr/bin/env python3
"""Offline run-check tests: only temp files and a mocked docs-io process."""
import contextlib
import io
import json
import os
import stat
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).with_name('run-check.py').read_text(encoding='utf-8')
HOME_LINE = "H=pathlib.Path('/var/lib/synk-argon-77yuhbs')"
assert SOURCE.count(HOME_LINE) == 1
# Replace only the fixed filesystem root in the in-memory test copy.
CODE = compile(SOURCE.replace(HOME_LINE, 'H=TEST_HOME'), 'run-check.py', 'exec')
BASE = 'a' * 64
NEW = 'b' * 64
ROLE = 'synkbrief'


def events(response, model='gemini-4-argon-high', denied=None, status='SUCCESS', error=None):
    result = {'conversation_id': 'synthetic-conversation', 'status': status,
              'denied_actions': denied or [], 'response': response}
    if error:
        result['error'] = error
    return [
        {'event': 'init', 'conversation_id': 'synthetic-conversation', 'init': {'model': model}},
        {'event': 'result', 'result': result},
    ]


INTERRUPTED = 'The stream was interrupted. Please continue the task you were working on.'


class RunCheckTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        (self.home / 'logs').mkdir()
        self.log = self.home / 'logs' / (ROLE + '.stream.jsonl')
        self.log.write_bytes(b'{"previous":"ignored-before-offset"}\n')
        self.record = self.home / 'run-status' / (ROLE + '.json')

    def tearDown(self):
        self.tmp.cleanup()

    def run_checker(self, action, doc_sha=BASE, service='success', doc_failure=False, invocation='', doc_exception=None):
        calls = []
        def fake_run(args, **kwargs):
            calls.append((args, kwargs))
            self.assertEqual(args, ['/usr/bin/python3', '/opt/synk-argon-77yuhbs/docs-io.py', 'read', ROLE])
            self.assertEqual(kwargs['timeout'], 100)
            if doc_exception:
                raise RuntimeError(doc_exception)
            payload = {'documentId': 'synthetic-doc', 'sha256': doc_sha,
                       'revisionId': 'r-synthetic', 'plaintext': 'irrelevant'}
            return subprocess.CompletedProcess(args, 1 if doc_failure else 0,
                                               json.dumps(payload), '')
        with patch.object(sys, 'argv', ['run-check.py', action, ROLE]), \
                patch.dict(os.environ, {'SERVICE_RESULT': service, 'INVOCATION_ID': invocation}), \
                patch.object(subprocess, 'run', side_effect=fake_run), \
                contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            try:
                exec(CODE, {'TEST_HOME': self.home, '__name__': '__main__'})
                code = 0
            except SystemExit as exc:
                code = exc.code
        return code, json.loads(self.record.read_text()), calls

    def begin_and_append(self, output):
        code, state, calls = self.run_checker('begin')
        self.assertEqual(code, 0)
        self.assertEqual(state['baselineSha256'], BASE)
        self.assertEqual(len(calls), 1)
        with self.log.open('ab') as handle:
            for item in output:
                handle.write((json.dumps(item) + '\n').encode())

    def test_valid_complete_ignores_previous_run_and_checks_doc_sha(self):
        self.begin_and_append(events('SYNK_RUN_COMPLETE: synkbrief : ' + NEW + '\nSummary'))
        code, state, calls = self.run_checker('end', NEW)
        self.assertEqual((code, state['status'], state['sha256']), (0, 'complete', NEW))
        self.assertEqual(state['model'], 'gemini-4-argon-high')
        self.assertEqual(len(calls), 1)

    def test_wrong_model_rejected_before_doc_read(self):
        self.begin_and_append(events('SYNK_RUN_NO_CHANGE: synkbrief', model='gemini-3.8-flash-high'))
        code, state, calls = self.run_checker('end')
        self.assertEqual((code, state['error'], len(calls)), (1, 'MODEL_MISMATCH', 0))

    def test_denied_action_rejected_before_doc_read(self):
        self.begin_and_append(events('SYNK_RUN_NO_CHANGE: synkbrief', denied=['synthetic-denial']))
        code, state, calls = self.run_checker('end')
        self.assertEqual((code, state['error'], len(calls)), (1, 'CLI_FAILED_OR_DENIED', 0))

    def test_matching_no_change_requires_baseline_hash(self):
        self.begin_and_append(events('SYNK_RUN_NO_CHANGE: synkbrief\nNo new sources'))
        code, state, calls = self.run_checker('end')
        self.assertEqual((code, state['status'], len(calls)), (0, 'no-change', 1))

    def test_mismatched_no_change_fails(self):
        self.begin_and_append(events('SYNK_RUN_NO_CHANGE: synkbrief'))
        code, state, calls = self.run_checker('end', NEW)
        self.assertEqual((code, state['error'], len(calls)), (1, 'NO_CHANGE_DOC_CHANGED_OR_NO_BASELINE', 1))

    def test_malformed_or_second_line_marker_fails(self):
        for response in ['SYNK_RUN_NO_CHANGE: synkbrief-extra',
                         'Preface\nSYNK_RUN_COMPLETE: synkbrief : ' + NEW,
                         'SYNK_RUN_COMPLETE: full : ' + NEW]:
            with self.subTest(response=response):
                self.begin_and_append(events(response))
                code, state, calls = self.run_checker('end', NEW)
                self.assertEqual((code, state['error'], len(calls)), (1, 'MISSING_DELIVERY_MARKER', 0))

    def test_missing_result_fails(self):
        self.begin_and_append(events('unused')[:1])
        code, state, calls = self.run_checker('end')
        self.assertEqual((code, state['error'], len(calls)), (1, 'MISSING_OR_MULTIPLE_RUNS', 0))

    def test_failed_service_rejects_valid_model_response(self):
        self.begin_and_append(events('SYNK_RUN_COMPLETE: synkbrief : ' + NEW))
        code, state, calls = self.run_checker('end', NEW, service='timeout')
        self.assertEqual((code, state['error'], len(calls)), (1, 'SERVICE_FAILED', 0))

    def test_complete_hash_mismatch_fails(self):
        self.begin_and_append(events('SYNK_RUN_COMPLETE: synkbrief : ' + NEW))
        code, state, calls = self.run_checker('end', BASE)
        self.assertEqual((code, state['error'], len(calls)), (1, 'DOC_SHA_MISMATCH', 1))

    def test_transport_error_after_verified_delivery_is_complete(self):
        # 10-19·20 yt-tt·meta-brand: the Doc was saved and the marker sent, then the model stream broke.
        for response in ['SYNK_RUN_COMPLETE: synkbrief : ' + NEW + '\nSummary',
                         ' Cui\nSYNK_RUN_COMPLETE: synkbrief : ' + NEW + '\nSummary']:
            with self.subTest(response=response[:8]):
                self.begin_and_append(events(response, status='ERROR', error=INTERRUPTED))
                code, state, calls = self.run_checker('end', NEW)
                self.assertEqual((code, state['status'], state['sha256'], len(calls)), (0, 'complete', NEW, 1))
                self.assertEqual((state['cliStatus'], state['cliError']), ('ERROR', INTERRUPTED))
                receipt = next(item for item in (json.loads(p.read_text()) for p in
                                                 (self.home / 'run-status' / 'history').glob('*.json'))
                               if item['startedAt'] == state['startedAt'])
                self.assertEqual((receipt['status'], receipt['cliStatus']), ('complete', 'ERROR'))
                self.assertNotIn('cliError', receipt)

    def test_transport_error_still_needs_marker_and_matching_doc(self):
        cases = [('SYNK_RUN_NO_CHANGE: synkbrief', BASE, 'CLI_FAILED_OR_DENIED', 0),
                 ('partial answer', NEW, 'CLI_FAILED_OR_DENIED', 0),
                 ('a\nb\nc\nSYNK_RUN_COMPLETE: synkbrief : ' + NEW, NEW, 'CLI_FAILED_OR_DENIED', 0),
                 ('SYNK_RUN_COMPLETE: synkbrief : ' + NEW, BASE, 'DOC_SHA_MISMATCH', 1)]
        for response, doc_sha, error, reads in cases:
            with self.subTest(response=response[:12], doc=doc_sha[:1]):
                self.begin_and_append(events(response, status='ERROR', error=INTERRUPTED))
                code, state, calls = self.run_checker('end', doc_sha)
                self.assertEqual((code, state['error'], len(calls)), (1, error, reads))

    def test_denied_action_fails_even_with_verified_marker(self):
        self.begin_and_append(events('SYNK_RUN_COMPLETE: synkbrief : ' + NEW, status='ERROR',
                                     error=INTERRUPTED, denied=['synthetic-denial']))
        code, state, calls = self.run_checker('end', NEW)
        self.assertEqual((code, state['error'], len(calls)), (1, 'CLI_FAILED_OR_DENIED', 0))

    def test_begin_read_failure_records_failed_and_exits(self):
        code, state, calls = self.run_checker('begin', doc_failure=True)
        self.assertEqual((code, state['status'], state['error'], len(calls)),
                         (1, 'failed', 'BEGIN_DOC_READ_FAILED', 1))

    def test_terminal_receipts_cover_all_states_without_report_or_revision(self):
        for response, expected in [('SYNK_RUN_COMPLETE: synkbrief : ' + NEW, 'complete'),
                                   ('SYNK_RUN_NO_CHANGE: synkbrief', 'no-change'),
                                   ('invalid marker', 'failed')]:
            with self.subTest(expected=expected):
                self.begin_and_append(events(response + '\nSECRET_REPORT_BODY'))
                sha = NEW if expected == 'complete' else BASE
                _, state, _ = self.run_checker('end', sha)
                history = list((self.home / 'run-status' / 'history').glob('*.json'))
                receipts = [json.loads(path.read_text()) for path in history]
                receipt = next(item for item in receipts if item['startedAt'] == state['startedAt'])
                self.assertEqual(receipt['status'], expected)
                self.assertEqual(receipt['baselineSha256'], BASE)
                self.assertNotIn('response', receipt)
                self.assertNotIn('revisionId', receipt)
                self.assertNotIn('baselineRevisionId', receipt)
                self.assertNotIn('SECRET_REPORT_BODY', json.dumps(receipt))
                if expected != 'failed':
                    self.assertEqual(receipt['model'], 'gemini-4-argon-high')
                    self.assertEqual(receipt['sha256'], sha)
                if os.name == 'posix':
                    self.assertTrue(all(stat.S_IMODE(path.stat().st_mode) == 0o600 for path in history))
        self.assertEqual(len(list((self.home / 'run-status' / 'history').glob('*.json'))), 3)

    def test_invocation_receipt_survives_next_begin(self):
        invocation = '0123456789abcdef' * 2
        code, state, _ = self.run_checker('begin', invocation=invocation)
        self.assertEqual((code, state['invocationId']), (0, invocation))
        with self.log.open('ab') as handle:
            for item in events('SYNK_RUN_COMPLETE: synkbrief : ' + NEW):
                handle.write((json.dumps(item) + '\n').encode())
        self.run_checker('end', NEW, invocation=invocation)
        receipt_path = self.home / 'run-status' / 'history' / (ROLE + '-' + invocation + '.json')
        saved = receipt_path.read_bytes()
        receipt = json.loads(saved)
        self.assertEqual((receipt['invocationId'], receipt['status']), (invocation, 'complete'))
        self.run_checker('begin', invocation='f' * 32)
        self.assertEqual(receipt_path.read_bytes(), saved)
        self.assertEqual(json.loads(self.record.read_text())['status'], 'running')

    def test_invalid_invocation_is_safe_failure_without_doc_read(self):
        code, state, calls = self.run_checker('begin', invocation='../SECRET_INVOCATION')
        self.assertEqual((code, state['error'], len(calls)), (1, 'BEGIN_INVOCATION_ID_INVALID', 0))
        receipt_path, = (self.home / 'run-status' / 'history').glob('*.json')
        receipt = json.loads(receipt_path.read_text())
        self.assertNotIn('invocationId', receipt)
        self.assertEqual(receipt['error'], 'BEGIN_INVOCATION_ID_INVALID')
        self.assertNotIn('SECRET_INVOCATION', receipt_path.read_text())

    def test_freeform_failure_message_is_not_archived(self):
        code, state, _ = self.run_checker('begin', doc_exception='SECRET_RESPONSE_FROM_TOOL')
        self.assertEqual((code, state['status']), (1, 'failed'))
        receipt_path, = (self.home / 'run-status' / 'history').glob('*.json')
        receipt = json.loads(receipt_path.read_text())
        self.assertEqual(receipt['error'], 'RUN_CHECK_FAILED')
        self.assertNotIn('SECRET_RESPONSE_FROM_TOOL', receipt_path.read_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
