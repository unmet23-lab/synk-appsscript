# LAB 몽골 M64 소리 — 먹자골목 공기 · 발소리 · 떡볶이 끓는 소리 · 땀방울 · 치킨 바삭 · 편의점 문 종 · 생각 똑똑 · 참을성 내려가는 소리 · 주전자 끓어 넘침 · 휙 · 쿵을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「시티팝_147」 27.5~58.5초(곡 안 빈 마디 26.25~27초를 피함 — 지난 두 몽골 편 M61 05_Toddler-Kids · M60과 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_아무거나_mn_20261119/소리/만들기.py
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
rng = np.random.default_rng(1119)


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


# 먹자골목 공기 — 먼 웅성임 + 바람, 영상 끝까지(말 사이가 비지 않게)
t = 판(31)
웅성 = 띠(rng.standard_normal(len(t)), 220, 1200) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.37 * t + 1)) * (0.8 + 0.2 * np.sin(2 * np.pi * 1.3 * t))
쓰기('air.wav', 저역(rng.standard_normal(len(t)), 300) * 0.8 + 0.35 * 웅성, 0.5)

# 경고 — 삐삐(참을성 1%)
버퍼 = np.zeros(int(0.5 * SR))
for at in [0.0, 0.2]:
    c = 판(0.11)
    얹기(버퍼, np.sign(np.sin(2 * np.pi * 1320 * c)) * 0.5 * np.minimum(1, (0.11 - c) * 40), at)
쓰기('low.wav', 저역(버퍼, 5000), 0.55)

# 바람 빠지는 소리 — 머리 칸에서 친구가 축 처질 때
d = 판(0.9)
쓰기('deflate.wav', 띠(rng.standard_normal(len(d)), 500, 2600) * np.exp(-d * 2.2) * np.sin(np.pi * d / d[-1]) + 0.25 * np.sin(2 * np.pi * np.cumsum(420 - 260 * d / d[-1]) / SR) * np.exp(-d * 3), 0.6)

# 뽁
d = 판(0.09)
쓰기('pop.wav', np.sin(2 * np.pi * (900 - 4200 * d) * d) * np.exp(-d * 42), 0.75)

# 발소리 — 골목에 들어선다(톡톡톡)
버퍼 = np.zeros(int(1.4 * SR))
for at in [0.0, 0.32, 0.64, 0.96]:
    c = 판(0.09)
    얹기(버퍼, (np.sin(2 * np.pi * 110 * c) + 0.6 * 띠(rng.standard_normal(len(c)), 600, 3000)) * np.exp(-c * 45), at)
쓰기('step.wav', 버퍼, 0.6)

# 참을성 내려가는 소리 — 삐-용
d = 판(0.5)
f = 880 - 620 * d / d[-1]
쓰기('drain.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-d * 3.5), 0.6)

# 떡볶이 끓는 소리 — 보글보글 1.9초
d = 판(1.9)
버퍼 = 0.25 * 띠(rng.standard_normal(len(d)), 2500, 9000) * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * d))
at = 0.02
while at < 1.8:
    c = 판(0.07)
    fq = 300 + 500 * rng.random()
    얹기(버퍼, np.sin(2 * np.pi * (fq + 900 * c) * c) * np.exp(-c * 60), at, 0.5 + 0.5 * rng.random())
    at += 0.05 + 0.08 * rng.random()
쓰기('sizzle.wav', 버퍼 * np.minimum(1, (d[-1] - d) * 4), 0.6)

# 땀방울 — 똑
d = 판(0.18)
쓰기('drip.wav', np.sin(2 * np.pi * (1500 + 2600 * d / d[-1]) * d) * np.exp(-d * 30), 0.6)

# 치킨 바삭 — 와사삭
버퍼 = np.zeros(int(0.6 * SR))
for at in [0.0, 0.07, 0.15, 0.24, 0.3]:
    c = 판(0.06)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 1800, 8000) * np.exp(-c * 80), at, 0.6 + 0.4 * rng.random())
쓰기('crunch.wav', 버퍼, 0.6)

# 편의점 문 종 — 띵동
버퍼 = np.zeros(int(1.2 * SR))
for at, fq in [(0.0, 1318.5), (0.28, 1046.5)]:
    c = 판(0.8)
    얹기(버퍼, (np.sin(2 * np.pi * fq * c) + 0.4 * np.sin(2 * np.pi * 2 * fq * c)) * np.exp(-c * 5), at)
쓰기('ding.wav', 버퍼, 0.55)

# 생각 — 똑 똑 똑(점 셋)
버퍼 = np.zeros(int(1.2 * SR))
for at in [0.0, 0.35, 0.7]:
    c = 판(0.08)
    얹기(버퍼, np.sin(2 * np.pi * 1700 * c) * np.exp(-c * 55), at)
쓰기('think.wav', 버퍼, 0.5)

# 주전자 끓어 넘침 — 올라가는 휘파람 + 칙 김(참을성 폭발)
d = 판(0.9)
f = 900 + 1500 * (d / d[-1]) ** 1.6
휘 = np.sin(2 * np.pi * np.cumsum(f) / SR) * (d / d[-1]) ** 0.8
김 = 띠(rng.standard_normal(len(d)), 2500, 9000) * (d / d[-1]) ** 2
버퍼 = np.zeros(int(1.4 * SR))
얹기(버퍼, 0.6 * 휘 + 0.8 * 김, 0.0)
c = 판(0.5)
얹기(버퍼, 띠(rng.standard_normal(len(c)), 1500, 9000) * np.exp(-c * 7), 0.9, 1.1)
쓰기('kettle.wav', 버퍼, 0.8)

# 휙 — 메뉴판을 내민다
d = 판(0.35)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(d)), 400, 3500) * np.sin(np.pi * d / d[-1]) ** 2, 0.7)

# 쿵 — 친구가 메뉴판에 엎어진다
d = 판(0.45)
쓰기('thud.wav', np.sin(2 * np.pi * (140 * np.exp(-d * 9) + 55) * d) * np.exp(-d * 11) + 0.25 * 띠(rng.standard_normal(len(d)), 250, 1400) * np.exp(-d * 25), 0.9)

# 음악
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '27.5', '-i', 곡, '-t', '31', '-ar', '48000', '-ac', '2', '-af', 'afade=t=in:st=0:d=0.3,afade=t=out:st=29.4:d=1.4', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝:', sorted(os.listdir(밖)))
