# LAB 영어 E19 「4층 F」 효과음 · 엘리베이터 음악을 직접 만든다(남의 음원 없음). 48kHz 스테레오 16비트 wav를 remotion/public/sfx에 쓴다.
#   python 소리/만들기.py
# 「사」에서 음악이 테이프처럼 멈추는 것이 이 편의 소리 한 방이라, 음악은 끊기는 판(muzak_stop)과 다시 이어지는 판(muzak_back)을 따로 굽는다.
import os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1031)


def 쓰기(이름, x, peak=0.89):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 띠(x, lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=SR, output='sos')
    return sosfilt(sos, x)


def 낮은(x, hi):
    return sosfilt(butter(4, hi, btype='low', fs=SR, output='sos'), x)


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 건반(f, dur, vel=0.5):
    # FM 전기 피아노 — 음은 짧게, 끝은 잔향이 받는다
    t = 판(dur)
    env = np.exp(-t * 3.2) * (1 - np.exp(-t * 200))
    idx = 1.6 * np.exp(-t * 7)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    x += 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)
    return vel * x * env


def 베이스(f, dur):
    t = 판(dur)
    return 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t * 2.4) * (1 - np.exp(-t * 300))


def 셰이커(dur, vel):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = 띠(x, 3000, 9000)
    t = 판(dur)
    return vel * x * np.exp(-t * 60)


def 놓기(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]


def 음악(sec, bpm=104):
    # 네 마디 도는 보사노바 — 낡은 엘리베이터 스피커처럼 띠를 좁힌다
    b = 60 / bpm
    bar = b * 4
    화음 = [
        ([261.63, 329.63, 392.0, 493.88], 130.81),  # Cmaj7
        ([220.0, 261.63, 329.63, 392.0], 110.0),  # Am7
        ([293.66, 349.23, 440.0, 523.25], 146.83),  # Dm7
        ([246.94, 349.23, 392.0, 493.88], 98.0),  # G7
    ]
    buf = np.zeros(int((sec + 2) * SR))
    선율 = [659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 698.46, 659.25]
    for k in range(int(sec / bar) + 2):
        notes, root = 화음[k % 4]
        t0 = k * bar
        for step, 세기 in ((0, 0.42), (1.5, 0.32), (3, 0.36)):  # 보사 리듬
            for f in notes:
                놓기(buf, 건반(f, 0.9, 세기 * 0.42), t0 + step * b)
        놓기(buf, 베이스(root, 0.9), t0)
        놓기(buf, 베이스(root * 1.5, 0.7) * 0.7, t0 + 1.5 * b)
        놓기(buf, 베이스(root, 0.7) * 0.8, t0 + 2.5 * b)
        for s in range(8):
            놓기(buf, 셰이커(0.12, 0.10 if s % 2 else 0.17), t0 + s * b / 2)
        for s, m in enumerate(선율):
            if (s + k) % 3 != 2:
                놓기(buf, 건반(m, 0.7, 0.34), t0 + s * b / 2)
    잔향 = rng.standard_normal(int(0.5 * SR)) * np.exp(-판(0.5) * 9)
    wet = fftconvolve(buf, 잔향)[: len(buf)] * 0.03
    x = buf + wet
    x = 띠(x, 280, 4200)  # 작은 스피커
    return x[: int(sec * SR)]


def 테이프멈춤(x, stop_at, 길이=0.55):
    # stop_at부터 재생 속도가 0으로 떨어진다
    n = int(stop_at * SR)
    앞 = x[:n]
    src = x[n: n + int(길이 * SR)]
    m = int(길이 * SR)
    rate = np.linspace(1, 0, m) ** 1.6
    pos = np.cumsum(rate)
    pos = pos[pos < len(src) - 1]
    뒤 = np.interp(pos, np.arange(len(src)), src) * np.linspace(1, 0, len(pos))
    return np.concatenate([앞, 뒤, np.zeros(int(0.1 * SR))])


쓰기('muzak_stop.wav', 테이프멈춤(음악(6.4), 5.2), 0.8)
back = 음악(6.0)
fade = np.minimum(1, 판(6.0) / 0.25)
쓰기('muzak_back.wav', back * fade, 0.8)


