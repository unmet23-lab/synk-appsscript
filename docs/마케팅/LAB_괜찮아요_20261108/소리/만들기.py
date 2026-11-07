# LAB 영어 E31 소리 — 늦가을 공원(바람 · 은행잎 바스락 · 먼 새) · 종이봉지 · 냠 · 몽글이 굳는 소리 · 바람 빠짐 · 통 튐 · 반짝 · 뽁을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「밝은_052」에서 영상보다 길게 자른다(지난 두 편 E21 · E29와 다른 곡 — 제작 절차 「한 장면 먼저」 ③).
# 만들기: python -I -X utf8 docs/마케팅/LAB_괜찮아요_20261108/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1108)


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


# 공원 — 낮은 바람 + 가끔 은행잎 바스락 + 먼 새 두어 마디(영상보다 길게 34초)
길이 = 34
t = 판(길이)
바람 = 저역(rng.standard_normal(len(t)), 420) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.07 * t + 1.3)) ** 2
잎 = np.zeros(len(t))
for _ in range(60):
    at = rng.random() * (길이 - 0.4)
    d = 판(0.12 + rng.random() * 0.25)
    얹기(잎, 띠(rng.standard_normal(len(d)), 2200, 7000) * np.sin(np.pi * d / d[-1]) ** 2 * (0.4 + rng.random() * 0.6), at, 0.5)
새 = np.zeros(len(t))
for at in [3.1, 3.35, 11.8, 12.0, 24.6, 24.82, 31.0]:
    d = 판(0.11)
    f = 3100 + rng.random() * 900
    얹기(새, np.sin(2 * np.pi * np.cumsum(f + 1300 * np.sin(np.pi * d / 0.11)) / SR) * np.sin(np.pi * d / 0.11) ** 2, at, 0.12)
공 = 바람 * 1.0 + 잎 * 0.6 + 새
쓰기('park.wav', np.stack([공, np.roll(공, 900)], axis=1), 0.55)

# 종이봉지 바스락(0.7초)
t = 판(0.7)
봉 = np.zeros(len(t))
for _ in range(40):
    at = rng.random() * 0.62
    d = 판(0.01 + rng.random() * 0.03)
    얹기(봉, 띠(rng.standard_normal(len(d)), 1500, 9000) * np.exp(-d * 120), at, 0.6 + rng.random() * 0.4)
쓰기('bag.wav', 봉 * np.sin(np.pi * t / 0.7) ** 0.5, 0.6)

# 냠 — 바삭한 붕어빵을 크게 한 입(바삭 + 씹는 두 번)
t = 판(0.9)
냠 = np.zeros(len(t))
d = 판(0.09)
얹기(냠, 띠(rng.standard_normal(len(d)), 1200, 8000) * np.exp(-d * 45), 0.0, 1.0)
for at in [0.0, 0.025, 0.05]:
    dd = 판(0.03)
    얹기(냠, 고역(rng.standard_normal(len(dd)), 3000) * np.exp(-dd * 160), at, 0.8)
for at in [0.38, 0.62]:
    dd = 판(0.16)
    얹기(냠, 띠(rng.standard_normal(len(dd)), 200, 1400) * np.sin(np.pi * dd / 0.16) ** 2, at, 0.45)
쓰기('munch.wav', 냠, 0.8)

# 굳는 소리 — 몽글이 얼어붙는 순간(유리 얼음 「칭」 + 짧은 내림)
t = 판(0.9)
칭 = sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 2093), (0.6, 3136), (0.35, 4186)]) * np.exp(-t * 6)
내림 = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 3) + 160) / SR) * np.exp(-t * 4.5) * 0.35
쓰기('freeze.wav', 칭 * 0.7 + 내림, 0.6)

# 바람 빠짐 — 몽글이 납작해진다(내려가는 피리 + 숨)
t = 판(1.1)
f = 520 * np.exp(-t * 1.6) + 120
빠 = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - t / 1.1) ** 1.3 * 0.6 + 띠(rng.standard_normal(len(t)), 600, 3200) * (1 - t / 1.1) * 0.25
쓰기('deflate.wav', 빠, 0.55)

# 통 — 신나서 튀어 오른다(올라가는 짧은 음)
t = 판(0.32)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(260 + 900 * t) / SR) * np.exp(-t * 9) * (1 + 0.3 * np.sin(2 * np.pi * 18 * t)), 0.55)

# 반짝 — 눈이 빛날 때(맑은 세 음)
t = 판(0.9)
반 = np.zeros(len(t))
for i, f in enumerate([1568, 2093, 2637]):
    d = 판(0.6)
    얹기(반, np.sin(2 * np.pi * f * d) * np.exp(-d * 7), i * 0.08, 0.6)
쓰기('sparkle.wav', 반, 0.5)

# 뽁 — 말풍선 · 글자가 나타날 때
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 휙 — 장면이 넘어갈 때
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.4) ** 2, 0.6)

# 쿵 — 끝에 친구 손이 굳는 순간(작은 나무 「탁」)
t = 판(0.3)
쓰기('tock.wav', 띠(rng.standard_normal(len(t)), 900, 4200) * np.exp(-t * 90) + np.sin(2 * np.pi * 660 * t) * np.exp(-t * 30) * 0.5, 0.75)

# 음악 — 보유곡 「밝은_052」, 영상보다 길게(34초)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '밝은_052.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '밝은_052.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '0', '-t', '34', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
