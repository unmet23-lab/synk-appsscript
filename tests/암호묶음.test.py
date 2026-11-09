# python -X utf8 -B tests/암호묶음.test.py — 복원 묶음(tools/복원/암호묶음.py)의 왕복 · 증분 · 끊긴 뒤 이어 하기를 가짜 드라이브로 본다. 진짜 드라이브는 건드리지 않는다.
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TOOL = REPO / 'tools' / '복원'
sys.path.insert(0, str(TOOL))
spec = importlib.util.spec_from_file_location('암호묶음', TOOL / '암호묶음.py')
M = importlib.util.module_from_spec(spec)
sys.modules['암호묶음'] = M
spec.loader.exec_module(M)
PASS = '시험용 암호 — 진짜 아님 12345'


class FakeDest:
    needs_confirm = False

    def __init__(self, root):
        self.root = Path(root)
        self.fail = None
        self.puts = []
        self.answer = True

    def put(self, path, folder, name=None):
        if self.fail:
            raise RuntimeError(self.fail)
        target = self.root / folder / (name or Path(path).name)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        self.puts.append(target.name)
        return 'id-' + target.name

    def replace(self, path, folder, name):
        return self.put(path, folder, name)

    def listing(self, folder):
        base = self.root / folder
        return sorted(p.name for p in base.iterdir()) if base.is_dir() else []

    def remove(self, folder, name):
        (self.root / folder / name).unlink()

    def confirm(self, folder, name, md5, size):
        return self.answer


