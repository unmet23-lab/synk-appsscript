# -*- coding: utf-8 -*-
"""창업자 인터뷰 세로 클립 · SNS 키트판(kit-v1)의 깨끗한 원본 영상·소리 만들기 (2026-10-01)

v2와 같은 구간·같은 화면(눈 추적 가로 따라가기, 900×1600 기본 / 782×1390 펀치 하드 컷)·같은 소리 처리(음량 고르기,
리미터, AAC 트루피크 보정 천장)를 그대로 쓰되, 제목·자막·이름표·엔드카드를 굽지 않는다. 글자와 끝 장은 HyperFrames
컴포지션(키트 kv-*·k-*)이 얹는다.

- v2 원본 스크립트(../v2/소스/make_clips_v2.py)는 고치지 않는다. 그 코드를 읽어 이 폴더의 작업 폴더(.work/)를 기준으로
  실행해 함수(render_shot·limiter·measure·load_audio_range 등)를 그대로 쓴다. v2 폴더에는 아무것도 쓰지 않는다.
- 샷 목록은 v2가 실제로 만든 기록(../v2/소스/<키>_build.json의 shot_log)을 따른다. 다시 계산한 계획과 같은지도 확인한다.
- 끝 장 자리(꼬리): 영상 끝 프레임을 그대로 멈춘 화면을 붙인다. D는 v2 엔드카드 3초 자리, 나머지는 END_SEC.
  끝 장 전환(종이·덮개) 동안 아래에 얼굴이 남아 있게 하려는 것이다. 소리는 v2와 같은 길이(꼬리는 무음).
- 결과(저장소에 넣지 않음): media/<키>.mp4(1080×1920 30fps H.264, 소리 없음), media/<키>.wav(48kHz 24bit)
- 결과(저장소에 넣음): data/<키>.json — 길이, 샷(하드 컷) 시각, 문장 시작 시각, 소리 측정값, v2 MP4와의 소리 대조

쓰는 법:  python make_clean_clips.py [A B ...] [--end-sec 2.8] [--audio-only]
4K 마스터(승인된 본편 v9)·눈 추적·본편 자막(C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/)이 있어야 한다. 원본은 읽기만 한다.
"""
import argparse, glob, hashlib, json, os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
V2_SRC = os.path.normpath(os.path.join(HERE, "..", "v2", "소스"))
V2_MP4_DIR = r"C:\Users\q1212\OneDrive\Desktop\SYNK_창업자_인터뷰_세로클립_v2"
WORK = os.path.join(HERE, ".work")            # v2 함수가 쓰는 out/·fonts/ 자리(저장소 제외)
MEDIA = os.path.join(HERE, "media")
DATA = os.path.join(HERE, "data")
for d in (WORK, MEDIA, DATA): os.makedirs(d, exist_ok=True)

# ---------- v2 코드를 이 폴더 기준으로 불러온다(원본 파일은 읽기만) ----------
_src_path = os.path.join(V2_SRC, "make_clips_v2.py")
_src = open(_src_path, encoding="utf-8").read()
V2 = {"__file__": os.path.join(WORK, "make_clips_v2.py"), "__name__": "make_clips_v2_kit"}
exec(compile(_src, _src_path, "exec"), V2)   # __name__이 "__main__"이 아니라 클립을 만들지 않는다
if not os.path.exists(V2["MASTER"]):
    print("4K 마스터가 없다:", V2["MASTER"]); raise SystemExit(2)
FPS, SR = V2["FPS"], V2["SR"]
run = V2["run"]

