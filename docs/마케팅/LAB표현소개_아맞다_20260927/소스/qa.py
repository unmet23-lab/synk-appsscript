# -*- coding: utf-8 -*-
"""기술 검수 — 전체 디코딩, 검은 구간, 음량(EBU R128), 트루피크, 프레임 시트. 결과는 JSON."""
import sys, os, json, subprocess, re, argparse
sys.stdout.reconfigure(encoding="utf-8")
def run(cmd): return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
def probe(p):
    r = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration,size", "-of", "json", p])
    j = json.loads(r.stdout); out = {"duration": float(j["format"]["duration"]), "bytes": int(j["format"]["size"])}
    for s in j["streams"]:
        if s["codec_type"] == "video": out.update({"video": s["codec_name"], "size": [s["width"], s["height"]], "fps": s["r_frame_rate"], "frames": int(s.get("nb_frames", 0))})
        else: out.update({"audio": s["codec_name"], "sample_rate": s.get("sample_rate"), "channels": s.get("channels")})
    return out
def decode(p):
    r = run(["ffmpeg", "-v", "error", "-xerror", "-i", p, "-f", "null", "-"])
    return {"ok": r.returncode == 0, "errors": r.stderr.strip()[:500]}
def black(p):
    r = run(["ffmpeg", "-i", p, "-vf", "blackdetect=d=0.3:pic_th=0.98:pix_th=0.10", "-an", "-f", "null", "-"])
    return re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr)
def loud(p):
    r = run(["ffmpeg", "-i", p, "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=json", "-f", "null", "-"])
    j = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1]); return {k: float(j[k]) for k in ("input_i", "input_tp", "input_lra", "input_thresh")}
def sheet(p, out, fps=1, cols=8, w=200):
    r = run(["ffmpeg", "-y", "-loglevel", "error", "-i", p, "-vf", f"fps={fps},scale={w}:-1,tile={cols}x3", out]); return r.returncode == 0
if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("files", nargs="+"); ap.add_argument("--outdir", required=True); a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True); res = {}
    for p in a.files:
        name = os.path.basename(p); s = os.path.join(a.outdir, os.path.splitext(name)[0] + "_시트.jpg")
        res[name] = {"probe": probe(p), "decode": decode(p), "black_segments": black(p), "loudness": loud(p), "sheet": sheet(p, s) and os.path.basename(s)}
        print(name, json.dumps(res[name], ensure_ascii=False)[:400])
    json.dump(res, open(os.path.join(a.outdir, "qa.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
