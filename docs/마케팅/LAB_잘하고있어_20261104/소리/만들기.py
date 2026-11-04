# LAB 영어 E25 소리 — 시계 초침 · 연필 구름 · 한숨 · 창문 · 바람 · 책장 · 글자 닿는 소리 · 연필 쓰는 소리 · 배경 음악(펠트 피아노)을 모두 직접 만든다(남의 음원 없음).
import os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1104)
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

# 초침 — 조용한 방의 째깍(1초에 한 번, 18초)
길이 = 20
초침 = np.zeros(int(길이 * SR))
for i in range(길이):
    d = 판(0.03)
    x = 띠(rng.standard_normal(len(d)), 1800, 6000) * np.exp(-d * 260)
    j = int(i * SR)
    초침[j:j + len(d)] += x * (1 if i % 2 == 0 else 0.7)
# 방 소리 — 말 사이가 완전히 비지 않게 아주 낮은 숨(올리기 전 검사 ⑰)
방 = 저역(rng.standard_normal(len(초침)), 900) * 0.012
쓰기('tick.wav', 초침 * 0.5 + 방, 0.5)

# 연필 구름 — 나무 연필이 종이 위를 데굴데굴 굴러 멈춘다
길이 = 1.0
t = 판(길이)
잇 = np.zeros(len(t))
at = 0.0
gap = 0.05
while at < 0.8:
    j = int(at * SR)
    d = 판(0.018)
    잇[j:j + len(d)] += 띠(rng.standard_normal(len(d)), 700, 3200) * np.exp(-d * 240)
    at += gap
    gap *= 1.16
쓰기('roll.wav', 잇, 0.5)

# 한숨 — 부드럽게 빠지는 숨(말 아님)
t = 판(1.0)
숨 = 띠(rng.standard_normal(len(t)), 300, 1500) * np.sin(np.pi * t / 1.0) ** 1.6
쓰기('sigh.wav', 숨, 0.42)

# 창문 — 나무 창이 조금 열리는 삐걱
t = 판(0.6)
f = 300 + 260 * t / 0.6 + 12 * np.sin(2 * np.pi * 18 * t)
삐걱 = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 21 * t))) * np.sin(np.pi * t / 0.6) ** 1.2
쓰기('creak.wav', 띠(삐걱, 250, 2600), 0.35)

# 밤바람 — 커튼이 들리는 약한 바람 / 책장을 넘기는 센 바람
t = 판(3.0)
n = rng.standard_normal(len(t))
약풍 = 띠(n, 180 + 0, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * t + 1)) * np.sin(np.pi * t / 3.0)
쓰기('breeze.wav', 약풍, 0.4)
t = 판(1.4)
n = rng.standard_normal(len(t))
강풍 = 띠(n, 260, 2600) * np.sin(np.pi * t / 1.4) ** 0.7 * (0.75 + 0.25 * np.sin(2 * np.pi * 3.1 * t))
쓰기('gust.wav', 강풍, 0.7)

# 책장 — 종이가 빠르게 넘어간다
길이 = 1.2
버퍼 = np.zeros(int(길이 * SR))
for i in range(13):
    at = 0.02 + i * 0.075 + 0.004 * i * i
    d = 판(0.06)
    x = 띠(rng.standard_normal(len(d)), 1200, 7500) * np.sin(np.pi * d / 0.06)
    j = int(at * SR)
    if j + len(d) < len(버퍼):
        버퍼[j:j + len(d)] += x * (1 - i * 0.04)
쓰기('pages.wav', 버퍼, 0.6)

# 글자가 닿는 소리 — 펠트가 내려앉는 푹 + 작은 종
t = 판(0.5)
푹 = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 24) + 띠(rng.standard_normal(len(t)), 200, 1400) * np.exp(-t * 40) * 0.5
종 = (np.sin(2 * np.pi * 1320 * t) + 0.45 * np.sin(2 * np.pi * 2640 * t) + 0.2 * np.sin(2 * np.pi * 3960 * t)) * np.exp(-t * 7)
쓰기('pom.wav', 푹 * 0.7 + 종 * 0.22, 0.7)