class Slow(FakeDest):
    """G:처럼 복사와 올라감이 따로인 목적지."""
    needs_confirm = True

    def __init__(self, root):
        super().__init__(root)
        self.answer = False


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keydir = Path(tempfile.mkdtemp(prefix='복원열쇠시험'))
        script = ("const a=require(process.argv[1]);const fs=require('fs');const k=a.makeKeys(process.argv[2]);"
                  "fs.writeFileSync(process.argv[3]+'/공개키.pem',k.pubPem);fs.writeFileSync(process.argv[3]+'/비밀키_잠금.json',JSON.stringify(k.locked));")
        subprocess.run(['node', '-e', script, str(TOOL / '암호.js'), PASS, str(cls.keydir)], check=True)
        cls.public = cls.keydir / '공개키.pem'
        cls.passfile = cls.keydir / 'pass.txt'
        cls.passfile.write_text(PASS, encoding='utf-8')

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.keydir, ignore_errors=True)

    def setUp(self):
        self.base = Path(tempfile.mkdtemp(prefix='복원묶음시험'))
        self.home = self.base / 'home'
        self.home.mkdir()
        os.environ['SYNK_복원_임시'] = str(self.base / 'temp')
        self.a, self.b = FakeDest(self.base / 'a'), FakeDest(self.base / 'b')
        self.ctx = M.Context(home=self.home, temp=M.Temp(self.home), unmet23=self.a, yuhbs=self.b, public_key=self.public, log=lambda *_: None, sleep=lambda *_: None)

    def tearDown(self):
        os.environ.pop('SYNK_복원_임시', None)
        shutil.rmtree(self.base, ignore_errors=True)

    def write(self, rel, text='내용'):
        p = self.home / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding='utf-8')
        return p

    def restore(self, folder, home2):
        done = subprocess.run(['node', str(TOOL / '복원풀기.cjs'), '--집', str(home2), '--폴더', str(folder), '--비밀키', str(self.keydir / '비밀키_잠금.json'),
                               '--암호파일', str(self.passfile), '--임시', str(self.base / 'unpack'), '--json'], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(done.returncode, 0, done.stderr)
        return json.loads(done.stdout.strip().splitlines()[-1])


class WholeBundle(Base):
    def setUp(self):
        super().setUp()
        self.keys = self.home / '.synk-backup-key'
        self.keys.mkdir()
        shutil.copyfile(self.public, self.keys / '공개키.pem')
        self.write('.synk-backup-key/비밀키_잠금.json', '{"잠김":1}')

    def bundle(self):
        return M.Bundle('열쇠', 'whole', ('unmet23', '77yuhbs'), keep=2, roots=[M.Root(self.home / 'SYNK_보안')],
                        generated=lambda h: {'.synk-복원/환경변수.json': b'{"A":1}'})

    def enc_names(self, dest):
        return [n for n in dest.listing('열쇠') if n.endswith('.enc')]

    def test_round_trip_restores_same_bytes_and_generated(self):
        self.write('SYNK_보안/클로드키.txt', 'sk-시험값')
        self.write('SYNK_보안/폴더/한글 이름.json', '{"a":1}')
        report = M.run_bundle(self.ctx, self.bundle())
        self.assertEqual(report['issues'], [])
        self.assertEqual(report['made'], 1)
        home2 = self.base / 'home2'
        home2.mkdir()
        result = self.restore(self.base / 'a' / '열쇠', home2)
        self.assertEqual(result['풀림'], 3)
        self.assertEqual((home2 / 'SYNK_보안/클로드키.txt').read_text(encoding='utf-8'), 'sk-시험값')
        self.assertEqual((home2 / 'SYNK_보안/폴더/한글 이름.json').read_text(encoding='utf-8'), '{"a":1}')
        self.assertTrue((home2 / '.synk-복원/환경변수.json').exists())
        self.assertFalse((home2 / '.synk-복원/조각목록').exists())

    def test_ciphertext_has_no_plaintext(self):
        self.write('SYNK_보안/비밀.txt', 'THIS-IS-THE-SECRET-VALUE-0123456789')
        M.run_bundle(self.ctx, self.bundle())
        part = next(p for p in (self.base / 'b' / '열쇠').iterdir() if p.name.endswith('.enc'))
        raw = part.read_bytes()
        self.assertNotIn(b'THIS-IS-THE-SECRET-VALUE', raw)
        self.assertNotIn('SYNK_보안'.encode(), raw)

    def test_unchanged_makes_nothing_and_change_makes_new_version(self):
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        before = len(self.a.puts)
        again = M.run_bundle(self.ctx, self.bundle())
        self.assertTrue(again['unchanged'])
        self.assertEqual(len(self.a.puts), before)  # 조각도 열쇠 파일도 다시 안 올린다
        time.sleep(1.1)
        self.write('SYNK_보안/a.txt', '22')
        self.assertEqual(M.run_bundle(self.ctx, self.bundle())['made'], 1)
        self.assertEqual(len(self.enc_names(self.a)), 2)

    def test_key_files_keep_versioned_copy_and_republish_when_changed(self):
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        key_id = M.key_id_of((self.keys / '공개키.pem').read_text(encoding='utf-8'))
        for dest in (self.a, self.b):
            names = dest.listing('열쇠')
            for name in ('비밀키_잠금.json', '공개키.pem', f'비밀키_잠금-{key_id}.json'):
                self.assertIn(name, names)
        before = len(self.b.puts)
        self.write('.synk-backup-key/비밀키_잠금.json', '{"잠김":2}')
        M.run_bundle(self.ctx, self.bundle())
        self.assertEqual(len(self.b.puts), before + 2)  # 이름 없는 판과 번호 붙은 판

    def test_missing_key_file_is_an_issue(self):
        (self.keys / '공개키.pem').unlink()
        self.write('SYNK_보안/a.txt', '1')
        self.assertIn('KEY_FILE_MISSING', M.run_bundle(self.ctx, self.bundle())['issues'])

    def test_prune_keeps_only_recent_and_never_touches_other_names(self):
        (self.base / 'a' / '열쇠').mkdir(parents=True)
        for i in range(4):
            (self.base / 'a' / '열쇠' / f'열쇠-2026110{i}T000000Z-001.tar.zst.enc').write_bytes(b'x')
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        names = self.a.listing('열쇠')
        self.assertIn('비밀키_잠금.json', names)
        self.assertEqual(len(self.enc_names(self.a)), 2)
        self.assertNotIn('열쇠-20261100T000000Z-001.tar.zst.enc', names)

    def test_too_big_whole_bundle_stops(self):
        big = self.write('SYNK_보안/큰.bin', 'x')
        with open(big, 'wb') as f:
            f.truncate(M.KEYS_RAW_LIMIT + 1)
        report = M.run_bundle(self.ctx, self.bundle())
        self.assertIn('BUNDLE_WHOLE_TOO_BIG', report['issues'])
        self.assertEqual(self.a.puts, [])

    def test_incomplete_whole_keeps_old_versions_and_retries(self):
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        first = self.enc_names(self.a)
        real_open = M.open_retry

        def fail_one(path, *a, **k):
            if Path(path).name == 'a.txt':
                raise OSError('잠김')
            return real_open(path, *a, **k)
        M.open_retry = fail_one
        try:
            time.sleep(1.1)
            self.write('SYNK_보안/a.txt', '22')
            self.write('SYNK_보안/b.txt', '3')
            report = M.run_bundle(self.ctx, self.bundle())
        finally:
            M.open_retry = real_open
        self.assertIn('WHOLE_BUNDLE_INCOMPLETE', report['issues'])
        self.assertTrue(set(first) <= set(self.enc_names(self.a)))  # 온전하지 않은 판 때문에 옛 판을 지우지 않는다
        again = M.run_bundle(self.ctx, self.bundle())
        self.assertFalse(again['unchanged'])  # 지문을 안 남겨 다시 만든다
        self.assertEqual(again['issues'], [])


class Waiting(Base):
    """G: 복사는 올라간 것이 아니다(11-09 GPT 설계 검토)."""

    def setUp(self):
        super().setUp()
        self.ctx.unmet23 = self.slow = Slow(self.base / 'a')
        self.write('projects/a.jsonl', '내용')
        self.bundle = M.Bundle('비공개문서', 'incremental', ('unmet23', '77yuhbs'), roots=[M.Root(self.home / 'projects')])

    def temp_parts(self):
        return list((self.base / 'temp' / '비공개문서').glob('*.enc'))

    def test_copied_but_unverified_keeps_part_and_state(self):
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['issues'], [])
        self.assertEqual(report['waiting'], 1)
        self.assertEqual(M.Ledger(self.home, '비공개문서').files, {})
        self.assertEqual(len(self.temp_parts()), 1)

    def test_verified_later_finishes_without_recopying(self):
        M.run_bundle(self.ctx, self.bundle)
        puts = len(self.slow.puts), len(self.b.puts)
        self.slow.answer = True
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['issues'], [])
        self.assertEqual((len(self.slow.puts), len(self.b.puts)), puts)
        self.assertEqual(self.temp_parts(), [])
        self.assertIn('projects/a.jsonl', M.Ledger(self.home, '비공개문서').files)

    def test_while_waiting_no_new_parts_are_made(self):
        M.run_bundle(self.ctx, self.bundle)
        self.write('projects/새것.jsonl', '새 파일')
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['made'], 0)
        self.assertEqual(report['waiting'], 1)

    def test_metadata_unavailable_is_an_issue_not_success(self):
        self.slow.answer = None
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertIn('unmet23:UNMET23_METADATA_UNAVAILABLE', report['issues'])
        self.assertEqual(M.Ledger(self.home, '비공개문서').files, {})

    def test_late_copy_is_copied_again_and_reported(self):
        M.run_bundle(self.ctx, self.bundle)
        side = Path(str(self.temp_parts()[0]) + '.json')
        body = json.loads(side.read_text(encoding='utf-8'))
        body['dests']['unmet23']['copiedAt'] = '2026-01-01T00:00:00Z'
        side.write_text(json.dumps(body, ensure_ascii=False), encoding='utf-8')
        before = len(self.slow.puts)
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertIn('unmet23:UNMET23_NOT_VERIFIED', report['issues'])
        self.assertEqual(len(self.slow.puts), before + 1)


