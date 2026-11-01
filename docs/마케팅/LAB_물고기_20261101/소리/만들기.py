# LAB 영어 E22 「물고기」 효과음을 직접 만든다(남의 음원 없음). 48kHz 스테레오 16비트 wav를 remotion/public/sfx에 쓴다.
#   python -I -X utf8 소리/만들기.py
# 풍덩 · 뽀글 · 물방울 · 강아지 · 물개 · 박수 · 슬픈 건반. 배경음은 보유곡 밝은_052에서 잘라 앞 · 뒤 두 토막으로 쓴다.
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1101)


def 쓰기(이름, x, peak=0.89):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 띠(x, lo, hi):
    return sosfilt(butter(4, [lo, hi], btype='band', fs=SR, output='sos'), x)


def 낮은(x, hi):
    return sosfilt(butter(4, hi, btype='low', fs=SR, output='sos'), x)


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 방울(f0, f1, dur, vel=1.0):
    # 물방울 한 알 — 위로 휘는 사인파(공기 방울이 터지는 소리의 근사)
    t = 판(dur)
    f = f0 + (f1 - f0) * (t / dur) ** 1.5
    return vel * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (6 / dur)) * (1 - np.exp(-t * 900))


def 얹기(바탕, 조각, at):
    i = int(at * SR)
    n = min(len(조각), len(바탕) - i)
    if n > 0:
        바탕[i:i + n] += 조각[:n]


def 풍덩(dur=1.3, 크기=1.0):
    t = 판(dur)
    x = np.zeros(len(t))
    # 낮은 쿵 — 물체가 수면을 치는 순간
    thump = np.sin(2 * np.pi * np.cumsum(170 * np.exp(-t * 11) + 58) / SR) * np.exp(-t * 9)
    x += 1.1 * thump
    # 흩어지는 물 — 잡음을 띠로 거른 두 겹
    n = rng.standard_normal(len(t))
    x += 0.8 * 띠(n, 500, 3800) * np.exp(-t * 8) * (1 - np.exp(-t * 300))
    x += 0.35 * 띠(rng.standard_normal(len(t)), 2500, 9000) * np.exp(-t * 5.5)
    # 공기 방울이 올라온다
    for i in range(16):
        at = 0.08 + rng.random() * 0.75
        f = 380 + rng.random() * 900
        얹기(x, 방울(f, f * 1.7, 0.05 + rng.random() * 0.06, 0.32 * (1 - at / 1.1)), at)
    return x * 크기


쓰기('splash_big.wav', 풍덩())

# 뽀글뽀글 — 한 번 길게(1.6초)
x = np.zeros(int(1.6 * SR))
for i in range(38):
    f = 300 + rng.random() * 800
    얹기(x, 방울(f, f * 1.8, 0.05 + rng.random() * 0.05, 0.5 + rng.random() * 0.5), rng.random() * 1.5)
쓰기('bubbles.wav', x, 0.8)

# 터지는 물 — 물개가 솟을 때(풍덩 + 위로 솟는 쉬익)
x = 풍덩(1.6)
t = 판(1.6)
x += 0.6 * 띠(rng.standard_normal(len(t)), 900, 7000) * np.exp(-((t - 0.1) / 0.16) ** 2)
쓰기('burst.wav', x)

# 눈물 한 방울 — 접시에 톡
쓰기('plip.wav', 방울(900, 2100, 0.09, 1.0) + 방울(1300, 2600, 0.09, 0.0))


# 강아지 — 짧게 왕! 위로 튀는 음 + 코 잡음
def 왕(f0=620, dur=0.14):
    t = 판(dur)
    f = f0 * (1 + 0.75 * np.sin(np.pi * t / dur))
    p = 2 * np.pi * np.cumsum(f) / SR
    x = sum((0.8 ** k) * np.sin(k * p) for k in range(1, 9))
    x = 띠(x, 500, 3600) * np.sin(np.pi * t / dur) ** 0.6
    x += 0.25 * 띠(rng.standard_normal(len(t)), 1800, 5200) * np.exp(-t * 28)
    return x


x = np.zeros(int(0.5 * SR))
얹기(x, 왕(), 0.0)
얹기(x, 왕(680, 0.12), 0.21)
쓰기('yip.wav', x, 0.8)


# 물개 — 아우! 아우! 거친 낮은 소리(떨림 넣음)
def 아우(f0=250, dur=0.26):
    t = 판(dur)
    f = f0 * (1 + 0.42 * np.sin(np.pi * np.minimum(1, t / (dur * 0.65))))
    p = 2 * np.pi * np.cumsum(f) / SR
    x = sum((0.86 ** k) * np.sin(k * p) for k in range(1, 18))
    x *= 0.7 + 0.3 * np.sign(np.sin(2 * np.pi * 42 * t))  # 거친 떨림
    x = 띠(x, 280, 2600) + 0.5 * 띠(x, 900, 1500)
    return x * np.sin(np.pi * t / dur) ** 0.5


x = np.zeros(int(1.0 * SR))
얹기(x, 아우(), 0.0)
얹기(x, 아우(275, 0.24), 0.31)
얹기(x, 아우(300, 0.3), 0.62)
쓰기('seal.wav', x, 0.85)

# 박수 — 지느러미라 둔탁하게
x = np.zeros(int(1.2 * SR))
for at in [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]:
    n = int(0.09 * SR)
    t = 판(0.09)
    얹기(x, 띠(rng.standard_normal(n), 500, 3000) * np.exp(-t * 55), at)
쓰기('flap.wav', x, 0.8)


# 슬픈 건반 — 7.9~14초 울음 구간(6.4초). 작은 단조, 음 사이가 비어도 잔향이 받는다
def 건반(f, dur, vel=0.5):
    t = 판(dur)
    env = np.exp(-t * 1.5) * (1 - np.exp(-t * 180))
    x = np.sin(2 * np.pi * f * t + 0.8 * np.exp(-t * 6) * np.sin(2 * np.pi * f * t))
    x += 0.22 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)
    return vel * x * env


L = 6.8
x = np.zeros(int(L * SR))
A3, C4, E4, F3, G3, B3, D4 = 220.0, 261.63, 329.63, 174.61, 196.0, 246.94, 293.66
마디 = [
    (0.0, [A3, C4, E4], 0.42), (1.1, [E4 * 2], 0.26), (1.65, [C4 * 2], 0.24),
    (2.2, [F3, A3, C4], 0.4), (3.3, [C4 * 2], 0.24), (3.85, [A3 * 2], 0.22),
    (4.4, [G3, B3, D4], 0.38), (5.5, [D4 * 2], 0.22),
]
for at, 음들, v in 마디:
    for j, f in enumerate(음들):
        얹기(x, 건반(f, 3.0, v), at + j * 0.012)
ir_t = 판(1.6)
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
ir = 띠(ir, 200, 5000)
wet = fftconvolve(x, ir)[:len(x)]
x = x + 0.012 * wet
fade = np.ones(len(x))
n = int(0.6 * SR)
fade[-n:] = np.linspace(1, 0, n)
쓰기('sad.wav', x * fade, 0.8)

# 배경음 — 보유곡에서 잘라 쓴다(앞 8.4초 · 뒤 11초)
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '밝은_052.wav')
for 이름, ss, dur, fo in [('bgm_a.wav', 2.0, 8.4, 0.5), ('bgm_b.wav', 10.4, 11.0, 0.9)]:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(ss), '-t', str(dur), '-i', 곡, '-af', f'afade=t=in:d=0.04,afade=t=out:st={dur - fo}:d={fo}', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', os.path.join(밖, 이름)], check=True)
print('만듦')
