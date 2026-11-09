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
    """G:처럼 복사와 올라감이 따로인 목적지. answer가 True면 넣은 파일만 올라간 것으로 답한다."""
    needs_confirm = True

    def __init__(self, root):
        super().__init__(root)
        self.answer = False

    def confirm(self, folder, name, md5, size):
        return (self.root / folder / name).exists() if self.answer is True else self.answer


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

    def restore(self, folder, home2, codes=(0,)):
        done = subprocess.run(['node', str(TOOL / '복원풀기.cjs'), '--집', str(home2), '--폴더', str(folder), '--비밀키', str(self.keydir / '비밀키_잠금.json'),
                               '--암호파일', str(self.passfile), '--임시', str(self.base / 'unpack'), '--json'], capture_output=True, text=True, encoding='utf-8')
        self.assertIn(done.returncode, codes, done.stderr)
        return json.loads(done.stdout.strip().splitlines()[-1])


class WholeBundle(Base):
    def setUp(self):
        super().setUp()
        self.ctx.force_now = True  # 최소 간격은 따로 본다(test_min_interval)
        self.keys = self.home / '.synk-backup-key'
        self.keys.mkdir()
        shutil.copyfile(self.public, self.keys / '공개키.pem')
        self.write('.synk-backup-key/비밀키_잠금.json', '{"잠김":1}')

    def bundle(self):
        return M.Bundle('열쇠', 'whole', ('unmet23', '77yuhbs'), keep=2, roots=[M.Root(self.home / 'SYNK_보안')],
                        generated=lambda h: {'.synk-복원/환경변수.json': b'{"A":1}'})

    def enc_names(self, dest):
        return [n for n in dest.listing('열쇠') if n.endswith('.enc')]

    def test_lost_whole_part_makes_a_new_version_for_both(self):
        self.write('SYNK_보안/키.txt', 'x')
        bundle = self.bundle()
        self.a.fail = 'UNMET23_G_NOT_MOUNTED'
        M.run_bundle(self.ctx, bundle)
        self.assertEqual((len(self.enc_names(self.a)), len(self.enc_names(self.b))), (0, 1))
        for leftover in (self.base / 'temp' / '열쇠').glob('*.enc*'):
            leftover.unlink()
        self.a.fail = None
        report = M.run_bundle(self.ctx, bundle)  # 지문이 그대로여도 새 판을 만들어 양쪽에 둔다
        self.assertIn('BUNDLE_PART_REQUEUED', report['issues'])
        self.assertEqual(report['made'], 1)
        self.assertEqual((len(self.enc_names(self.a)), len(self.enc_names(self.b))), (1, 2))

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

    def test_prune_keeps_recent_and_first_of_each_day_and_never_touches_other_names(self):
        (self.base / 'a' / '열쇠').mkdir(parents=True)
        for i in range(4):
            (self.base / 'a' / '열쇠' / f'열쇠-20261101T00000{i}Z-001.tar.zst.enc').write_bytes(b'x')
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        names = self.a.listing('열쇠')
        self.assertIn('비밀키_잠금.json', names)
        self.assertIn('열쇠-20261101T000000Z-001.tar.zst.enc', names)  # 그날 첫 판
        self.assertIn('열쇠-20261101T000003Z-001.tar.zst.enc', names)  # 최근 2판 안
        self.assertNotIn('열쇠-20261101T000001Z-001.tar.zst.enc', names)
        self.assertNotIn('열쇠-20261101T000002Z-001.tar.zst.enc', names)

    def test_whole_keep_limits_daily_firsts_to_days(self):
        names = [f'열쇠-202611{d:02}T000000Z-001.tar.zst.enc' for d in range(1, 11)]
        self.assertEqual(M.whole_keep(names, 2, days=3), set(names[-3:]))

    def test_part_names_are_unique_and_old_names_still_match(self):
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        new = self.enc_names(self.a)[0]
        self.assertRegex(new, r'-001-[0-9a-f]{6}\.tar\.zst\.enc$')
        self.assertEqual(M.PART_NAME.match(new)['bundle'], '열쇠')
        self.assertEqual(M.PART_NAME.match('열쇠-20261109T102348Z-001.tar.zst.enc')['seq'], '001')

    def test_min_interval_limits_versions_but_any_change_goes_up_after_it(self):
        self.ctx.force_now = False
        self.write('SYNK_보안/진짜키.txt', 'k')
        bundle = self.bundle()
        M.run_bundle(self.ctx, bundle)
        before = len(self.enc_names(self.a))
        time.sleep(1.1)
        self.write('SYNK_보안/진짜키.txt', 'k2')
        report = M.run_bundle(self.ctx, bundle)
        self.assertTrue(report['notDue'])
        self.assertEqual(len(self.enc_names(self.a)), before)
        ledger = M.Ledger(self.home, '열쇠')
        ledger.meta['wholeAt'] = '2026-01-01T00:00:00Z'
        ledger.save_meta()
        self.assertEqual(M.run_bundle(self.ctx, bundle)['made'], 1)
        self.assertEqual(M.Ledger(self.home, '열쇠').files['SYNK_보안/진짜키.txt'][0], 2)
        time.sleep(1.1)
        self.write('SYNK_보안/진짜키.txt', 'k33')
        self.ctx.force_now = True  # --지금
        self.assertEqual(M.run_bundle(self.ctx, bundle)['made'], 1)

    def test_list_error_makes_no_new_version_and_keeps_old(self):
        self.write('SYNK_보안/폴더/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        first = self.enc_names(self.a)
        self.write('SYNK_보안/폴더/b.txt', '2')
        real = os.scandir

        def denied(path):
            if str(path).endswith('폴더'):
                raise PermissionError('막힘')
            return real(path)
        M.os.scandir = denied
        try:
            report = M.run_bundle(self.ctx, self.bundle())
        finally:
            M.os.scandir = real
        self.assertIn('WHOLE_BUNDLE_LIST_ERROR', report['issues'])
        self.assertEqual(self.enc_names(self.a), first)

    def test_vanished_folder_is_not_a_list_error(self):
        self.write('SYNK_보안/a.txt', '1')
        problems = []
        root = M.Root(self.home / '없는폴더')
        self.assertEqual(list(M.walk_root(root, self.home, problems)), [])
        self.assertEqual(problems, [])

    def test_required_root_empty_stops_new_version(self):
        self.write('SYNK_보안/a.txt', '1')
        bundle = M.Bundle('열쇠', 'whole', ('unmet23', '77yuhbs'), keep=2, roots=[M.Root(self.home / 'SYNK_보안'), M.Root(self.home / '.ssh', required=True)])
        report = M.run_bundle(self.ctx, bundle)
        self.assertIn('WHOLE_BUNDLE_LIST_ERROR', report['issues'])
        self.assertEqual(self.enc_names(self.a), [])

    def test_shrink_guard_and_allow_flag(self):
        files = [self.write(f'SYNK_보안/{i}.txt', '1') for i in range(10)]
        M.run_bundle(self.ctx, self.bundle())
        first = self.enc_names(self.a)
        for f in files[:5]:
            f.unlink()
        report = M.run_bundle(self.ctx, self.bundle())
        self.assertIn('WHOLE_BUNDLE_SHRANK', report['issues'])
        self.assertEqual(self.enc_names(self.a), first)
        self.ctx.allow_shrink = True
        self.assertEqual(M.run_bundle(self.ctx, self.bundle())['made'], 1)

    def test_too_big_whole_bundle_stops(self):
        big = self.write('SYNK_보안/큰.bin', 'x')
        with open(big, 'wb') as f:
            f.truncate(M.KEYS_RAW_LIMIT + 1)
        report = M.run_bundle(self.ctx, self.bundle())
        self.assertIn('BUNDLE_WHOLE_TOO_BIG', report['issues'])
        self.assertEqual(self.enc_names(self.a), [])

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
        self.assertEqual(self.enc_names(self.a), first)  # 온전하지 않은 판은 올리지 않고 옛 판도 그대로다
        self.assertEqual(self.enc_names(self.b), [n for n in self.enc_names(self.b) if n in first])
        self.assertEqual(list((self.base / 'temp' / '열쇠').glob('*.enc')), [])
        again = M.run_bundle(self.ctx, self.bundle())
        self.assertFalse(again['unchanged'])  # 지문을 안 남겨 다시 만든다
        self.assertEqual(again['issues'], [])

    def test_key_files_on_slow_destination_look_at_remote_every_time(self):
        self.ctx.unmet23 = slow = Slow(self.base / 'a')
        slow.answer = True  # 조각은 넣는 대로 대조되게
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        ledger = M.Ledger(self.home, '열쇠')
        self.assertIn('unmet23:비밀키_잠금.json', ledger.meta['keyCopies'])  # 복사만 했다
        self.assertIn('77yuhbs:비밀키_잠금.json', ledger.meta['keyFiles'])
        self.assertNotIn('unmet23:비밀키_잠금.json', ledger.meta['keyFiles'])  # unmet23에는 끝 표시를 두지 않는다
        puts = len(slow.puts)
        slow.answer = False
        self.assertEqual(M.run_bundle(self.ctx, self.bundle())['issues'], [])  # 아직 올라가는 중
        self.assertEqual(len(slow.puts), puts)
        slow.answer = True
        M.run_bundle(self.ctx, self.bundle())
        ledger = M.Ledger(self.home, '열쇠')
        self.assertNotIn('unmet23:비밀키_잠금.json', ledger.meta['keyCopies'])
        self.assertEqual(len(slow.puts), puts)
        # 올라간 뒤 원격에서 사라지면 표시가 없으니 다시 넣는다
        slow.answer = False
        M.run_bundle(self.ctx, self.bundle())
        self.assertGreater(len(slow.puts), puts)

    def test_key_files_metadata_unavailable_is_reported_and_copied_again_when_late(self):
        self.ctx.unmet23 = slow = Slow(self.base / 'a')
        slow.answer = True
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        slow.answer = None
        puts = len(slow.puts)
        report = M.run_bundle(self.ctx, self.bundle())
        self.assertIn('unmet23:UNMET23_METADATA_UNAVAILABLE', report['issues'])
        self.assertEqual(len(slow.puts), puts)
        ledger = M.Ledger(self.home, '열쇠')
        for row in ledger.meta['keyCopies'].values():
            row['at'] = '2026-01-01T00:00:00Z'
        ledger.save_meta()
        M.run_bundle(self.ctx, self.bundle())
        self.assertGreater(len(slow.puts), puts)

    def test_key_files_never_verified_are_copied_again_and_reported(self):
        self.ctx.unmet23 = slow = Slow(self.base / 'a')
        slow.answer = True
        self.write('SYNK_보안/a.txt', '1')
        M.run_bundle(self.ctx, self.bundle())
        ledger = M.Ledger(self.home, '열쇠')
        for row in ledger.meta['keyCopies'].values():
            row['at'] = '2026-01-01T00:00:00Z'
        ledger.save_meta()
        slow.answer = False
        puts = len(slow.puts)
        report = M.run_bundle(self.ctx, self.bundle())
        self.assertIn('unmet23:UNMET23_NOT_VERIFIED', report['issues'])
        self.assertGreater(len(slow.puts), puts)


class Waiting(Base):
    """G: 복사는 올라간 것이 아니다(11-09 GPT 설계 검토)."""

    def setUp(self):
        super().setUp()
        self.ctx.unmet23 = self.slow = Slow(self.base / 'a')
        self.write('projects/a.jsonl', '내용')
        self.bundle = M.Bundle('비공개문서', 'incremental', ('unmet23', '77yuhbs'), roots=[M.Root(self.home / 'projects')])

    def temp_parts(self):
        return list((self.base / 'temp' / '비공개문서').glob('*.enc'))

    def test_copied_but_unverified_keeps_part_until_that_destination_is_verified(self):
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['issues'], [])
        self.assertEqual(report['waiting'], 1)
        self.assertEqual(len(self.b.puts), 1)
        self.assertIn('projects/a.jsonl', M.Ledger(self.home, '비공개문서').files)  # 77yuhbs에는 대조됐다
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

    def test_waiting_on_one_destination_does_not_stop_the_other(self):
        M.run_bundle(self.ctx, self.bundle)
        self.write('projects/새것.jsonl', '새 파일')
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['made'], 1)
        self.assertEqual(report['waiting'], 2)
        self.assertEqual(len(self.b.puts), 2)
        self.assertIn('projects/새것.jsonl', M.Ledger(self.home, '비공개문서').files)
        self.assertEqual(len(self.temp_parts()), 2)

    def test_ledger_gets_final_destinations_when_the_blocked_side_finishes(self):
        M.run_bundle(self.ctx, self.bundle)
        first = M.Ledger(self.home, '비공개문서').parts()
        self.assertEqual(len(first), 1)
        self.assertFalse(first[0]['dests']['unmet23'].get('done'))
        self.slow.answer = True
        M.run_bundle(self.ctx, self.bundle)
        last = M.Ledger(self.home, '비공개문서').parts()[-1]
        self.assertEqual(last['name'], first[0]['name'])
        self.assertTrue(last['allDone'])
        self.assertTrue(last['dests']['unmet23']['done'])

    def test_part_left_in_another_temp_place_is_still_delivered(self):
        first, second = self.base / 'temp1', self.base / 'temp2'

        class Moved(M.Temp):
            place = first

            def candidates(self):
                return [first, second]

            def root(self):
                self.place.mkdir(parents=True, exist_ok=True)
                return self.place

        self.ctx.temp = Moved(self.home)
        M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(len(list((first / '비공개문서').glob('*.enc'))), 1)
        Moved.place = second  # D: 여유가 줄어 임시 자리가 바뀌었다
        self.slow.answer = True
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['issues'], [])
        self.assertEqual(report['waiting'], 0)
        self.assertEqual(list((first / '비공개문서').glob('*.enc')), [])
        self.assertTrue(M.Ledger(self.home, '비공개문서').parts()[-1]['allDone'])

    def test_lock_stays_put_when_temp_place_moves(self):
        temp = M.Temp(self.home)
        self.assertEqual(temp.lock_file('열쇠'), self.base / 'temp' / '열쇠' / '.묶음잠금')

    def test_lost_temp_part_is_bundled_again_for_both_destinations(self):
        M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(list(M.Ledger(self.home, '비공개문서').meta['미완조각']), [self.temp_parts()[0].name])
        for leftover in (self.base / 'temp' / '비공개문서').glob('*.enc*'):
            leftover.unlink()
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertIn('BUNDLE_PART_REQUEUED', report['issues'])
        self.assertEqual(report['made'], 1)  # 같은 회차에 양쪽으로 다시 묶는다
        self.assertEqual((len(self.slow.puts), len(self.b.puts)), (2, 2))
        self.slow.answer = True
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['issues'], [])
        self.assertEqual(report['waiting'], 0)
        self.assertEqual(self.temp_parts(), [])
        self.assertEqual(M.Ledger(self.home, '비공개문서').meta['미완조각'], {})
        self.assertIn('projects/a.jsonl', M.Ledger(self.home, '비공개문서').files)

    def test_requeue_leaves_files_a_newer_part_already_took(self):
        ledger = M.Ledger(self.home, '비공개문서')
        ledger.files = {'옛것': [1, 1, 0, '잃은조각'], '새것': [1, 1, 0, '다른조각']}
        ledger.meta['미완조각'] = {'잃은조각': 'x', '있는조각': 'x'}
        self.assertEqual(M.requeue_lost_parts(self.bundle, ledger, {'있는조각'}), ['BUNDLE_PART_REQUEUED'])
        self.assertEqual(list(ledger.files), ['새것'])
        self.assertEqual(list(ledger.meta['미완조각']), ['있는조각'])

    def test_backlog_limit_is_checked_inside_the_same_run(self):
        self.write('projects/b.jsonl', '둘째')
        real = M.batches, M.TEMP_BACKLOG_BYTES
        M.batches, M.TEMP_BACKLOG_BYTES = (lambda todo: [[row] for row in todo]), 0
        try:
            report = M.run_bundle(self.ctx, self.bundle)
        finally:
            M.batches, M.TEMP_BACKLOG_BYTES = real
        self.assertIn('BUNDLE_TEMP_BACKLOG', report['issues'])
        self.assertEqual(report['made'], 1)

    def test_copy_failing_on_one_destination_does_not_stop_the_other(self):
        self.slow.fail = 'UNMET23_G_LOW_SPACE'
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['issues'], ['unmet23:UNMET23_G_LOW_SPACE'])
        self.write('projects/새것.jsonl', '새 파일')
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['made'], 1)
        self.assertEqual(len(self.b.puts), 2)
        self.slow.fail = None
        self.slow.answer = True
        report = M.run_bundle(self.ctx, self.bundle)  # 막혔던 쪽이 풀리면 밀린 조각이 다 간다
        self.assertEqual(report['issues'], [])
        self.assertEqual(report['waiting'], 0)
        self.assertEqual(len(self.temp_parts()), 0)
        self.assertEqual(len(self.slow.puts), 2)

    def test_part_that_reached_nowhere_blocks_new_parts_and_stays_out_of_ledger(self):
        self.slow.fail = 'UNMET23_G_NOT_MOUNTED'
        self.b.fail = 'DRIVE_HTTP_500: 시험'
        M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(M.Ledger(self.home, '비공개문서').files, {})
        self.write('projects/새것.jsonl', '새 파일')
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertEqual(report['made'], 0)
        self.assertEqual(len(self.temp_parts()), 1)

    def test_too_much_backlog_stops_new_parts_and_reports(self):
        M.run_bundle(self.ctx, self.bundle)
        original = M.TEMP_BACKLOG_BYTES
        M.TEMP_BACKLOG_BYTES = 0
        try:
            self.write('projects/새것.jsonl', '새 파일')
            report = M.run_bundle(self.ctx, self.bundle)
        finally:
            M.TEMP_BACKLOG_BYTES = original
        self.assertIn('BUNDLE_TEMP_BACKLOG', report['issues'])
        self.assertEqual(report['made'], 0)

    def test_room_check_scales_with_file_size(self):
        g = M.UnmetG(self.base / 'g')
        real = M.shutil.disk_usage

        class Usage:
            free = 5 << 30
        M.shutil.disk_usage = lambda *_: Usage
        try:
            self.assertTrue(g.has_room(1 << 20))
            self.assertFalse(g.has_room(4 << 30))
            Usage.free = 1 << 30
            self.assertFalse(g.has_room(1 << 20))
        finally:
            M.shutil.disk_usage = real

    def test_metadata_unavailable_is_an_issue_not_success(self):
        self.slow.answer = None
        report = M.run_bundle(self.ctx, self.bundle)
        self.assertIn('unmet23:UNMET23_METADATA_UNAVAILABLE', report['issues'])
        self.assertEqual(len(self.temp_parts()), 1)  # 대조 전에는 임시를 안 지운다

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
        self.assertIn('projects/a.jsonl', ledger.files)  # 한 곳에는 갔으니 장부에 적는다
        self.assertEqual(len(self.a.puts), 1)
        made = list((self.base / 'temp' / '비공개문서').glob('*.enc'))
        self.assertEqual(len(made), 1)  # 막힌 쪽으로 보내려고 임시는 남긴다
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

    def test_files_restored_on_a_new_pc_are_not_uploaded_again(self):
        # 실제 흐름: 묶기 → 올리기 → 새 집에 풀기 → 새 집에서 다시 고르기. 시각이 소수 초를 거쳐도 장부와 같은 파일로 봐야 수십 GB를 다시 안 올린다.
        for index, moment in enumerate((1794169865764624639, 1794169865999999999, 1600000000123456789, 1794169865000000000)):
            p = self.write(f'projects/시각{index}.jsonl', f'내용 {index}')
            os.utime(p, ns=(moment, moment))
        bundle = self.bundle()
        M.run_bundle(self.ctx, bundle)
        home2 = self.base / 'home2'
        home2.mkdir()
        self.assertEqual(self.restore(self.base / 'b' / '대화기록', home2)['풀림'], 4)
        rows = M.select(M.Bundle('대화기록', 'incremental', ('77yuhbs',), roots=[M.Root(home2 / 'projects', skip_dirs=('memory',))]), home2)
        self.assertEqual(len(rows), 4)
        self.assertEqual(M.changed_files(rows, M.Ledger(self.home, '대화기록'), bundle, time.time()), ([], 0))

    def test_restored_file_with_rounded_mtime_is_not_uploaded_again(self):
        bundle = self.bundle()
        ledger = M.Ledger(self.home, '대화기록')
        ledger.files['x'] = [5, 1794169865764624600, 0, 'p']
        rounded = int(1794169865764624600 / 1e9 * 1e9)
        self.assertEqual(M.changed_files([(Path('x'), 'x', 5, rounded)], ledger, bundle, time.time()), ([], 0))
        later = (Path('x'), 'x', 5, 1794169865764624600 + 5_000_000)
        self.assertEqual(M.changed_files([later], ledger, bundle, time.time())[0], [later])

    def test_batches_cut_by_raw_limit(self):
        rows = [(Path(str(i)), str(i), 40, 0) for i in range(5)]
        self.assertEqual([len(b) for b in M.batches(rows, limit=100)], [2, 2, 1])
        self.assertEqual([len(b) for b in M.batches([(Path('x'), 'x', 500, 0)], limit=100)], [1])

    def test_file_changing_size_while_reading_small_is_still_captured_with_real_bytes(self):
        p = self.write('projects/바뀜.jsonl', 'abc')
        rows = [(p, 'projects/바뀜.jsonl', 100000, 1)]
        out = self.base / 'part.tar.zst.enc'
        info, captured, skipped = M.seal(rows, None, out, self.public)
        self.assertEqual(skipped, ['projects/바뀜.jsonl'])  # 읽은 바이트는 묶음에 두되 장부에는 안 적어 다음 회차가 다시 넣는다
        self.assertEqual(captured, [])
        home2 = self.base / 'home2'
        home2.mkdir()
        folder = self.base / 'parts'
        folder.mkdir()
        shutil.copyfile(out, folder / '대화기록-20261109T000000Z-001.tar.zst.enc')
        self.assertEqual(self.restore(folder, home2)['풀림'], 1)
        self.assertEqual((home2 / 'projects/바뀜.jsonl').read_text(encoding='utf-8'), 'abc')

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
        self.assertEqual(skipped, ['projects/줄어듦.jsonl'])
        self.assertEqual([r[0] for r in captured], ['projects/정상.jsonl'])
        home2 = self.base / 'home2'
        home2.mkdir()
        folder = self.base / 'parts'
        folder.mkdir()
        shutil.copyfile(out, folder / '대화기록-20261109T000000Z-001.tar.zst.enc')
        result = self.restore(folder, home2, codes=(2,))  # 빠진 파일이 있으니 살펴볼 것으로 알린다
        self.assertEqual(result['풀림'], 1)
        self.assertEqual(result['손상'], 1)
        self.assertFalse((home2 / 'projects/줄어듦.jsonl').exists())  # 0으로 채운 파일은 풀지 않고 옛 조각에 맡긴다
        self.assertEqual((home2 / 'projects/정상.jsonl').read_text(encoding='utf-8'), '정상')

    @unittest.skipUnless(os.name == 'nt', 'junction은 Windows에서만')
    def test_inner_junction_is_not_followed_but_root_junction_is(self):
        outside = self.base / '바깥'
        outside.mkdir()
        (outside / '비밀.txt').write_text('x', encoding='utf-8')
        self.write('projects/a.jsonl', '내용')
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(self.home / 'projects' / '연결'), str(outside)], check=True, capture_output=True)
        self.assertEqual([r[1] for r in M.select(self.bundle(), self.home)], ['projects/a.jsonl'])
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(self.home / '위'), str(outside)], check=True, capture_output=True)
        top = M.Bundle('x', 'whole', ('77yuhbs',), roots=[M.Root(self.home / '위')])
        self.assertEqual([r[1] for r in M.select(top, self.home)], ['위/비밀.txt'])

    def test_file_outside_home_is_kept_under_its_own_folder(self):
        outside = self.base / '바깥' / '글.md'
        outside.parent.mkdir()
        outside.write_text('x', encoding='utf-8')
        bundle = M.Bundle('x', 'whole', ('77yuhbs',), roots=[M.Root(outside)])
        problems = []
        rows = M.select(bundle, self.home, problems)
        self.assertEqual(problems, [])
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0][1].startswith('SYNK복원_집밖/'))
        self.assertTrue(rows[0][1].endswith('바깥/글.md'))


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

    def test_onedrive_copy_is_not_restored_into_onedrive_folder(self):
        counts = M.extract(self.archive([('OneDrive/SYNK/시스템/글.md', b'x'), (M.MANIFEST_DIR + 'y.json', json.dumps([['OneDrive/SYNK/시스템/글.md', 1, 'f' * 64]]).encode('utf-8'))]), self.home)
        self.assertFalse((self.home / 'OneDrive').exists())
        self.assertEqual(counts['손상'], 1)  # 조각 목록과의 대조는 원래 이름으로 한다
        counts = M.extract(self.archive([('OneDrive/SYNK/시스템/글2.md', b'y')]), self.home)
        self.assertEqual((self.home / 'SYNK복원_작업기록' / 'SYNK' / '시스템' / '글2.md').read_bytes(), b'y')

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

    def test_file_created_while_extracting_is_not_overwritten(self):
        target = self.write('경쟁.txt', '먼저 온 판')
        partial = self.base / '임시'
        partial.write_text('늦은 판', encoding='utf-8')
        with self.assertRaises(FileExistsError):
            M.place_no_clobber(partial, target)
        self.assertEqual(target.read_text(encoding='utf-8'), '먼저 온 판')
        self.assertTrue(partial.exists())

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
        self.assertIn('작업방식-최신.zip.enc', self.b.listing('작업방식'))
        self.assertTrue(any(M.DATED_ENC.match(n) for n in self.b.listing('작업방식')))
        enc = (self.base / 'b' / '작업방식' / '작업방식-최신.zip.enc').read_bytes()
        self.assertTrue(enc.startswith(b'SYNK-ENC-1'))
        self.assertNotIn(b'README.md', enc[600:])
        self.assertTrue(M.publish_workmethod(self.ctx, mirror)['unchanged'])

    def test_dated_copy_is_made_once_a_day(self):
        mirror = self.mirror()
        M.publish_workmethod(self.ctx, mirror)
        dated = [n for n in self.a.puts if M.DATED_ZIP.match(n)]
        self.assertEqual(len(dated), 1)
        self.commit(mirror, '둘째')
        M.publish_workmethod(self.ctx, mirror, interval=0)
        self.assertEqual(len([n for n in self.a.puts if M.DATED_ZIP.match(n)]), 1)
        self.assertEqual(self.a.puts.count('작업방식-최신.zip'), 2)
        self.assertEqual(self.b.puts.count('작업방식-최신.zip.enc'), 2)

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
        self.assertIn('작업방식-최신.zip.enc', self.b.listing('작업방식'))

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

    def rewrite_state(self, **changes):
        file = M.state_root(self.home) / '작업방식_드라이브.json'
        state = json.loads(file.read_text(encoding='utf-8'))
        for key, value in changes.items():
            state[key].update(value) if isinstance(value, dict) else state.__setitem__(key, value)
        file.write_text(json.dumps(state, ensure_ascii=False), encoding='utf-8')

    def test_zip_never_verified_on_same_head_is_copied_again_and_reported(self):
        mirror = self.mirror()
        self.ctx.unmet23 = slow = Slow(self.base / 'a')
        M.publish_workmethod(self.ctx, mirror)
        puts = slow.puts.count('작업방식-최신.zip')
        self.rewrite_state(unmet23Pending={'at': '2026-01-01T00:00:00Z'}, unmet23PendingSince='2026-01-01T00:00:00Z')
        report = M.publish_workmethod(self.ctx, mirror)
        self.assertIn('unmet23:UNMET23_NOT_VERIFIED', report['issues'])
        self.assertEqual(slow.puts.count('작업방식-최신.zip'), puts + 1)

    def test_zip_never_verified_across_new_heads_is_still_reported(self):
        mirror = self.mirror()
        self.ctx.unmet23 = Slow(self.base / 'a')
        M.publish_workmethod(self.ctx, mirror)
        self.rewrite_state(unmet23PendingSince='2026-01-01T00:00:00Z')
        self.commit(mirror, '둘째')
        report = M.publish_workmethod(self.ctx, mirror, interval=0)  # pending의 시각은 새 판으로 계속 새로워진다
        self.assertIn('unmet23:UNMET23_NOT_VERIFIED', report['issues'])

    def test_after_failure_a_new_head_retries_without_waiting_for_interval(self):
        mirror = self.mirror()
        M.publish_workmethod(self.ctx, mirror)  # 첫 판은 시각을 남긴다
        self.rewrite_state(at='2026-01-01T00:00:00Z')  # 마지막 성공이 오래됐다
        self.commit(mirror, '둘째')
        self.b.fail = 'DRIVE_HTTP_500: 시험'
        report = M.publish_workmethod(self.ctx, mirror)
        self.assertEqual(report['issues'], ['77yuhbs:DRIVE_HTTP_500'])
        state = json.loads((M.state_root(self.home) / '작업방식_드라이브.json').read_text(encoding='utf-8'))
        self.assertEqual(state['at'], '2026-01-01T00:00:00Z')  # 실패 회차는 시각을 안 남긴다
        self.b.fail = None
        self.commit(mirror, '셋째')
        report = M.publish_workmethod(self.ctx, mirror)  # 3시간을 기다리지 않고 바로 다시 간다
        self.assertFalse(report.get('notDue'))
        self.assertEqual(report['issues'], [])

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

    def test_waiting_or_busy_is_pending_and_keeps_last_success(self):
        file = self.base / 'r.json'
        r = M.Receipt(file)
        r.finish([], {'a': {'waiting': 1}})
        body = json.loads(file.read_text(encoding='utf-8'))
        self.assertEqual(body['status'], 'pending')
        self.assertIsNone(body['lastSuccessAt'])
        r2 = M.Receipt(file)
        r2.finish([], {'a': {'busy': True}})
        self.assertEqual(json.loads(file.read_text(encoding='utf-8'))['status'], 'pending')

    def test_only_stop_issues_are_paused(self):
        file = self.base / 'r.json'
        r = M.Receipt(file)
        r.finish(['BUNDLE_STOPPED', 'BUNDLE_STOPPED'], {})
        self.assertEqual(json.loads(file.read_text(encoding='utf-8'))['status'], 'paused')

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


