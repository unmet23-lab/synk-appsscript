# -*- coding: utf-8 -*-
"""v15 오프닝: v14 + 넘어짐 속도 변화(KB_HI), 넘어짐→누움 연결 컷(SRC_G), 끝 줄임.
환경 변수 추가: KB_HI SRC_G G_END G_SPEED RAMP0 RAMP_LEN
(v14 설명) v14 오프닝(메타 안경): v13 + 헤드셋을 안경으로, 렌즈 속 화면으로 들어가기.
환경 변수 추가: K_A K_B STILL_Z LENS FACE PANEL_H PANEL_DX PANEL_DY HEAD_X HEAD_Y N_HOLD N_IN N_OUT PLUSH_IN
(v13 설명) v13 오프닝: v12 + 출근길 걷기로 시작(커피 들고 걸어오다 걸으면서 기기를 씀, 넓은 화면에서 걷다가 미끄러짐), 끝은 건물 컷 전체 + 입구로 다가가는 컷(SRC_C).
환경 변수 추가: SRC_C C_END C_SPEED D_IN XF_BC(두 끝 컷 사이 디졸브 프레임)
(v12 설명) v12 오프닝: v11 + 간판·브랜드 색(층마다 베리·라피스·코랄 조명)을 건물 컷에 직접 굽고(정지컷 → 이어 그리기), 마감(그레인·선명도) 손질.
환경 변수 추가: SRC_B(새 끝 건물 컷) B_END B_SPEED SIGN_T SIGN_B(1이면 승인 로고를 그 위에 추적 합성)

    python build_v11_products.py <d판.mp4> <a판.mp4> <시작 클로즈업.mp4> <누운 컷.mp4> <건물로 날아가는 컷.mp4> <클락션.wav>
        <게임 녹화.webm> <게임 음악.mp3> <효과음 폴더> <SYNK 로고 Ink.png> <SYNK-LAB 로고 Paper.png> <작업 폴더> <결과.mp4>

흐름: 기기를 든 채 카메라를 보다 기기를 씀(얼굴·콘로우 보임) → 컷 → 미끄러짐 → 시간 멈춤(둥 울림) → 기기 속 실제 게임(synk LAB HUD)
→ 까몽 → 멈춘 세상에서 우리 건물로 날아갔다 돌아옴(상승음) → 딱, 시간이 돌아와 넘어짐(쿵) → 컷 → 누워서 하늘을 봄(얼굴)
→ 시선을 따라 하늘로 컷, 카메라가 내려오며 건물과 synk 간판, 하늘이 갬.
- 커피 접사는 없다. 전환은 하드컷(동작·충격·시선 맞춤) 위주이고, 휙 번짐은 카메라가 날아가는 자리 셋에만 짧게 둔다.
- 간판: 승인 로고(SYNK-Ink)를 건물 띠에 추적 합성. 색 보정·그레인·비네트는 전체에 같게.
환경 변수: E_START E_END E_ON F_END T_END T_SPEED A_REF T_REF SIGN_DEBUG
"""
import json, os, shutil, subprocess, sys
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
D_IN = int(os.environ.get("D_IN", "8"))
env = os.environ.get
E_START, E_END, E_ON = int(env("E_START", "1")), int(env("E_END", "108")), int(env("E_ON", "66"))
F_END, T_END, T_SPEED = int(env("F_END", "60")), int(env("T_END", "112")), float(env("T_SPEED", "1.35"))
A_REF = [float(v) for v in env("A_REF", "255,420,88").split(",")]      # a판 394프레임의 간판 중심 x,y와 너비
T_REF_FRAME = int(env("T_REF_FRAME", "66"))
T_REF = [float(v) for v in env("T_REF", "215,450,85").split(",")]
SIGN_DEBUG = env("SIGN_DEBUG", "") == "1"
SRC_B = env("SRC_B", "")                  # 새 끝 건물 컷. 없으면 a판 + 로고 합성
SIGN_T, SIGN_B = env("SIGN_T", "0") == "1", env("SIGN_B", "0") == "1"
B_END, B_SPEED = int(env("B_END", "110")), float(env("B_SPEED", "1.15"))
SRC_C = env("SRC_C", "")
C_END, C_SPEED, XF_BC = int(env("C_END", "118")), float(env("C_SPEED", "1.0")), int(env("XF_BC", "8"))
TABEDIT = env("TABEDIT", "")              # 간판·층 색을 넣은 멈춘 장면(d판 58프레임 편집본). 있으면 넓은 d판 프레임의 건물에 옮긴다
BUILDING_DEBUG = env("BUILDING_DEBUG", "") == "1"
D_PATCHED = set()
D_OVR = {}
for _spec in (env("K_A", ""), env("K_B", "")):
    if _spec:
        _folder, _first = _spec.rsplit(":", 1)
        for _i, _f in enumerate(sorted(f for f in os.listdir(_folder) if f.endswith(".png"))):
            D_OVR[int(_first) + _i] = _folder + "/" + _f
