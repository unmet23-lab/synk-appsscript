# LAB 영어 E38 「한 시간만요」 소리 — 저녁 거리 · 만화카페 방 공기(낮은 공조 + 가끔 책장 넘김) · 문 종 「딸랑」 · 발소리 · 한숨(내려가는 두 음) ·
# 벽시계 째깍 · 바늘이 세 바퀴 도는 소리(째깍이 빨라졌다 느려짐 + 휘익) · 끝에서 다시 도는 소리 · 커튼 「촤악」 · 잠 숨소리 · 스르르 녹는 「뭉」 ·
# 눈 깜빡 「뽁」 · 뾱 · 뽁 · 휙 · 맑은 종을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「따뜻_118」 0초부터 25초(빈 마디 없는 0~62초 안 · 지난 두 영어 편 E37 퀴즈120_키즈파티 · E36 시티팝_147과 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_한시간만요_20261114/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1138)


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


def 째깍(높이=1.0):
    d = 판(0.05)
    return (띠(rng.standard_normal(len(d)), 2500 * 높이, 7000) * np.exp(-d * 160) + np.sin(2 * np.pi * 1900 * 높이 * d) * np.exp(-d * 120) * 0.5)


# 저녁 거리 — 먼 차 소리 웅웅 + 바람 4초
t = 판(4.5)
거리 = 저역(rng.standard_normal(len(t)), 220) * 0.8 + 띠(rng.standard_normal(len(t)), 400, 2500) * 0.08 * (1 + 0.5 * np.sin(2 * np.pi * 0.3 * t))
쓰기('street.wav', np.stack([거리, np.roll(거리, 900)], axis=1), 0.4)

# 만화카페 방 공기 — 낮은 공조 웅웅 + 가끔 먼 책장 넘김 21초
t = 판(21)
방 = 저역(rng.standard_normal(len(t)), 160) * 0.8 + 띠(rng.standard_normal(len(t)), 300, 900) * 0.04 + np.sin(2 * np.pi * 110 * t) * 0.03
for at in [2.3, 6.8, 11.9, 16.4]:
    d = 판(0.3)
    얹기(방, 띠(rng.standard_normal(len(d)), 1500, 6000) * np.sin(np.pi * d / 0.3) ** 2 * 0.12, at)
쓰기('room.wav', np.stack([방, np.roll(방, 1300)], axis=1), 0.36)

# 문 종 — 작은 종 둘이 「딸랑」
t = 판(1.4)
종 = np.zeros(len(t))
for at, f in [(0.0, 2093), (0.09, 2637), (0.2, 2349)]:
    d = 판(1.1)
    얹기(종, sum(w * np.sin(2 * np.pi * f * k * d) for w, k in [(1, 1), (0.4, 2.76), (0.2, 5.4)]) * np.exp(-d * 5), at, 1.0)
쓰기('bell.wav', 종, 0.5)

# 발소리 — 펠트가 바닥을 톡톡(작게 넷)
t = 판(1.2)
걸음 = np.zeros(len(t))
for i in range(4):
    d = 판(0.08)
    얹기(걸음, np.sin(2 * np.pi * np.cumsum(230 * np.exp(-d * 40) + 90) / SR) * np.exp(-d * 50), 0.05 + i * 0.27, 1.0 - 0.1 * i)
쓰기('steps.wav', 걸음, 0.45)

# 한숨 — 내려가는 두 음(「후우…」)과 숨 바람
t = 판(1.1)
한숨 = 띠(rng.standard_normal(len(t)), 300, 2200) * np.interp(t, [0, 0.15, 0.9, 1.1], [0, 0.6, 0.2, 0]) * 0.5
for at, f in [(0.0, 330), (0.35, 262)]:
    d = 판(0.6)
    얹기(한숨, sum(np.sin(2 * np.pi * np.cumsum(f * h * (1 - 0.06 * d / 0.6)) / SR) / h for h in (1, 2, 3)) * np.sin(np.pi * d / 0.6) ** 0.8 * 0.5, at, 1.0)
쓰기('sigh.wav', 저역(한숨, 2500), 0.45)

# 벽시계 째깍 — 하나
쓰기('tick.wav', np.concatenate([째깍(), np.zeros(int(0.05 * SR))]), 0.5)

