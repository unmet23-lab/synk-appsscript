"""python wb-offsite.test.py — no network, no root (runs on the operator PC and on Linux)."""
import gzip, importlib.util, io, json, os, pathlib, sqlite3, tempfile, time, unittest, urllib.error

spec = importlib.util.spec_from_file_location('wb_offsite', pathlib.Path(__file__).with_name('wb-offsite.py'))
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)

def make_db(path, tables=('customers', 'devices', 'keys')):
    con = sqlite3.connect(path)
    for t in tables: con.execute(f'create table {t}(id text)')
    con.commit(); con.close()

class R(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): return False

class Offsite(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.root = pathlib.Path(self.tmp.name)
        self.backups = self.root / 'backups'; self.backups.mkdir()
        self.state = self.root / 'state'
        M.BACKUPS, M.STATE = self.backups, self.state
        self.env = self.root / 'company.env'; self.env.write_text('A=1\nSYNK_BACKUP_GCS_DESTINATION=gs://private-bucket/company/production\n'); M.ENV_FILE = self.env
        M.API_UID = self.backups.stat().st_uid
        M.private_state = lambda: self.state.mkdir(exist_ok=True)
        if not hasattr(os, 'geteuid'): os.geteuid = lambda: 0
        self.now = time.time() + 3600
        self.sent = []
    def tearDown(self): self.tmp.cleanup()
    def copy(self, day, age=3600, **kw):
        p = self.backups / f'workbackup-{day}.sqlite'; make_db(p, **kw); os.utime(p, (self.now - age, self.now - age)); return p
    def send(self, bucket, name, file, md5b64, size, token):
        self.sent.append((bucket, name, gzip.decompress(file.read_bytes()), size, token)); return 'created'
    def run_main(self, writer=True, send=None):
        run = lambda args, timeout: type('R', (), {'returncode': 0 if writer else 3})()
        M.os.path.ismount = lambda p: True
        return M.main(now=self.now, run=run, get_token=lambda: 't0k', send=send or self.send)

    def test_newest_fresh_copy_is_sent_once(self):
        self.copy('2026-11-21', age=30 * 3600); p = self.copy('2026-11-22')
        word, detail = self.run_main()
        self.assertEqual(word, 'OK'); self.assertEqual(self.sent[0][0], 'private-bucket'); self.assertEqual(self.sent[0][1], 'workbackup-2026-11-22.sqlite.gz')
        self.assertEqual(self.sent[0][2], p.read_bytes()); self.assertFalse((self.state / 'stage').exists())
        self.assertEqual(json.loads((self.state / 'last.json').read_text())['name'], 'workbackup-2026-11-22.sqlite.gz')
        self.assertEqual(self.run_main()[0], 'ALREADY'); self.assertEqual(len(self.sent), 1)
    def test_not_writer_is_quiet(self):
        self.copy('2026-11-22')
        with self.assertRaises(M.Stop): self.run_main(writer=False)
    def test_absent_folder_is_quiet(self):
        self.backups.rmdir()
        with self.assertRaises(M.Stop): self.run_main()
    def test_stale_settling_and_missing_fail(self):
        with self.assertRaisesRegex(M.Failed, 'NO_COPY'): self.run_main()
        self.copy('2026-11-22', age=37 * 3600)
        with self.assertRaisesRegex(M.Failed, 'COPY_STALE'): self.run_main()
        self.copy('2026-11-23', age=60)
        with self.assertRaisesRegex(M.Failed, 'COPY_SETTLING'): self.run_main()
    def test_not_a_workbackup_database_fails(self):
        self.copy('2026-11-22', tables=('other',))
        with self.assertRaisesRegex(M.Failed, 'COPY_NOT_WORKBACKUP'): self.run_main()
    def test_corrupt_copy_fails(self):
        p = self.backups / 'workbackup-2026-11-22.sqlite'; p.write_bytes(b'SQLite format 3\x00' + b'\x00' * 200); os.utime(p, (self.now - 3600, self.now - 3600))
        with self.assertRaisesRegex(M.Failed, 'COPY_CORRUPT'): self.run_main()
    def test_odd_names_are_ignored(self):
        self.copy('2026-11-20'); (self.backups / 'workbackup-2026-11-22.sqlite.tmp').write_text('x'); (self.backups / 'workbackup-2026-13-40.sqlite').write_text('x')
        self.assertEqual(self.run_main()[1]['name'], 'workbackup-2026-11-20.sqlite.gz')
    def test_other_owner_or_hard_link_is_refused(self):
        p = self.copy('2026-11-22')
        M.API_UID = p.stat().st_uid + 1
        with self.assertRaisesRegex(M.Failed, 'COPY_NOT_PLAIN'): self.run_main()
        M.API_UID = p.stat().st_uid
        os.link(p, self.root / 'other-name')
        with self.assertRaisesRegex(M.Failed, 'COPY_NOT_PLAIN'): self.run_main()
    def test_symlink_is_not_followed(self):
        target = self.root / 'company.sqlite'; make_db(target)
        link = self.backups / 'workbackup-2026-11-22.sqlite'
        try: link.symlink_to(target)
        except OSError: self.skipTest('no symlink right here')
        with self.assertRaises(M.Failed): self.run_main()
        self.assertEqual(self.sent, [])
    def test_existing_object_is_a_failure_not_a_success(self):
        self.copy('2026-11-22')
        with self.assertRaisesRegex(M.Failed, 'OBJECT_EXISTS_UNVERIFIED'): self.run_main(send=lambda *a: 'exists')
        self.assertFalse((self.state / 'last.json').exists())
    def test_destination_parsing(self):
        self.assertEqual(M.bucket_of('SYNK_BACKUP_GCS_DESTINATION="gs://abc-def/company/production"\n'), 'abc-def')
        for bad in ('', 'SYNK_BACKUP_GCS_DESTINATION=s3://x/y\n', 'SYNK_BACKUP_GCS_DESTINATION=gs://a/b\nSYNK_BACKUP_GCS_DESTINATION=gs://c/d\n'):
            with self.assertRaises(M.Failed): M.bucket_of(bad)
    def test_upload_checks_response_and_412(self):
        f = self.root / 'x.gz'; f.write_bytes(b'abc'); seen = []
        def ok(req, timeout): seen.append(req); return R(json.dumps({'name': 'company/workbackup/n.gz', 'size': '3', 'md5Hash': 'm'}).encode())
        self.assertEqual(M.upload('b', 'n.gz', f, 'm', 3, 't', opener=ok), 'created')
        self.assertIn('ifGenerationMatch=0', seen[0].full_url); self.assertIn('name=company%2Fworkbackup%2Fn.gz', seen[0].full_url); self.assertEqual(seen[0].get_header('Authorization'), 'Bearer t')
        with self.assertRaisesRegex(M.Failed, 'UPLOAD_MISMATCH'): M.upload('b', 'n.gz', f, 'other', 3, 't', opener=ok)
        def gone(req, timeout): raise urllib.error.HTTPError(req.full_url, 412, 'precondition', {}, None)
        self.assertEqual(M.upload('b', 'n.gz', f, 'm', 3, 't', opener=gone), 'exists')
        def denied(req, timeout): raise urllib.error.HTTPError(req.full_url, 403, 'denied', {}, None)
        with self.assertRaisesRegex(M.Failed, 'UPLOAD_HTTP_403'): M.upload('b', 'n.gz', f, 'm', 3, 't', opener=denied)

if __name__ == '__main__': unittest.main()
