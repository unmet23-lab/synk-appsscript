# -*- coding: utf-8 -*-
"""v9 오프닝(줌인은 우리 제품) 편집: 집중하는 얼굴 클로즈업(i2v) → Wan d판(앞·중간) → a판(끝), 기기 유리 속에 실제 게임 화면.

    python build_v9_products.py <Wan d판.mp4> <Wan a판.mp4> <클로즈업 i2v.mp4> <클락션.wav> <게임 녹화.webm> <게임 음악.mp3> <작업 폴더> <결과.mp4>

- 첫 장면은 d판 프레임을 고쳐 만든 정지컷(입을 다문 집중한 얼굴)에서 이어 그린 클로즈업이다. 기울며 놀라는 순간에 빠르게 물러나 d판의 넓은 미끄러짐으로 잇는다.
- 클락션: 클로즈업에서는 기기 밖으로 새는 먹먹한 소리로, VR 안에서는 또렷하게 한 번 더.

- d판이 스스로 끊은 컷은 2~3프레임짜리 빠른 카메라 이동(확대 번짐·옆 번짐)으로 잇는다. 다른 영상은 끼우지 않는다.
- 기기로 밀고 들어갈 때 유리 면을 창으로 삼아 게임 화면이 비치고, 유리가 화면을 채우면 게임 화면만 남는다.
- 컵 접사는 1.5배 당겨 컵 바닥(손이 없는 것)이 화면 밖으로 나가게 한다.
- 끝(누워서 VR 벗기 → 얼굴 → 건물)은 a판을 쓴다. 기기를 똑바로 들어 올리고 표정이 차분하다.
- 시간이 돌아온 뒤부터 하늘만 골라 조금씩 푸르게 바꿔, 끝의 구름 걷힘으로 잇는다.
- 소리는 d판 소리를 화면과 같은 자리에서 잘라 잇고(a판 구간도 d판의 바람 소리), 느린 구간의 낮은 울림은 줄이고, 게임 구간은 게임 음악만 넣는다(합성 목소리는 쓰지 않는다).
"""
import json, os, subprocess, sys
import cv2, numpy as np
from scipy.io import wavfile

SRC_D, SRC_A, CU_SRC, HORN_WAV, GAME_WEBM, MUSIC, WORK, OUT = sys.argv[1:9]
CU_USE = int(os.environ.get("CU_USE", "100"))        # 클로즈업에서 쓰는 프레임 수(놀라는 순간까지)
CU_HORN_T = float(os.environ.get("CU_HORN_T", "1.2"))  # 클로즈업 안 먹먹한 클락션 시각(초)
VR_HORN_T = float(os.environ.get("VR_HORN_T", "0.15")) # 게임이 화면을 채운 뒤 클락션까지(초)
D_IN = 21                                                 # 넓은 화면으로 넘어갈 때 d판의 첫 프레임
FAST = os.environ.get("FAST", "") == "1"                 # 템포를 바짝 당긴 판
if FAST:
    N_FULL = 24
W, H, FPS, SR = 480, 854, 30, 48000
SPF = SR // FPS
GAME_T0 = 20.40          # 게임 녹화에서 뽑기 시작하는 초
G_DIVE, G_FULL, G_EXIT = 16, 30, 60   # 들어갈 때, 화면을 채울 때, 나올 때 쓰는 게임 프레임 시작 번호
N_DIVE, N_FULL, N_EXIT = 14, 30, 12
F_DIVE, F_EXIT = 100, 120  # 들어가기·나오기에 쓰는 d판 프레임 시작 번호
ZMAX = 1.8
CUPZ, CUPC = 1.5, (235, 370)   # 컵 접사 당김 배율과 중심


def run(*a):
    subprocess.run(a, check=True, capture_output=True)


for sub in ("srcD", "srcA", "srcC", "game", "out"):
    os.makedirs(WORK + "/" + sub, exist_ok=True)
if not os.path.exists(WORK + "/srcD/f_0450.png"):
    run("ffmpeg", "-v", "error", "-y", "-i", SRC_D, "-fps_mode", "passthrough", WORK + "/srcD/f_%04d.png")
if not os.path.exists(WORK + "/srcA/f_0450.png"):
    run("ffmpeg", "-v", "error", "-y", "-i", SRC_A, "-fps_mode", "passthrough", WORK + "/srcA/f_%04d.png")
if not os.path.exists(WORK + "/srcC/f_0001.png"):
    run("ffmpeg", "-v", "error", "-y", "-i", CU_SRC, "-vf", "fps=30,scale=480:854", WORK + "/srcC/f_%04d.png")
