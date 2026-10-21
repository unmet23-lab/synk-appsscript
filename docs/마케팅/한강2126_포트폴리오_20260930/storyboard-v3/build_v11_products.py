# -*- coding: utf-8 -*-
"""v11 오프닝: 기업 강조 + 전환·색·소리 다듬기.

    python build_v11_products.py <d판.mp4> <a판.mp4> <시작 클로즈업.mp4> <누운 컷.mp4> <건물로 날아가는 컷.mp4> <클락션.wav>
        <게임 녹화.webm> <게임 음악.mp3> <효과음 폴더> <SYNK 로고 Ink.png> <SYNK-LAB 로고 Paper.png> <작업 폴더> <결과.mp4>

흐름: 기기를 든 채 카메라를 보다 기기를 씀(얼굴·콘로우 보임) → 컷 → 미끄러짐 → 시간 멈춤(둥 울림) → 기기 속 실제 게임(synk LAB HUD)
→ 까몽 → 멈춘 세상에서 우리 건물로 날아갔다 돌아옴(상승음) → 딱, 시간이 돌아와 넘어짐(쿵) → 컷 → 누워서 하늘을 봄(얼굴)
→ 시선을 따라 하늘로 컷, 카메라가 내려오며 건물과 synk 간판, 하늘이 갬.
- 커피 접사는 없다. 전환은 하드컷(동작·충격·시선 맞춤) 위주이고, 휙 번짐은 카메라가 날아가는 자리 셋에만 짧게 둔다.
- 간판: 승인 로고(SYNK-Ink)를 건물 띠에 추적 합성. 색 보정·그레인·비네트는 전체에 같게.
환경 변수: E_START E_END E_ON F_END T_END T_SPEED A_REF T_REF SIGN_DEBUG
"""
import json, os, subprocess, sys
import cv2, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

(SRC_D, SRC_A, SRC_E, SRC_F, SRC_T, HORN_WAV, GAME_WEBM, MUSIC, SFX, LOGO_INK, LOGO_LAB, WORK, OUT) = sys.argv[1:14]
W, H, FPS, SR = 480, 854, 30, 48000
SPF = SR // FPS
GAME_T0 = 20.40
G_DIVE, G_FULL, G_EXIT = 16, 30, 60
N_DIVE, N_FULL, N_EXIT = 14, 24, 12
F_DIVE, F_EXIT = 100, 120
ZMAX = 1.8
D_IN = 21
env = os.environ.get
E_START, E_END, E_ON = int(env("E_START", "1")), int(env("E_END", "108")), int(env("E_ON", "66"))
F_END, T_END, T_SPEED = int(env("F_END", "60")), int(env("T_END", "112")), float(env("T_SPEED", "1.35"))
A_REF = [float(v) for v in env("A_REF", "255,420,88").split(",")]      # a판 394프레임의 간판 중심 x,y와 너비
T_REF_FRAME = int(env("T_REF_FRAME", "66"))
T_REF = [float(v) for v in env("T_REF", "215,450,85").split(",")]
SIGN_DEBUG = env("SIGN_DEBUG", "") == "1"


def run(*a):
    subprocess.run(a, check=True, capture_output=True)


for sub in ("srcD", "srcA", "srcE", "srcF", "srcT", "srcAS", "srcTS", "game", "out"):
    os.makedirs(WORK + "/" + sub, exist_ok=True)
for take, src in (("D", SRC_D), ("A", SRC_A), ("E", SRC_E), ("F", SRC_F), ("T", SRC_T)):
    if not os.path.exists(WORK + "/src%s/f_0030.png" % take):
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "fps=30,scale=480:854", WORK + "/src%s/f_%%04d.png" % take)
if not os.path.exists(WORK + "/game/g_080.png"):
    run("ffmpeg", "-v", "error", "-y", "-ss", str(GAME_T0), "-i", GAME_WEBM, "-t", "2.8",
        "-vf", "fps=30,scale=-2:854,crop=480:854", WORK + "/game/g_%03d.png")


def nframes(take):
    return len([f for f in os.listdir(WORK + "/src" + take) if f.endswith(".png")])