PLUSH_IN = int(env("PLUSH_IN", "198"))
KB_HI = env("KB_HI", "")                  # 넘어짐 구간을 90fps로 보간한 프레임 폴더(d265에서 시작)
SRC_G = env("SRC_G", "")                  # 넘어짐 끝 → 누운 얼굴 연결 컷
G_END, G_SPEED = int(env("G_END", "90")), float(env("G_SPEED", "1.0"))
RAMP0, RAMP_LEN = float(env("RAMP0", "0.35")), float(env("RAMP_LEN", "0.55"))


def run(*a):
    subprocess.run(a, check=True, capture_output=True)


for sub in ("srcD", "srcA", "srcE", "srcF", "srcT", "srcB", "srcC", "srcG", "srcAS", "srcTS", "srcBS", "srcCS", "srcDB", "game", "out"):
    os.makedirs(WORK + "/" + sub, exist_ok=True)
takes = [("D", SRC_D), ("A", SRC_A), ("E", SRC_E), ("F", SRC_F), ("T", SRC_T)] + ([("B", SRC_B)] if SRC_B else []) + ([("C", SRC_C)] if SRC_C else []) + ([("G", SRC_G)] if SRC_G else [])
for take, src in takes:
    if not os.path.exists(WORK + "/src%s/f_0030.png" % take):
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "fps=30,scale=480:854", WORK + "/src%s/f_%%04d.png" % take)
if not os.path.exists(WORK + "/game/g_080.png"):
    run("ffmpeg", "-v", "error", "-y", "-ss", str(GAME_T0), "-i", GAME_WEBM, "-t", "2.8",
        "-vf", "fps=30,scale=-2:854,crop=480:854", WORK + "/game/g_%03d.png")


def nframes(take):
    return len([f for f in os.listdir(WORK + "/src" + take) if f.endswith(".png")])


def load(n, take="D"):
    if take == "D" and n in D_OVR:
        return cv2.imread(D_OVR[n]).astype(np.float32)
    if take == "D" and n in D_PATCHED:
        return cv2.imread("%s/srcDB/f_%04d.png" % (WORK, n)).astype(np.float32)
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
    x = 0.010 + x * (1 - 0.010)                     # 들린 검정
    sh = np.clip(1 - luma[..., 0] * 1.6, 0, 1)
    hi = np.clip(luma[..., 0], 0, 1) ** 2
    x[..., 0] += 0.014 * sh - 0.006 * hi            # B
    x[..., 2] += -0.008 * sh + 0.010 * hi           # R
    g = (0.114 * x[..., 0] + 0.587 * x[..., 1] + 0.299 * x[..., 2])[..., None]
    x = g + (x - g) * 0.93
    blur = cv2.GaussianBlur(x, (0, 0), 1.0)
    x = np.clip(x + 0.22 * (x - blur), 0, 1.2)          # 가벼운 선명화
    x = x * VIG
    x = x + grain_rng.normal(0, 1.3 / 255.0, (H, W, 1)).astype(np.float32)
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


