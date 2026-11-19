# -*- coding: utf-8 -*-
"""faster-whisper 모델을 GPU로 먼저 열고, GPU를 쓸 수 없으면 CPU로 연다(2026-11-19 유호님 「우리 gpu는 왜 안써?」).

부르는 법(tools/lib는 패키지가 아니라서 도구가 파일 경로로 읽고 sys.modules['받아쓰기장치']에 둔다):
    모델, 쓴장치 = 장치.모델열기('large-v3-turbo', cpu_threads=8)   # 쓴장치는 'GPU' 또는 'CPU'
    ... 모델.transcribe(...) ...
    장치.놓기()   # 공용 GPU 줄 잠금을 놓는다. 부르지 않아도 프로세스가 끝날 때 놓는다.

GPU로 여는 순서는 아래와 같다. 하나라도 안 되면 CPU int8로 열고, 까닭을 표준 오류에 한 줄 남긴다.
1. CUDA 12 cuBLAS · cuDNN 휠 폴더(C:\\SYNK-LoRA\\tools\\cuda12\\libs, 환경 SYNK_CUDA12_LIBS)를 이 프로세스 PATH 앞에 넣는다.
2. 공용 GPU 줄(synk-vendor/_공용차례/차례.py, 환경 SYNK_GPU_QUEUE)이 있으면 줄의 규칙으로 GPU가 비었는지 본다.
   잠금이나 번호표가 있거나, 줄 밖 학습 사슬이 살아 있거나, 차례.py 기준으로 GPU가 바쁘면 기다리지 않고 CPU로 간다.
   비어 있으면 잠금을 잡고(pid와 상한을 적는다) 쓴다. 「돌리기」 안(SYNK_GPU_TURN)이면 이미 내 차례다.
   줄이 없는 PC에서는 nvidia-smi로 남은 VRAM이 모자랄 때만 CPU로 간다.
3. WhisperModel(device='cuda', compute_type='float16')을 만들고 1초 무음을 한 번 받아쓴다.
   cuBLAS DLL이 없다는 오류는 모델을 만들 때가 아니라 첫 받아쓰기에서 나기 때문이다.
SYNK_WHISPER_CPU=1이면 늘 CPU로 연다.
"""
import atexit
import contextlib
import gc
import importlib.util
import io
import os
import subprocess
import sys
import time
from pathlib import Path

CUDA12 = Path(os.environ.get('SYNK_CUDA12_LIBS') or r'C:\SYNK-LoRA\tools\cuda12\libs')
차례경로 = Path(os.environ.get('SYNK_GPU_QUEUE') or Path.home() / 'Documents' / 'synk-vendor' / '_공용차례' / '차례.py')
필요MiB = 6000      # 줄이 없을 때만 쓴다 — large-v3 float16 모델과 CUDA 문맥에 여유를 더한 값
계산형 = {'GPU': 'float16', 'CPU': 'int8'}
_쥠 = {}            # 잡은 공용 GPU 줄 잠금: 차례 모듈 · Res · 이름


def _알림(글: str) -> None:
    print(f'받아쓰기 장치: {글}', file=sys.stderr, flush=True)


def cuda경로넣기() -> bool:
    """cuBLAS · cuDNN bin 폴더를 PATH 앞에 넣는다. 두 폴더가 다 있으면 True."""
    폴더들 = [CUDA12 / 'nvidia' / 'cublas' / 'bin', CUDA12 / 'nvidia' / 'cudnn' / 'bin']
    if not all(p.is_dir() for p in 폴더들):
        return False
    있음 = os.environ.get('PATH', '').split(os.pathsep)
    더할 = [str(p) for p in 폴더들 if str(p) not in 있음]
    if 더할:
        os.environ['PATH'] = os.pathsep.join([*더할, os.environ.get('PATH', '')])
    return True


def _차례읽기():
    if not 차례경로.is_file():
        return None
    try:
        spec = importlib.util.spec_from_file_location('_synk_공용차례', 차례경로)
        모듈 = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(모듈)
        return 모듈
    except Exception as e:  # noqa: BLE001 — 줄을 못 읽으면 VRAM만 본다
        _알림(f'공용 GPU 줄을 읽지 못해 VRAM만 본다({type(e).__name__}: {e})')
        return None


