# -*- coding: utf-8 -*-
"""SYNK 창업자 인터뷰 세로 클립 v2 — 2026-09 릴스 기준 재편집 (v1: 2026-09-27 오전).

v1 대비 바뀐 것
- 글자 전부 메타 통합 9:16 안전 영역(위 269·아래 672·좌우 65px) 안. v1 자막 아래끝은 y=1450이었다.
- 기본 화면을 900×1600(4K)으로 조금 좁혀 얼굴을 올렸다. 제목(위)·얼굴·자막(아래)이 영역 안에서 겹치지 않는다.
  굽힌 자막 띠(4K y≥1743) 위만 쓰는 조건은 그대로다.
- 첫 5초 안 컷 간격 1.5초 안팎: 자막 조각 경계에서 1.15배 펀치인 하드 컷을 번갈아 둔다. 그 뒤는 2.4초 이상 간격.
- 자막: 승인 문장 그대로, 한 줄 12자 이하 조각으로 나눠 크게(SUIT ExtraBold 70). 제목의 노란 줄과 같은 문장은 노랑.
- B: 결론(28초)이 늦어 「4급이 없으면…」 + 「결국 학생들에게…」로 줄였다(41→23초).
- D: 「마지막으로 정리해 보면」을 빼고 시작, 10초 엔딩 대신 세로 전용 3초 엔드카드(같은 문구·같은 로고). 그 아래로 「감사합니다」가 이어진다.
- 소리: 승인본 믹스를 자르고 −14 LUFS · 트루피크 −1.5 dBTP(4배 오버샘플 룩어헤드 리미터).
- 인코딩: H.264 High 레벨 4.1 · 참조 4 · BT.709 태그 · AAC 256k 스테레오."""
import json, os, subprocess, sys, glob, re, shutil, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.signal import resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d
sys.stdout.reconfigure(encoding="utf-8")

BASE = r"C:\Users\q1212\Videos\SYNK_Premium_Interview_20260925"
MASTER = BASE + r"\revision9\render\SYNK_Founder_Film_4K60_v9.mp4"
TRACK = BASE + r"\revision9\tracking"
CAPS = BASE + r"\revision8\captions.json"
PLAN = BASE + r"\revision8\edit_plan.json"
REPO = r"C:\Users\q1212\Documents\SYNK-appsscript"
WORK = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(WORK, "out"); FONTS = os.path.join(WORK, "fonts")
os.makedirs(OUT, exist_ok=True); os.makedirs(FONTS, exist_ok=True)
for f in ["SUIT-ExtraBold.otf", "SUIT-SemiBold.otf", "SUIT-Medium.otf"]:
    if not os.path.exists(os.path.join(FONTS, f)):
        shutil.copy(os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", f), os.path.join(FONTS, f))

OW, OH, FPS = 1080, 1920, 30
SUB_TOP = 1740                     # 4K 굽힌 자막 띠(y≥1743) 위로만 자른다
FRAMING = {"base": (900, 1600), "punch": (782, 1390)}   # 1.15배 펀치인
EYE_REL = 0.323                    # 출력 화면에서 눈 높이 비율(제목 아래·자막 위에 얼굴이 서게)
SAFE = (65, 269, 1015, 1248)
YELLOW = r"{\c&H4DD8FF&}"          # #FFD84D
SR = 48000
TARGET_I, CEIL_TP = -14.0, -1.5

# ---------- 눈 추적(4K, 60fps 타임라인) ----------
N_FRAMES = 14266
eye_x = np.full(N_FRAMES, np.nan); eye_y = np.full(N_FRAMES, np.nan)
for f in glob.glob(os.path.join(TRACK, "cut_*.npz")):
    z = np.load(f); fi = z["frame_index"]; det = z["detected"].astype(bool)
    c = z["iris_center"].reshape(len(fi), 2, 2).mean(axis=1)
    ok = det & np.isfinite(c[:, 0]) & np.isfinite(c[:, 1])
    eye_x[fi[ok]] = c[ok, 0]; eye_y[fi[ok]] = c[ok, 1]
plan = json.load(open(PLAN, encoding="utf-8"))
FILM_CUTS = [(c["output_start"], c["output_end"]) for c in plan["cuts"]]
CAPTIONS = json.load(open(CAPS, encoding="utf-8"))

CLIPS = {
    "A": dict(name="A_AI에_끌려간다", segs=[(114.35, 131.10, "crop")],
              title=f"AI 쓰다 보면\\N{YELLOW}진짜 끌려가게 돼요", key="진짜 끌려가게 돼요."),
    "B": dict(name="B_TOPIK에_도움_안되면_쓰레기", segs=[(56.90, 61.23, "crop"), (74.25, 93.03, "crop")],
              title=f"TOPIK에 도움이 안 된다면\\N{YELLOW}사실 쓰레기니까", key="사실 쓰레기니까."),
    "C": dict(name="C_잘만들었다_했는데_평가는", segs=[(145.08, 177.70, "crop")],
              title=f"잘 만들었다 했는데\\N{YELLOW}막상 평가는 되게 나쁘고", key="막상 평가는 되게 나쁘고"),
    "D": dict(name="D_기술이_만들어준_시간", segs=[(198.20, 225.43, "crop"), (225.43, 228.43, "endcard")],
              title=f"기술이 만들어 준 시간,\\N{YELLOW}사람은 어디에 써야 할까요?", key="사람은 온전히 느끼고 경험하고"),
    "E": dict(name="E_한명한명_케어하고_싶은데", segs=[(12.0, 49.17, "crop")],
              title=f"한 명 한 명 다 케어하고 싶은데\\N{YELLOW}시간이 부족하더라고요", key="물리적인 시간이 부족하더라고요."),
    "F": dict(name="F_조종하는건_AI가_아니라_사람", segs=[(0.0, 9.0, "crop"), (107.63, 114.27, "crop")],
              title=f"누구나 압도적으로 만드는 시대\\N{YELLOW}조종하는 건 AI가 아니라 사람", key="AI가 아니라 사람이잖아요."),
}

def q(t): return round(round(t * FPS) / FPS, 6)   # 30fps 격자
def run(cmd, cwd=None):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=cwd)
    if r.returncode != 0:
        print("FFMPEG ERROR:", " ".join(cmd)[:300]); print(r.stderr[-2500:]); raise SystemExit(1)
    return r

