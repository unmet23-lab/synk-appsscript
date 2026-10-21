# -*- coding: utf-8 -*-
"""v16 Flow판 조립(1080x1920): Google Flow의 Veo 3.1 Quality 클립 여섯 개 + 렌즈 속 실제 게임(1080p로 새로 렌더)을 v15 순서로 잇는다.

A  출근길·안경 톡(얼굴)            A_veoQ      0~2.42초(클립 안 하드컷 전까지)
A2b 넓게 걷다 미끄러짐 → 멈춤       A2b_veoQ    A2B_IN~A2B_FREEZE, 그 프레임에서 시간이 멈춘다(FREEZE_HOLD초, 아주 느리게 밀기)
→ 방사형 휙 → 멈춘 얼굴(정지컷) → 렌즈 속 작은 화면 → 실제 게임(synk LAB HUD) → 빠져나옴   (v15와 같은 동작을 1080p로 렌더, 소리는 v15 그 구간)
→ 옆으로 휙 → B 까몽 깜빡          B_veoQ      0~B_END
→ 옆으로 휙 → B3 멈춘 세상에서 synk 건물로   B3_veoQ  B3_IN~끝, B3_SPEED배
→ 딱 → C 시간이 돌아와 넘어짐 → 카메라가 내려가 누운 얼굴   C_veoQ (가운데 카메라 이동만 C_MID_SPEED배)
→ 아래로 휙 → D synk 건물 → 입구, 하늘이 갠다   D_veoQ  0~D_END, D_SPEED배

쓰는 법: python build_v16_flow.py <클립 폴더> <v15.mp4> <멈춘 얼굴 정지컷.png> <게임 녹화.webm> <SYNK-LAB-Paper.png> <효과음 폴더> <작업 폴더> <결과.mp4>
클립 폴더의 <이름>_1080.mp4가 있으면 그것을, 없으면 <이름>_720.mp4를 쓴다(이름: A_veoQ A2b_veoQ B_veoQ B3_veoQ C_veoQ D_veoQ).
프레임을 메모리에 쌓지 않고 바로 인코더로 흘려보낸다(1080p 프레임 하나가 약 25MB).
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np

CLIPS, V15, STILL, GAME_WEBM, LOGO_LAB, SFX, WORK, OUT = sys.argv[1:9]
env = os.environ.get
W, H = int(env("W", "1080")), int(env("H", "1920"))
FPS, SR = int(env("FPS", "24")), 48000   # Veo 원본이 24fps라 그대로 24fps로 낸다(30fps로 늘리면 4프레임마다 반복)
S = W / 480.0                      # v15(480x854) 좌표를 이 해상도로 옮기는 배율
os.makedirs(WORK, exist_ok=True)


def fenv(k, d):
    v = env(k, "")
    return float(v) if v else d


def clip(name):
    for suf in ("_1080.mp4", "_720.mp4"):
        p = os.path.join(CLIPS, name + suf)
        if os.path.exists(p):
            return p
    raise SystemExit("클립 없음: " + name)


def duration(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                         capture_output=True, text=True).stdout
    return float(out.strip())


def has_audio(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", p],
                         capture_output=True, text=True).stdout
    return bool(out.strip())


def frames(p, t0, t1, speed=1.0):
    """t0~t1 구간을 speed배로 30fps W x H 프레임(float32 BGR)으로 하나씩 내준다."""
    vf = "setpts=PTS/%.4f,fps=%d,scale=%d:%d:flags=lanczos,setsar=1" % (speed, FPS, W, H)
    pr = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", "%.3f" % t0, "-t", "%.3f" % (t1 - t0), "-i", p, "-vf", vf,
                           "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        b = pr.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.float32)
    pr.wait()


def first_frame(p, t=0.0):
    return next(frames(p, t, t + 0.2))


def atempo(speed):
    parts = []
    while speed > 2.0:
        parts.append("atempo=2.0")
        speed /= 2.0
    parts.append("atempo=%.4f" % speed)
    return ",".join(parts)


def audio(p, t0, t1, speed=1.0, nframes=None):
    n = int(round((nframes / FPS) * SR)) if nframes is not None else int(round((t1 - t0) / speed * SR))
    out = np.zeros((n, 2), np.float32)
    if not has_audio(p):
        return out
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "%.3f" % t0, "-t", "%.3f" % (t1 - t0), "-i", p, "-vn",
                          "-af", atempo(speed), "-ar", str(SR), "-ac", "2", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2)
    out[:min(n, len(a))] = a[:n]
    return out


def sfx(name):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(SFX, name + ".wav"), "-ar", str(SR), "-ac", "2",
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2)


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def zoom(img, s, cx, cy, tx=None, ty=None):
    if tx is None:
        tx, ty = cx, cy
    M = np.float32([[s, 0, tx - s * cx], [0, s, ty - s * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def radial_blur(img, cx, cy, k, n=16):
    if k <= 0:
        return img
    acc = np.zeros_like(img)
    for i in range(n):
        acc += zoom(img, 1 + k * i / (n - 1), cx, cy)
    return acc / n


def shift(img, ox):
    return cv2.warpAffine(img, np.float32([[1, 0, ox], [0, 1, 0]]), (W, H), borderMode=cv2.BORDER_REFLECT)


def dir_blur(img, dx, n=20):
    acc = np.zeros_like(img)
    for i in range(n):
        acc += shift(img, dx * (i / (n - 1) - 0.5))
    return acc / n


def mix(a, b, t):
    return a * (1 - t) + b * t


# 색: v15와 같은 보정(약한 S커브, 들린 검정, 그림자는 차갑게·밝은 곳은 따뜻하게, 채도 조금 내림, 비네트, 그레인, 가벼운 선명화)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
RAD = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / np.sqrt(2)
VIG = (1 - 0.22 * np.clip(RAD, 0, 1) ** 2.2)[..., None]
del yy, xx, RAD
grain_rng = np.random.RandomState(3)


def grade(im):
    x = im / 255.0
    luma = (0.114 * x[..., 0] + 0.587 * x[..., 1] + 0.299 * x[..., 2])[..., None]
    x = 0.5 + (x - 0.5) * 1.06
    x = x + 0.012 * np.sin(2 * np.pi * np.clip(x, 0, 1))
    x = 0.010 + x * (1 - 0.010)
    sh = np.clip(1 - luma[..., 0] * 1.6, 0, 1)
    hi = np.clip(luma[..., 0], 0, 1) ** 2
    x[..., 0] += 0.014 * sh - 0.006 * hi
    x[..., 2] += -0.008 * sh + 0.010 * hi
    g = (0.114 * x[..., 0] + 0.587 * x[..., 1] + 0.299 * x[..., 2])[..., None]
    x = g + (x - g) * 0.93
    blur = cv2.GaussianBlur(x, (0, 0), 1.2)
    x = np.clip(x + 0.16 * (x - blur), 0, 1.2)
    x = x * VIG
    x = x + grain_rng.normal(0, 1.3 / 255.0, (H, W, 1)).astype(np.float32)
    return (x * 255.0).clip(0, 255)


# ---------- 출력: 색 보정 후 바로 인코더로 ----------
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "%dx%d" % (W, H), "-r", str(FPS),
                        "-i", "-", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p",
                        os.path.join(WORK, "video_only.mp4")], stdin=subprocess.PIPE)
state = {"n": 0, "last": None}
aud, ev, marks = [], [], []
thumbs = {}


def put(im, keep_thumb=False):
    enc.stdin.write(grade(im).astype(np.uint8).tobytes())
    state["last"] = im
    state["n"] += 1


CLIP_GAIN = {}


def clip_gain(name):
    # 같은 클립의 조각들은 같은 크기로: 클립 전체 소리의 RMS를 0.05로 맞추는 배율
    if name not in CLIP_GAIN:
        p = clip(name)
        a = audio(p, 0.0, duration(p))
        r = float(np.sqrt((a ** 2).mean())) if len(a) else 0.0
        CLIP_GAIN[name] = fenv("AMB_RMS", 0.12) / r if r > 1e-5 else 1.0
    return CLIP_GAIN[name]


def piece(name, t0, t1, speed=1.0, label=None, gain=1.0):
    p = clip(name)
    start = state["n"]
    if label:
        marks.append((start / FPS, label))
    for f in frames(p, t0, t1, speed):
        put(f)
    k = state["n"] - start
    a = audio(p, t0, t1, speed, nframes=k) * clip_gain(name)
    aud.append((start, a * gain))
    print("%-9s %.2f~%.2f x%.2f → %d프레임 (%.2f~%.2f초)" % (name, t0, t1, speed, k, start / FPS, state["n"] / FPS))
    return k


# ---------- 렌즈 속 실제 게임: v15와 같은 동작을 이 해상도로 렌더 ----------
def lens_segment():
    gdir = os.path.join(WORK, "game%d" % H)
    if not os.path.exists(os.path.join(gdir, "g_080.png")):
        os.makedirs(gdir, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "20.40", "-i", GAME_WEBM, "-t", "2.8",
                        "-vf", "fps=30,scale=-2:%d,crop=%d:%d" % (H, W, H), os.path.join(gdir, "g_%03d.png")], check=True)

    def game(n):
        return cv2.imread(os.path.join(gdir, "g_%03d.png" % n)).astype(np.float32)

    ST = cv2.imdecode(np.fromfile(STILL, np.uint8), cv2.IMREAD_COLOR).astype(np.float32)
    LX, LY, LW, LH = [float(v) for v in env("LENS", "860,1165,180,150").split(",")]
    FX, FY, FW = [float(v) for v in env("FACE", "650,1290,1100").split(",")]
    PH = LH * fenv("PANEL_H", 0.62)
    PW = PH * 9.0 / 16.0
    PX, PY = LX + fenv("PANEL_DX", 15), LY + fenv("PANEL_DY", -5)
    mask = np.zeros((H, W), np.float32)
    r = int(0.08 * W)
    cv2.rectangle(mask, (r, 0), (W - r, H), 1, -1)
    cv2.rectangle(mask, (0, r), (W, H - r), 1, -1)
    for c in ((r, r), (W - r, r), (r, H - r), (W - r, H - r)):
        cv2.circle(mask, c, r, 1, -1)
    mask = cv2.GaussianBlur(mask, (0, 0), 1.5 * S)

    lab = cv2.imdecode(np.fromfile(LOGO_LAB, np.uint8), cv2.IMREAD_UNCHANGED).astype(np.float32)
    ys, xs = np.where(lab[..., 3] > 8)
    lab = lab[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    hw = int(150 * S)
    hud = cv2.resize(lab, (hw, int(hw * lab.shape[0] / lab.shape[1])), interpolation=cv2.INTER_AREA)

    def add_hud(im, k):
        if k <= 0:
            return im
        x0, y0, pad = int(20 * S), int(26 * S), int(12 * S)
        h, w = hud.shape[:2]
        out = im.copy()
        out[y0 - pad:y0 + h + pad, x0 - pad:x0 + w + pad] *= (1 - 0.38 * k)
        a = (hud[..., 3:4] / 255.0) * k
        out[y0:y0 + h, x0:x0 + w] = out[y0:y0 + h, x0:x0 + w] * (1 - a) + hud[..., :3] * a
        return out

    def still_frame(cx, cy, cw, pa=0.0, g=None, blur=0.0):
        s = W / cw
        M = np.float32([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]])
        base = cv2.warpAffine(ST, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        if pa > 0 and g is not None:
            x0 = s * (PX - PW / 2) + M[0, 2]
            y0 = s * (PY - PH / 2) + M[1, 2]
            gs = (PW * s) / W
            A = np.float32([[gs, 0, x0], [0, gs, y0]])
            gg = cv2.warpAffine(g, A, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
            mk = cv2.warpAffine(mask, A, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
            glow = cv2.GaussianBlur(mk, (0, 0), max(1.0, 8 * gs * S))
            base = base + (glow * pa * 0.30)[..., None] * np.float32([255, 228, 196])
            a = (mk * pa * 0.92)[..., None]
            base = base * (1 - a) + gg * a
        if blur > 0:
            base = radial_blur(base, W / 2, H / 2, blur)
        return base.clip(0, 255)

    G_DIVE, G_FULL, G_EXIT = 16, 30, 60
    N_HOLD, N_IN, N_FULL, N_OUT = 20, 16, 24, 12
    cx0, cy0, cw0 = FX + (LX - FX) * 0.35, FY + (LY - FY) * 0.35, FW * 0.78
    for i in range(N_HOLD):
        u = smooth(i / float(N_HOLD - 1))
        cx, cy = FX + (cx0 - FX) * u, FY + (cy0 - FY) * u
        cw = FW * 1.15 * (cw0 / (FW * 1.15)) ** u
        pa = 0.35 * smooth((i - N_HOLD * 0.45) / (N_HOLD * 0.55))
        yield still_frame(cx, cy, cw, pa, game(G_DIVE))
    for i in range(N_IN):
        u = (i + 1) / float(N_IN)
        e = u ** 2.2
        cx, cy = cx0 + (PX - cx0) * smooth(u * 1.3), cy0 + (PY - cy0) * smooth(u * 1.3)
        cw = float(np.exp(np.log(cw0) + (np.log(PW * 0.985) - np.log(cw0)) * e))
        pa = 0.35 + 0.65 * smooth(u * 1.6)
        gf = game(G_DIVE + i)
        im = still_frame(cx, cy, cw, pa, gf, blur=0.10 * float(np.sin(np.pi * u)))
        if i >= N_IN - 3:
            k = (i - (N_IN - 3) + 1) / 3.0
            im = (mix(im, gf, smooth(k)) + 55 * float(np.sin(np.pi * k))).clip(0, 255)
        yield im
    for k in range(N_FULL):
        hk = min(1.0, k / 3.0) * min(1.0, (N_FULL - 1 - k) / 3.0)
        yield add_hud(game(G_FULL + 6 + k), hk)
    for j in range(N_OUT):
        u = (j + 1) / float(N_OUT)
        e = 1 - (1 - u) ** 2.2
        cx, cy = PX + (cx0 - PX) * smooth(u), PY + (cy0 - PY) * smooth(u)
        cw = float(np.exp(np.log(PW * 0.985) + (np.log(cw0 * 1.1) - np.log(PW * 0.985)) * e))
        pa = 1.0 - 0.72 * smooth(u)
        gf = game(G_EXIT + j)
        im = still_frame(cx, cy, cw, pa, gf, blur=0.08 * float(np.sin(np.pi * u)))
        if j < 2:
            im = mix(gf, im, (j + 1) / 3.0)
        yield im
    for j in range(4):
        yield still_frame(cx0, cy0, cw0 * 1.1, 0.28, game(G_EXIT + N_OUT + j))


def resample(gen, src_fps=30):
    # 30fps로 설계한 렌즈 구간을 FPS에 맞춰 고른다
    k = 0
    for i, f in enumerate(gen):
        while int(round(k * src_fps / float(FPS))) == i:
            yield f
            k += 1


# ===== A 출근길·안경 톡 =====
piece("A_veoQ", 0.0, fenv("A_END", 57.5 / 24.0), 1.0, "출근길 · 안경 톡")
# ===== A2b 넓게 걷다 미끄러짐 → 시간이 멈춘다 =====
A2B_IN, A2B_FREEZE = fenv("A2B_IN", 0.8), fenv("A2B_FREEZE", 2.95)
piece("A2b_veoQ", A2B_IN, A2B_FREEZE, 1.0, "넓게 · 미끄러진다")
frz = state["last"]
i_freeze = state["n"]
marks.append((i_freeze / FPS, "시간이 멈춘다"))
NH = int(round(fenv("FREEZE_HOLD", 0.30) * FPS))
for i in range(NH):
    put(zoom(frz, 1 + 0.015 * smooth(i / max(1, NH - 1)), W / 2, H * 0.45))
frz2 = state["last"]
# 방사형 휙 → 멈춘 얼굴 정지컷
seg = resample(lens_segment())
s0 = next(seg)
px, py = fenv("FRZ_PX", W * 0.40), fenv("FRZ_PY", H * 0.30)
ev.append((state["n"] - 3, "whoosh_up", 0.5))
put(radial_blur(zoom(frz2, 1.25, px, py), px, py, 0.30))
put(mix(radial_blur(zoom(frz2, 1.8, px, py), px, py, 0.55), radial_blur(zoom(s0, 1.3, W / 2, H * 0.45), W / 2, H * 0.45, 0.5), 0.35))
put(mix(radial_blur(zoom(frz2, 2.4, px, py), px, py, 0.60), radial_blur(zoom(s0, 1.12, W / 2, H * 0.45), W / 2, H * 0.45, 0.35), 0.75))
put(radial_blur(zoom(s0, 1.04, W / 2, H * 0.45), W / 2, H * 0.45, 0.12))
i_lens = state["n"]
marks.append((i_lens / FPS, "멈춘 얼굴 · 렌즈 속 실제 게임"))
aud.append((i_lens, audio(V15, 153 / 30.0, 229 / 30.0)))
put(s0)
for f in seg:
    put(f)
print("렌즈 구간 %d프레임" % (state["n"] - i_lens))
# 옆으로 휙 → B 까몽 깜빡
b0 = first_frame(clip("B_veoQ"))
f_last = state["last"]
ev.append((state["n"], "whoosh_side", 0.45))
put(dir_blur(shift(f_last, -24 * S), 60 * S))
put(mix(dir_blur(shift(f_last, -100 * S), 190 * S), dir_blur(shift(b0, 100 * S), 190 * S), 0.3))
put(mix(dir_blur(shift(f_last, -100 * S), 190 * S), dir_blur(shift(b0, 100 * S), 190 * S), 0.7))
put(dir_blur(shift(b0, 24 * S), 60 * S))
i_b = state["n"]
piece("B_veoQ", 0.0, fenv("B_END", 1.35), 1.0, "까몽 깜빡")
ev.append((i_b + int(fenv("B_BLINK", 0.55) * FPS), "ring", 0.10))
# 옆으로 휙 → B3 멈춘 세상에서 synk 건물로
B3_IN, B3_SPEED = fenv("B3_IN", 3.4), fenv("B3_SPEED", 1.25)
b3 = first_frame(clip("B3_veoQ"), B3_IN)
f_last = state["last"]
ev.append((state["n"], "whoosh_side", 0.45))
put(dir_blur(shift(f_last, -24 * S), 60 * S))
put(mix(dir_blur(shift(f_last, -100 * S), 190 * S), dir_blur(shift(b3, 100 * S), 190 * S), 0.3))
put(mix(dir_blur(shift(f_last, -100 * S), 190 * S), dir_blur(shift(b3, 100 * S), 190 * S), 0.7))
put(dir_blur(shift(b3, 24 * S), 60 * S))
piece("B3_veoQ", B3_IN, duration(clip("B3_veoQ")) - 0.05, B3_SPEED, "멈춘 세상에서 synk 건물로")
# 딱 → C 시간이 돌아와 넘어짐 → 누운 얼굴
i_snap = state["n"]
ev.append((i_snap - int(1.2 * FPS), "riser", 0.45))
ev.append((i_snap, "snap", 0.6))
C1, C2, C_MID = fenv("C_SPLIT1", 2.6), fenv("C_SPLIT2", 5.0), fenv("C_MID_SPEED", 1.5)
dC = duration(clip("C_veoQ"))
piece("C_veoQ", 0.0, C1, 1.0, "딱, 시간이 돌아와 넘어진다")
if env("C_THUD"):
    ev.append((i_snap + int(float(env("C_THUD")) * FPS), "thud", 0.5))
piece("C_veoQ", C1, C2, C_MID, "카메라가 내려간다")
piece("C_veoQ", C2, min(dC - 0.05, fenv("C_END", dC)), 1.0, "누워서 하늘을 본다")
# 아래로 휙 → D 건물 → 입구
ev.append((state["n"] - 2, "whoosh_down", 0.18))
piece("D_veoQ", 0.0, fenv("D_END", 7.0), fenv("D_SPEED", 1.75), "synk 건물 · 입구")
for _ in range(6):
    put(state["last"])
enc.stdin.close()
enc.wait()

# ---------- 소리: 클립 소리(크기 맞춤) + v15 렌즈 구간 소리 + 효과음, 멈춘 순간은 조용히 ----------
N = state["n"]
total = int(N / FPS * SR) + SR
buf = np.zeros((total, 2), np.float32)
for start, a in aud:
    s = int(start / FPS * SR)
    e = min(total, s + len(a))
    buf[s:e] += a[:e - s]
for i, name, g in ev:
    a = sfx(name) * g
    s = max(0, int(i / FPS * SR))
    e = min(total, s + len(a))
    buf[s:e] += a[:e - s]
buf = buf[:int(N / FPS * SR)]
# 크기: 거의 최고점(99.5%)을 0.5에 맞추고, 그 위는 부드럽게 눌러 0.95를 넘지 않게
p995 = float(np.percentile(np.abs(buf), 99.5)) or 1.0
buf *= min(4.0, 0.37 / p995)
buf = 0.70 * np.tanh(buf / 0.70)          # AAC로 굳힐 때 최고점이 3dB쯤 튀어 0.70(약 -3dB)에서 누른다
wav = os.path.join(WORK, "mix.f32")
buf.astype(np.float32).tofile(wav)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(WORK, "video_only.mp4"), "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", wav,
                "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", OUT], check=True)
json.dump({"frames": N, "seconds": N / FPS, "marks": marks, "events": ev, "W": W, "H": H},
          open(os.path.join(WORK, "map.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("완성", OUT, "%.2f초" % (N / FPS))
