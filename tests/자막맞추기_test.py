"""자막 맞추기(tools/자막맞추기.py) 시험 — 받아쓰기 모델·네트워크 없이 돈다(받아쓰기 낱말은 가짜로 준다).

실행: python -X utf8 tests/자막맞추기_test.py
옛 make_srt_v*.py의 셈(박 눈금·끼운 마디·앞당김·끝 화면)을 그대로 옮겨 견주고, 한번에_맞추기.py 정렬은 합성 소리로 본다.
"""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('subtitle_tool', ROOT / 'tools' / '자막맞추기.py')
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


class SRT쓰기(unittest.TestCase):
    def test_시각_글꼴(self):
        self.assertEqual(M.ts(0.1), '00:00:00,100')
        self.assertEqual(M.ts(3725.0005), '01:02:05,000')
        self.assertEqual(M.ts(61.2345), '00:01:01,234')
        self.assertAlmostEqual(M.parse_ts('00:01:01,234'), 61.234)

    def test_옛_스크립트와_같은_모양(self):
        cues = [(0.2, 3.0, ['Ready? 한글!', 'Ready? Hangeul!']), (3.4, 6.0, ['그, 아, 가!', 'geu + a = ga!'])]
        want = '1\n00:00:00,200 --> 00:00:03,000\nReady? 한글!\nReady? Hangeul!\n\n2\n00:00:03,400 --> 00:00:06,000\n그, 아, 가!\ngeu + a = ga!\n'
        self.assertEqual(M.render_srt(cues), want)
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, 'subtitles-en.srt')
            M.write_srt(cues, out)
            self.assertEqual(Path(out).read_bytes(), want.encode('utf-8'))  # LF만, BOM 없음
            self.assertEqual(M.read_srt(out), cues)

    def test_겹치거나_거꾸로면_쓰지_않는다(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, 'x.srt')
            for cues, why in [([(1, 2, ['a']), (1.5, 3, ['b'])], '겹침'), ([(2, 2, ['a'])], '늦지 않다'), ([(1, 2, [' '])], '비었다')]:
                with self.assertRaisesRegex(M.자막오류, why):
                    M.write_srt(cues, out)
            self.assertFalse(os.path.exists(out))
            with self.assertRaisesRegex(M.자막오류, '영상 끝'):
                M.write_srt([(1, 9.5, ['a'])], out, video_seconds=9.0)
            warnings = M.write_srt([(1, 2, ['x' * 43])], out)
            self.assertIn('43자', warnings[0])

    def test_있는_자막은_같으면_그대로_다르면_덮어쓰기가_있어야(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, 'subtitles-ko.srt')
            Path(out).write_text('손으로 고친 자막\n', encoding='utf-8')
            with self.assertRaisesRegex(M.자막오류, '덮지 않는다'):
                M.write_srt([(1, 2, ['가'])], out)
            self.assertEqual(Path(out).read_text(encoding='utf-8'), '손으로 고친 자막\n')
            M.write_srt([(1, 2, ['가'])], out, overwrite=True)
            M.write_srt([(1, 2, ['가'])], out)   # 같은 내용이면 덮어쓰기 없이도 통과
            self.assertEqual(M.read_srt(out), [(1.0, 2.0, ['가'])])
            # 명령으로도: 다른 내용이면 종료 1, --덮어쓰기면 0
            spec = os.path.join(d, '큐.json')
            Path(spec).write_text('{"cues": [[1, 3, "나"]]}', encoding='utf-8')
            self.assertEqual(M.main(['srt', spec, '-o', out]), 1)
            self.assertEqual(M.read_srt(out), [(1.0, 2.0, ['가'])])
            self.assertEqual(M.main(['srt', spec, '-o', out, '--덮어쓰기']), 0)
            self.assertEqual(M.read_srt(out), [(1.0, 3.0, ['나'])])


