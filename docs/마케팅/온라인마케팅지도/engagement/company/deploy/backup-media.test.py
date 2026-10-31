import argparse, base64, contextlib, hashlib, http.server, importlib.util, io, json, os, pathlib, sys, tempfile, threading, unittest, urllib.parse

spec = importlib.util.spec_from_file_location('backup_media', pathlib.Path(__file__).with_name('backup-media.py'))
bm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bm)

TOKEN = 'synthetic.fixture-token_1234567890'
BUCKET = 'synk-media-fixture'
DEST = 'gs://' + BUCKET + '/company/production'
FIRST = 'synk-workspace-2026-11-01T18-30-00-123Z'
SECOND = 'synk-workspace-2026-11-02T18-30-00-000Z'
A = '61234567-1234-4234-8234-123456789abc.mp4'
B = '71234567-1234-4234-8234-123456789abc.png'
TWIN = '81234567-1234-4234-8234-123456789abc.mp4'


def sha(body):
    return hashlib.sha256(body).hexdigest()


def md5(body):
    return base64.b64encode(hashlib.md5(body).digest()).decode()


def sidecar(backup, body):
    return 'company/production/' + backup + '.media-' + sha(body)


class FakeStorage(http.server.ThreadingHTTPServer):
    """Just the three GCS JSON API calls the tool makes."""
    def __init__(self):
        super().__init__(('127.0.0.1', 0), Handler)
        self.objects = {}  # name -> (generation, bytes, timeCreated)
        self.generation = 1000
        self.mode = {}
        self.requests = []
        self.page_size = 2

    def add(self, name, body, created):
        self.generation += 1
        self.objects[name] = (self.generation, body, created)


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, body=b'', headers=None):
        self.send_response(status)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        self.server.requests.append((self.command, self.path, self.headers.get('Authorization')))
        if self.headers.get('Authorization') != 'Bearer ' + TOKEN:
            self.reply(401)
            return False
        return True

    def do_POST(self):
        if not self.authorized():
            return
        url = urllib.parse.urlparse(self.path)
        query = dict(urllib.parse.parse_qsl(url.query))
        body = self.rfile.read(int(self.headers['Content-Length']))
        name = query['name']
        if url.path != '/upload/storage/v1/b/' + BUCKET + '/o' or query.get('uploadType') != 'media' or query.get('ifGenerationMatch') != '0':
            return self.reply(400)
        if self.server.mode.get('upload') == 'fail':
            return self.reply(503)
        if name in self.server.objects or self.server.mode.get('upload') == 'exists':
            return self.reply(412)
        self.server.add(name, body, '2026-11-01T18:31:00.000Z')
        digest = md5(body) if self.server.mode.get('upload') != 'wrong-md5' else md5(b'other')
        self.reply(200, json.dumps({'name': name, 'generation': str(self.server.generation), 'size': str(len(body)), 'md5Hash': digest}).encode())

    def do_GET(self):
        if not self.authorized():
            return
        url = urllib.parse.urlparse(self.path)
        query = dict(urllib.parse.parse_qsl(url.query))
        base = '/storage/v1/b/' + BUCKET + '/o'
        if url.path == base:
            names = sorted(n for n in self.server.objects if n.startswith(query['prefix']))
            start = int(query.get('pageToken', '0'))
            page = names[start:start + self.server.page_size]
            items = [{'name': n, 'generation': str(self.server.objects[n][0]), 'size': str(len(self.server.objects[n][1])),
                      'md5Hash': md5(self.server.objects[n][1]), 'timeCreated': self.server.objects[n][2]} for n in page]
            body = {'items': items}
            if start + self.server.page_size < len(names):
                body['nextPageToken'] = str(start + self.server.page_size)
            return self.reply(200, json.dumps(body).encode())
        name = urllib.parse.unquote(url.path[len(base) + 1:])
        if name not in self.server.objects or query.get('alt') != 'media':
            return self.reply(404)
        generation, body, _ = self.server.objects[name]
        if query.get('generation') != str(generation):
            return self.reply(404)
        if self.server.mode.get('corrupt') == name:
            body = b'X' + body[1:]
        self.reply(200, body, {'x-goog-generation': str(generation)})


