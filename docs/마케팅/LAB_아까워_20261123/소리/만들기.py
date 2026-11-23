# LAB 영어 E62 「아까워」 소리 — 분식집 바탕(방 웅성임 + 뒤 부엌 철판의 지글 소리) · 철판을 들어 올리는 짧은 긁힘 ·
# 몽글이 철판에 매달리는 툭 + 낮은 쿵 · 아주머니가 굳는 뚝을 직접 만든다(남의 음원 없음).
# 휙 · 뿅 · 반짝 · 꾹은 E58 「동결건조」가 가져온 것(E48이 만든 것)을 그대로 가져온다.
# 음악은 보유곡 「퀴즈120_키즈파티」 0초부터(빈 마디 없음 · 지난 두 영어 편 E58 「시티팝_147」 · E57 「따뜻_118」과 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_아까워_20261123/소리/만들기.py
import os
import shutil
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
공개 = os.path.join(여기, '..', 'remotion', 'public')
밖 = os.path.join(공개, 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1123)
TOTAL = 30.0


def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 띠(lo, hi, n, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), n)


# 분식집 바탕 — 낮은 방 웅성임 + 뒤 부엌 철판의 지글(높은 띠 잡음이 잘게 출렁임) + 드문 그릇 딸깍. 두 귀를 따로.
def 분식집():
    t = 판(TOTAL)
    out = []
    for ch in range(2):
        room = 띠(80, 380, rng.standard_normal(len(t))) * (0.75 + 0.15 * np.sin(2 * np.pi * 0.07 * t + ch))
        sizzle = 띠(3500, 9000, rng.standard_normal(len(t))) * 0.22
        crackle = np.zeros_like(t)
        for _ in range(int(TOTAL * 25)):
            i = int(rng.uniform(0, TOTAL - 0.01) * SR)
            ln = int(0.004 * SR)
            crackle[i:i + ln] += rng.standard_normal(ln) * np.exp(-np.arange(ln) / (0.0008 * SR)) * rng.uniform(0.1, 0.5)
        crackle = 띠(2500, 10000, crackle)
        clinks = np.zeros_like(t)
        for at in rng.uniform(0.5, TOTAL - 1, size=int(TOTAL / 4)):
            i = int(at * SR)
            tt = np.arange(int(0.25 * SR)) / SR
            f = rng.uniform(1800, 2600)
            clinks[i:i + len(tt)] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.05) * 0.12
        fade = np.minimum(1, np.minimum(t / 0.4, (TOTAL - t) / 0.8))
        out.append((room + sizzle + crackle * 0.6 + clinks) * fade)
    쓰기('bunsik.wav', np.stack(out, axis=1), 0.45)


# 들어 올림 — 철판이 상에서 떨어지는 짧은 긁힘(띠 잡음이 0.25초 미끄러짐) + 끝의 가벼운 툭, 0.4초
def 들림():
    t = 판(0.4)
    n = 띠(400, 2400, rng.standard_normal(len(t)))
    env = np.clip(t / 0.03, 0, 1) * np.exp(-np.maximum(t - 0.05, 0) / 0.09)
    thud = np.sin(2 * np.pi * 140 * t) * np.exp(-t / 0.05) * 0.5
    쓰기('lift.wav', n * env + thud, 0.6)


# 매달림 — 몽글이 철판 가장자리에 붙는 부드러운 툭(낮은 쿵 · 짧은 펠트 바스락) + 철판이 살짝 흔들리는 낮은 울림, 0.6초
def 매달림():
    t = 판(0.6)
    thump = np.sin(2 * np.pi * (95 - 30 * t) * t) * np.exp(-t / 0.07)
    fuzz = 띠(300, 1800, rng.standard_normal(len(t))) * np.exp(-t / 0.03) * 0.6
    wobble = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.18) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * 0.25
    쓰기('cling.wav', thump + fuzz + wobble, 0.8)


# 굳음 — 아주머니가 멈추는 순간의 짧고 낮은 뚝(나무토막 두드림), 0.25초
def 굳음():
    t = 판(0.25)
    x = np.sin(2 * np.pi * 620 * t) * np.exp(-t / 0.025) + 0.5 * np.sin(2 * np.pi * 1240 * t) * np.exp(-t / 0.012)
    쓰기('freeze.wav', 띠(300, 4000, x), 0.6)


분식집()
들림()
매달림()
굳음()


# 2단계(15시 회차) — 볶음밥 한 국자가 철판에 털썩 떨어지는 소리(부드러운 낮은 툭 + 짧은 바스락), 0.35초
def 털썩():
    t = 판(0.35)
    thud = np.sin(2 * np.pi * (120 - 40 * t) * t) * np.exp(-t / 0.06)
    rustle = 띠(600, 3500, rng.standard_normal(len(t))) * np.exp(-t / 0.05) * 0.5
    쓰기('plop.wav', thud + rustle, 0.7)


# 몽글이 밥에 얼굴을 묻고 먹는 소리 — 펠트가 눌리는 작은 꾹 세 번(0.22초 간격), 0.8초
def 냠():
    t = 판(0.8)
    x = np.zeros_like(t)
    for k, at in enumerate((0.0, 0.22, 0.44)):
        i = int(at * SR)
        tt = np.arange(int(0.18 * SR)) / SR
        f = 180 + 30 * k
        x[i:i + len(tt)] += (np.sin(2 * np.pi * f * tt) * 0.8 + 띠(500, 2500, rng.standard_normal(len(tt))) * 0.35) * np.exp(-tt / 0.04)
    쓰기('munch.wav', x, 0.6)


털썩()
냠()

# E58이 가져온 짧은 효과음(E48이 만든 것)
전편 = os.path.join(여기, '..', '..', 'LAB_동결건조_20261121', 'remotion', 'public', 'sfx')
for f in ('whoosh.wav', 'squish.wav', 'pop.wav', 'sparkle.wav'):
    shutil.copyfile(os.path.join(전편, f), os.path.join(밖, f))

# 배경음 — 보유곡 「퀴즈120_키즈파티」 0초부터 TOTAL초(빈 마디 없는 곡 — README 「곡 안 빈 마디」)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '퀴즈120_키즈파티_c10ef6f1.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '0', '-t', str(TOTAL), '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('소리 · 배경음 만듦')
