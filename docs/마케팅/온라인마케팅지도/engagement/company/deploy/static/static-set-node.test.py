import base64, hashlib, importlib.util, json, os, pathlib, sys, tempfile, unittest

spec = importlib.util.spec_from_file_location('static_set_node', pathlib.Path(__file__).with_name('static-set-node.py'))
node_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(node_module)
Node, Refused, canonical_id, validate, main = node_module.Node, node_module.Refused, node_module.canonical_id, node_module.validate, node_module.main

COMPANY = 'docs/마케팅/온라인마케팅지도/engagement/company'
digest = lambda body: hashlib.sha256(body).hexdigest()


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
        return self.node.init([COMPANY + '/public/app.js', COMPANY + '/public/index.html', 'tools/company-messenger/public/app.js'], 'a' * 40)

    def change(self, body):
        return {'base64': base64.b64encode(body).decode(), 'sha256': digest(body)}

    def release_file(self, rel, body):
        path = self.release.joinpath(*rel.split('/'))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)

    def test_ensure_creates_the_empty_root_without_a_set(self):
        self.assertFalse((self.node.root / 'sets').exists())
        first = main({'op': 'ensure'}, self.node)
        self.assertEqual(first['status'], 'ensured')
        self.assertIsNone(first['current'])
        self.assertTrue((self.node.root / 'sets').is_dir())
        self.assertEqual(main({'op': 'ensure'}, self.node)['status'], 'ensured')
        self.assertEqual(main({'op': 'status'}, self.node)['current'], None)

    def test_init_copies_listed_release_files_with_their_own_bytes_as_origin(self):
        first = self.init()
        self.assertEqual(first['status'], 'staged')
        self.assertTrue(first['created'])
        manifest = self.node.verify(first['set'])
        self.assertEqual(sorted(manifest['files']), sorted([COMPANY + '/public/app.js', COMPANY + '/public/index.html', 'tools/company-messenger/public/app.js']))
        self.assertEqual(manifest['files'][COMPANY + '/public/app.js'], {'sha256': digest(b'one'), 'size': 3, 'origin': digest(b'one')})
        self.assertEqual(manifest['id'], canonical_id(manifest['files']))
        self.assertNotIn('directories', manifest)
        self.assertEqual(self.init()['created'], False)  # same bytes give the same id
        self.assertIsNone(self.node.current_id())
        with self.assertRaises(Refused) as caught:
            self.node.init([COMPANY + '/server.mjs/../x'], None)
        self.assertEqual(str(caught.exception), 'STATIC_SET_FILE')
        with self.assertRaises(Refused):
            self.node.init([COMPANY + '/public/missing.js'], None)

    def test_stage_links_the_base_and_writes_replacements_against_the_running_release(self):
        base = self.init()['set']
        body = b'console.log("two")'
        changes = {COMPANY + '/public/app.js': self.change(body), COMPANY + '/public/new.js': self.change(b'new')}
        expected = dict(self.node.manifest(base)['files'])
        expected[COMPANY + '/public/app.js'] = {'sha256': digest(body), 'size': len(body), 'origin': digest(b'one')}
        expected[COMPANY + '/public/new.js'] = {'sha256': digest(b'new'), 'size': 3, 'origin': None}
        expected_id = canonical_id(expected)
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
        # A release that moved on since the plan gives another origin, so another id.
        self.release_file(COMPANY + '/public/app.js', b'released')
        with self.assertRaises(Refused) as caught:
            self.node.stage(base, changes, '0123456789abcdef', None)
        self.assertEqual(str(caught.exception), 'STAGED_ID_MISMATCH')

    def test_flip_is_compare_and_swap_records_history_and_rolls_back(self):
        first = self.init()['set']
        with self.assertRaises(Refused):
            self.node.flip(first, 'ffffffffffffffff')
        self.assertEqual(self.node.flip(first, None)['to'], first)
        self.assertEqual(self.node.current_id(), first)
        body = b'two'
        files = dict(self.node.manifest(first)['files'])
        files[COMPANY + '/public/app.js'] = {'sha256': digest(body), 'size': 3, 'origin': digest(b'one')}
        second = self.node.stage(first, {COMPANY + '/public/app.js': self.change(body)}, canonical_id(files), None)['set']
        self.assertEqual(self.node.flip(second, first)['from'], first)
        self.assertEqual(self.node.flip(first, second)['to'], first)  # rollback is a flip back
        self.assertEqual([(h['from'], h['to']) for h in self.node.history()], [(None, first), (first, second), (second, first)])
        status = self.node.status()
        self.assertEqual((status['status'], status['current'], status['files'], status['schema']), ('present', first, 3, node_module.SCHEMA))
        damaged = (self.node.sets() / second).joinpath(*(COMPANY + '/public/app.js').split('/'))
        os.chmod(damaged, 0o644)
        damaged.write_bytes(b'tampered')
        with self.assertRaises(Refused) as caught:
            self.node.flip(second, first)
        self.assertEqual(str(caught.exception), 'STATIC_SET_FILE_MISMATCH')
        self.assertEqual(self.node.current_id(), first)

    def test_served_follows_the_origin_rule_and_main_refuses_unknown_operations(self):
        app, chat, missing = COMPANY + '/public/app.js', 'tools/company-messenger/public/app.js', COMPANY + '/public/none.js'
        before = self.node.served([app])['files'][app]  # no set yet: the release copy
        self.assertEqual((before['from'], base64.b64decode(before['base64'])), ('release', b'one'))
        first = self.init()['set']
        self.node.flip(first, None)
        files = dict(self.node.manifest(first)['files'])
        files[app] = {'sha256': digest(b'swapped'), 'size': 7, 'origin': digest(b'one')}
        second = self.node.stage(first, {app: self.change(b'swapped')}, canonical_id(files), None)['set']
        self.node.flip(second, first)
        served = self.node.served([app, chat, missing])['files']
        self.assertEqual((served[app]['from'], base64.b64decode(served[app]['base64']), served[app]['release']), ('set', b'swapped', digest(b'one')))
        self.assertEqual(served[chat]['from'], 'set')
        self.assertEqual(served[missing], {'from': None, 'release': None})
        # An image release that changed the file wins over the set made against the old bytes.
        self.release_file(app, b'released')
        after = self.node.served([app])['files'][app]
        self.assertEqual((after['from'], base64.b64decode(after['base64']), after['release']), ('release', b'released', digest(b'released')))
        with self.assertRaises(Refused):
            main({'op': 'delete'}, self.node)
        with self.assertRaises(Refused):
            main({'op': 'read', 'set': first, 'paths': [app]}, self.node)
        self.assertEqual(main({'op': 'verify', 'set': first}, self.node)['status'], 'verified')

    def test_a_damaged_history_record_does_not_stop_status_or_flip(self):
        first = self.init()['set']
        self.node.root.joinpath('history.json').write_text('{not json', 'utf-8')
        self.assertEqual(self.node.status()['history'], [])
        flipped = self.node.flip(first, None)
        self.assertEqual((flipped['status'], flipped['historyRecorded']), ('flipped', True))
        self.assertEqual([h['to'] for h in self.node.history()], [first])

    def test_manifest_validation_matches_the_server_rules(self):
        files = {'a/b.js': {'sha256': '0' * 64, 'size': 1, 'origin': None}}
        good = {'schema': node_module.SCHEMA, 'id': canonical_id(files), 'files': files}
        self.assertEqual(validate(good)['id'], good['id'])
        for change in ({'schema': 'x'}, {'schema': 'synk-company-static-set/v1'}, {'id': '0' * 16}, {'files': {'../b.js': files['a/b.js']}}, {'files': {'a/b.js': {'sha256': '0' * 64, 'size': 1}}}, {'files': {'a/b.js': {'sha256': '0' * 64, 'size': 1, 'origin': 'zz'}}}):
            with self.assertRaises(Refused):
                validate({**good, **change})

    def test_prune_keeps_the_current_set_and_the_newest_five_and_needs_the_same_plan(self):
        self.node.ensure_root()
        clock, ids = [1792560000], []
        self.node.clock = lambda: clock[0]
        rel = COMPANY + '/public/app.js'
        for n in range(8):
            clock[0] += 60
            body = ('set %d' % n).encode()
            set_id, created = self.node.write_set({rel: ((lambda b: (lambda dest: dest.write_bytes(b)))(body), None)}, None, {'kind': 'test'})
            self.assertTrue(created)
            ids.append(set_id)
        main({'op': 'flip', 'to': ids[1]}, self.node)  # an old set is current: it always stays
        leftover = self.node.sets() / '.work-0123456789ab'
        leftover.mkdir()
        (leftover / 'half').write_bytes(b'x')
        plan = main({'op': 'prune-plan'}, self.node)
        self.assertEqual(plan['kept'], [ids[1]] + list(reversed(ids[3:])))
        self.assertEqual(sorted(r['id'] for r in plan['remove']), sorted([ids[0], ids[2], '.work-0123456789ab']))
        manifests = sum((self.node.sets() / i / 'manifest.json').stat().st_size for i in (ids[0], ids[2]))
        self.assertEqual(plan['freedBytes'], len(b'set 0') + len(b'set 2') + len(b'x') + manifests)  # files linked nowhere else
        with self.assertRaises(Refused) as caught:
            main({'op': 'prune', 'planSha256': '0' * 64}, self.node)
        self.assertEqual(str(caught.exception), 'PRUNE_PLAN_CHANGED')
        done = main({'op': 'prune', 'planSha256': plan['planSha256']}, self.node)
        self.assertEqual(sorted(done['removed']), sorted([ids[0], ids[2], '.work-0123456789ab']))
        self.assertEqual(sorted(p.name for p in self.node.sets().iterdir()), sorted([ids[1]] + ids[3:]))
        self.node.verify(ids[1])
        self.assertEqual(main({'op': 'prune-plan'}, self.node)['remove'], [])

    def test_a_set_that_was_live_recently_outlives_newer_sets_that_never_were(self):
        self.node.ensure_root()
        clock, ids = [1792560000], []
        self.node.clock = lambda: clock[0]
        rel = COMPANY + '/public/app.js'
        for n in range(7):
            clock[0] += 60
            ids.append(self.node.write_set({rel: ((lambda b: (lambda dest: dest.write_bytes(b)))(('s%d' % n).encode()), None)}, None, {'kind': 'test'})[0])
        clock[0] += 60
        main({'op': 'flip', 'to': ids[0]}, self.node)  # rollback to the oldest set
        clock[0] += 60
        main({'op': 'flip', 'to': ids[6], 'from': ids[0]}, self.node)  # then a new set goes live
        plan = main({'op': 'prune-plan'}, self.node)
        self.assertIn(ids[0], plan['kept'])  # the set to roll back to is still there
        self.assertEqual([r['id'] for r in plan['remove']], [ids[1]])

    def test_files_linked_only_between_removed_sets_count_as_freed(self):
        self.node.ensure_root()
        clock = [1792560000]
        self.node.clock = lambda: clock[0]
        a, b = COMPANY + '/public/a.js', COMPANY + '/public/b.js'
        write = lambda body: (lambda dest: dest.write_bytes(body))
        first = self.node.write_set({a: (write(b'AAAA'), None), b: (write(b'B1'), None)}, None, {'kind': 'test'})[0]
        clock[0] += 60
        source = self.node.sets() / first / 'docs' / '마케팅' / '온라인마케팅지도' / 'engagement' / 'company' / 'public' / 'a.js'
        second = self.node.write_set({a: ((lambda dest: os.link(source, dest)), None), b: (write(b'B2'), None)}, None, {'kind': 'test'})[0]
        for n in range(5):  # no current set here: the five newest stay, the two old ones go
            clock[0] += 60
            self.node.write_set({a: (write(('new %d' % n).encode()), None)}, None, {'kind': 'test'})
        plan = main({'op': 'prune-plan'}, self.node)
        self.assertEqual(sorted(r['id'] for r in plan['remove']), sorted([first, second]))
        manifests = sum((self.node.sets() / i / 'manifest.json').stat().st_size for i in (first, second))
        self.assertEqual(plan['freedBytes'], len(b'AAAA') + len(b'B1') + len(b'B2') + manifests)

    def test_prune_plan_on_a_node_without_sets_is_empty_and_creates_nothing(self):
        plan = main({'op': 'prune-plan'}, self.node)
        self.assertEqual((plan['remove'], plan['kept']), ([], []))
        self.assertRegex(plan['planSha256'], '^[a-f0-9]{64}$')
        self.assertEqual(main({'op': 'prune', 'planSha256': plan['planSha256']}, self.node)['removed'], [])
        self.assertFalse(self.node.root.exists())
        for bad in ({'op': 'prune'}, {'op': 'prune', 'planSha256': 'x'}):
            with self.assertRaises(Refused) as caught:
                main(bad, self.node)
            self.assertEqual(str(caught.exception), 'PRUNE_PLAN_REQUIRED')
        with self.assertRaises(Refused) as caught:
            main({'op': 'prune-plan', 'keep': 0}, self.node)
        self.assertEqual(str(caught.exception), 'PRUNE_KEEP')


if __name__ == '__main__':
    unittest.main()
