import importlib.util, io, os, pathlib, sqlite3, struct, subprocess, sys, tempfile, time, unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('free_space_node', pathlib.Path(__file__).with_name('free-space-node.py'))
node = importlib.util.module_from_spec(spec)
spec.loader.exec_module(node)
REAL_OPEN = open

GOOD = {'locksHeld': [], 'busyServices': [], 'disk': {'data': {'free': 30 << 30, 'total': 50 << 30}, 'docker': None},
        'mem': {'MemAvailable': 2 << 30}, 'backupTimer': {}, 'lastBackup': {'result': 'success', 'endedAt': None}}
HEALTHY = {'name': 'synk-company-company-1', 'running': True, 'health': 'healthy'}


def facts(**change):
    out = {**GOOD, 'lastBackup': {'result': 'success', 'endedAt': int(time.time()) - 3600}}
    out.update(change)
    return out


def done(stdout='', code=0):
    return subprocess.CompletedProcess([], code, stdout, '')


class Locks(unittest.TestCase):
    def stat(self, path, follow_symlinks=False):
        return SimpleNamespace(st_dev=(8 << 8) | 1, st_ino={'/run/lock/synk-ha-deploy.lock': 111, '/var/lib/synk-company-ops/operations.lock': 222}[path])

    def read(self, text):
        return patch('builtins.open', lambda path, *a, **k: io.StringIO(text) if path == '/proc/locks' else REAL_OPEN(path, *a, **k))

    def run_with(self, text):
        with patch.object(node.os, 'stat', self.stat), patch.object(node.os, 'major', lambda d: d >> 8, create=True), \
                patch.object(node.os, 'minor', lambda d: d & 0xff, create=True), self.read(text):
            return node.held_locks()

    def test_reads_proc_locks_by_device_and_inode(self):
        self.assertEqual(self.run_with('1: FLOCK  ADVISORY  WRITE 4242 08:01:111 0 EOF\n2: POSIX  ADVISORY  READ 99 08:01:999 0 EOF\n'), ['synk-ha-deploy.lock'])
        self.assertEqual(self.run_with('1: FLOCK  ADVISORY  WRITE 4242 08:02:111 0 EOF\n'), [], 'same inode on another device is not ours')
        self.assertEqual(self.run_with(''), [])

    def test_unreadable_proc_locks_is_unknown(self):
        def boom(path, *a, **k):
            raise PermissionError(path)
        with patch.object(node.os, 'stat', self.stat), patch.object(node.os, 'major', lambda d: d >> 8, create=True), \
                patch.object(node.os, 'minor', lambda d: d & 0xff, create=True), patch('builtins.open', boom):
            self.assertIsNone(node.held_locks())


class Services(unittest.TestCase):
    def test_busy_names_only(self):
        listing = 'synk-company-health.service loaded active running x\nsynk-company-backup.service loaded activating start x\nsynk-ha-node.service loaded active running x\n'
        with patch.object(node, 'sh', lambda *a, **k: done(listing)):
            self.assertEqual(node.busy_services(), ['synk-company-backup.service'])

    def test_systemctl_failure_is_unknown(self):
        with patch.object(node, 'sh', lambda *a, **k: done('', 1)):
            self.assertIsNone(node.busy_services())

    def test_last_backup_reads_unix_timestamp(self):
        with patch.object(node, 'sh', lambda *a, **k: done('Result=success\nExecMainExitTimestamp=@1793040792\n')):
            self.assertEqual(node.last_backup(), {'result': 'success', 'endedAt': 1793040792})
        with patch.object(node, 'sh', lambda *a, **k: done('Result=success\nExecMainExitTimestamp=\n')):
            self.assertIsNone(node.last_backup()['endedAt'])