class Settle(Base):
    def test_waits_for_remote_then_finishes_in_same_run(self):
        self.ctx.unmet23 = slow = Slow(self.base / 'a')
        self.write('projects/a.jsonl', '내용')
        bundle = M.Bundle('비공개문서', 'incremental', ('unmet23', '77yuhbs'), roots=[M.Root(self.home / 'projects')])
        reports = {'비공개문서': M.run_bundle(self.ctx, bundle)}
        self.assertEqual(reports['비공개문서']['waiting'], 1)
        calls = []

        def sleep(_):
            calls.append(1)
            if len(calls) >= 2:
                slow.answer = True
        self.ctx.sleep = sleep
        M.settle(self.ctx, {'비공개문서': bundle}, reports, tries=5, wait=0)
        self.assertEqual(reports['비공개문서']['waiting'], 0)
        self.assertIn('projects/a.jsonl', M.Ledger(self.home, '비공개문서').files)

    def test_gives_up_after_tries_and_stays_waiting(self):
        self.ctx.unmet23 = Slow(self.base / 'a')
        self.write('projects/a.jsonl', '내용')
        bundle = M.Bundle('비공개문서', 'incremental', ('unmet23', '77yuhbs'), roots=[M.Root(self.home / 'projects')])
        reports = {'비공개문서': M.run_bundle(self.ctx, bundle)}
        M.settle(self.ctx, {'비공개문서': bundle}, reports, tries=2, wait=0)
        self.assertEqual(reports['비공개문서']['waiting'], 1)


