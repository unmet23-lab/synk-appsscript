# -*- coding: utf-8 -*-
import sys, glob, os, json, subprocess, re
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
def load(p, sr=22050):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()
def lufs(p):
    r = subprocess.run(["ffmpeg", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r); LRA = re.findall(r"LRA:\s+([\d.]+) LU", r); TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)
    return float(I[-1]), float(LRA[-1]), float(TP[-1])
def tempo(x, sr=22050):
    hop = 512; n = len(x) // hop
    e = np.array([np.sum(x[i*hop:(i+1)*hop] ** 2) for i in range(n)])
    on = np.maximum(0, np.diff(np.log(e + 1e-9)))
    on = on - on.mean()
    ac = np.correlate(on, on, "full")[len(on)-1:]
    fps = sr / hop; lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)
    k = lo + np.argmax(ac[lo:hi]); strength = ac[k] / ac[0]
    return 60 * fps / k, strength
def centroid(x, sr=22050):
    X = np.abs(np.fft.rfft(x[: sr * 20] * np.hanning(min(len(x), sr * 20))))
    f = np.fft.rfftfreq(min(len(x), sr * 20), 1 / sr); return float((X * f).sum() / X.sum())
def start_end(x, sr=22050):
    fr = int(0.05 * sr); e = [20*np.log10(np.sqrt(np.mean(x[i:i+fr]**2))+1e-9) for i in range(0, len(x)-fr, fr)]
    e = np.array(e); on = np.where(e > e.max() - 30)[0]
    return on[0] * 0.05, (len(e) - on[-1]) * 0.05, e
from faster_whisper import WhisperModel
m = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8")
rows = []
for p in sorted(glob.glob("bgm/*")):
    x = load(p); I, LRA, TP = lufs(p); bpm, st = tempo(x); c = centroid(x); s0, s1, env = start_end(x)
    segs, info = m.transcribe(p, language="en", vad_filter=True, beam_size=1)
    words = " ".join(s.text.strip() for s in segs if s.no_speech_prob < 0.5)
    rows.append({"file": os.path.basename(p), "dur": round(len(x)/22050, 2), "LUFS": I, "LRA": LRA, "TP": TP, "bpm": round(bpm, 1), "beat_strength": round(float(st), 2), "centroid_hz": round(c), "lead_silence": s0, "tail_quiet": s1, "vocal_like_text": words[:80]})
    print(json.dumps(rows[-1], ensure_ascii=False))
json.dump(rows, open("bgm/eval.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
