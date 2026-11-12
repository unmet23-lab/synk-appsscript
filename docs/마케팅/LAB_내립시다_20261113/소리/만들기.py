# LAB 영어 E36 「내립시다」 소리 — 달리는 객차(낮은 웅웅 + 덜컹) · 사람들 웅성 · 문 열림 「치익」 · 출입문 닫힘 알림음 · 문 「쿵」 ·
# 열차 떠나는 소리 · 빈 승강장 울림 · 발소리 · 뾱 · 뽁 · 휙 · 시무룩 두 음 · 맑은 종을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「시티팝_147」 30초부터 33초(빈 마디 26.25~27초 뒤 · 지난 두 영어 편 E41 밝은_052 · E30 따뜻_118과 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_내립시다_20261113/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1136)


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


# 달리는 객차 — 낮은 웅웅 + 레일 이음매 덜컹(두 번씩) + 옅은 바람 11초
t = 판(11)
웅 = 저역(rng.standard_normal(len(t)), 140) * 1.0 + np.sin(2 * np.pi * 58 * t) * 0.12
덜컹 = np.zeros(len(t))
for at in np.arange(0.3, 10.6, 0.82):
    d = 판(0.12)
    뚝 = np.sin(2 * np.pi * np.cumsum(150 * np.exp(-d * 30) + 60) / SR) * np.exp(-d * 34)
    얹기(덜컹, 뚝, at, 0.7)
    얹기(덜컹, 뚝, at + 0.15, 0.5)
쓰기('car.wav', np.stack([웅 + 덜컹, np.roll(웅, 700) + 덜컹], axis=1) + 띠(rng.standard_normal(len(t)), 900, 3000)[:, None] * 0.02, 0.5)

# 사람들 웅성 — 여러 낮은 목소리 띠가 따로 오르내린다 9초
t = 판(9)
웅성 = np.zeros(len(t))
for k in range(7):
    f0 = 120 + 30 * k + 12 * np.sin(2 * np.pi * (0.3 + 0.11 * k) * t + k)
    결 = np.clip(np.sin(2 * np.pi * (1.7 + 0.37 * k) * t + 2 * k) + 0.3, 0, 1)
    웅성 += sum(np.sin(2 * np.pi * np.cumsum(f0 * h) / SR) / h for h in range(1, 6)) * 결
쓰기('crowd.wav', 띠(웅성, 280, 1600), 0.4)

# 문 열림 — 공기 「치익」 + 미끄러지는 낮은 음
t = 판(0.9)
쓰기('open.wav', 띠(rng.standard_normal(len(t)), 2200, 7000) * np.exp(-t * 5) * 0.7 + np.sin(2 * np.pi * np.cumsum(140 + 90 * t) / SR) * np.sin(np.pi * t / 0.9) ** 2 * 0.5, 0.55)

# 출입문 닫힘 알림음 — 같은 두 음을 세 번(삐리 삐리 삐리)
t = 판(1.25)
알림 = np.zeros(len(t))
for i in range(3):
    for j, f in enumerate([1568, 1245]):
        d = 판(0.16)
        얹기(알림, (np.sin(2 * np.pi * f * d) + 0.3 * np.sin(2 * np.pi * 2 * f * d)) * np.sin(np.pi * d / 0.16) ** 0.6, i * 0.4 + j * 0.18, 1.0)
쓰기('chime.wav', 알림, 0.5)

# 문 닫힘 — 「치익」 + 고무가 맞닿는 낮은 「쿵」
t = 판(0.8)
쿵 = np.zeros(len(t))
d = 판(0.35)
얹기(쿵, 띠(rng.standard_normal(len(d)), 2000, 6500) * (1 - d / 0.35) ** 1.5, 0.0, 0.5)
d = 판(0.4)
얹기(쿵, np.sin(2 * np.pi * np.cumsum(120 * np.exp(-d * 18) + 48) / SR) * np.exp(-d * 11), 0.33, 1.0)
쓰기('shut.wav', 쿵, 0.7)

# 열차가 떠난다 — 모터 음이 올라가며 멀어지고 바람이 훑고 지나간다 4.2초
t = 판(4.2)
모터 = np.sin(2 * np.pi * np.cumsum(90 + 260 * (t / 4.2) ** 1.4) / SR) * 0.5 + np.sin(2 * np.pi * np.cumsum(180 + 520 * (t / 4.2) ** 1.4) / SR) * 0.2
굴림 = 저역(rng.standard_normal(len(t)), 260) * 1.3
바람 = 띠(rng.standard_normal(len(t)), 500, 3800) * 0.5
크기 = np.interp(t, [0, 0.5, 1.6, 3.0, 4.2], [0.25, 0.8, 1.0, 0.45, 0.0])
쓰기('depart.wav', (모터 + 굴림 + 바람) * 크기, 0.75)

# 빈 승강장 — 낮은 환풍 웅웅 + 멀리 울리는 빈 소리 20초
t = 판(23)
승강장 = 저역(rng.standard_normal(len(t)), 170) * 0.9 + 띠(rng.standard_normal(len(t)), 500, 1200) * 0.05 + np.sin(2 * np.pi * 100 * t) * 0.05
쓰기('station.wav', np.stack([승강장, np.roll(승강장, 1100)], axis=1), 0.42)

# 발소리 — 빠른 걸음 여섯이 멀어진다
t = 판(1.9)
걸음 = np.zeros(len(t))
for i in range(7):
    d = 판(0.09)
    얹기(걸음, (np.sin(2 * np.pi * np.cumsum(260 * np.exp(-d * 40) + 110) / SR) + 띠(rng.standard_normal(len(d)), 1500, 4000) * 0.3) * np.exp(-d * 45), 0.05 + i * 0.26, 1.0 - 0.11 * i)
쓰기('steps.wav', 걸음, 0.5)

# 뾱 — 몽글이 번쩍
t = 판(0.3)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(420 + 1500 * t) / SR) * np.sin(np.pi * t / 0.3) ** 1.3 * (1 + 0.3 * np.sin(2 * np.pi * 26 * t)), 0.5)

# 뽁 — 글자가 나타날 때
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 휙 — 장면이 넘어갈 때
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.4) ** 2, 0.6)

# 통통 — 몽글이 따라 나선다
t = 판(0.7)
통 = np.zeros(len(t))
for i, at in enumerate([0.0, 0.2, 0.4]):
    d = 판(0.16)
    얹기(통, np.sin(2 * np.pi * np.cumsum(190 * np.exp(-d * 14) + 75) / SR) * np.exp(-d * 22), at, 1.0)
쓰기('hops.wav', 통, 0.55)

# 시무룩 — 내려가는 두 음(「뚜… 우」)
t = 판(1.3)
시무룩 = np.zeros(len(t))
for at, f in [(0.0, 392), (0.5, 311)]:
    d = 판(0.75)
    얹기(시무룩, sum(np.sin(2 * np.pi * np.cumsum(f * h * (1 - 0.05 * d / 0.75)) / SR) / h for h in (1, 2, 3)) * np.sin(np.pi * d / 0.75) ** 0.7 * (1 + 0.08 * np.sin(2 * np.pi * 5.5 * d)), at, 1.0)
쓰기('sad.wav', 저역(시무룩, 1800), 0.5)

# 맑은 종 — 바른 말이 뜰 때
t = 판(1.1)
쓰기('ding.wav', sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 1318), (0.5, 1976), (0.25, 2637)]) * np.exp(-t * 4.5), 0.5)

# 음악 — 보유곡 「시티팝_147」 30초부터 33초(빈 마디 없는 27~104초 안)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '30', '-t', '33', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
