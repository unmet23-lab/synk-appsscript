# 1번 오미톡 캔 효과음 후보를 잰다 — 어택 자리 · 길이 · 크기 · 밝기, 말소리처럼 들리는 대역이 없나(귀로 못 들으니 숫자와 그림으로 먼저 고른다, 2026-11-05).
#   python -X utf8 소리고르기.py <효과음 폴더> [그림.png]
import glob
import os
import subprocess
import sys

import numpy as np

RATE = 48000
D = sys.argv[1]


def load(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).copy()


files = sorted(glob.glob(os.path.join(D, "*.wav")))
for p in files:
    x = load(p)
    pk = float(np.max(np.abs(x))) or 1
    win = int(0.002 * RATE)
    e = np.convolve(np.abs(x), np.ones(win) / win, "same")
    db = 20 * np.log10(e / pk + 1e-6)
    # 어택: 10 ms 사이 12 dB 넘게 오르는 자리(뒤로 100 ms는 건너뜀)
    on = []
    i = int(0.01 * RATE)
    step = int(0.001 * RATE)
    while i < len(db):
        if db[i] > db[i - int(0.01 * RATE)] + 12 and db[i] > -30:
            on.append(round(i / RATE, 3))
            i += int(0.10 * RATE)
        else:
            i += step
    # 0.1초 RMS 곡선(앞 3초)
    curve = []
    for k in range(0, min(len(x), 3 * RATE), int(0.1 * RATE)):
        s = x[k:k + int(0.1 * RATE)]
        curve.append(int(round(20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-6))))
    sp = np.abs(np.fft.rfft(x))
    fr = np.fft.rfftfreq(len(x), 1 / RATE)
    cen = int((sp * fr).sum() / (sp.sum() + 1e-9))
    print(f"{os.path.basename(p):14s} {len(x) / RATE:5.2f}s 봉우리 {20 * np.log10(pk):5.1f} 밝기 {cen:5d} 어택 {on[:8]}")
    print("   ", curve)
if len(sys.argv) > 2:
    args = ["ffmpeg", "-y", "-v", "error"]
    for p in files:
        args += ["-i", p]
    parts = "".join(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=mono,atrim=0:3,apad=whole_dur=3,showspectrumpic=s=420x140:legend=disabled:scale=log:fscale=log[s{i}];" for i in range(len(files)))
    cols = 2
    rows = (len(files) + 1) // 2
    pos = "|".join(f"{(i % cols) * 420}_{(i // cols) * 140}" for i in range(len(files)))
    parts += "".join(f"[s{i}]" for i in range(len(files))) + f"xstack=inputs={len(files)}:layout={pos}"
    subprocess.run(args + ["-filter_complex", parts, "-frames:v", "1", sys.argv[2]], check=True)
