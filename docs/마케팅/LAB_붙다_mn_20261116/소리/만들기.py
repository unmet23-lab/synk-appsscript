# LAB 몽골 M43 「붙다」 소리 — 아침 바람 · 학교 종 · 오토바이 · 「쉿」 · 톡 · 반짝 · 철퍽 · 늘어남 · 통통 · 휙 · 끼익 · 방 공기를 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「밝은_052」 2초부터(빈 마디 없는 0~29초 안 · 지난 몽골 21시 편 M55 「단디」의 「01_Joyful」과 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_붙다_mn_20261116/소리/만들기.py
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
rng = np.random.default_rng(1143)
TOTAL = 21.0


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



# 아침 바람 — 가볍게 3초(첫 장면 교문)
t = 판(3.0)
바람 = 띠(rng.standard_normal(len(t)), 200, 1600) * np.interp(t, [0, 0.4, 2.4, 3.0], [0, 1, 0.8, 0])
쓰기('wind.wav', np.stack([바람, np.roll(바람, 900)], axis=1), 0.35)

# 방 공기 — 낮은 웅웅 영상 길이만큼
t = 판(TOTAL + 0.5)
방 = 저역(rng.standard_normal(len(t)), 160) * 0.8 + 띠(rng.standard_normal(len(t)), 300, 900) * 0.04
쓰기('room.wav', np.stack([방, np.roll(방, 1300)], axis=1), 0.3)

# 학교 종 — 맑은 차임 넷(딩동댕동)
t = 판(2.2)
종 = np.zeros(len(t))
for at, f in [(0.0, 784), (0.35, 659), (0.7, 523), (1.05, 392)]:
    d = 판(1.0)
    얹기(종, sum(w * np.sin(2 * np.pi * f * k * d) for w, k in [(1, 1), (0.3, 2.0), (0.15, 3.0)]) * np.exp(-d * 3.5), at)
쓰기('bell.wav', 종, 0.45)

# 오토바이 — 낮은 엔진이 다가와 서는 1.2초
t = 판(1.2)
엔진 = np.sin(2 * np.pi * np.cumsum(70 + 25 * np.sin(2 * np.pi * 9 * t) - 20 * t) / SR) * 0.7 + 띠(rng.standard_normal(len(t)), 200, 1200) * 0.3
쓰기('moto.wav', 엔진 * np.interp(t, [0, 0.3, 0.9, 1.2], [0, 1, 0.7, 0]), 0.45)

# 「쉿」 — 고요해지는 바람 소리 1초
t = 판(1.0)
쓰기('hush.wav', 띠(rng.standard_normal(len(t)), 2500, 8000) * np.interp(t, [0, 0.1, 0.7, 1.0], [0, 1, 0.4, 0]), 0.3)

# 카드 「톡」
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * np.cumsum(600 + 900 * np.exp(-t * 30)) / SR) * np.exp(-t * 28), 0.5)

# 반짝 — 맑은 종 셋이 올라감
t = 판(0.9)
반짝 = np.zeros(len(t))
for at, f in [(0.0, 1760), (0.08, 2217), (0.16, 2637)]:
    d = 판(0.7)
    얹기(반짝, np.sin(2 * np.pi * f * d) * np.exp(-d * 7), at)
쓰기('sparkle.wav', 반짝, 0.4)

# 철퍽 — 낮은 털썩 + 짧은 물컹(엿이 붙을 때)
t = 판(0.6)
철퍽 = np.sin(2 * np.pi * np.cumsum(180 * np.exp(-t * 9) + 50) / SR) * np.exp(-t * 7) + 저역(rng.standard_normal(len(t)), 900) * np.exp(-t * 14) * 0.6
쓰기('splat.wav', 철퍽, 0.6)

# 늘어남 「쭈욱」 — 엿이 끈적하게 늘어나는 1.2초
t = 판(1.3)
쓰기('stretch.wav', np.sin(2 * np.pi * np.cumsum(150 + 300 * np.clip(t / 1.1, 0, 1) ** 0.7) / SR) * np.interp(t, [0, 0.1, 1.0, 1.3], [0, 1, 0.8, 0]) * (1 + 0.3 * np.sin(2 * np.pi * 11 * t)), 0.4)

# 통통 — 몽글이 뛰어가는 소리
t = 판(0.6)
통 = np.zeros(len(t))
for at in [0.0, 0.2, 0.4]:
    d = 판(0.15)
    얹기(통, np.sin(2 * np.pi * np.cumsum(420 + 600 * d) / SR) * np.exp(-d * 30), at)
쓰기('boing.wav', 통, 0.5)

# 휙 — 장면이 바뀔 때
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5000) * np.sin(np.pi * t / 0.4) ** 2, 0.4)

# 끼익 — 문이 열리며 경첩이 우는 0.9초(몽글이 붙은 채 문이 열린다)
t = 판(0.9)
끼익 = np.zeros(len(t))
k = 0.0
while k < 0.85:
    d = 판(0.012)
    얹기(끼익, np.exp(-d * 400) * rng.uniform(0.6, 1.0), k)
    k += 1 / (38 + 50 * (k / 0.85) ** 1.5) * rng.uniform(0.85, 1.15)
끼익 = 띠(끼익, 900, 2600, 3) + 띠(끼익, 2800, 4200, 2) * 0.3
쓰기('creak.wav', 끼익 * np.interp(t, [0, 0.08, 0.7, 0.9], [0, 1, 0.8, 0]), 0.45)

# 음악 — 밝은_052 2초부터 영상 길이만큼(빈 마디 29~30초 밖)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '밝은_052.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '2', '-t', f'{TOTAL + 0.3:.2f}', '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('소리 만듦')