class Scanner(unittest.TestCase):
    def test_string_end_counts_backslashes(self):
        self.assertEqual(node.string_end(b'ab\\\\"x', 0), 4, 'escaped backslash, then the closing quote')
        self.assertEqual(node.string_end(b'ab\\"cd"', 0), 6, 'an escaped quote does not close the value')
        self.assertEqual(node.string_end(b'abc', 0), -1)

    def drafts(self, buf, live):
        return node.count(buf, [(0, len(buf))], set(), set(live))

    def test_closed_drafts_compare_exactly_whatever_their_length(self):
        short = self.drafts(b'x"replyDraft":"call me now","y', [])
        self.assertEqual((short['draftResidue'], short['draftShort']), (1, 0), 'a short complete draft is residue, not undecided')
        prefix = self.drafts(b'x"replyDraft":"hello world","y', [b'hello world and more'])
        self.assertEqual(prefix['draftResidue'], 1, 'an old draft that is only a prefix of the live one is residue')
        escaped = self.drafts(b'x"replyDraft":"abcdefghijkl\\\\","y', [b'abcdefghijkl\\\\'])
        self.assertEqual((escaped['draftLive'], escaped['draftResidue']), (1, 0))
        empty = self.drafts(b'x"replyDraft":"","y', [])
        self.assertEqual((empty['draftResidue'], empty['draftShort']), (0, 0))

    def test_cut_drafts_compare_by_prefix_and_short_ones_stay_undecided(self):
        cut = self.drafts(b'x"replyDraft":"hello world this is long', [b'hello world this is long and more'])
        self.assertEqual((cut['draftLive'], cut['draftResidue']), (1, 0))
        tiny = self.drafts(b'x"replyDraft":"short', [])
        self.assertEqual((tiny['draftShort'], tiny['draftResidue']), (1, 0))

    def test_live_payload_in_a_free_region_is_counted_as_live(self):
        buf = b'..."payload":"' + b'A' * 30
        got = node.count(buf, [(0, len(buf))], {b'A' * 24}, set())
        self.assertEqual((got['payloadLive'], got['payloadResidue']), (1, 0))
        other = node.count(buf, [(0, len(buf))], {b'B' * 24}, set())
        self.assertEqual(other['payloadResidue'], 1)

    def test_wal_regions_follow_frames(self):
        head = struct.pack('>IIII', 0x377f0682, 3007000, 512, 0) + bytes(16)
        frames = b''.join(struct.pack('>II', pgno, 0) + bytes(16) + bytes([pgno]) * 512 for pgno in (7, 8))
        self.assertEqual(node.wal_regions(head + frames + b'torn'), [(56, 568, 7), (592, 1104, 8)])
        self.assertEqual(node.wal_tail(head + frames + b'torn'), [(1104, 1108)], 'the torn tail is read on its own')
        self.assertEqual(node.wal_tail(head + frames), [])
        self.assertEqual(node.wal_regions(b'not a wal file at all, just bytes'), [(0, 33, 0)])
        self.assertEqual(node.wal_tail(b'not a wal file at all, just bytes'), [])
        tail = head + struct.pack('>II', 9, 0) + bytes(16) + b'"replyDraft":"deleted draft text"'
        got = node.count(tail, node.wal_tail(tail), set(), set())
        self.assertEqual((got['markedRegions'], got['draftResidue']), (1, 1), 'a draft in a half-written last frame is seen')

    def test_closed_drafts_longer_than_a_few_kilobytes_still_compare_exactly(self):
        old = b'A' * 4001
        got = self.drafts(b'x"replyDraft":"' + old + b'","y', [old + b'B'])
        self.assertEqual((got['draftResidue'], got['draftLive']), (1, 0))

    def test_values_that_change_while_reading_are_reported(self):
        import sqlite3, tempfile, os
        folder = tempfile.mkdtemp()
        path = os.path.join(folder, 'company.sqlite')
        con = sqlite3.connect(path)
        con.execute('CREATE TABLE documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id))')
        con.execute("INSERT INTO documents VALUES ('websiteInquiries','a','{\"payload\":\"AAAAAAAAAAAAAAAAAAAAAAAAAA\"}')")
        con.commit()
        con.close()
        calls = []

        def flipping(con):
            calls.append(1)
            return ({b'A' * 24}, set()) if len(calls) % 2 else (set(), set())
        with patch.object(node, 'live_values', flipping), patch.object(node.time, 'sleep', lambda s: None):
            got = node.scan(path, local=True)
        self.assertEqual((got['residue']['attempts'], got['residue']['changedDuringScan'], len(calls)), (5, True, 10))
        steady = node.scan(path, local=True)
        self.assertEqual((steady['residue']['attempts'], steady['residue']['changedDuringScan']), (1, False))
        # 산 값은 그대로여도 읽는 사이 파일이 바뀌면(다른 쓰기의 커밋·체크포인트) 조용한 한 번이 아니다.
        real_stat, ticks = node.os.stat, [0]

        def moving(target, *a, **k):
            st = real_stat(target, *a, **k)
            if str(target) == path:
                ticks[0] += 1
                return SimpleNamespace(st_size=st.st_size, st_mtime_ns=ticks[0], st_mode=st.st_mode)
            return st
        with patch.object(node.os, 'stat', moving), patch.object(node.time, 'sleep', lambda s: None):
            busy = node.scan(path, local=True)
        self.assertEqual((busy['residue']['attempts'], busy['residue']['changedDuringScan']), (5, True))
        # 파일 크기·시각과 산 값이 그대로여도, 앞 스냅숏 뒤에 다른 연결의 커밋이 공개되면(다른 종류 줄) data_version이 잡는다.
        real_read, writes = node.read_files, [0]

        def commit_meanwhile(paths):
            writes[0] += 1
            other = sqlite3.connect(path)
            other.execute("INSERT INTO documents VALUES ('audit', ?, '{}')", ('w%d' % writes[0],))
            other.commit()
            other.close()
            return real_read(paths)
        with patch.object(node, 'read_files', commit_meanwhile), patch.object(node, 'file_marks', lambda db: ['same']), \
                patch.object(node.time, 'sleep', lambda s: None):
            raced = node.scan(path, local=True)
        self.assertEqual((raced['residue']['attempts'], raced['residue']['changedDuringScan'], writes[0]), (5, True, 5))

    def test_an_overflowing_live_draft_is_read_only_up_to_its_local_part(self):
        # 4096바이트 테이블 잎 페이지(2쪽)에 칸 하나: 본문 4089바이트라 이 페이지에는 489바이트만, 뒤에 넘침 페이지 번호 4바이트.
        live_text = ('live draft ' * 400).encode()
        local = (b'{"id":"L","replyDraft":"' + live_text)[:489]
        cell = bytes([0x9f, 0x79, 0x01]) + local + struct.pack('>I', 9)
        start = 4096 - len(cell)
        page = bytearray(4096)
        page[0] = 13
        page[1:8] = struct.pack('>HHHB', 0, 1, start, 0)
        page[8:10] = struct.pack('>H', start)
        page[start:] = cell
        buf = bytes(page)
        with_cells = node.count(buf, [(0, 4096, 2)], set(), {live_text}, usable=4096)
        self.assertEqual((with_cells['draftLive'], with_cells['draftResidue']), (1, 0))
        without = node.count(buf, [(0, 4096, 2)], set(), {live_text})
        self.assertEqual(without['draftResidue'], 1, 'without the cell layout the overflow page number is glued on')


