# LAB 몽골 M60 「-어라 · 또 와라」 소리를 모두 직접 만든다(남의 음원 없음). 48kHz 스테레오 16비트.
# 음악: 하숙집 낮 = 통통 튀는 현 잔소리 박자(G장조 · 120BPM, M22 「-지 마」의 C장조 112BPM과 다른 줄), 공항 = 혼자 치는 느린 피아노(D장조 · 60BPM).
# 효과: 밥그릇 쿵 · 목도리 휙휙 · 지퍼 지익 · 반찬통 꾹 · 말풍선 톡 · 공항 웅 · 바퀴 구름 · 고무신 끽 · 유리문 스르륵 · 훌쩍.
# 만들기: python -I -X utf8 docs/마케팅/LAB_또와라_mn_20261117/소리/만들기.py
import os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
공개 = os.path.join(여기, '..', 'remotion', 'public')
밖 = os.path.join(공개, 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1117)
TOTAL = 20.6


def 쓰기(이름, x, peak=0.85, 곳=밖):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(곳, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 띠(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def 저역(x, hi, order=2):
    return sosfilt(butter(order, hi, btype='low', fs=SR, output='sos'), x)


def 놓기(buf, x, at, 세기=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if 0 <= i < len(buf):
        buf[i:j] += x[: j - i] * 세기


def 튕김(f, dur=0.5, vel=0.5):
    n = int(SR / f)
    y = np.zeros(int(dur * SR))
    b = rng.uniform(-1, 1, n)
    for i in range(len(y)):
        y[i] = b[i % n]
        b[i % n] = 0.5 * (b[i % n] + b[(i + 1) % n]) * 0.993
    return vel * y * np.minimum(1, (dur - 판(dur)) / 0.05)


def 건반(f, dur, vel=0.5):
    t = 판(dur)
    env = np.exp(-t * 1.2) * (1 - np.exp(-t * 400))
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) * np.exp(-t * 2.2) + 0.18 * np.sin(6 * np.pi * f * t) * np.exp(-t * 4)
    return vel * x * env


def 잔향(x, 길이=1.2, 양=0.3):
    r = rng.standard_normal(int(길이 * SR)) * np.exp(-판(길이) * 4.0)
    return x + fftconvolve(x, r)[: len(x)] * 양 * 0.06


N = {'D3': 146.83, 'E3': 164.81, 'F#3': 185.0, 'G3': 196.0, 'A3': 220.0, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63,
     'F#4': 369.99, 'G4': 392.0, 'A4': 440.0, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F#5': 739.99, 'G2': 98.0, 'C3': 130.81}

# 하숙집 낮 — 잔소리 박자(0 ~ 9.6초)
b = 60 / 120
buf = np.zeros(int(9.8 * SR))
패턴 = ['G4', 'B4', 'D5', 'B4', 'C5', 'E5', 'C5', 'A4', 'D4', 'F#4', 'A4', 'D5', 'G4', 'B4', 'D5', 'G4']
for k in range(int(9.4 / (b / 2))):
    놓기(buf, 튕김(N[패턴[k % 16]], 0.45, 0.4 if k % 2 == 0 else 0.28), k * b / 2)
    if k % 4 == 0:
        놓기(buf, 튕김(N[['G2', 'C3', 'D3', 'G2'][(k // 8) % 4]], 0.8, 0.5), k * b / 2)
쓰기('bgm_day.wav', 잔향(buf, 0.5, 0.25), 0.8, 공개)

# 공항 — 느린 피아노(9.3초 ~ 끝)
b = 1.0
buf = np.zeros(int(11.8 * SR))
마디 = [(['D3', 'A3', 'F#4'], 'A4'), (['B3', 'D4', 'F#4'], 'D5'), (['G3', 'B3', 'D4'], 'B4'), (['A3', 'C4', 'E4'], 'E5'), (['D3', 'A3', 'F#4'], 'F#5')]
at = 0.0
for i, (화, 위) in enumerate(마디):
    for j, n in enumerate(화):
        놓기(buf, 건반(N[n], 3.4, 0.28), at + j * 0.35)
    놓기(buf, 건반(N[위], 3.6, 0.32), at + 1.2)
    at += 2.3
쓰기('bgm_dusk.wav', 잔향(buf, 1.8, 0.6), 0.8, 공개)

# 공항 웅(넓은 홀 · 멀리 안내 방송 같은 낮은 울림, 말 없음)
t = 판(11.6)
홀 = 저역(rng.standard_normal(len(t)), 220) * 0.7 + 띠(rng.standard_normal(len(t)), 600, 1800) * 0.04 * (1 + 0.6 * np.sin(2 * np.pi * 0.21 * t))
쓰기('hall.wav', np.stack([홀, np.roll(홀, 3100)], axis=1), 0.3)

# 하숙집 방 소리(작은 실내)
t = 판(9.8)
방 = 저역(rng.standard_normal(len(t)), 300) * 0.5
쓰기('room.wav', np.stack([방, np.roll(방, 1800)], axis=1), 0.22)

# 밥그릇 쿵(나무 식탁)
t = 판(0.6)
쿵 = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t * 8) + 60) / SR) * np.exp(-t * 9) + 저역(rng.standard_normal(len(t)), 1200) * np.exp(-t * 25) * 0.7
쓰기('thud.wav', 쿵, 0.85)

# 말풍선 톡
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * np.cumsum(620 + 880 * np.exp(-t * 30)) / SR) * np.exp(-t * 28), 0.5)

# 목도리 휙휙(감는 소리 셋)
t = 판(0.9)
감 = np.zeros(len(t))
for k in range(3):
    s = 판(0.22)
    놓기(감, 띠(rng.standard_normal(len(s)), 700, 3500) * np.sin(np.pi * s / 0.22) ** 2, 0.05 + k * 0.26, 1 - k * 0.15)
쓰기('wrap.wav', 감, 0.5)

# 반찬통 꾹꾹(뚜껑 눌리는 짧은 끽)
t = 판(0.5)
꾹 = np.zeros(len(t))
for k in range(2):
    s = 판(0.12)
    놓기(꾹, np.sin(2 * np.pi * np.cumsum(900 + 500 * s / 0.12) / SR) * np.exp(-s * 30) + 띠(rng.standard_normal(len(s)), 1500, 5000) * np.exp(-s * 50) * 0.4, 0.04 + k * 0.2)
쓰기('squish.wav', 꾹, 0.45)

# 카드 반짝
t = 판(0.5)
반 = np.zeros(len(t))
for k, f in enumerate([1175, 1480, 1760]):
    s = int(k * 0.09 * SR)
    tt = t[: len(t) - s]
    반[s:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9)
쓰기('sparkle.wav', 반, 0.35)

# 바퀴 구름(무빙워크 위 가방)
t = 판(2.4)
구름 = 띠(rng.standard_normal(len(t)), 150, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) * np.minimum(1, t / 0.2) * np.minimum(1, (2.4 - t) / 0.4)
쓰기('roll.wav', 구름, 0.35)

# 고무신 끽 — 끌려가며 바닥에 미끄러지는 소리(두 번)
t = 판(1.6)
끽 = np.zeros(len(t))
for k, (at, dur) in enumerate([(0.0, 0.55), (0.75, 0.7)]):
    s = 판(dur)
    f = 1300 + 500 * np.sin(2 * np.pi * 3 * s) + 300 * s / dur
    놓기(끽, (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6 + 띠(rng.standard_normal(len(s)), 2000, 6000) * 0.3) * np.sin(np.pi * s / dur) ** 0.7, at)
쓰기('squeak.wav', 끽, 0.5)

# 휙
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5000) * np.sin(np.pi * t / 0.4) ** 2, 0.4)

# 유리문 스르륵 + 탁
t = 판(1.3)
문 = 띠(rng.standard_normal(len(t)), 300, 2500) * np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 1.5 * 0.5
놓기(문, 저역(rng.standard_normal(int(0.1 * SR)), 1500) * np.exp(-판(0.1) * 40), 1.1, 0.8)
쓰기('door.wav', 문, 0.45)

# 훌쩍
t = 판(0.28)
쓰기('sniff.wav', 띠(rng.standard_normal(len(t)), 900, 4200, 4) * np.sin(np.pi * t / 0.28) ** 2, 0.55)
# 지퍼 지익(롱패딩 지퍼를 끝까지 — 잘게 딸깍이며 올라가는 소리)
t = 판(0.6)
지 = np.zeros(len(t))
for k in range(36):
    at = 0.02 + k * 0.015
    s = 판(0.012)
    놓기(지, 띠(rng.standard_normal(len(s)), 2500 + 40 * k, 8000) * np.exp(-s * 300), at, 0.6 + 0.01 * k)
쓰기('zip.wav', 지, 0.45)
print('ok')
