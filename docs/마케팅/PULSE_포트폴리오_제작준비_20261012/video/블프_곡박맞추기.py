# 블프 곡 박 맞추기(2026-11-08, Claude) — 곡의 빠르기 · 박 자리를 재서, 편집 시각(예: 세일 「팡」 1.40 · 끝 12.56)에 박이 오도록 곡을 몇 초부터 쓸지(MUSIC_IN) 고른다.
# librosa 없이 numpy만: 스펙트럼 차이(onset) → 자기상관으로 빠르기 → 박 위상 → 맞출 시각들과의 어긋남이 가장 작은 시작점.
#   python -X utf8 블프_곡박맞추기.py <곡.wav> <맞출 초,…> [--처음 0.3] [--끝 1.2]
import subprocess
import sys

import numpy as np

RATE, HOP = 22050, 220   # 100장/초


def load(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.float32)


def onset(x):
    n = 1024
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::HOP] * np.hanning(n)
    mag = np.log1p(np.abs(np.fft.rfft(frames, axis=1)))
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    flux = flux - np.convolve(flux, np.ones(16) / 16, mode="same")
    return np.maximum(0, flux)


def main():
    a = sys.argv[1:]
    lo, hi = 0.0, 1.2
    if "--처음" in a:
        i = a.index("--처음"); lo = float(a[i + 1]); del a[i:i + 2]
    if "--끝" in a:
        i = a.index("--끝"); hi = float(a[i + 1]); del a[i:i + 2]
    path, marks = a[0], [float(v) for v in a[1].split(",")]
    o = onset(load(path))
    fps = RATE / HOP
    # 빠르기: 90~150 BPM 자기상관
    ac = np.correlate(o, o, mode="full")[len(o) - 1:]
    lags = np.arange(int(fps * 60 / 150), int(fps * 60 / 90) + 1)
    lag = lags[np.argmax(ac[lags])]
    # 소수 장 보정(포물선)
    if 0 < lag < len(ac) - 1:
        y0, y1, y2 = ac[lag - 1], ac[lag], ac[lag + 1]
        d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) if (y0 - 2 * y1 + y2) != 0 else 0
    else:
        d = 0
    period = (lag + d) / fps
    # 위상: 박 자리마다 onset 합이 가장 큰 어긋남
    phases = np.arange(0, period, 1 / fps)
    score = [sum(o[int(round((ph + k * period) * fps))] for k in range(int((len(o) / fps - ph) / period)) if int(round((ph + k * period) * fps)) < len(o)) for ph in phases]
    ph = phases[int(np.argmax(score))]
    print(f"빠르기 {60 / period:.2f} BPM · 박 {period:.4f}초 · 첫 박 {ph:.3f}초")
    # MUSIC_IN 후보: 편집 시각 m에 곡 박이 오려면 곡 시각 = MUSIC_IN + m 이 박 자리(ph + k·period)
    best = []
    for s in np.arange(lo, hi, 0.002):
        err = [((s + m - ph) / period) % 1 for m in marks]
        err = [min(e, 1 - e) * period for e in err]
        best.append((max(err), s, err))
    best.sort()
    for mx, s, err in best[:5]:
        print(f"  MUSIC_IN {s:.3f} — 맞출 시각마다 어긋남 " + " · ".join(f"{m:.2f}:{e * 1000:.0f}ms" for m, e in zip(marks, err)))


if __name__ == "__main__":
    main()