class OwnerView(unittest.TestCase):
    """운영 DB 폴더의 위가 root 전용이라, 재는 자식은 권한을 낮추기 전에 자기만의 마운트 이름공간에서 DB 폴더를 /mnt에 다시 붙인다.
    붙이기는 그 이름공간의 전파가 private이 된 것을 본 뒤에만 한다(아니면 호스트 마운트 표로 퍼진다)."""

    DB = '/srv/synk/recovery-final-20261008T133704Z/prepared/company/company.sqlite'

    def view(self, codes=None, still=(), unshare_error=None):
        calls = []

        def fake_sh(args, **kw):
            calls.append(args)
            return done('', (codes or {}).get(args[1], 0))

        def fake_unshare():
            calls.append('unshare')
            if unshare_error:
                raise unshare_error

        def fake_still():
            calls.append('still')
            return None if still is None else list(still)
        with patch.object(node, 'sh', fake_sh), patch.object(node, 'unshare_mounts', fake_unshare), patch.object(node, 'shared_mounts', fake_still):
            try:
                return node.owner_view(self.DB), calls
            except RuntimeError as error:
                return str(error), calls

    def test_binds_the_folder_only_after_the_namespace_is_private(self):
        got, calls = self.view()
        self.assertEqual(got, '/mnt/company.sqlite')
        self.assertEqual(calls, ['unshare', ['mount', '--make-rprivate', '/'], 'still',
                                 ['mount', '--bind', '/srv/synk/recovery-final-20261008T133704Z/prepared/company', '/mnt']])

    def test_stops_before_binding_unless_propagation_is_private(self):
        cases = [(dict(codes={'--make-rprivate': 1}), 'MOUNT_PRIVATE_FAILED'),
                 (dict(still=['/']), 'MOUNT_STILL_SHARED'),
                 (dict(still=['/mnt']), 'MOUNT_STILL_SHARED'),
                 (dict(still=None), 'MOUNT_STILL_SHARED')]
        for kwargs, code in cases:
            with self.subTest(code=code, kwargs=kwargs):
                got, calls = self.view(**kwargs)
                self.assertEqual(got, code)
                self.assertFalse(any(isinstance(c, list) and '--bind' in c for c in calls), 'nothing is bound')
        got, calls = self.view(codes={'--bind': 32})
        self.assertEqual(got, 'VIEW_BIND_FAILED')
        with self.assertRaises(PermissionError):
            self.view(unshare_error=PermissionError(1, 'Operation not permitted'))

    def test_lists_every_mount_that_still_propagates(self):
        def read(text):
            return patch('builtins.open', lambda path, *a, **k: io.StringIO(text) if path == '/proc/self/mountinfo' else REAL_OPEN(path, *a, **k))
        with read('27 1 8:1 / / rw,relatime shared:1 - ext4 /dev/sda1 rw\n22 27 0:21 / /proc rw shared:12 - proc proc rw\n'
                  '40 27 8:17 / /mnt rw master:7 - ext4 /dev/sdb1 rw\n'):
            self.assertEqual(node.shared_mounts(), ['/', '/proc', '/mnt'])
        with read('27 1 8:1 / / rw,relatime - ext4 /dev/sda1 rw\n40 27 8:17 / /mnt rw shared:9 - ext4 /dev/sdb1 rw\n'):
            self.assertEqual(node.shared_mounts(), ['/mnt'], 'a separately mounted /mnt is checked too, not only /')
        with read('27 1 8:1 / / rw,relatime - ext4 /dev/sda1 rw\n22 27 0:21 / /proc rw - proc proc rw\n'):
            self.assertEqual(node.shared_mounts(), [], 'all private: no optional fields')
        with read(''):
            self.assertIsNone(node.shared_mounts())
        with read('not a mountinfo line\n'):
            self.assertIsNone(node.shared_mounts(), 'nothing readable is unknown, not private')

    def child(self, view_result):
        """as_owner의 자식 갈래를 fork 없이 돈다(os.fork → 0, os._exit에서 멈춤) — 무엇을 어떤 차례로 하는지와 파이프로 보낸 결과.
        view_result가 예외면 owner_view가 그 예외를 낸다."""
        calls, exits = [], []
        read_end, write_end = os.pipe()
        real_close = os.close

        class Exited(Exception):
            pass

        def leave(code):
            exits.append(code)
            raise Exited()

        def view(db):
            calls.append(('view', db))
            if isinstance(view_result, BaseException):
                raise view_result
            return view_result

        def scan(path):
            calls.append(('scan', path))
            return {'scanned': path}

        def record(name):
            return lambda *a: calls.append((name,) + a)
        # 자식이 닫는 읽는 쪽은 이 시험이 읽어야 하므로 닫지 않고 둔다(진짜 fork에서는 부모의 사본이 따로 있다).
        with patch.object(node.os, 'fork', lambda: 0, create=True), patch.object(node.os, 'pipe', lambda: (read_end, write_end)), \
                patch.object(node.os, 'close', lambda fd: None if fd == read_end else real_close(fd)), \
                patch.object(node.os, 'stat', lambda path: SimpleNamespace(st_uid=1000, st_gid=1000)), patch.object(node, 'owner_view', view), \
                patch.object(node.os, 'setgroups', record('setgroups'), create=True), patch.object(node.os, 'setgid', record('setgid'), create=True), \
                patch.object(node.os, 'setuid', record('setuid'), create=True), patch.object(node.os, '_exit', leave):
            with self.assertRaises(Exited):
                node.as_owner(scan, self.DB)
        os.close(write_end)
        out = b''
        while True:
            chunk = os.read(read_end, 1 << 16)
            if not chunk:
                break
            out += chunk
        os.close(read_end)
        return calls, exits, node.json.loads(out)

    def test_the_child_binds_while_root_then_drops_and_scans_the_bound_path(self):
        calls, exits, sent = self.child('/mnt/company.sqlite')
        self.assertEqual(calls, [('view', self.DB), ('setgroups', []), ('setgid', 1000), ('setuid', 1000), ('scan', '/mnt/company.sqlite')])
        self.assertEqual((exits, sent), ([0], {'scanned': '/mnt/company.sqlite'}))

    def test_a_failed_view_reports_its_code_and_never_drops_or_scans(self):
        calls, exits, sent = self.child(RuntimeError('MOUNT_STILL_SHARED'))
        self.assertEqual(calls, [('view', self.DB)])
        self.assertEqual((exits, sent), ([1], {'error': 'SCAN_FAILED', 'type': 'RuntimeError', 'code': 'MOUNT_STILL_SHARED'}))
        calls, exits, sent = self.child(PermissionError(1, 'Operation not permitted'))
        self.assertEqual((calls, sent['code']), ([('view', self.DB)], 'EPERM'))
        self.assertIsNone(node.failure_code(RuntimeError('a sentence with a /path')), 'only our own codes pass through')
        self.assertIsNone(node.failure_code(ValueError('x')))

    @unittest.skipUnless(sys.platform.startswith('linux') and os.geteuid() != 0, 'Linux, root가 아닌 사용자')
    def test_why_an_open_folder_is_not_enough_sqlite_walks_the_full_path(self):
        # 위 마디를 닫은(0) 폴더: 원래 경로로는 아무것도 안 보이고, 폴더를 열어 두고 fchdir하면 파이썬 파일 읽기는 되지만
        # SQLite는 getcwd로 절대 경로를 만들어 마디마다 lstat해 열지 못한다 — 그래서 다시 붙이기(owner_view)를 쓴다.
        top = tempfile.mkdtemp()
        closed = os.path.join(top, 'closed')
        folder = os.path.join(closed, 'company')
        os.makedirs(folder)
        db = os.path.join(folder, 'company.sqlite')
        app = sqlite3.connect(db)
        app.execute('PRAGMA journal_mode=WAL')
        app.execute('CREATE TABLE documents (kind TEXT, id TEXT, body TEXT)')
        app.commit()
        fd, here = os.open(folder, os.O_RDONLY), os.getcwd()
        os.chmod(closed, 0)
        try:
            self.assertFalse(os.path.exists(db + '-wal'))
            os.fchdir(fd)
            self.assertTrue(os.path.exists('company.sqlite-wal') and os.path.exists('company.sqlite-shm'))
            with self.assertRaises(sqlite3.OperationalError):
                sqlite3.connect('file:company.sqlite?mode=ro', uri=True).execute('PRAGMA page_count').fetchone()
        finally:
            os.chdir(here)
            os.chmod(closed, 0o700)
            os.close(fd)
            app.close()

    def test_without_fork_the_scan_reads_the_given_path(self):
        with patch.object(node, 'os', SimpleNamespace(path=os.path)):
            self.assertEqual(node.as_owner(lambda path: {'path': path}, self.DB), {'path': self.DB})


