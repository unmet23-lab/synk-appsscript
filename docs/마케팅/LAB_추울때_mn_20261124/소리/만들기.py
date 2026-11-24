# LAB 몽골 M65 소리 — 겨울밤 바깥 바람 · 방 안 공기 · 돌풍 · 이 딱딱 · 입김 · 휴대폰 띠링 · 얼음 끼익 · 게이지 오르는 소리 · 이불 부스럭 · 쏙 · 털썩을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「05_Toddler-Kids」 21.0~51.5초(곡 안 빈 마디 없음 · 53초부터 사그라짐 — 지난 몽골 편 M68 Joyful · M49 따뜻_118 · M48 시티팝_147과 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_추울때_mn_20261124/소리/만들기.py
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
rng = np.random.default_rng(1124)


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


# 바깥 겨울밤 — 낮은 바람이 일렁인다(0~17.5초, 끝은 코드에서 줄인다)
t = 판(31)
바람 = 띠(rng.standard_normal(len(t)), 180, 900) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.21 * t + 0.4) ** 2)
쓰기('wind.wav', 바람 + 0.4 * 저역(rng.standard_normal(len(t)), 200), 0.5)

# 방 안 — 보일러 웅 · 낮은 공기(17.5초부터)
쓰기('room.wav', 저역(rng.standard_normal(len(t)), 160) + 0.15 * np.sin(2 * np.pi * 58 * t), 0.4)

# 돌풍 — 휘이잉(3.2초)
d = 판(1.6)
env = np.sin(np.pi * d / d[-1]) ** 1.5
쓰기('gust.wav', 띠(rng.standard_normal(len(d)), 300, 2600) * env + 0.3 * np.sin(2 * np.pi * np.cumsum(500 + 350 * np.sin(np.pi * d / d[-1])) / SR) * env, 0.75)

# 이 딱딱 — 이가 부딪힌다(빠른 딱딱 1.2초)
버퍼 = np.zeros(int(1.3 * SR))
at = 0.0
while at < 1.15:
    c = 판(0.025)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 2500, 7000) * np.exp(-c * 260), at, 0.6 + 0.4 * rng.random())
    at += 0.055 + 0.015 * rng.random()
쓰기('chatter.wav', 버퍼, 0.55)

# 입김 — 하아(손에 부는 소리, 목소리 아님)
d = 판(0.8)
쓰기('breath.wav', 띠(rng.standard_normal(len(d)), 700, 3500) * np.sin(np.pi * d / d[-1]) ** 2 * np.exp(-d * 0.8), 0.45)

# 휴대폰 띠링(버스 앱 알림)
버퍼 = np.zeros(int(0.9 * SR))
for at, fq in [(0.0, 1568.0), (0.12, 2093.0)]:
    c = 판(0.6)
    얹기(버퍼, (np.sin(2 * np.pi * fq * c) + 0.3 * np.sin(2 * np.pi * 3 * fq * c)) * np.exp(-c * 9), at)
쓰기('phone.wav', 버퍼, 0.5)

# 얼음 끼익 — 얼어붙는 소리(서걱 + 높은 끼익)
d = 판(0.7)
끽 = np.sin(2 * np.pi * np.cumsum(2600 + 900 * d / d[-1]) / SR) * np.exp(-d * 4) * 0.35
버퍼 = 끽.copy()
at = 0.0
while at < 0.55:
    c = 판(0.03)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 3000, 9000) * np.exp(-c * 150), at, 0.5 + 0.5 * rng.random())
    at += 0.03 + 0.04 * rng.random()
쓰기('freeze.wav', 버퍼, 0.6)

# 게이지 오르는 소리 — 또로롱(올라가는 세 음)
버퍼 = np.zeros(int(0.6 * SR))
for at, fq in [(0.0, 880.0), (0.09, 1108.7), (0.18, 1318.5)]:
    c = 판(0.25)
    얹기(버퍼, np.sin(2 * np.pi * fq * c) * np.exp(-c * 16), at)
쓰기('rise.wav', 버퍼, 0.5)

# 게이지 넘침 — 삐삐삐(999%)
버퍼 = np.zeros(int(0.8 * SR))
for at in [0.0, 0.16, 0.32]:
    c = 판(0.11)
    얹기(버퍼, np.sign(np.sin(2 * np.pi * 1480 * c)) * 0.5 * np.minimum(1, (0.11 - c) * 40), at)
쓰기('alarm.wav', 저역(버퍼, 5000), 0.5)

# 이불 부스럭
d = 판(0.9)
쓰기('rustle.wav', 띠(rng.standard_normal(len(d)), 900, 6000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 6 * d))) * np.sin(np.pi * d / d[-1]), 0.5)

# 쏙 — 머리가 이불 밖으로
d = 판(0.12)
쓰기('pop.wav', np.sin(2 * np.pi * (500 + 3500 * d / d[-1]) * d) * np.exp(-d * 30), 0.7)

# 쿵 · 털썩 — 이불이 쏟아져 쌓인다
d = 판(0.55)
쓰기('thud.wav', np.sin(2 * np.pi * (120 * np.exp(-d * 8) + 50) * d) * np.exp(-d * 9) + 0.5 * 띠(rng.standard_normal(len(d)), 300, 2000) * np.exp(-d * 10), 0.85)

# 휙
d = 판(0.35)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(d)), 400, 3500) * np.sin(np.pi * d / d[-1]) ** 2, 0.7)

# 문 열림 — 덜컥
d = 판(0.3)
쓰기('door.wav', np.sin(2 * np.pi * 90 * d) * np.exp(-d * 18) + 0.6 * 띠(rng.standard_normal(len(d)), 800, 4000) * np.exp(-d * 30), 0.6)

# 음악
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '05_Toddler-Kids_alex-morgan.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '21.0', '-i', 곡, '-t', '31.6', '-ar', '48000', '-ac', '2', '-af', 'afade=t=in:st=0:d=0.3,afade=t=out:st=30.2:d=1.4', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝:', sorted(os.listdir(밖)))
