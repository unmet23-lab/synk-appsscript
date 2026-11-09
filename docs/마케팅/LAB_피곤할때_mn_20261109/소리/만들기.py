# LAB 몽골 M37 소리 — 강의실 공기 · 연필 · 지하철 덜컹 · 편의점 삑 · 상자 무너짐 · 키보드 · 배터리 내려가는 소리 · 휴대폰 진동 · 충전 차오름 · 탬버린을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「01_Joyful-Happy-Upbeat」(0~38초 빈 마디 없음 — 지난 두 몽골 편 M33 밝은_052 · M26 따뜻_118과 다른 곡)를 0초부터 자른다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_피곤할때_mn_20261109/소리/만들기.py
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
rng = np.random.default_rng(1109)


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


# 방 공기 — 말 사이가 비지 않게 영상 끝까지
t = 판(31)
쓰기('air.wav', 저역(rng.standard_normal(len(t)), 320) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.08 * t)) + 0.1 * 띠(rng.standard_normal(len(t)), 300, 1400), 0.5)

# 강의실 — 먼 웅성임 + 분필 두어 번
d = 판(4.5)
웅성 = 띠(rng.standard_normal(len(d)), 240, 1100) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.1 * d + 1))
for at in [0.7, 1.05, 2.4, 2.75]:
    c = 판(0.14)
    얹기(웅성, 띠(rng.standard_normal(len(c)), 2400, 7000) * np.exp(-c * 26), at, 1.2)
쓰기('class.wav', 웅성, 0.6)

# 쿵 — 머리가 책상에
d = 판(0.3)
쓰기('thud.wav', np.sin(2 * np.pi * (150 * np.exp(-d * 9) + 60) * d) * np.exp(-d * 15) + 0.2 * 띠(rng.standard_normal(len(d)), 300, 1500) * np.exp(-d * 30), 0.85)

# 지하철 — 덜컹덜컹 + 낮은 울림 5초
d = 판(5.0)
울림 = 저역(rng.standard_normal(len(d)), 180) * 1.1 + 띠(rng.standard_normal(len(d)), 500, 1800) * 0.15
for at in np.arange(0.1, 4.9, 0.42):
    c = 판(0.12)
    얹기(울림, 띠(rng.standard_normal(len(c)), 120, 520) * np.exp(-c * 30), at, 1.4)
쓰기('subway.wav', 울림, 0.7)

# 찌그러짐 — 천이 눌리는 소리
d = 판(0.45)
쓰기('squish.wav', 띠(rng.standard_normal(len(d)), 300, 1600) * np.sin(np.pi * d / d[-1]) ** 2 + 0.5 * np.sin(2 * np.pi * (240 - 200 * d) * d) * np.exp(-d * 5), 0.8)

# 편의점 삑 — 바코드 두 번
버퍼 = np.zeros(int(0.5 * SR))
for at in [0.0, 0.22]:
    c = 판(0.09)
    얹기(버퍼, np.sin(2 * np.pi * 2750 * c) * np.minimum(1, (0.09 - c) * 60), at)
쓰기('beep.wav', 버퍼, 0.6)

# 상자 무너짐 — 쿵쿵쿵
버퍼 = np.zeros(int(1.0 * SR))
for at, w in [(0.0, 1.0), (0.13, 0.8), (0.27, 1.0), (0.46, 0.7), (0.62, 0.5)]:
    c = 판(0.2)
    얹기(버퍼, (np.sin(2 * np.pi * (130 + 60 * at) * c) + 0.5 * 띠(rng.standard_normal(len(c)), 400, 2600)) * np.exp(-c * 22), at, w)
쓰기('boxes.wav', 버퍼, 0.85)

# 키보드 — 타닥타닥
d = 판(2.0)
버퍼 = np.zeros(len(d))
at = 0.05
while at < 1.9:
    c = 판(0.03)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 1500, 6000) * np.exp(-c * 170), at, 0.6 + 0.4 * rng.random())
    at += 0.07 + 0.09 * rng.random()
쓰기('keys.wav', 버퍼, 0.6)

# 배터리 내려가는 소리 — 삐-용
d = 판(0.5)
f = 880 - 620 * d / d[-1]
쓰기('drain.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-d * 3.5), 0.6)

# 1% 경고 — 삐삐
버퍼 = np.zeros(int(0.5 * SR))
for at in [0.0, 0.2]:
    c = 판(0.11)
    얹기(버퍼, np.sign(np.sin(2 * np.pi * 1320 * c)) * 0.5 * np.minimum(1, (0.11 - c) * 40), at)
쓰기('low.wav', 저역(버퍼, 5000), 0.55)

# 휴대폰 진동 두 번 + 띵
버퍼 = np.zeros(int(1.3 * SR))
for at in [0.0, 0.42]:
    c = 판(0.3)
    얹기(버퍼, np.sin(2 * np.pi * 165 * c) * np.sign(np.sin(2 * np.pi * 26 * c)) * 0.9, at)
c = 판(0.5)
얹기(버퍼, (np.sin(2 * np.pi * 1320 * c) + 0.5 * np.sin(2 * np.pi * 1980 * c)) * np.exp(-c * 8), 0.8, 0.8)
쓰기('buzz.wav', 버퍼, 0.8)

# 충전 차오름 — 빠르게 올라가는 음 + 펑
d = 판(0.7)
f = 240 * np.exp(d * 3.4)
위 = np.sin(2 * np.pi * np.cumsum(f) / SR) * (d / d[-1]) ** 1.3
버퍼 = np.zeros(int(1.3 * SR))
얹기(버퍼, 위, 0.0, 0.9)
c = 판(0.55)
얹기(버퍼, (np.sin(2 * np.pi * 95 * c) + 0.7 * 띠(rng.standard_normal(len(c)), 800, 6000)) * np.exp(-c * 9), 0.7, 1.2)
쓰기('charge.wav', 버퍼, 0.85)

# 탬버린 — 박자 흔들기 3초
버퍼 = np.zeros(int(3.2 * SR))
for at in np.arange(0.0, 3.1, 0.25):
    c = 판(0.13)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 5000, 11000) * np.exp(-c * 24), at, 0.7 if int(at * 4) % 2 else 1.0)
쓰기('tamb.wav', 버퍼, 0.6)

# 뽁
d = 판(0.09)
쓰기('pop.wav', np.sin(2 * np.pi * (900 - 4200 * d) * d) * np.exp(-d * 42), 0.75)

# 음악
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '01_Joyful-Happy-Upbeat_alex-morgan.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 곡, '-t', '31', '-ar', '48000', '-ac', '2', '-af', 'afade=t=out:st=29.6:d=1.4', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝:', sorted(os.listdir(밖)))