class FakePopen:
    """vacuum.mjs 대신: READY 한 줄, 받은 답(GO/STOP)에 맞는 결과 한 줄."""

    def __init__(self, ready=True, child_mark=True):
        self.ready, self.child_mark, self.written, self.args, self.returncode = ready, child_mark, [], None, None
        self.stdin = SimpleNamespace(write=self.written.append, flush=lambda: None, close=lambda: None)
        self.stderr = io.StringIO('')

    def __call__(self, args, **kw):
        self.args = args
        self.stdout = self.lines()
        return self

    def lines(self):
        if not self.ready:
            yield '{"error":"WAL_BUSY_BEFORE"}\n'
            return
        yield '{"ready":true,"childMark":true}\n' if self.child_mark else '{"ready":true}\n'
        yield '{"quickCheck":"ok","walTruncated":true}\n' if self.written == ['GO\n'] else '{"error":"STOPPED"}\n'

    def wait(self, timeout=None):
        self.returncode = 0 if self.written == ['GO\n'] else 5 if self.written else 2
        return self.returncode

    def kill(self):
        pass


class VacuumGates(unittest.TestCase):
    """막는 조건이면 docker exec(=DB 다시 쓰기)에 닿지 않는다. 닿아도 VACUUM 바로 앞에서 다시 보고 GO나 STOP을 보낸다."""

    SCANNED = {'pragma': {'page_count': 7030, 'page_size': 4096}}

    def attempt(self, host, container=HEALTHY, db_bytes=29 << 20, script='// vacuum', quiet=(None, ['deploy-fd', 'ops-fd']), ready=True, scanned=None, left=(),
                child_mark=True):
        fake, self.released, self.order = FakePopen(ready, child_mark), [], []

        def release(held):
            self.released.append(held)
            self.order.append('release')

        def stop(token, wait_s=30, step_s=0.2, known=None):
            self.order.append(('stop', token, wait_s, known))
            return dict(left) if wait_s is not None else {}
        def moment():
            self.order.append('quiet')
            return quiet
        with patch.object(node, 'VACUUM_JS', script), patch.object(node, 'host_facts', lambda db: host), \
                patch.object(node, 'size', lambda path: db_bytes), patch.object(node, 'as_owner', lambda fn, db: scanned or self.SCANNED), \
                patch.object(node, 'take_quiet_moment', moment), patch.object(node, 'release_locks', release), \
                patch.object(node, 'stop_inside', stop), patch.object(node.signal, 'signal', lambda *a: None), \
                patch.object(node.subprocess, 'Popen', fake):
            return node.vacuum(container, '/srv/company/company.sqlite'), fake

    def test_each_gate_stops_before_docker(self):
        old = int(time.time()) - 27 * 3600
        cases = [
            (dict(script=None, host=facts()), 'VACUUM_SCRIPT_MISSING'),
            (dict(host=facts(locksHeld=['synk-ha-deploy.lock'])), 'RELEASE_LOCK_HELD'),
            (dict(host=facts(locksHeld=None)), 'RELEASE_LOCK_HELD'),
            (dict(host=facts(busyServices=['synk-company-backup.service'])), 'BACKGROUND_OPERATION_BUSY'),
            (dict(host=facts(busyServices=None)), 'BACKGROUND_OPERATION_BUSY'),
            (dict(host=facts(), db_bytes=121 << 20), 'TOO_LARGE_FOR_ONLINE_VACUUM'),
            (dict(host=facts(), db_bytes=20 << 20, scanned={'pragma': {'page_count': 40000, 'page_size': 4096}}), 'TOO_LARGE_FOR_ONLINE_VACUUM'),
            (dict(host=facts(lastBackup={'result': 'failed', 'endedAt': int(time.time())})), 'NO_RECENT_BACKUP'),
            (dict(host=facts(lastBackup={'result': 'success', 'endedAt': old})), 'NO_RECENT_BACKUP'),
            (dict(host=facts(lastBackup={'result': 'success', 'endedAt': None})), 'NO_RECENT_BACKUP'),
            (dict(host=facts(), container={**HEALTHY, 'health': 'starting'}), 'COMPANY_NOT_HEALTHY'),
            (dict(host=facts(), container={**HEALTHY, 'running': False}), 'COMPANY_NOT_HEALTHY'),
            (dict(host=facts(disk={'data': {'free': 64 << 20}})), 'SPACE_LOW'),
            (dict(host=facts(mem={'MemAvailable': 100 << 20})), 'SPACE_LOW'),
            (dict(host=facts(), scanned={'error': 'WAL_SIDECARS_MISSING'}), 'SCAN_BEFORE_FAILED'),
        ]
        for kwargs, code in cases:
            with self.subTest(code=code, kwargs=kwargs):
                result, fake = self.attempt(**kwargs)
                self.assertEqual(result.get('error'), code)
                self.assertIsNone(fake.args, 'no docker exec when a gate stops')

    def test_go_only_after_the_release_check_right_before_vacuum(self):
        result, fake = self.attempt(host=facts())
        self.assertNotIn('error', result)
        self.assertEqual(fake.args[:-1], ['docker', 'exec', '-i', '-u', 'node', '-e', 'SYNK_FREE_SPACE_MAX_BYTES=' + str(120 << 20), 'synk-company-company-1',
                                          'node', '--input-type=module', '-e', '// vacuum'])
        self.assertRegex(fake.args[-1], r'^synk-free-space-vacuum-[0-9a-f]{32}$', 'a one-off mark to find the job inside the container again')
        self.assertEqual(self.order, ['quiet', ('stop', fake.args[-1], 30, None), 'release'], 'the job inside is seen gone before the locks are let go')
        self.assertEqual(fake.written, ['GO\n'])
        self.assertEqual((result['vacuum']['exit'], result['vacuum']['stoppedBy'], result['vacuum']['walTruncated'], result['vacuum']['heldLocks']), (0, None, True, True))
        self.assertEqual(result['after'], self.SCANNED)
        self.assertEqual(self.released, [['deploy-fd', 'ops-fd']], 'the locks are let go only after the result came back')

    def test_stop_when_a_release_or_backup_starts_meanwhile(self):
        for code in ('RELEASE_LOCK_HELD', 'BACKGROUND_OPERATION_BUSY'):
            with self.subTest(code=code):
                result, fake = self.attempt(host=facts(), quiet=(code, None))
                self.assertEqual(fake.written, ['STOP\n'])
                self.assertEqual((result['vacuum']['stoppedBy'], result['vacuum']['exit'], result['vacuum']['heldLocks']), (code, 5, False))
                self.assertEqual(self.released, [None])

    def test_no_answer_without_a_ready_line(self):
        result, fake = self.attempt(host=facts(), ready=False)
        self.assertEqual(fake.written, [])
        self.assertEqual((result['vacuum']['error'], result['vacuum']['exit']), ('WAL_BUSY_BEFORE', 2))
        self.assertEqual(self.released, [None], 'nothing was held')

    def test_a_job_that_outlives_the_cli_keeps_the_locks_until_it_is_gone(self):
        # 넷째 GA1: 30초 뒤에도 남으면(D 상태) 기록만 하고 놓지 않는다 — 없어질 때까지 기다린 뒤에 놓는다.
        result, fake = self.attempt(host=facts(), left={4242: 77})
        self.assertEqual((result['vacuum']['error'], result['vacuum']['leftAfter30s']), ('VACUUM_OUTLIVED_CLI', 1))
        self.assertIsInstance(result['vacuum']['waitedS'], int)
        tok = fake.args[-1]
        self.assertEqual(self.order, ['quiet', ('stop', tok, 30, None), ('stop', tok, None, {4242: 77}), 'release'],
                         'the second stop waits without a deadline, following what the first one found, and only then the locks go')

    def test_no_go_unless_the_vacuum_child_carries_the_mark(self):
        # 다섯째 GA1: 실제 VACUUM을 하는 자식이 표식을 받지 못했으면 부모가 먼저 죽을 때 그 자식을 못 찾는다 — 잠금도 잡지 않고 STOP.
        result, fake = self.attempt(host=facts(), child_mark=False)
        self.assertEqual(fake.written, ['STOP\n'])
        self.assertEqual((result['vacuum']['stoppedBy'], result['vacuum']['heldLocks']), ('CHILD_NOT_MARKED', False))
        self.assertNotIn('quiet', self.order)