# 연필 쓰는 소리 — 사각사각 세 번
길이 = 1.3
버퍼 = np.zeros(int(길이 * SR))
for at, 긴 in [(0.0, 0.26), (0.34, 0.2), (0.62, 0.4)]:
    d = 판(긴)
    x = 띠(rng.standard_normal(len(d)), 2400, 9000) * np.sin(np.pi * d / 긴) ** 0.6 * (0.7 + 0.3 * np.sin(2 * np.pi * 38 * d))
    j = int(at * SR)
    버퍼[j:j + len(d)] += x
쓰기('write.wav', 버퍼, 0.42)

# 밤공기 — 창밖의 아주 작은 바람 · 먼 거리 소리(넓은 대역). 곡이 조용해 AAC가 비트를 못 쓰는 것도 막는다
길이 = 20
t = 판(길이)
공기 = 띠(rng.standard_normal(len(t)), 500, 15000) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.23 * t + 0.6))
먼 = 띠(rng.standard_normal(len(t)), 120, 600) * 0.5
쓰기('air.wav', np.stack([공기 + 먼, 띠(rng.standard_normal(len(t)), 500, 15000) + 먼], axis=1), 0.5)

# 배경 음악 — 펠트 피아노. 66BPM, F장조에서 천천히(Fmaj7 · C/E · Dm7 · B♭maj7) 분산 화음, 끝은 한 번 부푼다. 마지막은 F로 닫는다
BPM = 66
박 = 60 / BPM
길이 = 22
곡 = np.zeros(int(길이 * SR))
음 = lambda m: 440 * 2 ** ((m - 69) / 12)
def 건반(m, 세기=1.0, 길=2.6):
    d = 판(길)
    f = 음(m)
    x = np.zeros(len(d))
    for k, (w, dec) in enumerate([(1, 2.1), (0.42, 3.0), (0.16, 4.4), (0.07, 6.0), (0.03, 8.0)], start=1):
        x += w * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * d) * np.exp(-d * dec)
    망치 = 저역(rng.standard_normal(len(d)), 1400) * np.exp(-d * 90) * 0.05  # 펠트 망치 소리
    return (x + 망치) * np.minimum(1, d / 0.012) * np.minimum(1, (길 - d) / 0.3) * 세기
화음 = [[41, 60, 64, 65, 69], [40, 60, 64, 67, 72], [38, 57, 60, 65, 69], [46, 58, 62, 65, 69]]
순서 = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]
at = 0.0
for i, h in enumerate(순서):
    c = 화음[h]
    베이스 = 0.7
    j = int(at * SR)
    x = 건반(c[0], 베이스, 3.6)
    곡[j:j + len(x)] += x[: max(0, len(곡) - j)]
    for s, (m, 어디) in enumerate(zip(c[1:], [1.0, 1.5, 2.0, 3.0])):
        j2 = int((at + 어디 * 박) * SR)
        if j2 >= len(곡):
            continue
        x = 건반(m, 0.55 - s * 0.03)
        곡[j2:j2 + len(x)] += x[: max(0, len(곡) - j2)]
    at += 4 * 박
곡 = 저역(곡, 6500)
# 잔향 — 작은 방
잔 = 판(1.6)
잔향 = rng.standard_normal(len(잔)) * np.exp(-잔 * 4.2)
젖음 = fftconvolve(곡, 잔향, mode='full')[: len(곡)]
곡 = 곡 + 젖음 / np.max(np.abs(젖음)) * np.max(np.abs(곡)) * 0.35
곡 = 곡 * np.minimum(1, 판(길이) / 0.6)
쓰기('bgm.wav', 곡, 0.8)
print('완료')
