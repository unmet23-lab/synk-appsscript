# LAB 영어 E52 소리 — 문자 띵 · 몸으로 누름 · 보냄 · 싸늘 · ㅋ 폭포를 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「퀴즈120_키즈파티」 0~23.5초(곡 안 빈 마디 없음 — 지난 영어 편 E50 밝은_052 · E64와 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_키읔_20261126/소리/만들기.py
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
rng = np.random.default_rng(1126)


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


# 띵 — 문자 옴(두 음 위로)
t = 판(0.42)
x = np.zeros_like(t)
for f0, at in [(1318.5, 0.0), (1760.0, 0.09)]:
    u = 판(0.33)
    tone = (np.sin(2 * np.pi * f0 * u) + 0.3 * np.sin(2 * np.pi * f0 * 2 * u)) * np.exp(-u * 11)
    얹기(x, tone, at)
쓰기('ding.wav', x, 0.7)

# 누름 — 펠트 몸이 폰을 누르는 작은 퐁
u = 판(0.16)
x = np.sin(2 * np.pi * (220 - 400 * u) * u) * np.exp(-u * 34) + 띠(rng.normal(size=len(u)), 900, 3200) * np.exp(-u * 70) * 0.25
쓰기('tap.wav', x, 0.75)

# 보냄 — 짧은 슝
u = 판(0.32)
n = 띠(rng.normal(size=len(u)), 1500, 6000)
x = n * np.sin(np.pi * u / 0.32) ** 2
쓰기('send.wav', x, 0.5)

# 싸늘 — 내려가는 맑은 음 + 바람
u = 판(0.9)
x = np.sin(2 * np.pi * (1400 * np.exp(-u * 1.6)) * u) * np.exp(-u * 2.6) * 0.6
x += 띠(rng.normal(size=len(u)), 400, 1800) * np.exp(-u * 3) * 0.25
쓰기('freeze.wav', x, 0.6)

# ㅋ 폭포 — 펠트 글자가 퐁퐁 쏟아져 쌓임(2.8초 동안 퐁 열넷 + 낮은 쿵)
x = np.zeros(int(2.8 * SR))
for i in range(14):
    u = 판(0.14)
    f0 = 300 + (i * 53) % 260
    p = np.sin(2 * np.pi * (f0 - 500 * u) * u) * np.exp(-u * 30)
    얹기(x, p, i * 0.16 + 0.02, 0.8)
    얹기(x, np.sin(2 * np.pi * 90 * 판(0.18)) * np.exp(-판(0.18) * 24), i * 0.16 + 0.45, 0.5)
쓰기('pour.wav', x, 0.8)

# 배경음 — 보유곡 키즈파티 0~23.5초
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '퀴즈120_키즈파티_c10ef6f1.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 곡, '-t', '23.5', '-ar', '48000', '-ac', '2', os.path.join(여기, '..', 'remotion', 'public', 'bgm.wav')], check=True)
print('소리 다섯 + 배경음 → remotion/public')
