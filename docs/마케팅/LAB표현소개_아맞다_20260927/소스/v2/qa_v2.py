# -*- coding: utf-8 -*-
"""v2 검수 — 기술(규격·색 태그·전체 디코딩·검은 구간·음량·트루피크) + 릴스 조건(첫 프레임·길이·컷 간격·안전 영역)
+ 소리(받아쓰기로 「아 맞다」가 예정 시각에 들리는가, 효과음 시각) + 프레임 시트. 결과는 qa_v2.json."""
import sys, os, json, re, subprocess, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import render_v2 as R
def run(cmd, **kw): return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
def probe(p):
    j = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,width,height,r_frame_rate,nb_frames,pix_fmt,color_space,color_primaries,color_transfer,color_range,sample_rate,channels,bit_rate:format=duration,size,bit_rate", "-of", "json", p]).stdout)
    out = {"duration": float(j["format"]["duration"]), "bytes": int(j["format"]["size"]), "total_kbps": round(int(j["format"]["bit_rate"]) / 1000)}
    for s in j["streams"]:
        if s["codec_type"] == "video":
            out["video"] = {k: s.get(k) for k in ("codec_name", "profile", "width", "height", "r_frame_rate", "nb_frames", "pix_fmt", "color_space", "color_primaries", "color_transfer", "color_range")}
        else:
            out["audio"] = {k: s.get(k) for k in ("codec_name", "sample_rate", "channels", "bit_rate")}
    return out
def decode(p):
    r = run(["ffmpeg", "-v", "error", "-xerror", "-i", p, "-f", "null", "-"]); return {"ok": r.returncode == 0, "errors": r.stderr.strip()[:300]}
def black(p):
    return re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", run(["ffmpeg", "-i", p, "-vf", "blackdetect=d=0.2:pic_th=0.98:pix_th=0.10", "-an", "-f", "null", "-"]).stderr)
def loud(p):
    e = run(["ffmpeg", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    return {"I": float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]), "LRA": float(re.findall(r"LRA:\s+([\d.]+) LU", e)[-1]), "TP": float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])}
def frame(p, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", p, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(R.H, R.W, 3)
def first_frame(p):
    f = frame(p, 0); text_zone = f[300:1000, 100:980]
    dark = float((text_zone.min(axis=2) < 60).mean())
    return {"std": round(float(f.std()), 1), "dark_text_pixels_in_upper_zone": round(dark, 4), "composed": bool(f.std() > 20 and dark > 0.01)}
def asr_check(p, lang):
    from faster_whisper import WhisperModel
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    m = WhisperModel("mobiuslabsgmbh/faster-whisper-large-v3-turbo", device="cpu", compute_type="int8")
    res = []
    for k in R.VOICE_AT:
        s = R.speech(k); e = R.speech_end(k)
        seg = x[int(max(0, s - 0.35) * 16000):int((e + 0.35) * 16000)]
        segs, _ = m.transcribe(np.concatenate([np.zeros(8000, np.float32), seg, np.zeros(8000, np.float32)]), language="ko", beam_size=5, condition_on_previous_text=False)
        txt = " ".join(sg.text.strip() for sg in segs); ok = "맞다" in re.sub(r"\s", "", txt).replace(",", "") or "맞다" in txt
        res.append({"line": k, "expected_at": round(s, 2), "heard": txt, "ok": bool(ok)})
    return res
def cue_check(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32); sr = 48000
    def rms(a, b): s = x[int(a * sr):int(b * sr)]; return 20 * np.log10(np.sqrt(np.mean(s * s)) + 1e-9)
    out = []
    for t, bus, f, g, w in R.AUDIO:
        pre, post = rms(max(0, t - 0.12), t), rms(t + 0.01, t + 0.20)
        out.append({"t": round(float(t), 2), "what": w, "pre_db": round(float(pre), 1), "post_db": round(float(post), 1), "rise_db": round(float(post - pre), 1)})
    return out
def sheet(p, out):
    return run(["ffmpeg", "-y", "-loglevel", "error", "-i", p, "-vf", "fps=2,scale=180:-1,tile=10x4", "-frames:v", "1", out]).returncode == 0
if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--file", required=True); ap.add_argument("--lang", default="en"); ap.add_argument("--outdir", required=True); ap.add_argument("--safe-json")
    a = ap.parse_args(); os.makedirs(a.outdir, exist_ok=True)
    name = os.path.basename(a.file); base = os.path.splitext(name)[0]
    cuts = [0, R.T_B2, R.T_B3, R.T_B4, R.T_B5, R.DUR]
    res = {"file": name, "probe": probe(a.file), "decode": decode(a.file), "black_segments": black(a.file), "loudness": loud(a.file),
           "first_frame": first_frame(a.file), "cuts": cuts, "longest_shot_s": round(max(b - c for b, c in zip(cuts[1:], cuts[:-1])), 2),
           "visual_change_points": sorted(set([round(v, 2) for v in [R.T_B2, R.T_B3, R.T_B4, R.T_B5] + [b for _, b, _ in R.BUBBLES] + R.SYL + [R.T_NOW, R.T_NICE, R.T_PUNCH, R.T_SEND] + [t for t, _ in R.CUTS]])),
           "cue_rise": cue_check(a.file), "sheet": base + "_시트.jpg" if sheet(a.file, os.path.join(a.outdir, base + "_시트.jpg")) else None}
    if a.safe_json and os.path.exists(a.safe_json): res["safe_zone"] = json.load(open(a.safe_json, encoding="utf-8"))
    res["asr"] = asr_check(a.file, a.lang)
    vc = res["visual_change_points"]; res["max_gap_between_visual_changes_s"] = round(max(b - c for b, c in zip(vc[1:] + [R.DUR], vc)), 2)
    json.dump(res, open(os.path.join(a.outdir, base + "_qa.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: res[k] for k in ("probe", "decode", "black_segments", "loudness", "first_frame", "longest_shot_s", "max_gap_between_visual_changes_s")}, ensure_ascii=False))
    for r in res["asr"]: print("ASR", r)
    for c in res["cue_rise"]: print("CUE", c)
