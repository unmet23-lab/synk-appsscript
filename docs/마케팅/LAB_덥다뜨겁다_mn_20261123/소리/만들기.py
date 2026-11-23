# LAB 몽골 M48 「더워 · 뜨거워」 소리 — 치맛자락이 뜨거운 계란에 닿는 「치익」을 직접 만든다(남의 음원 없음).
# 톡 · 뿅 · 휙 · 펑 · 떨림 · 쿵 · 방 소리 같은 나머지는 M69 「써요」(같은 틀 ②)가 쓴 것을 그대로 가져왔다.
# 음악은 보유곡 「시티팝_147」 30초부터(곡 안 빈 마디 26.25~27초를 피한 27~104초 구간 — BGM README 「곡 안 빈 마디」).
#   같은 계정 지난 두 편(11-25 「계세요」 퀴즈120_키즈파티 · 「더 먹어」 따뜻_118)과 다른 곡이다.
# 만들기: python -I -X utf8 docs/마케팅/LAB_덥다뜨겁다_mn_20261123/소리/만들기.py
import os, shutil, subprocess
import numpy as np
from scipy.io import wavfile

SR = 48000
여기 = os.path.dirname(os.path.abspath(__file__))
공개 = os.path.join(여기, '..', 'remotion', 'public')
밖 = os.path.join(공개, 'sfx')
os.makedirs(밖, exist_ok=True)
rng = np.random.default_rng(48)
TOTAL = 25  # 편 길이(19.6초)보다 넉넉히
곡시작 = 30.0


def 쓰기(이름, x, peak=0.85):
    x = np.asarray(x, dtype=np.float64)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    wavfile.write(os.path.join(밖, 이름), SR, (x * 32767).astype(np.int16))


def 판(sec):
    return np.arange(int(sec * SR)) / SR


# 가져오기 — M69 「써요」 sfx
옛 = os.path.join(여기, '..', '..', 'LAB_써요_mn_20261121', 'remotion', 'public', 'sfx')
for f in ['tok.wav', 'pop.wav', 'boing.wav', 'whoosh_down.wav', 'whoosh_up.wav', 'puff.wav', 'shiver.wav', 'sad.wav', 'thud.wav', 'room.wav']:
    shutil.copyfile(os.path.join(옛, f), os.path.join(밖, f))


# 치익 — 뜨거운 계란에 펠트가 닿는 소리: 높은 잡음이 확 일었다가 0.7초에 걸쳐 사그라지고, 드문 탁 소리 몇 번, 0.8초
def 치익():
    t = 판(0.8)
    n = rng.normal(0, 1, len(t))
    # 높은 대역만 — 앞뒤 차분 두 번(간단한 고역 통과)
    hp = np.diff(np.diff(n, prepend=0), prepend=0)
    env = np.minimum(t / 0.012, 1) * np.exp(-t * 4.2)
    x = hp * env
    for k in range(5):  # 드문 탁 — 빽빽하지 않게 다섯 번
        at = 0.04 + k * rng.uniform(0.08, 0.15)
        s = (t >= at) & (t < at + 0.006)
        x += np.where(s, rng.uniform(1.5, 2.5) * np.exp(-(t - at) * 600), 0)
    쓰기('sizzle_hit.wav', x, 0.6)


치익()

# 배경음 — 시티팝_147 30초부터 TOTAL초, 끝 1초 페이드
곡 = os.path.join(여기, '..', '..', '..', '홍보물', 'BGM', '시티팝_147.wav')
if not os.path.exists(곡):  # 작업 사본에 미디어가 없으면 공용 작업본에서
    곡 = r'C:\Users\q1212\Documents\SYNK-appsscript\docs\홍보물\BGM\시티팝_147.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(곡시작), '-i', 곡, '-t', str(TOTAL), '-af', f'afade=t=out:st={TOTAL - 1}:d=1', '-ar', str(SR), '-ac', '2', os.path.join(공개, 'bgm.wav')], check=True)
print('소리 끝 →', 밖)
