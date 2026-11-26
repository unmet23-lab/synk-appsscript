# LAB 몽골 M82 소리 — 겨울밤 거리 바탕 · 컵 밂 · 흥 · 흔들리는 탑 · 숙임 · 반짝 · 컵 놓음 · 폴짝을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「따뜻_118」 0~21초(곡 안 빈 마디 62.25초 뒤라 안 듦 — 지난 몽골 13시 편 덥다뜨겁다 시티팝_147과 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_드세요_mn_20261126/소리/만들기.py
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
rng = np.random.default_rng(1127)


def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 띠(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bp', fs=SR, output='sos'), x)


def 얹기(버퍼, x, at, 세기=1.0):
    j = int(at * SR)
    n = min(len(x), len(버퍼) - j)
    if n > 0:
        버퍼[j:j + n] += x[:n] * 세기


# 겨울밤 거리 바탕 — 낮은 바람 + 철판이 지글거리는 작은 소리(21초)
u = 판(21.0)
wind = 띠(rng.normal(size=len(u)), 120, 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * u))
sizzle = 띠(rng.normal(size=len(u)), 3000, 9000) * 0.18 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * u))
L = wind + sizzle
R = 띠(rng.normal(size=len(u)), 120, 700) * (0.6 + 0.4 * np.cos(2 * np.pi * 0.09 * u)) + sizzle
쓰기('street.wav', np.stack([L, R], axis=1), 0.5)

# 컵 밂 — 종이컵이 나무 판 위를 스침
u = 판(0.45)
x = 띠(rng.normal(size=len(u)), 700, 2600) * np.sin(np.pi * u / 0.45) ** 1.5
쓰기('slide.wav', x, 0.55)

# 흥 — 낮은 짧은 콧소리 대신 낮은 둥
u = 판(0.3)
x = np.sin(2 * np.pi * (140 - 40 * u) * u) * np.exp(-u * 9)
쓰기('hmph.wav', x, 0.5)

# 흔들리는 탑 — 종이컵이 덜컹
x = np.zeros(int(1.4 * SR))
for i, at in enumerate([0.0, 0.32, 0.6, 0.95]):
    v = 판(0.12)
    얹기(x, 띠(rng.normal(size=len(v)), 900, 3500) * np.exp(-v * 40), at, 1 - i * 0.15)
쓰기('wobble.wav', x, 0.6)

# 숙임 — 부드러운 휙
u = 판(0.5)
x = 띠(rng.normal(size=len(u)), 300, 1500) * np.sin(np.pi * u / 0.5) ** 2
쓰기('bow.wav', x, 0.45)

# 반짝 — 맑은 세 음
x = np.zeros(int(0.9 * SR))
for f0, at in [(1568, 0.0), (2093, 0.08), (2637, 0.16)]:
    v = 판(0.6)
    얹기(x, np.sin(2 * np.pi * f0 * v) * np.exp(-v * 7), at, 0.6)
쓰기('sparkle.wav', x, 0.6)

# 컵 놓음 — 톡
u = 판(0.14)
x = np.sin(2 * np.pi * 520 * u) * np.exp(-u * 45) + 띠(rng.normal(size=len(u)), 1500, 4000) * np.exp(-u * 80) * 0.3
쓰기('cup.wav', x, 0.6)

# 폴짝 — 뽁
u = 판(0.18)
x = np.sin(2 * np.pi * (300 + 900 * u) * u) * np.exp(-u * 22)
쓰기('pop.wav', x, 0.6)

곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '따뜻_118.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 곡, '-t', '21.0', '-ar', '48000', '-ac', '2', os.path.join(여기, '..', 'remotion', 'public', 'bgm.wav')], check=True)
print('소리 여덟 + 배경음 → remotion/public')
