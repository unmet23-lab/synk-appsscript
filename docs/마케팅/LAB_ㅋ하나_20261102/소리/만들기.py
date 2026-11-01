# LAB 영어 E24 「ㅋ 하나」 효과음을 직접 만든다(남의 음원 없음). 48kHz 스테레오 16비트 wav를 remotion/public/sfx에 쓴다.
#   python -I -X utf8 소리/만들기.py
# 알림 · 타자 · 펠트 조각 쏟아짐 · 얼어붙음 · 얼음 금 · 바람 · 반짝임 · 판 긁힘. 배경음은 보유곡 시티팝_147에서 잘라 쓴다.
# 팝 · 톡 · 휙은 E22(LAB_물고기_20261101)가 만든 것을 그대로 옮겼다.
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1102)


def 쓰기(이름, x, peak=0.89):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 띠(x, lo, hi):
    return sosfilt(butter(4, [lo, hi], btype='band', fs=SR, output='sos'), x)


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 얹기(바탕, 조각, at):
    i = int(at * SR)
    n = min(len(조각), len(바탕) - i)
    if n > 0:
        바탕[i:i + n] += 조각[:n]


def 사인(f, dur, decay):
    t = 판(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * decay) * (1 - np.exp(-t * 2000))


# 메시지 알림 — 두 음 「띵동」
x = np.zeros(int(0.5 * SR))
얹기(x, 사인(1318.5, 0.35, 9) + 0.3 * 사인(2637, 0.35, 14), 0.0)
얹기(x, 사인(1760, 0.4, 8) + 0.3 * 사인(3520, 0.4, 14), 0.11)
쓰기('ding.wav', x, 0.7)

# 타자 점 세 개 — 작은 톡톡
x = np.zeros(int(0.5 * SR))
for at in [0.0, 0.14, 0.28]:
    t = 판(0.03)
    얹기(x, 띠(rng.standard_normal(len(t)), 2500, 7000) * np.exp(-t * 180), at)
쓰기('type.wav', x, 0.5)


# 펠트 조각 하나가 떨어지는 소리 — 둔탁한 퍽
def 퍽(vel=1.0):
    t = 판(0.09)
    x = 띠(rng.standard_normal(len(t)), 150, 1400) * np.exp(-t * 60)
    x += 0.6 * np.sin(2 * np.pi * (120 + 80 * np.exp(-t * 40)) * t) * np.exp(-t * 45)
    return vel * x


def 쏟아짐(dur, n, 굵기=1.0):
    x = np.zeros(int(dur * SR))
    for i in range(n):
        at = rng.random() * (dur - 0.1)
        얹기(x, 퍽(0.4 + 0.6 * rng.random()) * 굵기, at)
    return x


쓰기('puff.wav', 퍽(), 0.7)
쓰기('pour_s.wav', 쏟아짐(1.0, 10), 0.75)
쓰기('pour_m.wav', 쏟아짐(1.6, 34), 0.8)
x = 쏟아짐(2.4, 110)
t = 판(2.4)
x += 0.25 * 띠(rng.standard_normal(len(t)), 120, 900) * np.minimum(1, t / 0.3)  # 쏟아지는 덩어리 웅웅
쓰기('pour_l.wav', x, 0.85)

# 얼어붙음 — 찡 하는 높은 쓸림 + 금 가는 딱 + 낮은 쿵
dur = 1.6
t = 판(dur)
x = 0.7 * 띠(rng.standard_normal(len(t)), 5000, 14000) * np.exp(-t * 2.4) * (1 - np.exp(-t * 60))
x += 1.0 * 띠(rng.standard_normal(len(t)), 1500, 9000) * np.exp(-t * 40)
x += 0.9 * np.sin(2 * np.pi * (90 + 60 * np.exp(-t * 20)) * t) * np.exp(-t * 7)
for f in [2093, 2637, 3136, 4186]:
    x += 0.12 * np.sin(2 * np.pi * f * t) * np.exp(-t * 1.6) * (1 - np.exp(-t * 30))
쓰기('freeze.wav', x, 0.9)


# 얼음 금 — 짧은 딱딱
def 딱(vel=1.0):
    t = 판(0.05)
    return vel * 띠(rng.standard_normal(len(t)), 2000, 12000) * np.exp(-t * 140)


x = np.zeros(int(0.6 * SR))
for at, v in [(0.0, 1.0), (0.05, 0.6), (0.11, 0.8), (0.2, 0.45), (0.32, 0.3)]:
    얹기(x, 딱(v), at)
t = 판(0.6)
x += 0.18 * np.sin(2 * np.pi * 70 * t) * np.exp(-t * 9)
쓰기('crack.wav', x, 0.8)

# 바람 — 얼어붙은 뒤 끝까지(6초), 느리게 일렁이는 잡음
dur = 6.0
t = 판(dur)
n = rng.standard_normal(len(t))
lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * t) * np.sin(2 * np.pi * 0.11 * t + 1)
x = 띠(n, 250, 1400) * lfo + 0.35 * 띠(rng.standard_normal(len(t)), 1800, 5000) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.23 * t))
x *= np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.5)
쓰기('wind.wav', x, 0.6)

# 반짝임 — 얼음 위 작은 종소리
x = np.zeros(int(1.2 * SR))
for i, f in enumerate([2349, 3136, 2637, 3520, 4186]):
    얹기(x, 사인(f, 0.6, 7) * (0.8 - 0.1 * i), i * 0.09)
쓰기('sparkle.wav', x, 0.55)

# 얼음이 깨진다 — 끝에 친구가 ㅋㅋㅋ jk로 풀 때(딱딱 여럿 + 쨍그랑 + 녹는 쉬익)
x = np.zeros(int(1.2 * SR))
for i in range(24):
    얹기(x, 딱(0.4 + 0.6 * rng.random()), rng.random() * 0.35)
for i, f in enumerate([3136, 3729, 4186, 4699, 5274, 2794]):
    얹기(x, 사인(f, 0.5, 6) * 0.35, 0.05 + i * 0.05 + 0.03 * rng.random())
t = 판(1.2)
x += 0.4 * 띠(rng.standard_normal(len(t)), 800, 6000) * np.exp(-t * 3) * (1 - np.exp(-t * 80))
x += 0.6 * np.sin(2 * np.pi * (110 + 50 * np.exp(-t * 18)) * t) * np.exp(-t * 8)
쓰기('shatter.wav', x, 0.9)

# 판 긁힘 — 음악이 멈춘다(위에서 아래로 쓸리는 잡음)
dur = 0.45
t = 판(dur)
f = 1800 * np.exp(-t * 6) + 200
x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 + 0.6 * 띠(rng.standard_normal(len(t)), 600, 4000)
x *= np.exp(-t * 5) * (1 - np.exp(-t * 300))
쓰기('scratch.wav', x, 0.7)

# 배경음 — 보유곡 시티팝_147(가장 꽉 찬 자리 86.1초 앞)에서 13초
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '80.0', '-t', '13.0', '-i', 곡, '-af', 'afade=t=in:d=0.05', '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('끝 —', sorted(os.listdir(밖)))
