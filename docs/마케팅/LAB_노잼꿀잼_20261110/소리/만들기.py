# LAB 영어 E30 소리 — 밤 거실(낮은 방 소리 + 지루한 TV 웅얼) · 몽글 「뾱」 · 유리병 「띵」 · 휙 · 바람 빠짐 · TV 폭발 「쾅」 + 추격 소리 ·
# 쟁반을 이고 오는 통통 · 꿀이 쏟아지는 「꿀럭」 · 똑 · 굳는 「칭」을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「따뜻_118」 20초부터(빈 마디 없는 0~62초 안, 지난 두 영어 편 E34 시티팝_147 · E32 키즈파티와 다른 곡), 영상보다 길게 32초.
# 만들기: python -I -X utf8 docs/마케팅/LAB_노잼꿀잼_20261110/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1130)


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


# 밤 거실 방 소리 — 낮은 웅웅 + 아주 옅은 바람(영상보다 길게 32초)
t = 판(32)
방 = 저역(rng.standard_normal(len(t)), 200) * 0.9 + 띠(rng.standard_normal(len(t)), 400, 1500) * 0.08
쓰기('room.wav', np.stack([방, np.roll(방, 900)], axis=1), 0.45)

# 지루한 TV — 웅얼거리는 해설(낮은 모음 띠가 느리게 오르내림) 13초
t = 판(13)
f0 = 110 + 14 * np.sin(2 * np.pi * 0.37 * t) + 6 * np.sin(2 * np.pi * 1.3 * t)
웅 = sum(np.sin(2 * np.pi * np.cumsum(f0 * k) / SR) / k for k in range(1, 7))
말결 = 0.5 + 0.5 * np.clip(np.sin(2 * np.pi * 2.3 * t) + 0.4 * np.sin(2 * np.pi * 0.9 * t), -1, 1)
쓰기('tv_dull.wav', 띠(웅 * 말결, 250, 1100) + 띠(rng.standard_normal(len(t)), 1500, 4000) * 0.02, 0.4)

# 추격전 TV — 낮은 엔진 으르렁 + 사이렌처럼 오르내리는 음 + 가끔 타이어 긁힘(19초)
t = 판(19)
엔진 = np.sin(2 * np.pi * np.cumsum(70 + 25 * np.sin(2 * np.pi * 0.6 * t)) / SR) * (1 + 0.5 * np.sin(2 * np.pi * 31 * t))
사이렌 = np.sin(2 * np.pi * np.cumsum(760 + 180 * np.sign(np.sin(2 * np.pi * 1.1 * t))) / SR) * 0.25
긁힘 = np.zeros(len(t))
for at in [1.4, 4.3, 7.9, 11.2, 14.8]:
    d = 판(0.6)
    얹기(긁힘, 띠(rng.standard_normal(len(d)), 1800, 4200) * np.sin(np.pi * d / 0.6) ** 2, at, 0.5)
쓰기('tv_action.wav', 저역(엔진, 500) * 0.8 + 띠(사이렌, 500, 1400) + 긁힘 * 0.35, 0.5)

# 쾅 — TV 속 폭발(낮은 둥 + 소음 꼬리)
t = 판(1.6)
쾅 = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 3) + 34) / SR) * np.exp(-t * 3.2) + 저역(rng.standard_normal(len(t)), 1800) * np.exp(-t * 4.5) * 0.9
쓰기('boom.wav', 쾅, 0.8)

# 뾱 — 몽글이 번쩍(올라가는 짧은 음 둘)
t = 판(0.3)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(420 + 1500 * t) / SR) * np.sin(np.pi * t / 0.3) ** 1.3 * (1 + 0.3 * np.sin(2 * np.pi * 26 * t)), 0.5)

# 띵 — 유리병이 코앞에 멈춘다(맑은 유리)
t = 판(0.9)
쓰기('clink.wav', sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 2350), (0.5, 3720), (0.3, 5400)]) * np.exp(-t * 7), 0.5)

# 뽁 — 말 글자가 나타날 때
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 휙 — 장면이 넘어갈 때 · 몽글이 사라질 때
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.4) ** 2, 0.6)

# 바람 빠짐 — 몽글이 병을 인 채 축 처진다
t = 판(1.0)
f = 520 * np.exp(-t * 1.6) + 120
쓰기('deflate.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - t / 1.0) ** 1.3 * 0.6 + 띠(rng.standard_normal(len(t)), 600, 3200) * (1 - t / 1.0) * 0.25, 0.5)

# 통통통 — 쟁반을 이고 러그 위를 뛰어온다(부드러운 발소리 넷 + 유리 달그락)
t = 판(0.9)
통 = np.zeros(len(t))
for i, at in enumerate([0.0, 0.2, 0.4, 0.6]):
    d = 판(0.16)
    얹기(통, np.sin(2 * np.pi * np.cumsum(180 * np.exp(-d * 14) + 70) / SR) * np.exp(-d * 22), at, 1.0)
    얹기(통, np.sin(2 * np.pi * (2900 + 300 * i) * d) * np.exp(-d * 40), at + 0.03, 0.18)
쓰기('hops.wav', 통, 0.6)

# 꿀럭 — 꿀이 쟁반에서 쏟아진다(낮게 굴러 내려가는 방울 여럿)
t = 판(1.6)
꿀 = np.zeros(len(t))
for i, at in enumerate([0.0, 0.22, 0.4, 0.62, 0.8, 1.02, 1.2]):
    d = 판(0.2)
    얹기(꿀, np.sin(2 * np.pi * np.cumsum(300 - 900 * d + 25 * (i % 3)) / SR) * np.sin(np.pi * d / 0.2) ** 2, at, 0.7 - 0.05 * i)
쓰기('glug.wav', 저역(꿀, 1400), 0.65)

# 똑 — 꿀방울이 떨어진다
t = 판(0.22)
쓰기('drop.wav', np.sin(2 * np.pi * np.cumsum(900 - 2200 * t) / SR) * np.exp(-t * 26), 0.5)

# 굳는 소리 — 유리 얼음 「칭」 + 짧은 내림
t = 판(0.9)
칭 = sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 2093), (0.6, 3136), (0.35, 4186)]) * np.exp(-t * 6)
내림 = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 3) + 160) / SR) * np.exp(-t * 4.5) * 0.35
쓰기('freeze.wav', 칭 * 0.7 + 내림, 0.6)

# 음악 — 보유곡 「따뜻_118」 20초부터 32초(빈 마디 없는 0~62초 안)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '따뜻_118.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '따뜻_118.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '20', '-t', '32', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
