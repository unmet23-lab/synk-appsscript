# 지유 스킨케어 · Suno A1(120 BPM으로 늘인 판)의 박 위상과 짜임(한 음 도입·들어옴·멈춤·후렴·끝)을 숫자로 찾는다.
#   python -X utf8 음악_짜임.py <곡.wav> [박길이초=0.5]
# 하린 tempo_precise.py는 킥·손뼉 어택으로 위상을 잡는데, A1은 펠트 피아노·브러시라 킥이 약해 위상이 흔들렸다
# (늘이기 전 0.283초, 늘인 뒤 0.156초 — 늘인 비율로는 0.286이어야 함). 그래서 대역별 어택을 박 길이로 접어 위상 후보를 함께 보고,
# 박마다 크기·저역·고역을 표로 내어 짜임을 눈으로 고른다.
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

sys.stdout.reconfigure(encoding="utf-8")
SRC = sys.argv[1]
BEAT = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
sr, x = wavfile.read(SRC)
x = x.astype(np.float64)
x = (x.mean(axis=1) if x.ndim == 2 else x) / 32768.0
HOP = sr // 100  # 10ms


def band(lo, hi):
    if lo and hi:
        sos = butter(4, [lo, hi], "bandpass", fs=sr, output="sos")
    elif hi:
        sos = butter(4, hi, "lowpass", fs=sr, output="sos")
    else:
        sos = butter(4, lo, "highpass", fs=sr, output="sos")
    return sosfiltfilt(sos, x)


def frames(sig):
    n = len(sig) // HOP
    return np.sqrt((sig[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1) + 1e-12)


full = frames(x)
low = frames(band(None, 150))
mid = frames(band(300, 2500))
high = frames(band(3000, None))


def onset(e):
    le = np.log(e + 1e-6)
    d = np.zeros_like(le)
    d[2:] = le[2:] - le[:-2]
    return np.maximum(d, 0)


def db(v):
    return 20 * np.log10(v + 1e-9)


# 1) 위상 후보: 대역별 어택을 박 길이로 접은 봉우리(10ms 칸)
nb = int(round(BEAT * 100))
print(f"길이 {len(x) / sr:.2f}초, 박 {BEAT}초")
for name, e in (("저역", low), ("중역", mid), ("고역", high), ("전체", full)):
    o = onset(e)
    prof = np.zeros(nb)
    for i, v in enumerate(o[300:], start=300):  # 앞 3초(도입) 빼고
        prof[int(round((i / 100) % BEAT * 100)) % nb] += v
    top = np.argsort(prof)[::-1][:3]
    print(f"  위상 {name}: " + ", ".join(f"{t / 100:.2f}초({prof[t] / prof.mean():.2f}배)" for t in top))

# 2) 박마다 크기(전체·저역·중역·고역 dB)와 박 안 가장 긴 조용한 틈(-45dB 아래)
ph = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
print(f"\n박표(위상 {ph:.3f}초에서 시작) — 마디 첫 박은 ▶")
t = ph
k = 0
while t + BEAT <= len(x) / sr:
    a, b = int(t * 100), int((t + BEAT) * 100)
    q = full[a:b] < 10 ** (-45 / 20)
    best = cur = 0
    for v in q:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    mark = "▶" if k % 4 == 0 else " "
    print(f"{mark}{k // 4 + 1:3d}.{k % 4 + 1} {t:7.2f}  전체 {db(full[a:b].mean()):6.1f}  저역 {db(low[a:b].mean()):6.1f}  "
          f"중역 {db(mid[a:b].mean()):6.1f}  고역 {db(high[a:b].mean()):6.1f}  틈 {best / 100:.2f}")
    t += BEAT
    k += 1
