# -*- coding: utf-8 -*-
"""세로 클립 검수: 규격, 전체 디코딩, 검은 구간, 음량, 경계 음성 에너지, 프레임 시트."""
import json, os, subprocess, sys, re, wave
import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
WORK = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(WORK, "out")
QA = os.path.join(WORK, "qa")
os.makedirs(QA, exist_ok=True)


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def probe(p):
    r = sh(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels", "-of", "json", p])
    return json.loads(r.stdout)


def full_decode(p):
    r = sh(["ffmpeg", "-v", "error", "-i", p, "-f", "null", "-"])
    return r.returncode, r.stderr.strip()


def blackdetect(p):
    r = sh(["ffmpeg", "-v", "info", "-i", p, "-vf", "blackdetect=d=0.12:pic_th=0.98", "-an", "-f", "null", "-"])
    return re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr)


def loudness(p):
    r = sh(["ffmpeg", "-v", "info", "-i", p, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"])
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)
    return (I[-1] if I else None, TP[-1] if TP else None)


def boundary_rms(p):
    wav = os.path.join(QA, os.path.basename(p) + ".wav")
    sh(["ffmpeg", "-y", "-v", "error", "-i", p, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav])
    w = wave.open(wav); sr = w.getframerate()
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    def db(seg): return round(float(20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)), 1)
    n = int(sr * 0.15)
    return {"first150ms_dB": db(a[:n]), "last150ms_dB": db(a[-n:]), "overall_dB": db(a)}


def contact_sheet(p, key, n=10):
    dur = float(probe(p)["format"]["duration"])
    frames = []
    for i in range(n):
        t = dur * (i + 0.5) / n
        fp = os.path.join(QA, f"{key}_{i}.jpg")
        sh(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", p, "-frames:v", "1", "-vf", "scale=270:-1", fp])
        frames.append((t, fp))
    ims = [Image.open(fp) for _, fp in frames]
    W, H = ims[0].size
    sheet = Image.new("RGB", (W * 5, H * 2), "black")
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % 5) * W, (i // 5) * H))
    sp = os.path.join(QA, f"sheet_{key}.jpg")
    sheet.save(sp, quality=85)
    return sp, [round(t, 2) for t, _ in frames]


report = {}
for key in sys.argv[1:] or ["A", "B", "C", "D", "E", "F"]:
    p = os.path.join(OUT, f"clip_{key}.mp4")
    if not os.path.exists(p):
        print(key, "missing"); continue
    pr = probe(p)
    v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in pr["streams"] if s["codec_type"] == "audio"][0]
    rc, err = full_decode(p)
    blacks = blackdetect(p)
    I, TP = loudness(p)
    br = boundary_rms(p)
    sheet, ts = contact_sheet(p, key)
    report[key] = {
        "file": p, "bytes": int(pr["format"]["size"]), "duration": round(float(pr["format"]["duration"]), 3),
        "video": f"{v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']}",
        "audio": f"{a['codec_name']} {a['sample_rate']}Hz {a['channels']}ch",
        "full_decode_rc": rc, "decode_errors": err[:300],
        "black_segments": blacks, "loudness_I_LUFS": I, "true_peak_dBFS": TP,
        "boundary": br, "sheet": sheet, "sheet_times": ts,
    }
    print(key, json.dumps({k: v for k, v in report[key].items() if k not in ("sheet_times",)}, ensure_ascii=False))
json.dump(report, open(os.path.join(QA, "qa_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
