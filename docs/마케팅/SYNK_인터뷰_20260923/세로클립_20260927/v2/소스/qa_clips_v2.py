# -*- coding: utf-8 -*-
"""v2 클립 검수 — 규격·색 태그·레벨·전체 디코딩·음량·트루피크, 첫 프레임, 자막·제목의 안전 영역(자막만 검은 바탕에 그려 픽셀로 잰다),
첫 5초 컷 수, 프레임 시트. 결과: out/qa_v2.json"""
import sys, os, json, re, subprocess, glob
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "out")
SAFE = (65, 269, 1015, 1248)
def run(cmd, **kw): return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
def probe(p):
    j = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,level,refs,width,height,r_frame_rate,nb_frames,pix_fmt,color_space,color_primaries,color_transfer,color_range,sample_rate,channels,bit_rate:format=duration,size", "-of", "json", p]).stdout)
    o = {"duration": float(j["format"]["duration"]), "MB": round(int(j["format"]["size"]) / 1048576, 1)}
    for s in j["streams"]:
        if s["codec_type"] == "video": o["video"] = {k: s.get(k) for k in ("profile", "level", "refs", "width", "height", "r_frame_rate", "nb_frames", "color_space", "color_primaries", "color_transfer")}
        else: o["audio"] = {k: s.get(k) for k in ("codec_name", "sample_rate", "channels", "bit_rate")}
    return o
def loud(p):
    e = run(["ffmpeg", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    return {"I": float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]), "LRA": float(re.findall(r"LRA:\s+([\d.]+) LU", e)[-1]), "TP": float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])}
def text_bounds(key, dur):
    """ASS만 검은 화면에 4fps로 그려 글자 픽셀의 상자를 잰다(그림자·외곽선 포함)."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:r=4:d={dur:.2f}", "-vf", f"ass={key}.ass:fontsdir=../fonts",
                        "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, cwd=OUT).stdout
    fr = np.frombuffer(r, np.uint8).reshape(-1, 1920, 1080); worst = None; bad = []
    for i, f in enumerate(fr):
        ys, xs = np.where(f > 24)
        if not len(xs): continue
        box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        if box[0] < SAFE[0] or box[1] < SAFE[1] or box[2] > SAFE[2] or box[3] > SAFE[3]: bad.append((round(i / 4, 2), box))
        worst = box if worst is None else (min(worst[0], box[0]), min(worst[1], box[1]), max(worst[2], box[2]), max(worst[3], box[3]))
    return {"union_box": worst, "violations": bad[:5], "violation_frames": len(bad)}
res = {}
for p in sorted(glob.glob(os.path.join(OUT, "clip_*.mp4"))):
    key = os.path.basename(p)[5:-4]; b = json.load(open(os.path.join(OUT, f"{key}_build.json"), encoding="utf-8"))
    d = probe(p); dec = run(["ffmpeg", "-v", "error", "-xerror", "-i", p, "-f", "null", "-"]).returncode == 0
    item = {"name": b["name"], "probe": d, "decode_ok": dec, "loudness": loud(p), "cuts_in_first_5s": b["cuts_in_first_5s"], "shots": b["shots"],
            "limiter": {k: b["audio"][k] for k in ("max_gr_db", "over3db_pct")}, "text": text_bounds(key, d["duration"])}
    run(["ffmpeg", "-y", "-v", "error", "-i", p, "-vf", "fps=1,scale=216:-1,tile=8x6", "-frames:v", "1", os.path.join(OUT, f"{key}_시트.jpg")])
    res[key] = item
    print(key, json.dumps({"dur": d["duration"], "level": d["video"]["level"], "color": [d["video"]["color_space"], d["video"]["color_primaries"], d["video"]["color_transfer"]],
                           "decode": dec, "loud": item["loudness"], "cuts5": b["cuts_in_first_5s"], "text_box": item["text"]["union_box"], "viol": item["text"]["violation_frames"]}, ensure_ascii=False))
json.dump(res, open(os.path.join(OUT, "qa_v2.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
