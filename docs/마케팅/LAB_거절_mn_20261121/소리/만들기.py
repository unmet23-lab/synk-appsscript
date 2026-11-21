# LAB 몽골 M68 소리 — 호프집 웅성임 · 소주 따르기 · 꽁꽁 얼어붙음 · 얼음 금 · 녹는 물방울 · ✗ 도장 · ✓ 반짝 · 폰 톡 · 봉투 사각 · 꾸벅 · 마이크 휙을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「01_Joyful-Happy-Upbeat」 0~23.4초(영상 23.3초를 다 덮는다 — 21초로 자르니 음악층이 20.25초부터 「꺼짐」을 짚었다 · 곡 안 빈 마디 38.5초~ 밖 — 지난 몽골 편 M69 밝은_052 · M63 따뜻_118 · M64 시티팝_147과 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_거절_mn_20261121/소리/만들기.py
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
rng = np.random.default_rng(1121)
길이 = 23.4


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


# 호프집 공기 — 낮은 웅성임(말 소리 띠의 잡음이 천천히 출렁) + 가끔 잔 부딪는 짤랑, 영상 끝까지(말 사이가 비지 않게)
t = 판(길이)
웅성 = 띠(rng.standard_normal(len(t)), 250, 1400) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.37 * t) * np.sin(2 * np.pi * 0.11 * t + 1))
바닥 = 저역(rng.standard_normal(len(t)), 220) * 0.5
버퍼 = 웅성 + 바닥
for at in [3.1, 6.4, 9.0, 12.7, 17.9, 19.6]:
    c = 판(0.4)
    fq = 2400 + 900 * rng.random()
    얹기(버퍼, (np.sin(2 * np.pi * fq * c) + 0.5 * np.sin(2 * np.pi * fq * 1.51 * c)) * np.exp(-c * 14), at, 0.35)
쓰기('air.wav', 버퍼, 0.5)

# 소주 따르기 — 꼴꼴꼴(부장님이 잔을 채워 내민다)
d = 판(0.9)
버퍼 = np.zeros(len(d))
at = 0.0
while at < 0.75:
    c = 판(0.07)
    fq = 420 + 160 * rng.random() + 250 * at
    얹기(버퍼, np.sin(2 * np.pi * (fq + 600 * c) * c) * np.sin(np.pi * c / c[-1]) ** 2, at, 0.6 + 0.4 * rng.random())
    at += 0.06 + 0.03 * rng.random()
쓰기('pour.wav', 버퍼 + 0.15 * 띠(rng.standard_normal(len(d)), 1500, 6000) * np.sin(np.pi * d / d[-1]), 0.6)

# 꽁꽁 얼어붙음 — 쩌적 금이 번지는 소리 + 차가운 바람 휘익(「싫어요!」 한마디에 자리 전체가 언다)
d = 판(1.6)
버퍼 = 0.5 * 띠(rng.standard_normal(len(d)), 1500, 7000) * np.minimum(1, d * 6) * np.exp(-d * 1.6)
at = 0.0
while at < 0.9:
    c = 판(0.05)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 2500, 11000) * np.exp(-c * 120), at, 0.4 + 0.8 * rng.random() * (1 - at))
    at += 0.012 + 0.03 * rng.random()
c = 판(0.5)
얹기(버퍼, np.sin(2 * np.pi * (140 - 60 * c) * c) * np.exp(-c * 9), 0.0, 0.9)  # 쿵 — 얼어붙는 첫 박
바람 = 띠(rng.standard_normal(len(d)), 400, 2500) * np.sin(np.pi * d / d[-1]) ** 1.5
쓰기('freeze.wav', 버퍼 + 0.35 * 바람, 0.85)

# 얼음 금 — 짧게 쩍(부장님 얼굴로 다가갈 때)
d = 판(0.3)
버퍼 = np.zeros(len(d))
for at in [0.0, 0.05, 0.11]:
    c = 판(0.04)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 3000, 12000) * np.exp(-c * 150), at, 1.0 - at * 3)
쓰기('crack.wav', 버퍼, 0.6)

# 녹는 물방울 — 똑(마디마다 얼음이 녹는다)
d = 판(0.35)
쓰기('drip.wav', np.sin(2 * np.pi * (900 + 1400 * np.exp(-d * 30)) * d) * np.exp(-d * 18), 0.55)

# ✗ 도장 — 쿵(틀린 말)
d = 판(0.35)
쓰기('stamp.wav', np.sin(2 * np.pi * (110 - 40 * d) * d) * np.exp(-d * 14) + 0.5 * 띠(rng.standard_normal(len(d)), 200, 1800) * np.exp(-d * 30), 0.8)

# ✓ 반짝 — 맑은 두 음(맞는 말)
버퍼 = np.zeros(int(0.8 * SR))
for at, fq in [(0.0, 1318.5), (0.09, 1975.5)]:
    c = 판(0.6)
    얹기(버퍼, (np.sin(2 * np.pi * fq * c) + 0.25 * np.sin(2 * np.pi * 2 * fq * c)) * np.exp(-c * 7), at)
쓰기('ding.wav', 버퍼, 0.45)

# 폰 톡 — 사진을 내민다(등산 · 소개팅)
d = 판(0.12)
쓰기('tap.wav', 띠(rng.standard_normal(len(d)), 2000, 7000) * np.exp(-d * 90), 0.45)

# 봉투 사각
d = 판(0.45)
버퍼 = np.zeros(len(d))
at = 0.0
while at < 0.38:
    c = 판(0.03)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 2500, 9000) * np.exp(-c * 90), at, 0.3 + 0.7 * rng.random())
    at += 0.02 + 0.04 * rng.random()
쓰기('paper.wav', 버퍼 * np.sin(np.pi * d / d[-1]), 0.45)

# 꾸벅 — 부드러운 휙(몽글이 고개 숙임)
d = 판(0.35)
쓰기('bow.wav', 띠(rng.standard_normal(len(d)), 300, 1800) * np.sin(np.pi * d / d[-1]) ** 2, 0.45)

# 마이크 휙 — 선배가 벌떡 일어나 마이크를 든다
d = 판(0.4)
휙 = 띠(rng.standard_normal(len(d)), 500, 4000) * np.sin(np.pi * d / d[-1]) ** 2
뿅 = np.sin(2 * np.pi * np.cumsum(260 + 700 * d / d[-1]) / SR) * np.exp(-d * 6)
쓰기('whoosh.wav', 0.7 * 휙 + 0.5 * 뿅, 0.7)

# 음악
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '01_Joyful-Happy-Upbeat_alex-morgan.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '0', '-i', 곡, '-t', str(길이), '-ar', '48000', '-ac', '2', '-af', f'afade=t=out:st={길이 - 0.8}:d=0.8', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝:', sorted(os.listdir(밖)))
