# LAB 영어 E40 「전기장판」 소리 — 한겨울 창밖 바람 · 이 딱딱 · 스위치 「딸깍」 · 전기장판이 데워지는 낮은 웅 · 스르르 녹는 「뭉」 · 김 「치익」 ·
# 알람 진동 · 알람 음 · 카드 「톡」 · 반짝을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「시티팝_147」 40초부터(빈 마디 없는 27~104초 안 · 지난 두 영어 편 E38 · E44의 「따뜻_118」과 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_전기장판_20261116/소리/만들기.py
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
rng = np.random.default_rng(1116)
TOTAL = 20.4


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


# 창밖 겨울바람 — 낮게 휘몰아치는 바람(세기가 천천히 오르내림) 영상 길이만큼. 방 바탕 소리로 늘 깔린다
t = 판(TOTAL + 0.5)
결 = 0.55 + 0.45 * np.sin(2 * np.pi * 0.17 * t + 1.0) * np.sin(2 * np.pi * 0.07 * t)
바람 = 띠(rng.standard_normal(len(t)), 180, 1400) * 결 + 띠(rng.standard_normal(len(t)), 900, 3200) * 0.15 * 결 ** 2
쓰기('wind.wav', np.stack([바람, np.roll(바람, 1700)], axis=1), 0.42)

# 이 딱딱 — 작은 딱 소리를 빠르게(추워서 떤다) 2.2초
t = 판(2.2)
딱 = np.zeros(len(t))
k = 0
at = 0.05
while at < 2.0:
    d = 판(0.03)
    얹기(딱, 띠(rng.standard_normal(len(d)), 2500, 7500) * np.exp(-d * 260), at, 0.6 + 0.4 * rng.random())
    at += 0.075 + 0.02 * rng.random()
    k += 1
쓰기('chatter.wav', 딱, 0.4)

# 스위치 「딸깍」 — 플라스틱 두 번 딸깍
t = 판(0.25)
딸깍 = np.zeros(len(t))
for at, f in [(0.0, 3200), (0.045, 2400)]:
    d = 판(0.04)
    얹기(딸깍, (띠(rng.standard_normal(len(d)), 1500, 8000) + np.sin(2 * np.pi * f * d) * 0.6) * np.exp(-d * 200), at)
쓰기('click.wav', 딸깍, 0.7)

# 데워지는 낮은 웅 — 전기장판이 켜지며 낮은 음이 올라오고 따뜻하게 퍼진다 2.4초
t = 판(2.4)
env = np.interp(t, [0, 0.6, 1.8, 2.4], [0, 1, 0.8, 0])
웅 = (np.sin(2 * np.pi * np.cumsum(80 + 60 * np.clip(t / 1.2, 0, 1)) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(160 + 120 * np.clip(t / 1.2, 0, 1)) / SR)) * env
웅 += 띠(rng.standard_normal(len(t)), 300, 1600) * env * 0.12
쓰기('warm.wav', 저역(웅, 1800), 0.5)

# 스르르 녹는 「뭉 ~」 — 낮게 늘어지며 내려앉는 부드러운 음 1.6초(몽글이 녹는 1.5초에 맞춤)
t = 판(1.6)
쓰기('melt.wav', np.sin(2 * np.pi * np.cumsum(300 * np.exp(-t * 1.6) + 70) / SR) * np.sin(np.pi * t / 1.6) ** 0.9 * (1 + 0.22 * np.sin(2 * np.pi * 7 * t)), 0.5)

# 김 「치익」 — 작은 김 소리 1.2초
t = 판(1.2)
쓰기('steam.wav', 띠(rng.standard_normal(len(t)), 3000, 9000) * np.interp(t, [0, 0.1, 0.8, 1.2], [0, 1, 0.5, 0]), 0.3)

# 알람 — 휴대폰 진동 「드르륵」 + 두 음 삐비빅(세 번) 2.2초
t = 판(2.2)
알람 = np.zeros(len(t))
for at in [0.0, 0.75, 1.5]:
    d = 판(0.5)
    진동 = 저역(rng.standard_normal(len(d)), 220) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 34 * d)))
    얹기(알람, 진동 * np.interp(d, [0, 0.03, 0.45, 0.5], [0, 1, 1, 0]), at, 0.7)
    for j, f in enumerate([1568, 1976, 1568, 1976]):
        dd = 판(0.08)
        얹기(알람, np.sin(2 * np.pi * f * dd) * np.interp(dd, [0, 0.005, 0.07, 0.08], [0, 1, 1, 0]), at + 0.05 + j * 0.1, 0.35)
쓰기('alarm.wav', 알람, 0.6)

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

# 휙 — 장면이 바뀔 때
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5000) * np.sin(np.pi * t / 0.4) ** 2, 0.4)

# 늘어남 「쭈우욱」 — 고무처럼 천천히 올라가는 음(일어나려던 몽글이 치즈처럼 늘어나는 2.4초)
t = 판(2.6)
쓰기('stretch.wav', np.sin(2 * np.pi * np.cumsum(130 + 360 * np.clip(t / 2.4, 0, 1) ** 0.7) / SR) * np.interp(t, [0, 0.15, 2.3, 2.6], [0, 1, 0.8, 0]) * (1 + 0.3 * np.sin(2 * np.pi * 11 * t)), 0.42)

# 다시 녹음 「철퍽」 — 낮은 털썩 + 짧은 물컹
t = 판(0.6)
철퍽 = np.sin(2 * np.pi * np.cumsum(180 * np.exp(-t * 9) + 50) / SR) * np.exp(-t * 7) + 저역(rng.standard_normal(len(t)), 900) * np.exp(-t * 14) * 0.6
쓰기('splat.wav', 철퍽, 0.6)

# 음악 — 시티팝_147 40초부터 영상 길이만큼(끝 0.8초 사그라짐은 Remotion에서)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '40', '-t', f'{TOTAL + 0.3:.2f}', '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('소리 만듦')
