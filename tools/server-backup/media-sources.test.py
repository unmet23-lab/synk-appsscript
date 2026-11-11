"""Server-only Drive copy of studio media: receipt matching (company-sources.py) and the live reader (media-read.py)."""
import base64, hashlib, importlib.util, io, json, os, pathlib, tarfile, tempfile, unittest

here = pathlib.Path(__file__).parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, here / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


sources = load('company_sources', 'company-sources.py')
reader = load('media_read', 'media-read.py')
A = '61234567-1234-4234-8234-123456789abc.mp4'
B = '71234567-1234-4234-8234-123456789abc.png'
TWIN = '81234567-1234-4234-8234-123456789abc.mp4'
BODIES = {A: b'synthetic video body', B: b'synthetic image body!', TWIN: b'synthetic video body'}
BUCKET = 'synk-media-fixture'
OWNER = os.getuid() if hasattr(os, 'getuid') else None


def sha(b):
    return hashlib.sha256(b).hexdigest()


def md5(b):
    return base64.b64encode(hashlib.md5(b).digest()).decode()


class Capsules(unittest.TestCase):
    BACKUP = 'synk-workspace-2026-11-06T18-30-00-000Z'
    CREATED = '2026-11-06T18:30:41.000Z'

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.archives = pathlib.Path(self.temp.name)
        self.data = pathlib.Path('/srv/synk/fixture-company')
        self.files = [{'diskName': n, 'sha256': sha(b), 'bytes': len(b)} for n, b in BODIES.items()]

    def tearDown(self):
        self.temp.cleanup()

    def capsule(self, included=False, listed=True, created=CREATED, backup=BACKUP, retention=None, declare=None):
        """A DR archive whose data/workspace.tar.gz holds the data backup's manifests. retention: a callable that gets the list bytes and
        returns the media-retention.json body (dict) or None for a backup from before the 2026-11 retention rule. declare: integration's mediaRetention."""
        media = json.dumps({'schema': 'synk-workspace-media/v1', 'createdAt': created, 'bytesIncluded': included, 'files': self.files}).encode()
        integration = {'version': 1, 'createdAt': created, 'mediaCount': 3}
        if listed:
            integration.update(mediaManifest='media-manifest.json', mediaBytesIncluded=included)
        kept = retention(media) if retention else None
        if declare if declare is not None else kept is not None:
            integration['mediaRetention'] = 'media-retention.json'
        inner = io.BytesIO()
        with tarfile.open(fileobj=inner, mode='w:gz') as data:
            for name, body in (('integration-manifest.json', json.dumps(integration).encode()), ('media-manifest.json', media if listed else None),
                               ('media-retention.json', json.dumps(kept).encode() if kept is not None else None)):
                if body is None:
                    continue
                info = tarfile.TarInfo(backup + '/' + name)
                info.size = len(body)
                data.addfile(info, io.BytesIO(body))
        path = self.archives / ('synk-server-recovery-%d.tar.gz' % len(list(self.archives.iterdir())))
        with tarfile.open(path, 'w:gz') as outer:
            for name, body in (('disaster-restore.py', b'#'), ('data/workspace.tar.gz', inner.getvalue())):
                info = tarfile.TarInfo(name)
                info.size = len(body)
                outer.addfile(info, io.BytesIO(body))
        return path, hashlib.sha256(media).hexdigest()

    def receipt(self, manifest_sha, backup=BACKUP, created=CREATED, objects=None, overrides=None):
        unique = {f['sha256']: f for f in self.files}
        body = {'schema': 'synk-backup-media-receipt/v1', 'backup': backup, 'createdAt': created, 'manifestSha256': manifest_sha, 'bytesIncluded': False,
                'bucket': BUCKET, 'prefix': 'company/production/', 'files': self.files,
                'objects': objects if objects is not None else [{'sha256': s, 'bytes': f['bytes'], 'object': 'company/production/' + backup + '.media-' + s,
                                                                 'generation': '17', 'md5Hash': md5(BODIES[f['diskName']])} for s, f in unique.items()],
                'complete': {'object': 'company/production/' + backup + '.media-complete', 'generation': '18'}}
        body.update(overrides or {})
        path = self.archives / (backup + '.tar.gz.media.json')
        path.write_text(json.dumps(body))
        if OWNER is not None:
            os.chmod(path, 0o600)
        return path

    def media(self, capsule, created=CREATED, bucket=BUCKET):
        return sources.media_for(capsule, created, bucket, self.data, self.archives, OWNER)


