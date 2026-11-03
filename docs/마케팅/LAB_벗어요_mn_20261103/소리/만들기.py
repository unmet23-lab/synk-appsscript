# LAB 몽골 M27 효과음 — 지퍼 · 와르르 · 한숨은 직접 만든다(남의 음원 없음). 톡 · 팝 · 휙은 E22, 바람은 E24, 틀림은 M19에서 나눠 쓰고, 음악은 보유곡 따뜻_118에서 영상 길이만큼 자른다.
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
# 지퍼 — 빠르게 긁는 소리가 올라간다
t = 판(0.42)
잇 = (np.sin(2 * np.pi * (45 + 90 * t) * t) > 0.6).astype(float)
n = rng.standard_normal(len(t))
지퍼 = sosfilt(butter(4, [1800, 7000], 'bp', fs=SR, output='sos'), n * 잇) * np.minimum(1, t / 0.02) * np.minimum(1, (0.42 - t) / 0.05)
쓰기('zip.wav', 지퍼, 0.6)
# 와르르 — 펠트 상자 넷이 차례로 떨어져 구른다
길이 = 0.9
버퍼 = np.zeros(int(길이 * SR))
for i, at in enumerate([0.0, 0.09, 0.2, 0.33, 0.47, 0.6]):
    d = 판(0.22)
    x = (np.sin(2 * np.pi * (170 - i * 12) * d) + 0.4 * np.sin(2 * np.pi * (420 - i * 20) * d)) * np.exp(-d * 24) + rng.standard_normal(len(d)) * np.exp(-d * 70) * 0.3
    j = int(at * SR)
    버퍼[j:j + len(d)] += x[: len(버퍼) - j] * (1 - i * 0.1)
쓰기('tumble.wav', 버퍼, 0.8)
# 한숨 — 부드럽게 빠지는 숨(말 아님)
t = 판(0.9)
숨 = sosfilt(butter(2, [300, 1600], 'bp', fs=SR, output='sos'), rng.standard_normal(len(t))) * np.sin(np.pi * t / 0.9) ** 1.5
쓰기('sigh.wav', 숨, 0.45)
# 나눠 쓰는 것
for 곳, 이름들 in [('LAB_물고기_20261101', ['pop.wav', 'whoosh.wav', 'tok.wav']), ('LAB_ㅋ하나_20261102', ['wind.wav'])]:
    for 이름 in 이름들:
        shutil.copy(os.path.join(여기, '..', '..', 곳, 'remotion', 'public', 'sfx', 이름), os.path.join(밖, 이름))
틀림 = os.path.join(여기, '..', '..', 'LAB_형오빠_mn_20261030', 'remotion', 'public', 'sfx')
후보 = [f for f in os.listdir(틀림) if any(k in f for k in ('wrong', 'boing', 'buzz', 'oops', 'x', 'ding'))]
shutil.copy(os.path.join(틀림, 후보[0]), os.path.join(밖, 'wrong.wav'))
print('틀림 소리', 후보[0])
# 음악 — 보유곡에서 앞 판 길이만큼(늘 영상보다 길게)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '따뜻_118.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '4', '-i', 곡, '-t', '24', '-c:a', 'pcm_s16le', os.path.join(밖, 'bgm.wav')], check=True)
print('완료')
