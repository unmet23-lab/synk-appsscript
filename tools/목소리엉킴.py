"""목소리 엉킴 재기 — TTS 원본의 모음에서 배음이 엇갈려 흩뿌려진(지지직 깨지는) 프레임 비율을 잰다(2026-10-28).

    python -X utf8 tools/목소리엉킴.py <wav…> [--문턱 0.35]

모음(유성) 프레임마다 기본 주파수를 자기상관으로 잡고, 0.08~5kHz 에너지 가운데 배음(기본 주파수의 정수배 ±12%) 밖에 있는
비율을 센다. 깨끗한 모음은 배음 줄에 모여 0.0x, Typecast 「하나」의 감탄사 결함(「Nope!」 첫머리)은 0.35~0.5까지 오른다.
파일마다 「엉킨 프레임」(문턱 넘은 비율) · 최악 세 프레임 평균 · 중앙값을 낸다.
최고 음높이(YIN, 48kHz)도 낸다 — 감정 세기 1.3 · toneup 1.2는 여자 목소리를 600Hz 넘게 끌어올려 목소리가 뒤집혀 깨진다
(10-28 소진 「Three!」 세기 1.3 · 1.2 638Hz 깨짐 ↔ 세기 1.0 498Hz 괜찮음, 하나 「Nope!」 650Hz 안팎 깨짐 — 유호님 귀). 560Hz를 넘으면 ⚠.
같은 글을 목소리 · 설정끼리 견줄 때만 쓴다 — 자음이 많은 줄이나 낮은 남자 목소리는 결함 없이도 높게 나올 수 있고, 귀로 듣기를 대신하지 않는다.
"""
import subprocess
import sys

import numpy as np

SR = 16000


def load(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def frames(x, n=640, hop=160):
    w = np.hanning(n)
    for i in range(0, len(x) - n, hop):
        yield i, x[i:i + n] * w


def f0_of(seg, fmin=90, fmax=600):
    ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
    ac = ac / (ac[0] + 1e-12)
    lo, hi = int(SR / fmax), int(SR / fmin)
    k = lo + int(np.argmax(ac[lo:hi]))
    return SR / k, ac[k]


def analyse(x):
    """[(초, 배음 밖 비율, 기본 주파수)] — 큰 소리의 모음 프레임만."""
    pk = np.abs(x).max() + 1e-9
    nfft = 4096
    fq = np.fft.rfftfreq(nfft, 1 / SR)
    band = (fq > 80) & (fq < 5000)
    out = []
    for i, seg in frames(x):
        if np.sqrt((seg ** 2).mean()) < pk * 0.12:
            continue
        f0, r = f0_of(seg)
        if r < 0.3:
            continue
        P = np.abs(np.fft.rfft(seg, nfft)) ** 2
        k = fq / f0
        near = (np.abs(k - np.round(k)) < 0.12) & (np.round(k) >= 1)
        out.append((i / SR, 1 - P[band & near].sum() / P[band].sum(), f0))
    return out


PITCH_WARN = 560


def top_pitch(path, sr=48000, fmin=120, fmax=850, w=1920, hop=480, th=0.1):
    """YIN 음높이(포물선 보간)로 이어진 세 프레임(30ms)이 2반음 안에서 고른 자리의 가장 높은 값(Hz). 없으면 None.
    프레임 하나만 튄 값과 850Hz 위(실제 음의 두 배로 잘못 읽은 것)는 세지 않는다 — tools/나레이션굽기.mjs topPitch와 같은 셈."""
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True)
    x = np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
    tmin, tmax = sr // fmax, sr // fmin
    pk = np.abs(x).max() + 1e-9
    if pk < 1e-4:
        return None
    track = []
    for i in range(0, len(x) - w - tmax - 2, hop):
        track.append(None)
        f = x[i:i + w]
        if np.sqrt((f ** 2).mean()) < pk * 0.12:
            continue
        d = np.array([np.sum((f - x[i + t:i + t + w]) ** 2) for t in range(tmax + 2)])
        dn = np.r_[1, d[1:] * np.arange(1, len(d)) / (np.cumsum(d[1:]) + 1e-12)]
        cand = np.where(dn[tmin:tmax] < th)[0]
        if len(cand) == 0:
            continue
        t = tmin + cand[0]
        while t + 1 < tmax and dn[t + 1] < dn[t]:
            t += 1
        a, b, c = dn[t - 1], dn[t], dn[t + 1]
        track[-1] = sr / (t + 0.5 * (a - c) / (a - 2 * b + c + 1e-12))
    best = None
    for k in range(1, len(track) - 1):
        trio = track[k - 1:k + 2]
        if None in trio or max(trio) / min(trio) > 2 ** (2 / 12):
            continue
        mid = sorted(trio)[1]
        best = mid if best is None else max(best, mid)
    return best


def main(argv):
    limit = 0.35
    if '--문턱' in argv:
        i = argv.index('--문턱')
        limit = float(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    if not argv:
        print(__doc__)
        return 0
    for path in argv:
        a = analyse(load(path))
        if not a:
            print(f'{path}\t모음 없음')
            continue
        v = np.array([x[1] for x in a])
        hz = top_pitch(path)
        high = f'{hz:.0f}Hz' + (' ⚠ 높아 뒤집힐 수 있음' if hz and hz > PITCH_WARN else '') if hz else '-'
        # 중앙 기본음 — 엉킴 비율은 기본음이 낮은 남자 목소리에서 결함 없이도 높게 나온다(범수 45~65%). tools/올리기전검사.js는 이 값이
        # 165Hz 이상인 목소리만 엉킴으로 가른다(10-28)
        f0 = np.median([x[2] for x in a])
        print(f'{path}\t엉킨 프레임 {100 * (v > limit).mean():5.1f}% · 최악 3프레임 {np.sort(v)[-3:].mean():.2f} · 중앙 {np.median(v):.2f} · 프레임 {len(v)} · 최고 음높이 {high} · 중앙 기본음 {f0:.0f}Hz')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
