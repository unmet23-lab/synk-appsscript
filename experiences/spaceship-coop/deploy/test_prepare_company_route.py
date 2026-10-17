import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('route_prepare', HERE / 'prepare-company-route.py')
route = importlib.util.module_from_spec(spec)
spec.loader.exec_module(route)


class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='synk-route-fixture-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve() / 'baseline'
        self.base.mkdir()
        # Exact Caddy bytes in the e696b9efeed7 operating baseline.
        self.old_caddy = b'{\n    email {$SYNK_TLS_EMAIL}\n}\n\n{$SYNK_COMPANY_DOMAIN} {\n    # Preserve the public Host for company origin/session validation.\n    header Strict-Transport-Security "max-age=31536000"\n    reverse_proxy company:4191 {\n        # Caddy is the only public entry; discard client-supplied forwarding.\n        header_up X-Forwarded-For {remote_host}\n    }\n}\n'
        self.assertEqual(route.sha(self.old_caddy), route.CADDY_SHA)
        contents = {route.CADDY: self.old_caddy, 'runtime.mjs': b'export const preserved = true;\n', 'deploy/systemd.service': b'EnvironmentFile=/etc/synk/company.env\n'}
        rows = []
        for name, data in contents.items():
            out = self.base / name
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            rows.append({'path': name, 'bytes': len(data), 'sha256': route.sha(data), 'role': 'fixture'})
        self.manifest = {'version': 1, 'files': rows}
        self.save_manifest()
        self.fragment = (HERE / 'Caddyfile.route').read_bytes()

    def save_manifest(self):
        raw = route.encoded(self.manifest)
        (self.base / 'release-manifest.json').write_bytes(raw)
        self.sha = route.sha(raw)

    def candidate(self):
        return route.route_candidate(self.base, self.fragment, self.sha, 3, route.sha(self.old_caddy))

    def test_only_caddy_changes_and_original_bytes_are_preserved(self):
        before = {path.relative_to(self.base).as_posix(): path.read_bytes() for path in self.base.rglob('*') if path.is_file()}
        candidate = self.candidate()
        target = self.base.parent / candidate['sha256'][:12]
        route.stage_candidate(self.base, target, candidate)
        after = {path.relative_to(self.base).as_posix(): path.read_bytes() for path in self.base.rglob('*') if path.is_file()}
        self.assertEqual(before, after)
        changed = [name for name, value in before.items() if name != 'release-manifest.json' and (target / name).read_bytes() != value]
        self.assertEqual(changed, [route.CADDY])
        self.assertIn(b'handle @spaceship', (target / route.CADDY).read_bytes())
        self.assertEqual((target / route.CADDY).read_bytes().count(b'reverse_proxy company:4191'), 1)
        self.assertEqual(candidate['manifest']['parentManifestSHA256'], self.sha)
        self.assertFalse(candidate['manifest']['productionDeployment'])
        self.assertFalse(candidate['manifest']['officialReviewCompleted'])
        route.stage_candidate(self.base, target, candidate)  # Exact interrupted-stage recovery.
        (target / 'runtime.mjs').write_text('drift')
        with self.assertRaisesRegex(RuntimeError, 'RELEASE_FILE_DRIFT'):
            route.stage_candidate(self.base, target, candidate)

    def test_manifest_and_file_drift_fail_before_staging(self):
        with self.assertRaisesRegex(RuntimeError, 'MANIFEST_DRIFT'):
            route.route_candidate(self.base, self.fragment, '0' * 64, 3, route.sha(self.old_caddy))
        (self.base / 'runtime.mjs').write_text('different')
        with self.assertRaisesRegex(RuntimeError, 'RELEASE_FILE_DRIFT'):
            self.candidate()
        self.assertEqual([path.name for path in self.base.parent.iterdir()], ['baseline'])

    def test_file_and_directory_permissions_are_preserved(self):
        executable = self.base / 'runtime.mjs'
        executable.chmod(0o750)
        (self.base / 'deploy').chmod(0o750)
        expected_file = stat.S_IMODE(executable.stat().st_mode)
        expected_dir = stat.S_IMODE((self.base / 'deploy').stat().st_mode)
        if os.name == 'posix':
            self.assertEqual(expected_file, 0o750)
        candidate = self.candidate()
        target = self.base.parent / candidate['sha256'][:12]
        route.stage_candidate(self.base, target, candidate)
        self.assertEqual(stat.S_IMODE((target / 'runtime.mjs').stat().st_mode), expected_file)
        self.assertEqual(stat.S_IMODE((target / 'deploy').stat().st_mode), expected_dir)

    def test_unlisted_files_and_traversal_manifest_paths_are_rejected(self):
        (self.base / 'extra.txt').write_text('extra')
        with self.assertRaisesRegex(RuntimeError, 'RELEASE_EXTRA_FILE'):
            self.candidate()
        (self.base / 'extra.txt').unlink()
        self.manifest['files'][1]['path'] = '../escape.mjs'
        self.save_manifest()
        with self.assertRaisesRegex(RuntimeError, 'MANIFEST_PATH'):
            self.candidate()

    def test_duplicate_manifest_paths_and_count_mismatch_are_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'FILE_COUNT'):
            route.verify_release(self.base, self.sha, 4)
        self.manifest['files'][1] = dict(self.manifest['files'][0])
        self.save_manifest()
        with self.assertRaisesRegex(RuntimeError, 'MANIFEST_DUPLICATE'):
            self.candidate()

    def test_symlink_release_entries_are_rejected(self):
        try:
            (self.base / 'linked.mjs').symlink_to(self.base / 'runtime.mjs')
        except OSError as error:
            self.skipTest('Host symlink permission unavailable: ' + str(error.winerror))
        with self.assertRaisesRegex(RuntimeError, 'RELEASE_SYMLINK'):
            self.candidate()

    def test_hardlink_release_entries_are_rejected(self):
        (self.base / 'linked.mjs').hardlink_to(self.base / 'runtime.mjs')
        with self.assertRaisesRegex(RuntimeError, 'RELEASE_HARDLINK'):
            self.candidate()

    def test_invalid_target_and_source_drift_during_staging_are_rejected(self):
        candidate = self.candidate()
        with self.assertRaisesRegex(RuntimeError, 'TARGET_PATH'):
            route.stage_candidate(self.base, self.base.parent / 'other-name', candidate)
        (self.base / 'runtime.mjs').write_text('concurrent edit')
        with self.assertRaisesRegex(RuntimeError, 'SOURCE_DRIFT_WHILE_STAGING'):
            route.stage_candidate(self.base, self.base.parent / candidate['sha256'][:12], candidate)
        self.assertEqual((self.base / route.CADDY).read_bytes(), self.old_caddy)

    def test_runtime_identity_includes_container_id_image_and_start_time(self):
        original = {'id': 'original', 'image': 'sha256:old', 'imageRef': 'old:tag', 'startedAt': '2026-10-09T00:00:00Z', 'mounts': [], 'networkAddress': '172.30.77.2', 'health': 'healthy'}
        for key in ['id', 'image', 'imageRef', 'startedAt', 'mounts', 'networkAddress']:
            changed = {**original, key: 'changed'}
            self.assertNotEqual(route.identity(changed), route.identity(original))
        self.assertEqual(route.identity({**original, 'health': 'starting'}), route.identity(original))

    def test_running_caddy_without_a_docker_health_field_can_be_snapshotted(self):
        caddy = {'id': 'caddy', 'image': 'sha256:caddy', 'imageRef': 'caddy:2-alpine',
                 'startedAt': '2026-10-08T20:42:47.500686734Z', 'status': 'running',
                 'health': None, 'mounts': [], 'networkAddress': '172.30.77.3'}
        with patch.object(route, 'command', return_value=json.dumps(caddy)) as command:
            self.assertEqual(route.snapshot('synk-company-https-1'), caddy)
        template = command.call_args.args[0][-1]
        self.assertNotIn('.State.Health', template)
        self.assertIn('(index .State "Health")', template)
        self.assertEqual(route.identity(caddy)['id'], 'caddy')

    def test_activation_uses_https_only_without_pulling_or_building(self):
        with patch.object(route, 'command', return_value='') as command:
            route.recreate_https(self.base)
        args = command.call_args.args[0]
        self.assertEqual(args[-1], 'https')
        for value in ['--no-deps', '--no-build', '--force-recreate']:
            self.assertIn(value, args)
        self.assertEqual(args[args.index('--pull') + 1], 'never')
        self.assertEqual(args[args.index('--project-name') + 1], 'synk-company')
        self.assertEqual(args[args.index('--file') + 1], str(self.base / route.COMPANY / 'deploy/compose.yaml'))


