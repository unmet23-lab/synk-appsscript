# LAB 몽골 M63 소리 — 밤 원룸 공기 · 꼬르륵 · 폰 톡톡 · 회상 반짝 · 매운 지글 · 두근 · 폰 진동 · 발끝 걸음 · 종이봉투 바스락 · 뚜껑 뽁 · 김 · 킁킁 · 벌떡 · 끝 딩을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「따뜻_118」 4~22초(곡 안 빈 마디 62.25~63.75초 밖 — 지난 두 몽골 편 M64 시티팝_147 · M61 05_Toddler-Kids와 다른 곡).
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_배달_mn_20261120/소리/만들기.py
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
rng = np.random.default_rng(1120)


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


# 밤 원룸 공기 — 냉장고 웅 + 먼 도시 소리, 영상 끝까지(말 사이가 비지 않게)
t = 판(19)
웅 = np.sin(2 * np.pi * 60 * t) * 0.25 + np.sin(2 * np.pi * 120 * t) * 0.12
도시 = 띠(rng.standard_normal(len(t)), 150, 900) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.21 * t))
쓰기('air.wav', 저역(rng.standard_normal(len(t)), 260) * 0.6 + 0.5 * 도시 + 웅, 0.5)

# 꼬르륵 — 배고픈 몽글(머리 칸)
d = 판(0.75)
f = 95 + 40 * np.sin(2 * np.pi * 7 * d) + 30 * d
쓰기('growl.wav', (np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * d)) + 0.3 * 띠(rng.standard_normal(len(d)), 120, 500)) * np.clip(np.sin(np.pi * d / d[-1]), 0, None) ** 0.7, 0.7)

# 폰 톡톡 — 요청 사항 칸에 적는다(네 마디마다)
버퍼 = np.zeros(int(0.7 * SR))
for at in [0.0, 0.11, 0.2, 0.33, 0.42, 0.55]:
    c = 판(0.035)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 2500, 7000) * np.exp(-c * 140), at, 0.6 + 0.4 * rng.random())
쓰기('tap.wav', 버퍼, 0.5)

# 회상 반짝 — 💭 지난번(위로 오르는 맑은 소리)
d = 판(0.9)
버퍼 = np.zeros(len(d))
for k, fq in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
    c = 판(0.6)
    얹기(버퍼, np.sin(2 * np.pi * fq * c) * np.exp(-c * 6), 0.08 * k, 0.6)
쓰기('memory.wav', 버퍼 + 0.15 * 띠(rng.standard_normal(len(d)), 3000, 9000) * np.sin(np.pi * d / d[-1]), 0.5)

# 매운 지글 — 떡볶이(회상)
d = 판(1.6)
버퍼 = 0.3 * 띠(rng.standard_normal(len(d)), 2500, 9000) * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * d))
at = 0.02
while at < 1.5:
    c = 판(0.07)
    fq = 300 + 500 * rng.random()
    얹기(버퍼, np.sin(2 * np.pi * (fq + 900 * c) * c) * np.exp(-c * 60), at, 0.5 + 0.5 * rng.random())
    at += 0.05 + 0.08 * rng.random()
쓰기('sizzle.wav', 버퍼 * np.minimum(1, (d[-1] - d) * 4), 0.55)

# 땀 · 김 뿜 — 빨개진 몽글 머리 위 김(칙)
d = 판(0.5)
쓰기('puff.wav', 띠(rng.standard_normal(len(d)), 1800, 8000) * np.exp(-d * 6) * np.minimum(1, d * 40), 0.55)

# 두근두근 — 인터폰이 룸메이트 머리 바로 위
버퍼 = np.zeros(int(1.3 * SR))
for at in [0.0, 0.22, 0.6, 0.82]:
    c = 판(0.16)
    얹기(버퍼, np.sin(2 * np.pi * (70 - 25 * c / c[-1]) * c) * np.exp(-c * 22), at, 1.0 if at in (0.0, 0.6) else 0.7)
쓰기('heart.wav', 버퍼, 0.8)

# 문 쪽 살핌 — 작은 똑(문 앞)
d = 판(0.18)
쓰기('tick.wav', np.sin(2 * np.pi * (1500 + 2600 * d / d[-1]) * d) * np.exp(-d * 30), 0.5)

