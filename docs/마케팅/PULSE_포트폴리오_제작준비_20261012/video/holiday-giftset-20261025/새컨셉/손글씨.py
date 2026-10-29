# -*- coding: utf-8 -*-
"""창 서리에 손가락으로 쓴 말 — 닦인 자국 지도 (2026-10-29, 안 3 「창에 쓴 말」 시안, 크레딧 0).

글자는 그림 모델이 쓰지 않는다. 우리 글꼴(Noto Sans KR)로 쓴 글자의 뼈대(가운데 선)만 뽑아 손끝 폭으로 다시 긋고,
녹은 물이 획 아래로 흘러내린 자국을 더한다. 첫 판(글꼴 모양 그대로 굵힘)은 시청자 시험에서 「손글씨가 아니라 굵은 고딕 ·
검은 페인트」로 읽혔다. 블렌더 안 파이썬에는 PIL이 없어 바깥에서 만들어 시안.py가 .npy로 읽는다.

    python -I -X utf8 손글씨.py --text "꼭 바르고|나가" --box 0.14,0.47,0.86,0.62 --name 바르고 [--n 2048] [--seed 7]
산출: <밖>/새컨셉/결정/글자_<name>.npy — 창 서리 칸(window 시뮬레이션의 가운데를 창 폭만큼 자른 꼴)과 같은 크기, 0~1

2판(Fable 10-29 「두 손 = 두 글씨」 · 「획이 펜처럼 가늘다」): 손끝 폭을 글자 높이의 1/8~1/7로(1/5는 「르」 · 「꼭」의 획이 붙어 덩어리가 됐다), 사람마다 손을 따로 —
  새벽 사람(작고 가지런히 · 오른쪽 기울기):  --hand 새벽     밤 사람(크고 눌러 쓴 획 · 느슨하게):  --hand 밤
  손을 주면 --finger · --slant · --jitter · --press를 그 손의 값으로 채운다(따로 준 값이 이긴다). --finger는 글자 높이에 대한 비율.
"""
import argparse
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from skimage.morphology import skeletonize

ap = argparse.ArgumentParser()
ap.add_argument("--text", required=True, help="줄은 | 로 나눈다")
ap.add_argument("--box", required=True, help="x0,y0,x1,y1 — 창 칸 안 비율")
ap.add_argument("--name", required=True)
ap.add_argument("--n", type=int, default=2048)
ap.add_argument("--aspect", type=float, default=0.62)
ap.add_argument("--seed", type=int, default=7)
ap.add_argument("--hand", choices=["새벽", "밤"], default=None)
ap.add_argument("--finger", type=float, default=None, help="획 폭(글자 높이에 대한 비율)")
ap.add_argument("--slant", type=float, default=None, help="오른쪽 기울기(도)")
ap.add_argument("--jitter", type=float, default=None, help="글자마다 크기 · 기울기 · 줄 높이 흔들림(1 = 첫 판)")
ap.add_argument("--press", type=float, default=None, help="획 굵기 흔들림(눌러 쓴 손일수록 큼)")
ap.add_argument("--track", type=float, default=None, help="글자 사이(글자 크기에 대한 비율)")
ap.add_argument("--drips", type=int, default=0, help="흘러내린 물줄기 수(14는 공포 글씨, 5도 손 없이 「귀신이 쓴 글」로 읽혔다 — 10-29 볼 이유 심사)")
a = ap.parse_args()
HAND = {"새벽": dict(finger=0.12, slant=9.0, jitter=0.70, press=0.08, track=0.90),
        "밤": dict(finger=0.13, slant=-2.0, jitter=1.25, press=0.22, track=0.97)}.get(a.hand, {})
for k, v in dict(finger=0.17, slant=0.0, jitter=1.0, press=0.12, track=0.94).items():
    if getattr(a, k) is None:
        setattr(a, k, HAND.get(k, v))

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset",
                 "새컨셉", "결정")
