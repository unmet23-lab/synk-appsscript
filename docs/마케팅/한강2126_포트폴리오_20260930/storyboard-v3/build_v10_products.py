# -*- coding: utf-8 -*-
"""v10 오프닝: 얼굴 컷은 뮤직비디오 방식(고정 얼굴 세트 → 정지컷 → 3초 이어 그리기), 나머지는 v9 재료. 템포 12초 안팎.

    python build_v10_products.py <Wan d판.mp4> <Wan a판.mp4> <시작 클로즈업.mp4> <누운 컷.mp4> <클락션.wav> <게임 녹화.webm> <게임 음악.mp3> <작업 폴더> <결과.mp4>

흐름: 기기를 이마에 올린 채 폰을 보다 기기를 내려 씀(얼굴 보임) → 빠르게 물러나 넓은 미끄러짐 → 기기로 밀고 들어가 유리 속 실제 게임
→ 컵 → 까몽 → 시간이 돌아와 넘어짐 → 누워서 기기를 올리고 하늘을 봄(얼굴 보임) → 건물, 하늘이 갬.
"""
import json, os, subprocess, sys
import cv2, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SRC_D, SRC_A, SRC_E, SRC_F, HORN_WAV, GAME_WEBM, MUSIC, WORK, OUT = sys.argv[1:10]
W, H, FPS, SR = 480, 854, 30, 48000
SPF = SR // FPS
GAME_T0 = 20.40
G_DIVE, G_FULL, G_EXIT = 16, 30, 60
N_DIVE, N_FULL, N_EXIT = 14, 24, 12
F_DIVE, F_EXIT = 100, 120
ZMAX = 1.8
CUPZ, CUPC = 1.5, (235, 370)
E_USE = int(os.environ.get("E_USE", "78"))     # 시작 클로즈업에서 쓰는 프레임 수
F_USE = int(os.environ.get("F_USE", "60"))     # 누운 컷에서 쓰는 프레임 수
D_IN = 21


def run(*a):
    subprocess.run(a, check=True, capture_output=True)


for sub in ("srcD", "srcA", "srcE", "srcF", "game", "out"):
    os.makedirs(WORK + "/" + sub, exist_ok=True)
for take, src in (("D", SRC_D), ("A", SRC_A), ("E", SRC_E), ("F", SRC_F)):
    if not os.path.exists(WORK + "/src%s/f_0030.png" % take):
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "fps=30,scale=480:854", WORK + "/src%s/f_%%04d.png" % take)
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


seq = []


def nat(a, b, take="D"):
    for n in range(a, b + 1):
        seq.append((load(n, take), (take, n), 0.0))


def mix(a, b, t):
    return a * (1 - t) + b * t


def retime(take, a, b, speed_mid, ramp=0.25):
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


# 0) 시작: 기기를 이마에 올린 채 폰을 보다 기기를 내려 쓴다(얼굴 보임) -> 놀라기 전에 빠르게 물러나 넓은 미끄러짐으로
nat(1, E_USE - 2, "E")
a = radial_blur(load(E_USE - 1, "E"), 240, 300, 0.18)
b = radial_blur(load(E_USE, "E"), 240, 300, 0.45)
wc = (230, 400)
c = radial_blur(zoom(load(D_IN), 2.0, *wc), wc[0], wc[1], 0.45)
d = radial_blur(zoom(load(D_IN + 1), 1.35, *wc), wc[0], wc[1], 0.20)
e = radial_blur(zoom(load(D_IN + 2), 1.10, *wc), wc[0], wc[1], 0.06)
f = zoom(load(D_IN + 3), 1.03, *wc)
seq += [(a, ("E", E_USE - 1), 0.0), (mix(b, c, 0.3), ("E", E_USE), 0.0), (mix(b, c, 0.7), ("D", D_IN), 0.0),
        (d, ("D", D_IN + 1), 0.0), (e, ("D", D_IN + 2), 0.0), (f, ("D", D_IN + 3), 0.0)]
