# -*- coding: utf-8 -*-
"""승인된 SYNK 창업자 인터뷰 v9(4K60 16:9)에서 세로 1080x1920 클립을 만든다.

- 화면: 4K 마스터의 위쪽 972x1728 영역(굽힌 자막 띠 y>=1743 제외)을 눈 추적 좌표 중심으로 잘라 1080x1920으로 키운다.
  컷 안에서는 1초 간격 키프레임을 선형 보간해 부드럽게 따라가고, 컷 경계에서는 바로 바꾼다.
- 자막: revision8/captions.json(승인본 말자막 원문·시간)을 세로 화면용 크기로 다시 얹는다.
- 제목: 클립 전체에 상단 훅 제목, 처음 4초 이름표.
- 소리: 승인본 최종 믹스를 그대로 잘라 쓰고 경계에만 짧은 페이드.
- 브랜드 엔딩(D): 4K 엔딩의 글자·로고 영역을 잘라 가운데에 놓는다.
"""
import json, os, subprocess, sys, glob, shutil
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
BASE = r"C:\Users\q1212\Videos\SYNK_Premium_Interview_20260925"
MASTER = BASE + r"\revision9\render\SYNK_Founder_Film_4K60_v9.mp4"
TRACK = BASE + r"\revision9\tracking"
CAPS = BASE + r"\revision8\captions.json"
PLAN = BASE + r"\revision8\edit_plan.json"
WORK = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(WORK, "out")
os.makedirs(OUT, exist_ok=True)

CW, CH = 972, 1728          # 4K에서 자르는 크기 (9:16, 굽힌 자막 띠 위쪽)
OW, OH = 1080, 1920
OUT_FPS = 30
XMAX = 3840 - CW
YELLOW = r"{\c&H4DD8FF&}"   # #FFD84D
WHITE = r"{\c&HFFFFFF&}"

# ---------- 눈 추적 좌표 (최종 v8/v9 타임라인 4K 픽셀) ----------
N_FRAMES = 14266
eye_x = np.full(N_FRAMES, np.nan)
for f in glob.glob(os.path.join(TRACK, "cut_*.npz")):
    z = np.load(f)
    fi = z["frame_index"]
    det = z["detected"].astype(bool)
    c = z["iris_center"].reshape(len(fi), 2, 2).mean(axis=1)
    ok = det & np.isfinite(c[:, 0])
    eye_x[fi[ok]] = c[ok, 0]

plan = json.load(open(PLAN, encoding="utf-8"))
CUTS = [(c["output_start"], c["output_end"], c["id"], c["kind"]) for c in plan["cuts"]]
CAPTIONS = json.load(open(CAPS, encoding="utf-8"))


def crop_x_expr(t0, t1):
    """세그먼트 [t0,t1] 동안의 crop x(t) 표현식. t는 세그먼트 시작 기준 초."""
    pieces = []
    for cs, ce, cid, kind in CUTS:
        s, e = max(cs, t0), min(ce, t1)
        if e - s <= 1e-6:
            continue
        f0, f1 = int(round(s * 60)), int(round(e * 60))
        xs = eye_x[f0:f1]
        valid = np.isfinite(xs)
        if valid.sum() < 5:
            cf0, cf1 = int(round(cs * 60)), int(round(ce * 60))
            cx = eye_x[cf0:cf1]
            cx = cx[np.isfinite(cx)]
            center = float(np.median(cx)) if len(cx) else 1920.0
            x = min(max(center - CW / 2, 0), XMAX)
            pieces.append((e - t0, f"{x:.1f}"))
            continue
        times = list(np.arange(s, e, 1.0))
        if len(times) == 0 or e - times[-1] > 0.3:
            times.append(e)
        else:
            times[-1] = e
        keys = []
        for tk in times:
            a, b = int(round(max(s, tk - 0.6) * 60)), int(round(min(e, tk + 0.6) * 60))
            w = eye_x[a:b]
            w = w[np.isfinite(w)]
            xc = float(np.median(w)) if len(w) else float(np.nanmedian(xs))
            keys.append((tk - t0, min(max(xc - CW / 2, 0), XMAX)))
        expr = f"{keys[-1][1]:.1f}"
        for (ta, xa), (tb, xb) in reversed(list(zip(keys[:-1], keys[1:]))):
            seg = f"({xa:.1f}+({xb - xa:.1f})*(t-{ta:.3f})/{max(tb - ta, 0.001):.3f})"
            expr = f"if(lt(t,{tb:.3f}),{seg},{expr})"
        pieces.append((e - t0, expr))
    full = pieces[-1][1]
    for end, ex in reversed(pieces[:-1]):
        full = f"if(lt(t,{end:.3f}),{ex},{full})"
    return full


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print("FFMPEG ERROR:", " ".join(cmd)[:400])
        print(r.stderr[-3000:])
        raise SystemExit(1)
    return r