class TransitionTests(unittest.TestCase):
    def actions(self, fail_up=False, fail_check=False, drift=False, fail_rollback=False):
        state, events = {'current': 'old'}, []
        def switch(expected, target):
            self.assertEqual(state['current'], expected)
            events.append(('switch', expected, target))
            state['current'] = target
        def up(target):
            events.append(('up', target))
            if (target == 'new' and fail_up) or (target == 'old' and fail_rollback):
                raise RuntimeError('fixture recreate failure')
        def check(target, with_game):
            events.append(('check', target, with_game))
            if target == 'new' and (fail_check or drift):
                if drift:
                    state['current'] = 'other-release'
                raise RuntimeError('fixture probe failure')
        return state, events, switch, up, check

    def test_success_promotes_and_verifies_without_touching_old_release(self):
        state, events, switch, up, check = self.actions()
        route.transition('old', 'new', switch, up, check, lambda: state['current'])
        self.assertEqual(state['current'], 'new')
        self.assertEqual(events, [('switch', 'old', 'new'), ('up', 'new'), ('check', 'new', True)])

    def test_https_recreate_failure_restores_current_and_old_https(self):
        state, events, switch, up, check = self.actions(fail_up=True)
        with self.assertRaisesRegex(RuntimeError, '^ROLLED_BACK$'):
            route.transition('old', 'new', switch, up, check, lambda: state['current'])
        self.assertEqual(state['current'], 'old')
        self.assertEqual(events[-3:], [('switch', 'new', 'old'), ('up', 'old'), ('check', 'old', False)])

    def test_post_cutover_probe_failure_also_rolls_back(self):
        state, events, switch, up, check = self.actions(fail_check=True)
        with self.assertRaisesRegex(RuntimeError, '^ROLLED_BACK$'):
            route.transition('old', 'new', switch, up, check, lambda: state['current'])
        self.assertEqual(state['current'], 'old')

    def test_concurrent_current_change_is_not_overwritten_by_rollback(self):
        state, events, switch, up, check = self.actions(drift=True)
        with self.assertRaisesRegex(RuntimeError, 'ROLLBACK_CURRENT_DRIFT'):
            route.transition('old', 'new', switch, up, check, lambda: state['current'])
        self.assertEqual(state['current'], 'other-release')
        self.assertNotIn(('up', 'old'), events)

    def test_rollback_failure_is_distinguished_from_safe_rollback(self):
        state, events, switch, up, check = self.actions(fail_check=True, fail_rollback=True)
        with self.assertRaisesRegex(RuntimeError, 'ROLLBACK_INCOMPLETE'):
            route.transition('old', 'new', switch, up, check, lambda: state['current'])

    def test_cutover_drift_fails_before_any_recreate(self):
        with patch.object(route, 'CURRENT', Path('/unavailable-fixture-link')):
            with self.assertRaisesRegex(RuntimeError, 'CURRENT_DRIFT'):
                route.swap_current(Path('/old'), Path('/new'))

    def test_non_linux_main_does_not_run_a_command_or_modify_files(self):
        with patch.object(route.sys, 'platform', 'win32'), patch.object(route.sys, 'argv', ['prepare-company-route.py']), patch.object(route, 'command') as command:
            with self.assertRaisesRegex(RuntimeError, 'LINUX_REQUIRED'):
                route.main()
            command.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