# 폰 진동 — 드르륵 드르륵(무음)
버퍼 = np.zeros(int(0.9 * SR))
for at in [0.0, 0.42]:
    c = 판(0.3)
    얹기(버퍼, (np.sign(np.sin(2 * np.pi * 150 * c)) * 0.5 + 0.5 * np.sin(2 * np.pi * 150 * c)) * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * c)) * np.minimum(1, (0.3 - c) * 30) * np.minimum(1, c * 60), at)
쓰기('buzz.wav', 저역(버퍼, 2200), 0.6)

# 발끝 걸음 — 살금살금(기사)
버퍼 = np.zeros(int(1.2 * SR))
for at in [0.0, 0.3, 0.6]:
    c = 판(0.06)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 800, 3500) * np.exp(-c * 70), at, 0.7)
쓰기('step.wav', 버퍼, 0.45)

# 종이봉투 바스락 — 문 앞에 살짝 놓는다
d = 판(0.6)
버퍼 = np.zeros(len(d))
at = 0.0
while at < 0.5:
    c = 판(0.03)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 2000, 9000) * np.exp(-c * 90), at, 0.3 + 0.7 * rng.random())
    at += 0.015 + 0.04 * rng.random()
쓰기('rustle.wav', 버퍼 * np.sin(np.pi * d / d[-1]), 0.5)

# 뚜껑 뽁
d = 판(0.12)
쓰기('lid.wav', np.sin(2 * np.pi * (700 - 2600 * d) * d) * np.exp(-d * 35) + 0.3 * 띠(rng.standard_normal(len(d)), 1500, 6000) * np.exp(-d * 60), 0.7)

# 김 — 쉬이(떡볶이 김이 방을 건너간다)
d = 판(2.0)
쓰기('steam.wav', 띠(rng.standard_normal(len(d)), 900, 5000) * np.minimum(1, d * 3) * np.minimum(1, (d[-1] - d) * 2) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.9 * d)), 0.4)

# 킁킁 — 자면서 냄새를 맡는다
버퍼 = np.zeros(int(0.8 * SR))
for at in [0.0, 0.25]:
    c = 판(0.16)
    얹기(버퍼, 띠(rng.standard_normal(len(c)), 500, 3000) * np.sin(np.pi * c / c[-1]) ** 2, at)
쓰기('sniff.wav', 버퍼, 0.6)

# 벌떡 — 휙 + 뿅
d = 판(0.4)
휙 = 띠(rng.standard_normal(len(d)), 400, 3500) * np.sin(np.pi * d / d[-1]) ** 2
뿅 = np.sin(2 * np.pi * np.cumsum(300 + 900 * d / d[-1]) / SR) * np.exp(-d * 6)
쓰기('boing.wav', 0.6 * 휙 + 0.7 * 뿅, 0.75)

# 끝 딩 — 맑은 두 음
버퍼 = np.zeros(int(1.4 * SR))
for at, fq in [(0.0, 1568.0), (0.16, 2093.0)]:
    c = 판(1.0)
    얹기(버퍼, (np.sin(2 * np.pi * fq * c) + 0.3 * np.sin(2 * np.pi * 2 * fq * c)) * np.exp(-c * 4), at)
쓰기('ding.wav', 버퍼, 0.5)

# 뽁 — 눈이 번쩍
d = 판(0.09)
쓰기('pop.wav', np.sin(2 * np.pi * (900 - 4200 * d) * d) * np.exp(-d * 42), 0.75)

# 우물우물 — 룸메이트가 떡볶이를 먹는다(쫀득한 두 번 씹기)
버퍼 = np.zeros(int(0.45 * SR))
for at in [0.0, 0.2]:
    c = 판(0.14)
    얹기(버퍼, (0.6 * np.sin(2 * np.pi * (180 + 120 * c / c[-1]) * c) + 0.5 * 띠(rng.standard_normal(len(c)), 300, 1800)) * np.sin(np.pi * c / c[-1]) ** 1.5, at)
쓰기('munch.wav', 버퍼, 0.6)

# 음악
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '따뜻_118.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '4', '-i', 곡, '-t', '19', '-ar', '48000', '-ac', '2', '-af', 'afade=t=in:st=0:d=0.3,afade=t=out:st=17.6:d=1.2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝:', sorted(os.listdir(밖)))