class Receipts(Capsules):
    def test_an_archive_from_before_media_lists_or_with_bytes_inside_carries_nothing(self):
        old, _ = self.capsule(listed=False)
        self.assertIsNone(self.media(old))
        both, digest = self.capsule(included=True)
        self.assertIsNone(self.media(both))

    def test_a_list_only_backup_names_one_sidecar_per_content_with_a_disk_name(self):
        capsule, digest = self.capsule()
        self.receipt(digest)
        media = self.media(capsule)
        self.assertEqual((media['backup'], media['bucket'], media['dataDir'], len(media['objects'])), (self.BACKUP, BUCKET, str(self.data), 2))
        for o in media['objects']:
            self.assertEqual(sha(BODIES[o['diskName']]), o['sha256'])

    def test_a_list_only_backup_without_its_own_receipt_never_passes_as_carried(self):
        capsule, digest = self.capsule()
        with self.assertRaisesRegex(AssertionError, 'MEDIA_RECEIPT_MISSING'):
            self.media(capsule)  # no receipts at all: the list says the bytes are elsewhere
        self.receipt('b' * 64)  # same backup and time, another list
        with self.assertRaisesRegex(AssertionError, 'MEDIA_RECEIPT_MISSING'):
            self.media(capsule)
        with self.assertRaisesRegex(AssertionError, 'DATA_BACKUP_TIME_MISMATCH'):
            self.media(capsule, created='2026-11-06T18:30:42.000Z')

    def test_a_receipt_that_disagrees_with_the_archive_stops_the_run(self):
        capsule, digest = self.capsule()
        for objects, overrides in (([], {}), (None, {'bucket': 'another-bucket'}), (None, {'files': self.files[:2]}), (None, {'bytesIncluded': True})):
            path = self.receipt(digest, objects=objects, overrides=overrides)
            with self.assertRaises(AssertionError):
                self.media(capsule)
            path.unlink()
        good = self.receipt(digest)
        with self.assertRaisesRegex(AssertionError, 'MEDIA_RECEIPT_INVALID'):
            self.media(capsule, bucket='another-bucket')
        good.unlink()