# ---------- 자막 조각 ----------
_font_cache = {}
def text_w(text, size, face="SUIT-ExtraBold.otf"):
    k = (face, size)
    if k not in _font_cache: _font_cache[k] = ImageFont.truetype(os.path.join(FONTS, face), size)
    return _font_cache[k].getlength(re.sub(r"\{[^}]*\}", "", text))
def norm(s): return re.sub(r"[\s\"“”‘’'.,?!…·]", "", s)
# 뒤 낱말을 꾸미는 말 — 조각 끝에 홀로 남기지 않는다(「안 / 된다면」, 「이 / 시간을」 같은 끊김 방지)
LEAD = {"이", "그", "저", "안", "못", "잘", "더", "꼭", "좀", "다", "또", "한", "두", "세", "네", "각", "몇", "새", "어떤", "무슨",
        "그런", "이런", "저런", "아주", "너무", "정말", "진짜", "되게", "가장", "제일", "많은", "모든", "내", "제", "그냥", "막상", "사실",
        "최소", "결국", "확실하게", "할"}
def chunk_caption(text, maxc=12):
    words = text.replace("\n", " ").split(); chunks, cur = [], []
    for w in words:
        if cur and len(norm("".join(cur + [w]))) > maxc:
            carry = []
            while len(cur) > 1 and norm(cur[-1]) in LEAD and not re.search(r"[,.?!…”]$", cur[-1]):
                carry.insert(0, cur.pop())
            chunks.append(cur); cur = carry + [w]
        else: cur.append(w)
    if cur: chunks.append(cur)
    return chunks
def color_words(words, cap_norm_start, key_rng):
    """단어별로 노랑 여부를 정해 ASS 문자열로. key_rng: 캡션 정규화 문자열 안 (시작, 끝)."""
    out, pos = [], cap_norm_start
    for w in words:
        n = len(norm(w)); a, b = pos, pos + n; pos = b
        yellow = key_rng is not None and n > 0 and a < key_rng[1] and b > key_rng[0]
        out.append((YELLOW + w + r"{\c&HFFFFFF&}") if yellow else w)
    return " ".join(out)