# 1) 미끄러짐(넓게) -> 기기로 밀고 들어감
nat(D_IN + 4, 44)
hd = (205, 325)
a = radial_blur(zoom(load(45), 1.7, hd[0], hd[1], 215, 380), 215, 380, 0.30)
b = radial_blur(zoom(load(46), 3.4, hd[0], hd[1], 225, 415), 225, 415, 0.60)
c = radial_blur(load(73), 230, 420, 0.40)
d = radial_blur(load(74), 230, 420, 0.18)
e = radial_blur(load(75), 230, 420, 0.06)
seq += [(a, ("D", 45), 0.0), (mix(b, c, 0.25), ("D", 46), 0.0), (mix(b, c, 0.75), ("D", 73), 0.0), (d, ("D", 74), 0.0), (e, ("D", 75), 0.0)]
retime("D", 76, F_DIVE - 1, 1.6)
# 2) 유리 속 게임
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
    seq.append((game(G_FULL + 6 + k), None, 1.0))
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
retime("D", F_EXIT + N_EXIT, 147, 1.6)
# 3) 컵
a = radial_blur(load(148), 235, 440, 0.14)
b = radial_blur(load(149), 235, 440, 0.34)
c = radial_blur(zoom(load(150), CUPZ * 1.2, *CUPC), CUPC[0], CUPC[1], 0.34)
d = radial_blur(zoom(load(151), CUPZ * 1.08, *CUPC), CUPC[0], CUPC[1], 0.14)
e = zoom(load(152), CUPZ * 1.02, *CUPC)
seq += [(a, ("D", 148), 0.0), (mix(b, c, 0.3), ("D", 149), 0.0), (mix(b, c, 0.7), ("D", 150), 0.0), (d, ("D", 151), 0.0), (e, ("D", 152), 0.0)]
for n in range(166, 184):
    seq.append((zoom(load(n), CUPZ, *CUPC), ("D", n), 0.0))
# 4) 까몽
a = dir_blur(shift(zoom(load(184), CUPZ, *CUPC), -24), 60)
b = dir_blur(shift(zoom(load(185), CUPZ, *CUPC), -100), 190)
c = dir_blur(shift(load(186), 100), 190)
d = dir_blur(shift(load(187), 24), 60)
seq += [(a, ("D", 184), 0.0), (mix(b, c, 0.3), ("D", 185), 0.0), (mix(b, c, 0.7), ("D", 186), 0.0), (d, ("D", 187), 0.0)]
retime("D", 188, 228, 2.4)
nat(229, 240)
retime("D", 248, 262, 2.0)
# 5) 시간이 돌아와 넘어짐
sc = (225, 420)
a = radial_blur(load(263), 175, 500, 0.16)
b = radial_blur(load(264), 175, 500, 0.36)
c = radial_blur(zoom(load(265), 1.45, *sc), sc[0], sc[1], 0.36)
d = radial_blur(zoom(load(266), 1.20, *sc), sc[0], sc[1], 0.16)
e = zoom(load(267), 1.07, *sc)
seq += [(a, ("D", 263), 0.0), (mix(b, c, 0.3), ("D", 264), 0.0), (mix(b, c, 0.7), ("D", 265), 0.0), (d, ("D", 266), 0.0), (e, ("D", 267), 0.0)]
nat(268, 296)
# 6) 누워서 기기를 올리고 하늘을 봄(얼굴 보임, 뮤직비디오 방식 컷)
bc = (245, 585)
a = radial_blur(zoom(load(297), 1.6, bc[0], bc[1], 240, 540), 240, 540, 0.30)
b = radial_blur(zoom(load(298), 3.0, bc[0], bc[1], 235, 500), 235, 500, 0.60)
c = radial_blur(load(1, "F"), 200, 480, 0.40)
d = radial_blur(load(2, "F"), 200, 480, 0.18)
e = radial_blur(load(3, "F"), 200, 480, 0.06)
seq += [(a, ("D", 297), 0.0), (mix(b, c, 0.25), ("D", 298), 0.0), (mix(b, c, 0.75), ("F", 1), 0.0), (d, ("F", 2), 0.0), (e, ("F", 3), 0.0)]
nat(4, F_USE - 2, "F")
# 7) 건물로: 위로 휙 올라가 건물, 하늘이 갠다(a판 392~450)
a = dir_blur(shift(load(F_USE - 1, "F"), 0, 30), 0, 80)
b = dir_blur(shift(load(F_USE, "F"), 0, 110), 0, 220)
c = dir_blur(shift(load(392, "A"), 0, -110), 0, 220)
d = dir_blur(shift(load(393, "A"), 0, -30), 0, 80)
seq += [(a, ("F", F_USE - 1), 0.0), (mix(b, c, 0.3), ("F", F_USE), 0.0), (mix(b, c, 0.7), ("A", 392), 0.0), (d, ("A", 393), 0.0)]
retime("A", 394, 450, 1.2)

N = len(seq)
i_ret = [k for k in range(N) if seq[k][1] == ("D", 265)][0]
i_top = [k for k in range(N) if seq[k][1] == ("A", 420)][0]
for k in range(i_ret, N):
    gq = smooth((k - i_ret) / float(i_top - i_ret))
    im = clear_sky(seq[k][0], gq) * (1 + 0.04 * gq)
    seq[k] = (im, seq[k][1], seq[k][2])
for i, (im, key, ga) in enumerate(seq):
    cv2.imwrite("%s/out/o_%04d.png" % (WORK, i + 1), im.clip(0, 255).astype(np.uint8))
