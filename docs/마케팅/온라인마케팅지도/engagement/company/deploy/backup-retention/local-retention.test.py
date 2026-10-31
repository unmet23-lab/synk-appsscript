import base64, hashlib, importlib.util, io, json, os, pathlib, shutil, tempfile, unittest
from contextlib import redirect_stdout

spec = importlib.util.spec_from_file_location('local_retention', pathlib.Path(__file__).with_name('local-retention.py'))
lr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lr)
DEST = 'gs://synk-company-backups-test/company/production'


def stamp(day, hour):
    return 'synk-workspace-2026-10-%02dT%02d-30-00-000Z' % (day, hour)


class LocalRetention(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = os.path.realpath(self.temp.name)
        self.archives = os.path.join(self.root, 'backup-archives')
        self.backups = os.path.join(self.root, 'backups')
        os.mkdir(self.archives, 0o700)
        os.mkdir(self.backups, 0o700)
        if os.name == 'posix':
            os.chmod(self.archives, 0o700)
            lr.OWNER_UID = os.getuid()
        self.env = {'SYNK_PERSISTENT_ROOT': self.root, 'COMPANY_ARCHIVE_DIR': self.archives,
                    'COMPANY_BACKUP_DIR': self.backups, 'SYNK_BACKUP_GCS_DESTINATION': DEST}
        self.names = [stamp(20 + i // 2, 3 + 12 * (i % 2)) for i in range(8)]  # oldest first
        self.md5 = {}
        for index, name in enumerate(self.names):
            self.backup(name, index)
        lr.take_operations_lock = lambda: os.open(os.path.join(self.root, 'lock'), os.O_RDWR | os.O_CREAT)
        self.idle = []
        lr.manual_idle = lambda: self.idle.append(1)
        lr.capture_estimate = lambda cfg, kept: 10 ** 6

    def tearDown(self):
        self.temp.cleanup()

    def backup(self, name, index, uploaded=True, complete=True):
        snapshot = os.path.join(self.backups, name)
        os.makedirs(os.path.join(snapshot, 'company', 'studio-media'))
        pathlib.Path(snapshot, 'company', 'studio-media', 'a.mp4').write_bytes(b'v' * (100 + index))
        if complete:
            pathlib.Path(snapshot, 'COMPLETE').write_bytes(b'ok\n')
        archive = os.path.join(self.archives, name + '.tar.gz')
        body = ('archive %d' % index).encode()
        pathlib.Path(archive).write_bytes(body)
        # sha256sum -- "$archive" as company-backup.sh writes it on the node
        pathlib.Path(archive + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '  /srv/synk/backup-archives/' + name + '.tar.gz\n', newline='\n')
        self.md5[name + '.tar.gz'] = base64.b64encode(hashlib.md5(body).digest()).decode()
        t = 1792560000 + index * 3600
        os.utime(archive, (t, t))
        if uploaded:
            pathlib.Path(archive + '.uploaded').write_text(DEST + '/' + name + '.tar.gz\n', newline='\n')
            os.utime(archive + '.uploaded', (t + 60, t + 60))

    def plan(self):
        return lr.run({'op': 'plan'}, self.env)

    def present(self):
        return sorted(os.listdir(self.archives)), sorted(os.listdir(self.backups))

    def test_plan_keeps_newest_three_archives_and_one_snapshot(self):
        p = self.plan()
        self.assertEqual(p['kept']['archives'], list(reversed(self.names))[:3])
        self.assertEqual(p['kept']['snapshots'], [self.names[-1]])
        self.assertEqual(p['summary']['archive']['count'], 5)
        self.assertEqual(p['summary']['snapshot']['count'], 7)
        self.assertEqual(self.present()[0].__len__(), 24, 'plan writes nothing')

    def test_manual_apply_needs_the_exact_plan(self):
        p = self.plan()
        held = lr.run({'op': 'apply', 'manual': True, 'planSha256': '0' * 64, 'remoteMd5': self.md5}, self.env)
        self.assertEqual(held, {'status': 'held', 'code': 'PLAN_CHANGED', 'removed': 0, 'removedBytes': 0})
        self.assertEqual(lr.run({'op': 'apply', 'manual': True}, self.env)['code'], 'PLAN_SHA256_REQUIRED')
        # GPT GA1: a removal by hand needs the remote match in the same run, not an earlier dry run
        self.assertEqual(lr.run({'op': 'apply', 'manual': True, 'planSha256': p['planSha256']}, self.env)['code'], 'REMOTE_CHECK_REQUIRED')
        self.assertEqual(len(self.present()[0]), 24)
        out = lr.run({'op': 'apply', 'manual': True, 'planSha256': p['planSha256'], 'remoteMd5': self.md5}, self.env)
        self.assertEqual(out['status'], 'applied')
        archives, backups = self.present()
        self.assertEqual(archives, sorted(n + s for n in self.names[-3:] for s in ('.tar.gz', '.tar.gz.sha256', '.tar.gz.uploaded')))
        self.assertEqual(backups, [self.names[-1]])
        self.assertTrue(self.idle, 'manual runs check that no backup or release runs')

    def test_dry_run_and_remote_check_remove_nothing(self):
        p = self.plan()
        out = lr.run({'op': 'apply', 'manual': True, 'planSha256': p['planSha256'], 'dry': True, 'remoteMd5': self.md5}, self.env)
        self.assertEqual((out['status'], out['removed'], out['remoteChecked']), ('dry-run-ok', 0, 5))
        self.assertEqual(len(self.present()[0]), 24)
        self.assertEqual(len(self.present()[1]), 8)

    def test_remote_mismatch_stops_before_removing(self):
        p = self.plan()
        bad = dict(self.md5, **{self.names[0] + '.tar.gz': 'AAAAAAAAAAAAAAAAAAAAAA=='})
        out = lr.run({'op': 'apply', 'manual': True, 'planSha256': p['planSha256'], 'remoteMd5': bad}, self.env)
        self.assertEqual(out['code'], 'REMOTE_COPY_MISMATCH')
        out = lr.run({'op': 'apply', 'manual': True, 'planSha256': p['planSha256'], 'remoteMd5': bad, 'dry': False}, self.env)
        self.assertEqual(out['code'], 'REMOTE_COPY_MISMATCH', 'a real run after a failed dry run still stops')
        self.assertEqual(len(self.present()[0]), 24)
        missing = dict(self.md5)
        del missing[self.names[1] + '.tar.gz']
        self.assertEqual(lr.run({'op': 'apply', 'manual': True, 'planSha256': p['planSha256'], 'remoteMd5': missing}, self.env)['code'], 'REMOTE_COPY_MISMATCH')
        self.assertEqual(lr.run({'op': 'apply', 'remoteMd5': self.md5}, self.env)['code'], 'REMOTE_CHECK_IS_MANUAL')

    def test_archive_without_valid_upload_is_never_removed_or_counted(self):
        os.unlink(os.path.join(self.archives, self.names[0] + '.tar.gz.uploaded'))
        wrong = os.path.join(self.archives, self.names[1] + '.tar.gz.uploaded')
        pathlib.Path(wrong).write_text('gs://other-bucket/x/' + self.names[1] + '.tar.gz\n', newline='\n')
        changed = os.path.join(self.archives, self.names[2] + '.tar.gz')
        os.utime(changed, (1792660000, 1792660000))  # modified after its upload marker
        newest = stamp(28, 3)
        self.backup(newest, 20, uploaded=False)
        p = self.plan()
        problems = {r['name']: r['problem'] for r in p['kept']['archivesNotUploaded']}
        self.assertEqual(problems, {self.names[0]: 'SET_INCOMPLETE', self.names[1]: 'MARKER_NOT_THIS_DESTINATION',
                                    self.names[2]: 'ARCHIVE_CHANGED_AFTER_UPLOAD', newest: 'SET_INCOMPLETE'})
        self.assertEqual(p['kept']['archives'], list(reversed(self.names))[:3])
        targets = {t['name'] for t in p['targets']}
        self.assertFalse(targets & set(problems))
        # their snapshots stay too: the archive set is not verified off-site
        lr.run({'op': 'apply'}, self.env)
        self.assertTrue(all(os.path.isdir(os.path.join(self.backups, n)) for n in list(problems)))
        self.assertTrue(os.path.exists(os.path.join(self.archives, newest + '.tar.gz')))

    def test_incomplete_snapshot_and_other_names_are_left(self):
        incomplete = stamp(29, 3)
        self.backup(incomplete, 30, complete=False)
        for name in ('social-tracking-initial-1791915051016', 'synk-workspace-2026-10-20T03-30-00Z'):
            os.mkdir(os.path.join(self.backups, name))
        for name in ('synk-server-recovery-2026-10-11T13-10-26Z-907707.tar.gz', self.names[0] + '.tar.gz.partial', 'notes.txt'):
            pathlib.Path(self.archives, name).write_bytes(b'x')
        lr.run({'op': 'apply'}, self.env)
        archives, backups = self.present()
        self.assertIn(incomplete, backups)
        self.assertIn(self.names[-1], backups, 'newest complete snapshot stays even with a newer incomplete one')
        self.assertIn('social-tracking-initial-1791915051016', backups)
        self.assertIn('synk-workspace-2026-10-20T03-30-00Z', backups)
        for name in ('synk-server-recovery-2026-10-11T13-10-26Z-907707.tar.gz', self.names[0] + '.tar.gz.partial', 'notes.txt'):
            self.assertIn(name, archives)

    def test_changed_target_stops_the_manual_run(self):
        p = self.plan()
        target = os.path.join(self.archives, self.names[0] + '.tar.gz.sha256')
        os.utime(target, (1700000000, 1700000000))
        self.assertEqual(lr.run({'op': 'apply', 'manual': True, 'planSha256': p['planSha256'], 'remoteMd5': self.md5}, self.env)['code'], 'PLAN_CHANGED')
        self.assertEqual(len(self.present()[0]), 24)

    def test_recheck_refuses_a_swapped_file(self):
        p = lr.plan(lr.settings(self.env))
        t = next(x for x in p['targets'] if x['kind'] == 'archive.tar.gz')
        os.unlink(t['path'])
        pathlib.Path(t['path']).write_bytes(b'archive 0')
        with self.assertRaises(lr.Hold) as caught:
            lr.recheck(lr.settings(self.env), t)
        self.assertIn(str(caught.exception), ('TARGET_CHANGED', 'TARGET_TYPE'))

    def test_hard_linked_archive_is_not_a_target(self):
        try:
            os.link(os.path.join(self.archives, self.names[0] + '.tar.gz'), os.path.join(self.root, 'elsewhere'))
        except OSError:
            self.skipTest('no hard links here')
        p = self.plan()
        self.assertIn({'name': self.names[0], 'problem': 'NOT_PRIVATE_REGULAR_FILES'}, p['kept']['archivesNotUploaded'])

    @unittest.skipIf(os.name != 'posix', 'symlinks need privileges on Windows')
    def test_symlinks_are_not_followed(self):
        outside = os.path.join(self.root, 'outside')
        os.mkdir(outside)
        pathlib.Path(outside, 'keep.txt').write_text('keep')
        os.symlink(outside, os.path.join(self.backups, self.names[0], 'company', 'link'))
        os.symlink(outside, os.path.join(self.backups, stamp(19, 3)))
        lr.run({'op': 'apply'}, self.env)
        self.assertTrue(os.path.exists(os.path.join(outside, 'keep.txt')))
        self.assertTrue(os.path.islink(os.path.join(self.backups, stamp(19, 3))))

    def test_settings_refuse_bad_destination_and_directories(self):
        for bad in ('', 'https://x/y', 'gs://Bad_Bucket/x', 'gs://ok-bucket/../x'):
            with self.assertRaises(lr.Hold):
                lr.settings(dict(self.env, SYNK_BACKUP_GCS_DESTINATION=bad))
        with self.assertRaises(lr.Hold):
            lr.settings(dict(self.env, COMPANY_BACKUP_DIR=self.archives))
        with self.assertRaises(lr.Hold):
            lr.settings(dict(self.env, COMPANY_ARCHIVE_DIR=os.path.join(self.root, 'missing')))
        if os.name == 'posix':
            os.chmod(self.archives, 0o755)
            with self.assertRaises(lr.Hold) as caught:
                lr.settings(self.env)
            self.assertEqual(str(caught.exception), 'ARCHIVE_DIRECTORY_NOT_PRIVATE')

    def test_systemd_mode_prints_one_event_and_never_raises(self):
        lr.os.environ.update(self.env)
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                saved = lr.sys.argv
                lr.sys.argv = ['local-retention.py', '--apply']
                try:
                    code = lr.main()
                finally:
                    lr.sys.argv = saved
            line = buf.getvalue().strip()
            self.assertEqual(code, 0)
            self.assertTrue(line.startswith('SYNK_LOCAL_RETENTION LOCAL_RETENTION_COMPLETE {'), line)
            self.assertEqual(json.loads(line.split(' ', 2)[2])['removed'], 5 * 3 + 7)
            buf = io.StringIO()
            with redirect_stdout(buf):
                lr.sys.argv = ['local-retention.py']
                try:
                    code = lr.main()
                finally:
                    lr.sys.argv = saved
            self.assertEqual(code, 1)
            self.assertIn('LOCAL_RETENTION_HELD', buf.getvalue())
        finally:
            for key in self.env:
                lr.os.environ.pop(key, None)

    def test_by_hand_request_names_only_known_settings(self):
        for key in self.env:
            lr.os.environ.pop(key, None)
        try:
            lr.REQUEST = {'op': 'plan', 'environ': self.env}
            buf = io.StringIO()
            with redirect_stdout(buf):
                self.assertEqual(lr.main(), 0)
            self.assertEqual(json.loads(buf.getvalue())['status'], 'planned')
            lr.REQUEST = {'op': 'plan', 'environ': dict(self.env, PATH='/tmp')}
            buf = io.StringIO()
            with redirect_stdout(buf):
                lr.main()
            self.assertEqual(json.loads(buf.getvalue()), {'status': 'held', 'code': 'ENVIRON_KEYS'})
        finally:
            del lr.REQUEST

    def test_second_run_is_idempotent(self):
        lr.run({'op': 'apply'}, self.env)
        before = self.present()
        out = lr.run({'op': 'apply'}, self.env)
        self.assertEqual((out['status'], out['removed']), ('applied', 0))
        self.assertEqual(self.present(), before)

    def test_headroom_flag(self):
        lr.capture_estimate = lambda cfg, kept: 10 ** 18
        self.assertTrue(lr.run({'op': 'apply'}, self.env)['headroomLow'])


if __name__ == '__main__':
    unittest.main()