def _남은VRAM():
    try:
        r = subprocess.run(['nvidia-smi', '--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
                           capture_output=True, text=True, timeout=20, stdin=subprocess.DEVNULL,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        쓴, 전체 = (float(x) for x in r.stdout.strip().splitlines()[0].split(','))
        return 전체 - 쓴
    except Exception:  # noqa: BLE001
        return None


def _gpu자리(이름표: str, 잡기: bool, 상한분: int) -> str:
    """GPU를 써도 되면 '', 안 되면 까닭. 잡기가 참이면 공용 GPU 줄 잠금을 잡는다."""
    차례 = _차례읽기()
    if 차례 is None:
        남음 = _남은VRAM()
        if 남음 is None:
            return 'nvidia-smi를 읽지 못함'
        return '' if 남음 >= 필요MiB else f'남은 VRAM {남음:.0f} MiB가 {필요MiB} MiB보다 적음'
    if os.environ.get(차례.ENV_HELD):
        return ''
    with contextlib.redirect_stdout(sys.stderr):   # 차례.py는 표준 출력에 찍는다 — 받는 쪽 출력(JSON 줄 등)을 지킨다
        res = 차례.Res('gpu')
        줄 = res.lanes[0]
        res.clear_stale()
        if 줄.held():
            return f'공용 GPU 줄을 {줄.holder() or "누가"} 쥐고 있음'
        if res.tickets():
            return f'공용 GPU 줄에 {len(res.tickets())}개가 기다림'
        바쁨 = 차례.gpu_busy(차례.gpu_state())
        if 바쁨:
            return f'GPU가 바쁨({바쁨})'
        사슬 = 차례.gpu_chains()
        if 사슬:
            return f'줄 밖 학습 사슬 pid {", ".join(map(str, 사슬))}이 살아 있음'
        if not 잡기:
            return ''
        이름 = 차례.safe_name(이름표)
        try:
            os.mkdir(줄.lock)
        except FileExistsError:
            return '공용 GPU 줄을 방금 다른 일이 잡음'
        with open(줄.owner, 'w', encoding='utf-8') as fh:
            fh.write(f"{이름} {time.strftime('%Y-%m-%d %H:%M:%S')} 받아쓰기(faster-whisper GPU)\n")
            fh.write(f'pid={os.getpid()} until={int(time.time() + 상한분 * 60)}\n')
        _쥠.update(차례=차례, res=res, 이름=이름)
        atexit.register(놓기)
    return ''


def 놓기() -> None:
    """잡은 공용 GPU 줄 잠금을 놓는다. 잡지 않았으면 아무것도 하지 않는다."""
    if not _쥠:
        return
    차례, res, 이름 = _쥠['차례'], _쥠['res'], _쥠['이름']
    _쥠.clear()
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            차례.release(res, 이름)
    except Exception as e:  # noqa: BLE001 — 못 놓아도 이 프로세스가 끝나면 다음 사람이 치운다
        _알림(f'공용 GPU 줄 잠금을 놓지 못함({type(e).__name__}: {e})')


def _gpu못쓰는까닭(cpu: bool, 이름표: str, 잡기: bool, 상한분: int) -> str:
    if cpu:
        return 'CPU를 골랐음'
    if os.environ.get('SYNK_WHISPER_CPU') == '1':
        return 'SYNK_WHISPER_CPU=1'
    if 'torch' in sys.modules:   # torch cu130은 이름이 같은 다른 판 cudnn64_9.dll을 먼저 올린다
        return '이 프로세스에 torch가 먼저 올라 있어 cudnn64_9.dll이 엇갈릴 수 있음'
    os.environ.setdefault('CUDA_CACHE_MAXSIZE', str(4 << 30))   # 5090용 계산 캐시가 기본 한도에 밀려나지 않게
    cuda경로넣기()
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() < 1:
            return 'CUDA 장치가 없음'
    except Exception as e:  # noqa: BLE001
        return f'CUDA를 확인하지 못함({type(e).__name__})'
    try:
        return _gpu자리(이름표, 잡기, 상한분)
    except Exception as e:  # noqa: BLE001 — 줄을 보다 난 오류로 받아쓰기가 멈추지 않게
        놓기()
        return f'공용 GPU 줄을 보지 못함({type(e).__name__}: {e})'


def _시험받아쓰기(모델) -> None:
    import numpy as np
    조각, _ = 모델.transcribe(np.zeros(16000, np.float32), language='ko', beam_size=1, vad_filter=False,
                           condition_on_previous_text=False, without_timestamps=True)
    for _ in 조각:
        pass


def 모델열기(이름, *, cpu: bool = False, 차례잡기: bool = True, 상한분: int = 60, **인자):
    """(WhisperModel, 'GPU' | 'CPU')를 준다. 인자(cpu_threads · num_workers · local_files_only 등)는 두 길에 그대로 넘긴다.
    차례잡기가 거짓이면 공용 GPU 줄을 보기만 하고 잠금은 잡지 않는다(오래 떠 있는 작업자용)."""
    from faster_whisper import WhisperModel
    이름표 = f'받아쓰기-{Path(sys.argv[0] or "python").stem}-{os.getpid()}'
    까닭 = _gpu못쓰는까닭(cpu, 이름표, 차례잡기, 상한분)
    보일이름 = Path(str(이름)).name
    if not 까닭:
        모델 = None
        try:
            모델 = WhisperModel(이름, device='cuda', compute_type=계산형['GPU'], **인자)
            _시험받아쓰기(모델)
        except Exception as e:  # noqa: BLE001 — DLL 없음 · CUDA 오류 · 첫 받아쓰기 실패는 CPU로 넘긴다
            까닭 = f'GPU로 열지 못함({type(e).__name__}: {str(e)[:160]})'
        else:
            _알림(f'{보일이름}을 GPU(float16)로 연다')
            return 모델, 'GPU'
        모델 = None
        gc.collect()
        놓기()
    _알림(f'{보일이름}을 CPU(int8)로 연다 — {까닭}')
    return WhisperModel(이름, device='cpu', compute_type=계산형['CPU'], **인자), 'CPU'
