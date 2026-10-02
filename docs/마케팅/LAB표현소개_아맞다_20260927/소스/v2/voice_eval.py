# -*- coding: utf-8 -*-
"""음성 테이크 객관 평가 — 받아쓰기(faster-whisper large-v3-turbo)·길이·앞뒤 무음·음높이 폭. 귀 검수를 대신하지 않는다."""
import sys, os, glob, json, subprocess, re
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from faster_whisper import WhisperModel
def load(p, sr=16000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()
def db(x): return 20 * np.log10(np.maximum(x, 1e-9))
def trim_bounds(x, sr=16000, th=-42):
    fr = int(0.01 * sr); n = len(x) // fr
    e = np.array([np.sqrt(np.mean(x[i*fr:(i+1)*fr] ** 2)) for i in range(n)])
    on = np.where(db(e) > th)[0]
    if not len(on): return 0, len(x) / sr
    return on[0] * 0.01, (on[-1] + 1) * 0.01
def f0_track(x, sr=16000):
    fr, hop = int(0.04 * sr), int(0.01 * sr); out = []
    for i in range(0, len(x) - fr, hop):
        w = x[i:i+fr] * np.hanning(fr)
        if np.sqrt(np.mean(w ** 2)) < 0.01: out.append(np.nan); continue
        ac = np.correlate(w, w, "full")[fr-1:]
        lo, hi = int(sr / 500), int(sr / 120)
        k = lo + np.argmax(ac[lo:hi]); out.append(sr / k if ac[k] > 0.35 * ac[0] else np.nan)
    return np.array(out)
def norm_ko(s): return re.sub(r"[^가-힣]", "", s)
if __name__ == "__main__":
    files = sorted(glob.glob(sys.argv[1]))
    expect = norm_ko(sys.argv[2]) if len(sys.argv) > 2 else None
    model = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8")
    rows = []
    for p in files:
        x = load(p); sr = 16000
        a, b = trim_bounds(x)
        pad = np.concatenate([np.zeros(sr, np.float32), x, np.zeros(sr, np.float32)])
        segs, info = model.transcribe(pad, language="ko", beam_size=5, vad_filter=False, word_timestamps=False, condition_on_previous_text=False)
        segs = list(segs)
        text = " ".join(s.text.strip() for s in segs)
        lp = float(np.mean([s.avg_logprob for s in segs])) if segs else -9
        f0 = f0_track(x[int(a*sr):int(b*sr)]); v = f0[~np.isnan(f0)]
        rng = float(12 * np.log2(np.percentile(v, 95) / np.percentile(v, 5))) if len(v) > 5 else 0
        exp = norm_ko(sys.argv[2 if len(sys.argv) > 2 else 0]) if expect else None
        item = {"file": os.path.basename(p), "asr": text, "match": (norm_ko(text) == expect) if expect else None, "logprob": round(lp, 3),
                "speech_s": round(b - a, 3), "lead_s": round(a, 3), "tail_s": round(len(x)/sr - b, 3), "peak_db": round(float(db(np.abs(x).max())), 1),
                "f0_med": round(float(np.median(v)), 1) if len(v) else None, "f0_range_st": round(rng, 1)}
        rows.append(item); print(json.dumps(item, ensure_ascii=False))
    if len(sys.argv) > 3: json.dump(rows, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