def render_shot(s0, s1, out_path, framing, n=None, fix_first=False):
    """v2 render_shot과 같은 필터·인코딩. 다만 ffmpeg 8 이후 -filter_script가 없어져 -/filter:v(파일에서 값 읽기)로 넘긴다.
    n: v2 기록의 프레임 수(기록의 필름 시각은 소수 셋째 자리로 반올림돼 있어 다시 계산하면 1프레임 어긋날 수 있다).
    fix_first: 첫 프레임이 앞 샷의 화면이면(필름 컷보다 한 프레임 일찍 자른 경우) 둘째 프레임으로 덮는다. 프레임 수는 같다."""
    cw, ch = V2["FRAMING"][framing]; n = n or int(round((s1 - s0) * FPS))
    vf = (f"crop={cw}:{ch}:x='{V2['crop_x_expr'](s0, s1, cw)}':y={V2['crop_y'](s0, s1, ch)},"
          f"scale={V2['OW']}:{V2['OH']}:flags=lanczos,fps={FPS},format=yuv420p")
    if fix_first: vf += ",trim=start_frame=1,setpts=PTS-STARTPTS,tpad=start=1:start_mode=clone"
    open(out_path + ".vf.txt", "w", encoding="utf-8").write(vf)
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{s0:.4f}", "-i", V2["MASTER"], "-/filter:v", out_path + ".vf.txt", "-frames:v", str(n),
         "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", out_path])
    return n