def 딩(f=1318.5, dur=1.5):
    t = 판(dur)
    x = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 14)
    return x * np.exp(-t * 3.4) * (1 - np.exp(-t * 900))


쓰기('ding.wav', 딩(), 0.8)
도착 = np.zeros(int(2.2 * SR))
놓기(도착, 딩(1046.5, 1.6), 0)
놓기(도착, 딩(830.6, 1.6), 0.42)
쓰기('ding_arrive.wav', 도착, 0.85)

# 불이 깜빡이는 소리 — 60Hz 윙 소리가 끊겼다 이어진다
t = 판(0.95)
윙 = np.sign(np.sin(2 * np.pi * 120 * t)) * 0.4 + 0.6 * np.sin(2 * np.pi * 60 * t)
문 = np.ones_like(t)
for a, b in ((0.04, 0.12), (0.2, 0.36), (0.42, 0.47), (0.56, 0.74)):
    문[(t > a) & (t < b)] = 0
윙 = 띠(윙 * 문, 80, 2400) * np.exp(-t * 1.2)
쓰기('flicker.wav', 윙 + 0.15 * 띠(rng.standard_normal(len(t)), 2000, 6000) * 문, 0.8)

# 낮게 깔리는 긴장 — 점점 커진다(몽글이 깨닫는 동안)
t = 판(5.4)
드론 = np.sin(2 * np.pi * 55 * t) + 0.7 * np.sin(2 * np.pi * 55.9 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)
드론 += 0.25 * 낮은(rng.standard_normal(len(t)), 300)
드론 *= np.minimum(1, t / 3.5) ** 1.5 * (1 - np.clip((t - 5.0) / 0.4, 0, 1))
쓰기('drone.wav', 드론, 0.8)

# 문 — 드르륵 열림 · 쿵 닫힘
t = 판(1.1)
럼블 = 낮은(rng.standard_normal(len(t)), 500) * (0.7 + 0.3 * np.sin(2 * np.pi * 21 * t))
럼블 += 0.4 * np.sin(2 * np.pi * 70 * t)
쓰기('door_open.wav', 럼블 * np.minimum(1, t / 0.08) * np.minimum(1, (1.1 - t) / 0.25), 0.8)
t = 판(0.8)
럼블 = 낮은(rng.standard_normal(len(t)), 600) * np.minimum(1, t / 0.03) * np.exp(-t * 1.2)
쿵 = np.zeros_like(t)
놓기(쿵, np.sin(2 * np.pi * 62 * 판(0.45)) * np.exp(-판(0.45) * 11) * 3.0, 0.32)
쓰기('door_slam.wav', 럼블 * (t < 0.34) + 쿵, 0.89)

# 찻잔 소리 — 유령들이 찻잔을 내려놓는 작은 짤랑
x = np.zeros(int(0.7 * SR))
for at, f in ((0.0, 3120), (0.09, 4180), (0.22, 3560)):
    d = 판(0.3)
    놓기(x, (np.sin(2 * np.pi * f * d) + 0.5 * np.sin(2 * np.pi * f * 1.51 * d)) * np.exp(-d * 34), at)
쓰기('teacup.wav', x, 0.7)

# 작은 유령이 고개를 내미는 뾱(올라가는 음)
t = 판(0.22)
f = 420 + 1500 * (t / 0.22) ** 2
쓰기('peek.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * np.minimum(1, t / 0.006), 0.8)

# 꿀꺽(내려갔다 오르는 음 둘)
t = 판(0.32)
f = 260 - 160 * np.sin(np.pi * t / 0.32)
쓰기('gulp.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * np.minimum(1, t / 0.01), 0.8)

# 안도의 숨 — 부드러운 바람
t = 판(1.0)
숨 = 띠(rng.standard_normal(len(t)), 500, 2600) * np.sin(np.pi * t / 1.0) ** 2 * np.exp(-t * 0.9)
쓰기('sigh.wav', 숨, 0.6)
print('완료')
