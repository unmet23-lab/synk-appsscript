# LAB 영어 E32 소리 — 방 공기 · 시계 째깍 · 바늘이 튀는 퉁 · 바늘 도는 드르륵 · 휙 · 뽁 · 딩동댕을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「퀴즈120_키즈파티」(120.12 BPM · 킥 0.294 + 0.4995k초, 0~65초 빈 마디 없음 — 지난 두 편 E31 밝은_052 · E29 따뜻_118과 다른 곡)를 0초부터 영상보다 길게 자른다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_세시삼십분_20261109/소리/만들기.py
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


# 방 공기 — 낮은 공기 + 창밖 먼 소리(말 사이가 비지 않게 영상 끝까지)
길이 = 28
t = 판(길이)
공기 = 저역(rng.standard_normal(len(t)), 300) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.09 * t))
먼 = 띠(rng.standard_normal(len(t)), 300, 1500) * 0.12 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t + 2))
쓰기('room.wav', 공기 + 먼, 0.5)


# 째깍 — 나무 시계 짧은 두 결(째 · 깍)
def 째깍(f, 세기=1.0):
    d = 판(0.07)
    소리 = 띠(rng.standard_normal(len(d)), f * 0.7, f * 1.6) * np.exp(-d * 95)
    몸 = np.sin(2 * np.pi * (f * 0.42) * d) * np.exp(-d * 70) * 0.5
    return (소리 + 몸) * 세기


쓰기('tick.wav', 째깍(2300), 0.8)
쓰기('tock.wav', 째깍(1700), 0.8)

# 퉁 — 바늘이 튀어나오는 소리(내려가는 고무 + 낮은 쿵)
d = 판(0.34)
f = 300 * np.exp(-d * 7) + 70
쿵 = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-d * 11)
쓰기('boing.wav', 쿵 + 0.25 * 띠(rng.standard_normal(len(d)), 200, 1400) * np.exp(-d * 30), 0.85)

# 투닥 — 다툼 박마다 짧은 나무 부딪힘(바늘 둘이 부딪는다)
d = 판(0.12)
쓰기('clack.wav', 띠(rng.standard_normal(len(d)), 500, 3400) * np.exp(-d * 45) + 0.6 * np.sin(2 * np.pi * 240 * d) * np.exp(-d * 40), 0.8)

# 휙
d = 판(0.45)
창 = np.sin(np.pi * d / d[-1]) ** 1.6
쉭 = 띠(rng.standard_normal(len(d)), 700, 5200) * 창 * (0.5 + 0.5 * d / d[-1])
쓰기('whoosh.wav', 쉭, 0.7)

# 드르륵 — 바늘이 빠르게 도는 1초(째깍이 점점 빨라졌다 잦아듦)
길 = 1.0
버퍼 = np.zeros(int(길 * SR))
at = 0.0
i = 0
while at < 길 - 0.05:
    얹기(버퍼, 째깍(2100 if i % 2 else 1600), at, 0.5 + 0.5 * np.sin(np.pi * at / 길))
    간격 = 0.075 - 0.05 * np.sin(np.pi * at / 길)
    at += 간격
    i += 1
쓰기('spin.wav', 버퍼, 0.8)


# 음 하나 — 나무 실로폰 결
def 음(f, sec=0.42):
    d = 판(sec)
    return (np.sin(2 * np.pi * f * d) + 0.35 * np.sin(2 * np.pi * f * 3.9 * d) * np.exp(-d * 14)) * np.exp(-d * 8)


# 딩동댕 — 도 · 미 · 솔 위로
버퍼 = np.zeros(int(1.2 * SR))
for at, f in [(0.0, 784.0), (0.17, 988.0), (0.34, 1175.0)]:
    얹기(버퍼, 음(f, 0.7), at)
쓰기('chime.wav', 버퍼, 0.8)

# 뽁
d = 판(0.09)
쓰기('pop.wav', np.sin(2 * np.pi * (900 - 4200 * d) * d) * np.exp(-d * 42), 0.75)

# 음악 — 편 길이보다 길게
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '퀴즈120_키즈파티_c10ef6f1.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 곡, '-t', '27', '-ar', '48000', '-ac', '2', '-af', 'afade=t=out:st=25.8:d=1.2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝:', sorted(os.listdir(밖)))