class Hotspot(Base):
    def setUp(self):
        super().setUp()
        os.environ['SYNK_복원_집'] = str(self.home)
        self.original = M.make_context
        self.hold = None

        def fake(home, public_key=None, big=True):
            self.ctx.hold = self.hold if big else None
            return self.ctx
        M.make_context = fake

    def tearDown(self):
        M.make_context = self.original
        os.environ.pop('SYNK_복원_집', None)
        super().tearDown()

    def test_wifi_names_read_both_encodings(self):
        drive = sys.modules['드라이브']

        class Out:
            def __init__(self, raw):
                self.stdout = raw
        if os.name == 'nt':
            sample = '    SSID                   : 유호의 S26 Ultra\r\n    BSSID                  : aa:bb\r\n'
            self.assertEqual(drive.wifi_names(lambda *a, **k: Out(sample.encode('utf-8'))), ['유호의 S26 Ultra'])
            self.assertEqual(drive.wifi_names(lambda *a, **k: Out(sample.encode('cp949'))), ['유호의 S26 Ultra'])
            self.assertTrue(drive.on_hotspot(lambda *a, **k: Out(sample.encode('utf-8'))))
            self.assertFalse(drive.on_hotspot(lambda *a, **k: Out(b'    SSID : Hollys_2Floor 5G\r\n')))

    def test_rate_waits_while_holding(self):
        import threading
        drive = sys.modules['드라이브']
        rate = drive.Rate(hold=lambda: True)
        rate.hold_poll = 0.01
        rate.holding = True
        done = threading.Event()
        worker = threading.Thread(target=lambda: (rate.take(1), done.set()), daemon=True)
        worker.start()
        self.assertFalse(done.wait(0.2))
        rate.holding = False
        self.assertTrue(done.wait(2))

    def test_big_run_pauses_on_hotspot(self):
        self.hold = lambda: True
        self.write('Documents/SYNK-보관함/a.md', '내용')
        self.assertEqual(M.main(['전부']), 0)
        body = json.loads((M.state_root(self.home) / '묶음.json').read_text(encoding='utf-8'))
        self.assertEqual(body['status'], 'paused')
        self.assertEqual(self.a.puts + self.b.puts, [])

    def test_workmethod_drive_skips_on_hotspot_without_failing(self):
        self.hold = lambda: True
        self.assertEqual(M.main(['작업방식', '--거울', str(self.base / '없는거울')]), 0)
        self.assertEqual(self.a.puts + self.b.puts, [])

    def test_keys_still_go_on_hotspot(self):
        self.hold = lambda: True
        for rel in ('SYNK_보안/a.txt', '.ssh/id', '.synk-drive-77yuhbs/.clasprc.json', '.synk-backup-key/비밀키_잠금.json'):
            self.write(rel, '값')
        shutil.copyfile(self.public, self.home / '.synk-backup-key' / '공개키.pem')
        self.assertEqual(M.main(['열쇠']), 0)
        self.assertTrue(any(n.startswith('열쇠-') for n in self.a.puts))

    def test_small_context_does_not_hold_uploads_on_hotspot(self):
        M.make_context = self.original
        drive_dir = self.home / '.synk-drive-77yuhbs'
        drive_dir.mkdir()
        (drive_dir / '.clasprc.json').write_text(json.dumps({'tokens': {'default': {'client_id': 'a', 'client_secret': 'b', 'refresh_token': 'c'}}}), encoding='utf-8')
        real = sys.modules['드라이브'].on_hotspot
        sys.modules['드라이브'].on_hotspot = lambda *a, **k: True
        try:
            small = M.make_context(self.home, big=False)
            big = M.make_context(self.home)
        finally:
            sys.modules['드라이브'].on_hotspot = real
        for ctx in (small, big):
            ctx.yuhbs.drive.rate.stop.set()
        self.assertIsNone(small.yuhbs.drive.rate.hold)
        self.assertFalse(small.yuhbs.drive.rate.holding)
        self.assertIsNone(small.hold)
        self.assertTrue(big.yuhbs.drive.rate.holding)
        self.assertIsNotNone(big.hold)