def gray_of(take, n):
    return cv2.cvtColor(cv2.imread("%s/src%s/f_%04d.png" % (WORK, take, n)), cv2.COLOR_BGR2GRAY)


def orb_similarity(g_ref, g_cur, roi):
    # 두 프레임 사이 유사변환(ref→cur)을 ORB 특징 정합으로 구한다(먼 프레임 사이 첫 걸음용).
    orb = cv2.ORB_create(3000)
    mask = np.zeros_like(g_ref); mask[int(roi[1]):int(roi[3]), int(roi[0]):int(roi[2])] = 255
    k1, d1 = orb.detectAndCompute(g_ref, mask)
    k2, d2 = orb.detectAndCompute(g_cur, None)
    if d1 is None or d2 is None:
        return np.float32([[1, 0, 0], [0, 1, 0]])
    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    ms = bf.knnMatch(d1, d2, k=2)
    good = [m for m, n in ms if m.distance < 0.75 * n.distance]
    if len(good) < 8:
        return np.float32([[1, 0, 0], [0, 1, 0]])
    a = np.float32([k1[m.queryIdx].pt for m in good]); b = np.float32([k2[m.trainIdx].pt for m in good])
    S, inl = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    return S.astype(np.float32) if S is not None else np.float32([[1, 0, 0], [0, 1, 0]])


def track_chain(take, chain, roi, M0):
    # chain[0]의 변환이 M0(ref→chain[0])일 때, 차례로 LK로 이어 가며 각 프레임의 ref→n 변환을 돌려준다.
    lk = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
    out = {chain[0]: M0.copy()}
    g_prev = gray_of(take, chain[0]); M = M0.copy()
    box = cv2.transform(np.float32([[[roi[0], roi[1]], [roi[2], roi[1]], [roi[2], roi[3]], [roi[0], roi[3]]]]), M)[0]
    mask = np.zeros_like(g_prev); cv2.fillPoly(mask, [box.astype(np.int32)], 255)
    pts = cv2.goodFeaturesToTrack(g_prev, 300, 0.01, 4, mask=mask, blockSize=7)
    for n in chain[1:]:
        g_cur = gray_of(take, n)
        if pts is None or len(pts) < 12:
            box = cv2.transform(np.float32([[[roi[0], roi[1]], [roi[2], roi[1]], [roi[2], roi[3]], [roi[0], roi[3]]]]), M)[0]
            mask = np.zeros_like(g_prev); cv2.fillPoly(mask, [box.astype(np.int32)], 255)
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
                M = (np.vstack([S, [0, 0, 1]]) @ np.vstack([M, [0, 0, 1]]))[:2].astype(np.float32)
                pts = b[inl.ravel() == 1].reshape(-1, 1, 2) if inl is not None else b.reshape(-1, 1, 2)
            else:
                pts = b.reshape(-1, 1, 2)
        else:
            pts = None
        out[n] = M.copy(); g_prev = g_cur
    return out