def clip_captions(clip):
    """클립 시간 기준 [(시작, 끝, ASS 글자)] — 승인 문장 그대로 조각만 나눈다."""
    res, offset = [], 0.0
    key_n = norm(clip["key"])
    for (t0, t1, kind) in clip["segs"]:
        for c in CAPTIONS:
            if c["end"] <= t0 or c["start"] >= t1: continue
            a = max(c["start"], t0) - t0 + offset; b = min(c["end"], t1) - t0 + offset
            if b - a < 0.15: continue
            text = c["text"].replace("\n", " ")
            cn = norm(text); k0 = cn.find(key_n); key_rng = (k0, k0 + len(key_n)) if k0 >= 0 else None
            chunks = chunk_caption(text, 8 if a < 5.0 else 12)   # 첫 5초는 더 짧게 — 컷 후보가 늘어난다
            weights = [max(1, len(norm(" ".join(ws)))) for ws in chunks]
            tot = sum(weights); t = a; pos = 0
            for ws, wgt in zip(chunks, weights):
                d = (b - a) * wgt / tot
                res.append([t, t + d, color_words(ws, pos, key_rng)]); pos += len(norm("".join(ws))); t += d
        offset += (t1 - t0)
    merged = []   # 0.45초보다 짧은 조각은 앞 조각에 붙인다
    for r in res:
        if merged and (r[1] - r[0]) < 0.45 and abs(merged[-1][1] - r[0]) < 0.05 and len(norm(merged[-1][2] + r[2])) <= 16:
            merged[-1][1] = r[1]; merged[-1][2] += " " + r[2]
        else: merged.append(r)
    return merged

# ---------- 샷 계획(펀치인) ----------
def plan_shots(clip, caps):
    shots, clip_t = [], 0.0
    bounds = sorted(set(round(c[0], 3) for c in caps))
    framing = "base"; last = 0.0; first = True
    for (t0, t1, kind) in clip["segs"]:
        seg_len = t1 - t0; s_clip, e_clip = clip_t, clip_t + seg_len
        if kind == "endcard":
            shots.append([t0, t1, "endcard", None]); clip_t = e_clip; continue
        if not first:
            framing = "punch" if framing == "base" else "base"; last = s_clip
        first = False
        cur_start = s_clip
        for b in bounds:
            if not (s_clip + 0.3 < b < e_clip - 0.8): continue
            if b - last >= (1.2 if b < 5.0 else 2.2):
                shots.append([t0 + (cur_start - s_clip), t0 + (b - s_clip), "crop", framing])
                framing = "punch" if framing == "base" else "base"; last = b; cur_start = b
        shots.append([t0 + (cur_start - s_clip), t1, "crop", framing]); clip_t = e_clip
    return shots

# ---------- 화면 ----------
def crop_x_expr(s0, s1, cw):
    XMAX = 3840 - cw; pieces = []
    for cs, ce in FILM_CUTS:
        s, e = max(cs, s0), min(ce, s1)
        if e - s <= 1e-6: continue
        f0, f1 = int(round(s * 60)), int(round(e * 60)); xs = eye_x[f0:f1]; valid = np.isfinite(xs)
        if valid.sum() < 5:
            cx = eye_x[int(round(cs * 60)):int(round(ce * 60))]; cx = cx[np.isfinite(cx)]
            center = float(np.median(cx)) if len(cx) else 1920.0
            pieces.append((e - s0, f"{min(max(center - cw / 2, 0), XMAX):.1f}")); continue
        times = list(np.arange(s, e, 1.0))
        if len(times) == 0 or e - times[-1] > 0.3: times.append(e)
        else: times[-1] = e
        keys = []
        for tk in times:
            a, b = int(round(max(s, tk - 0.6) * 60)), int(round(min(e, tk + 0.6) * 60))
            w = eye_x[a:b]; w = w[np.isfinite(w)]
            xc = float(np.median(w)) if len(w) else float(np.nanmedian(xs))
            keys.append((tk - s0, min(max(xc - cw / 2, 0), XMAX)))
        if len(keys) == 1: expr = f"{keys[0][1]:.1f}"
        else:
            expr = f"{keys[-1][1]:.1f}"
            for (ta, xa), (tb, xb) in reversed(list(zip(keys[:-1], keys[1:]))):
                expr = f"if(lt(t,{tb:.3f}),({xa:.1f}+({xb - xa:.1f})*(t-{ta:.3f})/{max(tb - ta, 0.001):.3f}),{expr})"
        pieces.append((e - s0, expr))
    full = pieces[-1][1]
    for end, ex in reversed(pieces[:-1]): full = f"if(lt(t,{end:.3f}),{ex},{full})"
    return full
def crop_y(s0, s1, ch):
    ys = eye_y[int(round(s0 * 60)):int(round(s1 * 60))]; ys = ys[np.isfinite(ys)]
    e = float(np.median(ys)) if len(ys) else 660.0
    y = int(round(min(max(e - EYE_REL * ch, 0), SUB_TOP - ch)))
    return y - (y % 2)
