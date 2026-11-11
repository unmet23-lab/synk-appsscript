# LAB 몽골 M34 소리 — 수족관(낮은 물 웅웅 + 뽀글) · 밤 바닷가(잔물결) · 상상 「띠리링」 · 몽글 「뾱」 · 불꽃 「피융 — 펑 — 파스스」 · 물개 박수 「짝짝」을 직접 만든다(남의 음원 없음).
# 휙 · 뽁 · 물개 소리 · 강아지 「왕」 · 풍덩 · 놀람은 M24(LAB_물고기_mn_20261102)에서 만든 우리 소리를 나눠 쓴다(remotion/public/sfx에 복사).
# 음악은 보유곡 「시티팝_147」 27.5초부터 20초(빈 마디 없는 27~104초 안 — 지난 두 몽골 21시 편 M32 05_Toddler-Kids · M33 밝은_052와 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_물개_mn_20261111/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1134)


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


# 수족관 — 낮은 물 웅웅 + 가끔 뽀글(20초, 영상보다 길게)
t = 판(20)
웅 = 저역(rng.standard_normal(len(t)), 160) * 0.9 + 띠(rng.standard_normal(len(t)), 300, 900) * 0.06
뽀글 = np.zeros(len(t))
for at in np.arange(0.4, 19.5, 0.83):
    d = 판(0.09)
    f = 500 + 700 * rng.random()
    얹기(뽀글, np.sin(2 * np.pi * np.cumsum(f + 2600 * d) / SR) * np.sin(np.pi * d / 0.09) ** 2, at + 0.2 * rng.random(), 0.25 + 0.3 * rng.random())
쓰기('aqua.wav', np.stack([웅 + 뽀글 * 0.25, np.roll(웅, 700) + np.roll(뽀글, 240) * 0.25], axis=1), 0.45)

# 밤 바닷가 — 느린 잔물결(20초)
t = 판(20)
결 = 0.55 + 0.45 * np.sin(2 * np.pi * 0.21 * t - 1.2) ** 2
물결 = 띠(rng.standard_normal(len(t)), 350, 2600) * 결 + 저역(rng.standard_normal(len(t)), 180) * 0.5
쓰기('sea.wav', np.stack([물결, np.roll(물결, 1300)], axis=1), 0.42)

# 상상 「띠리링」 — 올라가는 맑은 음 다섯
t = 판(1.1)
링 = np.zeros(len(t))
for i, f in enumerate([1047, 1319, 1568, 2093, 2637]):
    d = 판(0.7)
    얹기(링, (np.sin(2 * np.pi * f * d) + 0.3 * np.sin(2 * np.pi * 2 * f * d)) * np.exp(-d * 6), 0.07 * i, 0.8)
쓰기('dream.wav', 링, 0.45)

# 뾱 — 몽글이 번쩍
t = 판(0.3)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(420 + 1500 * t) / SR) * np.sin(np.pi * t / 0.3) ** 1.3 * (1 + 0.3 * np.sin(2 * np.pi * 26 * t)), 0.5)

# 화르륵 — 상상 속 꽃이 탄다(낮게 일렁이는 소음)
t = 판(1.5)
불 = 띠(rng.standard_normal(len(t)), 250, 2400) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t) * np.sin(2 * np.pi * 2.3 * t)) * np.sin(np.pi * t / 1.5) ** 0.6
탁 = np.zeros(len(t))
for at in [0.2, 0.45, 0.8, 1.05, 1.25]:
    d = 판(0.03)
    얹기(탁, rng.standard_normal(len(d)) * np.exp(-d * 160), at, 0.7)
쓰기('flame.wav', 불 + 탁 * 0.5, 0.5)


# 불꽃 — 피융(올라감) → 펑(낮은 둥 + 소음) → 파스스(흩어지는 잔불)
def 불꽃(높이, 꼬리):
    t = 판(0.55 + 2.2)
    x = np.zeros(len(t))
    d = 판(0.55)
    얹기(x, np.sin(2 * np.pi * np.cumsum(700 + 높이 * d) / SR) * (d / 0.55) ** 1.5 * 0.35 + 띠(rng.standard_normal(len(d)), 2500, 6000) * (d / 0.55) ** 2 * 0.12, 0)
    d = 판(1.1)
    펑 = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-d * 5) + 42) / SR) * np.exp(-d * 4.2) + 저역(rng.standard_normal(len(d)), 2400) * np.exp(-d * 7) * 0.9
    얹기(x, 펑, 0.55, 1.0)
    d = 판(꼬리)
    잔불 = np.zeros(len(d))
    for at in np.sort(rng.random(90) * (꼬리 - 0.1)):
        e = 판(0.012)
        얹기(잔불, rng.standard_normal(len(e)) * np.exp(-e * 400), at, (1 - at / 꼬리) ** 1.5)
    얹기(x, 띠(잔불, 2800, 9000), 0.75, 0.5)
    return x


쓰기('firework1.wav', 불꽃(2400, 1.9), 0.8)
쓰기('firework2.wav', 불꽃(1900, 1.6), 0.7)
쓰기('firework3.wav', 불꽃(2900, 1.7), 0.65)

# 짝짝짝 — 물개 박수(젖은 지느러미 — 낮고 통통한 박수 넷)
t = 판(1.0)
짝 = np.zeros(len(t))
for i, at in enumerate([0.0, 0.22, 0.44, 0.66]):
    d = 판(0.09)
    얹기(짝, 띠(rng.standard_normal(len(d)), 500, 2600) * np.exp(-d * 55) + np.sin(2 * np.pi * 210 * d) * np.exp(-d * 60) * 0.5, at, 1.0 - 0.06 * i)
쓰기('clap.wav', 짝, 0.6)

# 음악 — 보유곡 「시티팝_147」 27.5초부터 20초
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '27.5', '-t', '20', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
