# LAB E9 다시 살림 효과음 — 남의 소리를 쓰지 않고 직접 합성한다(10-31).
#   python -X utf8 소리.py  →  public/sfx/thud.wav · splash.wav · sting.wav · flop.wav
import os
import wave

import numpy as np

SR = 44100
여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, 'public', 'sfx')
os.makedirs(밖, exist_ok=True)
난수 = np.random.default_rng(1031)


def 쓰기(이름, 소리, 크기=0.82):
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
    # 한 극 저역 통과 — 끝 Hz 위를 깎는다
    a = np.exp(-2 * np.pi * 끝 / SR)
    y = np.zeros_like(x)
    z = 0.0
    for i, v in enumerate(x):
        z = (1 - a) * v + a * z
        y[i] = z
    return y


# 쿵 — 몽글이 선생님과 부딪치는 둔탁한 한 방(낮은 사인 + 짧은 천 소리)
t = 시간(0.42)
몸 = np.sin(2 * np.pi * (58 + 70 * np.exp(-t * 26)) * t) * np.exp(-t * 11)
천 = 낮은통과(난수.normal(0, 1, t.size), 1600) * np.exp(-t * 60)
쓰기('thud.wav', 몸 * 1.0 + 천 * 0.9)

# 촤악 — 커피가 튀는 물소리(띠를 좁힌 잡음이 오르내림)
t = 시간(0.7)
잡음 = 난수.normal(0, 1, t.size)
밝음 = 잡음 - 낮은통과(잡음, 900)
밝음 = 낮은통과(밝음, 6500)
봉우리 = (1 - np.exp(-t * 90)) * np.exp(-t * 6.5)
물결 = 1 + 0.35 * np.sin(2 * np.pi * 17 * t)
쓰기('splash.wav', 밝음 * 봉우리 * 물결, 0.6)

# 둥 — 선생님 눈빛 한 방(낮은 현 두 음이 천천히 사라짐)
t = 시간(1.1)
둥 = (np.sin(2 * np.pi * 73.4 * t) + 0.55 * np.sin(2 * np.pi * 110.0 * t) + 0.22 * np.sin(2 * np.pi * 146.8 * t)) * (1 - np.exp(-t * 200)) * np.exp(-t * 3.6)
쓰기('sting.wav', 둥, 0.78)

# 푹 — 몽글들이 사라지고 하나가 납작 엎드리는 소리
t = 시간(0.32)
푹 = np.sin(2 * np.pi * (240 * np.exp(-t * 16) + 70) * t) * np.exp(-t * 16)
바람 = 낮은통과(난수.normal(0, 1, t.size), 2400) * np.exp(-t * 24)
쓰기('flop.wav', 푹 + 바람 * 0.5, 0.7)
print('sfx 넷 씀:', 밖)
