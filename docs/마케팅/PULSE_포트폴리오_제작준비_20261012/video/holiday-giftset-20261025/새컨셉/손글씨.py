# -*- coding: utf-8 -*-
"""창 서리에 손가락으로 쓴 말 — 닦인 자국 지도 (2026-10-29, 안 3 「창에 쓴 말」 시안, 크레딧 0).

글자는 그림 모델이 쓰지 않는다. 우리 글꼴(Noto Sans KR)로 쓴 글자의 뼈대(가운데 선)만 뽑아 손끝 폭으로 다시 긋고,
녹은 물이 획 아래로 흘러내린 자국을 더한다. 첫 판(글꼴 모양 그대로 굵힘)은 시청자 시험에서 「손글씨가 아니라 굵은 고딕 ·
검은 페인트」로 읽혔다. 블렌더 안 파이썬에는 PIL이 없어 바깥에서 만들어 시안.py가 .npy로 읽는다.

    python -I -X utf8 손글씨.py --text "꼭 바르고|나가" --box 0.14,0.47,0.86,0.62 --name 바르고 [--n 2048] [--seed 7]
산출: <밖>/새컨셉/결정/글자_<name>.npy — 창 서리 칸(window 시뮬레이션의 가운데를 창 폭만큼 자른 꼴)과 같은 크기, 0~1
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
ap.add_argument("--finger", type=float, default=0.0085, help="획 폭(창 폭에 대한 비율)")
ap.add_argument("--drips", type=int, default=5, help="흘러내린 물줄기 수(14는 공포 글씨처럼 읽혔다)")
a = ap.parse_args()

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
for i, line in enumerate(lines):
    size = int(lh * 0.78)
    font = ImageFont.truetype(font_path, size)
    try:
        font.set_variation_by_name("Regular")
    except Exception:
        pass
    x = x0 + rng.uniform(-0.02, 0.02) * (x1 - x0)
    for ch in line:
        if ch == " ":
            x += size * 0.40
            continue
        glyph = Image.new("L", (int(size * 1.6), int(size * 1.6)), 0)
        ImageDraw.Draw(glyph).text((size * 0.2, size * 0.05), ch, fill=255, font=font)
        glyph = glyph.rotate(rng.uniform(-6, 6), resample=Image.BICUBIC)
        sc = rng.uniform(0.92, 1.08)  # 손으로 쓴 글자는 크기가 들쭉날쭉
        glyph = glyph.resize((int(glyph.width * sc), int(glyph.height * sc)), Image.BICUBIC)
        img.paste(255, (int(x), int(y0 + i * lh + rng.uniform(-0.07, 0.07) * size)), glyph)
        x += size * rng.uniform(0.86, 1.02)

# 뼈대만 남겨 손끝 폭으로 다시 긋기 — 획 끝이 둥글고 굵기가 고른 손가락 자국
src = np.asarray(img, np.float32) / 255.0 > 0.5
skel = skeletonize(src)
dist = ndimage.distance_transform_edt(~skel)
r = a.finger * Ww / 2
wob = ndimage.gaussian_filter(np.random.default_rng(a.seed).random(skel.shape).astype(np.float32), 18)
wob = (wob - wob.mean()) / (wob.std() + 1e-6)
rr = r * (1.0 + 0.12 * wob)
m = np.clip((rr + 1.5 - dist) / 3.0, 0, 1)

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
