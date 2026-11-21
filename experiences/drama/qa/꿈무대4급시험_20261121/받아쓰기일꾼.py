# -*- coding: utf-8 -*-
"""꿈 무대 4급 시험판의 받아쓰기 일꾼(2026-11-21). 서버.mjs가 한 번 띄워 두고 줄마다 일을 준다.

이 PC의 faster-whisper(기본 large-v3-turbo, 캐시만 씀)로 받아 적는다. 돈이 드는 통로를 쓰지 않는다.
GPU · CPU 고르기와 공용 GPU 줄은 tools/lib/받아쓰기장치.py가 맡는다(오래 떠 있는 일꾼이라 줄 잠금은 잡지 않는다).
11-21 시험: 같은 Heami 녹음에서 small은 「탔는 바람에」를 「하는 바람에」로 적었고, large-v3-turbo는 「탄 바람에」 · 「알을수록」처럼
틀린 꼴을 고쳐 적지 않았다. 그래서 기본 모델이 large-v3-turbo다(환경 꿈무대_받아쓰기모델로 바꾼다).

받는 줄: {"id": 1, "path": "C:/.../a.webm"}   주는 줄: {"id": 1, "text": "...", "ms": 412} 또는 {"id": 1, "error": "..."}
처음에 한 줄 {"ready": true, "device": "GPU" | "CPU", "model": "..."}를 준다. 받은 소리 파일은 서버가 지운다.
"""
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault('HF_HUB_OFFLINE', '1')
sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')

뿌리 = Path(__file__).resolve().parents[4]
spec = importlib.util.spec_from_file_location('받아쓰기장치', 뿌리 / 'tools' / 'lib' / '받아쓰기장치.py')
장치 = importlib.util.module_from_spec(spec)
sys.modules['받아쓰기장치'] = 장치
spec.loader.exec_module(장치)

모델이름 = os.environ.get('꿈무대_받아쓰기모델', 'large-v3-turbo')
try:
    모델, 쓴장치 = 장치.모델열기(모델이름, 차례잡기=False, cpu_threads=8)
except Exception as e:  # noqa: BLE001 — 모델을 못 열면 서버가 「받아쓰기 없음」으로 돈다
    print(json.dumps({'ready': False, 'error': f'{type(e).__name__}: {str(e)[:200]}'}, ensure_ascii=False), flush=True)
    sys.exit(1)
print(json.dumps({'ready': True, 'device': 쓴장치, 'model': 모델이름}, ensure_ascii=False), flush=True)

for 줄 in sys.stdin:
    줄 = 줄.strip()
    if not 줄:
        continue
    try:
        일 = json.loads(줄)
    except json.JSONDecodeError:
        continue
    시작 = time.time()
    try:
        조각들, _ = 모델.transcribe(일['path'], language='ko', beam_size=5, temperature=0,
                                condition_on_previous_text=False, vad_filter=True)
        글 = ''.join(s.text for s in 조각들).strip()
        print(json.dumps({'id': 일.get('id'), 'text': 글, 'ms': int((time.time() - 시작) * 1000)}, ensure_ascii=False), flush=True)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({'id': 일.get('id'), 'error': f'{type(e).__name__}: {str(e)[:200]}'}, ensure_ascii=False), flush=True)