# 바늘이 세 바퀴 — 째깍이 점점 빨라졌다가(바늘이 가장 빠를 때 붙어 「드르르」) 느려지며 「똑」 멈춘다 + 휘익 바람 1.0초(바늘이 도는 0.65초에 맞춤)
돌 = 0.65
t = 판(1.0)
돌림 = np.zeros(len(t))
u = np.linspace(0, 1, 2000)
ease = np.where(u < 0.5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)
for e in np.arange(1, 90) / 90:  # 세 바퀴 = 분 눈금 180칸 — 소리는 두 칸에 하나(붙어 드르르)
    at = np.interp(e, ease, u) * 돌 + 0.02
    얹기(돌림, 째깍(1.0 + 0.3 * e), at, 0.55)
돌림 += 띠(rng.standard_normal(len(t)), 600, 4000) * np.interp(t, [0, 0.25, 0.4, 0.65, 1.0], [0, 0.45, 0.55, 0.1, 0]) * 0.6
d = 판(0.25)
얹기(돌림, np.sin(2 * np.pi * np.cumsum(900 - 500 * d) / SR) * np.exp(-d * 18) * 0.5, 돌 + 0.03)  # 멈출 때 「똑」
쓰기('spin.wav', 돌림, 0.6)

# 끝에서 다시 도는 소리 — 째깍이 점점 빨라지며 끝난다 3초
t = 판(3.0)
돌림2 = np.zeros(len(t))
for i in range(1, 200):
    e = i / 200
    at = np.sqrt(e) * 2.6 + 0.02
    얹기(돌림2, 째깍(1.0), at, 0.45 * (0.5 + 0.5 * e))
돌림2 += 띠(rng.standard_normal(len(t)), 600, 4000) * np.interp(t, [0, 1.5, 3.0], [0, 0.2, 0.45]) * 0.5
쓰기('spin2.wav', 돌림2, 0.5)

# 커튼 — 천이 미끄러지는 「촤악」 + 고리 짤랑
t = 판(0.7)
커튼 = 띠(rng.standard_normal(len(t)), 900, 5000) * np.interp(t, [0, 0.08, 0.45, 0.7], [0, 1, 0.4, 0])
for at in [0.05, 0.12, 0.2]:
    d = 판(0.12)
    얹기(커튼, np.sin(2 * np.pi * 3100 * d) * np.exp(-d * 60) * 0.25, at)
쓰기('curtain.wav', 커튼, 0.55)

# 잠 숨소리 — 들숨 · 날숨 바람(코골이 없이 부드럽게) 둘 4.6초
t = 판(4.6)
숨 = np.zeros(len(t))
for at in [0.0, 2.3]:
    d = 판(2.2)
    결 = np.interp(d, [0, 0.8, 1.1, 2.0, 2.2], [0, 0.7, 0.2, 0.5, 0])
    얹기(숨, 띠(rng.standard_normal(len(d)), 250, 1400) * 결 + np.sin(2 * np.pi * 95 * d) * 결 * 0.08, at)
쓰기('snore.wav', 숨, 0.4)

# 스르르 녹는 「뭉」 — 낮게 내려앉는 부드러운 음
t = 판(0.8)
쓰기('squish.wav', np.sin(2 * np.pi * np.cumsum(260 * np.exp(-t * 3) + 70) / SR) * np.sin(np.pi * t / 0.8) ** 1.2 * (1 + 0.25 * np.sin(2 * np.pi * 11 * t)), 0.5)

# 책장 넘김 — 종이 「사락」
t = 판(0.35)
쓰기('page.wav', 띠(rng.standard_normal(len(t)), 1800, 7000) * np.sin(np.pi * t / 0.35) ** 2 * (1 + 0.6 * np.sin(2 * np.pi * 30 * t)), 0.5)

# 눈 깜빡 — 작은 「뽁」 둘
t = 판(0.3)
깜빡 = np.zeros(len(t))
for at in [0.0, 0.12]:
    d = 판(0.1)
    얹기(깜빡, np.sin(2 * np.pi * (700 + 600 * d) * d) * np.exp(-d * 40), at)
쓰기('blink.wav', 깜빡, 0.45)

# 뾱 — 몽글이 번쩍
t = 판(0.3)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(420 + 1500 * t) / SR) * np.sin(np.pi * t / 0.3) ** 1.3 * (1 + 0.3 * np.sin(2 * np.pi * 26 * t)), 0.5)

# 뽁 — 글자가 나타날 때
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 휙 — 장면이 넘어갈 때
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.4) ** 2, 0.6)

# 맑은 종 — 배울 말이 뜰 때
t = 판(1.1)
쓰기('ding.wav', sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 1318), (0.5, 1976), (0.25, 2637)]) * np.exp(-t * 4.5), 0.5)

# 음악 — 보유곡 「따뜻_118」 0초부터 25초(빈 마디 없는 0~62초 안)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '따뜻_118.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '따뜻_118.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '0', '-t', '25', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
