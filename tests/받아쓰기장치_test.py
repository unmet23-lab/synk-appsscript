"""받아쓰기 장치(tools/lib/받아쓰기장치.py) 시험 — faster-whisper · CUDA 없이 가짜 모델로 돈다.

실행: python -X utf8 tests/받아쓰기장치_test.py
공용 GPU 줄 시험은 진짜 차례.py를 임시 폴더에 옮겨 그 폴더의 잠금 · 번호표로 본다(공용 줄은 건드리지 않는다).
차례.py가 없는 PC에서는 그 시험을 건너뛴다.
"""
import importlib.util
import os
import shutil
import sys
import tempfile
import time
import types
import unittest
from pathlib import Path
from unittest import mock

import numpy  # noqa: F401 — 시험마다 sys.modules를 되돌려도 numpy는 한 번만 올린다(두 번 올리면 ImportError)

ROOT = Path(__file__).resolve().parent.parent
진짜차례 = Path(os.environ.get('SYNK_GPU_QUEUE') or Path.home() / 'Documents' / 'synk-vendor' / '_공용차례' / '차례.py')


def 장치읽기():
    spec = importlib.util.spec_from_file_location('받아쓰기장치_시험', ROOT / 'tools' / 'lib' / '받아쓰기장치.py')
    모듈 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(모듈)
    return 모듈


class 가짜모델:
    불림 = []
    gpu실패 = False

    def __init__(self, 이름, device, compute_type, **인자):
        self.device = device
        가짜모델.불림.append((device, compute_type, 인자))

    def transcribe(self, 소리, **인자):
        if self.device == 'cuda' and 가짜모델.gpu실패:
            raise RuntimeError('Library cublas64_12.dll is not found or cannot be loaded')
        return iter([]), None


class 바탕(unittest.TestCase):
    cuda수 = 1

    def setUp(self):
        가짜모델.불림, 가짜모델.gpu실패 = [], False
        self.임시 = tempfile.TemporaryDirectory()
        self.폴더 = Path(self.임시.name)
        fw = types.ModuleType('faster_whisper')
        fw.WhisperModel = 가짜모델
        ct2 = types.ModuleType('ctranslate2')
        ct2.get_cuda_device_count = lambda: self.cuda수
        환경 = {k: v for k, v in os.environ.items() if k not in ('SYNK_GPU_TURN', 'SYNK_WHISPER_CPU')}
        self.막이 = [mock.patch.dict(sys.modules, {'faster_whisper': fw, 'ctranslate2': ct2}),
                   mock.patch.dict(os.environ, 환경, clear=True)]
        for p in self.막이:
            p.start()
        sys.modules.pop('torch', None)
        self.장치 = 장치읽기()
        self.장치.CUDA12 = self.폴더 / '없는cuda'

    def tearDown(self):
        self.장치.놓기()
        for p in reversed(self.막이):
            p.stop()
        self.임시.cleanup()

    def 장치들(self):
        return [(d, c) for d, c, _ in 가짜모델.불림]


class 줄없는PC(바탕):
    def setUp(self):
        super().setUp()
        self.장치._차례읽기 = lambda: None

    def test_VRAM이_넉넉하면_GPU(self):
        self.장치._남은VRAM = lambda: 20000.0
        모델, 쓴장치 = self.장치.모델열기('small', cpu_threads=8)
        self.assertEqual(쓴장치, 'GPU')
        self.assertEqual(self.장치들(), [('cuda', 'float16')])
        self.assertEqual(가짜모델.불림[0][2], {'cpu_threads': 8})   # 기존 인자는 그대로 넘긴다

    def test_VRAM이_모자라면_CPU(self):
        self.장치._남은VRAM = lambda: 1000.0
        _, 쓴장치 = self.장치.모델열기('small', cpu_threads=8)
        self.assertEqual(쓴장치, 'CPU')
        self.assertEqual(self.장치들(), [('cpu', 'int8')])
        self.assertEqual(가짜모델.불림[0][2], {'cpu_threads': 8})

    def test_첫_받아쓰기가_실패하면_CPU로_다시_만든다(self):
        self.장치._남은VRAM = lambda: 20000.0
        가짜모델.gpu실패 = True
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual(쓴장치, 'CPU')
        self.assertEqual(self.장치들(), [('cuda', 'float16'), ('cpu', 'int8')])

    def test_고르면_CPU_GPU는_보지_않는다(self):
        self.장치._남은VRAM = lambda: self.fail('VRAM을 보면 안 된다')
        _, 쓴장치 = self.장치.모델열기('small', cpu=True)
        self.assertEqual(쓴장치, 'CPU')
        os.environ['SYNK_WHISPER_CPU'] = '1'
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual(쓴장치, 'CPU')

    def test_torch가_먼저_올라_있으면_CPU(self):
        self.장치._남은VRAM = lambda: 20000.0
        with mock.patch.dict(sys.modules, {'torch': types.ModuleType('torch')}):
            _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual(쓴장치, 'CPU')