class Damage(Base):
    def make_part(self, name, entries):
        out = self.base / 'parts' / name
        out.parent.mkdir(exist_ok=True)
        rows = []
        for arc, data in entries:
            p = self.base / 'src' / arc.replace('/', '_')
            p.parent.mkdir(exist_ok=True)
            p.write_bytes(data)
            rows.append((p, arc, len(data), 1))
        M.seal(rows, None, out, self.public)

    def test_damaged_newest_filled_by_older_part_is_not_counted(self):
        self.make_part('대화기록-20261101T000000Z-001.tar.zst.enc', [('a.jsonl', b'old')])
        original = M.READ_WHOLE_LIMIT
        M.READ_WHOLE_LIMIT = 1
        try:
            big = self.base / 'src' / 'b'
            big.parent.mkdir(exist_ok=True)
            big.write_bytes(b'xx')
            out = self.base / 'parts' / '대화기록-20261102T000000Z-001.tar.zst.enc'
            M.seal([(big, 'a.jsonl', 100000, 1)], None, out, self.public)  # 묶는 사이 줄어든 큰 파일
        finally:
            M.READ_WHOLE_LIMIT = original
        home2 = self.base / 'home2'
        home2.mkdir()
        result = self.restore(self.base / 'parts', home2)
        self.assertEqual(result['손상'], 0)
        self.assertEqual((home2 / 'a.jsonl').read_bytes(), b'old')

    def test_damaged_with_no_older_part_is_counted_and_named(self):
        original = M.READ_WHOLE_LIMIT
        M.READ_WHOLE_LIMIT = 1
        try:
            big = self.base / 'src' / 'b'
            big.parent.mkdir(exist_ok=True)
            big.write_bytes(b'xx')
            out = self.base / 'parts' / '대화기록-20261102T000000Z-001.tar.zst.enc'
            out.parent.mkdir(exist_ok=True)
            M.seal([(big, 'a.jsonl', 100000, 1)], None, out, self.public)
        finally:
            M.READ_WHOLE_LIMIT = original
        home2 = self.base / 'home2'
        home2.mkdir()
        result = self.restore(self.base / 'parts', home2, codes=(2,))
        self.assertEqual(result['손상'], 1)
        self.assertEqual(result['손상목록'], ['a.jsonl'])


