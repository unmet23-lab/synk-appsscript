# LAB 몽골 M22 「-지 마」 음악을 직접 만든다(남의 음원 없음). 낮 = 튕기는 현 잔소리 박자, 저녁 = 혼자 치는 피아노. 48kHz 스테레오 16비트.
import os, shutil
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1101)
def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))
def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)
def 놓기(buf, x, at):
    i = int(at * SR); j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]
def 튕김(f, dur=0.6, vel=0.5):
    # Karplus-Strong 현
    n = int(SR / f); y = np.zeros(int(dur * SR)); b = rng.uniform(-1, 1, n)
    for i in range(len(y)):
        y[i] = b[i % n]
        b[i % n] = 0.5 * (b[i % n] + b[(i + 1) % n]) * 0.994
    return vel * y * np.minimum(1, (dur - 판(dur)) / 0.05)
def 건반(f, dur, vel=0.5):
    t = 판(dur)
    env = np.exp(-t * 1.5) * (1 - np.exp(-t * 400))
    x = np.sin(2 * np.pi * f * t) + 0.42 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 2.2) + 0.2 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 4) + 0.08 * np.sin(2 * np.pi * 4.02 * f * t) * np.exp(-t * 6)
    return vel * x * env
def 잔향(x, 길이=1.2, 양=0.12):
    r = rng.standard_normal(int(길이 * SR)) * np.exp(-판(길이) * 4.2)
    return x + fftconvolve(x, r)[: len(x)] * 양 * 0.06
NOTE = {'C3':130.81,'D3':146.83,'E3':164.81,'F3':174.61,'G3':196.0,'A3':220.0,'B3':246.94,'C4':261.63,'D4':293.66,'E4':329.63,'F4':349.23,'G4':392.0,'A4':440.0,'B4':493.88,'C5':523.25,'D5':587.33,'E5':659.25,'G5':783.99}
# 낮 — 통통 튀는 잔소리 박자(110BPM 현)
b = 60 / 112
buf = np.zeros(int(10.4 * SR))
패턴 = ['C4','E4','G4','E4','F4','A4','C5','A4','G3','B3','D4','G4','C4','E4','G4','C5']
for k in range(int(9.7 / (b / 2))):
    놓기(buf, 튕김(NOTE[패턴[k % 16]], 0.5, 0.42 if k % 2 == 0 else 0.3), k * b / 2)
    if k % 4 == 0:
        놓기(buf, 튕김(NOTE[['C3','F3','G3','C3'][(k // 8) % 4]], 0.8, 0.5), k * b / 2)
쓰기('bgm_day.wav', 잔향(buf, 0.5, 0.2), 0.8)
# 저녁 — 느린 피아노
b = 60 / 64
buf = np.zeros(int(14.5 * SR))
마디 = [(['A3','C4','E4'],'A4'),(['F3','C4','F4'],'C5'),(['C3','G3','E4'],'G4'),(['G3','B3','D4'],'D5'),(['A3','C4','E4'],'E5'),(['F3','C4','A4'],'C5'),(['C3','G3','E4','C5'],'E5')]
at = 0.0
for i, (화, 위) in enumerate(마디):
    for j, n in enumerate(화):
        놓기(buf, 건반(NOTE[n], 3.0, 0.3), at + j * b / 2)
    놓기(buf, 건반(NOTE[위], 3.2, 0.34), at + (1.5 if i % 2 else 2.0) * b)
    at += 2.2
쓰기('bgm_dusk.wav', 잔향(buf, 1.6, 0.5), 0.8)
# 코를 훌쩍 — 몽글 소리(짧게 위로)
t = 판(0.28)
훌쩍 = sosfilt(butter(4, [900, 4200], btype='band', fs=SR, output='sos'), rng.standard_normal(len(t))) * np.sin(np.pi * t / 0.28) ** 2
쓰기('sniff.wav', 훌쩍, 0.6)
for f in ('pop.wav', 'tok.wav', 'bell.wav'):
    shutil.copy(os.path.join(여기, '..', '..', 'LAB_잠도와요_20261030', 'remotion', 'public', 'sfx', f), 밖)
print('완료')
