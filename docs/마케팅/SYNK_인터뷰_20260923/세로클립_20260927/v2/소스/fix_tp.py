# -*- coding: utf-8 -*-
"""AAC 인코딩 뒤 트루피크가 −1.0 dBTP를 넘는 클립만, 인코딩 전 천장을 낮춰 다시 담는다."""
import sys, os, json, re, subprocess
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
import make_clips_v2 as M
def mp4_tp(p):
    e = subprocess.run(["ffmpeg", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])
out = {}
for key in M.CLIPS:
    p = os.path.join(M.OUT, f"clip_{key}.mp4"); I, tp = mp4_tp(p)
    if tp <= -1.0: out[key] = {"I": I, "TP": tp, "fixed": False}; continue
    b = json.load(open(os.path.join(M.OUT, f"{key}_build.json"), encoding="utf-8"))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(M.OUT, f"{key}_audio_v2b.wav"), "-f", "f32le", "-ac", "2", "-ar", str(M.SR), "-"], capture_output=True).stdout
    base = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
    target = b["audio"]["target"]; done = False
    for ceil in (-2.5, -3.0, -3.5, -4.0):
        g = 0.0
        for it in range(6):
            y, st = M.limiter(base * 10 ** (g / 20), ceil); I2, TP2 = M.measure(y)
            if abs(I2 - target) <= 0.1: break
            g += target - I2
        wav = os.path.join(M.OUT, f"{key}_audio_v2c.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(M.SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", wav], input=y.astype(np.float32).tobytes(), check=True)
        tmp = os.path.join(M.OUT, f"clip_{key}_tmp.mp4")
        M.run(["ffmpeg", "-y", "-v", "error", "-i", p, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", tmp])
        I3, tp3 = mp4_tp(tmp)
        print(key, "천장", ceil, "→ mp4 I", I3, "TP", tp3, "리미터", st)
        if tp3 <= -1.0:
            os.replace(tmp, p); b["audio"].update({"ceiling_dbtp": ceil, "I": I3, "TP_after_aac": tp3, **st})
            json.dump(b, open(os.path.join(M.OUT, f"{key}_build.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            out[key] = {"I": I3, "TP": tp3, "fixed": True, "ceiling": ceil, **st}; done = True; break
    if not done: out[key] = {"I": I, "TP": tp, "fixed": False, "note": "천장 −4.0까지 내려도 −1.0 초과"}
print(json.dumps(out, ensure_ascii=False))