Hh, Ww = a.n, int(round(a.n * a.aspect))
img = Image.new("L", (Ww, Hh), 0)
x0, y0, x1, y1 = [float(v) for v in a.box.split(",")]
x0, x1, y0, y1 = int(x0 * Ww), int(x1 * Ww), int(y0 * Hh), int(y1 * Hh)
lines = a.text.split("|")
lh = (y1 - y0) / max(1, len(lines))
rng = random.Random(a.seed)
font_path = "C:/Windows/Fonts/NotoSansKR-VF.ttf"
J = a.jitter
size = int(lh * 0.78)
for i, line in enumerate(lines):
    font = ImageFont.truetype(font_path, size)
    try:
        font.set_variation_by_name("Regular")
    except Exception:
        pass
    x = x0 + rng.uniform(-0.02, 0.02) * J * (x1 - x0)
    drift = 0.0
    for ch in line:
        if ch == " ":
            x += size * 0.40
            continue
        glyph = Image.new("L", (int(size * 1.6), int(size * 1.6)), 0)
        ImageDraw.Draw(glyph).text((size * 0.2, size * 0.05), ch, fill=255, font=font)
        # 기울기(손마다) — 아래를 고정하고 위를 옆으로 민다
        sh = np.tan(np.radians(a.slant + rng.uniform(-3, 3) * J))
        glyph = glyph.transform(glyph.size, Image.AFFINE, (1, sh, -sh * glyph.height * 0.8, 0, 1, 0), resample=Image.BICUBIC)
        glyph = glyph.rotate(rng.uniform(-6, 6) * J, resample=Image.BICUBIC)
        sc = 1.0 + rng.uniform(-0.08, 0.08) * J  # 손으로 쓴 글자는 크기가 들쭉날쭉
        glyph = glyph.resize((int(glyph.width * sc), int(glyph.height * sc)), Image.BICUBIC)
        drift += rng.uniform(-0.03, 0.03) * J  # 느슨한 손은 줄이 오르내린다
        img.paste(255, (int(x), int(y0 + i * lh + (rng.uniform(-0.05, 0.05) * J + drift) * size)), glyph)
        x += size * (a.track + rng.uniform(-0.06, 0.06) * J)

