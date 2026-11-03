# 말의 리듬 세 곡의 조(크룸한슬 윤곽 · 주문 폭주 음악고리.py와 같은 셈)를 잰다(2026-11-04).
# 키음 · 맞음 소리의 음이 곡과 부딪히지 않게 곡마다 다섯 음(펜타토닉)을 고르는 근거다 — 결과는 world-sfx.mjs의 TRACK_KEY에 옮긴다.
#   python -I -X utf8 조재기.py
import json, subprocess, sys
from pathlib import Path
import numpy as np

여기 = Path(__file__).resolve().parent
음악 = 여기.parents[1] / "assets" / "music"
SR = 22050
_장 = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_단 = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_이름 = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def 읽기(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def 조(x):
    n = 4096
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[:: n // 2] * np.hanning(n)
    mag = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    keep = (freqs >= 65) & (freqs <= 2000)
    pc = np.round(12 * np.log2(freqs[keep] / 261.6256)).astype(int) % 12
    chroma = np.bincount(pc, weights=(mag[:, keep] ** 2).sum(axis=0), minlength=12)
    rows = sorted(((float(np.corrcoef(np.roll(prof, k), chroma)[0, 1]), _이름[k], mode) for prof, mode in ((_장, "major"), (_단, "minor")) for k in range(12)), reverse=True)
    return [{"key": f"{k} {m}", "r": round(r, 3)} for r, k, m in rows[:3]], [round(float(v / chroma.sum()), 3) for v in chroma]


결과 = {}
for p in sorted(음악.glob("*.mp3")):
    top, chroma = 조(읽기(p))
    결과[p.stem] = {"top3": top, "chroma": dict(zip(_이름, chroma))}
    print(p.stem, top)
(여기 / "조.json").write_text(json.dumps(결과, ensure_ascii=False, indent=1), encoding="utf-8")