class Locking(Base):
    def test_second_run_on_same_bundle_is_skipped_and_leaves_parts_alone(self):
        self.write('projects/a.jsonl', '내용')
        bundle = M.Bundle('대화기록', 'incremental', ('77yuhbs',), roots=[M.Root(self.home / 'projects')])
        temp = self.base / 'temp' / '대화기록'
        temp.mkdir(parents=True)
        other_partial = temp / '다른회차.tar.zst.enc.part'
        other_partial.write_bytes(b'x')
        with M.BundleLock(temp / '.묶음잠금'):
            done = subprocess.run([sys.executable, '-X', 'utf8', '-B', '-c', (
                'import importlib.util,sys;from pathlib import Path;'
                f'sys.path.insert(0,r"{TOOL}");s=importlib.util.spec_from_file_location("m",r"{TOOL / "암호묶음.py"}");m=importlib.util.module_from_spec(s);sys.modules["m"]=s.name and m;s.loader.exec_module(m);'
                f'lock=m.BundleLock(Path(r"{temp / ".묶음잠금"}"))\n'
                'try:\n    lock.__enter__();print("잡음")\nexcept m.BundleBusy:\n    print("바쁨")')], capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(done.stdout.strip(), '바쁨', done.stderr)
        self.assertTrue(other_partial.exists())


class Incremental(Base):
    def bundle(self, **kw):
        return M.Bundle('대화기록', 'incremental', ('77yuhbs',), roots=[M.Root(self.home / 'projects', skip_dirs=('memory',))], **kw)

    def test_second_run_sends_only_changes_and_newest_wins_on_restore(self):
        one = self.write('projects/a.jsonl', '첫째')
        self.write('projects/b.jsonl', '둘째')
        self.write('projects/memory/메모.md', '안 올림')
        first = M.run_bundle(self.ctx, self.bundle())
        self.assertEqual(first['files'], 2)
        time.sleep(1.1)
        one.write_text('첫째 더 긴 판', encoding='utf-8')
        second = M.run_bundle(self.ctx, self.bundle())
        self.assertEqual(second['files'], 1)
        third = M.run_bundle(self.ctx, self.bundle())
        self.assertEqual(third['made'], 0)
        ledger = M.Ledger(self.home, '대화기록')
        self.assertTrue(ledger.files['projects/a.jsonl'][3].startswith('대화기록-'))  # 어느 조각에 있는지 색인
        home2 = self.base / 'home2'
        home2.mkdir()
        result = self.restore(self.base / 'b' / '대화기록', home2)
        self.assertEqual((home2 / 'projects/a.jsonl').read_text(encoding='utf-8'), '첫째 더 긴 판')
        self.assertEqual((home2 / 'projects/b.jsonl').read_text(encoding='utf-8'), '둘째')
        self.assertFalse((home2 / 'projects/memory/메모.md').exists())
        self.assertEqual(result['건너뜀'], 1)  # 옛 판은 건너뛴다

    def test_failed_destination_keeps_part_and_state_then_resumes_without_reencrypting(self):
        self.write('projects/a.jsonl', '내용')
        two = M.Bundle('비공개문서', 'incremental', ('unmet23', '77yuhbs'), roots=[M.Root(self.home / 'projects')])
        self.b.fail = 'DRIVE_HTTP_500: 시험'
        report = M.run_bundle(self.ctx, two)
        self.assertEqual(report['issues'], ['77yuhbs:DRIVE_HTTP_500'])
        ledger = M.Ledger(self.home, '비공개문서')
        self.assertEqual(ledger.files, {})
        self.assertEqual(len(self.a.puts), 1)
        made = list((self.base / 'temp' / '비공개문서').glob('*.enc'))
        self.assertEqual(len(made), 1)
        self.b.fail = None
        report = M.run_bundle(self.ctx, two)
        self.assertEqual(report['issues'], [])
        self.assertEqual(report['made'], 0)  # 다시 암호화하지 않고 남은 조각만 올렸다
        self.assertEqual(len(self.a.puts), 1)  # 이미 올라간 쪽은 다시 안 올린다
        self.assertEqual(len(self.b.puts), 1)
        ledger = M.Ledger(self.home, '비공개문서')
        self.assertIn('projects/a.jsonl', ledger.files)
        self.assertEqual(list((self.base / 'temp' / '비공개문서').glob('*.enc')), [])

    def test_failed_leftover_blocks_new_parts(self):
        self.write('projects/a.jsonl', '내용')
        self.b.fail = 'DRIVE_HTTP_500: 시험'
        M.run_bundle(self.ctx, self.bundle())
        self.write('projects/c.jsonl', '새 파일')
        report = M.run_bundle(self.ctx, self.bundle())
        self.assertEqual(report['made'], 0)
        self.assertEqual(len(list((self.base / 'temp' / '대화기록').glob('*.enc'))), 1)

    def test_quiet_defers_recent_files_but_force_after_takes_them(self):
        row = (Path('x'), 'x', 5, int(time.time() * 1e9))
        bundle = self.bundle(quiet=3600, force_after=7200)
        ledger = M.Ledger(self.home, '대화기록')
        picked, deferred = M.changed_files([row], ledger, bundle, time.time())
        self.assertEqual((picked, deferred), ([], 1))
        ledger.files['x'] = [1, 1, time.time() - 8000]
        picked, deferred = M.changed_files([row], ledger, bundle, time.time())
        self.assertEqual((picked, deferred), ([row], 0))
        ledger.files['x'] = [1, 1, time.time() - 100]
        self.assertEqual(M.changed_files([row], ledger, bundle, time.time())[1], 1)

    def test_force_after_also_covers_brand_new_files_that_never_go_quiet(self):
        bundle = self.bundle(quiet=3600, force_after=7200)
        ledger = M.Ledger(self.home, '대화기록')
        start = time.time()
        row = (Path('x'), 'x', 5, int(start * 1e9))
        self.assertEqual(M.changed_files([row], ledger, bundle, start)[1], 1)
        later = start + 7300
        row2 = (Path('x'), 'x', 9, int(later * 1e9))  # 그사이에도 계속 자랐다
        self.assertEqual(M.changed_files([row2], ledger, bundle, later)[0], [row2])
        ledger.commit([('x', 9, row2[3])], later, 'p')
        self.assertNotIn('x', ledger.meta.get('처음본때', {}))

    def test_batches_cut_by_raw_limit(self):
        rows = [(Path(str(i)), str(i), 40, 0) for i in range(5)]
        self.assertEqual([len(b) for b in M.batches(rows, limit=100)], [2, 2, 1])
        self.assertEqual([len(b) for b in M.batches([(Path('x'), 'x', 500, 0)], limit=100)], [1])

    def test_file_changing_size_while_reading_small_is_still_captured_with_real_bytes(self):
        p = self.write('projects/바뀜.jsonl', 'abc')
        rows = [(p, 'projects/바뀜.jsonl', 100000, 1)]
        out = self.base / 'part.tar.zst.enc'
        info, captured, skipped = M.seal(rows, None, out, self.public)
        self.assertEqual(skipped, 0)  # 작은 파일은 먼저 다 읽어 실제 크기를 적는다
        self.assertEqual(len(captured), 1)

    def test_big_shrinking_file_keeps_archive_valid_and_is_not_recorded(self):
        p = self.write('projects/줄어듦.jsonl', 'abc')
        ok = self.write('projects/정상.jsonl', '정상')
        original = M.READ_WHOLE_LIMIT
        M.READ_WHOLE_LIMIT = 1
        try:
            rows = [(p, 'projects/줄어듦.jsonl', 100000, 1), (ok, 'projects/정상.jsonl', len('정상'.encode()), 1)]
            out = self.base / 'part.tar.zst.enc'
            info, captured, skipped = M.seal(rows, None, out, self.public)
        finally:
            M.READ_WHOLE_LIMIT = original
        self.assertEqual(skipped, 1)
        self.assertEqual([r[0] for r in captured], ['projects/정상.jsonl'])
        home2 = self.base / 'home2'
        home2.mkdir()
        folder = self.base / 'parts'
        folder.mkdir()
        shutil.copyfile(out, folder / '대화기록-20261109T000000Z-001.tar.zst.enc')
        result = self.restore(folder, home2)
        self.assertEqual(result['풀림'], 1)
        self.assertFalse((home2 / 'projects/줄어듦.jsonl').exists())  # 0으로 채운 파일은 풀지 않고 옛 조각에 맡긴다
        self.assertEqual((home2 / 'projects/정상.jsonl').read_text(encoding='utf-8'), '정상')

    @unittest.skipUnless(os.name == 'nt', 'junction은 Windows에서만')
    def test_junction_is_not_followed_unless_top_is_marked(self):
        outside = self.base / '바깥'
        outside.mkdir()
        (outside / '비밀.txt').write_text('x', encoding='utf-8')
        self.write('projects/a.jsonl', '내용')
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(self.home / 'projects' / '연결'), str(outside)], check=True, capture_output=True)
        self.assertEqual([r[1] for r in M.select(self.bundle(), self.home)], ['projects/a.jsonl'])
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(self.home / '위'), str(outside)], check=True, capture_output=True)
        marked = M.Bundle('x', 'whole', ('77yuhbs',), roots=[M.Root(self.home / '위', follow_top=True)])
        self.assertEqual([r[1] for r in M.select(marked, self.home)], ['위/비밀.txt'])
        plain = M.Bundle('x', 'whole', ('77yuhbs',), roots=[M.Root(self.home / '위')])
        self.assertEqual(M.select(plain, self.home), [])