if not os.path.exists(WORK + "/game/g_080.png"):
    run("ffmpeg", "-v", "error", "-y", "-ss", str(GAME_T0), "-i", GAME_WEBM, "-t", "2.8",
        "-vf", "fps=30,scale=-2:854,crop=480:854", WORK + "/game/g_%03d.png")
for f in os.listdir(WORK + "/out"):
    os.remove(WORK + "/out/" + f)


def load(n, take="D"):
    return cv2.imread("%s/src%s/f_%04d.png" % (WORK, take, n)).astype(np.float32)


def game(n):
    return cv2.imread("%s/game/g_%03d.png" % (WORK, n)).astype(np.float32)


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def zoom(img, s, cx, cy, tx=None, ty=None):
    # (cx,cy)를 중심으로 s배. 그 점이 화면의 (tx,ty)에 오게 한다.
    if tx is None:
        tx, ty = cx, cy
    M = np.float32([[s, 0, tx - s * cx], [0, s, ty - s * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC if s > 1.5 else cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT)


def radial_blur(img, cx, cy, k, n=16):
    # 확대 번짐: 1배부터 1+k배까지 겹친다.
    if k <= 0:
        return img
    acc = np.zeros_like(img)
    for i in range(n):
        acc += zoom(img, 1 + k * i / (n - 1), cx, cy)
    return acc / n


def shift(img, ox):
    return cv2.warpAffine(img, np.float32([[1, 0, ox], [0, 1, 0]]), (W, H), borderMode=cv2.BORDER_REFLECT)


def dir_blur(img, dx, n=20):
    # 옆 번짐: 가로로 dx 픽셀만큼 겹친다.
    acc = np.zeros_like(img)
    for i in range(n):
        acc += shift(img, dx * (i / (n - 1) - 0.5))
    return acc / n


def visor_mask(im, thr=72, frac=0.85, erode=5, feather=8):
    # 기기의 검은 유리 면(0..1). 가운데 60% 너비가 거의 다 어두운 줄이 가장 길게 이어진 구간을 유리로 본다.
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
    # 하늘(0..1): 밝고 매끈하고 푸르스름하며 위쪽 가장자리와 이어진 영역. 건물 벽은 결이 있어 빠진다.
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


SKY_TARGET = np.float32([222, 196, 172])   # BGR: 옅은 파란 하늘
YG = (1 - 0.5 * (np.arange(H, dtype=np.float32) / H))[:, None, None]   # 위쪽일수록 세게


def clear_sky(im, k):
    # 하늘만 k(0..1)만큼 옅은 파랑 쪽으로. 이미 파란 곳은 건드리지 않는다.
    if k <= 0:
        return im
    m = sky_mask(im)
    br = im[..., 0] - im[..., 2]
    guard = np.clip(1 - (br - 20) / 30.0, 0, 1)
    w = (m * guard)[..., None] * YG * (0.55 * k)
    return im * (1 - w) + SKY_TARGET[None, None, :] * w


seq = []      # (그림, (판, 원본 프레임) 또는 None, 게임이 보이는 정도 0..1)


def nat(a, b, take="D"):
    for n in range(a, b + 1):
        seq.append((load(n, take), (take, n), 0.0))


def mix(a, b, t):
    return a * (1 - t) + b * t


def retime(take, a, b, speed_mid, ramp=0.25):
    # 원본 a..b 프레임을 가운데는 speed_mid배, 양 끝은 1배로 부드럽게 빠르게 돌린다. 이웃 프레임을 섞어 끊김을 줄인다.
    n = b - a
    ts, pos = [], 0.0
    while pos <= n:
        ts.append(pos)
        u = pos / n
        w = smooth(u / ramp) if u < ramp else (smooth((1 - u) / ramp) if u > 1 - ramp else 1.0)
        pos += 1 + (speed_mid - 1) * w
    for p in ts:
        i0 = int(p)
        fr = p - i0
        im = load(a + i0, take) if fr < 0.02 or a + i0 + 1 > b else mix(load(a + i0, take), load(a + i0 + 1, take), fr)
        seq.append((im, (take, a + i0), 0.0))


# 0) 집중하는 얼굴 클로즈업 -> 놀라는 순간 빠르게 물러나 넓은 화면(d판 D_IN 프레임, 팔이 벌어지는 중)으로
CU_MID = os.environ.get("CU_MID", "31,99,2.0")   # 클로즈업 가운데를 빠르게: 시작,끝,배율 (빈 값이면 그대로)
if FAST:
    nat(max(1, CU_USE - 32), CU_USE - 2, "C")
elif CU_MID:
    ca, cb, cs = CU_MID.split(",")
    nat(1, int(ca) - 1, "C")
    retime("C", int(ca), int(cb), float(cs))
    nat(int(cb) + 1, CU_USE - 2, "C")
else:
    nat(1, CU_USE - 2, "C")
a = radial_blur(load(CU_USE - 1, "C"), 240, 400, 0.18)
b = radial_blur(load(CU_USE, "C"), 240, 400, 0.45)
wc = (230, 400)
c = radial_blur(zoom(load(D_IN), 2.0, *wc), wc[0], wc[1], 0.45)
d = radial_blur(zoom(load(D_IN + 1), 1.35, *wc), wc[0], wc[1], 0.20)
e = radial_blur(zoom(load(D_IN + 2), 1.10, *wc), wc[0], wc[1], 0.06)
f = zoom(load(D_IN + 3), 1.03, *wc)
seq += [(a, ("C", CU_USE - 1), 0.0), (mix(b, c, 0.3), ("C", CU_USE), 0.0), (mix(b, c, 0.7), ("D", D_IN), 0.0),
        (d, ("D", D_IN + 1), 0.0), (e, ("D", D_IN + 2), 0.0), (f, ("D", D_IN + 3), 0.0)]
# 1) 걷다가 미끄러짐
nat(D_IN + 4, 46)
# 이음 1: 넓은 화면 -> 건물이 보이는 넓은 화면(멈춘 순간)
c1, c2 = (230, 410), (210, 450)
a = radial_blur(zoom(load(47), 1.03, *c1), c1[0], c1[1], 0.06)
b = radial_blur(zoom(load(48), 1.10, *c1), c1[0], c1[1], 0.16)
c = radial_blur(load(49), c2[0], c2[1], 0.16)
d = radial_blur(load(50), c2[0], c2[1], 0.06)
seq += [(a, ("D", 47), 0.0), (mix(b, c, 0.3), ("D", 48), 0.0), (mix(b, c, 0.7), ("D", 49), 0.0), (d, ("D", 50), 0.0)]
if not FAST:
    nat(55, 62)
# 이음 2: 넓은 화면 -> 기기(머리로 밀고 들어감)
hd = (165, 370)
a = radial_blur(zoom(load(71), 1.7, hd[0], hd[1], 185, 385), 185, 385, 0.30)
b = radial_blur(zoom(load(72), 3.4, hd[0], hd[1], 225, 415), 225, 415, 0.60)
c = radial_blur(load(73), 230, 420, 0.40)
d = radial_blur(load(74), 230, 420, 0.18)
e = radial_blur(load(75), 230, 420, 0.06)
seq += [(a, ("D", 71), 0.0), (mix(b, c, 0.25), ("D", 72), 0.0), (mix(b, c, 0.75), ("D", 73), 0.0), (d, ("D", 74), 0.0), (e, ("D", 75), 0.0)]
if FAST:
    retime("D", 76, F_DIVE - 1, 1.6)
else:
    nat(76, F_DIVE - 1)
# 2) 기기 유리 속으로: 유리 면이 창이 되어 게임 화면이 비친다
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
for k in range(N_FULL):
    seq.append((game(G_FULL + k), None, 1.0))
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
if FAST:
    retime("D", F_EXIT + N_EXIT, 147, 1.6)
else:
    nat(F_EXIT + N_EXIT, 147)
# 이음 3: 기기에서 물러남 -> 컵(물러나는 카메라 앞에 컵이 들어옴). 컵은 CUPZ배로 당긴 채 본다.
a = radial_blur(load(148), 235, 440, 0.14)
b = radial_blur(load(149), 235, 440, 0.34)
c = radial_blur(zoom(load(150), CUPZ * 1.2, *CUPC), CUPC[0], CUPC[1], 0.34)
d = radial_blur(zoom(load(151), CUPZ * 1.08, *CUPC), CUPC[0], CUPC[1], 0.14)
e = zoom(load(152), CUPZ * 1.02, *CUPC)
seq += [(a, ("D", 148), 0.0), (mix(b, c, 0.3), ("D", 149), 0.0), (mix(b, c, 0.7), ("D", 150), 0.0), (d, ("D", 151), 0.0), (e, ("D", 152), 0.0)]
for n in range(166 if FAST else 153, 184):
    seq.append((zoom(load(n), CUPZ, *CUPC), ("D", n), 0.0))
# 이음 4: 컵 -> 까몽(오른쪽으로 돌아 들어감)
a = dir_blur(shift(zoom(load(184), CUPZ, *CUPC), -24), 60)
b = dir_blur(shift(zoom(load(185), CUPZ, *CUPC), -100), 190)
c = dir_blur(shift(load(186), 100), 190)
d = dir_blur(shift(load(187), 24), 60)
seq += [(a, ("D", 184), 0.0), (mix(b, c, 0.3), ("D", 185), 0.0), (mix(b, c, 0.7), ("D", 186), 0.0), (d, ("D", 187), 0.0)]
if FAST:
    retime("D", 188, 228, 2.4)
    nat(229, 240)
    retime("D", 248, 262, 2.0)
else:
    retime("D", 188, 228, 1.6)
    nat(229, 247)
    retime("D", 248, 262, 1.3)
# 이음 5: 까몽에서 빠짐 -> 넓은 화면(시간이 돌아옴)
sc = (225, 420)
a = radial_blur(load(263), 175, 500, 0.16)
b = radial_blur(load(264), 175, 500, 0.36)
c = radial_blur(zoom(load(265), 1.45, *sc), sc[0], sc[1], 0.36)
d = radial_blur(zoom(load(266), 1.20, *sc), sc[0], sc[1], 0.16)
e = zoom(load(267), 1.07, *sc)
seq += [(a, ("D", 263), 0.0), (mix(b, c, 0.3), ("D", 264), 0.0), (mix(b, c, 0.7), ("D", 265), 0.0), (d, ("D", 266), 0.0), (e, ("D", 267), 0.0)]
nat(268, 296 if FAST else 304)
# 이음 6: 멀리서 본 누운 모습(d판) -> 누운 모습 가까이(a판: 기기를 똑바로 들어 올리고 표정이 차분하다)
bc = (245, 585)
f6a, f6b = (297, 298) if FAST else (305, 306)
a = radial_blur(zoom(load(f6a), 1.6, bc[0], bc[1], 240, 540), 240, 540, 0.30)
b = radial_blur(zoom(load(f6b), 3.0, bc[0], bc[1], 235, 500), 235, 500, 0.60)
c = radial_blur(load(308, "A"), 150, 480, 0.40)
d = radial_blur(load(309, "A"), 150, 480, 0.18)
e = radial_blur(load(310, "A"), 150, 480, 0.06)
seq += [(a, ("D", f6a), 0.0), (mix(b, c, 0.25), ("D", f6b), 0.0), (mix(b, c, 0.75), ("A", 308), 0.0), (d, ("A", 309), 0.0), (e, ("A", 310), 0.0)]
if FAST:
    nat(311, 318, "A")
    retime("A", 319, 345, 1.4)
    nat(346, 372, "A")
    retime("A", 373, 450, 1.3)
else:
    nat(311, 450, "A")

N = len(seq)
# 하늘: 시간이 돌아온 뒤(d판 265프레임)부터 건물 화면(a판 400프레임)까지 하늘만 조금씩 푸르게. 그 뒤는 그대로 유지.
i_ret = [k for k in range(N) if seq[k][1] == ("D", 265)][0]
i_top = [k for k in range(N) if seq[k][1] == ("A", 400)][0]
for k in range(i_ret, N):
    gq = smooth((k - i_ret) / float(i_top - i_ret))
    im = clear_sky(seq[k][0], gq) * (1 + 0.04 * gq)
    seq[k] = (im, seq[k][1], seq[k][2])
for i, (im, key, ga) in enumerate(seq):
    cv2.imwrite("%s/out/o_%04d.png" % (WORK, i + 1), im.clip(0, 255).astype(np.uint8))
print("frames", N, "seconds", round(N / FPS, 2), "a-take from", round([k for k in range(N) if seq[k][1] == ("A", 308)][0] / FPS, 2))

# ---- 소리 ----
run("ffmpeg", "-v", "error", "-y", "-i", SRC_D, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/take.wav")
run("ffmpeg", "-v", "error", "-y", "-ss", "59.6", "-i", MUSIC, "-t", "4", "-ac", "2", "-ar", str(SR),
    "-c:a", "pcm_s16le", WORK + "/music.wav")


def rd(p):
    return wavfile.read(p)[1].astype(np.float32) / 32768.0


A_, MU = rd(WORK + "/take.wav"), rd(WORK + "/music.wav")
A_ = np.vstack([A_, np.zeros((SR, 2), np.float32)])
XF = 480   # 이음매 10ms 겹침
# 소리 자리: d판 프레임은 그 자리, 게임·a판 프레임은 d판 소리를 이어서 쓴다(끝을 넘으면 1.5초 앞의 바람 소리로 되감는다).
src = []
last = None
for im, key, ga in seq:
    if key is not None and key[0] == "D":
        last = key[1]
    elif key is not None and key[0] == "C":
        last = 329 + key[1]      # 클로즈업에는 d판 끝의 조용한 바람 소리를 깐다
    else:
        last = last + 1
        if last > 446:
            last -= 45
    src.append(last)
out = np.zeros((N * SPF + SR, 2), np.float32)
i = 0
while i < N:
    j = i
    while j + 1 < N and src[j + 1] == src[j] + 1:
        j += 1
    s0 = (src[i] - 1) * SPF
    L = (j - i + 1) * SPF
    seg = A_[s0:s0 + L + XF].copy()
    if i > 0:
        seg[:XF] *= np.linspace(0, 1, XF, dtype=np.float32)[:, None]
    seg[L:L + XF] *= np.linspace(1, 0, XF, dtype=np.float32)[:, None]
    p0 = i * SPF
    out[p0:p0 + len(seg)] += seg
    i = j + 1


def take_gain(ts):
    # 원본 소리 크기: 느린 구간의 낮은 울림(원본 1.1~9.4초)은 줄인다.
    if ts < 1.05:
        return 1.0
    if ts < 1.25:
        return 1.0 + (0.42 - 1.0) * (ts - 1.05) / 0.2
    if ts < 9.25:
        return 0.42
    if ts < 9.5:
        return 0.42 + (1.0 - 0.42) * (ts - 9.25) / 0.25
    return 1.0


gf = np.array([take_gain((src[k] - 1) / FPS) * (1 - 0.85 * seq[k][2]) for k in range(N)] + [1.0], np.float32)
ga = np.array([seq[k][2] for k in range(N)] + [0.0], np.float32)
xs = np.arange(N * SPF) / float(SPF)
out = out[:N * SPF]
out *= np.interp(xs, np.arange(N + 1), gf).astype(np.float32)[:, None]
# 게임 소리: 게임이 보이는 만큼 게임 음악을 올린다. 합성 목소리는 넣지 않는다.
i_dive = [k for k in range(N) if seq[k][2] > 0][0]
env = np.interp(xs, np.arange(N + 1), ga).astype(np.float32)
env = np.convolve(env, np.ones(960, np.float32) / 960, mode="same")
mu = np.zeros_like(out)
p0 = i_dive * SPF
L = min(len(MU), len(out) - p0)
mu[p0:p0 + L] = MU[:L]
out += mu * env[:, None] * 0.55
# 클로즈업: 기기 밖으로 새는 먹먹한 게임 음악과 클락션. VR 안: 또렷한 클락션.
from scipy.signal import butter, lfilter


def muffle(x, hz=750.0):
    b_, a_ = butter(2, hz / (SR / 2))
    return lfilter(b_, a_, x, axis=0).astype(np.float32)


HN = rd(HORN_WAV)
n_cu = [k for k in range(N) if seq[k][1] is not None and seq[k][1][0] == "C"]
L_cu = (n_cu[-1] + 1) * SPF
bed = np.zeros_like(out)
bed[:min(L_cu, len(MU))] = MU[:min(L_cu, len(MU))]
fade = np.ones(len(out), np.float32)
fade[:int(0.3 * SR)] = np.linspace(0, 1, int(0.3 * SR))
fade[L_cu - int(0.08 * SR):L_cu] = np.linspace(1, 0, int(0.08 * SR))
fade[L_cu:] = 0
out += muffle(bed) * fade[:, None] * 0.22
h0 = int(CU_HORN_T * SR)
hm = muffle(HN, 900.0) * 0.5
out[h0:h0 + len(hm)] += hm[:len(out) - h0]
h1 = int(((i_dive + N_DIVE) / FPS + VR_HORN_T) * SR)
out[h1:h1 + len(HN)] += HN[:len(out) - h1] * 0.6
print("horn muffled at", round(h0 / SR, 2), "clear at", round(h1 / SR, 2), "closeup frames", len(n_cu))
print("game from", round(i_dive / FPS, 2), "to", round((i_dive + N_DIVE + N_FULL + N_EXIT) / FPS, 2))
pk = float(np.abs(out).max())
if pk > 0.97:
    out *= 0.97 / pk
wavfile.write(WORK + "/mix.wav", SR, (out * 32767).clip(-32768, 32767).astype(np.int16))
run("ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", WORK + "/out/o_%04d.png", "-i", WORK + "/mix.wav",
    "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-shortest", OUT)
json.dump({"frames": N, "src": [list(s[1]) if s[1] else None for s in seq], "game": [round(s[2], 3) for s in seq]},
          open(WORK + "/map.json", "w"))
print("saved", OUT, "peak", round(pk, 3))
