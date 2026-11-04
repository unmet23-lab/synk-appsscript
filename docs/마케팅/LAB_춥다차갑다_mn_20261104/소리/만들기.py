# LAB 몽골 M29 효과음 — 빨대 · 얼음 달그락은 직접 만든다(남의 음원 없음). 얼어붙음 · 금 · 바람은 E24, 띠옹 · 종 · 반짝은 M19, 톡 · 팝 · 휙은 E22에서 나눠 쓰고, 음악은 보유곡 밝은_052에서 영상 길이만큼 자른다.
import os, shutil, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(1104)
def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) or 1) * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))
def 판(sec):
    return np.linspace(0, sec, int(sec * SR), endpoint=False)
# 빨대 — 짧게 쭉 빠는 소리
t = 판(0.5)
빨대 = sosfilt(butter(2, [500, 2400], 'bp', fs=SR, output='sos'), rng.standard_normal(len(t))) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t)) * np.minimum(1, t / 0.05) * np.minimum(1, (0.5 - t) / 0.08)
쓰기('sip.wav', 빨대, 0.5)
# 얼음 달그락 — 플라스틱 컵 안에서 얼음이 부딪는다
길이 = 0.5
버퍼 = np.zeros(int(길이 * SR))
for at, f in [(0.0, 2600), (0.09, 3300), (0.2, 2200), (0.31, 3000)]:
    d = 판(0.09)
    x = (np.sin(2 * np.pi * f * d) + 0.5 * np.sin(2 * np.pi * f * 1.51 * d)) * np.exp(-d * 70)
    j = int(at * SR)
    버퍼[j:j + len(d)] += x[: len(버퍼) - j]
쓰기('ice.wav', 버퍼, 0.6)
# 나눠 쓰는 것
for 곳, 이름들 in [('LAB_물고기_20261101', ['whoosh.wav']), ('LAB_ㅋ하나_20261102', ['wind.wav', 'crack.wav', 'freeze.wav', 'pop.wav', 'tok.wav']), ('LAB_형오빠_mn_20261030', ['boing.wav', 'bell.wav', 'sparkle.wav'])]:
    for 이름 in 이름들:
        shutil.copy(os.path.join(여기, '..', '..', 곳, 'remotion', 'public', 'sfx', 이름), os.path.join(밖, 이름))
# 음악 — 보유곡에서 영상보다 길게(공용 작업본의 원곡을 읽는다)
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '밝은_052.wav')
if not os.path.exists(곡):
    곡 = 'C:/Users/q1212/Documents/SYNK-appsscript/docs/홍보물/BGM/밝은_052.wav'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '16', '-i', 곡, '-t', '24', '-c:a', 'pcm_s16le', os.path.join(밖, 'bgm.wav')], check=True)
print('완료')
