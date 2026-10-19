# 지유 스킨케어 · A1 원본을 마디 격자(음악_마디격자.py)대로 잘라 마디마다 크기·저역·고역과 박별 저역을 표로 낸다(짜임 찾기).
#   python -X utf8 음악_마디표.py <원본.wav>
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

sys.stdout.reconfigure(encoding="utf-8")
SRC = sys.argv[1]
grid = json.load(open(SRC[:-4] + "_마디격자.json", encoding="utf-8"))
sr, x = wavfile.read(SRC)
x = x.astype(np.float64)
x = (x.mean(axis=1) if x.ndim == 2 else x) / 32768.0
low = sosfiltfilt(butter(4, 150, "lowpass", fs=sr, output="sos"), x)
high = sosfiltfilt(butter(4, 3000, "highpass", fs=sr, output="sos"), x)


def db(v):
    return 20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-9)


print("마디  시작     전체   저역   고역 | 박별 저역(1·2·3·4)      | 박별 전체")
pre = (0, grid[0]["t"])
a, b = int(pre[0] * sr), int(pre[1] * sr)
print(f"  0 {pre[0]:7.3f}  {db(x[a:b]):6.1f} {db(low[a:b]):6.1f} {db(high[a:b]):6.1f} | (못갖춘마디)")
for r in grid:
    t, L = r["t"], r["bar_s"]
    a, b = int(t * sr), int(min(len(x), (t + L) * sr))
    if b - a < sr // 2:
        break
    q = (b - a) // 4
    lows = " ".join(f"{db(low[a + i * q:a + (i + 1) * q]):6.1f}" for i in range(4))
    fulls = " ".join(f"{db(x[a + i * q:a + (i + 1) * q]):6.1f}" for i in range(4))
    print(f"{r['bar']:3d} {t:7.3f}  {db(x[a:b]):6.1f} {db(low[a:b]):6.1f} {db(high[a:b]):6.1f} | {lows} | {fulls}")
# 곡 끝: 마지막 마디 뒤 소리가 -60dB 아래로 떨어지는 때
e = np.array([db(x[i:i + sr // 20]) for i in range(int(grid[-1]["t"] * sr), len(x) - sr // 20, sr // 20)])
tail = [grid[-1]["t"] + i * 0.05 for i, v in enumerate(e) if v < -60]
print(f"끝: 마지막 마디 {grid[-1]['t']:.3f}초, -60dB 아래로 처음 떨어지는 때 {tail[0] if tail else '없음'}, 파일 끝 {len(x) / sr:.3f}초")
