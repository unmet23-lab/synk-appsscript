# LAB 몽골 M32 소리 — 방 공기 · 찬 바람 · 서리 번지는 소리 · 쨍 · 이 떨림 · 되감기 · 햇살 · 새소리 · 톡을 모두 직접 만든다(남의 음원 없음)
# 음악은 보유곡 「05_Toddler-Kids」(0~53초 빈 마디 없음 — 지난 두 몽골 편 M33 밝은_052 · M26 따뜻_118, 같은 날 13시 M37 01_Joyful과 다른 곡)를 0초부터 자른다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_수고하세요_mn_20261109/소리/만들기.py
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
t = 판(23)
쓰기('air.wav', 저역(rng.standard_normal(len(t)), 320) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.08 * t)), 0.5)

# 찬 바람 — 얼어 있는 동안 밑에 깐다
d = 판(5.6)
바람 = 띠(rng.standard_normal(len(d)), 260, 1500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.55 * d + 0.7)) + 0.4 * 띠(rng.standard_normal(len(d)), 1800, 5200) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.31 * d))
바람 *= np.minimum(1, d / 0.5) * np.minimum(1, (d[-1] - d) / 0.6)
쓰기('wind.wav', 바람, 0.6)

# 서리 번지는 소리 — 얼음 갈라지는 틱틱이 점점 빽빽하게 + 낮은 쉭 + 끝에 쨍
d = 판(1.8)
버퍼 = np.zeros(len(d))
for k in range(190):
    at = 1.55 * rng.random() ** 0.62
    c = 판(0.02 + 0.03 * rng.random())
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 2600, 12000) * np.exp(-c * 150), at, 0.5 + 0.9 * at / 1.55)
쉭 = 띠(rng.standard_normal(len(d)), 900, 7000) * (d / d[-1]) ** 1.5 * np.minimum(1, (d[-1] - d) / 0.1) * 0.35
낮음 = 저역(rng.standard_normal(len(d)), 240) * (d / d[-1]) * np.minimum(1, (d[-1] - d) / 0.2) * 0.9
쨍 = np.zeros(len(d))
c = 판(0.32)
얹기(쨍, (np.sin(2 * np.pi * 3100 * c) + 0.7 * np.sin(2 * np.pi * 4730 * c) + 0.5 * np.sin(2 * np.pi * 6420 * c)) * np.exp(-c * 15), 1.46, 0.5)
쓰기('freeze.wav', 버퍼 + 쉭 + 낮음 + 쨍, 0.9)

# 쨍 하나 — 얼어붙은 교수님 칸
c = 판(0.8)
쓰기('ting.wav', (np.sin(2 * np.pi * 2640 * c) + 0.6 * np.sin(2 * np.pi * 3960 * c) + 0.35 * np.sin(2 * np.pi * 5820 * c)) * np.exp(-c * 7), 0.6)

# 이 떨림 — 부들부들
d = 판(0.9)
쓰기('shiver.wav', 띠(rng.standard_normal(len(d)), 900, 4200) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 21 * d))) * np.sin(np.pi * d / d[-1]), 0.5)

# 되감기 — 위로 빨려 올라가는 쉭 + 틱틱이 거꾸로
d = 판(0.7)
f = 500 + 3800 * (d / d[-1]) ** 2
쓰기('rewind.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.22 * np.sin(np.pi * d / d[-1]) + 띠(rng.standard_normal(len(d)), 1400, 9000) * (d / d[-1]) * np.minimum(1, (d[-1] - d) / 0.05) * 0.7, 0.75)

# 햇살 — 올라가는 맑은 음 넷
d = 판(1.5)
버퍼 = np.zeros(len(d))
for i, n in enumerate([523.25, 659.25, 783.99, 1046.5]):
    c = 판(1.1)
    얹기(버퍼, (np.sin(2 * np.pi * n * c) + 0.3 * np.sin(2 * np.pi * 2 * n * c)) * np.exp(-c * 3.6), 0.08 * i, 0.8)
쓰기('sunup.wav', 버퍼, 0.6)

# 새소리 — 짧은 짹짹 몇 번
d = 판(2.4)
버퍼 = np.zeros(len(d))
for at in [0.1, 0.32, 0.95, 1.2, 1.46, 2.0]:
    c = 판(0.12)
    f = 3200 + 1500 * np.sin(np.pi * c / c[-1])
    얹기(버퍼, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * c / c[-1]) ** 2, at, 0.7 + 0.3 * rng.random())
쓰기('birds.wav', 버퍼, 0.5)

# 톡
d = 판(0.09)
쓰기('pop.wav', np.sin(2 * np.pi * (900 - 4200 * d) * d) * np.exp(-d * 42), 0.75)

# 곡
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '05_Toddler-Kids_alex-morgan.mp3')
if not os.path.exists(곡):
    곡 = r'C:/Users/q1212/Documents/SYNK-appsscript/docs/홍보물/BGM/05_Toddler-Kids_alex-morgan.mp3'
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', 곡, '-t', '23', '-ar', '48000', '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