class TwoDrives(Base):
    """두 드라이브는 서로 독립이라 한쪽에만 간 조각이 있을 수 있다 — 복원은 둘을 합쳐 본다(11-09)."""

    def part(self, drive, name, arc, text):
        source = self.base / 'src' / name
        source.parent.mkdir(exist_ok=True)
        source.write_text(text, encoding='utf-8')
        out = self.base / drive / '비공개문서' / name
        out.parent.mkdir(parents=True, exist_ok=True)
        M.seal([(source, arc, source.stat().st_size, 1_000_000_000_000)], None, out, self.public)
        return out

    def unpack(self, *folders, extra=()):
        home2 = self.base / 'home2'
        home2.mkdir(exist_ok=True)
        args = ['node', str(TOOL / '복원풀기.cjs'), '--집', str(home2), '--비밀키', str(self.keydir / '비밀키_잠금.json'),
                '--암호파일', str(self.passfile), '--임시', str(self.base / 'unpack'), '--json', *extra]
        for folder in folders:
            args += ['--폴더', str(self.base / folder / '비공개문서')]
        done = subprocess.run(args, capture_output=True, text=True, encoding='utf-8')
        return done, home2, json.loads(done.stdout.strip().splitlines()[-1])

    def test_newest_part_wins_across_drives_whichever_folder_comes_first(self):
        self.part('g', '비공개문서-20261101T000000Z-001-aaaaaa.tar.zst.enc', 'x.txt', '옛 판')
        self.part('받음', '비공개문서-20261102T000000Z-001-bbbbbb.tar.zst.enc', 'x.txt', '새 판')
        self.part('g', '비공개문서-20261103T000000Z-001-cccccc.tar.zst.enc', 'y.txt', 'unmet23에만 간 조각')
        done, home2, result = self.unpack('g', '받음')
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual((home2 / 'x.txt').read_text(encoding='utf-8'), '새 판')
        self.assertEqual((home2 / 'y.txt').read_text(encoding='utf-8'), 'unmet23에만 간 조각')
        self.assertEqual(result['묶음']['비공개문서']['조각'], 3)

    def test_same_part_in_both_drives_is_read_once(self):
        name = '비공개문서-20261101T000000Z-001-aaaaaa.tar.zst.enc'
        self.part('받음', name, 'x.txt', '내용')
        (self.base / 'g' / '비공개문서').mkdir(parents=True)
        shutil.copyfile(self.base / '받음' / '비공개문서' / name, self.base / 'g' / '비공개문서' / name)
        done, _, result = self.unpack('받음', 'g')
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual((result['조각'], result['풀림'], result['건너뜀']), (1, 1, 0))

    def test_failed_download_unpacks_nothing_so_a_rerun_still_gets_the_newest(self):
        self.part('g', '비공개문서-20261101T000000Z-001-aaaaaa.tar.zst.enc', 'x.txt', '옛 판')
        self.part('받는곳', '비공개문서-20261102T000000Z-001-bbbbbb.tar.zst.enc', 'x.txt', '새 판')
        # 가짜 집에는 77yuhbs 자격이 없어 받기가 실패한다
        done, home2, result = self.unpack('g', extra=('--받기', '비공개문서', '--받는곳', str(self.base / '받는곳')))
        self.assertEqual(done.returncode, 3, done.stderr)
        self.assertTrue(result['받기실패'])
        self.assertEqual(result['풀림'], 0)
        self.assertFalse((home2 / 'x.txt').exists())  # 옛 판이 자리를 차지하면 다음 회차의 새 판이 건너뛰어진다
        done, home2, _ = self.unpack('받는곳', 'g')  # 받기가 된 뒤의 회차
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual((home2 / 'x.txt').read_text(encoding='utf-8'), '새 판')

    def test_one_drive_only_unpacks_just_that_drive(self):
        self.part('g', '비공개문서-20261101T000000Z-001-aaaaaa.tar.zst.enc', 'x.txt', 'unmet23 판')
        done, home2, result = self.unpack('g')  # restore.ps1 -드라이브앱만은 --받기 없이 G:만 넘긴다
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertNotIn('받기실패', result)
        self.assertEqual((home2 / 'x.txt').read_text(encoding='utf-8'), 'unmet23 판')