def render_shot(s0, s1, out_path, framing):
    cw, ch = FRAMING[framing]; n = int(round((s1 - s0) * FPS))
    vf = f"crop={cw}:{ch}:x='{crop_x_expr(s0, s1, cw)}':y={crop_y(s0, s1, ch)},scale={OW}:{OH}:flags=lanczos,fps={FPS},format=yuv420p"
    open(out_path + ".vf.txt", "w", encoding="utf-8").write(vf)
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{s0:.4f}", "-i", MASTER, "-filter_script:v", out_path + ".vf.txt", "-frames:v", str(n),
         "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", out_path])
    return n
def render_endcard(out_path, dur):
    img = Image.new("RGB", (OW, OH), (5, 5, 5)); d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(os.path.join(FONTS, "SUIT-Medium.otf"), 46); f2 = ImageFont.truetype(os.path.join(FONTS, "SUIT-SemiBold.otf"), 64)
    for txt, f, y, col in [("각자의 목표에 맞는", f1, 700, (190, 190, 190)), ("개인화 기술을 만듭니다.", f2, 772, (245, 245, 245))]:
        w = d.textlength(txt, font=f); d.text(((OW - w) / 2, y), txt, font=f, fill=col)
    logo = Image.open(os.path.join(REPO, "docs", "홍보물", "마케팅실행_20260909", "브랜드킷", "배치용", "SYNK-Paper.png")).convert("RGBA")
    logo = logo.crop(logo.getbbox()); lw = 440; logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, ((OW - lw) // 2, 930), logo)
    png = out_path + ".png"; img.save(png); n = int(round(dur * FPS))
    run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", png, "-frames:v", str(n), "-r", str(FPS), "-vf", "format=yuv420p",
         "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", out_path])
    return n

