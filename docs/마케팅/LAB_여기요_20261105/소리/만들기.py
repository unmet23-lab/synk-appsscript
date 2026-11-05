# LAB 영어 E27 소리 — 고깃집 웅성임 · 지글지글 · 그릇 부딪힘 · 달리는 발소리 · 휙 · 숨 들이마심 · 외침 충격 · 얼어붙는 딱 · 쌓이는 그릇 · 무너짐을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 시티팝_147에서 영상 길이만큼 자른다(지난 두 편과 다른 곡 — 제작 절차 「한 장면 먼저」 ③).
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1105)
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
def 고역(x, lo, order=2):
    return sosfilt(butter(order, lo, 'hp', fs=SR, output='sos'), x)
def 얹기(버퍼, x, at, 세기=1.0):
    j = int(at * SR)
    if j >= len(버퍼):
        return
    n = min(len(x), len(버퍼) - j)
    버퍼[j:j + n] += x[:n] * 세기

# 웅성임 — 말이 알아들리지 않는 식당 사람들 소리(음절처럼 오르내리는 대역 잡음을 여러 겹)
길이 = 26
t = 판(길이)
웅 = np.zeros(len(t))
for i in range(14):
    f = 260 + rng.random() * 620
    x = 띠(rng.standard_normal(len(t)), f, f * 2.2)
    떨 = 0.5 + 0.5 * np.sin(2 * np.pi * (2.4 + rng.random() * 3.0) * t + rng.random() * 6.28)
    묶 = 0.6 + 0.4 * np.sin(2 * np.pi * (0.2 + rng.random() * 0.4) * t + rng.random() * 6.28)
    웅 += x * 떨 ** 2 * 묶
쓰기('room.wav', np.stack([웅, np.roll(웅, 700)], axis=1), 0.6)

# 지글지글 — 고기 굽는 소리(고역 잡음 + 터지는 낱알)
t = 판(길이)
지 = 고역(rng.standard_normal(len(t)), 3800) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.31 * t))
for _ in range(900):
    at = rng.random() * (길이 - 0.05)
    d = 판(0.006 + rng.random() * 0.012)
    얹기(지, 고역(rng.standard_normal(len(d)), 2500) * np.exp(-d * 500), at, 2.2)
쓰기('sizzle.wav', 지, 0.5)

# 그릇 부딪힘 — 짧은 도자기 · 쇠 소리
def 그릇(f, 감쇠=38):
    d = 판(0.28)
    x = sum(w * np.sin(2 * np.pi * f * m * d) for w, m in [(1, 1), (0.55, 2.31), (0.3, 3.76), (0.18, 5.4)])
    return (x * np.exp(-d * 감쇠) + 고역(rng.standard_normal(len(d)), 2600) * np.exp(-d * 140) * 0.35) * np.minimum(1, d / 0.0008)
쓰기('clink.wav', 그릇(1850), 0.6)
쓰기('clink2.wav', 그릇(2460, 46), 0.6)

# 달리는 발소리 — 펠트 신발 셋이 후다닥(1.6초)
길이 = 1.6
버퍼 = np.zeros(int(길이 * SR))
for i in range(22):
    at = i * 0.068 + rng.random() * 0.012
    d = 판(0.07)
    x = np.sin(2 * np.pi * (120 + rng.random() * 60) * d) * np.exp(-d * 60) + 띠(rng.standard_normal(len(d)), 300, 1800) * np.exp(-d * 90) * 0.4
    얹기(버퍼, x, at, 0.6 + 0.4 * i / 22)
쓰기('run.wav', 버퍼, 0.8)
# 한 사람이 지나가는 발소리(0.9초)
길이 = 0.9
버퍼 = np.zeros(int(길이 * SR))
for i in range(8):
    at = i * 0.105
    d = 판(0.07)
    얹기(버퍼, np.sin(2 * np.pi * 140 * d) * np.exp(-d * 60) + 띠(rng.standard_normal(len(d)), 300, 1600) * np.exp(-d * 90) * 0.35, at, 1 - abs(i - 4) * 0.12)
쓰기('step.wav', 버퍼, 0.6)

# 휙 — 화면 앞을 스쳐 간다
t = 판(0.45)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.45) ** 2, 0.7)

# 숨 들이마심 — 점점 올라가는 숨(몸이 부푼다)
t = 판(1.5)
n = rng.standard_normal(len(t))
숨 = 띠(n, 700, 4200) * (t / 1.5) ** 1.5
올 = np.sin(2 * np.pi * np.cumsum(180 + 340 * (t / 1.5) ** 1.6) / SR) * (t / 1.5) ** 2 * 0.22
쓰기('inhale.wav', 숨 + 올, 0.55)

# 외침 충격 — 큰 낮은 쿵 + 공기가 터지는 소리
t = 판(1.1)
쿵 = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t * 3.2) + 42) / SR) * np.exp(-t * 4.2)
터 = 띠(rng.standard_normal(len(t)), 300, 6500) * np.exp(-t * 7)
쓰기('boom.wav', 쿵 * 0.9 + 터 * 0.5, 0.9)

# 얼어붙는 딱 — 모두 돌아보는 순간(나무 막대 + 짧은 음)
t = 판(0.32)
쓰기('snap.wav', 띠(rng.standard_normal(len(t)), 1400, 5200) * np.exp(-t * 110) + np.sin(2 * np.pi * 880 * t) * np.exp(-t * 26) * 0.4, 0.8)

# 펠트 뽁 — 글자 · 말풍선이 나타날 때
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 쌓이는 그릇 — 연달아 탁탁탁(1초)
길이 = 1.0
버퍼 = np.zeros(int(길이 * SR))
for i in range(9):
    얹기(버퍼, 그릇(1500 + rng.random() * 1400, 42), i * 0.085 + rng.random() * 0.02, 0.8)
쓰기('stack.wav', 버퍼, 0.7)
# 묻히는 소리 — 그릇과 음식이 와르르 내려앉고 맨 위 그릇이 빙글 돌다 멈춘다
길이 = 1.8
버퍼 = np.zeros(int(길이 * SR))
for i in range(26):
    얹기(버퍼, 그릇(1200 + rng.random() * 2200, 40), 0.02 + i * 0.03 + rng.random() * 0.02, 0.8 - i * 0.012)
d = 판(0.9)
at = 0.85
gap = 0.14
for _ in range(11):  # 간격이 줄어드는 합이 끝에 못 닿으니 횟수로 끊는다
    얹기(버퍼, 그릇(2100, 60), at, 0.4)
    at += gap
    gap *= 0.84
쓰기('pile.wav', 버퍼, 0.8)

# 음악 — 보유곡 시티팝_147, 가장 꽉 찬 자리 앞(60초)부터 영상보다 길게
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '62', '-t', '26', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