class InsideJob(unittest.TestCase):
    """docker CLI가 끝나도 컨테이너 안 작업은 남을 수 있어, 표식으로 호스트 /proc에서 그 작업과 자식을 찾는다(10-23 GPT 둘째 GA1)."""

    TOK = 'synk-free-space-vacuum-' + 'a' * 32

    def write_proc(self, root, pid, comm, state, ppid, argv, start=None):
        """stat 줄: pid (comm) 상태 ppid … 22번째 칸 starttime(기본 1000+pid)."""
        os.makedirs(os.path.join(root, str(pid)), exist_ok=True)
        fields = [state, str(ppid)] + ['0'] * 17 + [str(1000 + pid if start is None else start)] + ['0'] * 5
        with open(os.path.join(root, str(pid), 'stat'), 'wb') as f:
            f.write(f'{pid} ({comm}) {" ".join(fields)}'.encode())
        with open(os.path.join(root, str(pid), 'cmdline'), 'wb') as f:
            f.write(b'\0'.join(a.encode() for a in argv) + b'\0')

    def fake_proc(self, rows):
        root = tempfile.mkdtemp()
        for row in rows:
            self.write_proc(root, *row)
        os.makedirs(os.path.join(root, 'self'))
        return root

    def test_finds_the_marked_job_and_its_children_but_not_zombies_or_others(self):
        tok = 'synk-free-space-vacuum-' + 'a' * 32
        root = self.fake_proc([
            (100, 'docker', 'S', 50, ['docker', 'exec', '-i', 'synk-company-company-1', 'node', '-e', 'js', tok]),
            (200, 'node', 'S', 150, ['node', '--input-type=module', '-e', 'js', tok]),
            (201, 'node', 'R', 200, ['node', '-e', '(function child(){})()', '/data/company.sqlite', '1000']),
            (202, 'odd (name) x', 'S', 201, ['sh']),
            (210, 'node', 'Z', 200, []),
            (300, 'node', 'S', 1, ['node', 'server.mjs']),
            (301, 'node', 'S', 1, ['node', '-e', 'js', tok + 'x']),
        ])
        self.assertEqual(sorted(node.inside_processes(tok, proc=root)), [100, 200, 201, 202])
        self.assertEqual(node.inside_processes(tok, proc=root)[201], 1201, 'each pid comes with its start time')
        self.assertEqual(node.inside_processes('synk-free-space-vacuum-' + 'b' * 32, proc=root), {})

    def test_a_child_left_behind_by_its_dead_parent_is_still_followed(self):
        # 셋째 GA1: 부모(표식 200)가 먼저 죽고 자식 201(VACUUM 자식, I/O 대기)은 init(1)에게 넘어간다 — 표식으로는 다시 못 찾는다.
        root = self.fake_proc([(200, 'node', 'S', 150, ['node', '--input-type=module', '-e', 'js', self.TOK]),
                               (201, 'node', 'D', 200, ['node', '-e', '(function child(){})()', '/data/company.sqlite', '1000']),
                               (300, 'node', 'S', 1, ['node', 'server.mjs'])])
        hits, now, real = {}, [0.0], node.inside_processes

        def kill(pid, sig):
            hits[pid] = hits.get(pid, 0) + 1
            if pid == 200:
                import shutil
                shutil.rmtree(os.path.join(root, '200'))
                self.write_proc(root, 201, 'node', 'D', 1, ['node', '-e', '(function child(){})()', '/data/company.sqlite', '1000'])
            elif pid == 201 and hits[201] >= 3:  # I/O가 끝나야 사라진다
                import shutil
                shutil.rmtree(os.path.join(root, '201'))
        with patch.object(node, 'inside_processes', lambda token, known=None: real(token, known, proc=root)), patch.object(node.os, 'kill', kill), \
                patch.object(node.time, 'time', lambda: now[0]), patch.object(node.time, 'sleep', lambda s: now.__setitem__(0, now[0] + s)):
            self.assertEqual(node.stop_inside(self.TOK, wait_s=5), {})
        self.assertEqual((hits.get(200), hits.get(201)), (1, 3), 'the orphaned child is killed until it is gone')
        self.assertNotIn(300, hits, 'the app itself is never touched')

    def test_a_reused_pid_is_not_taken_for_ours(self):
        root = self.fake_proc([(201, 'node', 'S', 1, ['node', 'other.mjs'], 5555)])
        self.assertEqual(node.inside_processes(self.TOK, {201: 1201}, proc=root), {}, 'same pid, different start time: someone else')
        self.assertEqual(node.inside_processes(self.TOK, {201: 5555}, proc=root), {201: 5555})

    def test_stop_kills_until_gone_and_reports_what_is_left(self):
        rounds, killed, now = [{200: 1, 201: 2}, {201: 2}, {}], [], [0.0]
        with patch.object(node, 'inside_processes', lambda token, known=None: rounds.pop(0) if rounds else {}), \
                patch.object(node.os, 'kill', lambda pid, sig: killed.append(pid)), patch.object(node.time, 'time', lambda: now[0]), \
                patch.object(node.time, 'sleep', lambda s: now.__setitem__(0, now[0] + s)):
            self.assertEqual(node.stop_inside('t', wait_s=5), {})
        self.assertEqual(killed, [200, 201, 201])
        with patch.object(node, 'inside_processes', lambda token, known=None: {999: 1}), patch.object(node.os, 'kill', lambda pid, sig: None), \
                patch.object(node.time, 'time', lambda: now[0]), patch.object(node.time, 'sleep', lambda s: now.__setitem__(0, now[0] + s)):
            self.assertEqual(node.stop_inside('t', wait_s=1), {999: 1}, 'what is still there after the wait is reported')

    def test_without_a_deadline_it_waits_until_gone_following_what_was_found(self):
        seen, now = [], [0.0]

        def lookup(token, known=None):
            seen.append(dict(known or {}))
            return {7: 70} if len(seen) < 200 else {}  # 200회(≈ 200초) 남았다가 사라진다 — 기한이 있으면 30초에서 멈췄을 것
        with patch.object(node, 'inside_processes', lookup), patch.object(node.os, 'kill', lambda pid, sig: None), \
                patch.object(node.time, 'time', lambda: now[0]), patch.object(node.time, 'sleep', lambda s: now.__setitem__(0, now[0] + s)):
            self.assertEqual(node.stop_inside('t', wait_s=None, step_s=1, known={7: 70}), {})
        self.assertEqual((len(seen), seen[0]), (200, {7: 70}), 'it starts from what the first stop found')

    def test_fragment_bytes_between_cells_are_counted(self):
        # 셋째 GA2: 셀 사이 1~3바이트 조각은 gap·freeblock에 안 든다 — 페이지 머리 7번째 바이트의 합으로 센다.
        page = 512
        data = bytearray(page * 2)  # 1쪽은 b-tree가 아니게 두고 2쪽만 잎 페이지
        data[page] = 13
        data[page + 1:page + 7] = struct.pack('>HHH', 0, 0, page)
        data[page + 7] = 3
        free_pages, free_regions, in_page, fragments = node.free_and_inpage(bytes(data), page)
        self.assertEqual((fragments, len(in_page)), (3, 1))


