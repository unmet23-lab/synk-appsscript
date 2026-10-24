from pathlib import Path
import io
import json
import runpy
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

# Run with --source <space guard .py>; tests mock every cleanup command.
import argparse
import importlib.util
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path.home() / 'Documents' / 'SYNK_원본창고' / '공간지킴이.py')
args, remaining = parser.parse_known_args()
source = args.source.resolve()
sys.path.insert(0, str(Path.home() / 'Documents' / 'SYNK_원본창고'))
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location('space_guard_under_test', source)
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)


class CacheGuardTests(unittest.TestCase):
    def test_query_does_not_search_its_own_command_line(self):
        with patch.object(g.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0, stdout=b'[]')) as run:
            self.assertFalse(g.installers_running())
        query = run.call_args.args[0][-1]
        self.assertNotIn('CommandLine -match', query)
        self.assertIn("$ErrorActionPreference='Stop'", query)

    def test_query_shell_and_npm_dev_server_do_not_block(self):
        for name, command in [
            ('powershell.exe', "-Command $_.CommandLine -match ' -m pip |npm-cli\\.js'"),
            ('pwsh.exe', "-Command npm-cli.js ci"),
            ('node.exe', '"C:\\Program Files\\nodejs\\node.exe" "C:\\Program Files\\nodejs\\npm-cli.js" run start'),
            ('node.exe', 'node C:\\node\\npm-cli.js start'),
            ('node.exe', 'node C:\\node\\npm-cli.js run-script dev'),
            ('node.exe', 'node C:\\app\\vite.js'),
            ('python.exe', 'python -B script.py'),
        ]:
            with self.subTest(name=name, command=command):
                self.assertFalse(g.installer_process({'Name': name, 'CommandLine': command}))

    def test_real_installs_npx_uv_pip_and_ambiguous_npm_block(self):
        for name, command in [
            ('node.exe', 'node "C:\\node\\npm-cli.js" ci'),
            ('node.exe', 'node C:\\node\\npm-cli.js install'),
            ('node.exe', 'node C:\\node\\npm-cli.js i'),
            ('node.exe', 'node C:\\node\\npm-cli.js --prefix C:\\app ci'),
            ('node.exe', 'node C:\\node\\npm-cli.js'),
            ('node.exe', 'node C:\\node\\npx-cli.js vite'),
            ('python.exe', '"C:\\Python\\python.exe" -m pip install abc'),
            ('python3.14.exe', 'python3.14 -m pip install abc'),
            ('pythonw.exe', 'pythonw -m pip install abc'),
            ('uv.exe', 'uv pip install abc'), ('uvx.exe', 'uvx ruff'),
            ('pip.exe', 'pip install abc'), ('pip3.exe', 'pip3 install abc'),
        ]:
            with self.subTest(name=name, command=command):
                self.assertTrue(g.installer_process({'Name': name, 'CommandLine': command}))

    def test_unknown_relevant_command_is_preserved(self):
        for name in ('node.exe', 'python.exe'):
            for command in (None, '', '   '):
                self.assertTrue(g.installer_process({'Name': name, 'CommandLine': command}))

    def test_query_failure_and_invalid_result_preserve_caches(self):
        for code, data in [(1, b'[]'), (0, b''), (0, b'null'), (0, b'{}'), (0, b'invalid'), (0, b'[null]'), (0, b'[{}]')]:
            with self.subTest(code=code, data=data), patch.object(g.subprocess, 'run', return_value=types.SimpleNamespace(returncode=code, stdout=data)):
                self.assertTrue(g.installers_running())
        for exc in (OSError(), subprocess.TimeoutExpired('powershell', 90)):
            with patch.object(g.subprocess, 'run', side_effect=exc):
                self.assertTrue(g.installers_running())

    def test_empty_and_noninstaller_json_allow_and_installer_blocks(self):
        for rows, expected in [([], False), ([{'Name': 'node.exe', 'CommandLine': 'node npm-cli.js run dev'}], False),
                               ([{'Name': 'node.exe', 'CommandLine': 'node npm-cli.js ci'}], True)]:
            with patch.object(g.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0, stdout=json.dumps(rows).encode())):
                self.assertEqual(g.installers_running(), expected)

    def cache_case(self, result=None, error=None, installing=False):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(g, 'CACHES', (('npm', Path(temp)),)), patch.object(g, 'dir_bytes', return_value=2 * g.GB), \
                    patch.object(g, 'installers_running', return_value=installing), patch.object(g, 'free_bytes', side_effect=[10, 12]), \
                    patch.object(g, 'log') as log, patch.object(g.subprocess, 'run', return_value=result, side_effect=error) as run:
                answer = g.clear_caches(go=True)
                return answer, log.call_args_list, run.call_count

    def test_real_installer_prevents_every_cleanup_command(self):
        answer, logs, count = self.cache_case(installing=True)
        self.assertEqual(answer, (0, []))
        self.assertEqual(count, 0)

    def test_failed_cache_command_is_not_reported_as_cleared(self):
        answer, logs, count = self.cache_case(result=types.SimpleNamespace(returncode=17))
        self.assertEqual(answer, (0, []))
        self.assertEqual(logs[0].kwargs, {'cache': 'npm', 'result': 'failed', 'returncode': 17})

    def test_cache_exception_is_not_reported_as_cleared(self):
        for error in (OSError(), subprocess.TimeoutExpired('npm', 900)):
            answer, logs, count = self.cache_case(error=error)
            self.assertEqual(answer, (0, []))
            self.assertEqual(logs[0].kwargs, {'cache': 'npm', 'result': 'failed'})

    def test_successful_cache_command_is_reported(self):
        answer, logs, count = self.cache_case(result=types.SimpleNamespace(returncode=0))
        self.assertEqual(answer, (2, ['npm']))
        self.assertEqual(logs, [])


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0], *remaining], verbosity=2)
