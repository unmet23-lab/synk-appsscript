# LAB M1 효과음 — 남의 소리를 쓰지 않고 직접 합성한다(10-31).
#   python -X utf8 소리.py  →  public/sfx/boil.wav · engine.wav · whistle.wav · crash.wav · boom.wav
import os
import wave

import numpy as np

SR = 44100
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
난수 = np.random.default_rng(1031)


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


def 낮은통과(x, 끝):
    a = np.exp(-2 * np.pi * 끝 / SR)
    y = np.zeros_like(x)
    z = 0.0
    for i, v in enumerate(x):
        z = (1 - a) * v + a * z
        y[i] = z
    return y


# 부글부글 — 머리 글 칸의 끓는 소리(낮은 잡음 + 터지는 방울)
t = 시간(3.0)
바탕 = 낮은통과(난수.normal(0, 1, t.size), 500) * 0.8
방울 = np.zeros(t.size)
for at in 난수.uniform(0, 2.8, 26):
    i = int(at * SR)
    n = int(SR * 0.05)
    f = 난수.uniform(240, 620)
    방울[i:i + n] += np.sin(2 * np.pi * f * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 90)
쓰기('boil.wav', (바탕 + 방울 * 0.9) * np.minimum(1, t * 6) * np.minimum(1, (t[-1] - t) * 6), 0.6)

# 부웅 — 버스가 떠나는 낮은 엔진(멀어지며 작아짐)
t = 시간(1.8)
엔진 = np.sin(2 * np.pi * (62 + 22 * t) * t) + 0.5 * np.sin(2 * np.pi * (124 + 44 * t) * t)
엔진 += 낮은통과(난수.normal(0, 1, t.size), 700) * 0.9
쓰기('engine.wav', 엔진 * np.minimum(1, t * 8) * np.exp(-t * 1.4), 0.6)

# 삐이 — 주전자 소리(높아지는 두 음 + 바람)
t = 시간(1.5)
f = 1650 + 520 * np.minimum(1, t * 2.2)
위상 = 2 * np.pi * np.cumsum(f) / SR
삐 = np.sin(위상) + 0.45 * np.sin(위상 * 1.5)
바람 = 낮은통과(난수.normal(0, 1, t.size), 5200) * 0.35
쓰기('whistle.wav', (삐 + 바람) * np.minimum(1, t * 7) * np.minimum(1, (t[-1] - t) * 5), 0.5)

# 쨍그랑 — 컵 깨지는 소리(높은 금속성 부분음 + 잡음)
t = 시간(0.7)
조각 = np.zeros(t.size)
for f, a, d in [(2300, 1, 14), (3350, 0.8, 18), (4700, 0.7, 22), (6200, 0.5, 30)]:
    조각 += a * np.sin(2 * np.pi * f * t) * np.exp(-t * d)
잡음 = 난수.normal(0, 1, t.size)
잡음 = (잡음 - 낮은통과(잡음, 2500)) * np.exp(-t * 26)
쓰기('crash.wav', 조각 * 0.8 + 잡음 * 0.9, 0.7)

# 콰광 — 속에서 터지는 낮은 폭발
t = 시간(1.2)
콰 = np.sin(2 * np.pi * (46 + 60 * np.exp(-t * 9)) * t) * np.exp(-t * 3.4)
잡음 = 낮은통과(난수.normal(0, 1, t.size), 900) * np.exp(-t * 6)
쓰기('boom.wav', 콰 + 잡음 * 0.8, 0.8)
print('sfx 다섯 씀')