class 큐표(unittest.TestCase):
    def test_박_끼운마디_앞당김은_옛_셈과_같다(self):
        # 그 아 가 make_srt_v4.py의 b()·at()·sh()를 그대로 옮긴다
        BEAT, PH = 60 / 100.02, 0.284
        BAR = 4 * BEAT
        INS = [(32.672, BAR), (35.057, BAR)]
        sh = lambda t: round(t + sum(n for c, n in INS if t >= c), 3)
        b = lambda k: sh(PH + BEAT * k)
        at = lambda k: round(b(k) - 0.15, 3)
        tt = M.시각표({'박자': {'bpm': 100.02, '첫박': 0.284}, '끼움': [[32.672, BAR], [35.057, BAR]], '앞당김': 0.15})
        for k in [x / 4 for x in range(0, 560)]:
            self.assertEqual(tt.at({'박': k}), b(k), k)
            self.assertEqual(tt.at({'박': k, '앞': True}), at(k), k)
        self.assertEqual(tt.at({'박': 51.42, '앞': 0.12}), round(b(51.42) - 0.12, 3))
        self.assertEqual(tt.at({'원곡': 78.47}), sh(78.47))
        self.assertEqual(tt.at(3.4), 3.4)
        with self.assertRaisesRegex(M.자막오류, '박자'):
            M.시각표({}).at({'박': 1})

    def test_끝화면_읽어볼까요(self):
        # make_srt_v4·v6·ae-e·greeting의 끝 화면 셈: 물음 1.15초, 낱말마다 보여 주기 1초 → 답, 마지막 답은 END+8.3까지
        END = 54.0
        words = [('아이', 'ai! (child)'), ('오이', 'oi! (cucumber)'), ('우유', 'uyu! (milk)')]
        want = [(END, round(END + 1.15, 3), ['읽어 볼까요?', 'Can you read these?'])]
        for i, (ko, en) in enumerate(words):
            s, v = round(END + 1.2 + 2 * i, 3), round(END + 2.2 + 2 * i, 3)
            nxt = round(END + 3.2 + 2 * i, 3) if i < 2 else round(END + 8.3, 3)
            want += [(s, v, [ko, 'Try it first!']), (v, round(nxt - 0.05, 3), [ko + '!', en])]
        got = M.cues_from_spec({'cues': [], '끝화면': {'시작': END, '물음': ['읽어 볼까요?', 'Can you read these?'], '낱말': [list(w) for w in words]}})
        self.assertEqual(got, want)

    def test_테이크_시각으로_줄마다_큐(self):
        timing = {'segs': {'h1': {'start': 0.05, 'end': 3.14}, 's1': {'start': 3.26, 'end': 8.67}}}
        plan = {'segments': [{'id': 'h1', 'text': '클로드 계정 바꿨더니', 'show': '클로드 계정 | 바꿨더니'}, {'id': 's1', 'text': '다섯 시간'}]}
        cues = M.cues_from_timing(timing, plan, offset=1.0, lead=0.0, hold=0.3)
        self.assertEqual(cues[0], (1.05, 4.24, ['클로드 계정', '바꿨더니']))  # 머묾 0.3초가 다음 줄 0.02초 전에서 잘린다
        self.assertEqual(cues[1], (4.26, 9.97, ['다섯 시간']))


class 받아쓰기대조(unittest.TestCase):
    def test_숫자_읽기(self):
        self.assertEqual(M.sino(16), '십육')
        self.assertEqual(M.sino(2026), '이천이십육')
        self.assertEqual(M.sino(10000), '만')
        self.assertEqual(M.sino(27000), '이만칠천')
        self.assertEqual(M.sino(1086), '천팔십육')
        self.assertEqual(M.native(16), '열여섯')
        self.assertEqual(M.native(21), '스물하나')

    def test_숫자로_받아써도_맞다고_본다(self):
        self.assertEqual(M.similarity('다섯 시간 한도가 차면', '5시간 한 도가 차면'), 1.0)
        self.assertEqual(M.similarity('로그엔 같은 거절이 천팔십육 번.', '로그엔 같은 거절이 1086번'), 1.0)
        self.assertLess(M.similarity('귀가 얇다!', 'Then ears?'), 0.5)

    def test_큐마다_들린_글(self):
        cues = [(0.0, 1.0, ['손이 크다!', 'Big hands!']), (1.2, 2.0, ['귀가 얇다!', 'Thin ears!'])]
        words = [(' 손이', 0.1, 0.4), (' 크다', 0.45, 0.8), (' 기가', 1.3, 1.5), (' 얇다', 1.55, 1.9)]
        rows = M.compare_cues(cues, words, line=1, threshold=0.8)
        self.assertEqual([r['flag'] for r in rows], [False, True])
        self.assertEqual(rows[0]['heard'], '손이 크다')


class 정렬(unittest.TestCase):
    def test_쉼에_줄_경계를_붙인다(self):
        sr = 16000
        x = np.zeros(int(sr * 4.0), np.float32)
        t = np.arange(len(x)) / sr
        for a, z in [(0.3, 1.5), (2.0, 3.6)]:   # 말소리 두 덩어리, 1.5~2.0초 쉼
            x[(t >= a) & (t < z)] = 0.3 * np.sin(2 * np.pi * 180 * t[(t >= a) & (t < z)])
        segments = [{'id': 'a', 'text': '하나 둘'}, {'id': 'b', 'text': '셋 넷'}]
        words = [('하나', 0.32, 0.8), ('둘', 0.85, 1.45), ('셋', 2.05, 2.7), ('넷', 2.75, 3.55)]
        out, ratio, on, off, sil = M.align_take(segments, x, sr, words)
        self.assertEqual(ratio, 1.0)
        self.assertAlmostEqual(on, 0.3, places=2)
        self.assertAlmostEqual(off, 3.6, places=2)
        self.assertAlmostEqual(out['a']['end'], 1.5, places=2)    # 받아쓰기 끝(1.45) 대신 쉼 시작
        self.assertAlmostEqual(out['b']['start'], 2.0, places=2)  # 받아쓰기 시작(2.05) 대신 쉼 끝
        self.assertEqual(out['b']['end'], 3.6)
        self.assertEqual(len(out['a']['tokens']), 2)
        self.assertEqual(out['a']['match'], 1.0)


if __name__ == '__main__':
    unittest.main()
