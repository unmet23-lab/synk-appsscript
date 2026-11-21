# LAB 몽골 M69 「써요」 소리 — 동전이 쏟아지는 짤랑 · 빈 지갑에서 나방이 나는 파닥 · 쓴맛에 몸이 쪼그라드는 뿌직을 직접 만든다(남의 음원 없음).
# 톡 · 뿅 · 휙 · 반짝 · 후루룩 · 꿀꺽 · 펑 · 떨림 · 방 소리 같은 나머지는 M53 「먹어요」(같은 틀 ②)가 쓴 것을 그대로 가져왔다.
# 음악은 보유곡 「밝은_052」(M53 「05_Toddler-Kids」와 다른 곡) — 시작 초는 음악층 검사로 빈 마디를 피해 고른다.
# 만들기: python -I -X utf8 docs/마케팅/LAB_써요_mn_20261121/소리/만들기.py
import os, shutil, subprocess
import numpy as np
from scipy.io import wavfile

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
공개 = os.path.join(여기, '..', 'remotion', 'public')
밖 = os.path.join(공개, 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(69)
TOTAL = 25  # 편 길이(23초)보다 넉넉히 — 22초로 잘랐더니 21~22.25초에 음악이 꺼졌다(올리기 전 검사 v3)
곡시작 = 6.0

def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))

def 판(sec):
    return np.arange(int(sec * SR)) / SR

# 가져오기 — M53 「먹어요」 sfx
옛 = os.path.join(여기, '..', '..', 'LAB_먹어요_mn_20261115', 'remotion', 'public', 'sfx')
for f in ['tok.wav', 'pop.wav', 'boing.wav', 'whoosh_down.wav', 'whoosh_up.wav', 'sparkle.wav', 'sip.wav', 'gulp.wav', 'puff.wav', 'shiver.wav', 'sad.wav', 'tada.wav', 'wrong.wav', 'boom.wav', 'thud.wav', 'room.wav', 'ding.wav']:
    shutil.copyfile(os.path.join(옛, f), os.path.join(밖, f))

# 짤랑 — 동전 열두 닢이 차례로 쟁반에 떨어진다(높은 금속 배음 셋이 빨리 사그라짐), 1.4초
def 짤랑():
    t = 판(1.4)
    x = np.zeros_like(t)
    for k in range(12):
        at = 0.02 + k * 0.09 + rng.uniform(-0.02, 0.02)
        f0 = rng.uniform(2600, 4200)
        s = (t >= at)
        tt = np.where(s, t - at, 0)
        env = np.where(s, np.exp(-tt * rng.uniform(22, 34)), 0)
        tone = np.sin(2 * np.pi * f0 * tt) + 0.6 * np.sin(2 * np.pi * f0 * 2.76 * tt) + 0.35 * np.sin(2 * np.pi * f0 * 5.4 * tt)
        x += tone * env * rng.uniform(0.6, 1.0)
    쓰기('coins.wav', x, 0.7)

# 파닥 — 빈 지갑에서 작은 나방이 날아오르는 날갯짓(짧은 잡음 톡톡 여덟 번), 0.7초
def 파닥():
    t = 판(0.7)
    x = np.zeros_like(t)
    n = rng.normal(0, 1, len(t))
    for k in range(8):
        at = 0.03 + k * 0.075
        s = (t >= at) & (t < at + 0.03)
        x += np.where(s, n * np.exp(-(t - at) * 120), 0)
    쓰기('flutter.wav', x * np.linspace(1, 0.4, len(t)), 0.45)

# 뿌직 — 쓴맛에 몸이 쪼그라드는 소리(내려가는 짧은 음 + 펠트 비비는 잡음), 0.6초
def 뿌직():
    t = 판(0.6)
    f = np.linspace(700, 180, len(t))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    n = rng.normal(0, 1, len(t)) * 0.4
    env = np.exp(-t * 5)
    쓰기('scrunch.wav', (tone + n) * env, 0.6)

짤랑(); 파닥(); 뿌직()

# 배경음 — 보유곡 「밝은_052」 곡시작초부터 TOTAL초
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '밝은_052.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(곡시작), '-t', str(TOTAL), '-i', 곡, '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('소리 →', 밖)
