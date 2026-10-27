# 9번 11번 빠른 아래 틸트(2026-10-27) — 세로로 긴 트리 판 한 장에서 위 · 아래 창을 잘라 Veo 첫 판의 시작 · 끝 그림을 만든다.
# 원본 11번 실측: 첫 0.27초에 화면 높이의 2/3만큼 아래로(원본카메라_실측.py). 따로 구운 위쪽 · 끝 그림(S11v4)은 겹치는 자리가 없어
# Veo가 틸트 대신 바꿔 그렸고, 한 장에서 잘라 낸 창(2번 S02v4)일 때만 카메라를 따랐다.
#   python -X utf8 영상_틸트창.py 창 <세로판.png>      → 참고/S11창위.png · S11창아래.png(3:2, 1536×1024 — GPT 고침의 바탕)
#   python -X utf8 영상_틸트창.py 띠 <받은판.png> <이름>  → 영상/시작/<이름>.jpg(16:9 띠, 1920×1080)
import os
import sys

import numpy as np
from PIL import Image

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p9")
TILT = 2 / 3          # 화면(16:9 띠) 높이에 대한 틸트 양
ORN_Y = 0.68          # 아래 창 띠에서 빨간 장식 공 가운데가 오는 높이(S11a와 같은 자리)


def red_center(im):
    a = np.asarray(im.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r > 120) & (r > g * 2.2) & (r > b * 2.0)
    m[: a.shape[0] // 2] = False            # 아래 절반의 빨간 장식 공만
    ys, xs = np.nonzero(m)
    return (float(np.median(xs)), float(np.median(ys))) if len(ys) else None


def windows(plate_path):
    im = Image.open(plate_path).convert("RGB")
    w, h = im.size
    wh = round(w * 2 / 3)                    # 3:2 창 높이
    band = w * 9 / 16                        # 그 안의 16:9 띠 높이
    off = (wh - band) / 2
    shift = round(TILT * band)
    c = red_center(im)
    if c is None:
        raise SystemExit("빨간 장식 공을 못 찾음")
    yb = round(c[1] - off - ORN_Y * band)
    yb = max(shift, min(yb, h - wh))
    yt = yb - shift
    for name, y in (("S11창위", yt), ("S11창아래", yb)):
        im.crop((0, y, w, y + wh)).resize((1536, 1024), Image.LANCZOS).save(os.path.join(V, "참고", f"{name}.png"))
    print(f"판 {w}x{h} · 장식 공 {c[0]:.0f},{c[1]:.0f} · 위 창 y={yt} · 아래 창 y={yb} · 틸트 {shift}px(띠 {band:.0f}px의 {shift / band:.2f})")


def band(src, name):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    nh = round(w * 9 / 16)
    t = (h - nh) // 2
    im.crop((0, t, w, t + nh)).resize((1920, 1080), Image.LANCZOS).save(os.path.join(V, "영상", "시작", f"{name}.jpg"), quality=94)
    print(name, "←", src)


if __name__ == "__main__":
    if sys.argv[1] == "창":
        windows(sys.argv[2])
    elif sys.argv[1] == "띠":
        band(sys.argv[2], sys.argv[3])
