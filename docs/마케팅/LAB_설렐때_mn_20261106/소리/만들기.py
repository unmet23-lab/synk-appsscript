# LAB 몽골 M31 「설렐 때 네 마디」 효과음 — 남의 소리를 쓰지 않고 직접 합성한다(11-06, M1 remotion/소리.py의 방법).
#   python -I -X utf8 소리/만들기.py  →  remotion/public/sfx/*.wav
#   배경음은 보유곡 docs/홍보물/BGM/시티팝_147.wav의 앞부분을 영상 길이만큼 잘라 bgm.wav로(지난 두 몽골 편 M29 밝은_052 · M28 01_Joyful과 다른 곡).
import os
import subprocess
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
여기 = os.path.dirname(os.path.abspath(__file__))
편 = os.path.dirname(여기)
뿌리 = os.path.abspath(os.path.join(편, '..', '..', '..'))
밖 = os.path.join(편, 'remotion', 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
난수 = np.random.default_rng(1106)


def 쓰기(이름, 소리, 크기=0.8):
    소리 = 소리 / max(1e-9, np.max(np.abs(소리))) * 크기
    판 = (np.clip(소리, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(밖, 이름), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(판.tobytes())


def 시간(초):
    return np.arange(int(SR * 초)) / SR


def 거르기(x, 낮, 높=None):
    if 높 is None:
        b, a = butter(2, 낮 / (SR / 2), 'low')
    elif 낮 is None:
        b, a = butter(2, 높 / (SR / 2), 'high')
    else:
        b, a = butter(2, [낮 / (SR / 2), 높 / (SR / 2)], 'band')
    return lfilter(b, a, x)


def 감싸기(t, 들, 날):
    return np.minimum(1, t / max(1e-4, 들)) * np.minimum(1, (t[-1] - t) / max(1e-4, 날))


# 두근 — 심장 한 번(쿵-쿵), 두근두근 칸과 게이지 떨림에
t = 시간(0.62)
def 쿵(t0, 세기):
    s = np.clip(t - t0, 0, None)
    on = (t >= t0).astype(float)
    return 세기 * on * (np.sin(2 * np.pi * (52 + 40 * np.exp(-s * 30)) * s) * np.exp(-s * 16) + 0.35 * np.sin(2 * np.pi * 104 * s) * np.exp(-s * 26))
쓰기('heart.wav', 쿵(0.0, 1.0) + 쿵(0.2, 0.75), 0.9)

# 반짝 — 높은 유리 방울 몇 개(설렘 · 카드 · 하트)
t = 시간(0.9)
반 = np.zeros(t.size)
for k, f in enumerate([2093, 2637, 3136, 3951, 4699]):
    s = np.clip(t - k * 0.07, 0, None)
    반 += (t >= k * 0.07) * np.sin(2 * np.pi * f * s) * np.exp(-s * 7) * (0.8 ** k)
쓰기('sparkle.wav', 반, 0.5)

# 책장 — 도서관 칸(종이 한 장 넘김)
t = 시간(0.45)
잡 = 거르기(난수.normal(0, 1, t.size), 1800, 7000)
쓰기('page.wav', 잡 * np.exp(-((t - 0.12) ** 2) / 0.004), 0.45)

# 비 — 버스 정류장 칸(잔잔한 빗소리 + 방울)
t = 시간(5.0)
비 = 거르기(난수.normal(0, 1, t.size), 900, 6000) * 0.5
for at in 난수.uniform(0, 4.9, 120):
    i = int(at * SR)
    n = int(SR * 0.02)
    f = 난수.uniform(2500, 5000)
    비[i:i + n] += 0.5 * np.sin(2 * np.pi * f * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 260)
쓰기('rain.wav', 비 * 감싸기(t, 0.3, 0.6), 0.45)

# 펑 — 우산이 펴지는 소리(천 바람 + 낮은 퍽)
t = 시간(0.5)
바람 = 거르기(난수.normal(0, 1, t.size), 300, 2500) * np.exp(-((t - 0.1) ** 2) / 0.003)
퍽 = np.sin(2 * np.pi * (140 - 60 * t) * t) * np.exp(-np.clip(t - 0.16, 0, None) * 30) * (t >= 0.16)
쓰기('umbrella.wav', 바람 + 퍽 * 0.8, 0.6)

# 딩동 — 이름이 불릴 때(밝은 두 음)
t = 시간(1.0)
딩 = np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 4.5) + 0.4 * np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 7)
동 = (t >= 0.16) * (np.sin(2 * np.pi * 1760 * np.clip(t - 0.16, 0, None)) * np.exp(-np.clip(t - 0.16, 0, None) * 4.0))
쓰기('chime.wav', 딩 + 동, 0.45)

# 쿵 — 심쿵(가슴이 내려앉는 낮은 한 방)
t = 시간(1.1)
쿵소리 = np.sin(2 * np.pi * (38 + 70 * np.exp(-t * 14)) * t) * np.exp(-t * 3.6)
쿵소리 += 거르기(난수.normal(0, 1, t.size), 600) * np.exp(-t * 18) * 0.6
쓰기('thud.wav', 쿵소리, 0.85)

# 스르르 — 반했어(녹아내리는 내림 피리)
t = 시간(1.3)
f = 980 * np.exp(-t * 0.9) + 260
위상 = 2 * np.pi * np.cumsum(f) / SR
녹 = (np.sin(위상) + 0.3 * np.sin(위상 * 2)) * (1 + 0.25 * np.sin(2 * np.pi * 6 * t))
쓰기('melt.wav', 녹 * 감싸기(t, 0.08, 0.4), 0.35)

# 바스락 — 은행잎(낮은 바람 + 잎 부딪힘)
t = 시간(2.2)
바 = 거르기(난수.normal(0, 1, t.size), 2000, 8000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 1.3 * t)))
바 += 거르기(난수.normal(0, 1, t.size), 200, 900) * 0.4
쓰기('leaves.wav', 바 * 감싸기(t, 0.4, 0.6), 0.32)

