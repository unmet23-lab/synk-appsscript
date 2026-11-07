# 「달리며 건너뛰는 한국」 꽃밭 착지 소리 합성(2026-11-07, Claude) — 남의 소리 없이 수식으로 만든다(LAB 설렐때 편 소리/만들기.py의 방법).
#   python -X utf8 편집/효과음합성.py   → git 밖 편집/소리/효과음/합성_*.wav(48 kHz)
# 왜: stable-audio-3로 구운 「꽃밭에 풀썩 · 바스락」 후보가 모두 종이 · 비닐 · 물소리로 들렸다(CLAP 「leaves rustling」 몫 0.01 안팎,
#   Gemini v5 「다이빙 소리가 물에 빠지는 소리 같다」, Fable v4 P2 「합성한 낮은 쿵 + 바스락으로」).
#   몸쿵 = 음높이가 내려앉는 낮은 사인(42 Hz로) + 짧은 낮은 잡음 / 잎 = 줄기 · 잎이 부러지는 짧은 딱딱 소리 알갱이(띠 잡음)를 밀도 곡선대로 뿌리고
#   잎이 밀리는 낮은 쉬익을 얹는다. 크기는 소리편집.py가 봉우리 −6 dBFS로 맞춘 뒤 놓는다.
import os
import wave

import numpy as np
from scipy.signal import butter, lfilter

R = 48000
OUT = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/편집/소리/효과음"


def band(x, lo, hi):
    b, a = butter(2, [lo / (R / 2), hi / (R / 2)], "band")
    return lfilter(b, a, x)


def low(x, fc):
    b, a = butter(2, fc / (R / 2), "low")
    return lfilter(b, a, x)


def write(name, y):
    y = np.asarray(y, np.float64)
    y = y / (np.abs(y).max() + 1e-9) * 0.7
    f = int(0.004 * R)
    y[-f:] *= np.linspace(1, 0, f)
    st = np.stack([y, y], axis=1)
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(R)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())
    print(name, f"{len(y) / R:.2f}초")


def body_thud(dur, f_hi, f_lo, decay, grit, seed):
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * R)) / R
    f = f_lo + (f_hi - f_lo) * np.exp(-t * 16)
    y = np.sin(2 * np.pi * np.cumsum(f) / R) * np.exp(-t * decay)
    y += low(rng.normal(0, 1, t.size), 520) * np.exp(-t * 34) * grit
    a = int(0.002 * R)
    y[:a] *= np.linspace(0, 1, a)
    return y


def leaves(dur, peak_at, rise, fall, rate, swish, seed):
    """줄기 · 잎 알갱이: 밀도가 peak_at에서 가장 크고 앞은 rise, 뒤는 fall 초로 잦아든다."""
    rng = np.random.default_rng(seed)
    n = int(dur * R)
    t = np.arange(n) / R
    dens = np.where(t < peak_at, np.exp(-(peak_at - t) / max(rise, 1e-3)), np.exp(-(t - peak_at) / fall))
    env = np.zeros(n)
    tt = 0.0
    while True:
        tt += rng.exponential(1 / rate)
        if tt >= dur:
            break
        i = int(tt * R)
        if rng.uniform() > dens[i]:
            continue
        L = int(R * rng.uniform(0.003, 0.016))
        m = min(L, n - i)
        env[i:i + m] += rng.uniform(0.2, 1.0) * np.exp(-np.arange(m) / (L / 4))
    crack = band(rng.normal(0, 1, n), 1400, 7200) * env
    sw = band(rng.normal(0, 1, n), 260, 1500) * dens * swish
    y = crack + sw
    a = int(0.003 * R)
    y[:a] *= np.linspace(0, 1, a)
    return y


def main():
    os.makedirs(OUT, exist_ok=True)
    # 다이빙 착지(18.85초): 몸이 꽃밭에 떨어지는 쿵 + 잎이 한꺼번에 꺾이는 소리
    write("합성_몸쿵.wav", body_thud(0.9, 100, 42, 7.0, 0.55, 11))
    write("합성_잎_착지.wav", leaves(0.9, 0.03, 0.01, 0.20, 900, 0.45, 12))
    # 다리가 솟는 순간(20.0초): 잎이 조금 흔들림
    write("합성_잎_솟음.wav", leaves(0.7, 0.16, 0.08, 0.16, 500, 0.30, 13))
    # 끝(27.17~27.54초): 다리가 기울며 꽃 속으로 — 밀도가 사라지는 27.5초로 차오른다(파일 0.35초가 27.5초)
    write("합성_잎_쓰러짐.wav", leaves(1.0, 0.35, 0.16, 0.18, 800, 0.40, 14))
    # 끝 한 타 아래 부드러운 쿵(몸이 눕는 소리) — 착지보다 가볍게
    write("합성_몸쿵_끝.wav", body_thud(0.8, 90, 45, 9.0, 0.35, 15))


if __name__ == "__main__":
    main()