def load(n, take="D"):
    return cv2.imread("%s/src%s/f_%04d.png" % (WORK, take, n)).astype(np.float32)


def game(n):
    return cv2.imread("%s/game/g_%03d.png" % (WORK, n)).astype(np.float32)


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def zoom(img, s, cx, cy, tx=None, ty=None):
    if tx is None:
        tx, ty = cx, cy
    M = np.float32([[s, 0, tx - s * cx], [0, s, ty - s * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC if s > 1.5 else cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT)


def radial_blur(img, cx, cy, k, n=16):
    if k <= 0:
        return img
    acc = np.zeros_like(img)
    for i in range(n):
        acc += zoom(img, 1 + k * i / (n - 1), cx, cy)
    return acc / n


def shift(img, ox, oy=0):
    return cv2.warpAffine(img, np.float32([[1, 0, ox], [0, 1, oy]]), (W, H), borderMode=cv2.BORDER_REFLECT)


def dir_blur(img, dx, dy=0, n=20):
    acc = np.zeros_like(img)
    for i in range(n):
        f = i / (n - 1) - 0.5
        acc += shift(img, dx * f, dy * f)
    return acc / n


def visor_mask(im, thr=72, frac=0.85, erode=5, feather=8):
    g = cv2.cvtColor(im.clip(0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY)
    dark = (g < thr).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    ok = dark[:, int(W * 0.2):int(W * 0.8)].mean(axis=1) > frac
    best, cur, s0, b0 = 0, 0, 0, (0, 0)
    for y in range(H + 1):
        if y < H and ok[y]:
            if cur == 0:
                s0 = y
            cur += 1
        else:
            if cur > best:
                best, b0 = cur, (s0, y - 1)
            cur = 0
    y0, y1 = b0
    full = dark.mean(axis=1)
    y1e = y1
    while y1e + 1 < H and y1e - y1 < 90 and full[y1e + 1] > 0.40:
        y1e += 1
    reg = dark.copy()
    reg[:max(0, y0 - 2)] = 0
    reg[y1e + 1:] = 0
    num, lab, st, cen = cv2.connectedComponentsWithStats(reg, 8)
    comp = (lab == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)
    cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    fill = np.zeros_like(comp)
    cv2.drawContours(fill, cnts, -1, 1, -1)
    fill = cv2.morphologyEx(fill, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    fill = cv2.erode(fill, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode, erode)))
    x, y, w, h = cv2.boundingRect(fill)
    return cv2.GaussianBlur(fill.astype(np.float32), (0, 0), feather), (x + w / 2.0, y + h / 2.0)


def sky_mask(im, lum_min=150, std_max=9.0, sat_max=70, br_min=6, feather=6):
    im8 = im.clip(0, 255).astype(np.uint8)
    g = cv2.cvtColor(im8, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(im8, cv2.COLOR_BGR2HSV)
    mu = cv2.blur(g, (15, 15))
    std = np.sqrt(np.maximum(cv2.blur(g * g, (15, 15)) - mu * mu, 0))
    br = im[..., 0] - im[..., 2]
    cand = ((g > lum_min) & (std < std_max) & (hsv[..., 1] < sat_max) & (br > br_min)).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    num, lab = cv2.connectedComponents(cand, connectivity=4)
    top = set(np.unique(lab[:3, :]).tolist()) - {0}
    if not top:
        return np.zeros_like(g)
    m = np.isin(lab, list(top)).astype(np.float32)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    return cv2.GaussianBlur(m, (0, 0), feather)


SKY_TARGET = np.float32([222, 196, 172])
YG = (1 - 0.5 * (np.arange(H, dtype=np.float32) / H))[:, None, None]


def clear_sky(im, k):
    if k <= 0:
        return im
    m = sky_mask(im)
    br = im[..., 0] - im[..., 2]
    guard = np.clip(1 - (br - 20) / 30.0, 0, 1)
    w = (m * guard)[..., None] * YG * (0.55 * k)
    return im * (1 - w) + SKY_TARGET[None, None, :] * w


# ---------- 색 보정(전체 공통): 약한 S커브, 들린 검정, 그림자는 차갑게·밝은 곳은 따뜻하게, 채도 조금 내림, 비네트, 그레인 ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
RAD = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / np.sqrt(2)
VIG = (1 - 0.22 * np.clip(RAD, 0, 1) ** 2.2)[..., None]
grain_rng = np.random.RandomState(3)


def grade(im):
    x = im / 255.0
    luma = (0.114 * x[..., 0] + 0.587 * x[..., 1] + 0.299 * x[..., 2])[..., None]
    x = 0.5 + (x - 0.5) * 1.06                      # 대비 조금
    x = x + 0.012 * np.sin(2 * np.pi * np.clip(x, 0, 1)) / 1.0   # 약한 S커브
    x = 0.016 + x * (1 - 0.016)                     # 들린 검정
    sh = np.clip(1 - luma[..., 0] * 1.6, 0, 1)
    hi = np.clip(luma[..., 0], 0, 1) ** 2
    x[..., 0] += 0.014 * sh - 0.006 * hi            # B
    x[..., 2] += -0.008 * sh + 0.010 * hi           # R
    g = (0.114 * x[..., 0] + 0.587 * x[..., 1] + 0.299 * x[..., 2])[..., None]
    x = g + (x - g) * 0.93
    x = x * VIG
    x = x + grain_rng.normal(0, 2.1 / 255.0, (H, W, 1)).astype(np.float32)
    return (x * 255.0).clip(0, 255)


# ---------- 간판 합성: 기준 프레임의 사각형을 LK 추적으로 따라가며 승인 로고를 붙인다 ----------
def imread_any(p):
    # 한글 경로도 읽는다(BGRA)
    arr = np.fromfile(p, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)


logo = imread_any(LOGO_INK)
assert logo is not None and logo.shape[2] == 4
la = logo[..., 3]
ys, xs = np.where(la > 8)
logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
LOGO_AR = logo.shape[0] / float(logo.shape[1])
logo_small = cv2.resize(logo, (320, int(320 * LOGO_AR)), interpolation=cv2.INTER_AREA).astype(np.float32)


def track_similarity(take, ref, idx_list, roi):
    # ref 프레임의 roi(x0,y0,x1,y1) 안 특징점을 앞뒤로 추적해, 프레임마다 ref→idx 유사변환(2x3)을 돌려준다.
    out = {ref: np.float32([[1, 0, 0], [0, 1, 0]])}
    lk = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))

    def gray(n):
        return cv2.cvtColor(cv2.imread("%s/src%s/f_%04d.png" % (WORK, take, n)), cv2.COLOR_BGR2GRAY)

    for direction in (1, -1):
        seq_idx = [i for i in idx_list if (i > ref if direction > 0 else i < ref)]
        seq_idx.sort(reverse=(direction < 0))
        g_prev = gray(ref)
        M = np.float32([[1, 0, 0], [0, 1, 0]])
        mask = np.zeros_like(g_prev)
        mask[int(roi[1]):int(roi[3]), int(roi[0]):int(roi[2])] = 255
        pts = cv2.goodFeaturesToTrack(g_prev, 300, 0.01, 4, mask=mask, blockSize=7)
        for n in seq_idx:
            g_cur = gray(n)
            if pts is None or len(pts) < 12:
                # 추적점이 모자라면 현재 위치로 옮긴 roi에서 다시 뽑는다
                box = cv2.transform(np.float32([[[roi[0], roi[1]], [roi[2], roi[1]], [roi[2], roi[3]], [roi[0], roi[3]]]]), M)[0]
                mask = np.zeros_like(g_prev)
                cv2.fillPoly(mask, [box.astype(np.int32)], 255)
                pts = cv2.goodFeaturesToTrack(g_prev, 300, 0.01, 4, mask=mask, blockSize=7)
                if pts is None:
                    out[n] = M.copy(); g_prev = g_cur; continue
            p1, st, err = cv2.calcOpticalFlowPyrLK(g_prev, g_cur, pts, None, **lk)
            p0r, st2, _ = cv2.calcOpticalFlowPyrLK(g_cur, g_prev, p1, None, **lk)
            good = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm((pts - p0r).reshape(-1, 2), axis=1) < 1.0)
            a, b = pts[good], p1[good]
            if len(a) >= 6:
                S, inl = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=2.0)
                if S is not None:
                    M3 = np.vstack([M, [0, 0, 1]]); S3 = np.vstack([S, [0, 0, 1]])
                    M = (S3 @ M3)[:2].astype(np.float32)
                    pts = b[inl.ravel() == 1].reshape(-1, 1, 2) if inl is not None else b.reshape(-1, 1, 2)
                else:
                    pts = b.reshape(-1, 1, 2)
            else:
                pts = None
            out[n] = M.copy()
            g_prev = g_cur
    # 흔들림 완화: 변환 성분을 짧게 평균
    keys = sorted(out)
    arr = np.array([out[k].ravel() for k in keys])
    sm = arr.copy()
    for j in range(6):
        sm[:, j] = np.convolve(np.pad(arr[:, j], 2, mode="edge"), np.ones(5) / 5, mode="valid")
    return {k: sm[i].reshape(2, 3).astype(np.float32) for i, k in enumerate(keys)}