# 손이 그은 흔들림 — 글자 판 전체를 느리게 출렁이는 변위로 휜다(글꼴 뼈대 그대로면 둥근 고딕으로 읽혔다)
src = np.asarray(img, np.float32) / 255.0
wr = np.random.default_rng(a.seed + 1)
amp = size * 0.045 * (0.6 + 0.4 * J)  # 0.055는 「가」가 「까」처럼 갈라졌다
sm = (src.shape[0] // 16 + 1, src.shape[1] // 16 + 1)  # 느린 변위라 1/16 크기에서 흐리고 키운다(큰 시그마를 원본에 걸면 1분 넘게 걸림)
dy = ndimage.zoom(ndimage.gaussian_filter(wr.random(sm).astype(np.float32) - 0.5, size * 0.26 / 16), 16, order=1)[:src.shape[0], :src.shape[1]]
dx = ndimage.zoom(ndimage.gaussian_filter(wr.random(sm).astype(np.float32) - 0.5, size * 0.26 / 16), 16, order=1)[:src.shape[0], :src.shape[1]]
dy *= amp / (np.abs(dy).max() + 1e-9)
dx *= amp / (np.abs(dx).max() + 1e-9)
yy0, xx0 = np.mgrid[0:src.shape[0], 0:src.shape[1]].astype(np.float32)
src = ndimage.map_coordinates(src, [yy0 + dy, xx0 + dx], order=1)
del yy0, xx0, dx, dy
# 손끝은 각을 못 낸다 — 글자를 흐린 뒤 뼈대를 뽑아 꺾인 모서리를 둥글게(글꼴 각이 남으면 「반듯한 인쇄 폰트」로 읽혔다, 10-29 재시험 2회차)
src = ndimage.gaussian_filter(src.astype(np.float32), size * 0.035) > 0.5

# 뼈대만 남겨 손끝 폭으로 다시 긋기 — 획 끝이 둥글고 굵기가 고른 손가락 자국
skel = skeletonize(src)
# 획마다 조금씩 어긋나게 — 갈림목에서 뼈대를 끊어 토막마다 따로 밀고 살짝 돌린다(손으로 그은 획은 이음매가 딱 맞지 않는다)
nb = ndimage.convolve(skel.astype(np.uint8), np.ones((3, 3), np.uint8), mode="constant") - 1
joint = ndimage.binary_dilation(skel & (nb >= 3), iterations=3)
segs, nseg = ndimage.label(skel & ~joint, structure=np.ones((3, 3)))
srng = np.random.default_rng(a.seed + 3)
sy, sx = np.nonzero(segs)
lab = segs[sy, sx]
off_y = srng.normal(0, size * 0.016 * J, nseg + 1)
off_x = srng.normal(0, size * 0.016 * J, nseg + 1)
rot = np.radians(srng.normal(0, 4.0 * J, nseg + 1))
cy = ndimage.mean(sy, labels=lab, index=np.arange(nseg + 1)) if nseg else np.zeros(1)
cx = ndimage.mean(sx, labels=lab, index=np.arange(nseg + 1)) if nseg else np.zeros(1)
cy, cx = np.nan_to_num(np.asarray(cy)), np.nan_to_num(np.asarray(cx))
ry, rx = sy - cy[lab], sx - cx[lab]
ny = np.clip(np.round(cy[lab] + ry * np.cos(rot[lab]) - rx * np.sin(rot[lab]) + off_y[lab]), 0, skel.shape[0] - 1).astype(int)
nx = np.clip(np.round(cx[lab] + ry * np.sin(rot[lab]) + rx * np.cos(rot[lab]) + off_x[lab]), 0, skel.shape[1] - 1).astype(int)
moved = np.zeros_like(skel)
moved[ny, nx] = True
skel = moved | (skel & joint)
dist = ndimage.distance_transform_edt(~skel)
r = a.finger * size / 2
wob = ndimage.gaussian_filter(np.random.default_rng(a.seed).random(skel.shape).astype(np.float32), max(6.0, size * 0.25))
wob = (wob - wob.mean()) / (wob.std() + 1e-6)
rr = r * (1.0 + a.press * wob)
edge = ndimage.gaussian_filter(np.random.default_rng(a.seed + 2).random(skel.shape).astype(np.float32) - 0.5, 1.6)
edge *= 4.0 / (np.abs(edge).max() + 1e-9)  # 서리가 고르게 안 지워진 획 가장자리(±4 px)
# 가장자리는 6 px에 걸쳐 흐리게 — 칼같이 끊긴 가장자리가 시험 세 번 내리 「펜 · 인쇄 · 자막」으로 읽혔다(10-29 GPT 시험관)
m = np.clip((rr + 3.0 - dist + edge) / 6.0, 0, 1)

# 흘러내린 물줄기 — 획 아래 끝에서 가늘게(녹은 서리 물이 아래로 흐른 자국)
H, W = m.shape
ys, xs = np.nonzero(skel)
if len(ys):
    order = np.argsort(-ys)
    cand = list(zip(ys[order], xs[order]))[: max(1, len(ys) // 3)]
    rng.shuffle(cand)
    for yy, xx in cand[: a.drips]:
        L = int(rng.uniform(0.008, 0.024) * H)
        w0 = r * rng.uniform(0.35, 0.6)
        for k in range(L):
            y = yy + int(r * 0.6) + k
            if y >= H:
                break
            w = w0 * (1 - k / L) ** 0.6
            xc = xx + int(2 * np.sin(k * 0.05 + yy))
            lo, hi = max(0, int(xc - w - 1)), min(W, int(xc + w + 2))
            xsl = np.arange(lo, hi)
            m[y, lo:hi] = np.maximum(m[y, lo:hi], np.clip(w + 0.5 - np.abs(xsl - xc), 0, 1))
        # 물줄기 끝 방울
        yb = min(H - 1, yy + int(r * 0.6) + L)
        rb = int(w0 * 2) + 2
        yyb, xxb = np.ogrid[-rb:rb + 1, -rb:rb + 1]
        blob = np.clip(w0 * 1.3 + 0.5 - np.sqrt(yyb ** 2 + xxb ** 2), 0, 1)
        ys0 = (yb + yyb + 0 * xxb).ravel()
        xs0 = (xx + xxb + 0 * yyb).ravel()
        ok = (ys0 >= 0) & (ys0 < H) & (xs0 >= 0) & (xs0 < W)
        m[ys0[ok], xs0[ok]] = np.maximum(m[ys0[ok], xs0[ok]], blob.ravel()[ok])
m = ndimage.gaussian_filter(m, 0.8).astype(np.float32)
# 손끝이 밀어낸 서리 둔덕 — 획 바로 바깥에 서리가 조금 두껍게 쌓인 테(Fable 10-29: 테가 없어 「종이 위 붓펜」으로 읽혔다)
far = ndimage.distance_transform_edt(m < 0.5)
rim = np.clip(1.0 - np.abs(far - r * 0.55) / (r * 0.5), 0, 1) * (m < 0.5)
rim = ndimage.gaussian_filter(rim.astype(np.float32), 1.0).astype(np.float32)
os.makedirs(밖, exist_ok=True)
np.save(os.path.join(밖, f"글자_{a.name}.npy"), m)
np.save(os.path.join(밖, f"글자_{a.name}_테.npy"), rim)
Image.fromarray((m * 255).astype(np.uint8)).resize((Ww // 4, Hh // 4)).save(os.path.join(밖, f"글자_{a.name}_미리.png"))
print("저장", os.path.join(밖, f"글자_{a.name}.npy"), m.shape)