class Extract(Base):
    def archive(self, entries, name='x.tar.zst'):
        out = self.base / name
        with tarfile.open(out, 'w:zst') as tar:
            for arc, data in entries:
                info = tarfile.TarInfo(arc)
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))
        return out

    def test_refuses_paths_outside_home(self):
        out = self.archive([('../바깥.txt', b'x'), ('C:/Windows/x.txt', b'x'), ('/abs.txt', b'x'), ('a/../../b.txt', b'x'), ('정상/파일.txt', b'ok')])
        counts = M.extract(out, self.home)
        self.assertEqual(counts['거절'], 4)
        self.assertEqual(counts['풀림'], 1)
        self.assertFalse((self.base / '바깥.txt').exists())
        self.assertEqual((self.home / '정상/파일.txt').read_bytes(), b'ok')

    def test_never_overwrites_existing_file(self):
        self.write('있는파일.txt', '내 것')
        counts = M.extract(self.archive([('있는파일.txt', b'old')]), self.home)
        self.assertEqual(counts['건너뜀'], 1)
        self.assertEqual((self.home / '있는파일.txt').read_text(encoding='utf-8'), '내 것')

    def test_file_where_folder_is_needed_counts_as_failure_and_goes_on(self):
        self.write('자리', '파일이 먼저 있다')
        counts = M.extract(self.archive([('자리/안.txt', b'x'), ('다른.txt', b'y')]), self.home)
        self.assertEqual(counts['실패'], 1)
        self.assertEqual(counts['풀림'], 1)

    def test_manifest_mismatch_removes_file_so_older_part_can_fill(self):
        import hashlib
        manifest = json.dumps([['좋음.txt', 2, hashlib.sha256(b'ok').hexdigest()], ['나쁨.txt', 3, 'f' * 64]]).encode('utf-8')
        out = self.archive([('좋음.txt', b'ok'), ('나쁨.txt', b'bad'), (M.MANIFEST_DIR + 'x.json', manifest)])
        counts = M.extract(out, self.home)
        self.assertEqual((counts['풀림'], counts['손상']), (1, 1))
        self.assertTrue((self.home / '좋음.txt').exists())
        self.assertFalse((self.home / '나쁨.txt').exists())
        self.assertFalse((self.home / '.synk-복원').exists())


