# 11번 반려동물 이미지 콘티 보드(2026-10-26) — 10행: 원본 첫 프레임 | 우리 그림 | 초 · 화면 · 카메라 · 말 · 자막. 6번 콘티보드.py와 같은 꼴(세로판).
# 글은 02_콘티.md 2절 표에서 그대로 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/p11/)에만 둔다.
#   python -X utf8 콘티보드.py   → 콘티/p11/반려동물_이미지콘티_1~2.jpg(5행씩) · _한눈.jpg(우리 그림 10칸) · _기준.jpg(개 · 조끼 · 민재 기준 그림)
# 우리 그림은 콘티/p11/정지컷/S01.jpg …(받은 판 그대로 — 색 손대지 않음).
import os
import re

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p11")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, LINE = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (60, 58, 62)
ORIG = {n: n for n in range(1, 10)} | {10: 12}   # 우리 컷 → 원본 컷
FW, FH = 300, 533                                 # 세로 그림 칸
TX = 760                                          # 글 칸 너비


def clean(s):
    return re.sub(r"\*\*", "", s).replace("–", "~").replace("—", "-").replace("→", ">").replace("★", "*")


def rows_from_02():
    md = open(os.path.join(HERE, "02_콘티.md"), encoding="utf-8").read()
    sec = md[md.index("## 2. 글 콘티"):md.index("## 3.")]
    out = {}
    for line in sec.splitlines():
        m = re.match(r"\|\s*(\d+)\s*\|(.+)\|\s*$", line)
        if not m:
            continue
        c = [x.strip() for x in m.group(2).split("|")]
        out[int(m.group(1))] = {"t": clean(c[0]), "ours": clean(c[1]), "cam": clean(c[2]), "say": clean(c[3]), "cap": clean(c[4])}
    return out


def wrap(d, text, font, width):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            lines.append(cur)
            cur = ch.lstrip()
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def fit(p):
    if not os.path.exists(p):
        im = Image.new("RGB", (FW, FH), (40, 40, 44))
        ImageDraw.Draw(im).text((20, FH // 2), "아직 없음", font=F("Medium", 26), fill=DIM)
        return im
    im = Image.open(p).convert("RGB")
    s = max(FW / im.width, FH / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - FW) // 2, (im.height - FH) // 2
    return im.crop((x, y, x + FW, y + FH))


def board(rows, ns, path, title):
    pad, gap = 40, 24
    W = pad * 2 + FW * 2 + gap * 2 + TX
    H = 140 + len(ns) * (FH + gap) + 40
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((pad, 34), title, font=F("ExtraBold", 40), fill=INK)
    d.text((pad, 92), "왼쪽 원본 첫 프레임(컷 · 초 · 구도 · 카메라를 그대로 옮김) | 가운데 우리 그림(받은 판 그대로) | 오른쪽 초 · 화면 · 카메라 · 말 · 자막",
           font=F("Medium", 22), fill=DIM)
    y = 140
    for n in ns:
        r = rows[n]
        im.paste(fit(os.path.join(V, "원본프레임", f"F{ORIG[n]:02d}_첫.jpg")), (pad, y))
        im.paste(fit(os.path.join(V, "정지컷", f"S{n:02d}.jpg")), (pad + FW + gap, y))
        d.text((pad + 8, y + 6), f"원본 {ORIG[n]}", font=F("ExtraBold", 22), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        d.text((pad + FW + gap + 8, y + 6), f"우리 {n}", font=F("ExtraBold", 22), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        x, ty = pad + FW * 2 + gap * 2, y
        d.text((x, ty), f"{n}  ·  {r['t']}초", font=F("ExtraBold", 30), fill=GOLD)
        ty += 46
        for label, key, col in (("화면", "ours", INK), ("카메라", "cam", DIM), ("말", "say", (170, 220, 170)), ("자막", "cap", (170, 200, 240))):
            for i, ln in enumerate(wrap(d, f"{label}  {r[key]}", F("Medium", 23), TX)):
                d.text((x, ty), ln, font=F("Medium", 23), fill=col)
                ty += 31
            ty += 8
        d.line([(pad, y + FH + gap // 2), (W - pad, y + FH + gap // 2)], fill=LINE, width=1)
        y += FH + gap
    im.save(path, quality=88)
    print(path, im.size)


def glance(ns, path):
    w, h, gap = 216, 384, 10
    im = Image.new("RGB", (gap + len(ns) * (w + gap), h + 70), BG)
    d = ImageDraw.Draw(im)
    for i, n in enumerate(ns):
        p = os.path.join(V, "정지컷", f"S{n:02d}.jpg")
        tile = fit(p).resize((w, h)) if os.path.exists(p) else Image.new("RGB", (w, h), (40, 40, 44))
        im.paste(tile, (gap + i * (w + gap), 10))
        d.text((gap + i * (w + gap) + 6, h + 22), f"{n}", font=F("ExtraBold", 26), fill=GOLD)
    im.save(path, quality=88)
    print(path, im.size)


def refs(path):
    names = [("D1.jpg", "외계 · 정면 앉음(D1)"), ("D2.jpg", "외계 · 옆 서 있음(D2)"), ("D3.jpg", "외계 · 조끼(D3)"), ("P1.jpg", "둥실멍 구명조끼(P1)"), ("M1.jpg", "민재 · 옷 · 원룸(M1)")]
    w, h, gap = 360, 480, 16
    im = Image.new("RGB", (gap + len(names) * (w + gap), h + 120), BG)
    d = ImageDraw.Draw(im)
    d.text((gap, 14), "11번 반려동물 — 기준 그림(모든 컷이 참고로 쓴다)", font=F("ExtraBold", 30), fill=INK)
    for i, (f, lab) in enumerate(names):
        p = os.path.join(V, "ego", "refs", f)
        if os.path.exists(p):
            t = Image.open(p).convert("RGB")
            t = t.resize((w, round(t.height * w / t.width)))
            im.paste(t.crop((0, 0, w, h)), (gap + i * (w + gap), 64))
        d.text((gap + i * (w + gap), h + 76), lab, font=F("Medium", 22), fill=DIM)
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__":
    rows = rows_from_02()
    board(rows, [1, 2, 3, 4, 5], os.path.join(V, "반려동물_이미지콘티_1.jpg"), "11번 반려동물 22초 · 이미지 콘티 1/2 (1~5)")
    board(rows, [6, 7, 8, 9, 10], os.path.join(V, "반려동물_이미지콘티_2.jpg"), "11번 반려동물 22초 · 이미지 콘티 2/2 (6~10)")
    glance(list(range(1, 11)), os.path.join(V, "반려동물_이미지콘티_한눈.jpg"))
    refs(os.path.join(V, "반려동물_기준그림.jpg"))