# ---------- 소리 ----------
def load_audio(path, ch=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()
def measure(x):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[1]), "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode("utf-8", "replace")
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", p)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", p)[-1])
def limiter(x, ceil_db, look=0.004, rel=0.08):
    over = np.max(np.abs(np.stack([resample_poly(x[:, c], 4, 1) for c in range(x.shape[1])], axis=1)), axis=1)
    peak = over[: (len(over) // 4) * 4].reshape(-1, 4).max(axis=1); peak = np.pad(peak, (0, len(x) - len(peak)), mode="edge")
    need = np.minimum(1.0, 10 ** (ceil_db / 20) / np.maximum(peak, 1e-9)); L = int(look * SR)
    g = minimum_filter1d(need, size=2 * L + 1, mode="nearest"); a = np.exp(-1.0 / (rel * SR)); out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]; out[i] = cur
    out = np.minimum(uniform_filter1d(out, size=int(0.001 * SR), mode="nearest"), g + 1e-6)
    grdb = 20 * np.log10(out)
    return x * out[:, None], {"max_gr_db": round(float(grdb.min()), 2), "over3db_pct": round(float((grdb < -3).mean() * 100), 3)}
def build_audio(clip, n_total):
    parts, segs = [], clip["segs"]
    groups = []   # 필름 시간으로 이어지는 구간은 한 번에 자른다
    for t0, t1, kind in segs:
        if groups and abs(groups[-1][1] - t0) < 1e-6: groups[-1][1] = t1
        else: groups.append([t0, t1])
    for i, (t0, t1) in enumerate(groups):
        x = load_audio_range(t0, t1)
        fi, fo = int(0.025 * SR), int((0.5 if (i == len(groups) - 1 and any(k == "endcard" for *_, k in segs)) else 0.08) * SR)
        x[:fi] *= np.linspace(0, 1, fi)[:, None]; x[-fo:] *= np.linspace(1, 0, fo)[:, None]
        parts.append(x)
    x = np.concatenate(parts); n = int(round(n_total / FPS * SR))
    x = x[:n] if len(x) >= n else np.pad(x, ((0, n - len(x)), (0, 0)))
    I0, _ = measure(x); g = TARGET_I - I0
    for it in range(6):
        y, st = limiter(x * 10 ** (g / 20), CEIL_TP); I2, TP2 = measure(y)
        if abs(I2 - TARGET_I) <= 0.1 and TP2 <= CEIL_TP + 0.05: break
        g += TARGET_I - I2
    return y, {"input_I": round(I0, 2), "gain_db": round(g, 2), "I": I2, "TP": TP2, **st}
def load_audio_range(t0, t1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0:.4f}", "-t", f"{t1 - t0:.4f}", "-i", MASTER, "-vn", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()

# ---------- ASS ----------
ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,SUIT ExtraBold,68,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,5,1,8,80,80,272,1
Style: Name,SUIT SemiBold,38,&H00F0F0F0,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,1,8,80,80,462,1
Style: Cap,SUIT ExtraBold,70,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,5,1,2,90,90,676,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
def ts(sec):
    sec = max(0.0, sec); h = int(sec // 3600); m = int((sec % 3600) // 60); s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"
def fit(text, size, maxw):
    """줄마다 폭을 재서 넘치면 그 줄만 \\fs로 줄인다."""
    lines = text.split("\\N"); out = []
    for ln in lines:
        s = size
        while text_w(ln, s) > maxw and s > 40: s -= 2
        out.append((f"{{\\fs{s}}}" if s != size else "") + ln)
    return "\\N".join(out)
def build_ass(clip, caps, total, speech_end, path):
    L = [ASS_HEAD, f"Dialogue: 0,{ts(0)},{ts(speech_end)},Title,,0,0,0,,{fit(clip['title'], 68, 900)}\n",
         f"Dialogue: 0,{ts(0)},{ts(3.5)},Name,,0,0,0,,양유호 · SYNK 창업자\n"]
    for a, b, text in caps:
        L.append(f"Dialogue: 0,{ts(a)},{ts(min(b, total))},Cap,,0,0,0,,{fit(text, 70, 880)}\n")
    open(path, "w", encoding="utf-8").write("".join(L))

# ---------- 한 클립 ----------
def build_clip(key):
    clip = CLIPS[key]; caps = clip_captions(clip); shots = plan_shots(clip, caps)
    files, n_total, clip_t, shot_log = [], 0, 0.0, []
    for i, (s0, s1, kind, framing) in enumerate(shots):
        p = os.path.join(OUT, f"{key}_shot{i:02d}.mp4")
        n = render_endcard(p, s1 - s0) if kind == "endcard" else render_shot(s0, s1, p, framing)
        files.append(p); shot_log.append({"clip_t": round(n_total / FPS, 3), "film": [round(s0, 3), round(s1, 3)], "kind": kind, "framing": framing, "frames": n}); n_total += n
    lst = os.path.join(OUT, f"{key}_vlist.txt"); open(lst, "w", encoding="utf-8").write("".join(f"file '{os.path.basename(p)}'\n" for p in files))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(OUT, f"{key}_video.mp4")])
    audio, ainfo = build_audio(clip, n_total)
    wav = os.path.join(OUT, f"{key}_audio.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", wav], input=audio.astype(np.float32).tobytes(), check=True)
    total = n_total / FPS
    speech_end = total - sum(s1 - s0 for s0, s1, k, f in shots if k == "endcard")
    build_ass(clip, caps, total, speech_end, os.path.join(OUT, f"{key}.ass"))
    open(os.path.join(OUT, f"{key}_final.vf.txt"), "w", encoding="utf-8").write(
        f"setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv,ass={key}.ass:fontsdir=../fonts")
    final = f"clip_{key}.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-i", f"{key}_video.mp4", "-i", f"{key}_audio.wav", "-filter_script:v", f"{key}_final.vf.txt",
         "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.1", "-refs", "4", "-preset", "slow", "-crf", "18",
         "-g", "60", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
         "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", final], cwd=OUT)
    first5 = [s["clip_t"] for s in shot_log if 0 < s["clip_t"] < 5.0]
    info = {"key": key, "name": clip["name"], "duration": round(total, 3), "shots": len(shot_log), "cuts_in_first_5s": first5,
            "audio": ainfo, "captions": len(caps), "shot_log": shot_log}
    json.dump(info, open(os.path.join(OUT, f"{key}_build.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({k: info[k] for k in ("key", "duration", "shots", "cuts_in_first_5s", "captions")}, ensure_ascii=False), "| audio", ainfo)
    return os.path.join(OUT, final)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("keys", nargs="*"); ap.add_argument("--plan-only", action="store_true")
    a = ap.parse_args(); keys = a.keys or list(CLIPS)
    for k in keys:
        if a.plan_only:
            caps = clip_captions(CLIPS[k]); shots = plan_shots(CLIPS[k], caps)
            print(k, "자막 조각", len(caps), "샷", len(shots))
            for c in caps[:8]: print("   ", round(c[0], 2), round(c[1], 2), c[2])
            t = 0
            for s in shots: print("    샷", round(t, 2), s[2], s[3], round(s[1] - s[0], 2)); t += s[1] - s[0]
        else:
            build_clip(k)