class Workmethod(Base):
    def mirror(self):
        mirror = self.base / 'mirror'
        mirror.mkdir()
        subprocess.run(['git', 'init', '-q', '-b', 'master', str(mirror)], check=True)
        for k, v in (('user.name', 't'), ('user.email', 't@e.st'), ('commit.gpgsign', 'false'), ('core.autocrlf', 'false')):
            subprocess.run(['git', '-C', str(mirror), 'config', k, v], check=True)
        self.commit(mirror, '처음')
        return mirror

    def commit(self, mirror, text):
        (mirror / 'README.md').write_text(text, encoding='utf-8')
        subprocess.run(['git', '-C', str(mirror), 'add', '-A'], check=True)
        subprocess.run(['git', '-C', str(mirror), 'commit', '-qm', 'a'], check=True)

    def test_publishes_plain_zip_and_encrypted_tar_once_per_head(self):
        mirror = self.mirror()
        report = M.publish_workmethod(self.ctx, mirror)
        self.assertEqual(report['issues'], [])
        names = self.a.listing('작업방식')
        self.assertIn('작업방식-최신.zip', names)
        self.assertTrue(any(M.DATED_ZIP.match(n) for n in names))
        self.assertIn('작업방식-최신.tar.enc', self.b.listing('작업방식'))
        enc = (self.base / 'b' / '작업방식' / '작업방식-최신.tar.enc').read_bytes()
        self.assertNotIn('처음'.encode(), enc)
        self.assertTrue(M.publish_workmethod(self.ctx, mirror)['unchanged'])

    def test_failed_destination_retries_only_that_one(self):
        mirror = self.mirror()
        self.b.fail = 'DRIVE_HTTP_500: 시험'
        report = M.publish_workmethod(self.ctx, mirror)
        self.assertEqual(report['issues'], ['77yuhbs:DRIVE_HTTP_500'])
        puts = len(self.a.puts)
        self.b.fail = None
        report = M.publish_workmethod(self.ctx, mirror)
        self.assertEqual(report['issues'], [])
        self.assertEqual(len(self.a.puts), puts)
        self.assertIn('작업방식-최신.tar.enc', self.b.listing('작업방식'))

    def test_new_head_waits_for_interval_then_publishes(self):
        mirror = self.mirror()
        M.publish_workmethod(self.ctx, mirror)
        puts = len(self.a.puts)
        self.commit(mirror, '둘째')
        self.assertTrue(M.publish_workmethod(self.ctx, mirror)['notDue'])
        self.assertEqual(len(self.a.puts), puts)
        report = M.publish_workmethod(self.ctx, mirror, interval=0)
        self.assertEqual(report['issues'], [])
        self.assertGreater(len(self.a.puts), puts)

    def test_zip_counts_only_after_remote_confirms(self):
        mirror = self.mirror()
        self.ctx.unmet23 = slow = Slow(self.base / 'a')
        first = M.publish_workmethod(self.ctx, mirror)
        self.assertFalse(first['dests'].get('unmet23'))
        puts = len(slow.puts)
        second = M.publish_workmethod(self.ctx, mirror)
        self.assertTrue(second.get('waiting'))
        self.assertEqual(len(slow.puts), puts)  # 다시 넣지 않는다
        slow.answer = True
        third = M.publish_workmethod(self.ctx, mirror)
        self.assertTrue(third['unchanged'])

    def test_prune_dated_keeps_recent_and_month_firsts(self):
        folder = self.base / 'a' / '작업방식'
        folder.mkdir(parents=True)
        for day in ('20260901', '20260915', '20261001', '20261002', '20261003', '20261004'):
            (folder / f'작업방식-{day}.zip').write_bytes(b'x')
        M.prune_dated(self.a, M.DATED_ZIP, 2, 12)
        self.assertEqual(self.a.listing('작업방식'), ['작업방식-20260901.zip', '작업방식-20261001.zip', '작업방식-20261003.zip', '작업방식-20261004.zip'])