def render_segment(t0, t1, out_path, mode):
    if mode == "crop":
        vf = (f"crop={CW}:{CH}:x='{crop_x_expr(t0, t1)}':y=0,"
              f"scale={OW}:{OH}:flags=lanczos,fps={OUT_FPS},format=yuv420p")
    elif mode == "ending":
        # 4K 엔딩 글자(x1393-2438,y915-1183)와 로고 영역을 잘라 1080x600으로, 세로 가운데 배치
        vf = ("crop=1440:800:1200:700,scale=1080:600:flags=lanczos,"
              f"pad=1080:1920:0:660:black,fps={OUT_FPS},format=yuv420p")
    else:
        raise ValueError(mode)
    script = out_path + ".vf.txt"
    open(script, "w", encoding="utf-8").write(vf)
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t0:.4f}", "-t", f"{t1 - t0:.4f}", "-i", MASTER,
         "-filter_script:v", script, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15",
         "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", out_path])


def extract_audio(t0, t1, out_path, fade_in=0.025, fade_out=0.08):
    d = t1 - t0
    af = f"afade=t=in:st=0:d={fade_in},afade=t=out:st={max(0.0, d - fade_out):.4f}:d={fade_out}"
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t0:.4f}", "-t", f"{d:.4f}", "-i", MASTER, "-vn",
         "-af", af, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", out_path])


