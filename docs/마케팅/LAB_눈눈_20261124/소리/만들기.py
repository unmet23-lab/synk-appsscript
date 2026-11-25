# LAB 영어 E50 소리 — 첫눈 골목 공기 · 반짝 · 뽁 · 눈송이 내려옴 · 쏙(붙음) · 똑(이름표) · 비틀 을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「밝은_052」 1.0~23.3초(곡 안 빈 마디 29~30초와 끝 50.3초 뒤를 피함 — 지난 영어 편 E62 키즈파티 · E58 시티팝_147 · E57 따뜻_118과 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_눈눈_20261124/소리/만들기.py
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
rng = np.random.default_rng(1129)


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


def 저역(x, hi, order=2):
    return sosfilt(butter(order, hi, 'lp', fs=SR, output='sos'), x)


def 얹기(버퍼, x, at, 세기=1.0):
    j = int(at * SR)
    if j >= len(버퍼):
        return
    n = min(len(x), len(버퍼) - j)
    버퍼[j:j + n] += x[:n] * 세기


# 첫눈 골목 — 조용한 바람과 먼 동네 소리
t = 판(22.6)
쓰기('air.wav', 띠(rng.standard_normal(len(t)), 150, 700) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.17 * t)) + 0.3 * 저역(rng.standard_normal(len(t)), 180), 0.45)

# 반짝 — 첫눈(높은 음 셋)
버퍼 = np.zeros(int(1.2 * SR))
for at, fq in [(0.0, 1760.0), (0.08, 2217.5), (0.16, 2637.0)]:
    c = 판(0.7)
    얹기(버퍼, np.sin(2 * np.pi * fq * c) * np.exp(-c * 7), at, 0.7)
쓰기('chime.wav', 버퍼, 0.5)

# 뽁
d = 판(0.09)
쓰기('pop.wav', np.sin(2 * np.pi * (900 - 4200 * d) * d) * np.exp(-d * 42), 0.7)

# 눈송이 내려옴 — 부드럽게 내려가는 휘익
d = 판(0.8)
f = 1500 - 700 * d / d[-1]
쓰기('fall.wav', 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * d / d[-1]) + 0.5 * 띠(rng.standard_normal(len(d)), 1500, 6000) * np.sin(np.pi * d / d[-1]) ** 2, 0.55)

# 쏙 — 눈에 붙음(폭신한 팍)
d = 판(0.25)
쓰기('splat.wav', 띠(rng.standard_normal(len(d)), 300, 3000) * np.exp(-d * 22) + 0.6 * np.sin(2 * np.pi * (180 * np.exp(-d * 10) + 90) * d) * np.exp(-d * 18), 0.8)

# 똑 — 이름표
d = 판(0.08)
쓰기('tick.wav', np.sin(2 * np.pi * 1700 * d) * np.exp(-d * 55), 0.5)

# 비틀 — 앞이 안 보여 흔들
d = 판(0.9)
쓰기('wobble.wav', np.sin(2 * np.pi * np.cumsum(420 + 120 * np.sin(2 * np.pi * 5 * d)) / SR) * np.exp(-d * 2.5), 0.45)

# 음악
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '밝은_052.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '1.0', '-i', 곡, '-t', '22.3', '-ar', '48000', '-ac', '2', '-af', 'afade=t=in:st=0:d=0.3,afade=t=out:st=21.0:d=1.2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝:', sorted(os.listdir(밖)))