def composite_sign(im, M, cx, cy, width):
    # 기준 좌표의 간판 사각형(중심 cx,cy 너비 width)을 M으로 옮겨 로고를 얹는다.
    h = width * LOGO_AR
    sx = width / logo_small.shape[1]
    L = np.float32([[sx, 0, cx - width / 2], [0, sx, cy - h / 2]])      # 로고 픽셀 → 기준 프레임
    M3 = np.vstack([M, [0, 0, 1]]); L3 = np.vstack([L, [0, 0, 1]])
    A = (M3 @ L3)[:2]
    rgba = cv2.warpAffine(logo_small, A, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    a = (rgba[..., 3] / 255.0)
    # 장면 밝기에 맞춘다(펠트 띠의 평균 밝기 기준)
    band = a > 0.3
    if band.sum() > 20:
        ratio = float(np.clip((im[band].mean() / 255.0) / 0.78, 0.55, 1.1))
    else:
        ratio = 1.0
    col = rgba[..., :3] * ratio
    sh = cv2.GaussianBlur(np.roll(np.roll(a, 2, axis=0), 1, axis=1), (0, 0), 1.2) * 0.35
    out = im * (1 - sh[..., None])
    a3 = (a * 0.96)[..., None]
    return out * (1 - a3) + col * a3


def bake_sign(take, ref, idx_list, roi, quad, outdir):
    Ms = track_similarity(take, ref, idx_list, roi)
    for n in idx_list:
        im = load(n, take)
        cv2.imwrite("%s/f_%04d.png" % (outdir, n), composite_sign(im, Ms[n], quad[0], quad[1], quad[2]).clip(0, 255).astype(np.uint8))
    return Ms


A_IDX = list(range(394, nframes("A") + 1))
T_IDX = list(range(1, min(T_END + 2, nframes("T")) + 1))
if SIGN_DEBUG:
    os.makedirs(WORK + "/qa", exist_ok=True)
    bake_sign("A", 394, A_IDX, (150, 370, 360, 470), A_REF, WORK + "/srcAS")
    bake_sign("T", T_REF_FRAME, T_IDX, (90, 400, 330, 500), T_REF, WORK + "/srcTS")
    tiles = [cv2.imread("%s/srcAS/f_%04d.png" % (WORK, n)) for n in (394, 412, 430, 450)] + \
            [cv2.imread("%s/srcTS/f_%04d.png" % (WORK, n)) for n in (30, 50, 66, 80, 100)]
    cv2.imwrite(WORK + "/qa/sign_debug.jpg", np.hstack([cv2.resize(t, (300, 534)) for t in tiles]), [cv2.IMWRITE_JPEG_QUALITY, 90])
    print("sign debug written"); sys.exit(0)

if not os.path.exists("%s/srcAS/f_%04d.png" % (WORK, A_IDX[-1])):
    bake_sign("A", 394, A_IDX, (150, 370, 360, 470), A_REF, WORK + "/srcAS")
if not os.path.exists("%s/srcTS/f_%04d.png" % (WORK, T_IDX[-1])):
    bake_sign("T", T_REF_FRAME, T_IDX, (90, 400, 330, 500), T_REF, WORK + "/srcTS")

# ---------- 게임 HUD: 실제 게임처럼 왼쪽 위에 synk LAB ----------
lab = imread_any(LOGO_LAB).astype(np.float32)
la2 = lab[..., 3]
ys, xs = np.where(la2 > 8)
lab = lab[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
HUD_W = 150
hud = cv2.resize(lab, (HUD_W, int(HUD_W * lab.shape[0] / lab.shape[1])), interpolation=cv2.INTER_AREA)


def add_hud(im, k):
    if k <= 0:
        return im
    x0, y0 = 20, 26
    h, w = hud.shape[:2]
    out = im.copy()
    pad = 12
    panel = out[y0 - pad:y0 + h + pad, x0 - pad:x0 + w + pad]
    out[y0 - pad:y0 + h + pad, x0 - pad:x0 + w + pad] = panel * (1 - 0.38 * k)
    a = (hud[..., 3:4] / 255.0) * k
    out[y0:y0 + h, x0:x0 + w] = out[y0:y0 + h, x0:x0 + w] * (1 - a) + hud[..., :3] * a
    return out


seq = []   # (그림, (판, 프레임) 또는 None, 게임 보임 0..1)
events = []  # (출력 프레임 번호, 효과음 이름, 크기)


def nat(a, b, take="D", zfn=None):
    for n in range(a, b + 1):
        im = load(n, take)
        if zfn:
            im = zfn(im, n)
        seq.append((im, (take, n), 0.0))


def mix(a, b, t):
    return a * (1 - t) + b * t


def retime(take, a, b, speed_mid, ramp=0.25, src=None):
    n = b - a
    ts, pos = [], 0.0
    while pos <= n:
        ts.append(pos)
        u = pos / n
        w = smooth(u / ramp) if u < ramp else (smooth((1 - u) / ramp) if u > 1 - ramp else 1.0)
        pos += 1 + (speed_mid - 1) * w
    ld = (lambda k: cv2.imread("%s/f_%04d.png" % (src, k)).astype(np.float32)) if src else (lambda k: load(k, take))
    for p in ts:
        i0 = int(p)
        fr = p - i0
        im = ld(a + i0) if fr < 0.02 or a + i0 + 1 > b else mix(ld(a + i0), ld(a + i0 + 1), fr)
        seq.append((im, (take, a + i0), 0.0))


# S1 시작 클로즈업: 기기를 든 채 → 씀. 아주 느리게 밀고 들어간다.
nE = E_END - E_START
nat(E_START, E_END, "E", lambda im, n: zoom(im, 1 + 0.06 * smooth((n - E_START) / float(nE)), 240, 330))
i_e_on = [k for k in range(len(seq)) if seq[k][1] == ("E", E_ON)][0]
# T1 하드컷 → S2 넓은 미끄러짐
nat(D_IN, 44)
# T2 시간 멈춤: 짧은 확대 번짐으로 기기로 날아든다
events.append((len(seq) - 3, "whoosh_up", 0.5))
hd = (205, 325)
a = radial_blur(zoom(load(45), 1.7, hd[0], hd[1], 215, 380), 215, 380, 0.30)
b = radial_blur(zoom(load(46), 3.4, hd[0], hd[1], 225, 415), 225, 415, 0.60)
c = radial_blur(load(73), 230, 420, 0.40)
d = radial_blur(load(74), 230, 420, 0.18)
seq += [(a, ("D", 45), 0.0), (mix(b, c, 0.3), ("D", 46), 0.0), (mix(b, c, 0.7), ("D", 73), 0.0), (d, ("D", 74), 0.0)]
events.append((len(seq), "boom", 0.7)); events.append((len(seq), "ring", 0.22))
retime("D", 75, F_DIVE - 1, 1.6)
# S3 기기 속 게임
for i in range(N_DIVE):
    n = F_DIVE + i
    im = load(n)
    m, (cx, cy) = visor_mask(im)
    t = max(0.0, (i - 3) / float(N_DIVE - 4))
    z = 1 + (ZMAX - 1) * t * t
    p = (z - 1) / (ZMAX - 1)
    tx, ty = cx + (W / 2 - cx) * p, cy + (H / 2 - cy) * p
    base = zoom(im, z, cx, cy, tx, ty)
    mm = zoom(m, z, cx, cy, tx, ty)
    if i >= N_DIVE - 2:
        mm = np.maximum(mm, (i - (N_DIVE - 3)) / 2.0)
    al = smooth(i / float(N_DIVE - 3))
    g = zoom(game(G_DIVE + i), 0.82 + 0.18 * smooth(i / float(N_DIVE - 1)), W / 2, H / 2)
    w = np.clip(al * mm, 0, 1)[..., None]
    seq.append((base * (1 - w) + g * w, ("D", n), float(np.clip(al * mm.mean() * 1.4, 0, 1))))
i_game_full = len(seq)
for k in range(N_FULL):
    hk = min(1.0, k / 3.0) * min(1.0, (N_FULL - 1 - k) / 3.0)
    seq.append((add_hud(game(G_FULL + 6 + k), hk), None, 1.0))
events.append((i_game_full + 3, "horn_clear", 0.6))
for j in range(N_EXIT):
    n = F_EXIT + j
    im = load(n)
    m, (cx, cy) = visor_mask(im)
    q = min(1.0, j / 8.0)
    z = ZMAX - (ZMAX - 1) * (1 - (1 - q) ** 2)
    p = (z - 1) / (ZMAX - 1)
    tx, ty = cx + (W / 2 - cx) * p, cy + (H / 2 - cy) * p
    base = zoom(im, z, cx, cy, tx, ty)
    mm = zoom(m, z, cx, cy, tx, ty)
    if j <= 1:
        mm = np.maximum(mm, 1 - j / 2.0)
    al = 1 - smooth((j - 1) / float(N_EXIT - 2))
    g = zoom(game(G_EXIT + j), 1.0 - 0.18 * smooth(j / float(N_EXIT - 1)), W / 2, H / 2)
    w = np.clip(al * mm, 0, 1)[..., None]
    seq.append((base * (1 - w) + g * w, ("D", n), float(np.clip(al * mm.mean() * 1.4, 0, 1))))
retime("D", F_EXIT + N_EXIT, 145, 1.6)
# T3 옆으로 휙: 기기에서 어깨 뒤 까몽으로 (커피 없음)
events.append((len(seq), "whoosh_side", 0.45))
a = dir_blur(shift(load(146), -24), 60)
b = dir_blur(shift(load(147), -100), 190)
c = dir_blur(shift(load(186), 100), 190)
d = dir_blur(shift(load(187), 24), 60)
seq += [(a, ("D", 146), 0.0), (mix(b, c, 0.3), ("D", 147), 0.0), (mix(b, c, 0.7), ("D", 186), 0.0), (d, ("D", 187), 0.0)]
# S4 까몽
retime("D", 188, 228, 2.4)
nat(229, 238)
retime("D", 248, 261, 2.0)
# T4 옆으로 휙: 까몽에서 멈춘 세상 전체로, 그리고 우리 건물로 날아간다
events.append((len(seq), "whoosh_side", 0.45))
T1 = cv2.imread("%s/srcTS/f_%04d.png" % (WORK, 1)).astype(np.float32)
T2 = cv2.imread("%s/srcTS/f_%04d.png" % (WORK, 2)).astype(np.float32)
a = dir_blur(shift(load(261), -24), 60)
b = dir_blur(shift(load(262), -100), 190)
c = dir_blur(shift(T1, 100), 190)
d = dir_blur(shift(T2, 24), 60)
seq += [(a, ("D", 261), 0.0), (mix(b, c, 0.3), ("D", 262), 0.0), (mix(b, c, 0.7), ("T", 1), 0.0), (d, ("T", 2), 0.0)]
# S5 건물로 날아갔다 돌아온다(간판 합성본)
i_t0 = len(seq)
retime("T", 3, T_END, T_SPEED, src=WORK + "/srcTS")
i_t1 = len(seq)
events.append((max(i_t0, i_t1 - 36), "riser", 0.45))
# T5 딱: 시간이 돌아온다 → S6 넘어짐
events.append((len(seq), "snap", 0.6))
for k, n in enumerate(range(263, 266)):
    seq.append((zoom(load(n), 1.04 - 0.04 * k / 2.0, 240, 427), ("D", n), 0.0))
nat(266, 300)
i_land = [k for k in range(len(seq)) if seq[k][1] == ("D", 296)][0]
events.append((i_land, "thud", 0.7))
# T6 충격에 컷 → S7 누워서 하늘(얼굴)
nF = F_END - 1
nat(1, F_END, "F", lambda im, n: zoom(im, 1 + 0.05 * smooth((n - 1) / float(nF)), 240, 430))
# T7 시선 맞춤: 하늘로 컷 → 카메라가 내려오며 건물과 간판, 하늘이 갠다
events.append((len(seq), "whoosh_down", 0.18))
i_a0 = len(seq)
retime("A", 394, nframes("A"), 1.2, src=WORK + "/srcAS")
for k in range(i_a0, min(i_a0 + 27, len(seq))):
    u = smooth((k - i_a0) / 26.0)
    z = 1.6 - 0.6 * u
    cy = 150 + (427 - 150) * u
    seq[k] = (zoom(seq[k][0], z, 240, cy, 240, 427 - (427 - cy) * (1 - 0) ), seq[k][1], seq[k][2])

N = len(seq)
# 하늘: 시간이 돌아온 뒤부터 끝까지 조금씩 푸르게
i_ret = [k for k in range(N) if seq[k][1] == ("D", 263)][0]
for k in range(i_ret, N):
    gq = smooth((k - i_ret) / float(max(1, N - 20 - i_ret)))
    seq[k] = (clear_sky(seq[k][0], gq) * (1 + 0.04 * gq), seq[k][1], seq[k][2])
for i, (im, key, ga) in enumerate(seq):
    cv2.imwrite("%s/out/o_%04d.png" % (WORK, i + 1), grade(im).astype(np.uint8))
print("frames", N, "seconds", round(N / FPS, 2), "game", round(i_game_full / FPS, 2), "building", round(i_t0 / FPS, 2), "lying", round((i_land + 1) / FPS, 2), "end-bldg", round(i_a0 / FPS, 2))

# ---------- 소리 ----------
for take, src in (("D", SRC_D), ("E", SRC_E), ("F", SRC_F), ("T", SRC_T)):
    run("ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/take%s.wav" % take)
run("ffmpeg", "-v", "error", "-y", "-ss", "59.6", "-i", MUSIC, "-t", "4", "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/music.wav")


def rd(p):
    x = wavfile.read(p)[1].astype(np.float32) / 32768.0
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    return x


banks = {t: np.vstack([rd(WORK + "/take%s.wav" % t), np.zeros((SR, 2), np.float32)]) for t in ("D", "E", "F", "T")}
MU, HN = rd(WORK + "/music.wav"), rd(HORN_WAV)
sfx = {n: rd(os.path.join(SFX, n + ".wav")) for n in ("whoosh_up", "whoosh_down", "whoosh_side", "boom", "riser", "thud", "ring", "snap")}
XF = 480
src = []
last_d = None
for im, key, ga in seq:
    if key is not None and key[0] in ("D", "E", "F", "T"):
        src.append(key)
        if key[0] == "D":
            last_d = key[1]
    else:
        last_d = (last_d or 1) + 1
        if last_d > 446:
            last_d -= 45
        src.append(("D", last_d))
out = np.zeros((N * SPF + SR, 2), np.float32)
i = 0
while i < N:
    j = i
    while j + 1 < N and src[j + 1][0] == src[j][0] and src[j + 1][1] == src[j][1] + 1:
        j += 1
    bank = banks[src[i][0]]
    s0 = (src[i][1] - 1) * SPF
    L = (j - i + 1) * SPF
    seg = bank[s0:s0 + L + XF].copy()
    if len(seg) < L + XF:
        seg = np.vstack([seg, np.zeros((L + XF - len(seg), 2), np.float32)])
    if i > 0:
        seg[:XF] *= np.linspace(0, 1, XF, dtype=np.float32)[:, None]
    seg[L:L + XF] *= np.linspace(1, 0, XF, dtype=np.float32)[:, None]
    out[i * SPF:i * SPF + len(seg)] += seg
    i = j + 1


def take_gain(key):
    if key[0] == "T":
        return 0.6
    if key[0] != "D":
        return 1.0
    ts = (key[1] - 1) / FPS
    if ts < 1.05:
        return 1.0
    if ts < 1.25:
        return 1.0 + (0.42 - 1.0) * (ts - 1.05) / 0.2
    if ts < 9.25:
        return 0.42
    if ts < 9.5:
        return 0.42 + (1.0 - 0.42) * (ts - 9.25) / 0.25
    return 1.0


gf = np.array([take_gain(src[k]) * (1 - 0.85 * seq[k][2]) for k in range(N)] + [1.0], np.float32)
ga = np.array([seq[k][2] for k in range(N)] + [0.0], np.float32)
xs_ = np.arange(N * SPF) / float(SPF)
out = out[:N * SPF]
out *= np.interp(xs_, np.arange(N + 1), gf).astype(np.float32)[:, None]
i_dive = [k for k in range(N) if seq[k][2] > 0][0]
envg = np.convolve(np.interp(xs_, np.arange(N + 1), ga).astype(np.float32), np.ones(960, np.float32) / 960, mode="same")
mu = np.zeros_like(out)
L = min(len(MU), len(out) - i_dive * SPF)
mu[i_dive * SPF:i_dive * SPF + L] = MU[:L]
out += mu * envg[:, None] * 0.55


def muffle(x, hz=750.0):
    b_, a_ = butter(2, hz / (SR / 2))
    return lfilter(b_, a_, x, axis=0).astype(np.float32)


def place(buf, x, at_s, gain):
    p = int(at_s * SR)
    if p < 0 or p >= len(buf):
        return
    L = min(len(x), len(buf) - p)
    buf[p:p + L] += x[:L] * gain


# 시작 컷: 기기를 쓴 순간부터 밖으로 새는 먹먹한 게임 음악과 클락션
e_on = i_e_on * SPF
e_end = [k for k in range(N) if seq[k][1] is not None and seq[k][1][0] == "E"][-1]
L_e = (e_end + 1) * SPF
bed = np.zeros_like(out)
bed[e_on:L_e] = MU[:L_e - e_on]
fade = np.zeros(len(out), np.float32)
fade[e_on:e_on + int(0.25 * SR)] = np.linspace(0, 1, int(0.25 * SR))
fade[e_on + int(0.25 * SR):L_e - int(0.05 * SR)] = 1
fade[L_e - int(0.05 * SR):L_e] = np.linspace(1, 0, int(0.05 * SR))
out += muffle(bed) * fade[:, None] * 0.22
place(out, muffle(HN, 900.0), i_e_on / FPS + 0.35, 0.5)
for fi, name, gain in events:
    if name == "horn_clear":
        place(out, HN, fi / FPS, gain)
    else:
        place(out, sfx[name], fi / FPS, gain)
pk = float(np.abs(out).max())
if pk > 0.97:
    out *= 0.97 / pk
wavfile.write(WORK + "/mix.wav", SR, (out * 32767).clip(-32768, 32767).astype(np.int16))
run("ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", WORK + "/out/o_%04d.png", "-i", WORK + "/mix.wav",
    "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-shortest", OUT)
json.dump({"frames": N, "src": [list(s) for s in src], "game": [round(s[2], 3) for s in seq],
           "events": [[int(f), n, g] for f, n, g in events]}, open(WORK + "/map.json", "w"))
print("saved", OUT, "peak", round(pk, 3))
