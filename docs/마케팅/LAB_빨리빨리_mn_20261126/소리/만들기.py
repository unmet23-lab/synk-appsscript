# LAB 몽골 M54 소리 — 기숙사 로비 바탕 · 엘리베이터 문 · 딩 · 버튼 딸깍 · 전자레인지 웅 · 삑 · 문 박차기 · 휙 · 되감기를 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「퀴즈120_키즈파티」 0~28.5초(곡 안 빈 마디 없음 — 지난 몽골 편 놀랐을때 · 드세요 · 추울때와 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_빨리빨리_mn_20261126/소리/만들기.py
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
rng = np.random.default_rng(1128)


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


# 로비 바탕 — 낮은 환기 소리(28.5초)
u = 판(28.5)
L = 띠(rng.normal(size=len(u)), 90, 500) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * u)) + 0.15 * np.sin(2 * np.pi * 60 * u)
R = 띠(rng.normal(size=len(u)), 90, 500) * (0.7 + 0.3 * np.cos(2 * np.pi * 0.1 * u)) + 0.15 * np.sin(2 * np.pi * 60 * u)
쓰기('room.wav', np.stack([L, R], axis=1), 0.45)

# 엘리베이터 문 미끄러짐 — 0.8초 낮은 쉬익
t = 판(0.8)
env = np.sin(np.pi * t / 0.8) ** 1.5
쓰기('slide.wav', 띠(rng.normal(size=len(t)), 200, 1800) * env, 0.6)

# 문 닫힘 — 둔한 쿵
t = 판(0.35)
쓰기('thunk.wav', (np.sin(2 * np.pi * 95 * t) + 0.5 * 저역(rng.normal(size=len(t)), 400)) * np.exp(-t * 18), 0.85)

# 딩 — 엘리베이터 도착 두 음(E6 · C6)
t = 판(1.4)
d1 = np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 3.2)
d2 = np.zeros_like(t)
k = int(0.28 * SR)
d2[k:] = np.sin(2 * np.pi * 1046.5 * t[: len(t) - k]) * np.exp(-t[: len(t) - k] * 3.0)
쓰기('ding.wav', d1 + d2 + 0.15 * np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 6), 0.6)

# 버튼 딸깍
t = 판(0.06)
쓰기('click.wav', 띠(rng.normal(size=len(t)), 1500, 6000) * np.exp(-t * 120) + 0.4 * np.sin(2 * np.pi * 900 * t) * np.exp(-t * 90), 0.8)

# 전자레인지 웅 — 낮은 윙 + 선풍기 바람(4초)
t = 판(4.0)
hum = 0.6 * np.sin(2 * np.pi * 120 * t) + 0.25 * np.sin(2 * np.pi * 240 * t) + 0.5 * 띠(rng.normal(size=len(t)), 300, 2500)
쓰기('hum.wav', hum * np.minimum(1, t / 0.15), 0.4)

# 삑 — 표시창 초가 줄 때
t = 판(0.12)
쓰기('beep.wav', np.sin(2 * np.pi * 2200 * t) * np.minimum(1, t / 0.005) * np.clip((0.12 - t) / 0.02, 0, 1), 0.5)

# 문 박차기 — 걸쇠 딸깍 + 쿵(문이 열려 벽에 닿음)
t = 판(0.5)
latch = 띠(rng.normal(size=len(t)), 2500, 8000) * np.exp(-t * 80)
bang = np.zeros_like(t)
k = int(0.07 * SR)
bang[k:] = (np.sin(2 * np.pi * 140 * t[: len(t) - k]) + 0.6 * 저역(rng.normal(size=len(t) - k), 600)) * np.exp(-t[: len(t) - k] * 14)
쓰기('bang.wav', latch * 0.7 + bang, 0.9)

# 휙 — 반전 칸
t = 판(0.5)
쓰기('whoosh.wav', 띠(rng.normal(size=len(t)), 400, 4000) * np.sin(np.pi * t / 0.5) ** 2, 0.6)

# 되감기 — 테이프가 거꾸로 감기는 짧은 소리(⏪ 첫날 그림)
t = 판(0.6)
f = 1400 - 900 * t / 0.6
ph = 2 * np.pi * np.cumsum(f) / SR
쓰기('rewind.wav', (np.sin(ph) * 0.5 + 띠(rng.normal(size=len(t)), 1000, 5000) * 0.4) * np.sin(np.pi * t / 0.6), 0.5)

# 반짝 — 끝 줄
t = 판(0.9)
s = sum(np.sin(2 * np.pi * fq * t) * np.exp(-(t - i * 0.08).clip(0) * 7) * (t >= i * 0.08) for i, fq in enumerate([1568, 2093, 2637]))
쓰기('sparkle.wav', s, 0.45)

# 음악 — 보유곡 퀴즈120_키즈파티 0~28.5초(편 28.2초)
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '퀴즈120_키즈파티_c10ef6f1.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 곡, '-t', '28.5', '-ar', '48000', '-ac', '2', os.path.join(여기, '..', 'remotion', 'public', 'bgm.wav')], check=True)
print('소리 끝')