def bake_building_patch():
    # 편집본과 원본 58프레임의 차이(간판·색 창)만 떼어, 추적으로 넓은 d판 프레임에 옮긴다.
    ref = 58
    patch = cv2.resize(imread_any(TABEDIT)[..., :3], (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)
    base = cv2.imread("%s/srcD/f_%04d.png" % (WORK, ref)).astype(np.float32)
    diff = np.abs(patch - base).mean(axis=2)
    m = (diff > 16).astype(np.uint8)
    bbox = np.zeros_like(m); bbox[150:490, 250:480] = 1
    m = m * bbox
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    mf = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)
    roi = (255, 150, 480, 480)
    Ms = {}
    Ms.update(track_chain("D", [58, 59, 60, 61, 62], roi, np.float32([[1, 0, 0], [0, 1, 0]])))
    Ms.update(track_chain("D", list(range(58, 46, -1)) + [44] + list(range(43, 0, -1)), roi, np.float32([[1, 0, 0], [0, 1, 0]])))
    M0 = orb_similarity(gray_of("D", 58), gray_of("D", 265), roi)
    Ms.update(track_chain("D", list(range(265, 301)), roi, M0))
    for n, M in Ms.items():
        fr = cv2.imread("%s/srcD/f_%04d.png" % (WORK, n)).astype(np.float32)
        wp = cv2.warpAffine(patch, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        wm = cv2.warpAffine(mf, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)[..., None]
        outp = fr * (1 - wm) + wp * wm
        cv2.imwrite("%s/srcDB/f_%04d.png" % (WORK, n), outp.clip(0, 255).astype(np.uint8))
        D_PATCHED.add(n)
    return mf, Ms


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
    hl = np.clip(np.roll(np.roll(a, -1, axis=0), -1, axis=1) - a, 0, 1) * 0.18
    out = im * (1 - sh[..., None]) + 255 * hl[..., None]
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

def copy_plain(take, idx_list, outdir):
    for n in idx_list:
        shutil.copy("%s/src%s/f_%04d.png" % (WORK, take, n), "%s/f_%04d.png" % (outdir, n))


if SRC_B:
    B_IDX = list(range(1, min(B_END + 2, nframes("B")) + 1))
    if SIGN_B:
        bake_sign("B", 1, B_IDX, (150, 370, 360, 470), A_REF, WORK + "/srcBS")
    else:
        copy_plain("B", B_IDX, WORK + "/srcBS")
elif not os.path.exists("%s/srcAS/f_%04d.png" % (WORK, A_IDX[-1])):
    bake_sign("A", 394, A_IDX, (150, 370, 360, 470), A_REF, WORK + "/srcAS")
if SRC_C:
    C_IDX = list(range(1, min(C_END + 2, nframes("C")) + 1))
    copy_plain("C", C_IDX, WORK + "/srcCS")
if SIGN_T:
    bake_sign("T", T_REF_FRAME, T_IDX, (90, 400, 330, 500), T_REF, WORK + "/srcTS")
else:
    copy_plain("T", T_IDX, WORK + "/srcTS")
if TABEDIT:
    mf_dbg, Ms_dbg = bake_building_patch()
    if BUILDING_DEBUG:
        os.makedirs(WORK + "/qa", exist_ok=True)
        tiles = [cv2.imread("%s/srcDB/f_%04d.png" % (WORK, n)) for n in (2, 12, 30, 58, 265, 280, 300)]
        mk = cv2.cvtColor((mf_dbg * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
        cv2.imwrite(WORK + "/qa/building_debug.jpg", np.hstack([cv2.resize(x, (300, 534)) for x in tiles + [mk]]), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print("building debug written"); sys.exit(0)

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
# T2 시간 멈춤: 넓은 화면에서 멈춘 얼굴(정지컷, 메타 안경)로 날아든다
ST = imread_any(env("STILL_Z"))[..., :3].astype(np.float32)
LX, LY, LW, LH = [float(v) for v in env("LENS").split(",")]
FX, FY, FW = [float(v) for v in env("FACE").split(",")]
PH = LH * float(env("PANEL_H", "0.62"))           # 렌즈 속 화면 높이(정지컷 좌표), 세로 9:16
PW = PH * 9.0 / 16.0
PX, PY = LX + float(env("PANEL_DX", "0")), LY + float(env("PANEL_DY", "0"))
PANEL_MASK = np.zeros((H, W), np.float32)
_r = int(0.08 * W)
cv2.rectangle(PANEL_MASK, (_r, 0), (W - _r, H), 1, -1)
cv2.rectangle(PANEL_MASK, (0, _r), (W, H - _r), 1, -1)
for _c in ((_r, _r), (W - _r, _r), (_r, H - _r), (W - _r, H - _r)):
    cv2.circle(PANEL_MASK, _c, _r, 1, -1)
PANEL_MASK = cv2.GaussianBlur(PANEL_MASK, (0, 0), 1.5)


def still_frame(cx, cy, cw, panel_alpha=0.0, gframe=None, blur=0.0):
    # 정지컷에서 (cx,cy) 중심·너비 cw 창을 화면으로. 렌즈 속 화면(게임)을 그 위에 얹는다.
    s = W / cw
    M = np.float32([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]])
    base = cv2.warpAffine(ST, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    vis = 0.0
    if panel_alpha > 0 and gframe is not None:
        x0 = s * (PX - PW / 2) + M[0, 2]
        y0 = s * (PY - PH / 2) + M[1, 2]
        gs = (PW * s) / W
        A = np.float32([[gs, 0, x0], [0, gs, y0]])
        g = cv2.warpAffine(gframe, A, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        mk = cv2.warpAffine(PANEL_MASK, A, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        glow = cv2.GaussianBlur(mk, (0, 0), max(1.0, 8 * gs))
        base = base + (glow * panel_alpha * 0.30)[..., None] * np.float32([255, 228, 196])
        a = (mk * panel_alpha * 0.92)[..., None]
        base = base * (1 - a) + g * a
        vis = float(mk.mean() * panel_alpha)
    if blur > 0:
        base = radial_blur(base, W / 2, H / 2, blur)
    return base.clip(0, 255), vis


events.append((len(seq) - 3, "whoosh_up", 0.5))
hd = (float(env("HEAD_X", "210")), float(env("HEAD_Y", "330")))
w_last = load(44)
fz0, _ = still_frame(FX, FY, FW * 1.25)
a = radial_blur(zoom(w_last, 1.7, hd[0], hd[1], 240, 400), 240, 400, 0.30)
b = radial_blur(zoom(w_last, 3.2, hd[0], hd[1], 240, 420), 240, 420, 0.60)
c = radial_blur(fz0, W / 2, H / 2, 0.40)
d_, _ = still_frame(FX, FY, FW * 1.18)
d_ = radial_blur(d_, W / 2, H / 2, 0.15)
seq += [(a, ("D", 45), 0.0), (mix(b, c, 0.3), ("D", 46), 0.0), (mix(b, c, 0.7), ("D", 73), 0.0), (d_, ("D", 74), 0.0)]
events.append((len(seq), "boom", 0.7)); events.append((len(seq), "ring", 0.22))
# S3a 멈춘 얼굴: 천천히 렌즈 쪽으로 밀고, 렌즈 속 작은 화면이 켜진다
N_HOLD, N_IN, N_OUT = int(env("N_HOLD", "20")), int(env("N_IN", "16")), int(env("N_OUT", "12"))
cx0, cy0, cw0 = FX + (LX - FX) * 0.35, FY + (LY - FY) * 0.35, FW * 0.78
for i in range(N_HOLD):
    u = smooth(i / float(N_HOLD - 1))
    cx, cy = FX + (cx0 - FX) * u, FY + (cy0 - FY) * u
    cw = FW * 1.15 * (cw0 / (FW * 1.15)) ** u
    pa = 0.35 * smooth((i - N_HOLD * 0.45) / (N_HOLD * 0.55))
    im, vis = still_frame(cx, cy, cw, pa, game(G_DIVE))
    seq.append((im, ("D", 75 + i), vis))
# S3b 렌즈 속으로: 화면이 커져 화면 전체가 된다
for i in range(N_IN):
    u = (i + 1) / float(N_IN)
    e = u ** 2.2
    cx, cy = cx0 + (PX - cx0) * smooth(u * 1.3), cy0 + (PY - cy0) * smooth(u * 1.3)
    cw = float(np.exp(np.log(cw0) + (np.log(PW * 0.985) - np.log(cw0)) * e))
    pa = 0.35 + 0.65 * smooth(u * 1.6)
    gf = game(G_DIVE + i)
    im, vis = still_frame(cx, cy, cw, pa, gf, blur=0.10 * float(np.sin(np.pi * u)))
    if i >= N_IN - 3:
        k = (i - (N_IN - 3) + 1) / 3.0
        im = (mix(im, gf, smooth(k)) + 55 * float(np.sin(np.pi * k))).clip(0, 255)
        vis = max(vis, k)
    seq.append((im, ("D", 95 + i), float(min(1.0, vis))))
i_game_full = len(seq)
for k in range(N_FULL):
    hk = min(1.0, k / 3.0) * min(1.0, (N_FULL - 1 - k) / 3.0)
    seq.append((add_hud(game(G_FULL + 6 + k), hk), None, 1.0))
events.append((i_game_full + 3, "horn_clear", 0.6))
# S3c 렌즈 밖으로
for j in range(N_OUT):
    u = (j + 1) / float(N_OUT)
    e = 1 - (1 - u) ** 2.2
    cx, cy = PX + (cx0 - PX) * smooth(u), PY + (cy0 - PY) * smooth(u)
    cw = float(np.exp(np.log(PW * 0.985) + (np.log(cw0 * 1.1) - np.log(PW * 0.985)) * e))
    pa = 1.0 - 0.72 * smooth(u)
    gf = game(G_EXIT + j)
    im, vis = still_frame(cx, cy, cw, pa, gf, blur=0.08 * float(np.sin(np.pi * u)))
    if j < 2:
        im = mix(gf, im, (j + 1) / 3.0)
    seq.append((im, ("D", 120 + j), float(vis)))
last_cam = (cx0, cy0, cw0 * 1.1)
for j in range(4):
    im, vis = still_frame(*last_cam, 0.28, game(G_EXIT + N_OUT + j))
    seq.append((im, ("D", 132 + j), vis))
# T3 옆으로 휙: 얼굴에서 어깨 뒤 까몽으로
events.append((len(seq), "whoosh_side", 0.45))
s1, _ = still_frame(*last_cam, 0.28, game(G_EXIT + N_OUT + 4))
a = dir_blur(shift(s1, -24), 60)
b = dir_blur(shift(s1, -100), 190)
c = dir_blur(shift(load(PLUSH_IN), 100), 190)
d = dir_blur(shift(load(PLUSH_IN + 1), 24), 60)
seq += [(a, ("D", 146), 0.0), (mix(b, c, 0.3), ("D", 147), 0.0), (mix(b, c, 0.7), ("D", PLUSH_IN), 0.0), (d, ("D", PLUSH_IN + 1), 0.0)]
# S4 까몽
retime("D", PLUSH_IN + 2, 228, 2.0)
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
if KB_HI:
    # 시간이 돌아온다: 0.35배에서 시작해 RAMP_LEN초 동안 1배까지 빨라진다. 땅에 닿는 순간은 1배.
    hi = sorted(f for f in os.listdir(KB_HI) if f.endswith(".png"))
    st, k = 0.0, 0
    land_t = (296 - 265) / 30.0
    i_land = None
    while True:
        idx = int(round(st * 90))
        if idx >= len(hi):
            break
        im = cv2.imread(KB_HI + "/" + hi[idx]).astype(np.float32)
        if k < 3:
            im = zoom(im, 1.04 - 0.04 * k / 2.0, 240, 427)
        seq.append((im, ("D", 265) if k == 0 else None, 0.0))
        if i_land is None and st >= land_t:
            i_land = len(seq) - 1
        sp = RAMP0 + (1 - RAMP0) * smooth(st / RAMP_LEN)
        st += sp / 30.0
        k += 1
    if i_land is None:
        i_land = len(seq) - 1
else:
    for k, n in enumerate(range(265, 268)):
        seq.append((zoom(load(n), 1.04 - 0.04 * k / 2.0, 240, 427), ("D", n), 0.0))
    nat(268, 300)
    i_land = [k for k in range(len(seq)) if seq[k][1] == ("D", 296)][0]
events.append((i_land, "thud", 0.7))
# T6 넘어진 뒤 → 누운 얼굴: 연결 컷으로 끊김 없이(카메라가 내려가 그 옆에 선다)
if SRC_G:
    retime("G", 1, min(G_END, nframes("G")), G_SPEED)
    nat(2, F_END, "F", lambda im, n: zoom(im, 1 + 0.04 * smooth((n - 1) / float(max(1, F_END - 1))), 240, 430))
else:
    nF = F_END - 1
    nat(1, F_END, "F", lambda im, n: zoom(im, 1 + 0.05 * smooth((n - 1) / float(nF)), 240, 430))
# T7 시선 맞춤: 하늘로 컷 → 카메라가 내려오며 건물과 간판, 하늘이 갠다
events.append((len(seq), "whoosh_down", 0.18))
i_a0 = len(seq)
if SRC_B:
    retime("B", 1, B_END, B_SPEED, src=WORK + "/srcBS")
    if SRC_C:
        tail = [seq.pop() for _ in range(XF_BC)][::-1]
        for k in range(XF_BC):
            u = smooth((k + 1) / float(XF_BC + 1))
            cim = cv2.imread("%s/srcCS/f_%04d.png" % (WORK, k + 1)).astype(np.float32)
            seq.append((mix(tail[k][0], cim, u), tail[k][1], 0.0))
        retime("C", XF_BC + 1, C_END, C_SPEED, src=WORK + "/srcCS")
else:
    retime("A", 394, nframes("A"), 1.2, src=WORK + "/srcAS")
for k in range(i_a0, min(i_a0 + 27, len(seq))):
    u = smooth((k - i_a0) / 26.0)
    z = 1.6 - 0.6 * u
    cy = 150 + (427 - 150) * u
    seq[k] = (zoom(seq[k][0], z, 240, cy, 240, 427 - (427 - cy) * (1 - 0) ), seq[k][1], seq[k][2])

N = len(seq)
# 하늘: 시간이 돌아온 뒤부터 끝까지 조금씩 푸르게
i_ret = [k for k in range(N) if seq[k][1] == ("D", 265)][0]
end_sky = i_a0 if SRC_B else N - 20
for k in range(i_ret, i_a0 if SRC_B else N):
    gq = smooth((k - i_ret) / float(max(1, end_sky - i_ret)))
    seq[k] = (clear_sky(seq[k][0], gq) * (1 + 0.04 * gq), seq[k][1], seq[k][2])
for i, (im, key, ga) in enumerate(seq):
    cv2.imwrite("%s/out/o_%04d.png" % (WORK, i + 1), grade(im).astype(np.uint8))
print("frames", N, "seconds", round(N / FPS, 2), "game", round(i_game_full / FPS, 2), "building", round(i_t0 / FPS, 2), "lying", round((i_land + 1) / FPS, 2), "end-bldg", round(i_a0 / FPS, 2))

# ---------- 소리 ----------
for take, src in [("D", SRC_D), ("E", SRC_E), ("F", SRC_F), ("T", SRC_T)] + ([("G", SRC_G)] if SRC_G else []):
    run("ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/take%s.wav" % take)
run("ffmpeg", "-v", "error", "-y", "-ss", "59.6", "-i", MUSIC, "-t", "4", "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/music.wav")


def rd(p):
    x = wavfile.read(p)[1].astype(np.float32) / 32768.0
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    return x


banks = {t: np.vstack([rd(WORK + "/take%s.wav" % t), np.zeros((SR, 2), np.float32)]) for t in ("D", "E", "F", "T") + (("G",) if SRC_G else ())}
MU, HN = rd(WORK + "/music.wav"), rd(HORN_WAV)
sfx = {n: rd(os.path.join(SFX, n + ".wav")) for n in ("whoosh_up", "whoosh_down", "whoosh_side", "boom", "riser", "thud", "ring", "snap")}
XF = 480
src = []
last_d = None
for im, key, ga in seq:
    if key is not None and key[0] in ("D", "E", "F", "T", "G"):
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
