# 옆집 곡 편집(2026-11-07, Claude) — 받은 연주곡(곡_스테이블/통째_b.wav, Gemini 맹검 1위)을 02_콘티 4절 짜임에 맞춰 쉼 · 박 자리에서 잇는다.
#   python -X utf8 곡편집.py   → git 밖 최종/s1/소리/곡.wav(48 kHz 스테레오, 소리.py가 깐다)
# 짜임: 피아노 0.3초에 들어와(곡 0~19.05초) → 화음이 가장 닮은 쉼에서 한 번 되감아(곡 12.30초) 그 뒤는 곡 그대로 — 곡 자신의 숨 · 올라감(곡 27~29.2초)을 지나
#   29.3초 현악 진입이 화면 36.35초에 온다 → 43.6~46.5 1차 고조(곡 36~39초) → 47~51.5 잦아듦(곡은 이어지니 크기만 내림) → 하린의 한 줄 아래 낮춤
#   → 54.5부터 절정(곡 47~49.5초) → 곡 자신의 끝(57.9~61.8초 — 마지막 화음이 잦아듦)으로 이어 59.4~60초에 맺는다. 내레이션 아래는 낮춘다.
# 첫 판(쉼 셋에서 잇고 35.4초에 무음 숨)은 Gemini 맹검이 「곡이 끊겼다가 다른 곡이 시작」 · 25초 박 튐으로 6점 — 이음을 하나로 줄이고(크로마 닮음으로 고른 자리)
#   숨은 곡의 것을 쓴다. 50~56초 고음 현악의 금속성은 9 kHz 위를 살짝 깎는다. 빠르기 · 음높이는 손대지 않는다(이어 붙이고 크기 · 결만).
import os
import subprocess
import wave

import numpy as np

R = 48000
SRC = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s1/소리/곡_스테이블/통째_b.wav"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s1/소리/곡.wav"
END = 60.04
# (곡 시작초, 곡 끝초, 화면 시작초, 들어옴 페이드초, 나감 페이드초) — 앞 조각의 나감과 다음 조각의 들어옴이 겹치는 자리가 이음(크로스페이드)
PIECES = [
    (0.00, 19.11, 0.30, 0.006, 0.12),   # 피아노 — 19.05초 쉼(−30 dB)까지
    (12.24, 49.55, 19.29, 0.12, 0.50),  # 12.30초(−34 dB, 앞뒤 0.8초 크로마 닮음 0.13 · 0.20)로 되감아 곡 그대로 — 곡 29.3초 = 화면 36.35초
    (57.90, 61.80, 56.10, 0.50, 0.006), # 곡 자신의 끝 — 마지막 화음이 60.6초부터 잦아듦
]
# 크기 자국(화면초, dB) — 사이는 직선
GAIN = [(0.0, 7.0), (33.9, 7.0), (36.25, 4.0), (36.35, 0.0), (46.2, 0.0), (46.5, -4.0), (47.2, -7.0), (51.0, -7.0), (51.8, -3.0), (52.45, -3.0), (52.75, -11.0),
        (54.35, -11.0), (54.75, 0.0), (55.9, 0.0), (56.25, -10.0), (END, -10.0)]   # 하린 한 줄 · 내레이션(56.25초부터) 아래 — 맹검 2차 「대사가 곡 잔향에 묻힘」 · 「늘켬 받침이 흐림」


def load(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "2", "-ar", str(R), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2).copy()


def main():
    x = load(SRC)
    out = np.zeros((int((END + 0.5) * R), 2), np.float32)
    for a, b, at, fi, fo in PIECES:
        seg = x[int(a * R):int(b * R)].copy()
        n_in, n_out = int(fi * R), int(fo * R)
        seg[:n_in] *= np.linspace(0, 1, n_in)[:, None]
        seg[-n_out:] *= np.linspace(1, 0, n_out)[:, None]
        i = int(at * R)
        j = min(len(out), i + len(seg))
        out[i:j] += seg[:j - i]
    fr = np.fft.rfftfreq(len(out), 1 / R)   # 9 kHz 위를 부드럽게 깎음(2차) — 고음 현악의 금속성
    lp = (1 / np.sqrt(1 + (fr / 9000) ** 4)).astype(np.float32)
    eq = lambda y, g: np.stack([np.fft.irfft(np.fft.rfft(y[:, c]) * g, len(y)) for c in range(2)], axis=1).astype(np.float32)
    out = eq(out, lp)
    # 현악 구간(36.3초 뒤)만 3.5 kHz 위 −3.5 dB 선반 — 맹검 2차 「44~52초 고음 바이올린 위상 찰랑거림」
    shelf = (10 ** (-3.5 / 20) + (1 - 10 ** (-3.5 / 20)) / (1 + (fr / 3500) ** 2)).astype(np.float32)
    t = np.arange(len(out)) / R
    k = np.clip((t - 36.2) / 0.2, 0, 1)[:, None].astype(np.float32)
    out = out * (1 - k) + eq(out, shelf) * k
    # 내레이션 아래(56.05초 뒤)는 말소리 대역(1~3.5 kHz)을 −5 dB 더 판다 — 맹검 3차 「브랜드 이름이 곡 고음에 묻혀 늘켜 · 늘겸처럼 뭉개짐」
    bc = np.clip(fr, 1, None)
    dip = (1 - (1 - 10 ** (-5 / 20)) * np.exp(-0.5 * (np.log2(bc / 1900) / 0.85) ** 2)).astype(np.float32)
    k2 = np.clip((t - 56.05) / 0.2, 0, 1)[:, None].astype(np.float32)
    out = out * (1 - k2) + eq(out, dip) * k2
    g = np.interp(t, [p[0] for p in GAIN], [p[1] for p in GAIN])
    out *= (10 ** (g / 20))[:, None].astype(np.float32)
    out[int(END * R):] = 0
    peak = float(np.max(np.abs(out))) or 1.0
    out = out / peak * 0.7
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(R)
        w.writeframes((out * 32767).astype(np.int16).tobytes())
    print(OUT, f"{len(out) / R:.2f}s")


if __name__ == "__main__":
    main()
