# LAB 영어 E42 「세트 주세요」 소리 — 가게 방 소리 · 말풍선 「톡」 · 쟁반이 미끄러져 오는 「쓱」 · 음식이 놓이는 「톡」 · 계산대 종 「띵」 ·
# 우쭐 「반짝」 · 갸웃 「뿅?」 · 버거 탑이 내려앉는 「쾅」 · 깨 부스러기 「톡톡」 · 놀람 「뿅!」 · 끝의 힘 빠지는 「뿌우」를 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「밝은_052」 31초부터(빈 마디 29~30초 · 50.5초~ 밖 · 지난 두 영어 편 E40 「시티팝_147」 · E44 「따뜻_118」과 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_세트주세요_20261117/소리/만들기.py
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
rng = np.random.default_rng(1117)
TOTAL = 16.4


def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)


def 띠(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def 저역(x, hi, order=2):
    return sosfilt(butter(order, hi, btype='low', fs=SR, output='sos'), x)


def 얹기(버퍼, x, at, 세기=1.0):
    i = int(at * SR)
    n = min(len(x), len(버퍼) - i)
    버퍼[i:i + n] += x[:n] * 세기


# 가게 방 소리 — 낮은 공기 웅 + 멀리 튀김기 지글(아주 작게), 영상 끝까지
t = 판(TOTAL + 0.3)
방 = 저역(rng.standard_normal(len(t)), 260) * 0.6 + 띠(rng.standard_normal(len(t)), 2500, 7000) * 0.05 * (1 + 0.5 * np.sin(2 * np.pi * 0.37 * t))
쓰기('room.wav', np.stack([방, np.roll(방, 2200)], axis=1), 0.3)

# 말풍선 톡
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * np.cumsum(600 + 900 * np.exp(-t * 30)) / SR) * np.exp(-t * 28), 0.5)

# 쟁반 쓱(미끄러져 옴)
t = 판(0.45)
쓰기('slide.wav', 띠(rng.standard_normal(len(t)), 900, 4200) * np.sin(np.pi * t / 0.45) ** 1.5, 0.4)

# 음식 톡(펠트라 부드럽게)
t = 판(0.25)
톡 = np.sin(2 * np.pi * np.cumsum(180 + 120 * np.exp(-t * 40)) / SR) * np.exp(-t * 22) + 띠(rng.standard_normal(len(t)), 300, 1800) * np.exp(-t * 60) * 0.6
쓰기('plop.wav', 톡, 0.6)

# 계산대 종 띵
t = 판(1.2)
띵 = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(1760, 1.0, 3.2), (2640, 0.45, 4.5), (4420, 0.22, 6.0), (880, 0.2, 2.5)])
쓰기('ding.wav', 띵, 0.45)

# 우쭐 반짝(오르는 맑은 음 셋)
t = 판(0.6)
반짝 = np.zeros(len(t))
for k, f in enumerate([1568, 1976, 2637]):
    s = int(k * 0.11 * SR)
    tt = t[: len(t) - s]
    반짝[s:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9)
쓰기('sparkle.wav', 반짝, 0.4)

# 갸웃 뿅?(올라가는 물음)
t = 판(0.35)
쓰기('huh.wav', np.sin(2 * np.pi * np.cumsum(420 + 520 * (t / 0.35) ** 1.6) / SR) * np.sin(np.pi * t / 0.35) ** 0.8, 0.45)

# 버거 탑 쾅 — 낮은 쿵 + 펠트 퍽 + 계산대 덜컹
t = 판(0.9)
쾅 = np.sin(2 * np.pi * np.cumsum(95 * np.exp(-t * 6) + 42) / SR) * np.exp(-t * 6.5) * 1.2
쾅 += 저역(rng.standard_normal(len(t)), 900) * np.exp(-t * 18) * 0.9
덜컹 = np.zeros(len(t))
for at in (0.05, 0.13, 0.2):
    얹기(덜컹, 띠(rng.standard_normal(int(0.06 * SR)), 1200, 5000) * np.exp(-판(0.06) * 60), at, 0.35)
쓰기('slam.wav', 쾅 + 덜컹, 0.9)

# 깨 부스러기 톡톡
t = 판(0.7)
부 = np.zeros(len(t))
for k in range(9):
    얹기(부, np.sin(2 * np.pi * (2400 + 300 * k) * 판(0.03)) * np.exp(-판(0.03) * 120), 0.05 + k * 0.07 + rng.uniform(0, 0.03), 0.6 - k * 0.05)
쓰기('crumbs.wav', 부, 0.35)

# 놀람 뿅!(위로 튀는 짧은 음)
t = 판(0.3)
쓰기('boing.wav', np.sin(2 * np.pi * np.cumsum(300 + 900 * np.clip(t / 0.08, 0, 1)) / SR) * np.exp(-t * 9) * (1 + 0.35 * np.sin(2 * np.pi * 24 * t)), 0.5)

# 휙(카메라가 넓게 빠질 때)
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5000) * np.sin(np.pi * t / 0.4) ** 2, 0.4)

# 끝 뿌우(힘 빠지는 내려가는 음 둘)
t = 판(1.1)
뿌 = np.zeros(len(t))
for k, (f0, f1) in enumerate([(392, 370), (349, 311)]):
    s = int(k * 0.45 * SR)
    tt = t[: len(t) - s]
    f = np.interp(tt, [0, 0.5], [f0, f1])
    뿌[s:] += (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * np.interp(tt, [0, 0.04, 0.45, 0.6], [0, 1, 0.7, 0]) * (1 + 0.2 * np.sin(2 * np.pi * 6 * tt))
쓰기('womp.wav', 저역(뿌, 2500), 0.4)

곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '밝은_052.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '31', '-t', f'{TOTAL + 0.3:.2f}', '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('ok')