def normalize_audio(in_wav, out_wav, target_i=-16.0, target_tp=-1.0):
    """두 단계 loudnorm(선형 이득만). 믹스 밸런스는 바꾸지 않고 전체 음량만 맞춘다."""
    r = run(["ffmpeg", "-y", "-v", "info", "-i", in_wav, "-af",
             f"loudnorm=I={target_i}:TP={target_tp}:LRA=11:print_format=json", "-f", "null", "-"])
    m = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])
    af = (f"loudnorm=I={target_i}:TP={target_tp}:LRA=11:linear=true:"
          f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    run(["ffmpeg", "-y", "-v", "error", "-i", in_wav, "-af", af, "-ar", "48000", "-c:a", "pcm_s24le", out_wav])
    return m


ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,SUIT SemiBold,78,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,4,2,8,60,60,300,1
Style: Cap,SUIT SemiBold,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,4,2,2,70,70,470,1
Style: Name,SUIT Medium,36,&H00DDDDDD,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,1,8,60,60,520,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ts(sec):
    sec = max(0.0, sec)
    h = int(sec // 3600); m = int((sec % 3600) // 60); s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_ass(clip, total, title_end, out_path):
    lines = [ASS_HEAD]
    lines.append(f"Dialogue: 0,{ts(0)},{ts(title_end)},Title,,0,0,0,,{clip['title']}\n")
    lines.append(f"Dialogue: 0,{ts(0)},{ts(4.0)},Name,,0,0,0,,양유호 · SYNK 창업자\n")
    offset = 0.0
    for (t0, t1, mode) in clip["segs"]:
        if mode == "crop":
            for c in CAPTIONS:
                if c["end"] <= t0 or c["start"] >= t1:
                    continue
                a = max(c["start"], t0) - t0 + offset
                b = min(c["end"], t1) - t0 + offset
                if b - a < 0.15:
                    continue
                text = c["text"].replace("\n", r"\N")
                lines.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{text}\n")
        offset += (t1 - t0)
    open(out_path, "w", encoding="utf-8").write("".join(lines))


CLIPS = {
    "A": dict(name="A_AI에_끌려간다", segs=[(114.35, 131.10, "crop")],
              title=f"AI 쓰다 보면\\N{YELLOW}진짜 끌려가게 돼요"),
    "B": dict(name="B_TOPIK에_도움_안되면_쓰레기", segs=[(52.17, 93.03, "crop")],
              title=f"TOPIK에 도움이 안 된다면\\N{YELLOW}사실 쓰레기니까"),
    "C": dict(name="C_잘만들었다_했는데_평가는", segs=[(145.08, 177.70, "crop")],
              title=f"잘 만들었다 했는데\\N{YELLOW}막상 평가는 되게 나쁘고"),
    "D": dict(name="D_기술이_만들어준_시간", segs=[(196.05, 227.7667, "crop"), (227.7667, 237.7667, "ending")],
              title=f"기술이 만들어 준 시간,\\N{YELLOW}사람은 어디에 써야 할까요?"),
    "E": dict(name="E_한명한명_케어하고_싶은데", segs=[(12.0, 49.17, "crop")],
              title=f"한 명 한 명 다 케어하고 싶은데\\N{YELLOW}시간이 부족하더라고요"),
    "F": dict(name="F_조종하는건_AI가_아니라_사람", segs=[(0.0, 9.0, "crop"), (107.63, 114.27, "crop")],
              title=f"누구나 압도적으로 만드는 시대\\N{YELLOW}조종하는 건 AI가 아니라 사람"),
}


def build_clip(key, remux_only=False):
    clip = CLIPS[key]
    segs = clip["segs"]
    seg_files, aud_files = [], []
    contiguous = all(abs(segs[i][1] - segs[i + 1][0]) < 1e-3 for i in range(len(segs) - 1))
    vcat = os.path.join(OUT, f"{key}_video.mp4")
    ap = os.path.join(OUT, f"{key}_audio.wav")
    if not remux_only:
        for i, (t0, t1, mode) in enumerate(segs):
            vp = os.path.join(OUT, f"{key}_seg{i}.mp4")
            render_segment(t0, t1, vp, mode)
            seg_files.append(vp)
        if contiguous:
            extract_audio(segs[0][0], segs[-1][1], ap)
        else:
            for i, (t0, t1, mode) in enumerate(segs):
                ap_i = os.path.join(OUT, f"{key}_aud{i}.wav")
                extract_audio(t0, t1, ap_i)
                aud_files.append(ap_i)
            lst = os.path.join(OUT, f"{key}_alist.txt")
            open(lst, "w", encoding="utf-8").write("".join(f"file '{os.path.basename(p)}'\n" for p in aud_files))
            run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", ap])
        # video concat
        lst = os.path.join(OUT, f"{key}_vlist.txt")
        open(lst, "w", encoding="utf-8").write("".join(f"file '{os.path.basename(p)}'\n" for p in seg_files))
        run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", vcat])
    # 음량: 선형 이득으로 -16 LUFS / TP -1.0 (믹스 밸런스 무변경)
    ap_norm = os.path.join(OUT, f"{key}_audio_norm.wav")
    measured = normalize_audio(ap, ap_norm)
    json.dump(measured, open(os.path.join(OUT, f"{key}_loudnorm_measured.json"), "w"), indent=1)
    total = sum(t1 - t0 for t0, t1, m in segs)
    title_end = sum(t1 - t0 for t0, t1, m in segs if m == "crop")
    ass_path = os.path.join(OUT, f"{key}.ass")
    build_ass(clip, total, title_end, ass_path)
    final = os.path.join(OUT, f"clip_{key}.mp4")
    vf_script = os.path.join(OUT, f"{key}_final.vf.txt")
    open(vf_script, "w", encoding="utf-8").write(f"ass={key}.ass:fontsdir=../fonts")
    cwd = os.getcwd(); os.chdir(OUT)
    try:
        run(["ffmpeg", "-y", "-v", "error", "-i", f"{key}_video.mp4", "-i", f"{key}_audio_norm.wav",
             "-filter_script:v", f"{key}_final.vf.txt", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
             "-shortest", f"clip_{key}.mp4"])
    finally:
        os.chdir(cwd)
    print(f"[{key}] done: {final}  ({total:.2f}s)  input_I={measured['input_i']} → -16 LUFS")
    return final


if __name__ == "__main__":
    args = sys.argv[1:]
    remux = "--remux" in args
    keys = [a for a in args if not a.startswith("--")] or list(CLIPS.keys())
    for k in keys:
        build_clip(k, remux_only=remux)