class Retention(Capsules):
    """2026-11-11 결정 표 ① · 판 4 설계 11-2: the data backup names the persona-owned bodies; the Drive copy marks them vault:false."""
    def kept(self, *names, **change):
        def body(media):
            value = {'schema': 'synk-workspace-media-retention/v1', 'createdAt': self.CREATED, 'manifestSha256': hashlib.sha256(media).hexdigest(),
                     'noVault': sorted({sha(BODIES[n]) for n in names}), 'legacyDeleted': 0}
            value.update(change)
            return value
        return body

    def both(self, capsule):
        return sources.sources_for(capsule, self.CREATED, BUCKET, self.data, self.archives, OWNER)

    def test_a_backup_from_before_the_rule_is_unclassified(self):
        for listed, included in ((False, False), (True, True)):
            capsule, _ = self.capsule(listed=listed, included=included)
            media, retention = self.both(capsule)
            self.assertIsNone(media)
            self.assertEqual(retention, {'classified': False, 'noVault': [], 'bytesIncluded': None if not listed else True, 'legacyDeleted': None})
        capsule, digest = self.capsule()
        self.receipt(digest)
        media, retention = self.both(capsule)
        self.assertEqual((len(media['objects']), retention['classified'], retention['bytesIncluded']), (2, False, False))

    def test_a_listed_backup_passes_its_persona_bodies_on(self):
        capsule, digest = self.capsule(retention=self.kept(B))
        self.receipt(digest)
        media, retention = self.both(capsule)
        self.assertEqual(retention, {'classified': True, 'noVault': [sha(BODIES[B])], 'bytesIncluded': False, 'legacyDeleted': 0})
        self.assertIn(sha(BODIES[B]), {o['sha256'] for o in media['objects']})
        inside, _ = self.capsule(included=True, retention=self.kept(A, B))
        media, retention = self.both(inside)
        self.assertIsNone(media)
        self.assertEqual((retention['classified'], retention['bytesIncluded'], len(retention['noVault'])), (True, True, 2))
        empty, digest = self.capsule(retention=self.kept())
        self.receipt(digest)
        self.assertEqual(self.both(empty)[1]['noVault'], [])
        # 해시 기록 없이 지운 인물이 있으면 분류를 미완으로 — PC가 영상 본문을 모두 금고에서 뺀다.
        legacy, _ = self.capsule(included=True, retention=self.kept(B, legacyDeleted=2))
        self.assertEqual(self.both(legacy)[1], {'classified': False, 'noVault': [sha(BODIES[B])], 'bytesIncluded': True, 'legacyDeleted': 2})

    def test_a_retention_file_that_disagrees_with_its_backup_stops_the_run(self):
        bad = (self.kept(B, manifestSha256='0' * 64), self.kept(B, createdAt='2026-11-06T18:30:42.000Z'), self.kept(B, schema='other'),
               self.kept(B, noVault=['f' * 64]), self.kept(B, noVault=[sha(BODIES[B]), sha(BODIES[B])]), self.kept(A, B, noVault=sorted({sha(BODIES[A]), sha(BODIES[B])}, reverse=True)),
               self.kept(B, noVault='all'), self.kept(B, legacyDeleted=-1), self.kept(B, legacyDeleted='0'), self.kept(B, legacyDeleted=None))
        for body in bad:
            capsule, _ = self.capsule(included=True, retention=body)
            with self.assertRaisesRegex(AssertionError, 'MEDIA_RETENTION_INVALID'):
                self.both(capsule)
        named_but_missing, _ = self.capsule(included=True, declare=True)
        with self.assertRaisesRegex(AssertionError, 'MEDIA_RETENTION_INVALID'):
            self.both(named_but_missing)
        unnamed_but_present, _ = self.capsule(included=True, retention=self.kept(B), declare=False)
        with self.assertRaisesRegex(AssertionError, 'MEDIA_RETENTION_INVALID'):
            self.both(unnamed_but_present)


class LiveReader(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = pathlib.Path(os.path.realpath(self.temp.name))
        (self.data / 'studio-media').mkdir()
        for n, b in BODIES.items():
            (self.data / 'studio-media' / n).write_bytes(b)

    def tearDown(self):
        self.temp.cleanup()

    def read(self, name, size):
        out = io.BytesIO()
        code = reader.main([str(self.data), name, str(size)], out, OWNER if OWNER is not None else 1000)
        return code, out.getvalue()

    def test_streams_the_exact_body(self):
        self.assertEqual(self.read(A, len(BODIES[A])), (0, BODIES[A]))

    def test_wrong_size_bad_name_and_missing_file_are_refused(self):
        self.assertEqual(self.read(A, len(BODIES[A]) + 1), (2, b''))
        self.assertEqual(self.read('../escape.mp4', 3), (2, b''))
        self.assertEqual(self.read('91234567-1234-4234-8234-123456789abc.mp4', 3), (2, b''))

    @unittest.skipUnless(os.name == 'posix', 'links and FIFOs need the Linux node path')
    def test_links_fifos_and_extra_links_are_refused(self):
        secret = self.data / 'secret'
        secret.write_bytes(BODIES[B])
        os.unlink(self.data / 'studio-media' / B)
        os.symlink(secret, self.data / 'studio-media' / B)
        self.assertEqual(self.read(B, len(BODIES[B]))[0], 2)
        os.unlink(self.data / 'studio-media' / B)
        os.mkfifo(self.data / 'studio-media' / B)
        self.assertEqual(self.read(B, 0)[0], 2)
        os.unlink(self.data / 'studio-media' / B)
        os.link(self.data / 'studio-media' / A, self.data / 'studio-media' / B)
        self.assertEqual(self.read(B, len(BODIES[A]))[0], 2)
        os.rename(self.data / 'studio-media', self.data / 'moved')
        os.symlink(self.data / 'moved', self.data / 'studio-media')
        self.assertEqual(self.read(A, len(BODIES[A]))[0], 2)


if __name__ == '__main__':
    unittest.main()
