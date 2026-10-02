# -*- coding: utf-8 -*-
"""고른 내레이션 테이크를 다듬는다 — 앞뒤 무음 자르기, 줄마다 같은 음량(−18 LUFS), 연습 줄의 음절 시작 시각.
결과: voice/trim/<줄>.wav (48kHz mono) · voice_timing.json (렌더러와 믹서가 같이 읽는다)."""
import sys, os, json, subprocess, re
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
PICK = {  # 받아쓰기 일치·신뢰도·음높이 폭으로 고른 테이크(voice_eval 결과 · 2026-09-27)
    "hook": "hook__fl31_Sulafat__t5",
    "umbrella": "umbrella__fl31_Sulafat__t1",
    "beat": "beat__fl31_Sulafat__t1",
    "slow": "slow__fl31_Sulafat__t2",
    "confirm": "confirm__fl31_Sulafat__t1",
}
TARGET_LUFS = -18.0
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def frame_db(x, hop):
    n = len(x) // hop
    return 20 * np.log10(np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop] ** 2)) for i in range(n)]) + 1e-9)
def lufs_of(path):
    r = subprocess.run(["ffmpeg", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1])
def write(path, y):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_f32le", path], input=y.astype(np.float32).tobytes(), check=True)
if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "voice", "trim"), exist_ok=True)
    timing = {"sr": SR, "target_lufs": TARGET_LUFS, "lines": {}}
    for key, name in PICK.items():
        x = load(os.path.join(HERE, "voice", "lines", name + ".wav"))
        hop = int(0.01 * SR); db = frame_db(x, hop)
        on = np.where(db > db.max() - 35)[0]
        s = max(0.0, on[0] * 0.01 - 0.03); e = min(len(x) / SR, (on[-1] + 1) * 0.01 + 0.15)
        y = x[int(s * SR):int(e * SR)].copy()
        fi, fo = int(0.005 * SR), int(0.06 * SR)
        y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo) ** 2
        tmp = os.path.join(HERE, "voice", "trim", key + "_raw.wav"); write(tmp, y)
        g = TARGET_LUFS - lufs_of(tmp); y = y * (10 ** (g / 20)); os.remove(tmp)
        out = os.path.join(HERE, "voice", "trim", key + ".wav"); write(out, y)
        item = {"take": name, "trim_start": round(s, 3), "speech_onset": round(on[0] * 0.01 - s, 3), "duration": round(len(y) / SR, 3), "gain_db": round(g, 2), "peak_db": round(float(20 * np.log10(np.abs(y).max())), 2)}
        if key == "slow":  # 음절 덩어리(아 | 맏 | 따) — 에너지 틈으로 가른다
            d = frame_db(y, hop); act = d > d.max() - 30; runs = []; st = None
            for i, v in enumerate(act):
                if v and st is None: st = i
                if not v and st is not None:
                    if i - st >= 3: runs.append([st * 0.01, i * 0.01])
                    st = None
            if st is not None: runs.append([st * 0.01, len(act) * 0.01])
            merged = []
            for a, b in runs:
                if merged and a - merged[-1][1] <= 0.04: merged[-1][1] = b
                else: merged.append([a, b])
            assert len(merged) == 3, f"연습 줄 음절 덩어리가 3개가 아니다: {merged}"
            item["syllables"] = [{"syl": s_, "start": round(a, 3), "end": round(b, 3)} for s_, (a, b) in zip(["아", "맞", "다"], merged)]
        timing["lines"][key] = item
        print(key, json.dumps(item, ensure_ascii=False))
    json.dump(timing, open(os.path.join(HERE, "voice_timing.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