class 줄오류(바탕):
    def test_줄을_보다_오류가_나면_CPU(self):
        def 잠김(이름):
            raise PermissionError('gpu.queue를 만들 수 없음')
        self.장치._차례읽기 = lambda: types.SimpleNamespace(ENV_HELD='SYNK_GPU_TURN', Res=잠김)
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual((쓴장치, self.장치들()), ('CPU', [('cpu', 'int8')]))


class CUDA없음(바탕):
    cuda수 = 0

    def test_CUDA_장치가_없으면_CPU(self):
        self.장치._차례읽기 = lambda: self.fail('줄을 볼 필요가 없다')
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual((쓴장치, self.장치들()), ('CPU', [('cpu', 'int8')]))


@unittest.skipUnless(진짜차례.is_file(), '공용 GPU 줄(차례.py)이 없는 PC')
class 공용GPU줄(바탕):
    def setUp(self):
        super().setUp()
        shutil.copy(진짜차례, self.폴더 / '차례.py')
        self.장치.차례경로 = self.폴더 / '차례.py'
        self.바쁨 = None
        진짜읽기 = self.장치._차례읽기

        def 읽기():
            차례 = 진짜읽기()
            차례.gpu_state = lambda: (0.0, 24000.0, 0.0, 20.0)
            차례.gpu_busy = lambda st: self.바쁨
            차례.gpu_chains = lambda: []
            return 차례
        self.장치._차례읽기 = 읽기
        self.잠금 = self.폴더 / 'gpu.lock'

    def test_비었으면_잠금을_잡고_놓기로_놓는다(self):
        _, 쓴장치 = self.장치.모델열기('small', 상한분=5)
        self.assertEqual(쓴장치, 'GPU')
        첫줄, 둘째 = (self.잠금 / 'owner.txt').read_text(encoding='utf-8').splitlines()
        self.assertTrue(첫줄.startswith('받아쓰기-'))
        값 = dict(x.split('=') for x in 둘째.split())
        self.assertEqual(int(값['pid']), os.getpid())
        self.assertAlmostEqual(int(값['until']), time.time() + 300, delta=30)
        self.장치.놓기()
        self.assertFalse(self.잠금.exists())
        self.assertIn('받아쓰기-', (self.폴더 / 'gpu.기록.tsv').read_text(encoding='utf-8'))

    def test_GPU로_못_열면_잡은_잠금도_놓는다(self):
        가짜모델.gpu실패 = True
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual(쓴장치, 'CPU')
        self.assertFalse(self.잠금.exists())

    def test_남이_쥐고_있으면_기다리지_않고_CPU(self):
        self.잠금.mkdir()
        (self.잠금 / 'owner.txt').write_text(
            f"lora-학습 {time.strftime('%Y-%m-%d %H:%M:%S')} 밤샘 학습\npid={os.getpid()} until={int(time.time()) + 3600}\n",
            encoding='utf-8')
        시작 = time.time()
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual((쓴장치, self.장치들()), ('CPU', [('cpu', 'int8')]))
        self.assertLess(time.time() - 시작, 10)
        self.assertTrue((self.잠금 / 'owner.txt').read_text(encoding='utf-8').startswith('lora-학습'))

    def test_번호표가_기다리면_CPU(self):
        (self.폴더 / 'gpu.queue').mkdir(exist_ok=True)
        (self.폴더 / 'gpu.queue' / f'{int(time.time())}_목소리떼기').touch()
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual(쓴장치, 'CPU')
        self.assertFalse(self.잠금.exists())

    def test_GPU가_바쁘면_CPU(self):
        self.바쁨 = '메모리 18000/24463 MiB · 사용률 95%'
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual(쓴장치, 'CPU')
        self.assertFalse(self.잠금.exists())

    def test_오래_떠_있는_작업자는_보기만_하고_잡지_않는다(self):
        _, 쓴장치 = self.장치.모델열기('small', 차례잡기=False)
        self.assertEqual(쓴장치, 'GPU')
        self.assertFalse(self.잠금.exists())

    def test_돌리기_안이면_이미_내_차례(self):
        self.바쁨 = '내 「돌리기」가 쥔 GPU'
        os.environ['SYNK_GPU_TURN'] = '1'
        _, 쓴장치 = self.장치.모델열기('small')
        self.assertEqual(쓴장치, 'GPU')
        self.assertFalse(self.잠금.exists())


if __name__ == '__main__':
    unittest.main()
