# 지유 스킨케어 · Suno A1 원본의 마디 첫 박 격자를 만든다(곡이 120.4 → 121.2 BPM으로 조금씩 빨라져 한 BPM으로 늘이면 어긋난다).
#   python -X utf8 음악_마디격자.py <원본.wav>   → <원본>_마디격자.json  [{"bar": n, "t": 초, "bar_s": 마디 길이}, ...]
# 10-18 측정: 12초 창 자기상관으로 잰 박 길이가 앞 498.25ms(120.42 BPM)에서 끝 494.75ms(121.27 BPM)까지 고르게 줄었다.
# 마디 첫 박은 스네어(1~5kHz 어택)가 2·4박에, 킥이 1박에 오는 자리로 잡는다(10~36초를 마디 길이로 접으면
# 스네어 봉우리 0.17·1.16초, 킥 봉우리 1.68초 = 1박). 16초 창마다 그 위상을 다시 잡아 이어 붙인다.
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

sys.stdout.reconfigure(encoding="utf-8")
SRC = sys.argv[1]
sr, x = wavfile.read(SRC)
x = x.astype(np.float64)
x = (x.mean(axis=1) if x.ndim == 2 else x) / 32768.0
DUR = len(x) / sr
HOP = sr // 1000


def att(lo, hi):
    sig = sosfiltfilt(butter(4, [lo, hi], "bandpass", fs=sr, output="sos"), x)
    n = len(sig) // HOP
    e = np.sqrt((sig[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1) + 1e-12)
    e = np.convolve(e, np.ones(6) / 6, mode="same")
    le = np.log(e + 1e-6)
    d = np.zeros_like(le)
    d[5:] = le[5:] - le[:-5]
    return np.maximum(d, 0)


kick, snare = att(40, 100), att(1000, 5000)
allon = kick + snare + att(300, 2000)


def local_period(c):
    # 창 가운데 c초 둘레 12초의 박 길이(ms): 2·4·8·16박 지연 자기상관
    a, b = int(max(0, c - 6) * 1000), int(min(DUR, c + 6) * 1000)
    seg = allon[a:b] - np.convolve(allon[a:b], np.ones(300) / 300, mode="same")
    seg = np.maximum(seg, 0)
    best = None
    for p in np.arange(490, 506.01, 0.25):
        sc = 0.0
        for m in (2, 4, 8, 16):
            L = m * p
            li = int(L)
            if li + 2 >= len(seg):
                continue
            fr = L - li
            sc += float((seg[:-li - 1] * (seg[li:-1] * (1 - fr) + seg[li + 1:] * fr)).sum())
        if best is None or sc > best[0]:
            best = (sc, p)
    return best[1] / 1000


def downbeat_near(c, P):
    # c초 둘레 16초에서, 1박 킥 + 2·4박 스네어 점수가 가장 큰 마디 위상 → c에 가장 가까운 마디 첫 박
    BAR = 4 * P
    nb = int(round(BAR * 1000))
    a, b = int(max(0, c - 8) * 1000), int(min(DUR, c + 8) * 1000)
    pk, ps = np.zeros(nb), np.zeros(nb)
    for i in range(a, b):
        j = int(((i / 1000) % BAR) * 1000) % nb
        pk[j] += kick[i]
        ps[j] += snare[i]
    sm = lambda v: np.convolve(np.concatenate([v[-15:], v, v[:15]]), np.ones(31) / 31, mode="same")[15:-15]
    pk, ps = sm(pk), sm(ps)
    q = int(round(P * 1000))
    score = [pk[j] + ps[(j + q) % nb] + ps[(j + 3 * q) % nb] for j in range(nb)]
    phi = int(np.argmax(score)) / 1000
    return phi + round((c - phi) / BAR) * BAR


anchors = []
for c in np.arange(10, DUR - 6, 8.0):
    P = local_period(c)
    anchors.append((float(c), P, downbeat_near(c, P)))
    print(f"창 {c:5.1f}초  박 {P * 1000:.2f}ms({60 / P:.2f} BPM)  가까운 마디 첫 박 {anchors[-1][2]:.3f}초")

# 앵커를 이어 마디 격자: 앞 앵커에서 마디 길이로 걸어가다가 다음 앵커가 가까우면 맞춘다
grid = []
t, P = anchors[0][2], anchors[0][1]
while t - 4 * P > 0:
    t -= 4 * P
k = 0
ai = 0
while t < DUR:
    while ai + 1 < len(anchors) and anchors[ai + 1][0] <= t:
        ai += 1
    P = anchors[ai][1]
    # 가까운 앵커와 0.12초 안이면 그 앵커로 맞춘다(박 흔들림 보정)
    for _, _, d in anchors:
        if abs(d - t) < 0.12:
            t = d
    grid.append({"bar": k + 1, "t": round(t, 3), "bar_s": round(4 * P, 4)})
    t += 4 * P
    k += 1
out = SRC[:-4] + "_마디격자.json"
json.dump(grid, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(out, len(grid), "마디")
