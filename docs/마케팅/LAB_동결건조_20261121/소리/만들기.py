# LAB 영어 E58 「엄마 동결건조하고 싶다」 소리 — 기차역 플랫폼의 바탕 소리 · 동결건조 기계가 웅웅 도는 소리 · 서리가 끼는 바스락 ·
# 기차가 떠나는 쉭 소리 · 엄마의 훌쩍을 대신하는 짧은 떨림을 직접 만든다(남의 음원 없음).
# 톡 · 휙 · 뿅 · 반짝 · 딩동 · 똑 · 뿌직 · 쓱은 E57 「목 · 손목 · 발목」이 가져온 것(E48이 만든 것)을 그대로 가져왔다.
# 음악은 보유곡 「시티팝_147」 28초부터(빈 마디 26.25~27초 · 104초~ 밖 · 지난 두 영어 편 E57 「따뜻_118」 · E48 「01_Joyful-Happy-Upbeat」와 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_동결건조_20261121/소리/만들기.py
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
rng = np.random.default_rng(1121)
TOTAL = 35.0


def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 띠(lo, hi, n):
    return sosfilt(butter(2, [lo, hi], btype='band', fs=SR, output='sos'), n)


# 역 바탕 — 큰 지붕 아래 낮은 웅성임(낮은 띠 잡음)과 먼 공기 소리. 두 귀를 따로 만들어 넓게.
def 역():
    t = 판(TOTAL)
    out = []
    for ch in range(2):
        lo = 띠(90, 420, rng.standard_normal(len(t)))
        mid = 띠(500, 1600, rng.standard_normal(len(t))) * 0.35
        env = 0.7 + 0.2 * np.sin(2 * np.pi * 0.09 * t + ch) + 0.1 * np.sin(2 * np.pi * 0.05 * t + 2 * ch)
        fade = np.minimum(1, np.minimum(t / 0.6, (TOTAL - t) / 0.8))
        out.append((lo + mid) * env * fade)
    쓰기('station.wav', np.stack(out, axis=1), 0.5)


# 기계 웅 — 동결건조 기계가 도는 낮은 웅웅(110Hz 맥놀이 + 띠 잡음), 2초
def 기계():
    t = 판(2.0)
    hum = np.sin(2 * np.pi * 110 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t)) + 0.4 * np.sin(2 * np.pi * 220 * t)
    n = 띠(200, 1200, rng.standard_normal(len(t))) * 0.5
    env = np.minimum(1, np.minimum(t / 0.15, (2.0 - t) / 0.3))
    쓰기('machine.wav', (hum + n) * env, 0.6)


# 서리 — 얼음이 끼는 바스락(짧은 딸깍 40번을 높은 띠로), 1.2초
def 서리():
    t = 판(1.2)
    x = np.zeros_like(t)
    for k in range(40):
        i = int(rng.uniform(0, 1.15) * SR)
        ln = int(0.006 * SR)
        click = rng.standard_normal(ln) * np.exp(-np.arange(ln) / (0.0012 * SR))
        m = min(ln, len(x) - i)
        x[i:i + m] += click[:m] * rng.uniform(0.3, 1.0)
    x = 띠(3000, 11000, x)
    env = np.minimum(1, (1.2 - t) / 0.3)
    쓰기('frost.wav', x * env, 0.55)


# 기차 쉭 — 떠나는 기차의 바람(띠 잡음이 커졌다 잦아듦), 2.5초
def 기차():
    t = 판(2.5)
    n = 띠(150, 2500, rng.standard_normal(len(t)))
    env = np.sin(np.pi * np.clip(t / 2.5, 0, 1)) ** 2
    쓰기('train.wav', n * env, 0.6)


# 떨림 — 몽글이 덜덜 떠는 짧은 진동(30Hz로 흔들리는 낮은 음), 0.8초
def 떨림():
    t = 판(0.8)
    x = np.sin(2 * np.pi * 180 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 15 * t)))
    env = np.minimum(1, np.minimum(t / 0.03, (0.8 - t) / 0.2))
    쓰기('shiver.wav', 띠(120, 900, x * env), 0.5)


역()
기계()
서리()
기차()
떨림()

# 배경음 — 보유곡 「시티팝_147」 28초부터 TOTAL초(편 길이는 Film의 TOTAL — 넉넉히 자르고 Remotion이 끝에서 줄인다)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '28', '-t', str(TOTAL), '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('소리 · 배경음 만듦')