class Order(Base):
    def test_ledger_bundle_goes_last_after_others_settled(self):
        self.assertEqual(M.DAILY[-1], '창고장부')
        os.environ['SYNK_복원_집'] = str(self.home)
        calls = []
        real = M.make_context, M.run_bundle, M.settle
        M.make_context = lambda *a, **k: self.ctx
        M.run_bundle = lambda ctx, bundle, beat=None: calls.append(bundle.name) or {'bundle': bundle.name, 'issues': []}
        M.settle = lambda *a, **k: calls.append('대조대기')
        try:
            self.assertEqual(M.main(['전부']), 0)
        finally:
            M.make_context, M.run_bundle, M.settle = real
            os.environ.pop('SYNK_복원_집', None)
        self.assertEqual(calls[-3:], ['대조대기', '창고장부', '대조대기'])


class Drill(Base):
    """복원 시험 도구 — 받은 폴더로 실제로 풀어 원본과 대조한다."""

    def run_drill(self, folder, parts, home=None):
        return subprocess.run(['node', str(TOOL / '복원시험.cjs'), '--폴더', str(folder), '--묶음', '열쇠', '--받은곳', str(parts), '--집', str(home or self.home),
                               '--암호파일', str(self.passfile), '--비밀키', str(self.keydir / '비밀키_잠금.json')], capture_output=True, text=True, encoding='utf-8')

    def prepare(self):
        self.write('SYNK_보안/a.txt', '값')
        bundle = M.Bundle('열쇠', 'whole', ('unmet23', '77yuhbs'), keep=2, roots=[M.Root(self.home / 'SYNK_보안')])
        M.run_bundle(self.ctx, bundle)

    def test_pass_and_plaintext_removed(self):
        self.prepare()
        folder = self.base / '시험'
        done = self.run_drill(folder, self.base / 'a')
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertFalse(folder.exists())
        body = json.loads((M.state_root(self.home) / '복원시험.json').read_text(encoding='utf-8'))
        self.assertTrue(body['성공'])
        self.assertEqual(body['대조']['같음'], 1)
        self.assertTrue(body['평문지움'])

    def test_remapped_onedrive_copy_is_compared_with_the_original(self):
        self.write('OneDrive/SYNK/시스템/글.md', '원본')
        bundle = M.Bundle('열쇠', 'whole', ('unmet23', '77yuhbs'), keep=2, roots=[M.Root(self.home / 'OneDrive')])
        M.run_bundle(self.ctx, bundle)
        done = self.run_drill(self.base / '시험', self.base / 'a')
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        body = json.loads((M.state_root(self.home) / '복원시험.json').read_text(encoding='utf-8'))
        self.assertEqual((body['대조']['같음'], body['대조']['없음']), (1, 0))
        self.assertEqual(body['장부누락']['열쇠']['없음'], 0)

    def test_ledger_check_finds_missing_file(self):
        self.prepare()
        ledger = M.Ledger(self.home, '열쇠')
        ledger.files['SYNK_보안/없는파일.txt'] = [1, 1, 0, 'p']
        M.write_json(ledger.state_file, ledger.files)
        done = self.run_drill(self.base / '시험', self.base / 'a')
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        body = json.loads((M.state_root(self.home) / '복원시험.json').read_text(encoding='utf-8'))
        self.assertEqual(body['장부누락']['열쇠']['없음'], 1)

    def test_refuses_folder_it_did_not_make(self):
        self.prepare()
        folder = self.base / '내문서'
        folder.mkdir()
        (folder / '소중한파일.txt').write_text('x', encoding='utf-8')
        done = self.run_drill(folder, self.base / 'a')
        self.assertNotEqual(done.returncode, 0)
        self.assertTrue((folder / '소중한파일.txt').exists())

    def test_corrupted_part_fails_but_keeps_going(self):
        self.prepare()
        part = next(p for p in (self.base / 'a' / '열쇠').iterdir() if p.name.endswith('.enc'))
        raw = bytearray(part.read_bytes())
        raw[-100] ^= 1
        part.write_bytes(bytes(raw))
        folder = self.base / '시험'
        done = self.run_drill(folder, self.base / 'a')
        self.assertNotEqual(done.returncode, 0)
        self.assertFalse(folder.exists())
        self.assertFalse(json.loads((M.state_root(self.home) / '복원시험.json').read_text(encoding='utf-8'))['성공'])


if __name__ == '__main__':
    unittest.main(verbosity=1)
