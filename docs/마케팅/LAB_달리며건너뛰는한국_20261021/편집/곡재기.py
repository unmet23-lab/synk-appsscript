# 곡 후보 재기(2026-11-07, Claude) — 받은 연주곡의 빠르기(BPM) · 박 자리 · 마디마다 크기를 numpy로 잰다(librosa 없이). 박표(120 BPM)에 맞출 수 있는지 본다.
#   python -X utf8 편집/곡재기.py [<wav> …]   (안 주면 곡/ 폴더 전부) → 한 줄 표 + 곡/_재기.json
# 박 찾기: 48 kHz 모노 → STFT(2048 · 홉 480 = 10 ms) 스펙트럼 흐름(올라간 몫만) → 자기상관으로 90~160 BPM 중 봉우리 → 그 주기로 박 위상을 맞춤.
#   kick = 150 Hz 아래 크기(박마다), 마디 크기 = RMS dBFS(2초 = 4박 · 120 BPM 한 마디).
import json
import os
import subprocess
import sys

import numpy as np

R = 48000
HOP = 480
DIR = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/편집/소리/곡"


def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(R), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def flux(x):
    n = 2048
    win = np.hanning(n).astype(np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n // 2)), n)[::HOP] * win
    mag = np.abs(np.fft.rfft(frames, axis=1))
    lm = np.log1p(mag * 10)
    d = np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)
    d = np.concatenate([[0], d])
    freqs = np.fft.rfftfreq(n, 1 / R)
    low = mag[:, freqs < 150].sum(axis=1)
    return d - np.convolve(d, np.ones(50) / 50, mode="same"), low


def tempo(env, lo=90, hi=160):
    env = env - env.mean()
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    fps = R / HOP
    lags = np.arange(len(ac))
    bpm = 60 * fps / np.maximum(lags, 1)
    ok = (bpm >= lo) & (bpm <= hi)
    best = lags[ok][np.argmax(ac[ok])]
    # 봉우리 둘레 포물선으로 다듬기
    a, b, c = ac[best - 1], ac[best], ac[best + 1]
    off = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0
    lag = best + off
    return 60 * fps / lag, lag


def phase(env, lag):
    fps = R / HOP
    best, bestv = 0.0, -1e9
    for ph in np.arange(0, lag, 0.25):
        idx = (ph + lag * np.arange(int((len(env) - ph) / lag))).astype(int)
        v = env[idx].sum()
        if v > bestv:
            best, bestv = ph, v
    return best / fps


def bars(x, t0, period, n):
    out = []
    for k in range(n):
        a, b = int((t0 + 4 * period * k) * R), int((t0 + 4 * period * (k + 1)) * R)
        seg = x[a:b]
        if len(seg) < R // 4:
            break
        out.append(round(float(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)), 1))
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    files = sys.argv[1:] or sorted(os.path.join(DIR, f) for f in os.listdir(DIR) if f.endswith(".wav"))
    rows = {}
    for p in files:
        x = load(p)
        env, low = flux(x)
        bpm, lag = tempo(env)
        ph = phase(env, lag)
        period = 60 / bpm
        b = bars(x, ph, period, 30)
        # 박마다 kick 세기(박 자리 ±30 ms 안 150 Hz 아래 최대) — 네 박이 고르면 four-on-the-floor
        fps = R / HOP
        ks = [float(low[max(0, int((ph + period * k) * fps) - 3): int((ph + period * k) * fps) + 3].max(initial=0)) for k in range(int((len(x) / R - ph) / period))]
        ks = np.array(ks)
        rows[os.path.basename(p)] = {"BPM": round(bpm, 2), "첫 박(초)": round(ph, 3), "길이": round(len(x) / R, 2), "마디 dBFS": b,
                                    "kick 고름(중앙/최대)": round(float(np.median(ks) / (ks.max() + 1e-9)), 2) if len(ks) else None}
        print(f"{os.path.basename(p):16s} {bpm:6.2f} BPM · 첫 박 {ph:.3f}초 · 마디 dB {b[:20]}", flush=True)
    json.dump(rows, open(os.path.join(DIR, "_재기.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
