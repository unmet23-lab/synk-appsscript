import base64, hashlib, importlib.util, json, os, pathlib, sys, tempfile, unittest

spec = importlib.util.spec_from_file_location('static_set_node', pathlib.Path(__file__).with_name('static-set-node.py'))
node_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(node_module)
Node, Refused, canonical_id, validate, main = node_module.Node, node_module.Refused, node_module.canonical_id, node_module.validate, node_module.main

COMPANY = 'docs/마케팅/온라인마케팅지도/engagement/company'


class FakeLinks:
    """Real symlinks need a privilege on Windows; production runs on Linux."""
    def __init__(self):
        self.real = os.name != 'nt'

    def symlink(self, target, path):
        if self.real:
            return os.symlink(target, path)
        pathlib.Path(path).write_text('LINK:' + target, 'utf-8')

    def readlink(self, path):
        return os.readlink(path) if self.real else pathlib.Path(path).read_text('utf-8')[5:]

    def islink(self, path):
        return os.path.islink(path) if self.real else pathlib.Path(path).is_file() and pathlib.Path(path).read_text('utf-8').startswith('LINK:')


class StaticSetNode(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        base = pathlib.Path(self.temp.name)
        self.release = base / 'releases' / 'abc'
        for rel, body in {COMPANY + '/public/app.js': b'one', COMPANY + '/public/index.html': b'<html></html>', 'tools/company-messenger/public/app.js': b'm', COMPANY + '/server.mjs': b'server'}.items():
            path = self.release.joinpath(*rel.split('/'))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        links = FakeLinks()
        current = base / 'current'
        links.symlink(str(self.release), current) if links.real else None
        self.node = Node(root=base / 'static', release=current if links.real else self.release, persistent=base, owner_check=False, clock=lambda: 1792560000, symlink=links.symlink, readlink=links.readlink, islink=links.islink)

    def tearDown(self):
        self.temp.cleanup()

    def init(self):
        return self.node.init([COMPANY + '/public/app.js', COMPANY + '/public/index.html', 'tools/company-messenger/public/app.js'], ['tools/company-messenger/public'], 'a' * 40)

    def test_init_copies_listed_release_files_into_an_immutable_set(self):
        first = self.init()
        self.assertEqual(first['status'], 'staged')
        self.assertTrue(first['created'])
        manifest = self.node.verify(first['set'])
        self.assertEqual(sorted(manifest['files']), sorted([COMPANY + '/public/app.js', COMPANY + '/public/index.html', 'tools/company-messenger/public/app.js']))
        self.assertEqual(manifest['files'][COMPANY + '/public/app.js'], {'sha256': hashlib.sha256(b'one').hexdigest(), 'size': 3})
        self.assertEqual(manifest['id'], canonical_id(manifest['files'], manifest['directories']))
        self.assertEqual(self.init()['created'], False)  # same bytes give the same id
        self.assertIsNone(self.node.current_id())
        with self.assertRaises(Refused) as caught:
            self.node.init([COMPANY + '/server.mjs/../x'], [], None)
        self.assertEqual(str(caught.exception), 'STATIC_SET_FILE')
        with self.assertRaises(Refused):
            self.node.init([COMPANY + '/public/missing.js'], [], None)

    def test_stage_links_the_base_and_replaces_only_named_files(self):
        base = self.init()['set']
        body = b'console.log("two")'
        changes = {COMPANY + '/public/app.js': {'base64': base64.b64encode(body).decode(), 'sha256': hashlib.sha256(body).hexdigest()}}
        expected = dict(self.node.manifest(base)['files'])
        expected[COMPANY + '/public/app.js'] = {'sha256': hashlib.sha256(body).hexdigest(), 'size': len(body)}
        expected_id = canonical_id(expected, ['tools/company-messenger/public'])
        staged = self.node.stage(base, changes, expected_id, 'b' * 40)
        self.assertEqual(staged['set'], expected_id)
        self.assertEqual((self.node.sets() / expected_id).joinpath(*(COMPANY + '/public/app.js').split('/')).read_bytes(), body)
        self.assertEqual((self.node.sets() / base).joinpath(*(COMPANY + '/public/app.js').split('/')).read_bytes(), b'one')
        with self.assertRaises(Refused) as caught:
            self.node.stage(base, {COMPANY + '/public/app.js': {'base64': base64.b64encode(b'x').decode(), 'sha256': '0' * 64}}, expected_id, None)
        self.assertEqual(str(caught.exception), 'CHANGE_BYTES')
        with self.assertRaises(Refused) as caught:
            self.node.stage(base, changes, '0' * 16, None)
        self.assertEqual(str(caught.exception), 'STAGED_ID_MISMATCH')

    def test_flip_is_compare_and_swap_records_history_and_rolls_back(self):
        first = self.init()['set']
        with self.assertRaises(Refused):
            self.node.flip(first, 'ffffffffffffffff')
        self.assertEqual(self.node.flip(first, None)['to'], first)
        self.assertEqual(self.node.current_id(), first)
        body = b'two'
        changes = {COMPANY + '/public/app.js': {'base64': base64.b64encode(body).decode(), 'sha256': hashlib.sha256(body).hexdigest()}}
        files = dict(self.node.manifest(first)['files'])
        files[COMPANY + '/public/app.js'] = {'sha256': hashlib.sha256(body).hexdigest(), 'size': 3}
        second = self.node.stage(first, changes, canonical_id(files, ['tools/company-messenger/public']), None)['set']
        self.assertEqual(self.node.flip(second, first)['from'], first)
        self.assertEqual(self.node.flip(first, second)['to'], first)  # rollback is a flip back
        self.assertEqual([(h['from'], h['to']) for h in self.node.history()], [(None, first), (first, second), (second, first)])
        status = self.node.status()
        self.assertEqual((status['status'], status['current'], status['files']), ('present', first, 3))
        damaged = (self.node.sets() / second).joinpath(*(COMPANY + '/public/app.js').split('/'))
        os.chmod(damaged, 0o644)
        damaged.write_bytes(b'tampered')
        with self.assertRaises(Refused) as caught:
            self.node.flip(second, first)
        self.assertEqual(str(caught.exception), 'STATIC_SET_FILE_MISMATCH')
        self.assertEqual(self.node.current_id(), first)

    def test_read_returns_only_listed_files_and_main_refuses_unknown_operations(self):
        first = self.init()['set']
        self.assertEqual(bytes.fromhex(self.node.read(first, [COMPANY + '/public/app.js'])['files'][COMPANY + '/public/app.js']), b'one')
        with self.assertRaises(Refused):
            self.node.read(first, [COMPANY + '/server.mjs'])
        with self.assertRaises(Refused):
            main({'op': 'delete'}, self.node)
        self.assertEqual(main({'op': 'verify', 'set': first}, self.node)['status'], 'verified')

    def test_manifest_validation_matches_the_server_rules(self):
        files = {'a/b.js': {'sha256': '0' * 64, 'size': 1}}
        good = {'schema': node_module.SCHEMA, 'id': canonical_id(files, ['a']), 'files': files, 'directories': ['a']}
        self.assertEqual(validate(good)['id'], good['id'])
        for change in ({'schema': 'x'}, {'id': '0' * 16}, {'directories': ['b']}, {'files': {'../b.js': files['a/b.js']}}):
            with self.assertRaises(Refused):
                validate({**good, **change})


if __name__ == '__main__':
    unittest.main()
