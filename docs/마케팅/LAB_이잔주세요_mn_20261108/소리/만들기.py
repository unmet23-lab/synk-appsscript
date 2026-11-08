# LAB 몽골 M33 소리 — 카페 바탕 · 뽁 · 갸웃 · 번쩍(휙 + 반짝 화음) · 종이컵 툭툭 · 뚜껑 퐁 · 얼어붙음 · 분필 톡 · 도장 · 딩 · 반짝을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 밝은_052를 0초부터 29초까지(곡 안 빈 마디 29~30초 앞 — 11-08 BGM README 「곡 안 빈 마디」, 16초부터면 영상 13~14초가 빈다) 영상보다 길게 자른다(지난 두 몽골 편 M31 시티팝_147 · M26 따뜻_118과 다른 곡).
# 사용: python -X utf8 docs/마케팅/LAB_이잔주세요_mn_20261108/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1112)
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
def 오름(t, d):
    return np.minimum(1, t / d)

# 카페 바탕 — 멀리 웅성임 + 가끔 잔 부딪는 소리(말 사이가 완전히 비지 않게)
길이 = 32
t = 판(길이)
웅 = 띠(rng.standard_normal(len(t)), 180, 900) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.23 * t) * np.sin(2 * np.pi * 0.37 * t + 1))
쉬 = 띠(rng.standard_normal(len(t)), 2000, 9000) * 0.12
바탕 = 웅 + 쉬
for at in [1.7, 6.9, 11.2, 15.8, 19.4, 24.6, 29.1]:
    i = int(at * SR)
    tt = 판(0.5)
    딸 = (np.sin(2 * np.pi * 2900 * tt) + 0.6 * np.sin(2 * np.pi * 4150 * tt)) * np.exp(-tt * 18) * 0.09
    바탕[i:i + len(tt)] += 딸
쓰기('cafe.wav', np.stack([바탕, np.roll(바탕, 1200)], axis=1), 0.35)

# 펠트 뽁(말풍선) · 톡(글줄)
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)
t = 판(0.4)
쓰기('pom.wav', np.sin(2 * np.pi * 230 * t) * np.exp(-t * 16) + (np.sin(2 * np.pi * 1320 * t) + 0.4 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 11) * 0.3, 0.7)

# 갸웃 — 짧게 올라가는 「응?」 피리
t = 판(0.32)
f = 520 + 380 * (t / 0.32) ** 1.6
쓰기('huh.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.32) ** 1.2, 0.4)

# 번쩍 — 휙 올라가는 바람 + 밝은 화음(짜잔)
t = 판(1.1)
휙 = 띠(rng.standard_normal(len(t)), 600, 6500) * np.exp(-((t - 0.16) ** 2) / 0.006)
화음 = sum(np.sin(2 * np.pi * f * t) * np.exp(-np.maximum(0, t - 0.14) * 3.2) * (t > 0.14) for f in [523.3, 659.3, 784.0, 1046.5])
반 = sum(np.sin(2 * np.pi * f * t) * np.exp(-np.maximum(0, t - 0.2 - i * 0.05) * 9) * (t > 0.2 + i * 0.05) for i, f in enumerate([2093, 2637, 3136]))
쓰기('tada.wav', 휙 * 0.8 + 화음 * 0.45 + 반 * 0.25, 0.8)

# 종이컵 툭 — 펠트 컵이 나무 계산대에 떨어진다(낮은 쿵 + 짧은 나무 톡)
t = 판(0.35)
쿵 = np.sin(2 * np.pi * np.cumsum(190 * np.exp(-t * 9) + 90) / SR) * np.exp(-t * 22)
톡 = 띠(rng.standard_normal(len(t)), 900, 3800) * np.exp(-t * 60)
쓰기('cup.wav', 쿵 * 0.9 + 톡 * 0.5, 0.75)
# 뚜껑 퐁
t = 판(0.22)
쓰기('lid.wav', np.sin(2 * np.pi * (780 + 900 * t) * t) * np.exp(-t * 26), 0.45)

# 얼어붙음 — 내려가는 반짝 + 서리 바스락
t = 판(1.3)
내 = sum(np.sin(2 * np.pi * f * t) * np.exp(-np.maximum(0, t - i * 0.09) * 5) * (t > i * 0.09) for i, f in enumerate([2637, 2349, 1976, 1568, 1319]))
서리 = 띠(rng.standard_normal(len(t)), 3000, 11000) * np.exp(-t * 2.6) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 37 * t)))
쓰기('freeze.wav', 내 * 0.5 + 서리 * 0.25, 0.6)

# 분필 톡(메뉴판 줄이 붙을 때)
t = 판(0.2)
쓰기('chalk.wav', 띠(rng.standard_normal(len(t)), 1200, 5200) * np.exp(-t * 40) + np.sin(2 * np.pi * 330 * t) * np.exp(-t * 30) * 0.5, 0.5)

# 도장 쾅(✗) — 낮고 둔하게
t = 판(0.45)
쓰기('stamp.wav', np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 6) + 60) / SR) * np.exp(-t * 11) + 띠(rng.standard_normal(len(t)), 200, 1600) * np.exp(-t * 30) * 0.6, 0.8)

# 딩(✓) — 맑은 두 음
t = 판(0.9)
쓰기('ding.wav', (np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 4) + np.sin(2 * np.pi * 1975.5 * t) * np.exp(-np.maximum(0, t - 0.11) * 4) * (t > 0.11)) * 0.6, 0.55)

# 반짝 — 기쁨
t = 판(0.9)
x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (6 + i)) * np.minimum(1, np.maximum(0, t - i * 0.07) / 0.002) for i, f in enumerate([1568, 1976, 2349, 3136, 3951]))
쓰기('sparkle.wav', x, 0.45)

# 음악 — 보유곡 밝은_052, 0초부터 29초(11-08: 16초부터 31초는 원곡 29~30초 빈 마디가 영상 13~14초에 들어 음악이 1초 꺼졌다 — 음악층 ⑲)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '밝은_052.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '밝은_052.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '0', '-t', '29', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
