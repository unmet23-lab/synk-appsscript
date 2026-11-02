"""tools/허깅페이스.py — 한도 · 예약 · 멈춤 · 남의 Space 확인을 가짜 한도와 가짜 클라이언트로 시험한다(망 · GPU 안 씀).
python -X utf8 tests/허깅페이스.test.py"""
import contextlib
import importlib.util
import io
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('허깅페이스', REPO / 'tools' / '허깅페이스.py')
hf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hf)


def 원본(남은, 넘친=0, 기본=2400):
    return {'base': 기본, 'current': 남은, 'resetsAt': '2026-11-03T12:00:37.944Z', 'overquotaUsed': 넘친}


class 가짜클라이언트:
    def __init__(self, 일=None):
        self.불림 = []
        self.일 = 일

    def predict(self, *인자, api_name=None, **이름인자):
        self.불림.append((인자, api_name, 이름인자))
        if self.일:
            return self.일()
        return 'ok'


class 바탕(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'SYNK_HF_STATE': self.temp.name})
        self.env.start()
        self.한도들 = []          # _한도원본이 차례로 돌려줄 값
        self.클라 = 가짜클라이언트()
        self.patches = [
            patch.object(hf, '_토큰', lambda: 'hf_가짜'),
            patch.object(hf, '_한도원본', lambda 토큰: self.한도들.pop(0) if len(self.한도들) > 1 else self.한도들[0]),
            patch.object(hf, '_클라이언트만들기', lambda space, 토큰, 받을곳: self.클라),
            patch.object(hf, '_내이름', lambda 토큰: 'q121235'),
            patch.object(hf.time, 'sleep', lambda s: None),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.env.stop()
        self.temp.cleanup()

    def 기록(self):
        p = Path(self.temp.name) / '사용기록.jsonl'
        return [json.loads(x) for x in p.read_text(encoding='utf-8').splitlines()] if p.exists() else []


class 한도풀기시험(unittest.TestCase):
    def test_api_꼴을_읽는다(self):
        d = hf.한도풀기(원본(2385.48, 0))
        self.assertEqual(d['기본'], 2400.0)
        self.assertAlmostEqual(d['남은'], 2385.48)
        self.assertEqual(d['넘친'], 0.0)
        self.assertEqual(d['초기화'].isoformat(), '2026-11-03T12:00:37.944000+00:00')

    def test_아직_안_쓴_날은_초기화가_없다(self):
        d = hf.한도풀기({'base': 2400, 'current': 2400, 'resetsAt': None, 'overquotaUsed': None})
        self.assertIsNone(d['초기화'])
        self.assertEqual(d['넘친'], 0.0)


class 예약시험(바탕):
    def test_남들_예약을_빼고_본다(self):
        한도 = hf.한도풀기(원본(300))
        hf.예약하기(200, '가', 한도, 여유초=30)
        with self.assertRaises(hf.한도모자람):
            hf.예약하기(100, '나', 한도, 여유초=30)   # 300 − 200 − 30 = 70 < 100
        hf.예약하기(70, '다', 한도, 여유초=30)

    def test_푼_예약과_만료된_예약은_안_센다(self):
        한도 = hf.한도풀기(원본(300))
        id가 = hf.예약하기(250, '가', 한도, 여유초=0)
        hf.예약풀기(id가)
        hf.예약하기(250, '나', 한도, 여유초=0, 지금=time.time() - hf.예약덤초 - 300)   # 이미 만료된 때로 잡은 것
        hf.예약하기(290, '다', 한도, 여유초=0)

    def test_죽은_잠금은_60초_뒤에_걷는다(self):
        자물쇠 = Path(self.temp.name) / '예약.lock'
        자물쇠.write_text('')
        옛 = time.time() - 120
        os.utime(자물쇠, (옛, 옛))
        hf.예약하기(10, '가', hf.한도풀기(원본(300)))
        self.assertFalse(자물쇠.exists())


class 부르기시험(바탕):
    def 부르기(self, **덧):
        인자 = dict(space='q121235/pulse-lora-render', api='/render', 인자=['글'], 예상초=100, 받을곳=self.temp.name)
        인자.update(덧)
        return hf.지키며_부르기(**인자)

    def test_되면_쓴초를_재고_기록한다(self):
        self.한도들 = [원본(1000), 원본(988)]
        out = self.부르기(메모='시험')
        self.assertEqual(out['결과'], 'ok')
        self.assertEqual(out['쓴초'], 12.0)
        self.assertFalse(out['넘침'])
        self.assertEqual(len(self.클라.불림), 1)
        줄 = self.기록()[-1]
        self.assertEqual((줄['결과'], 줄['쓴초'], 줄['메모'], 줄['필요초']), ('됨', 12.0, '시험', 100.0))
        self.assertEqual(json.loads((Path(self.temp.name) / '예약.json').read_text(encoding='utf-8')), [])

    def test_모자라면_부르지_않는다(self):
        self.한도들 = [원본(100)]
        with self.assertRaises(hf.한도모자람):
            self.부르기()                       # 100초 필요, 100 − 30 = 70
        self.assertEqual(self.클라.불림, [])

    def test_배수는_필요초를_곱한다(self):
        self.한도들 = [원본(250), 원본(240)]
        self.부르기(배수=2)                      # 100 × 2 = 200 ≤ 250 − 30
        self.assertEqual(self.기록()[-1]['필요초'], 200.0)
        self.한도들 = [원본(250)]
        with self.assertRaises(hf.한도모자람):
            self.부르기(배수=3)                  # 300 > 220
        self.assertEqual(len(self.클라.불림), 1)

    def test_넘친_초가_늘면_멈춤을_건다(self):
        self.한도들 = [원본(50), 원본(0, 넘친=40)]
        out = self.부르기(예상초=10)
        self.assertTrue(out['넘침'])
        self.assertIn('넘친 초', hf.멈춤보기()['까닭'])
        with self.assertRaises(hf.멈춰있음):   # 다음 호출은 막힌다
            self.부르기(예상초=10)
        self.assertEqual(len(self.클라.불림), 1)

    def test_이미_넘친_초가_있으면_부르지_않고_멈춘다(self):
        self.한도들 = [원본(0, 넘친=5)]
        with self.assertRaises(hf.멈춰있음):
            self.부르기(예상초=10)
        self.assertEqual(self.클라.불림, [])
        self.assertIsNotNone(hf.멈춤보기())

    def test_남의_space에_파일은_확인을_받아야_보낸다(self):
        self.한도들 = [원본(1000), 원본(990)]
        파일 = Path(self.temp.name) / '소리.wav'
        파일.write_bytes(b'RIFF')
        with self.assertRaises(PermissionError):
            hf.지키며_부르기('hf-audio/whisper-large-v3', 인자=[{'$파일': str(파일)}, 'transcribe'], 받을곳=self.temp.name)
        self.assertEqual(self.클라.불림, [])
        with patch.object(hf, '파일풀기', lambda v: v):   # gradio handle_file 없이
            hf.지키며_부르기('hf-audio/whisper-large-v3', 인자=[{'$파일': str(파일)}, 'transcribe'],
                        받을곳=self.temp.name, 남에게보내도됨=True)
        self.assertEqual(len(self.클라.불림), 1)

    def test_내_space에는_확인_없이_보낸다(self):
        self.한도들 = [원본(1000), 원본(990)]
        파일 = Path(self.temp.name) / '그림.png'
        파일.write_bytes(b'png')
        with patch.object(hf, '파일풀기', lambda v: v):
            self.부르기(인자=[{'$파일': str(파일)}])
        self.assertEqual(len(self.클라.불림), 1)

    def test_예상초를_모르면_부르지_않는다(self):
        with self.assertRaises(ValueError):
            hf.지키며_부르기('누군가/모르는-space', api='/x')
        self.assertEqual(self.클라.불림, [])

    def test_서버가_한도로_거절하면_한도모자람으로_바꾸고_예약을_푼다(self):
        self.한도들 = [원본(1000), 원본(1000)]
        def 거절():
            raise RuntimeError('You have exceeded your GPU quota (120s requested vs. 80s left).')
        self.클라 = 가짜클라이언트(거절)
        with self.assertRaises(hf.한도모자람):
            self.부르기()
        self.assertTrue(self.기록()[-1]['결과'].startswith('실패: RuntimeError'))
        self.assertEqual(json.loads((Path(self.temp.name) / '예약.json').read_text(encoding='utf-8')), [])

    def test_한도지키기는_남의_스크립트도_감싼다(self):
        self.한도들 = [원본(500), 원본(470)]
        with hf.한도지키기('cpuai/blender-render-studio', 60, 메모='블렌더') as 셈:
            pass
        self.assertEqual((셈['쓴초'], 셈['넘침']), (30.0, False))
        self.assertEqual(self.기록()[-1]['메모'], '블렌더')


class 파일풀기시험(unittest.TestCase):
    def test_없는_파일은_부르기_전에_막는다(self):
        with self.assertRaises(FileNotFoundError):
            hf.파일풀기([{'$파일': 'Z:/없는/파일.wav'}])

    def test_파일이있나는_속까지_본다(self):
        self.assertTrue(hf.파일이있나([['글', {'a': [{'$파일': 'x'}]}], {}]))
        self.assertFalse(hf.파일이있나([['글', {'$파일': 'x', '덤': 1}], {}]))   # 다른 열쇠가 있으면 파일 표시가 아니다


class duration찾기시험(unittest.TestCase):
    def test_숫자_함수_괄호없음을_다_찾는다(self):
        글 = ('@spaces.GPU(duration=120)\ndef a(): pass\n\n'
             '@spaces.GPU\ndef b(): pass\n\n'
             'def _dur(x):\n    return min(90, 14 + x)\n\n'
             '@spaces.GPU(duration=_dur, size="xlarge")\ndef c(x): pass\n')
        줄 = hf.duration찾기('app.py', 글)
        self.assertIn('app.py: @spaces.GPU(duration=120)', 줄)
        self.assertIn('app.py: @spaces.GPU — 괄호 없음 = 기본 60초', 줄)
        self.assertTrue(any('return min(90, 14 + x)' in x for x in 줄))
        self.assertTrue(any('size="xlarge"' in x for x in 줄))


class 목록시험(unittest.TestCase):
    def test_목록의_항목은_부를_수_있는_꼴이다(self):
        목록 = hf.목록읽기()
        self.assertGreater(len(목록), 0)
        for id, x in 목록.items():
            with self.subTest(id=id):
                self.assertRegex(id, r'^[\w.-]+/[\w.-]+$')
                self.assertTrue(x['api'].startswith('/'))
                self.assertGreater(x['예상초'], 0)
                self.assertIn(x.get('배수', 1), (1, 2))
                self.assertTrue(x['용도'])


class 명령줄시험(바탕):
    def test_한도_모자람은_끝_코드_2(self):
        self.한도들 = [원본(10)]
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            코드 = hf.main(['부르기', 'q121235/pulse-lora-render', '--인자', '["글"]', '--받을곳', self.temp.name])
        self.assertEqual(코드, 2)
        self.assertIn('한도 모자람', err.getvalue())

    def test_넘침은_끝_코드_3(self):
        self.한도들 = [원본(500), 원본(0, 넘친=3)]
        with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            코드 = hf.main(['부르기', 'q121235/pulse-lora-render', '--인자', '["글"]', '--예상초', '10', '--받을곳', self.temp.name])
        self.assertEqual(코드, 3)

    def test_풀기는_확인이_있어야_푼다(self):
        hf.멈추기('시험')
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(hf.main(['풀기']), 2)
            self.assertIsNotNone(hf.멈춤보기())
            self.assertEqual(hf.main(['풀기', '--확인']), 0)
        self.assertIsNone(hf.멈춤보기())


if __name__ == '__main__':
    unittest.main(verbosity=1)
