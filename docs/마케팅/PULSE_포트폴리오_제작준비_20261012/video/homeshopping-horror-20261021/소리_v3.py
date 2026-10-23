# 콘티 v3 효과음 넷을 합성한다(2026-10-22) — 소리 창고에 맞는 것이 없어서: 심장 박동(첫 0.3초 훅), 통화 연결음(C11b) · 짧은 연결음(멍 셋의 박),
# 초인종 「딩동」(끝 고리 E3). 48kHz 16비트 모노 → synk-vendor/homeshopping-horror-20261021/소리_v3/<이름>.wav (준비.mjs가 public/sfx로 옮긴다)
#   python -X utf8 소리_v3.py
import os
import wave

import numpy as np

SR = 48000
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021", "소리_v3")


def save(name, x, peak_db=-3.0):
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print(name, f"{len(x) / SR:.2f}초")


def t(sec):
    return np.arange(int(SR * sec)) / SR


def heartbeat():
    # 「쿵-쿵」 한 번: 낮은 사인(48Hz · 40Hz)에 빠른 감쇠, 둘째 박은 0.28초 뒤 조금 약하게
    out = np.zeros(int(SR * 0.9))
    for at, f0, g in [(0.0, 48, 1.0), (0.28, 40, 0.7)]:
        tt = t(0.35)
        thump = np.sin(2 * np.pi * f0 * tt * (1 - 0.35 * tt)) * np.exp(-tt * 14) * g
        thump += 0.25 * np.sin(2 * np.pi * f0 * 2 * tt) * np.exp(-tt * 30) * g
        i = int(SR * at)
        out[i:i + len(thump)] += thump
    return out


def ringback(sec, on=None):
    # 한국 통화 연결음 꼴: 440Hz + 480Hz를 겹쳐 20Hz로 살짝 흔든다. on이 있으면 그 길이만 울리고 끝은 10ms 페이드
    tt = t(sec)
    x = (np.sin(2 * np.pi * 440 * tt) + np.sin(2 * np.pi * 480 * tt)) * (0.85 + 0.15 * np.sin(2 * np.pi * 20 * tt))
    n = int(SR * (on or sec))
    env = np.zeros_like(tt)
    env[:n] = 1
    fade = int(SR * 0.01)
    env[:fade] *= np.linspace(0, 1, fade)
    env[n - fade:n] *= np.linspace(1, 0, fade)
    return x * env


def doorbell():
    # 「딩-동」: 659Hz(미) → 523Hz(도), 종소리처럼 배음 둘과 긴 감쇠
    out = np.zeros(int(SR * 1.6))
    for at, f0 in [(0.0, 659.25), (0.42, 523.25)]:
        tt = t(1.1)
        tone = (np.sin(2 * np.pi * f0 * tt) + 0.35 * np.sin(2 * np.pi * f0 * 2.01 * tt) + 0.15 * np.sin(2 * np.pi * f0 * 3.02 * tt)) * np.exp(-tt * 3.2)
        tone[: int(SR * 0.004)] *= np.linspace(0, 1, int(SR * 0.004))
        i = int(SR * at)
        out[i:i + len(tone)] += tone
    return out


if __name__ == "__main__":
    save("heartbeat", heartbeat(), -2.0)
    save("ringback", ringback(0.7, on=0.6), -12.0)
    save("ringback_short", ringback(0.45, on=0.32), -12.0)
    save("doorbell", doorbell(), -6.0)
