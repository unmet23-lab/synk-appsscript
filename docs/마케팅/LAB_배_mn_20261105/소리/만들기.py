# LAB 몽골 M28 소리 — 꼬르륵 · 문 열림 · 반짝임 · 뱃고동 · 물결 · 노 · 삐융(아찔) · 팝을 모두 직접 만든다(남의 음원 없음).
# 음악은 보유곡에서 영상 길이만큼 자른다(지난 두 몽골 편과 다른 곡).
import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1109)
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

# 꼬르륵 — 낮은 음이 꿀렁이며 올라갔다 내려앉는다
t = 판(1.3)
f = 95 + 70 * np.sin(2 * np.pi * 1.2 * t + 1) + 40 * np.sin(2 * np.pi * 7.3 * t) + 60 * (t / 1.3)
꿀 = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 9.5 * t + 2 * np.sin(2 * np.pi * 1.1 * t))))
꿀 = 저역(꿀, 620) * np.sin(np.pi * t / 1.3) ** 0.5
쓰기('growl.wav', 꿀, 0.85)

# 문 열림 — 벌컥(나무 쿵 + 끼익 짧게)
t = 판(0.42)
쿵 = np.sin(2 * np.pi * 120 * t) * np.exp(-t * 26) + 띠(rng.standard_normal(len(t)), 300, 2200) * np.exp(-t * 46) * 0.6
쓰기('door.wav', 쿵, 0.7)

# 반짝임 — 마법의 낱말
t = 판(0.9)
x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (6 + i)) * (i < 5) * np.minimum(1, np.maximum(0, t - i * 0.07) / 0.002) for i, f in enumerate([1568, 1976, 2349, 3136, 3951]))
쓰기('sparkle.wav', x, 0.45)

# 뱃고동 — 낮게 길게 두 음이 겹친다
t = 판(1.9)
뱃 = sum(w * np.sin(2 * np.pi * f * t) for w, f in [(1, 98), (0.7, 147), (0.45, 196), (0.25, 294), (0.14, 392)])
뱃 = 저역(뱃, 1500) * np.minimum(1, t / 0.09) * np.minimum(1, (1.9 - t) / 0.35)
쓰기('horn.wav', 뱃, 0.85)

# 물결 — 보트 옆 찰랑임(길게)
길이 = 12
t = 판(길이)
물 = 띠(rng.standard_normal(len(t)), 350, 2600) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.42 * t)) ** 2
쓰기('water.wav', np.stack([물, np.roll(물, 900)], axis=1), 0.5)

# 노 — 삐걱 + 첨벙
t = 판(0.7)
삐 = np.sin(2 * np.pi * np.cumsum(420 + 260 * t / 0.7) / SR) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 24 * t))) * np.sin(np.pi * t / 0.7) ** 2
벙 = 띠(rng.standard_normal(len(t)), 500, 3400) * np.exp(-((t - 0.45) ** 2) / 0.012)
쓰기('oar.wav', 띠(삐, 300, 2400) * 0.35 + 벙 * 0.7, 0.55)

# 아찔 — 삐융 내려가며 흔들린다(속이 안 좋다)
t = 판(1.1)
f = 760 * np.exp(-t * 1.5) + 42 * np.sin(2 * np.pi * 6.5 * t)
쓰기('dizzy.wav', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.2), 0.42)

# 펠트 뽁 · 툭(꼬리표가 붙을 때)
t = 판(0.18)
쓰기('pop.wav', np.sin(2 * np.pi * (520 - 900 * t) * t) * np.exp(-t * 24), 0.55)
t = 판(0.4)
쓰기('pom.wav', np.sin(2 * np.pi * 230 * t) * np.exp(-t * 16) + (np.sin(2 * np.pi * 1320 * t) + 0.4 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 11) * 0.3, 0.7)

# 휙 — 배가 날아간다
t = 판(0.45)
쓰기('whoosh.wav', 띠(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * t / 0.45) ** 2, 0.7)

# 풍덩 — 큰 배가 물에 떨어진다
t = 판(1.3)
풍 = np.sin(2 * np.pi * np.cumsum(150 * np.exp(-t * 5) + 70) / SR) * np.exp(-t * 7)
물튐 = 띠(rng.standard_normal(len(t)), 700, 6500) * (np.exp(-t * 3.4) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t)))
쓰기('splash.wav', 풍 * 0.8 + 물튐 * 0.7, 0.85)

# 방 소리 — 말 사이가 완전히 비지 않게
길이 = 20
t = 판(길이)
쓰기('room.wav', 저역(rng.standard_normal(len(t)), 1800) + 띠(rng.standard_normal(len(t)), 900, 12000) * 0.25, 0.3)

# 음악 — 보유곡 01_Joyful, 밝게 시작하는 자리부터 영상보다 길게
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))
원곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '01_Joyful-Happy-Upbeat_alex-morgan.mp3')
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '8', '-t', '22', '-i', 원곡, '-ar', str(SR), '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('소리 끝')
