# LAB 영어 E34 소리 — 아침 동네 카페(낮은 방 소리 · 가끔 에스프레소 김 · 잔 부딪힘) · 픽업 종 「띵」 · 의자 끌림 · 컵 줄다리기 펠트 「끼익」 ·
# 몽글이 눌리는 「뿌잉」 · 굳는 「칭」 · 뽁 · 휙을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「시티팝_147」의 빈 마디 없는 구간(27~104초)에서 영상보다 길게 자른다(지난 두 편 E31 밝은_052 · E32 키즈파티와 다른 곡).
# 만들기: python -I -X utf8 docs/마케팅/LAB_리나둘_20261110/소리/만들기.py
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1110)


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


def 고역(x, lo, order=2):
    return sosfilt(butter(order, lo, 'hp', fs=SR, output='sos'), x)


def 얹기(버퍼, x, at, 세기=1.0):
    j = int(at * SR)
    if j >= len(버퍼):
        return
    n = min(len(x), len(버퍼) - j)
    버퍼[j:j + n] += x[:n] * 세기


# 카페 방 소리 — 낮은 웅웅 + 먼 수다 같은 띠 소음 + 가끔 잔 부딪힘 · 에스프레소 김(영상보다 길게 30초)
길이 = 30
t = 판(길이)
방 = 저역(rng.standard_normal(len(t)), 260) * 0.9 + 띠(rng.standard_normal(len(t)), 300, 1800) * 0.18 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t) ** 2)
잔 = np.zeros(len(t))
for at in [1.6, 6.3, 9.4, 12.9, 18.2, 23.5, 27.1]:
    d = 판(0.5)
    f = 2400 + rng.random() * 700
    얹기(잔, sum(w * np.sin(2 * np.pi * f * k * d) for w, k in [(1, 1), (0.5, 2.7), (0.25, 5.1)]) * np.exp(-d * 18), at, 0.07)
김 = np.zeros(len(t))
for at in [4.2, 15.5, 25.0]:
    d = 판(1.6)
    얹기(김, 고역(rng.standard_normal(len(d)), 2500) * np.sin(np.pi * d / 1.6) ** 2, at, 0.05)
공 = 방 + 잔 + 김
쓰기('cafe.wav', np.stack([공, np.roll(공, 700)], axis=1), 0.5)

# 픽업 종 「띵」 — 맑은 종 한 번
t = 판(1.2)
쓰기('bell.wav', sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 1760), (0.45, 2637), (0.25, 3520), (0.12, 5274)]) * np.exp(-t * 4.2), 0.55)

# 의자 끌림 — 나무 의자가 바닥을 긁으며 일어선다(짧은 마찰 둘)
t = 판(0.45)
끌 = 띠(rng.standard_normal(len(t)), 250, 2200) * (np.sin(np.pi * t / 0.45) ** 1.5) * (1 + 0.6 * np.sin(2 * np.pi * 34 * t))
쓰기('chair.wav', 끌, 0.5)

# 끼익 — 펠트 컵을 양쪽에서 당길 때(마찰 + 떨리는 음)
t = 판(0.42)
f = 380 + 120 * np.sin(2 * np.pi * 7 * t)
끼 = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.42) ** 2 * 0.5 + 띠(rng.standard_normal(len(t)), 900, 4000) * np.sin(np.pi * t / 0.42) ** 2 * 0.35
쓰기('tug.wav', 끼, 0.5)

# 뿌잉 — 몽글이 둘 사이에 끼어 눌린다(올라갔다 내려가는 짧은 음)
t = 판(0.38)
f = 700 + 900 * np.sin(np.pi * t / 0.38)
쓰기('squish.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.38) ** 1.2 * (1 + 0.25 * np.sin(2 * np.pi * 22 * t)), 0.5)

# 굳는 소리 — 유리 얼음 「칭」 + 짧은 내림
t = 판(0.9)
칭 = sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 2093), (0.6, 3136), (0.35, 4186)]) * np.exp(-t * 6)
내림 = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 3) + 160) / SR) * np.exp(-t * 4.5) * 0.35
쓰기('freeze.wav', 칭 * 0.7 + 내림, 0.6)

# 뽁 — 말풍선 · 표가 나타날 때
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 착 — 영수증 띠가 붙을 때(종이 한 번)
t = 판(0.25)
쓰기('paper.wav', 띠(rng.standard_normal(len(t)), 1800, 9000) * np.exp(-t * 28), 0.5)

# 휙 — 장면이 넘어갈 때
t = 판(0.4)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.4) ** 2, 0.6)

# 쿵 — 사자가 벌떡 일어설 때(낮은 둥)
t = 판(0.5)
쓰기('thump.wav', np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t * 4) + 50) / SR) * np.exp(-t * 7) + 띠(rng.standard_normal(len(t)), 80, 600) * np.exp(-t * 20) * 0.5, 0.75)

# 꿀꺽 — 사자가 컵을 통째로 삼킨다(볼 이유 심사 v2 「끝 줄다리기가 예상대로」 → 새 끝): 물 흐르는 「꾸르륵」 + 낮은 「꿀꺽」 + 작은 트림 같은 퐁
t = 판(0.9)
꿀 = np.zeros(len(t))
for i, at in enumerate([0.0, 0.11, 0.2]):
    d = 판(0.12)
    얹기(꿀, np.sin(2 * np.pi * np.cumsum(420 - 1800 * d + 60 * i) / SR) * np.sin(np.pi * d / 0.12) ** 2, at, 0.6)
d = 판(0.35)
얹기(꿀, np.sin(2 * np.pi * np.cumsum(170 * np.exp(-d * 5) + 70) / SR) * np.exp(-d * 9), 0.32, 1.0)
d = 판(0.14)
얹기(꿀, np.sin(2 * np.pi * (300 + 500 * d) * d) * np.exp(-d * 30), 0.7, 0.5)
쓰기('gulp.wav', 꿀, 0.75)

# 바람 빠짐 — 몽글만 컵이 없어 축 처진다(내려가는 피리 + 숨)
t = 판(1.0)
f = 520 * np.exp(-t * 1.6) + 120
쓰기('deflate.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - t / 1.0) ** 1.3 * 0.6 + 띠(rng.standard_normal(len(t)), 600, 3200) * (1 - t / 1.0) * 0.25, 0.5)

# 음악 — 보유곡 「시티팝_147」 27.5초부터(빈 마디 없는 27~104초 안), 영상보다 길게 30초
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '27.5', '-t', '30', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
