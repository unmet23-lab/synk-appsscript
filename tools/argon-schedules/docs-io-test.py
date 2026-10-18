#!/usr/bin/env python3
"""Offline tests only: fake gws subprocess, synthetic documents and temp files."""
import importlib.util
from contextlib import redirect_stdout
from io import StringIO
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('docs_io', Path(__file__).with_name('docs-io.py'))
io = importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)
TARGET = '16boBqiExm-qjCof8SQsEEpF2-5ckmK27Bc2kxKiFYwM'


def doc(text, revision='r1', tab=True):
    physical = text + '\n'
    end = 1 + io.utf16_length(physical)
    body = {'content': [
        {'endIndex': 1, 'sectionBreak': {'sectionStyle': {}}},
        {'startIndex': 1, 'endIndex': end, 'paragraph': {'elements': [
            {'startIndex': 1, 'endIndex': end, 'textRun': {'content': physical}}
        ]}}
    ]}
    value = {'documentId': TARGET, 'title': 'Synthetic', 'revisionId': revision}
    if tab:
        value['tabs'] = [{'tabProperties': {'tabId': 't.test'}, 'documentTab': {'body': body}}]
    else:
        value['body'] = body
    return value


class FakeGws:
    def __init__(self, text='old', failure=None, corrupt_readback=False):
        self.text, self.revision = text, 'r1'
        self.failure, self.corrupt_readback = failure, corrupt_readback
        self.calls, self.batches = [], []

    def __call__(self, args, **kwargs):
        assert args[:3] == [io.GWS, 'docs', 'documents']
        assert kwargs['shell'] is False
        assert kwargs['stdin'] == subprocess.DEVNULL
        assert set(kwargs['env']) == {'HOME', 'USER', 'PATH', 'LANG',
                                     'GOOGLE_WORKSPACE_CLI_CONFIG_DIR',
                                     'GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND'}
        method = args[3]
        params = json.loads(args[args.index('--params') + 1])
        assert params['documentId'] == TARGET
        self.calls.append(method)
        if method == 'get':
            assert params['includeTabsContent'] is True
            value = doc(self.text, self.revision)
        else:
            batch = json.loads(args[args.index('--json') + 1])
            self.batches.append(batch)
            if self.failure == 'timeout':
                raise subprocess.TimeoutExpired(args, 90)
            if self.failure == 'conflict':
                return subprocess.CompletedProcess(args, 1, '', 'Synthetic revision conflict')
            assert batch['writeControl'] == {'requiredRevisionId': self.revision}
            requests = batch['requests']
            if self.text:
                assert requests[0] == {'deleteContentRange': {'range': {
                    'startIndex': 1, 'endIndex': 1 + io.utf16_length(self.text), 'tabId': 't.test'}}}
            assert requests[-1]['insertText']['location'] == {'index': 1, 'tabId': 't.test'}
            self.text = requests[-1]['insertText']['text']
            if self.corrupt_readback:
                self.text += 'unexpected'
            self.revision = 'r2'
            value = {'documentId': TARGET, 'replies': [{} for _ in requests]}
        return subprocess.CompletedProcess(args, 0, json.dumps(value), '')


class DocsIoTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.work = self.root / 'work'
        self.work.mkdir(mode=0o700)
        self.path = self.work / 'result.txt'
        self.path.write_text('new 😀 한글\n', encoding='utf-8', newline='')
        self.context = patch.multiple(io, WORK=self.work, HOME=self.root,
                                      BACKUPS=self.root / 'backups')
        self.context.start()

    def tearDown(self):
        self.context.stop()
        self.temp.cleanup()

    def write(self, fake, expected='r1'):
        with patch.object(io.subprocess, 'run', side_effect=fake), \
                patch.object(io, 'backup_document', return_value='/private/synthetic-backup') as backup:
            result = io.write_document('synkbrief', TARGET, self.path, expected)
            return result, backup

    def test_utf16_emoji_single_tab_exact_plaintext(self):
        state = io.flatten(doc('😀한글\n'), TARGET)
        self.assertEqual(state['plaintext'], '😀한글\n')
        self.assertEqual(state['_endIndex'], 7)
        self.assertEqual(state['_tabId'], 't.test')

    def test_legacy_plain_body_is_readable(self):
        state = io.flatten(doc('old', tab=False), TARGET)
        self.assertEqual(state['plaintext'], 'old')
        self.assertIsNone(state['_tabId'])

    def test_table_and_multitab_refused(self):
        table = doc('old')
        table['tabs'][0]['documentTab']['body']['content'].append(
            {'startIndex': 5, 'endIndex': 9, 'table': {'rows': 1}})
        multiple = doc('old')
        multiple['tabs'].append(multiple['tabs'][0])
        for value, error in [(table, 'NON_PARAGRAPH'), (multiple, 'MULTITAB')]:
            with self.subTest(error=error), self.assertRaisesRegex(io.Refused, error):
                io.flatten(value, TARGET)

    def test_revision_conflict_before_write_sends_no_batch(self):
        fake = FakeGws()
        with self.assertRaisesRegex(io.Refused, 'REVISION_CONFLICT'):
            self.write(fake, 'stale')
        self.assertEqual(fake.calls, ['get'])
        self.assertEqual(fake.batches, [])

    def test_atomic_replace_with_exact_readback(self):
        fake = FakeGws('old 😀')
        result, backup = self.write(fake)
        self.assertEqual(fake.calls, ['get', 'batchUpdate', 'get'])
        self.assertEqual(len(fake.batches), 1)
        self.assertEqual(result['plaintext'], 'new 😀 한글\n')
        self.assertEqual(result['status'], 'saved-and-readback-verified')
        backup.assert_called_once()
        self.assertEqual(backup.call_args.args[1]['plaintext'], 'old 😀')

    def test_empty_document_has_no_delete_request(self):
        fake = FakeGws('')
        self.write(fake)
        self.assertEqual(len(fake.batches[0]['requests']), 1)

    def test_ambiguous_failure_and_server_conflict_never_retry(self):
        for failure in ['timeout', 'conflict']:
            fake = FakeGws(failure=failure)
            with self.subTest(failure=failure), self.assertRaisesRegex(io.Refused, 'NO_RETRY'):
                self.write(fake)
            self.assertEqual(fake.calls, ['get', 'batchUpdate'])
            self.assertEqual(len(fake.batches), 1)

    def test_readback_mismatch_never_rewrites(self):
        fake = FakeGws(corrupt_readback=True)
        with self.assertRaisesRegex(io.Refused, 'READBACK_MISMATCH'):
            self.write(fake)
        self.assertEqual(fake.calls, ['get', 'batchUpdate', 'get'])

    def test_outside_work_path_refused_before_network(self):
        outside = self.root / 'outside.txt'
        outside.write_text('outside', encoding='utf-8')
        with patch.object(io.subprocess, 'run') as gws, self.assertRaisesRegex(io.Refused, 'OUTSIDE_WORK'):
            io.write_document('synkbrief', TARGET, outside, 'r1')
        gws.assert_not_called()

    def test_creative_role_mismatch_refused_before_network(self):
        value = {'schemaVersion': 1, 'provider': 'gemini-spark', 'entries': [],
                 'reportId': 'synk-creative-meta-brand-2026-10-18-090000'}
        self.path.write_text(json.dumps(value) + '\n' + io.MARKER, encoding='utf-8', newline='')
        with patch.object(io.subprocess, 'run') as gws, self.assertRaisesRegex(io.Refused, 'REPORT_ID_ROLE'):
            io.write_document('full', TARGET, self.path, 'r1')
        gws.assert_not_called()

    def test_linux_argument_ceiling_refuses_before_write(self):
        self.path.write_text('가' * 42000, encoding='utf-8')
        fake = FakeGws()
        with self.assertRaisesRegex(io.Refused, 'ARGUMENT_LIMIT'):
            self.write(fake)
        self.assertEqual(fake.calls, ['get'])

    def command(self, args, fake):
        output = StringIO()
        with patch.object(io.subprocess, 'run', side_effect=fake), \
                patch.object(io, 'document_id', return_value=TARGET), \
                patch.object(io, 'backup_document', return_value='/private/synthetic-backup'), \
                redirect_stdout(output):
            io.main(['docs-io.py', *args])
        return output.getvalue(), json.loads(output.getvalue())

    def test_snapshot_keeps_large_unicode_body_exact_and_command_compact(self):
        text = ('본문 😀 한글\n' * 5000) + '마지막\n'
        fake = FakeGws(text)
        output, result = self.command(['snapshot', 'synkbrief'], fake)
        saved = self.work / 'synkbrief-prior.txt'
        self.assertEqual(saved.read_bytes(), text.encode('utf-8'))
        self.assertEqual(result, {
            'status': 'snapshot-saved', 'documentId': TARGET, 'title': 'Synthetic',
            'revisionId': 'r1', 'sha256': io.sha(text), 'characters': len(text),
            'contentPath': str(saved.resolve())})
        self.assertLess(len(output.encode('utf-8')), 1024)
        self.assertEqual(fake.calls, ['get'])
        if os.name == 'posix':
            self.assertEqual(stat.S_IMODE(saved.stat().st_mode), 0o600)

    def test_snapshot_replace_and_failure_preserve_complete_previous_file(self):
        saved = self.work / 'synkbrief-prior.txt'
        saved.write_text('previous', encoding='utf-8')
        self.command(['snapshot', 'synkbrief'], FakeGws('first complete\n'))
        self.assertEqual(saved.read_bytes(), b'first complete\n')
        with patch.object(io.os, 'replace', side_effect=OSError('synthetic failure')):
            with self.assertRaises(OSError):
                self.command(['snapshot', 'synkbrief'], FakeGws('must not appear partially'))
        self.assertEqual(saved.read_bytes(), b'first complete\n')
        self.assertEqual(list(self.work.glob('.synkbrief-prior-*.tmp')), [])

    def test_snapshot_hardlink_destination_refused_before_network(self):
        outside = self.root / 'outside.txt'
        outside.write_text('preserve outside', encoding='utf-8')
        os.link(outside, self.work / 'synkbrief-prior.txt')
        fake = FakeGws('replacement')
        with self.assertRaisesRegex(io.Refused, 'SNAPSHOT_DESTINATION_MUST_BE_REGULAR'):
            self.command(['snapshot', 'synkbrief'], fake)
        self.assertEqual(fake.calls, [])
        self.assertEqual(outside.read_text(encoding='utf-8'), 'preserve outside')

    def test_snapshot_oversize_refused_without_overwriting_previous(self):
        saved = self.work / 'synkbrief-prior.txt'
        saved.write_text('preserve previous', encoding='utf-8')
        with self.assertRaisesRegex(io.Refused, 'SNAPSHOT_EXCEEDS'):
            self.command(['snapshot', 'synkbrief'], FakeGws('가' * (io.MAX_CONTENT // 3 + 1)))
        self.assertEqual(saved.read_bytes(), b'preserve previous')

    def test_cli_write_metadata_covers_saved_and_unchanged_without_plaintext(self):
        text = ('한글 😀\n' * 3000)
        self.path.write_text(text, encoding='utf-8', newline='')
        for original, status in [('old', 'saved-and-readback-verified'), (text, 'unchanged')]:
            with self.subTest(status=status):
                output, result = self.command(['write', 'synkbrief', str(self.path), 'r1'],
                                              FakeGws(original))
                self.assertEqual(result['status'], status)
                self.assertEqual(result['sha256'], io.sha(text))
                self.assertEqual(result['characters'], len(text))
                self.assertNotIn('plaintext', result)
                self.assertLess(len(output.encode('utf-8')), 1024)

    def test_cli_read_keeps_internal_full_body_contract(self):
        _, result = self.command(['read', 'synkbrief'], FakeGws('full body\n'))
        self.assertEqual(result['plaintext'], 'full body\n')
        self.assertEqual(result['sha256'], io.sha('full body\n'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