class Receipt(Base):
    def test_success_and_failure_shape_for_health_monitor(self):
        file = self.base / 'r.json'
        r = M.Receipt(file)
        self.assertEqual(json.loads(file.read_text(encoding='utf-8'))['status'], 'running')
        r.finish([], {})
        body = json.loads(file.read_text(encoding='utf-8'))
        self.assertEqual(body['status'], 'success')
        self.assertTrue(body['lastSuccessAt'])
        r2 = M.Receipt(file)
        r2.finish(['77yuhbs:DRIVE_HTTP_500'], {})
        body = json.loads(file.read_text(encoding='utf-8'))
        self.assertEqual(body['status'], 'partial_failure')
        self.assertEqual(body['issues'], [{'code': 'DRIVE_HTTP_500'}])
        self.assertTrue(body['lastSuccessAt'])

    def test_other_pc_marker_stops_uploads(self):
        os.environ['SYNK_복원_집'] = str(self.home)
        try:
            M.state_root(self.home).mkdir(parents=True)
            (M.state_root(self.home) / M.OTHER_PC_MARKER).write_text('x', encoding='utf-8')
            original = M.make_context
            M.make_context = lambda *a, **k: self.ctx
            try:
                self.assertEqual(M.main(['열쇠']), 1)
            finally:
                M.make_context = original
            self.assertEqual(self.a.puts, [])
        finally:
            os.environ.pop('SYNK_복원_집', None)


if __name__ == '__main__':
    unittest.main(verbosity=1)
