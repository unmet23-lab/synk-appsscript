# 블프 세일 이미지 콘티 합성(2026-10-26, 경로 D) — 굽은 사람 컷 위에 AI로 그리지 않는 글자를 얹는다.
#   python -X utf8 이미지콘티_합성.py [--판 x0,y0,x1,y1]
#   ① 정지컷/C01.png의 어두운 전광판 자리에 G01전광판.png(「자정까지 00:59:59」)를 얹어 C01_합성.png — 판 자리는 굽은 그림에서 찾는다
#      (위쪽 1/3에서 가장 어둡고 넓은 가로 띠). 찾은 자리가 어긋나면 --판으로 1080×1920 기준 좌표를 준다.
#   ⑬ 정지컷/C13.png 위 절반(0–830px)에 G13위.png(끝 카드)를 덮어 C13_합성.png.
import os, sys
import numpy as np
from PIL import Image

HOME = os.environ["USERPROFILE"]
S = os.path.join(HOME, "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale", "정지컷")
W, H = 1080, 1920


def fit(p):
    im = Image.open(p).convert("RGB")
    if im.size != (W, H):   # 9:16이 아니면 가운데를 9:16으로 잘라 맞춘다
        r = im.width / im.height
        if r > W / H:
            nw = int(im.height * W / H); im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
        else:
            nh = int(im.width * H / W); im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
        im = im.resize((W, H), Image.LANCZOS)
    return im


def find_panel(im):
    g = np.asarray(im.convert("L")).astype(np.float32)
    top = g[: H // 3]
    best, box = 1e9, None
    for y in range(120, H // 3 - 80, 8):
        for x in range(120, W - 420, 12):
            for (w, h) in ((330, 96), (380, 110), (300, 86)):
                if x + w > W or y + h > H // 3:
                    continue
                m = top[y:y + h, x:x + w].mean()
                if m < best:
                    best, box = m, (x, y, x + w, y + h)
    return box, best


def c01(box=None):
    p = os.path.join(S, "C01.png")
    if not os.path.exists(p):
        print("C01.png 없음 — 고른 판을 정지컷에 두고 다시"); return
    im = fit(p)
    if box is None:
        box, m = find_panel(im)
        print("전광판 자리", box, "밝기", round(m, 1))
    x0, y0, x1, y1 = box
    led = Image.open(os.path.join(S, "G01전광판.png")).convert("RGBA").resize((x1 - x0, y1 - y0), Image.LANCZOS)
    base = im.convert("RGBA")
    base.alpha_composite(led, (x0, y0))
    base.convert("RGB").save(os.path.join(S, "C01_합성.png"))


def c13():
    p = os.path.join(S, "C13.png")
    if not os.path.exists(p):
        print("C13.png 없음"); return
    im = fit(p).convert("RGBA")
    top = Image.open(os.path.join(S, "G13위.png")).convert("RGBA")
    im.alpha_composite(top, (0, 0))
    im.convert("RGB").save(os.path.join(S, "C13_합성.png"))


if __name__ == "__main__":
    box = None
    if "--판" in sys.argv:
        box = tuple(int(v) for v in sys.argv[sys.argv.index("--판") + 1].split(","))
    c01(box)
    c13()
    print("ok")
