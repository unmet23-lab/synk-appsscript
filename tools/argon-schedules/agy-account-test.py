#!/usr/bin/env python3
"""Offline agy-account tests: temp HOMEs and a mocked `agy -p /usage`; no network, no real login."""
import contextlib
import datetime
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('agy_account', Path(__file__).with_name('agy-account.py'))
agy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(agy)

PERMISSIONS = {'allow': ['command(/usr/bin/date -u +%Y-%m-%dT%H:%M:%SZ)'],
               'deny': ['read_file(/var/lib/synk-argon-unmet25/.gemini/antigravity-cli/antigravity-oauth-token)']}
INVOCATION = '0123456789abcdef' * 2


def usage(weekly, five_hour, status='SUCCESS'):
    return json.dumps({'conversation_id': '', 'status': status, 'usage': {'total_tokens': 0},
                       'command': {'name': 'usage', 'data': {'groups': [
                           {'name': 'Gemini Models', 'buckets': [
                               {'id': 'gemini-weekly', 'remaining_fraction': weekly},
                               {'id': 'gemini-5h', 'remaining_fraction': five_hour}]},
                           {'name': 'Claude and GPT models', 'buckets': [
                               {'id': '3p-weekly', 'remaining_fraction': 1}, {'id': '3p-5h', 'remaining_fraction': 1}]}]}}})


class AgyAccountTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.homes = {'77yuhbs': root / 'home77', 'unmet25': root / 'home25'}
        for home in self.homes.values():
            (home / '.gemini' / 'antigravity-cli').mkdir(parents=True)
            (home / '.gemini' / 'config').mkdir()
        self.status_dir = root / 'run-status'
        self.status_dir.mkdir()
        self.mode_file = root / 'agy-account.json'
        self.write_settings('77yuhbs', {'permissions': PERMISSIONS, 'useG1Credits': False})
        self.write_settings('unmet25', {'permissions': PERMISSIONS, 'useG1Credits': False})
        # account -> (stdout, signed-in email or None, exit code); exceptions are raised as-is
        self.answers = {'77yuhbs': (usage(0.5, 0.9), '77yuhbs@gmail.com', 0),
                        'unmet25': (usage(0.8, 0.95), 'unmet25@gmail.com', 0)}
        self.calls = []
        accounts = {name: {'home': home, 'email': name + '@gmail.com'} for name, home in self.homes.items()}
        # The real mode file is root-owned; a test run owns its temp copy, whatever user runs it.
        owner = os.getuid() if os.name == 'posix' else 0
        self.patches = [patch.object(agy, 'ACCOUNTS', accounts), patch.object(agy, 'RUN_STATUS', self.status_dir),
                        patch.object(agy, 'MODE_FILE', self.mode_file), patch.object(agy, 'MODE_OWNER_UID', owner),
                        patch.object(subprocess, 'run', side_effect=self.fake_run)]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in self.patches:
            item.stop()
        self.tmp.cleanup()

    def write_settings(self, account, value):
        (self.homes[account] / '.gemini' / 'antigravity-cli' / 'settings.json').write_text(json.dumps(value))

    def fake_run(self, args, **kwargs):
        account = next(name for name, home in self.homes.items() if kwargs['env']['HOME'] == str(home))
        self.calls.append((account, args, kwargs))
        answer = self.answers[account]
        if isinstance(answer, Exception):
            raise answer
        stdout, email, code = answer
        log = args[args.index('--log-file') + 1]
        Path(log).write_text('I1022 startup\n' + ('I1022 authenticated successfully as %s\n' % email if email else ''))
        return subprocess.CompletedProcess(args, code, stdout, '')

    def set_mode(self, text):
        self.mode_file.write_text(text)
        os.chmod(self.mode_file, 0o644)

    def probed(self):
        return [account for account, _, _ in self.calls]

    def test_auto_keeps_77yuhbs_while_its_quota_is_fine(self):
        self.assertEqual(agy.choose('auto')[:2], ('77yuhbs', 'AUTO_77YUHBS_OK'))
        self.assertEqual(self.probed(), ['77yuhbs'])

    def test_auto_switches_when_weekly_or_five_hour_drops_below_ten_percent(self):
        for weekly, five_hour in ((0.09, 0.9), (0.5, 0.05), (0.0, 0.0)):
            with self.subTest(weekly=weekly, five_hour=five_hour):
                self.calls.clear()
                self.answers['77yuhbs'] = (usage(weekly, five_hour), '77yuhbs@gmail.com', 0)
                self.assertEqual(agy.choose('auto')[:2], ('unmet25', 'AUTO_SWITCH_UNMET25'))
                self.assertEqual(self.probed(), ['77yuhbs', 'unmet25'])

    def test_exactly_ten_percent_is_still_fine(self):
        self.answers['77yuhbs'] = (usage(0.1, 0.1), '77yuhbs@gmail.com', 0)
        self.assertEqual(agy.choose('auto')[0], '77yuhbs')

    def test_failed_77yuhbs_check_counts_as_blocked(self):
        for answer in [('not json', '77yuhbs@gmail.com', 1), (usage(1, 1, status='ERROR'), None, 1),
                       subprocess.TimeoutExpired(['agy'], 60), OSError('exec failed')]:
            with self.subTest(answer=str(answer)[:20]):
                self.answers['77yuhbs'] = answer
                self.assertEqual(agy.choose('auto')[:2], ('unmet25', 'AUTO_SWITCH_UNMET25'))

    def test_nonzero_exit_is_a_failed_check_even_with_usage_json(self):
        # GPT GA2: agy exiting non-zero must not count as a good check, whatever it printed.
        self.answers['77yuhbs'] = (usage(0.9, 0.9), '77yuhbs@gmail.com', 1)
        self.assertEqual(agy.probe('77yuhbs')['error'], 'PROBE_EXIT_1')
        self.assertEqual(agy.choose('auto')[:2], ('unmet25', 'AUTO_SWITCH_UNMET25'))
        self.answers['77yuhbs'] = (usage(0.05, 0.9), '77yuhbs@gmail.com', 0)
        self.answers['unmet25'] = (usage(0.9, 0.9), 'unmet25@gmail.com', 3)
        self.assertEqual(agy.choose('auto')[:2], ('77yuhbs', 'AUTO_UNMET25_NOT_READY'))

    def test_both_low_or_spare_not_ready_keeps_default(self):
        self.answers['77yuhbs'] = (usage(0.05, 0.9), '77yuhbs@gmail.com', 0)
        cases = [((usage(0.05, 0.9), 'unmet25@gmail.com', 0), 'AUTO_UNMET25_ALSO_LOW'),
                 ((usage(0.9, 0.9), '77yuhbs@gmail.com', 0), 'AUTO_UNMET25_NOT_READY'),
                 ((usage(0.9, 0.9), None, 0), 'AUTO_UNMET25_NOT_READY'),
                 (('', None, 1), 'AUTO_UNMET25_NOT_READY')]
        for answer, reason in cases:
            with self.subTest(reason=reason, email=answer[1]):
                self.answers['unmet25'] = answer
                self.assertEqual(agy.choose('auto')[:2], ('77yuhbs', reason))

    def test_spare_needs_identical_permissions_and_no_paid_fallback(self):
        self.answers['77yuhbs'] = (usage(0.05, 0.9), '77yuhbs@gmail.com', 0)
        changed = {'allow': PERMISSIONS['allow'] + ['command(*)'], 'deny': PERMISSIONS['deny']}
        cases = [{'permissions': changed, 'useG1Credits': False},
                 {'permissions': PERMISSIONS, 'useG1Credits': True},
                 {'permissions': PERMISSIONS, 'useG1Credits': 'false'},
                 {'permissions': PERMISSIONS, 'useG1Credits': False, 'modelProvider': 'gemini'}]
        for value in cases:
            with self.subTest(value=sorted(value)):
                self.calls.clear()
                self.write_settings('unmet25', value)
                self.assertEqual(agy.choose('auto')[:2], ('77yuhbs', 'AUTO_UNMET25_SETTINGS_MISMATCH'))
                self.assertEqual(self.probed(), ['77yuhbs'])
        # agy drops useG1Credits while it is the default false (10-22); a missing key is still off.
        self.write_settings('unmet25', {'permissions': PERMISSIONS})
        self.assertEqual(agy.choose('auto')[:2], ('unmet25', 'AUTO_SWITCH_UNMET25'))
        (self.homes['unmet25'] / '.gemini' / 'config' / 'user_config.json').write_text('{"use_ai_credits": true}')
        self.assertEqual(agy.choose('auto')[1], 'AUTO_UNMET25_SETTINGS_MISMATCH')

    def test_mode_file(self):
        self.assertEqual(agy.read_mode(), ('auto', None))
        self.set_mode('{"mode": "77yuhbs"}')
        self.assertEqual(agy.choose(agy.read_mode()[0])[:2], ('77yuhbs', 'MODE_77YUHBS'))
        self.assertEqual(self.calls, [])
        self.set_mode('{"mode": "unmet25"}')
        self.answers['unmet25'] = (usage(0.01, 0.01), 'unmet25@gmail.com', 0)
        self.assertEqual(agy.choose(agy.read_mode()[0])[:2], ('unmet25', 'MODE_UNMET25'))
        self.assertEqual(self.probed(), ['unmet25'])
        for text in ('{"mode": "unmet23"}', 'not json', '["auto"]'):
            with self.subTest(text=text):
                self.set_mode(text)
                self.assertEqual(agy.read_mode(), ('77yuhbs', 'MODE_FILE_INVALID'))
        if os.name == 'posix':
            self.set_mode('{"mode": "auto"}')
            os.chmod(self.mode_file, 0o666)
            self.assertEqual(agy.read_mode(), ('77yuhbs', 'MODE_FILE_UNSAFE'))

    def test_usage_parser_is_strict(self):
        for stdout in (usage(True, 0.5), usage(1.5, 0.5), usage(-0.1, 0.5), usage('0.5', 0.5),
                       json.dumps({'status': 'SUCCESS', 'command': {'name': 'quota'}}), '[]'):
            with self.subTest(stdout=stdout[:40]):
                with self.assertRaises((ValueError, TypeError, AttributeError)):
                    agy.remaining(stdout)

    def test_probe_isolates_stdin_environment_and_log(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'SECRET_KEY', 'INVOCATION_ID': INVOCATION}):
            result = agy.probe('unmet25')
        account, args, kwargs = self.calls[0]
        self.assertEqual((account, result['email'], result['healthy']), ('unmet25', 'unmet25@gmail.com', True))
        self.assertEqual(args[:6], [agy.AGY, '-p', '/usage', '--output-format', 'json', '--print-timeout'])
        self.assertIs(kwargs['stdin'], subprocess.DEVNULL)
        self.assertEqual(kwargs['env']['HOME'], str(self.homes['unmet25']))
        self.assertEqual(kwargs['env']['AGY_CLI_DISABLE_AUTO_UPDATE'], 'true')
        self.assertNotIn('GEMINI_API_KEY', kwargs['env'])
        self.assertNotIn('INVOCATION_ID', kwargs['env'])
        self.assertFalse(Path(args[args.index('--log-file') + 1]).exists())

    def launch(self, argv, environ=None):
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch.object(os, 'execve') as execve, patch.dict(os.environ, environ or {'INVOCATION_ID': INVOCATION}), \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = agy.launch(argv)
        return code, execve, stdout.getvalue(), stderr.getvalue()

    def test_launch_execs_same_command_with_chosen_home_and_records_choice(self):
        command = [agy.AGY, '--input-format', 'stream-json', '--model', 'gemini-4-argon-high']
        self.answers['77yuhbs'] = (usage(0.04, 0.9), '77yuhbs@gmail.com', 0)
        _, execve, stdout, stderr = self.launch(['synk-argon-ultra-full', '--'] + command)
        path, argv, env = execve.call_args[0]
        self.assertEqual((path, argv, env['HOME']), (agy.AGY, command, str(self.homes['unmet25'])))
        self.assertEqual(stdout, '')
        self.assertIn('account=unmet25 reason=AUTO_SWITCH_UNMET25', stderr)
        record = self.status_dir / 'full.agy-account.json'
        decision = json.loads(record.read_text())
        self.assertEqual((decision['role'], decision['account'], decision['invocationId']), ('full', 'unmet25', INVOCATION))
        self.assertEqual(decision['probes']['77yuhbs']['gemini-weekly'], 0.04)
        if os.name == 'posix':
            self.assertEqual(stat.S_IMODE(record.stat().st_mode), 0o600)
        self.assertEqual([p.name for p in self.status_dir.iterdir()], ['full.agy-account.json'])

    def test_launch_falls_back_to_default_when_the_chooser_breaks(self):
        with patch.object(agy, 'choose', side_effect=RuntimeError('boom')):
            _, execve, _, stderr = self.launch(['synk-argon-ultra-yt-tt', '--', agy.AGY, '-x'],
                                               environ={'INVOCATION_ID': '../bad'})
        self.assertEqual(execve.call_args[0][2]['HOME'], str(self.homes['77yuhbs']))
        decision = json.loads((self.status_dir / 'yt-tt.agy-account.json').read_text())
        self.assertEqual((decision['account'], decision['reason'], decision['invocationId']),
                         ('77yuhbs', 'LAUNCHER_ERROR', None))
        self.assertIn('reason=LAUNCHER_ERROR', stderr)

    def test_root_reruns_status_and_sync_as_run_user(self):
        # GPT GA1: as root these would follow paths the run user owns (a settings.json swapped for a link).
        with patch.object(agy, 'runs_as_root', return_value=True), \
                patch.object(subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as run:
            for command in (['status', '--usage'], ['sync-settings']):
                with self.subTest(command=command):
                    run.reset_mock()
                    self.assertEqual(agy.main(['agy-account.py', *command]), 0)
                    args, kwargs = run.call_args
                    self.assertEqual(args[0], [sys.executable, '-I', os.path.abspath(agy.__file__), *command])
                    self.assertEqual((kwargs['user'], kwargs['group'], kwargs['extra_groups'], kwargs['cwd']),
                                     (agy.RUN_USER, agy.RUN_USER, [], '/'))
            run.reset_mock()
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(agy.main(['agy-account.py', 'launch']), 2)
            run.assert_not_called()

    def test_sync_settings_copies_permissions_and_keeps_the_old_file(self):
        old = {'permissions': {'allow': ['command(*)'], 'deny': []}, 'colorScheme': 'dark'}
        self.write_settings('unmet25', old)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(agy.sync_settings([]), 0)
        settings_dir = self.homes['unmet25'] / '.gemini' / 'antigravity-cli'
        now = json.loads((settings_dir / 'settings.json').read_text())
        self.assertEqual(now, {'permissions': PERMISSIONS, 'colorScheme': 'dark', 'useG1Credits': False})
        backup, = settings_dir.glob('settings.json.bak-*')
        self.assertEqual(json.loads(backup.read_text()), old)
        self.assertTrue(agy.spare_settings_ok())
        self.write_settings('77yuhbs', {'permissions': PERMISSIONS, 'modelProvider': 'gemini'})
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(agy.sync_settings([]), 1)
        self.assertEqual(json.loads((settings_dir / 'settings.json').read_text()), now)

    def test_two_syncs_in_one_second_keep_both_old_files(self):
        # GPT 2차 GA1: the second backup must not replace the first one.
        class Fixed(datetime.datetime):
            @classmethod
            def now(cls, tz=None):
                return datetime.datetime(2026, 10, 22, 7, 0, 0, tzinfo=datetime.timezone.utc)
        settings_dir = self.homes['unmet25'] / '.gemini' / 'antigravity-cli'
        first = {'permissions': {'allow': ['command(a)'], 'deny': []}}
        self.write_settings('unmet25', first)
        with patch.object(agy, 'datetime', types.SimpleNamespace(datetime=Fixed, timezone=datetime.timezone)), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(agy.sync_settings([]), 0)
            self.assertEqual(agy.sync_settings([]), 0)
        backups = sorted(settings_dir.glob('settings.json.bak-*'))
        self.assertEqual([p.name for p in backups], ['settings.json.bak-20261022T070000Z', 'settings.json.bak-20261022T070000Z-2'])
        self.assertEqual(json.loads(backups[0].read_text()), first)

    def test_status_survives_settings_that_are_not_objects(self):
        # GPT 2차 GA2: status is how a broken settings file gets noticed, so it must still print.
        for text in ('[]', 'null', '{"permissions": []}'):
            with self.subTest(text=text):
                (self.homes['unmet25'] / '.gemini' / 'antigravity-cli' / 'settings.json').write_text(text)
                out = io.StringIO()
                with contextlib.redirect_stdout(out):
                    self.assertEqual(agy.status([]), 0)
                value = json.loads(out.getvalue())
                self.assertEqual((value['spareSettingsOk'], value['accounts']['unmet25']['permissionsSha256']), (False, None))
                self.assertIsNotNone(value['accounts']['77yuhbs']['permissionsSha256'])

    def test_login_hides_the_other_home_and_keeps_only_safe_values(self):
        with patch.object(agy, 'runs_as_root', return_value=True), patch.object(os, 'execv') as execv, \
                patch.dict(os.environ, {'TERM': 'xterm-256color'}):
            agy.login(['unmet25', '203.0.113.5 50000 10.77.0.3 22'])
            path, argv = execv.call_args[0]
            self.assertEqual((path, argv[0], argv[-1]), ('/usr/bin/systemd-run', '/usr/bin/systemd-run', agy.AGY))
            for item in ('--unit=synk-argon-unmet25-login', '--uid=' + agy.RUN_USER, '--pty',
                         '--property=ReadWritePaths=' + str(self.homes['unmet25']),
                         '--property=InaccessiblePaths=-' + str(self.homes['77yuhbs']),
                         'HOME=' + str(self.homes['unmet25']), 'SSH_CONNECTION=203.0.113.5 50000 10.77.0.3 22',
                         'AGY_CLI_DISABLE_AUTO_UPDATE=true', 'TERM=xterm-256color'):
                self.assertIn(item, argv)
            execv.reset_mock()
            agy.login(['77yuhbs', 'x; rm -rf /'])
            argv = execv.call_args[0][1]
            self.assertIn('--property=InaccessiblePaths=-' + str(self.homes['unmet25']), argv)
            self.assertIn('SSH_CONNECTION=', argv)
            execv.reset_mock()
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(agy.login(['unmet23']), 2)
            execv.assert_not_called()
        with patch.object(agy, 'runs_as_root', return_value=False), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                agy.login(['unmet25'])

    def test_launch_refuses_unknown_unit_or_command_without_exec(self):
        for argv in (['synk-argon-ultra-smoke', '--', agy.AGY], ['synk-argon-ultra-full', agy.AGY],
                     ['synk-argon-ultra-full', '--', '/bin/sh', '-c', 'id'], []):
            with self.subTest(argv=argv):
                code, execve, _, _ = self.launch(argv)
                self.assertEqual(code, 2)
                execve.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
