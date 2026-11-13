# LAB 몽골 M36 「이름 뜻」 소리 — 교실 바탕(방 소리 + 창밖 새) · 이름표가 빛남 · 해가 떠오름 「띠리리링」 · 달이 뜸(맑은 종) · 떨어지는 휘파람 · 강철 「쾅」(낮은 둥 + 쇠 울림 + 나무 갈라짐) · 몽글 「뾱」 · 글자 「톡」 · 휙을 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「밝은_052」 30.5초부터 17초(빈 마디 29~30초 · 50.5초~ 밖 — 지난 두 몽골 편 M34 시티팝_147 · M37 01_Joyful과 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_이름뜻_mn_20261113/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1136)


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


# 교실 바탕 — 낮은 방 소리 + 창밖 새 짹짹(18초, 영상보다 길게)
t = 판(18)
방 = 저역(rng.standard_normal(len(t)), 220) * 0.8 + 띠(rng.standard_normal(len(t)), 400, 1800) * 0.05
새 = np.zeros(len(t))
for at in [0.6, 1.0, 3.1, 3.35, 6.2, 9.4, 9.7, 12.8, 13.05, 15.9]:
    for k in range(2 + int(rng.random() * 2)):
        d = 판(0.07)
        f0 = 3200 + 900 * rng.random()
        얹기(새, np.sin(2 * np.pi * np.cumsum(f0 + 2200 * np.sin(np.pi * d / 0.07)) / SR) * np.sin(np.pi * d / 0.07) ** 2, at + 0.11 * k, 0.35)
쓰기('room.wav', np.stack([방 + 새 * 0.18, np.roll(방, 900) + np.roll(새, 300) * 0.12], axis=1), 0.4)

# 이름표가 빛남 — 부드럽게 부푸는 맑은 화음
t = 판(0.9)
빛 = np.zeros(len(t))
for f in [784, 988, 1175]:
    빛 += np.sin(2 * np.pi * f * t) * np.sin(np.pi * t / 0.9) ** 2
쓰기('glow.wav', 빛 + 띠(rng.standard_normal(len(t)), 3000, 9000) * np.sin(np.pi * t / 0.9) ** 3 * 0.15, 0.4)

# 해가 떠오름 — 올라가는 맑은 음 여섯 + 바람처럼 부푸는 숨
t = 판(1.6)
해 = np.zeros(len(t))
for i, f in enumerate([523, 659, 784, 1047, 1319, 1568]):
    d = 판(1.0)
    얹기(해, (np.sin(2 * np.pi * f * d) + 0.35 * np.sin(2 * np.pi * 2 * f * d)) * np.exp(-d * 4.2), 0.08 * i, 0.75)
숨 = 띠(rng.standard_normal(len(t)), 600, 5000) * (t / 1.6) ** 1.4 * np.exp(-np.maximum(0, t - 1.0) * 6)
쓰기('rise.wav', 해 + 숨 * 0.35, 0.5)

# 달이 뜸 — 높은 종 다섯이 내려오며 반짝
t = 판(1.6)
달 = np.zeros(len(t))
for i, f in enumerate([2637, 2349, 1976, 2349, 2637]):
    d = 판(1.1)
    얹기(달, (np.sin(2 * np.pi * f * d) + 0.5 * np.sin(2 * np.pi * 2.76 * f * d) * np.exp(-d * 9)) * np.exp(-d * 3.6), 0.11 * i, 0.6 + 0.08 * (i % 2))
쓰기('twinkle.wav', 달, 0.42)

# 떨어지는 휘파람 — 높은 데서 내려오는 음(0.5초)
t = 판(0.5)
쓰기('fall.wav', np.sin(2 * np.pi * np.cumsum(1900 - 1500 * (t / 0.5) ** 1.2) / SR) * np.sin(np.pi * t / 0.5) ** 0.6 * 0.7 + 띠(rng.standard_normal(len(t)), 1500, 6000) * (t / 0.5) ** 2 * 0.25, 0.42)

# 강철 「쾅」 — 낮은 둥(바닥까지 울림) + 쇠가 우는 울림(맞지 않는 배음) + 나무 갈라지는 짧은 소음
t = 판(1.9)
쾅 = np.sin(2 * np.pi * np.cumsum(95 * np.exp(-t * 7) + 38) / SR) * np.exp(-t * 3.2) * 1.2
쇠 = np.zeros(len(t))
for f, a, k in [(612, 0.5, 2.6), (1489, 0.35, 3.4), (2213, 0.25, 4.5), (3127, 0.18, 6.0), (4051, 0.1, 7.5)]:
    쇠 += np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t * k) * a
갈라짐 = np.zeros(len(t))
for at in [0.0, 0.03, 0.07, 0.12, 0.2]:
    d = 판(0.05)
    얹기(갈라짐, 띠(rng.standard_normal(len(d)), 700, 5000) * np.exp(-d * 90), at, 0.9)
먼지 = 저역(rng.standard_normal(len(t)), 1800) * np.exp(-t * 9) * 0.6
쓰기('thud.wav', 쾅 + 쇠 * 0.55 + 갈라짐 * 0.7 + 먼지, 0.92)

# 뾱 — 몽글이 놀라 튐
t = 판(0.3)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(420 + 1500 * t) / SR) * np.sin(np.pi * t / 0.3) ** 1.3 * (1 + 0.3 * np.sin(2 * np.pi * 26 * t)), 0.5)

# 톡 — 글자가 놓일 때(작게)
t = 판(0.08)
쓰기('pop.wav', np.sin(2 * np.pi * np.cumsum(900 - 500 * t / 0.08) / SR) * np.exp(-t * 60), 0.4)

# 휙 — 카메라가 옆 사람에게
t = 판(0.35)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 4500) * np.sin(np.pi * t / 0.35) ** 2, 0.4)

# 똑딱 — 「체첵 씨?」에 아무도 대답이 없는 어색한 틈(작은 나무 소리)
t = 판(0.12)
쓰기('tick.wav', 띠(rng.standard_normal(len(t)), 1800, 5200) * np.exp(-t * 70) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) * 0.4, 0.35)

# 뽀옹 — 몽글 둘레에 폭신한 구름이 피어오름(부드러운 바람 덩이 + 올라가는 둥근 음)
t = 판(0.9)
뭉게 = 저역(rng.standard_normal(len(t)), 900) * np.sin(np.pi * np.minimum(1, t / 0.9)) ** 1.5
둥 = np.sin(2 * np.pi * np.cumsum(260 + 380 * (t / 0.9) ** 0.7) / SR) * np.exp(-t * 3.2) * np.minimum(1, t / 0.04)
쓰기('puff.wav', 뭉게 * 0.7 + 둥 * 0.6, 0.5)

# 음악 — 보유곡 「밝은_052」 30.5초부터 17초
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '밝은_052.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '밝은_052.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '30.5', '-t', '17', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