# 굳음 — 인사 칸에서 몸이 굳는 소리(짧은 떨림 현)
t = 시간(0.7)
굳 = np.sin(2 * np.pi * 880 * t) * (1 + 0.8 * np.sin(2 * np.pi * 28 * t)) * np.exp(-t * 6)
쓰기('freeze.wav', 굳, 0.35)

# 징징 — 휴대폰 진동 두 번
t = 시간(0.9)
진 = np.sign(np.sin(2 * np.pi * 165 * t)) * 0.6 + np.sin(2 * np.pi * 330 * t) * 0.4
진 = 거르기(진, 80, 1200)
창 = ((t > 0.02) & (t < 0.32)) | ((t > 0.48) & (t < 0.78))
쓰기('buzz.wav', 진 * 창, 0.55)

# 띵 — 문자 알림
t = 시간(0.8)
띵 = np.sin(2 * np.pi * 1568 * t) * np.exp(-t * 6) + 0.5 * np.sin(2 * np.pi * 2349 * t) * np.exp(-t * 8)
쓰기('ding.wav', 띵, 0.5)

# 슈욱 — 불꽃이 솟는 소리(올라가는 휘파람)
t = 시간(0.55)
f = 900 + 2600 * (t / t[-1]) ** 1.4
위상 = 2 * np.pi * np.cumsum(f) / SR
솟 = np.sin(위상) * 0.6 + 거르기(난수.normal(0, 1, t.size), 2500, 9000) * 0.4
쓰기('rise.wav', 솟 * 감싸기(t, 0.05, 0.03), 0.45)

# 펑 · 타닥타닥 — 불꽃놀이(낮은 폭발 + 반짝이는 꼬리)
t = 시간(2.6)
펑 = np.sin(2 * np.pi * (55 + 90 * np.exp(-t * 12)) * t) * np.exp(-t * 4.2)
펑 += 거르기(난수.normal(0, 1, t.size), 1500) * np.exp(-t * 10) * 0.9
타 = np.zeros(t.size)
for at in 난수.uniform(0.25, 2.3, 90):
    i = int(at * SR)
    n = int(SR * 0.012)
    타[i:i + n] += 난수.uniform(0.3, 1.0) * 거르기(난수.normal(0, 1, n), 2500, 9000) * np.exp(-np.arange(n) / SR * 400)
타 *= np.exp(-np.clip(t - 0.3, 0, None) * 1.1)
for k, f in enumerate([2349, 2793, 3520]):
    s = np.clip(t - 0.08 - k * 0.11, 0, None)
    타 += 0.25 * (s > 0) * np.sin(2 * np.pi * f * s) * np.exp(-s * 3)
쓰기('burst.wav', 펑 + 타 * 0.9, 0.9)

# 캠퍼스 바탕 — 멀리 새 · 바람(아주 작게)
t = 시간(6.0)
캠 = 거르기(난수.normal(0, 1, t.size), 150, 700) * 0.5
for at in [0.6, 1.9, 3.1, 4.4, 5.2]:
    s = np.clip(t - at, 0, None)
    on = (t >= at) & (t < at + 0.22)
    캠 += on * 0.25 * np.sin(2 * np.pi * (3200 + 900 * np.sin(2 * np.pi * 14 * s)) * s) * np.exp(-s * 12)
쓰기('campus.wav', 캠 * 감싸기(t, 0.5, 0.8), 0.25)

# 배경음 — 보유곡을 영상 길이(29.0초)보다 조금 길게
곡 = os.path.join(뿌리, 'docs', '홍보물', 'BGM', '시티팝_147.wav')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', 곡, '-t', '29.6', '-af', 'afade=t=out:st=28.4:d=1.2', '-ar', '44100', '-ac', '2', os.path.join(밖, 'bgm.wav')], check=True)
print('sfx 열다섯 + bgm 씀')