class Base(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(os.path.realpath(self.temp.name))
        self.server = FakeStorage()
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.endpoint = 'http://127.0.0.1:%d' % self.server.server_address[1]
        self.volume = self.root / 'company'
        (self.volume / 'studio-media').mkdir(parents=True)
        self.bodies = {A: b'synthetic video body', B: b'synthetic image body!', TWIN: b'synthetic video body'}
        for name, body in self.bodies.items():
            (self.volume / 'studio-media' / name).write_bytes(body)
        self.snapshot = self.backup(False)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.temp.cleanup()

    def backup(self, included, name=FIRST, files=None, extra=None):
        folder = self.root / 'backups' / name
        folder.mkdir(parents=True)
        rows = files if files is not None else [{'diskName': n, 'sha256': sha(b), 'bytes': len(b)} for n, b in self.bodies.items()]
        (folder / 'media-manifest.json').write_text(json.dumps({'schema': 'synk-workspace-media/v1', 'createdAt': '2026-11-01T18:30:00.123Z', 'bytesIncluded': included, 'files': rows}))
        manifest = {'version': 1, 'mediaCount': len(rows), 'mediaManifest': 'media-manifest.json', 'mediaBytesIncluded': included}
        manifest.update(extra or {})
        (folder / 'integration-manifest.json').write_text(json.dumps(manifest))
        (folder / 'company').mkdir()
        if included:  # workspace-backup.mjs --media=both copies the bodies into the snapshot
            (folder / 'company' / 'studio-media').mkdir()
            for row in rows:
                if row['diskName'] in self.bodies:
                    (folder / 'company' / 'studio-media' / row['diskName']).write_bytes(self.bodies[row['diskName']])
        return folder

    def run_tool(self, *argv, token=TOKEN):
        stdin, out, err = sys.stdin, io.StringIO(), io.StringIO()
        sys.stdin = io.StringIO(token + '\n')
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = bm.main([*argv, '--endpoint', self.endpoint])
        finally:
            sys.stdin = stdin
        return code, json.loads(out.getvalue()) if out.getvalue() else None, err.getvalue()

    def upload(self, snapshot=None, destination=DEST, extra=()):
        return self.run_tool('upload', '--snapshot', str(snapshot or self.snapshot), '--volume', str(self.volume), '--destination', destination,
                             '--owner-uid', str(os.getuid() if hasattr(os, 'getuid') else -1), *extra)


class Upload(Base):
    def test_each_backup_sends_its_bodies_once_per_content_as_sidecars_then_closes_the_set(self):
        code, out, err = self.upload()
        self.assertEqual((code, err), (0, ''))
        self.assertEqual(out, {'status': 'complete', 'mode': 'manifest', 'files': 3, 'contents': 2, 'bytes': 41, 'uploaded': 2, 'uploadedBytes': 41,
                               'setClosed': True})
        complete = 'company/production/' + FIRST + '.media-complete'
        self.assertEqual(sorted(self.server.objects), sorted({sidecar(FIRST, b) for b in self.bodies.values()} | {complete}))
        for name, (_, body, _) in self.server.objects.items():
            if name != complete:
                self.assertEqual(name, sidecar(FIRST, body))
        closing = json.loads(self.server.objects[complete][1])
        self.assertEqual({k: closing[k] for k in ('schema', 'backup', 'files', 'contents', 'bytes')},
                         {'schema': 'synk-workspace-media-complete/v1', 'backup': FIRST, 'files': 3, 'contents': 2, 'bytes': 41})
        self.assertEqual(closing['manifestSha256'], sha((self.snapshot / 'media-manifest.json').read_bytes()))
        self.assertEqual(self.server.objects[complete][0], max(g for g, _, _ in self.server.objects.values()))  # the last object
        # The next backup does not lean on the first one's copies: they end with the first archive.
        code, out, _ = self.upload(self.backup(True, SECOND))
        self.assertEqual((code, out['uploaded'], out['mode']), (0, 2, 'both'))
        self.assertEqual(len(self.server.objects), 6)

    def test_with_bytes_in_the_archive_the_bodies_come_from_the_snapshot_copy_not_the_live_volume(self):
        snapshot = self.backup(True, SECOND)
        (self.volume / 'studio-media' / B).write_bytes(b'live file changed!!!!')  # after the snapshot
        os.unlink(self.volume / 'studio-media' / A)
        code, out, err = self.upload(snapshot)
        self.assertEqual((code, err, out['uploaded']), (0, '', 2))
        self.assertEqual(self.server.objects[sidecar(SECOND, self.bodies[B])][1], self.bodies[B])

    def test_another_destination_gets_its_own_bodies_too(self):
        self.upload()
        other = 'gs://' + BUCKET + '/company/elsewhere'
        code, out, _ = self.upload(self.backup(True, SECOND), other)
        self.assertEqual((code, out['uploaded']), (0, 2))
        self.assertEqual(sorted(n for n in self.server.objects if n.startswith('company/elsewhere/')),
                         sorted(['company/elsewhere/' + SECOND + '.media-' + sha(b) for b in {*self.bodies.values()}] + ['company/elsewhere/' + SECOND + '.media-complete']))

    def test_a_live_file_that_differs_from_the_list_is_refused(self):
        (self.volume / 'studio-media' / B).write_bytes(b'synthetic image BODY!')
        code, out, err = self.upload()
        self.assertEqual((code, out, err), (1, None, 'SYNK_BACKUP_MEDIA MEDIA_CHANGED\n'))

    def test_size_mismatch_missing_file_and_extra_links_are_refused_before_anything_is_sent(self):
        (self.volume / 'studio-media' / A).write_bytes(b'short')
        self.assertEqual(self.upload()[2], 'SYNK_BACKUP_MEDIA MEDIA_FILE_SIZE_CHANGED\n')
        (self.volume / 'studio-media' / A).write_bytes(self.bodies[A])
        os.unlink(self.volume / 'studio-media' / TWIN)
        self.assertEqual(self.upload()[2], 'SYNK_BACKUP_MEDIA MEDIA_FILE_UNREADABLE\n')
        os.link(self.volume / 'studio-media' / A, self.volume / 'studio-media' / TWIN)
        self.assertEqual(self.upload()[2], 'SYNK_BACKUP_MEDIA MEDIA_FILE_INVALID\n')
        self.assertEqual(self.server.objects, {})

    @unittest.skipUnless(os.name == 'posix', 'symlinks and FIFOs need the Linux node path')
    def test_links_and_fifos_planted_by_the_container_never_block_or_leak_host_files(self):
        secret = self.root / 'host-secret'
        secret.write_bytes(self.bodies[B])
        os.unlink(self.volume / 'studio-media' / B)
        os.symlink(secret, self.volume / 'studio-media' / B)
        self.assertEqual(self.upload()[2], 'SYNK_BACKUP_MEDIA MEDIA_FILE_UNREADABLE\n')
        os.unlink(self.volume / 'studio-media' / B)
        os.mkfifo(self.volume / 'studio-media' / B)
        self.assertEqual(self.upload()[2], 'SYNK_BACKUP_MEDIA MEDIA_FILE_INVALID\n')
        os.unlink(self.volume / 'studio-media' / B)
        (self.volume / 'studio-media' / B).write_bytes(self.bodies[B])
        os.rename(self.volume / 'studio-media', self.root / 'moved')
        os.symlink(self.root / 'moved', self.volume / 'studio-media')
        self.assertEqual(self.upload()[2], 'SYNK_BACKUP_MEDIA DIRECTORY_INVALID\n')
        self.assertEqual(self.server.objects, {})

    def test_wrong_md5_existing_object_and_server_errors_fail_and_leave_the_set_open(self):
        for mode, code in (('wrong-md5', 'MEDIA_UPLOAD_MISMATCH'), ('exists', 'MEDIA_OBJECT_EXISTS'), ('fail', 'MEDIA_UPLOAD_FAILED')):
            self.server.mode['upload'] = mode
            self.server.objects.clear()
            self.assertEqual(self.upload()[2], 'SYNK_BACKUP_MEDIA ' + code + '\n')
            self.assertFalse(any(n.endswith('.media-complete') for n in self.server.objects))

    def test_the_token_comes_only_from_stdin_and_never_shows_in_output(self):
        code, out, err = self.upload()
        self.assertNotIn(TOKEN, json.dumps(out) + err)
        self.assertTrue(all(r[2] == 'Bearer ' + TOKEN for r in self.server.requests))
        for bad in ('x', TOKEN + '"', TOKEN + ' header'):
            self.server.requests.clear()
            code, out, err = self.run_tool('upload', '--snapshot', str(self.snapshot), '--volume', str(self.volume), '--destination', DEST, token=bad)
            self.assertEqual((code, err, self.server.requests), (1, 'SYNK_BACKUP_MEDIA TOKEN_INVALID\n', []))

    def test_a_list_that_disagrees_with_itself_or_the_integration_manifest_is_refused(self):
        good = [{'diskName': n, 'sha256': sha(b), 'bytes': len(b)} for n, b in self.bodies.items()]
        cases = [
            (good + [dict(good[0])], {}),                                          # duplicate name
            ([dict(good[0], diskName='../escape.mp4')] + good[1:], {}),            # bad name
            ([dict(good[0], sha256='A' * 64)] + good[1:], {}),                     # bad digest
            ([dict(good[0], bytes=-1)] + good[1:], {}),                            # bad size
            ([dict(good[0], extra=1)] + good[1:], {}),                             # unknown field
            ([dict(good[2], bytes=99)] + good[:2], {}),                            # same sha, two sizes
            (good, {'mediaCount': 2}),                                             # count differs
            (good, {'mediaBytesIncluded': False}),                                 # mode differs
        ]
        for index, (rows, extra) in enumerate(cases):
            snapshot = self.backup(True, 'synk-workspace-2026-11-01T18-30-00-%03dZ' % index, rows, extra)
            self.assertEqual(self.upload(snapshot)[2], 'SYNK_BACKUP_MEDIA MANIFEST_INVALID\n', index)
        self.assertEqual(self.upload(self.root / 'backups' / 'not-a-backup')[2], 'SYNK_BACKUP_MEDIA SNAPSHOT_INVALID\n')
        self.assertEqual(self.server.objects, {})

    def test_an_empty_list_needs_no_media_folder_and_still_closes_the_set(self):
        snapshot = self.backup(False, 'synk-workspace-2026-11-01T18-30-00-999Z', [])
        os.rename(self.volume / 'studio-media', self.root / 'gone')
        self.assertEqual(self.upload(snapshot)[:2], (0, {'status': 'complete', 'mode': 'manifest', 'files': 0, 'contents': 0, 'bytes': 0,
                                                       'uploaded': 0, 'uploadedBytes': 0, 'setClosed': True}))
        self.assertEqual(list(self.server.objects), ['company/production/synk-workspace-2026-11-01T18-30-00-999Z.media-complete'])

    def test_the_stage_budget_stops_hashing_and_sending_midway_not_only_before_a_request(self):
        self.assertEqual(self.upload(extra=('--budget-seconds', '0'))[2], 'SYNK_BACKUP_MEDIA TIME_BUDGET\n')
        ticks = iter(range(10 ** 6))

        class Slow(bm.Budget):
            def __init__(self, seconds=None):
                super().__init__(seconds, clock=lambda: next(ticks))
        real = bm.Budget
        bm.Budget = Slow
        try:
            code, out, err = self.upload(extra=('--budget-seconds', '7'))
        finally:
            bm.Budget = real
        self.assertEqual((code, err), (1, 'SYNK_BACKUP_MEDIA TIME_BUDGET\n'))
        self.assertLess(len(self.server.objects), 2)
        self.assertFalse(any(n.endswith('.media-complete') for n in self.server.objects))


class Restore(Base):
    def setUp(self):
        super().setUp()
        self.assertEqual(self.upload(self.backup(True, 'synk-workspace-2026-10-31T18-30-00-000Z'))[0], 0)  # an older backup, bytes included
        self.snapshot = self.backup(False, SECOND)
        self.assertEqual(self.upload(self.snapshot)[0], 0)   # SECOND, list only
        self.prepared = self.root / 'prepared-company'
        self.prepared.mkdir()

    def hydrate(self, prepared=True):
        return self.run_tool('hydrate', '--snapshot', str(self.snapshot), '--source', DEST, *(['--prepared', str(self.prepared)] if prepared else []))

    def test_hydrate_fills_the_snapshot_and_the_prepared_volume_from_its_own_sidecars(self):
        code, out, err = self.hydrate()
        self.assertEqual((code, err), (0, ''))
        self.assertEqual(out, {'status': 'hydrated', 'files': 3, 'contents': 2, 'bytes': 41, 'targets': 2, 'fromOtherBackups': 0})
        for folder in (self.snapshot / 'company' / 'studio-media', self.prepared / 'studio-media'):
            self.assertEqual({p.name: p.read_bytes() for p in folder.iterdir()}, self.bodies)
        fetched = [urllib.parse.unquote(r[1].split('?')[0]) for r in self.server.requests if 'alt=media' in r[1]]
        self.assertTrue(fetched and all(SECOND in path for path in fetched))

    def test_a_corrupt_own_sidecar_falls_back_to_the_same_content_of_another_backup(self):
        self.server.mode['corrupt'] = sidecar(SECOND, self.bodies[A])
        code, out, _ = self.hydrate(False)
        self.assertEqual((code, out['fromOtherBackups']), (0, 1))  # counted by where the body really came from
        self.assertEqual((self.snapshot / 'company' / 'studio-media' / A).read_bytes(), self.bodies[A])
        fetched = [urllib.parse.unquote(r[1].split('?')[0]) for r in self.server.requests if 'alt=media' in r[1] and sha(self.bodies[A]) in r[1]]
        self.assertEqual([SECOND in path for path in fetched], [True, False])
        self.assertFalse(any(p.name.endswith('.part') for p in (self.snapshot / 'company' / 'studio-media').iterdir()))

    def test_missing_offsite_copy_existing_target_and_included_bytes_are_refused(self):
        self.server.objects = {n: v for n, v in self.server.objects.items() if sha(self.bodies[B]) not in n}
        self.assertEqual(self.hydrate()[2], 'SYNK_BACKUP_MEDIA MEDIA_OFFSITE_MISSING\n')
        self.snapshot = self.backup(False, 'synk-workspace-2026-11-03T18-30-00-000Z')
        self.upload(self.snapshot)
        (self.prepared / 'studio-media').mkdir(exist_ok=True)
        (self.prepared / 'studio-media' / A).write_bytes(b'keep me')
        self.assertEqual(self.hydrate()[2], 'SYNK_BACKUP_MEDIA TARGET_EXISTS\n')
        self.assertEqual((self.prepared / 'studio-media' / A).read_bytes(), b'keep me')
        self.snapshot = self.root / 'backups' / 'synk-workspace-2026-10-31T18-30-00-000Z'
        self.assertEqual(self.hydrate(False)[2], 'SYNK_BACKUP_MEDIA BYTES_ALREADY_INCLUDED\n')

    def test_verify_wants_this_backups_own_sidecars_and_catches_corrupt_ones(self):
        self.server.page_size = 1  # paging
        code, out, _ = self.run_tool('verify', '--snapshot', str(self.snapshot), '--source', DEST, '--download')
        self.assertEqual((code, out['status'], out['missing'], out['mismatched'], out['setClosed']), (0, 'verified', 0, 0, True))
        self.server.mode['corrupt'] = sidecar(SECOND, self.bodies[B])
        code, out, _ = self.run_tool('verify', '--snapshot', str(self.snapshot), '--source', DEST, '--download')
        self.assertEqual((code, out['status'], out['mismatched']), (1, 'incomplete', 1))
        del self.server.objects[sidecar(SECOND, self.bodies[B])]
        code, out, _ = self.run_tool('verify', '--snapshot', str(self.snapshot), '--source', DEST)
        self.assertEqual((code, out['missing'], out['downloaded']), (1, 1, False))  # the older backup's copy does not count
        self.assertFalse((self.snapshot / 'company' / 'studio-media').exists())
        self.upload(self.backup(False, 'synk-workspace-2026-11-03T18-30-00-000Z'))
        del self.server.objects['company/production/synk-workspace-2026-11-03T18-30-00-000Z.media-complete']
        code, out, _ = self.run_tool('verify', '--snapshot', str(self.root / 'backups' / 'synk-workspace-2026-11-03T18-30-00-000Z'), '--source', DEST)
        self.assertEqual((code, out['status'], out['missing'], out['setClosed']), (1, 'incomplete', 0, False))


if __name__ == '__main__':
    unittest.main()