class QuietMoment(unittest.TestCase):
    """READY 뒤: 남의 잠금·서비스가 없으면 잠금을 쥔 채 한 번 더 보고 GO(10-23 GPT GA1). 짧은 점검이면 다시 본다."""

    def run_moment(self, polls, holds, services_after=None):
        """polls: 회차마다 (held_locks, busy_services), holds: 회차마다 hold_release_locks가 낼 값."""
        polls, holds, calls, now = list(polls), list(holds), [], [0.0]

        def held():
            calls.append('look')
            return polls[0][0]

        def busy():
            if calls[-1] == 'look':  # 남의 잠금을 본 바로 다음 — 이 회차의 서비스
                calls.append('busy')
                return polls.pop(0)[1]
            return services_after.pop(0) if services_after else []  # 잠금을 쥔 뒤 한 번 더

        def hold():
            calls.append('hold')
            return holds.pop(0)

        def sleep(s):
            calls.append('sleep')
            now[0] += s
        with patch.object(node, 'held_locks', held), patch.object(node, 'busy_services', busy), patch.object(node, 'hold_release_locks', hold), \
                patch.object(node, 'release_locks', lambda h: calls.append(('release', h))), patch.object(node.time, 'time', lambda: now[0]), \
                patch.object(node.time, 'sleep', sleep):
            return node.take_quiet_moment(wait_s=2, step_s=0.5), calls

    def test_holds_at_once_when_quiet(self):
        got, calls = self.run_moment([([], [])], [['d', 'o']])
        self.assertEqual(got, (None, ['d', 'o']))
        self.assertEqual(calls, ['look', 'busy', 'hold'])

    def test_waits_out_a_short_check_then_holds(self):
        got, calls = self.run_moment([(['operations.lock'], []), (['operations.lock'], []), ([], [])], [['d', 'o']])
        self.assertEqual(got, (None, ['d', 'o']))
        self.assertEqual(calls.count('sleep'), 2)

    def test_gives_up_at_the_deadline_without_holding(self):
        got, calls = self.run_moment([(['synk-ha-deploy.lock'], [])] * 10, [])
        self.assertEqual(got, ('RELEASE_LOCK_HELD', None))
        self.assertNotIn('hold', calls)
        got, calls = self.run_moment([([], [])] * 10, [None] * 10)
        self.assertEqual(got, ('RELEASE_LOCK_HELD', None), 'locks that cannot be taken stop it too')

    def test_a_service_seen_after_holding_lets_the_locks_go(self):
        got, calls = self.run_moment([([], [])] * 10, [['d', 'o']] * 10, services_after=[['synk-company-backup.service']] * 10)
        self.assertEqual(got, ('BACKGROUND_OPERATION_BUSY', None))
        releases = [c for c in calls if isinstance(c, tuple)]
        self.assertEqual(len(releases), calls.count('hold'), 'every hold is let go again')
        self.assertTrue(releases and all(r == ('release', ['d', 'o']) for r in releases))

    @unittest.skipUnless(hasattr(os, 'fork') and sys.platform.startswith('linux'), 'flock — 리눅스')
    def test_real_locks_match_the_health_check_shape(self):
        import fcntl
        folder = tempfile.mkdtemp()
        deploy, ops = os.path.join(folder, 'synk-ha-deploy.lock'), os.path.join(folder, 'operations.lock')
        for path in (deploy, ops):
            open(path, 'w').close()
        with patch.object(node, 'RELEASE_LOCKS', (deploy, ops)):
            other = os.open(ops, os.O_RDONLY)
            fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertIsNone(node.hold_release_locks(), 'a running operation keeps it from holding')
            os.close(other)
            held = node.hold_release_locks()
            self.assertEqual(len(held), 2)
            probe = os.open(deploy, os.O_RDONLY)
            fcntl.flock(probe, fcntl.LOCK_SH | fcntl.LOCK_NB)  # 상태 점검의 공유 잠금은 함께 잡힌다
            fcntl.flock(probe, fcntl.LOCK_UN)
            with self.assertRaises(OSError):
                fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)  # 릴리스 PREPARE의 배타 잠금은 못 잡는다
            os.close(probe)
            probe = os.open(ops, os.O_RDONLY)
            with self.assertRaises(OSError):
                fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)  # 백업·점검의 운영 잠금도
            node.release_locks(held)
            fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
            os.close(probe)
        with patch.object(node, 'RELEASE_LOCKS', (os.path.join(folder, 'missing.lock'), ops)):
            self.assertIsNone(node.hold_release_locks(), 'it does not create lock files')


if __name__ == '__main__':
    unittest.main()