print("frames", N, "seconds", round(N / FPS, 2))

# ---- 소리 ----
run("ffmpeg", "-v", "error", "-y", "-i", SRC_D, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/take.wav")
run("ffmpeg", "-v", "error", "-y", "-i", SRC_E, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/takeE.wav")
run("ffmpeg", "-v", "error", "-y", "-i", SRC_F, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", WORK + "/takeF.wav")
run("ffmpeg", "-v", "error", "-y", "-ss", "59.6", "-i", MUSIC, "-t", "4", "-ac", "2", "-ar", str(SR),
    "-c:a", "pcm_s16le", WORK + "/music.wav")


def rd(p):
    return wavfile.read(p)[1].astype(np.float32) / 32768.0


A_, E_, F_, MU, HN = rd(WORK + "/take.wav"), rd(WORK + "/takeE.wav"), rd(WORK + "/takeF.wav"), rd(WORK + "/music.wav"), rd(HORN_WAV)
A_ = np.vstack([A_, np.zeros((SR, 2), np.float32)])
E_ = np.vstack([E_, np.zeros((SR, 2), np.float32)])
F_ = np.vstack([F_, np.zeros((SR, 2), np.float32)])
XF = 480
# 소리 자리: d판 프레임은 d판 소리, 시작·누운 컷은 그 클립의 소리, 게임·a판 프레임은 d판 소리를 이어서(끝을 넘으면 되감기)
src = []
last = None
for im, key, ga in seq:
    if key is not None and key[0] in ("D", "E", "F"):
        src.append(key)
        last = key[1] if key[0] == "D" else (last or 1)
    else:
        last = last + 1
        if last > 446:
            last -= 45
        src.append(("D", last))
out = np.zeros((N * SPF + SR, 2), np.float32)
banks = {"D": A_, "E": E_, "F": F_}
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
    p0 = i * SPF
    out[p0:p0 + len(seg)] += seg
    i = j + 1


def take_gain(key):
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
xs = np.arange(N * SPF) / float(SPF)
out = out[:N * SPF]
out *= np.interp(xs, np.arange(N + 1), gf).astype(np.float32)[:, None]
i_dive = [k for k in range(N) if seq[k][2] > 0][0]
env = np.interp(xs, np.arange(N + 1), ga).astype(np.float32)
env = np.convolve(env, np.ones(960, np.float32) / 960, mode="same")
mu = np.zeros_like(out)
p0 = i_dive * SPF
L = min(len(MU), len(out) - p0)
mu[p0:p0 + L] = MU[:L]
out += mu * env[:, None] * 0.55


def muffle(x, hz=750.0):
    b_, a_ = butter(2, hz / (SR / 2))
    return lfilter(b_, a_, x, axis=0).astype(np.float32)


# 기기를 내려 쓰는 순간(시작 컷 1.6초)부터 기기 밖으로 새는 먹먹한 게임 음악과 클락션, VR 안에서 또렷한 클락션
e_on = int(1.6 * SR)
e_end = [k for k in range(N) if seq[k][1] is not None and seq[k][1][0] == "E"][-1]
L_e = (e_end + 1) * SPF
bed = np.zeros_like(out)
bed[e_on:L_e] = MU[:L_e - e_on]
fade = np.zeros(len(out), np.float32)
fade[e_on:e_on + int(0.25 * SR)] = np.linspace(0, 1, int(0.25 * SR))
fade[e_on + int(0.25 * SR):L_e - int(0.06 * SR)] = 1
fade[L_e - int(0.06 * SR):L_e] = np.linspace(1, 0, int(0.06 * SR))
out += muffle(bed) * fade[:, None] * 0.22
h0 = e_on + int(0.35 * SR)
hm = muffle(HN, 900.0) * 0.5
out[h0:h0 + len(hm)] += hm[:len(out) - h0]
h1 = int(((i_dive + N_DIVE) / FPS + 0.1) * SR)
out[h1:h1 + len(HN)] += HN[:len(out) - h1] * 0.6
pk = float(np.abs(out).max())
if pk > 0.97:
    out *= 0.97 / pk
wavfile.write(WORK + "/mix.wav", SR, (out * 32767).clip(-32768, 32767).astype(np.int16))
run("ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", WORK + "/out/o_%04d.png", "-i", WORK + "/mix.wav",
    "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-shortest", OUT)
json.dump({"frames": N, "src": [list(s) for s in src], "game": [round(s[2], 3) for s in seq]}, open(WORK + "/map.json", "w"))
print("game from", round(i_dive / FPS, 2), "horn", round(h0 / SR, 2), round(h1 / SR, 2), "saved", OUT, "peak", round(pk, 3))
