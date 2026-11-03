# LAB 영어 E20 효과음 — 나무 블록 · 시소 소리는 직접 만든다(남의 음원 없음). 톡 · 팝 · 휙 · 스팅은 E22에서 나눠 쓰고, 음악은 보유곡 키즈파티에서 영상 길이만큼 자른다.
import os, shutil, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1103)
def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))
def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)
def 나무(f, dur=0.16, vel=1.0):
    t = 판(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 38) + 0.55 * np.sin(2 * np.pi * f * 2.42 * t) * np.exp(-t * 60) + 0.28 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 90)
    n = rng.standard_normal(len(t)) * np.exp(-t * 170) * 0.35
    return vel * (x + n)
# 블록이 탁자에 놓이는 탁 — 낮은 나무 두 겹
탁 = 나무(310, 0.2)
겹 = 나무(520, 0.2, 0.6)
앞 = int(0.012 * SR)
탁[앞:] += 겹[: len(탁) - 앞]
쓰기('clack.wav', 탁)
# 시소를 치는 쿵 — 판자 울림
t = 판(0.32)
쿵 = np.sin(2 * np.pi * 138 * t) * np.exp(-t * 16) + 0.5 * np.sin(2 * np.pi * 276 * t) * np.exp(-t * 24) + 나무(240, 0.32, 0.8)
쓰기('thud.wav', 쿵)
# 튕겨 오르는 스프링 소리 — 올라가며 떨리는 소리
t = 판(0.55)
f = 170 * np.exp(t * 2.1) * (1 + 0.05 * np.sin(2 * np.pi * 16 * t))
위상 = 2 * np.pi * np.cumsum(f) / SR
튕 = (np.sin(위상) + 0.3 * np.sin(2 * 위상)) * np.minimum(1, t / 0.01) * np.exp(-t * 3.4)
쓰기('boing.wav', 튕, 0.7)
# 거북이 발 — 부드러운 펠트 톡
쓰기('pat.wav', sosfilt(butter(4, 900, 'lp', fs=SR, output='sos'), 나무(160, 0.14)))
# 나눠 쓰는 것
옛 = os.path.join(여기, '..', '..', 'LAB_물고기_20261101', 'remotion', 'public', 'sfx')
for 이름 in ['pop.wav', 'whoosh.wav', 'sting.wav', 'tok.wav']:
    shutil.copy(os.path.join(옛, 이름), os.path.join(밖, 이름))
# 음악 — 보유곡에서 앞 판 길이만큼(늘 영상보다 길게)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '퀴즈120_키즈파티_c10ef6f1.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '6', '-i', 곡, '-t', '24', '-c:a', 'pcm_s16le', os.path.join(밖, 'bgm.wav')], check=True)
print('완료')
