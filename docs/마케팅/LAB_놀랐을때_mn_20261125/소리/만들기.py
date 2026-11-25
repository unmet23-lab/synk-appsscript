# LAB 몽골 M76 소리 — 귀신의 집 방 공기 · 후루룩 · 거미줄 내려옴 · 불 깜박 · 부르르 · 발견 · 달려감을 직접 만들고(남의 음원 없음),
# 앞 편에서 직접 만든 톡 · 쏙 · 용수철 · 쿵 · 휙 소리를 가져온다. 음악은 보유곡 「the_watchmakers_tea」(음악 자산 장부 10-29, Gemini 앱 연주곡 · 아직 나간 곳 없음) 한 토막.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_놀랐을때_mn_20261125/소리/만들기.py
import os
import shutil
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
마케팅 = os.path.abspath(os.path.join(여기, '..', '..'))
rng = np.random.default_rng(1125)


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
    n = min(len(x), len(버퍼) - j)
    if n > 0:
        버퍼[j:j + n] += x[:n] * 세기


# 방 공기 — 낮은 바람이 문틈으로 흐른다 + 아주 낮은 웅(24초)
t = 판(24.5)
바람 = 띠(rng.standard_normal(len(t)), 220, 700) * (0.4 + 0.6 * np.sin(2 * np.pi * 0.17 * t + 0.7) ** 2)
쓰기('room.wav', 바람 + 0.7 * 저역(rng.standard_normal(len(t)), 150) + 0.1 * np.sin(2 * np.pi * 55 * t), 0.5)

# 후루룩 — 국수를 빨아올린다(떨리는 잡음이 위로)
d = 판(0.9)
떨림 = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(34 + 26 * d / d[-1]) / SR)) * 0.8
결 = sum(띠(rng.standard_normal(len(d)), lo, lo * 1.8) * w for lo, w in [(700, 1.0), (1400, 0.7), (2600, 0.35)])
env = np.minimum(1, d / 0.06) * np.clip((d[-1] - d) / 0.12, 0, 1)
쓰기('slurp.wav', 결 * 저역(떨림, 160) * env, 0.75)

# 거미줄 — 줄을 타고 주르륵(내려가는 작은 활 소리)
d = 판(0.62)
f = 1500 * np.exp(-1.7 * d / d[-1])
줄 = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * d))
env = np.minimum(1, d / 0.03) * np.clip((d[-1] - d) / 0.1, 0, 1)
쓰기('thread.wav', (0.5 * 줄 + 0.35 * 띠(rng.standard_normal(len(d)), 1200, 4200)) * env, 0.7)

# 불 깜박 — 지직 두 번
buf = np.zeros(int(0.8 * SR))
for at, n in [(0.0, 0.16), (0.3, 0.24)]:
    d = 판(n)
    지직 = np.sign(np.sin(2 * np.pi * 100 * d)) * (rng.random(len(d)) > 0.35) + 0.4 * rng.standard_normal(len(d))
    얹기(buf, 띠(지직, 700, 5200) * np.clip((n - d) / 0.05, 0, 1), at)
쓰기('flicker.wav', buf, 0.6)

# 부르르 — 펠트가 떠는 소리(작고 빠른 부스럭)
d = 판(0.9)
결 = 띠(rng.standard_normal(len(d)), 500, 2400) * (0.5 + 0.5 * np.sin(2 * np.pi * 17 * d)) ** 2
쓰기('shiver.wav', 결 * np.minimum(1, d / 0.05) * np.clip((d[-1] - d) / 0.3, 0, 1), 0.6)

# 발견 — 현을 확 긁는 짧은 놀람(작은 2도 겹침이 위로 튄다)
d = 판(0.7)
켜 = np.zeros(len(d))
for f0, w in [(740, 1.0), (784, 0.9), (1109, 0.5), (1175, 0.45)]:
    for h in range(1, 6):
        켜 += w / h * np.sin(2 * np.pi * f0 * h * d * (1 + 0.004 * np.sin(2 * np.pi * 7 * d)))
켜 = 저역(켜, 5200) * np.minimum(1, d / 0.008) * np.exp(-5.2 * d)
쓰기('sting.wav', 켜, 0.75)

# 달려감 — 폭신한 발이 다다다다 멀어진다(1.4초)
buf = np.zeros(int(1.5 * SR))
at, gap, vol = 0.0, 0.13, 1.0
while at < 1.35:
    d = 판(0.09)
    쿵 = np.sin(2 * np.pi * np.cumsum(150 * np.exp(-9 * d)) / SR) * np.exp(-38 * d) + 0.35 * 띠(rng.standard_normal(len(d)), 300, 1500) * np.exp(-50 * d)
    얹기(buf, 쿵, at, vol)
    at += gap
    vol *= 0.82
쓰기('run.wav', buf, 0.8)

# 앞 편에서 직접 만든 소리
for 이름, 곳 in [
    ('boing.wav', 'LAB_붙다_mn_20261116'),
    ('pop.wav', 'LAB_붙다_mn_20261116'),
    ('tok.wav', 'LAB_보증금_mn_20261116'),
    ('thud.wav', 'LAB_보증금_mn_20261116'),
    ('whoosh.wav', 'LAB_붙다_mn_20261116'),
    ('steps.wav', 'LAB_한시간만요_20261114'),
]:
    shutil.copyfile(os.path.join(마케팅, 곳, 'remotion', 'public', 'sfx', 이름), os.path.join(밖, 이름))

# 음악 — 보유곡 the_watchmakers_tea(원곡은 저장소 밖)에서 24.2초
원곡 = 'C:/Users/q1212/ego/synkbrief-b2-20261029/music/track.wav'
시작 = float(os.environ.get('M76_BGM_START', '0'))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(시작), '-t', '24.2', '-i', 원곡, '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', os.path.join(여기, '..', 'remotion', 'public', 'bgm.wav')], check=True)
print('소리 끝')
