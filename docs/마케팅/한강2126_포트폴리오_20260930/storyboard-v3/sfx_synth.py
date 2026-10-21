# -*- coding: utf-8 -*-
"""편집에 쓰는 효과음을 합성한다(48kHz 스테레오 wav). 휙(whoosh), 낮은 울림(boom), 상승음(riser), 둔탁한 충격(thud), 시간 멈춤 종(ring).

    python sfx_synth.py <결과 폴더>
"""
import os, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
rng = np.random.RandomState(7)


def env_ad(n, a, d, curve=2.0):
    e = np.ones(n, np.float32)
    na, nd = int(a * SR), int(d * SR)
    if na > 0:
        e[:na] = np.linspace(0, 1, na) ** 0.5
    if nd > 0:
        e[-nd:] = np.linspace(1, 0, nd) ** curve
    return e


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x).astype(np.float32)


def lp(x, hz, order=2):
    sos = butter(order, hz / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x).astype(np.float32)


def save(name, x, peak=0.8, pan=0.0):
    x = x / (np.abs(x).max() + 1e-9) * peak
    l = x * (1 - max(0, pan)); r = x * (1 + min(0, pan))
    wavfile.write(os.path.join(OUT, name), SR, (np.stack([l, r], 1) * 32767).astype(np.int16))
    print(name, round(len(x) / SR, 2), "s")


def whoosh(dur=0.45, f0=300, f1=3000, direction=1.0):
    # 띠 통과 노이즈의 중심을 f0→f1로 쓸어 올린다. 조각마다 필터를 바꾼다.
    n = int(dur * SR)
    noise = rng.randn(n).astype(np.float32)
    out = np.zeros(n, np.float32)
    seg = 480
    for i in range(0, n, seg):
        u = i / n
        fc = f0 * (f1 / f0) ** (u if direction > 0 else 1 - u)
        out[i:i + seg] = bp(noise[i:i + seg], fc * 0.6, min(fc * 1.6, 20000))[: len(out[i:i + seg])]
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return out * e


def boom(dur=1.2, f=48.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * (f * t - 12 * t * t / dur))      # 살짝 떨어지는 음정
    x += 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)
    x += 0.25 * lp(rng.randn(n).astype(np.float32), 180) * np.exp(-t * 10)
    return x * np.exp(-t * 2.6) * env_ad(n, 0.004, 0.2)


def riser(dur=1.4, f0=120, f1=2600):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.randn(n).astype(np.float32)
    out = np.zeros(n, np.float32)
    seg = 480
    for i in range(0, n, seg):
        u = i / n
        fc = f0 * (f1 / f0) ** (u ** 1.3)
        out[i:i + seg] = bp(noise[i:i + seg], fc * 0.5, min(fc * 2.0, 20000))[: len(out[i:i + seg])]
    tone = np.sin(2 * np.pi * (f0 * 2) * t * (1 + 1.5 * t / dur))
    x = out * (0.3 + 0.7 * (t / dur) ** 2) + 0.15 * tone * (t / dur) ** 3
    return x * env_ad(n, 0.05, 0.03)


def thud(dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * (70 * t - 40 * t * t)) * np.exp(-t * 14)
    x += 0.6 * lp(rng.randn(n).astype(np.float32), 900) * np.exp(-t * 30)
    x += 0.2 * bp(rng.randn(n).astype(np.float32), 1500, 5000) * np.exp(-t * 60)
    return x * env_ad(n, 0.002, 0.1)


def ring(dur=1.6, f=1760.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + 0.3 * np.sin(2 * np.pi * f * 1.5 * t) * np.exp(-t * 4)
    return x * env_ad(n, 0.003, 0.3)


def snap(dur=0.25):
    # 시간이 돌아오는 순간: 짧고 밝은 딱 소리 + 낮은 한 번
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.randn(n).astype(np.float32), 2000, 9000) * np.exp(-t * 70)
    x += 0.8 * np.sin(2 * np.pi * 90 * t) * np.exp(-t * 25)
    return x * env_ad(n, 0.001, 0.05)


save("whoosh_up.wav", whoosh(0.45, 250, 4000, 1), 0.7)
save("whoosh_down.wav", whoosh(0.5, 3500, 220, 1), 0.7)
save("whoosh_side.wav", whoosh(0.35, 400, 2500, 1), 0.6)
save("boom.wav", boom(), 0.85)
save("riser.wav", riser(), 0.6)
save("thud.wav", thud(), 0.85)
save("ring.wav", ring(), 0.35)
save("snap.wav", snap(), 0.8)
