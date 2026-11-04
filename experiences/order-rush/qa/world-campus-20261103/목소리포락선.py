"""
주문 폭주 캠퍼스 판 — 손님별 주문 음성(assets/world/voice/<손님>/<주문>.mp3)마다 목소리 막대 다섯의 포락선을 굽는다(2026-11-03, 손님별은 11-04).

    python -I -X utf8 experiences/order-rush/qa/world-campus-20261103/목소리포락선.py

왜: 막대를 실제 음성 크기로 움직이려고 <audio>를 오디오 문맥(AnalyserNode)에 물리면, 아이폰에서 문맥이 멈춘 순간 주문이 무음이 된다
(Fable 2판 검토 P0-1 — 이 게임의 전부인 듣기 길). 그래서 음성 길은 그대로 두고, 미리 잰 값을 재생 위치(currentTime)로 읽는다(world-play.mjs).
하는 일: 초당 25장, 말소리 다섯 대역(80~250 · 250~600 · 600~1500 · 1500~3500 · 3500~8000Hz)의 RMS를 dB로 재고,
대역마다 모든 주문의 99번째 백분위를 0dB로, −36dB 아래는 0으로 두어 0~35 한 글자(36진법)로 적는다.
나가는 것: experiences/order-rush/assets/world/voice-env.json  { fps, bands, orders: { "손님/주문": "글자 × (장 수 × 5)" } }
"""
import json
import subprocess
from pathlib import Path

import numpy as np

뿌리 = Path(__file__).resolve().parents[2]
소리 = 뿌리 / "assets" / "world" / "voice"
낼 = 뿌리 / "assets" / "world" / "voice-env.json"
SR = 44100
FPS = 25
대역 = [(80, 250), (250, 600), (600, 1500), (1500, 3500), (3500, 8000)]
바닥 = -36.0


def 읽기(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def 재기(p):
    x = 읽기(p)
    hop = SR // FPS
    n = 2048
    while n < hop * 2:
        n *= 2
    pad = np.pad(x, (n // 2, n // 2))
    frames = np.lib.stride_tricks.sliding_window_view(pad, n)[::hop][: int(np.ceil(len(x) / hop))]
    mag = np.abs(np.fft.rfft(frames * np.hanning(n), axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    e = np.stack([mag[:, (f >= lo) & (f < hi)].sum(axis=1) for lo, hi in 대역], axis=1)
    return 10 * np.log10(e + 1e-12)


모두 = {f"{p.parent.name}/{p.stem}": 재기(p) for p in sorted(소리.glob("g*/*.mp3"))}
쌓음 = np.concatenate(list(모두.values()))
기준 = np.percentile(쌓음, 99, axis=0)
결과 = {"fps": FPS, "bands": len(대역), "floorDb": 바닥, "orders": {}}
for 이름, db in 모두.items():
    k = np.clip((db - 기준 - 바닥) / -바닥, 0, 1)
    q = np.round(k * 35).astype(int)
    결과["orders"][이름] = "".join(np.base_repr(v, 36).lower() for v in q.reshape(-1))
낼.write_text(json.dumps(결과, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(len(결과["orders"]), "개 ·", 낼.stat().st_size, "바이트 ·", {k: len(v) // len(대역) for k, v in list(결과["orders"].items())[:3]})
