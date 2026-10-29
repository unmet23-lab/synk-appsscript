# 시즌 1 「옆집의 크리스마스」 — 시댄스 2.5 무제한 날 웹에 올릴 시작 · 끝 그림만 한 폴더로(2026-10-29).
#   python -X utf8 시댄스그림.py        → git 밖 <밖>/시댄스/C01.jpg · C05e.jpg …(지시문/영상_시댄스웹.json의 「그림」 · 「끝그림」 이름 그대로)
#                                         · <밖>/시댄스/_전후_확인대기.jpg(확정 뒤 고친 그림 — 유호님 확인 대기)
# 색 · 밝기는 손대지 않는다(장부 공통 원칙 3) — 자르기 · 줄이기 · 좌우 뒤집기만. 1920×1080 JPG.
# 시작 그림: 고정 컷은 고른 판(컷/C##.jpg — 고정 와이드 1 · 12 · 20 · 26 · 35는 합성 판), 움직이는 컷은 시작 창(컷/C##_처음.jpg — 카메라무브.py 자르기),
# 사람을 따라 크게 도는 19 · 30은 고른 판 전체(끝 그림을 따로 구운 컷). 끝 그림은 세 컷만(02_콘티 11절):
# 5(세로 4:3 판의 아래 창) · 30(따로 구운 끝 그림) · 34(고개를 창 쪽으로 돌린 C34t2를 34의 끝 창으로). 19의 끝 그림 C19e는 시작과 같은 구도라 안 쓴다.
import importlib.util
import os
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors")
OUT = V / "시댄스"
spec = importlib.util.spec_from_file_location("cm", HERE / "카메라무브.py")
cm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cm)
W, H = 1920, 1080

FIXED = {1, 10, 12, 13, 20, 26, 31, 35}          # 시작 그림 = 고른 판 그대로
FULL = {19: "C19", 30: "C30"}                     # 시작 그림 = 고른 판 전체(정지컷)
ENDS = {5: "창", 30: "C30e", 34: "C34t2"}   # 끝 그림을 쓰는 컷
TRIM_TOP = {22: 0.03}   # 22 — 첫 프레임 위 끝에 걸린 턱 · 아랫입술(y 0~20px)을 잘라 냄 — 위 3%를 잘라 1.03배로(정한 것 ①, 10-29 Fable P2)
FLIP = {21}                                       # 10-29 일관성 검수 — 20(난간 오른쪽 · 민재 문은 왼쪽)과 복도 방향을 맞춤(19와 같은 고침)
# 10-29 일관성 검수로 고쳐 구운 판 — 받은 판을 이미지콘티_고르기.py로 정지컷/<이름>.png에 둔 뒤 여기에 적는다. 유호님 확인 전(확인 대기).
# 확인에서 「옛 판」이면 이 줄을 지우고 다시 돌린다.
FIXES = {"C18": "C18v", "C05": "C05v", "C19": "C19v",   # 18 난간 너머 낮은 주택가 · 5 · 19 콘크리트 난간(10-29 03:3x 받은 판)
         "C11": "C11v", "C28": "C28v"}                  # 11 하늘 · 동네를 같은 밤으로 · 28 문 위 등을 2 · 29의 유리 갓으로(10-29 16:4x, 아르곤)


def still(name):
    """고른 판(정지컷 png) — 고친 판이 있으면 그것"""
    return cm.imread(V / "정지컷" / f"{FIXES.get(name, name)}.png")


def fit(img):
    return cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA) if img.shape[1] != W or img.shape[0] != H else img


def start_end(n):
    cid = f"C{n:02d}"
    a_win, b_win = cm.cut_windows(cid)
    if n in FULL:
        a = fit(still(FULL[n]))
    elif n in FIXED:
        a = fit(still(cid))
    elif cid in FIXES:   # 고친 판에서 같은 시작 창을 다시 자른다
        a = cm.crop(still(cid), a_win)
    else:
        a = cm.imread(V / "컷" / f"{cid}_처음.jpg")
    b = None
    if n in ENDS:
        e = ENDS[n]
        if e == "창":   # 같은 판의 끝 창(5 — 세로 4:3 판의 아래 창)
            b = cm.crop(still(cid), b_win)
        elif n in FULL:
            b = fit(still(e))
        else:           # 따로 구운 끝 모습(34 — C34t2)을 그 컷의 끝 창으로
            b = cm.crop(still(e), b_win)
    if n in TRIM_TOP:
        f = TRIM_TOP[n]
        h, w = a.shape[:2]
        nh, nw = round(h * (1 - f)), round(w * (1 - f))
        x0 = (w - nw) // 2
        a = cv2.resize(a[h - nh:, x0:x0 + nw], (W, H), interpolation=cv2.INTER_LANCZOS4)
    if n in FLIP:
        a = cv2.flip(a, 1)
        b = cv2.flip(b, 1) if b is not None else None
    return a, b


def before_after():
    """확정 뒤 바뀐 그림 — 옛 판 | 새 판(유호님 확인 대기)"""
    rows = []
    for n in sorted(FLIP | {int(k[1:3]) for k in FIXES}):
        cid = f"C{n:02d}"
        old = cm.imread(V / "컷" / f"{cid}_처음.jpg") if (V / "컷" / f"{cid}_처음.jpg").exists() and n not in FIXED | set(FULL) else fit(cm.imread(V / "정지컷" / f"{cid}.png"))
        new = cm.imread(OUT / f"{cid}.jpg")
        rows.append((f"{n} 옛 판", old, f"{n} 새 판", new))
        if n in ENDS and (OUT / f"{cid}e.jpg").exists():
            oe = fit(cm.imread(V / "정지컷" / f"{ENDS[n]}.png")) if n in FULL else cm.imread(V / "컷" / f"{cid}_끝.jpg")
            rows.append((f"{n} 끝 옛 판", oe, f"{n} 끝 새 판", cm.imread(OUT / f"{cid}e.jpg")))
    if not rows:
        return
    tw, th = 960, 540
    sheet = np.full((len(rows) * (th + 10), 2 * tw + 10, 3), 30, np.uint8)
    for i, (la, a, lb, b) in enumerate(rows):
        y = i * (th + 10)
        for j, im in enumerate((a, b)):
            x = j * (tw + 10)
            sheet[y:y + th, x:x + tw] = cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA)
    cm.imwrite(OUT / "_전후_확인대기.jpg", sheet)
    # 꼬리표(한글)는 PIL로
    from PIL import Image, ImageDraw, ImageFont
    im = Image.open(OUT / "_전후_확인대기.jpg")
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 28)
    for i, (la, _, lb, _) in enumerate(rows):
        y = i * (th + 10)
        for j, lab in enumerate((la, lb)):
            x = j * (tw + 10)
            d.rectangle((x, y, x + 20 + 22 * len(lab), y + 40), fill=(255, 230, 0))
            d.text((x + 8, y + 4), lab, font=f, fill=(0, 0, 0))
    im.save(OUT / "_전후_확인대기.jpg", quality=90)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    only = [int(a) for a in sys.argv[1:]] or range(1, 37)
    for n in only:
        a, b = start_end(n)
        cm.imwrite(OUT / f"C{n:02d}.jpg", a, 95)
        if b is not None:
            cm.imwrite(OUT / f"C{n:02d}e.jpg", b, 95)
        print(f"C{n:02d}", "시작" + (" · 끝" if b is not None else "") + (" · 좌우 뒤집음" if n in FLIP else "") + (" · 고친 판" if f"C{n:02d}" in FIXES else ""))
    before_after()
    print("→", OUT)
