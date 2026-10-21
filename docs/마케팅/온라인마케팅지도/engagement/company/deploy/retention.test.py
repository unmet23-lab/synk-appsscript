import importlib.util, json, os, pathlib, tempfile, unittest

spec = importlib.util.spec_from_file_location('retention', pathlib.Path(__file__).with_name('retention.py'))
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)
NOW = 1792560000
DAY = 86400


def touch(path, age_days, body=b'x'):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body) if not path.exists() or path.is_file() else None
    stamp = NOW - age_days * DAY
    os.utime(path, (stamp, stamp))


class FakeDocker:
    def __init__(self, images, containers):
        self.images, self.containers, self.removed = images, containers, []

    def __call__(self, *args):
        if args[:2] == ('image', 'ls'):
            return '\n'.join(json.dumps(i) for i in self.images)
        if args[:2] == ('ps', '--all'):
            return '\n'.join(self.containers)
        if args[0] == 'inspect':
            return self.containers[args[-1]] if isinstance(self.containers, dict) else 'sha256:' + 'c' * 64
        if args[:2] == ('image', 'rm'):
            self.removed.append(args[2])
            self.images = [i for i in self.images if args[2] not in (i['ID'], i['Repository'] + ':' + i['Tag'])]
            return ''
        raise AssertionError(args)


class Retention(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        for index in range(8):  # newest first: r0 is current
            release = self.root / 'opt/synk/releases' / ('%012x' % (0xabc000 + index))
            touch(release / 'manifest.json', index)
            os.utime(release, (NOW - index * DAY, NOW - index * DAY))
        for index in range(5):
            snapshot = self.root / 'srv/synk/backups' / ('synk-workspace-2026-10-%02dT03-30-00Z' % (20 - index))
            touch(snapshot / 'COMPLETE', index)
            os.utime(snapshot, (NOW - index * DAY, NOW - index * DAY))
        for index in range(20):
            name = 'synk-workspace-2026-10-%02dT03-30-00Z' % (21 - index)
            for suffix in ('.tar.gz', '.tar.gz.sha256') + (('.tar.gz.uploaded',) if index != 18 else ()):
                touch(self.root / 'srv/synk/backup-archives' / (name + suffix), index)
        for index in range(4):
            touch(self.root / 'srv/synk/stage' / ('bundle-%d' % index) / 'x', index)
            os.utime(self.root / 'srv/synk/stage' / ('bundle-%d' % index), (NOW - index * DAY, NOW - index * DAY))
        for index in range(3):
            restore = self.root / 'opt/synk/ha-qa' / ('infra-dr-%d' % index)
            touch(restore / 'RESULT.json', index)
            os.utime(restore, (NOW - index * DAY, NOW - index * DAY))
        touch(self.root / 'opt/synk/ha-maintenance/jobs/keep/contract.json', 30)
        current = '%012x' % 0xabc000
        self.docker = FakeDocker([
            {'Repository': 'synk-company', 'Tag': current + 'ffff', 'ID': 'sha256:' + 'a' * 64},
            {'Repository': 'synk-company', 'Tag': '%012x' % 0xabc007, 'ID': 'sha256:' + 'b' * 64},
            {'Repository': 'synk-company', 'Tag': '<none>', 'ID': 'sha256:' + 'd' * 64},
            {'Repository': 'synk-company', 'Tag': 'running', 'ID': 'sha256:' + 'c' * 64},
            {'Repository': 'caddy', 'Tag': '2-alpine', 'ID': 'sha256:' + 'e' * 64},
        ], ['container-1'])
        self.inventory = retention.Inventory(root=self.root, docker=self.docker, clock=lambda: NOW, current=current)

    def tearDown(self):
        self.temp.cleanup()

    def test_plan_keeps_the_newest_of_each_kind_and_never_unuploaded_archives(self):
        planned = retention.main({'op': 'plan'}, self.inventory)
        by_kind = {}
        for item in planned['candidates']:
            by_kind.setdefault(item['kind'], []).append(pathlib.Path(item['path']).name if item['kind'] != 'image' else item['path'])
        self.assertEqual(sorted(by_kind['release']), ['%012x' % (0xabc000 + i) for i in (5, 6, 7)])
        self.assertEqual(sorted(by_kind['image']), ['sha256:' + 'd' * 64, 'synk-company:%012x' % 0xabc007])
        self.assertEqual(len(by_kind['snapshot']), 2)
        archives = sorted(by_kind['archive'])
        self.assertNotIn('synk-workspace-2026-10-03T03-30-00Z.tar.gz', archives)  # index 18 was never uploaded
        self.assertIn('synk-workspace-2026-10-02T03-30-00Z.tar.gz.uploaded', archives)
        self.assertEqual(len([a for a in archives if a.endswith('.tar.gz')]), 4)  # ages 15,16,17,19 days
        self.assertEqual(sorted(by_kind['stage']), ['bundle-2', 'bundle-3'])
        self.assertEqual(sorted(by_kind['restore']), ['infra-dr-1', 'infra-dr-2'])
        self.assertFalse(any('ha-maintenance' in c['path'] for c in planned['candidates']))
        self.assertEqual(planned['summary']['release']['count'], 3)
        self.assertEqual(planned['kept']['current'], '%012x' % 0xabc000)

    def test_apply_needs_the_same_plan_and_removes_exactly_it(self):
        planned = retention.main({'op': 'plan'}, self.inventory)
        with self.assertRaises(retention.Refused):
            retention.main({'op': 'apply', 'sha256': '0' * 64}, self.inventory)
        result = retention.main({'op': 'apply', 'sha256': planned['sha256']}, self.inventory)
        self.assertEqual(result['status'], 'applied')
        self.assertEqual(result['removed'], len(planned['candidates']))
        self.assertEqual(sorted(self.docker.removed), sorted(c['path'] for c in planned['candidates'] if c['kind'] == 'image'))
        self.assertFalse((self.root / 'opt/synk/releases' / ('%012x' % 0xabc007)).exists())
        self.assertTrue((self.root / 'opt/synk/releases' / ('%012x' % 0xabc000)).exists())
        self.assertTrue((self.root / 'opt/synk/ha-maintenance/jobs/keep/contract.json').exists())
        again = retention.main({'op': 'plan'}, self.inventory)
        self.assertEqual([c['kind'] for c in again['candidates']], [])


if __name__ == '__main__':
    unittest.main()