def sha12(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()[:12]

# 끝 장 자리(꼬리)에 멈춰 둘 프레임: 마지막 샷 끝에서 몇 프레임 앞인가. 끝 프레임이 눈 깜빡임이면 앞으로 당긴다(2026-10-02 D·E 확인)
FREEZE_BACK = {"D": 8, "E": 6}

def first_frame_flash(p):
    """첫 프레임만 다른 장면인지(앞 샷이 한 프레임 섞였는지) 본다."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-frames:v", "3", "-vf", "scale=54:96,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 96, 54).astype(float)
    if len(fr) < 3: return False
    return np.abs(fr[0] - fr[1]).mean() > 15 and np.abs(fr[1] - fr[2]).mean() < 6

def v2_mp4(key):
    hits = glob.glob(os.path.join(V2_MP4_DIR, f"SYNK_인터뷰_세로_v2_{key}_*.mp4"))
    return hits[0] if hits else None

# ---------- 소리: v2의 remaster_v2.py → fix_tp.py 순서를 그대로 ----------
def v2_audio(key, b):
    clip = V2["CLIPS"][key]
    n_total = sum(s["frames"] for s in b["shot_log"])
    parts, groups = [], []
    for t0, t1, kind in clip["segs"]:
        if groups and abs(groups[-1][1] - t0) < 1e-6: groups[-1][1] = t1
        else: groups.append([t0, t1])
    has_end = any(k == "endcard" for *_, k in clip["segs"])
    for i, (t0, t1) in enumerate(groups):
        x = V2["load_audio_range"](t0, t1); fi = int(0.025 * SR); fo = int((0.5 if (i == len(groups) - 1 and has_end) else 0.08) * SR)
        x[:fi] *= np.linspace(0, 1, fi)[:, None]; x[-fo:] *= np.linspace(1, 0, fo)[:, None]; parts.append(x)
    x = np.concatenate(parts); n = int(round(n_total / FPS * SR)); x = x[:n] if len(x) >= n else np.pad(x, ((0, n - len(x)), (0, 0)))
    I0, _ = V2["measure"](x); pick = None; last = None
    for target in (-14.0, -14.5, -15.0, -15.5):            # remaster_v2.py
        g = target - I0
        for it in range(6):
            y, st = V2["limiter"](x * 10 ** (g / 20), V2["CEIL_TP"]); I2, TP2 = V2["measure"](y)
            if abs(I2 - target) <= 0.1 and TP2 <= V2["CEIL_TP"] + 0.05: break
            g += target - I2
        cand = {"target": target, "I": I2, "TP": TP2, **st}
        if st["max_gr_db"] >= -4.0 and st["over3db_pct"] <= 0.5: pick = (y, cand); break
        last = (y, cand)
    y, cand = pick or last
    if cand["target"] != b["audio"]["target"]:
        print(f"  ! 음량 목표가 v2와 다르다: {cand['target']} / v2 {b['audio']['target']}")
    ceil = b["audio"].get("ceiling_dbtp")                    # fix_tp.py가 천장을 낮춘 클립(B·F)
    if ceil is not None:
        base = y.copy(); g = 0.0; target = cand["target"]
        for it in range(6):
            y, st = V2["limiter"](base * 10 ** (g / 20), ceil); I2, TP2 = V2["measure"](y)
            if abs(I2 - target) <= 0.1: break
            g += target - I2
        cand.update({"ceiling_dbtp": ceil, "I": I2, "TP": TP2, **st})
    return y, {"input_I": round(I0, 2), **cand}

def compare_with_v2(key, y):
    """v2 MP4의 소리(AAC)와 같은 소리인지 본다: 상관계수와 차이 신호 크기."""
    p = v2_mp4(key)
    if not p: return {"v2_mp4": None}
    ref = V2["load_audio"](p)
    n = min(len(ref), len(y)); a = y[:n, 0].astype(np.float64); r = ref[:n, 0].astype(np.float64)
    corr = float(np.corrcoef(a, r)[0, 1])
    diff_db = float(20 * np.log10(np.sqrt(np.mean((a - r) ** 2)) / max(np.sqrt(np.mean(r ** 2)), 1e-9)))
    return {"v2_mp4": os.path.basename(p), "v2_samples": len(ref), "kit_samples": len(y), "corr": round(corr, 5), "diff_db": round(diff_db, 1)}

# ---------- 문장 시작(펀치인 박자) ----------
def sentence_starts(key):
    clip = V2["CLIPS"][key]; out, offset = [], 0.0
    for (t0, t1, kind) in clip["segs"]:
        if kind == "crop":
            for c in V2["CAPTIONS"]:
                if t0 - 0.05 <= c["start"] < t1 - 0.3:
                    out.append(round(c["start"] - t0 + offset, 3))
        offset += t1 - t0
    return sorted(set(out))

# ---------- 한 클립 ----------
def build(key, end_sec, audio_only=False):
    b = json.load(open(os.path.join(V2_SRC, f"{key}_build.json"), encoding="utf-8"))
    clip = V2["CLIPS"][key]
    caps = V2["clip_captions"](clip); plan = V2["plan_shots"](clip, caps)
    same = len(plan) == len(b["shot_log"]) and all(abs(p[0] - s["film"][0]) < 2e-3 and abs(p[1] - s["film"][1]) < 2e-3 and p[2] == s["kind"] and p[3] == s["framing"] for p, s in zip(plan, b["shot_log"]))
    print(f"[{key}] v2 샷 기록 {len(b['shot_log'])}개, 다시 계산한 계획과 {'같음' if same else '다름(기록을 따른다)'}")
    crop = [s for s in b["shot_log"] if s["kind"] == "crop"]
    endcard = [s for s in b["shot_log"] if s["kind"] == "endcard"]
    speech_frames = sum(s["frames"] for s in crop)
    tail_frames = sum(s["frames"] for s in endcard) if endcard else int(round(end_sec * FPS))
    v2_frames = sum(s["frames"] for s in b["shot_log"])
    total_frames = speech_frames + tail_frames
    mp4 = os.path.join(MEDIA, f"{key}.mp4"); wav = os.path.join(MEDIA, f"{key}.wav"); fixed_first = []

    if not audio_only:
        files, fixed_first = [], []
        for i, s in enumerate(crop):
            p = os.path.join(WORK, f"{key}_clean{i:02d}.mp4")
            n = render_shot(s["film"][0], s["film"][1], p, s["framing"], n=s["frames"])
            if first_frame_flash(p):
                render_shot(s["film"][0], s["film"][1], p, s["framing"], n=s["frames"], fix_first=True)
                fixed_first.append(i); print(f"  ! 샷 {i} 첫 프레임이 앞 샷 화면이라 둘째 프레임으로 덮음(v2에도 있던 한 프레임 번쩍임)")
            files.append(p); print(f"  샷 {i:02d} {s['framing']:5s} {s['film']} {n}f")
        # 꼬리: 마지막 샷의 끝 프레임을 멈춘 화면(v2 render_endcard와 같은 인코딩 → concat 복사 가능)
        png = os.path.join(WORK, f"{key}_last.png")
        back = FREEZE_BACK.get(key, 0); idx = crop[-1]["frames"] - 1 - back
        run(["ffmpeg", "-y", "-v", "error", "-i", files[-1], "-vf", rf"select=eq(n\,{idx})", "-frames:v", "1", "-update", "1", "-q:v", "1", png])
        tail = os.path.join(WORK, f"{key}_tail.mp4")
        run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", png, "-frames:v", str(tail_frames), "-r", str(FPS), "-vf", "format=yuv420p",
             "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", tail])
        files.append(tail)
        lst = os.path.join(WORK, f"{key}_list.txt")
        open(lst, "w", encoding="utf-8").write("".join(f"file '{os.path.basename(p)}'\n" for p in files))
        run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
             "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
             "-movflags", "+faststart", mp4])

    y, ainfo = v2_audio(key, b)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", wav],
                   input=y.astype(np.float32).tobytes(), check=True)
    cmp = compare_with_v2(key, y)

    pr = json.loads(run(["ffprobe", "-v", "error", "-count_frames", "-show_entries", "stream=nb_read_frames,width,height,r_frame_rate:format=duration", "-of", "json", mp4]).stdout)
    vst = pr["streams"][0]
    shots = []
    for s in b["shot_log"]:
        shots.append({"t": round(s["clip_t"], 3), "framing": s["framing"] or "endcard", "film": s["film"]})
    info = {
        "key": key, "name": b["name"], "fps": FPS,
        "speech_sec": round(speech_frames / FPS, 3),      # 말이 있는 화면 길이(D는 v2 엔드카드 앞까지)
        "v2_sec": round(v2_frames / FPS, 3),               # v2 클립 길이(소리 길이)
        "total_sec": round(total_frames / FPS, 3),         # 컴포지션 길이 = 말 + 끝 장
        "end_start": round(speech_frames / FPS, 3),        # 끝 장 전환 시작
        "shots": shots,                                     # v2 하드 컷(기본 ↔ 1.15배 펀치)
        "sentences": sentence_starts(key),                 # 본편 v9 자막의 문장 시작(펀치인 박자 후보)
        "audio": ainfo, "audio_vs_v2": cmp,
        "first_frame_fixed_shots": fixed_first if not audio_only else None,
        "tail_freeze_back_frames": FREEZE_BACK.get(key, 0),
        "video": {"frames": int(vst.get("nb_read_frames", 0)), "w": vst["width"], "h": vst["height"], "fps": vst["r_frame_rate"],
                  "sec": round(float(pr["format"]["duration"]), 3), "MB": round(os.path.getsize(mp4) / 1048576, 1), "sha12": sha12(mp4)},
        "wav": {"sec": round(len(y) / SR, 3), "MB": round(os.path.getsize(wav) / 1048576, 1), "sha12": sha12(wav)},
        "sources": {"master": V2["MASTER"], "v2_build": f"../v2/소스/{key}_build.json", "v2_script": "../v2/소스/make_clips_v2.py"},
    }
    json.dump(info, open(os.path.join(DATA, f"{key}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"  → {key}: 영상 {info['video']['frames']}f/{total_frames}f {info['video']['MB']}MB · 소리 {info['wav']['sec']}s "
          f"I {ainfo['I']} TP {ainfo['TP']} · v2 대조 corr {cmp.get('corr')} 차 {cmp.get('diff_db')} dB")
    return info

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("keys", nargs="*")
    ap.add_argument("--end-sec", type=float, default=2.8); ap.add_argument("--audio-only", action="store_true")
    a = ap.parse_args()
    for k in (a.keys or list(V2["CLIPS"])):
        build(k, a.end_sec, a.audio_only)
