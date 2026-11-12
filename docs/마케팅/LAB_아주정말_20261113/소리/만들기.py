# LAB 영어 E37 「very」 소리 — 사전이 펑 열리는 소리 · 조각이 튀어나오는 뾱 · 휙 · 조각이 더미에 떨어지는 툭 · 쏟아지는 우르르 ·
# 방 공기(바탕) · 몽글이 더미에서 고개를 내미는 뽁 · 맑은 종을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「퀴즈120_키즈파티」 0초부터 20초(빈 마디 없는 곡 · 지난 두 영어 편 E36 시티팝_147 · E41 밝은_052와 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_아주정말_20261113/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1137)


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


# 방 공기 — 밤 방의 낮은 웅웅(음악을 낮출 때 밑에 깔린다) 20초
t = 판(20)
쓰기('room.wav', 저역(rng.standard_normal(len(t)), 220) * 1.0 + 띠(rng.standard_normal(len(t)), 300, 1200) * 0.05, 0.25)

# 펑 — 사전이 열리며 조각이 터져 나온다(낮은 쿵 + 바람)
t = 판(0.7)
펑 = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t * 9) + 50) / SR) * np.exp(-t * 7) + 띠(rng.standard_normal(len(t)), 600, 6000) * np.exp(-t * 6) * 0.5
쓰기('burst.wav', 펑, 0.8)

# 뾱 — 조각이 튀어나올 때(올라가는 짧은 음)
t = 판(0.22)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(380 + 1700 * t) / SR) * np.sin(np.pi * t / 0.22) ** 1.2, 0.5)

# 뽁 — 글자 · 몽글이 나타날 때
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 휙
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.4) ** 2, 0.6)

# 툭 — 펠트 조각이 더미에 떨어진다(부드러운 낮은 음)
t = 판(0.2)
쓰기('thud.wav', np.sin(2 * np.pi * np.cumsum(170 * np.exp(-t * 18) + 70) / SR) * np.exp(-t * 26) + 띠(rng.standard_normal(len(t)), 200, 1500) * np.exp(-t * 40) * 0.4, 0.6)

# 우르르 — 조각이 쏟아져 방을 채운다(툭이 점점 빽빽해진다) 3.6초
t = 판(3.6)
우르르 = np.zeros(len(t))
d = 판(0.16)
툭 = np.sin(2 * np.pi * np.cumsum(160 * np.exp(-d * 18) + 65) / SR) * np.exp(-d * 28)
at = 0.0
while at < 3.3:
    얹기(우르르, 툭 * (0.6 + 0.4 * rng.random()), at, 1.0)
    at += max(0.025, 0.16 * (1 - at / 3.3)) * (0.6 + 0.8 * rng.random())
우르르 += 띠(rng.standard_normal(len(t)), 150, 900) * np.sin(np.pi * np.clip(t / 3.6, 0, 1)) * 0.25
쓰기('rumble.wav', 우르르, 0.7)

# 맑은 종
t = 판(1.1)
쓰기('ding.wav', sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 1318), (0.5, 1976), (0.25, 2637)]) * np.exp(-t * 4.5), 0.5)

# 음악 — 보유곡 「퀴즈120_키즈파티」 0초부터 20초(빈 마디 없는 곡)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '퀴즈120_키즈파티_c10ef6f1.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '퀴즈120_키즈파티_c10ef6f1.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '0', '-t', '20', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
