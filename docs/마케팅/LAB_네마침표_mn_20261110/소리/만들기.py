# LAB 몽골 M40 소리 — 저녁 방 소리 · 자판 톡 · 보냄 슉 · 마침표가 부푸는 올림음 · 떨어지는 휘파람 · 쿵 · 얼음 칭 · 메시지 띵 · 뽁 · 반짝 · 납작 뿌잉을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡 「시티팝_147」의 빈 마디 없는 구간(27~104초) 40초부터 영상보다 길게(지난 두 몽골 편 M37 Joyful · M32 Toddler-Kids와 다른 곡).
# 공 오리기도 여기서: 흰 바탕에 구운 판/ball_*.png → tools/펠트_흰바탕오리기.py → public/img/ball.png
# 만들기: python -I -X utf8 docs/마케팅/LAB_네마침표_mn_20261110/소리/만들기.py
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


def 얹기(버퍼, x, at, 세기=1.0):
    j = int(at * SR)
    if j >= len(버퍼):
        return
    n = min(len(x), len(버퍼) - j)
    버퍼[j:j + n] += x[:n] * 세기


# 방 소리 — 낮은 웅웅 + 아주 옅은 바깥 바람(영상보다 길게 24초)
길이 = 24
t = 판(길이)
방 = 저역(rng.standard_normal(len(t)), 220) * 0.9 + 띠(rng.standard_normal(len(t)), 250, 1200) * 0.08 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.09 * t) ** 2)
쓰기('room.wav', np.stack([방, np.roll(방, 600)], axis=1), 0.45)

# 자판 톡
t = 판(0.06)
쓰기('tap.wav', 띠(rng.standard_normal(len(t)), 1800, 7000) * np.exp(-t * 120), 0.5)

# 보냄 슉 — 위로 올라가는 짧은 바람
t = 판(0.32)
쓰기('send.wav', 띠(rng.standard_normal(len(t)), 900, 6000) * np.sin(np.pi * t / 0.32) ** 2 + np.sin(2 * np.pi * np.cumsum(600 + 1800 * t) / SR) * np.exp(-t * 10) * 0.3, 0.5)

# 부푼다 — 올라가는 떨림음(마침표가 커진다)
t = 판(0.9)
f = 180 + 520 * (t / 0.9) ** 2
쓰기('grow.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.3 + 0.7 * t / 0.9) * (1 + 0.35 * np.sin(2 * np.pi * 14 * t)), 0.5)

# 떨어진다 — 내려가는 휘파람
t = 판(0.8)
f = 1500 * np.exp(-t * 1.8) + 300
쓰기('fall.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.8) ** 0.6, 0.45)

# 쿵 — 무거운 털공이 떨어진다(낮은 둥 + 털 뭉치 퍽)
t = 판(0.7)
쓰기('thump.wav', np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t * 5) + 42) / SR) * np.exp(-t * 6) + 띠(rng.standard_normal(len(t)), 60, 900) * np.exp(-t * 16) * 0.7, 0.85)

# 굳는 소리 — 유리 얼음 「칭」
t = 판(0.9)
쓰기('freeze.wav', sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 2093), (0.6, 3136), (0.35, 4186)]) * np.exp(-t * 6), 0.55)

# 메시지 띵
t = 판(0.6)
쓰기('ding.wav', (np.sin(2 * np.pi * 1318 * t) * np.exp(-t * 9) + np.sin(2 * np.pi * 1760 * np.clip(t - 0.09, 0, None)) * np.exp(-np.clip(t - 0.09, 0, None) * 9) * (t > 0.09)), 0.5)

# 뽁
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)

# 반짝
t = 판(0.9)
반 = np.zeros(len(t))
for i, f in enumerate([1568, 2093, 2637]):
    d = 판(0.6)
    얹기(반, np.sin(2 * np.pi * f * d) * np.exp(-d * 7), i * 0.08, 0.6)
쓰기('sparkle.wav', 반, 0.5)

# 뿌잉 — 몽글이 공에 깔린다
t = 판(0.42)
f = 900 * np.exp(-t * 3) + 200
쓰기('squish.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.42) ** 1.2 * (1 + 0.25 * np.sin(2 * np.pi * 22 * t)), 0.5)

# 음악
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
if not os.path.exists(원곡):
    원곡 = os.path.join('C:/Users/q1212/Documents/SYNK-appsscript', 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '40', '-t', '24', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)

# 공 오리기
판폴더 = os.path.join(여기, '..', '판')
공 = sorted(f for f in os.listdir(판폴더) if f.startswith('ball_') and f.endswith('.png'))[-1]
공밖 = os.path.join(여기, '..', 'remotion', 'public', 'img', 'ball.png')
subprocess.run(['python', '-I', '-X', 'utf8', os.path.join(뿌리, 'tools', '펠트_흰바탕오리기.py'), os.path.join(판폴더, 공), 공밖], check=True)
# 가장자리 흰 테 지우기(11-10 v8 GPT 미학 맹검 「공 아래 윤곽에 밝은 테두리 · 회색 후광 — 오려 붙인 합성층」):
# 흰 바탕과 섞인 반투명 털을 흰색을 걷어낸 본래 색으로 되돌리고(c = (c − (1 − α)·255) / α), 알파를 3px 깎아(바깥에 뜬 흰 털 부스러기까지) 부드럽게 한다
from PIL import Image, ImageFilter
im = Image.open(공밖).convert('RGBA')
a = np.asarray(im).astype(np.float64)
al = a[..., 3:4] / 255.0
rgb = np.where(al > 0.02, (a[..., :3] - (1 - al) * 255.0) / np.maximum(al, 0.02), 0)
rgb = np.clip(rgb, 0, 255)
알파 = Image.fromarray(a[..., 3].astype(np.uint8)).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(1.0))
out = np.dstack([rgb, np.asarray(알파).astype(np.float64)]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(공밖)
print('소리 · 공 끝')
