# LAB 영어 E48 「구경만 할게요」 소리 — 화장품 가게 방 소리 · 말풍선 「톡」 · 점원들이 몰려드는 「우르르」 · 샘플을 들이미는 「쓱」 ·
# 꽉 끼는 「뿌직」 · 땀 「똑」 · 물러나는 「휙」 · 다 같이 고개 숙이는 「딩동」 · 몽글이 통통 튀는 「뿅」 · 끝 「반짝」을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「01_Joyful-Happy-Upbeat」 4초부터(빈 마디 38.5초~ 밖 · 지난 두 영어 편 E42 「밝은_052」 · E46 「05_Toddler-Kids」와 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_구경만할게요_20261119/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
공개 = os.path.join(여기, '..', 'remotion', 'public')
밖 = os.path.join(공개, 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1119)
TOTAL = 13.9


def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 띠(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def 저역(x, hi, order=2):
    return sosfilt(butter(order, hi, btype='low', fs=SR, output='sos'), x)


def 얹기(버퍼, x, at, 세기=1.0):
    i = int(at * SR)
    n = min(len(x), len(버퍼) - i)
    버퍼[i:i + n] += x[:n] * 세기


# 가게 방 소리 — 낮은 공기 웅 + 멀리 사람들 웅성(띠 잡음을 천천히 흔듦), 영상 끝까지
t = 판(TOTAL + 0.3)
방 = 저역(rng.standard_normal(len(t)), 240) * 0.6 + 띠(rng.standard_normal(len(t)), 300, 1400) * 0.12 * (1 + 0.6 * np.sin(2 * np.pi * 0.9 * t) * np.sin(2 * np.pi * 0.23 * t))
쓰기('room.wav', np.stack([방, np.roll(방, 2600)], axis=1), 0.3)

# 말풍선 톡
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * np.cumsum(600 + 900 * np.exp(-t * 30)) / SR) * np.exp(-t * 28), 0.5)

# 우르르 — 점원 다섯이 한꺼번에 다가오는 펠트 발소리 + 옷깃 스침
t = 판(0.7)
우 = 띠(rng.standard_normal(len(t)), 700, 4500) * np.sin(np.pi * t / 0.7) ** 1.2 * 0.5
for k in range(10):
    얹기(우, np.sin(2 * np.pi * (140 + 25 * k) * 판(0.05)) * np.exp(-판(0.05) * 70), 0.03 + k * 0.06 + rng.uniform(0, 0.02), 0.8)
쓰기('rush.wav', 우, 0.55)

# 샘플을 들이미는 쓱
t = 판(0.35)
쓰기('slide.wav', 띠(rng.standard_normal(len(t)), 1200, 6000) * np.sin(np.pi * t / 0.35) ** 1.5, 0.4)

# 꽉 끼는 뿌직(눌리는 펠트 — 낮은 소리가 오르내림)
t = 판(0.4)
f = 220 + 90 * np.sin(2 * np.pi * 7 * t)
뿌직 = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.4) ** 0.7 + 띠(rng.standard_normal(len(t)), 400, 2000) * 0.3 * np.sin(np.pi * t / 0.4)
쓰기('squish.wav', 저역(뿌직, 3000), 0.45)

# 땀 똑
t = 판(0.2)
쓰기('drip.wav', np.sin(2 * np.pi * np.cumsum(1400 - 700 * (t / 0.2)) / SR) * np.exp(-t * 30), 0.35)

# 물러나는 휙(높은 데서 낮은 데로 빠지는 바람)
t = 판(0.45)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5000) * np.sin(np.pi * t / 0.45) ** 2, 0.4)

# 다 같이 고개 숙이는 딩동(공손한 두 음)
t = 판(1.3)
딩동 = np.zeros(len(t))
for k, f0 in enumerate([1319, 1047]):
    s = int(k * 0.28 * SR)
    tt = t[: len(t) - s]
    딩동[s:] += sum(a * np.sin(2 * np.pi * f0 * m * tt) * np.exp(-tt * d) for m, a, d in [(1, 1.0, 3.0), (2, 0.35, 4.5), (3, 0.12, 6.0)])
쓰기('dingdong.wav', 딩동, 0.45)

# 놀람 뿅(위로 튀는 짧은 음)
t = 판(0.3)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(300 + 900 * np.clip(t / 0.08, 0, 1)) / SR) * np.exp(-t * 9) * (1 + 0.35 * np.sin(2 * np.pi * 24 * t)), 0.5)

# 끝 반짝(오르는 맑은 음 셋)
t = 판(0.6)
반짝 = np.zeros(len(t))
for k, f in enumerate([1568, 1976, 2637]):
    s = int(k * 0.11 * SR)
    tt = t[: len(t) - s]
    반짝[s:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9)
쓰기('sparkle.wav', 반짝, 0.4)

곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '01_Joyful-Happy-Upbeat_alex-morgan.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '4', '-t', f'{TOTAL + 0.3:.2f}', '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('ok')
