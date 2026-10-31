#!/usr/bin/env python
# 폴더 벽 소리 — 칸 하나마다 실제 크기로 음높이를 정한 짧은 낱소리를 만들어 쌓는다(남의 소리 없음).
#   python -X utf8 벽소리.py <나갈.wav> <길이초> --무너짐 <초>[:<길이>] [--되돌림 <초>:<길이>:<덩이 비율>] [--쿵 <초>] [--딱 <초>]
# 큰 폴더는 낮고 묵직하게, 작은 폴더는 높고 짧게. 무너짐은 아래로 떨어지는 음, 되돌림은 올라가는 음.
import argparse, json, os
import numpy as np
from scipy.io import wavfile

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(HERE, '자료', '폴더벽.json'), encoding='utf-8'))['행']
sizes = np.array([max(r[0], 3) for r in rows], dtype=float)
rng = np.random.default_rng(20261029)


def grain(size_mb, up, loud=1.0):
    s = np.clip(np.log10(size_mb) / 3.4, 0, 1)  # 0 작음 ~ 1 큼
    dur = 0.012 + 0.06 * s
    n = int(SR * dur)
    t = np.arange(n) / SR
    f0 = 3400 * (1 - s) ** 1.6 + 110
    f = f0 * (1 + (0.5 if up else -0.4) * t / dur)
    phase = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(phase) + 0.35 * np.sin(2 * phase)
    noise = rng.normal(0, 1, n) * 0.5
    env = np.exp(-t / (dur * 0.28)) * np.minimum(1, t / 0.001)
    return (tone * 0.7 + noise * 0.3) * env * (0.14 + 0.5 * s) * loud


def add(buf, at, sig, pan):
    i = int(at * SR)
    if i >= len(buf) or i < 0:
        return
    sig = sig[: len(buf) - i]
    buf[i:i + len(sig), 0] += sig * (1 - pan)
    buf[i:i + len(sig), 1] += sig * pan


def thud(buf, at, freq=46, dur=1.1, loud=1.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * (freq + 26 * np.exp(-t * 14)) * t) + 0.5 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 8)) * np.exp(-t * 3.6) * loud
    add(buf, at, sig, 0.5)


def tick(buf, at, loud=0.9):
    n = int(SR * 0.5)
    t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 16) + 0.6 * np.sin(2 * np.pi * 2640 * t) * np.exp(-t * 26)) * loud * 0.55
    add(buf, at, sig, 0.5)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('out'); p.add_argument('dur', type=float)
    p.add_argument('--무너짐', action='append', default=[]); p.add_argument('--되돌림', action='append', default=[])
    p.add_argument('--쿵', action='append', default=[]); p.add_argument('--딱', action='append', default=[])
    a = p.parse_args()
    buf = np.zeros((int(SR * a.dur), 2))
    for spec in a.무너짐:
        at, *rest = spec.split(':')
        at = float(at); span = float(rest[0]) if rest else 0.9
        order = rng.permutation(len(sizes))
        for i, j in enumerate(order):
            when = at + span * (i / len(order)) ** 0.8 + rng.uniform(0, 0.02)
            add(buf, when, grain(sizes[j], False), rng.uniform(0.15, 0.85))
        thud(buf, at + span, 40, 1.3, 0.85)
    for spec in a.되돌림:
        at, span, share = (float(x) for x in spec.split(':'))
        order = rng.permutation(len(sizes))[: int(len(sizes) * share)]
        for i, j in enumerate(order):
            when = at + span * (i / len(order)) ** 1.15 + rng.uniform(0, 0.02)
            add(buf, when, grain(sizes[j], True, 0.85), rng.uniform(0.15, 0.85))
    for t in a.쿵:
        thud(buf, float(t), 44, 1.4, 1.0)
    for t in a.딱:
        tick(buf, float(t))
    peak = np.abs(buf).max() or 1
    buf = np.tanh(buf / peak * 1.6) * 0.82
    wavfile.write(a.out, SR, (buf * 32767).astype(np.int16))
    print(a.out, f'{a.dur}초 · 낱소리 {len(sizes)}개 기준')


main()
