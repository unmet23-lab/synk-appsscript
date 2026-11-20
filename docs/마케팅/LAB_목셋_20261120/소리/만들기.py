# LAB 영어 E57 「목 · 손목 · 발목」 소리 — 눈 내린 저녁 길의 바람(바탕) · 털실이 감기는 「스윽」 · 덜덜 떠는 「달달」을 직접 만든다(남의 음원 없음).
# 톡 · 뿅 · 휙 · 쓱 · 뿌직 · 반짝 · 딩동 · 똑은 E48 「구경만 할게요」가 만든 것을 그대로 가져왔다.
# 음악은 보유곡 「따뜻_118」 4초부터(빈 마디 62.25초~ 밖 · 지난 두 영어 편 E46 「05_Toddler-Kids」 · E48 「01_Joyful-Happy-Upbeat」와 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_목셋_20261120/소리/만들기.py
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
rng = np.random.default_rng(1120)
TOTAL = 24.0


def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


# 바람 — 낮은 띠 잡음에 느린 숨결(0.12 · 0.07Hz)을 얹은 바탕 소리. 두 귀를 따로 만들어 넓게.
def 바람():
    t = 판(TOTAL)
    out = []
    for ch in range(2):
        n = rng.standard_normal(len(t))
        lo = sosfilt(butter(2, [180, 900], btype='band', fs=SR, output='sos'), n)
        hi = sosfilt(butter(2, [1400, 3200], btype='band', fs=SR, output='sos'), rng.standard_normal(len(t))) * 0.25
        env = 0.65 + 0.25 * np.sin(2 * np.pi * 0.12 * t + ch) + 0.1 * np.sin(2 * np.pi * 0.07 * t + 2 * ch)
        x = (lo + hi) * env
        fade = np.minimum(1, np.minimum(t / 0.6, (TOTAL - t) / 0.8))
        out.append(x * fade)
    쓰기('wind.wav', np.stack(out, axis=1), 0.5)


# 털실 스윽 — 목도리 · 토시 · 양말이 감기고 끌려 올라가는 부드러운 마찰(0.45초)
def 스윽():
    t = 판(0.45)
    n = sosfilt(butter(2, [700, 4000], btype='band', fs=SR, output='sos'), rng.standard_normal(len(t)))
    env = np.sin(np.pi * np.clip(t / 0.45, 0, 1)) ** 1.5
    쓰기('knit.wav', n * env, 0.7)


# 덜덜 — 이가 부딪치는 짧은 딸깍을 12번(1초)
def 덜덜():
    t = 판(1.0)
    x = np.zeros_like(t)
    for k in range(12):
        at = max(0.0, k / 12 + rng.uniform(-0.01, 0.01))
        i = int(at * SR)
        ln = int(0.012 * SR)
        click = rng.standard_normal(ln) * np.exp(-np.arange(ln) / (0.002 * SR))
        m = min(ln, len(x) - i)
        x[i:i + m] += click[:m]
    x = sosfilt(butter(2, [1500, 6000], btype='band', fs=SR, output='sos'), x)
    쓰기('chatter.wav', x, 0.6)


바람()
스윽()
덜덜()

# 배경음 — 보유곡 「따뜻_118」 4초부터 TOTAL초(편 길이는 Film의 TOTAL — 넉넉히 자르고 Remotion이 끝에서 줄인다)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '따뜻_118.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '4', '-t', str(TOTAL), '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('소리 · 배경음 만듦')
