# 시즌 1 「옆집의 크리스마스」 이미지 콘티 보드(2026-10-26) — 36행: 원본 첫 프레임 | 우리 그림 | 초 · 화면 · 카메라 · 빛 · 말 · 소리. 6번 콘티보드.py와 같은 꼴.
# 글은 02_콘티.md 2절 표에서 그대로 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/xmas-neighbors/보드/)에만 둔다.
#   python -X utf8 콘티보드.py   → 보드/옆집_이미지콘티_1~5.jpg(8행씩) · _한눈.jpg(우리 그림 36칸) · _얼굴시험.jpg(30 · 34 셋씩 + 닮음) · _기준판.jpg(PL1 · H3)
# 우리 그림은 컷/C01.jpg …(받은 판 그대로 — 색 손대지 않음). 35 끝 문구 · 36 로고 판은 후반 글자를 그 자리에 시안으로 얹어 보인다.
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "xmas-neighbors")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
CUTS = os.path.join(V, "컷")
OUT = os.path.join(V, "보드")
BG, INK, DIM, GOLD, LINE, AMBER = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (60, 58, 62), (246, 176, 62)
RESULT = {}   # 받은 그림이 계획과 다른 컷만 결과를 덧붙인다(번호: 글)


def clean(s):
    # SUIT에 없는 글자(– · →)는 보드에서 바꿔 쓴다
    return re.sub(r"\*\*", "", s).replace("–", "~").replace("—", "-").replace("→", ">")


def rows_from_02():
    md = open(os.path.join(HERE, "02_콘티.md"), encoding="utf-8").read()
    sec = md[md.index("## 2. 글 콘티"):md.index("## 3.")]
    out = {}
    for line in sec.splitlines():
        m = re.match(r"\|\s*(\d+)\s*\|(.+)\|\s*$", line)
        if not m:
            continue
        c = [x.strip() for x in m.group(2).split("|")]
        n = int(m.group(1))
        out[n] = {"t": clean(c[0]), "ours": clean(RESULT.get(n, c[1])) + " / 빛: " + clean(c[3]), "cam": clean(c[2]), "snd": clean(c[4])}
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


def overlay(n, im):
    """35 끝 문구 · 36 로고 판 — 후반에 얹을 글자의 시안(애니매틱과 같은 꼴)"""
    W, H = im.size
    if n == 35:
        shade = Image.new("L", (1, H))
        for y in range(H):
            shade.putpixel((0, y), int(190 * max(0.0, (y / H - 0.45) / 0.55)))
        dark = Image.new("RGB", (W, H), (0, 0, 0))
        im = Image.composite(dark, im, shade.resize((W, H)))
        d = ImageDraw.Draw(im)
        d.text((W / 2, H * 0.80), "1+1의 하나는, 옆집에", font=F("ExtraBold", int(H * 0.08)), fill=(255, 255, 255), anchor="mm")
    elif n == 36:
        im = Image.blend(im, Image.new("RGB", (W, H), (0, 0, 0)), 0.45)
        d = ImageDraw.Draw(im)
        bw, bh = W * 0.33, H * 0.14
        d.rounded_rectangle((W / 2 - bw / 2, H / 2 - bh * 0.62, W / 2 + bw / 2, H / 2 + bh * 0.38), radius=int(H * 0.017), fill=AMBER)
        d.text((W / 2, H / 2 - bh * 0.12), "늘켬 편의점", font=F("ExtraBold", int(H * 0.085)), fill=(255, 252, 244), anchor="mm")
        d.text((W / 2, H / 2 + bh * 1.0), "옆집까지 늘 켜 둡니다", font=F("ExtraBold", int(H * 0.06)), fill=(255, 255, 255), anchor="mm")
    return im


def frame(n, end=False):
    p = os.path.join(V, "원본프레임", f"F{n:02d}_{'끝' if end else '첫'}.jpg")
    return Image.open(p).convert("RGB")


def ours(n, TW, TH, raw=False, end=False):
    """우리 그림 — 움직이는 컷은 카메라무브.py가 자른 처음 · 끝 창(컷/C04_처음.jpg · _끝.jpg), 아니면 받은 판 그대로"""
    base = os.path.join(CUTS, f"C{n:02d}")
    p = base + ("_끝.jpg" if end else "_처음.jpg")
    if n in (19, 30) and os.path.exists(base + "e.jpg"):   # 사람을 따라 크게 도는 두 컷은 처음 판 → 끝 그림(애니매틱과 같이)
        p = base + ("e.jpg" if end else ".jpg")
    if not os.path.exists(p):
        if end:
            return None
        p = base + ".jpg"
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert("RGB").resize((TW, TH))
    return im if raw else overlay(n, im)


def board(rows, ns, path, page, pages):
    TW, TH = 432, 243
    TXT = 900
    RH = TH + 28
    Wd = 40 + TW * 4 + 8 * 3 + 30 + TXT + 40
    Hd = 230 + RH * len(ns) + 30
    im = Image.new("RGB", (Wd, Hd), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "옆집의 크리스마스 · 이미지 콘티  ·  원본 36컷의 자리 · 초 · 카메라 기법 그대로", font=F("ExtraBold", 40), fill=INK)
    d.text((40, 92), f"{page}/{pages}   원본 처음 · 원본 끝  |  우리 처음 · 우리 끝(움직이는 컷은 받은 판에서 카메라 움직임대로 자른 두 창) · 오른쪽: 초 · 화면 · 카메라 · 말과 소리", font=F("Medium", 22), fill=DIM)
    d.text((40, 128), "간판 「늘켬」 · 봉투 마크 · 1+1 표시 · 자막 · 끝 문구 · 로고는 후반에 얹는다(35 · 36은 시안). 얼굴은 30 · 34뿐. 고정 컷은 끝 칸을 비운다.", font=F("Medium", 22), fill=(236, 170, 120))
    xs = [40, 40 + TW + 8, 40 + 2 * (TW + 8) + 30, 40 + 3 * (TW + 8) + 30]
    for j, lab in enumerate(("원본 처음", "원본 끝", "우리 처음", "우리 끝")):
        d.text((xs[j], 186), lab, font=F("ExtraBold", 22), fill=GOLD if j >= 2 else DIM)
    for i, n in enumerate(ns):
        y = 230 + i * RH
        r = rows[n]
        moving = not r["cam"].startswith("고정")
        im.paste(frame(n).resize((TW, TH)), (xs[0], y))
        if moving:
            im.paste(frame(n, end=True).resize((TW, TH)), (xs[1], y))
        for j, end in ((2, False), (3, True)):
            if end and not moving:
                continue
            b = ours(n, TW, TH, end=end)
            if b is not None:
                im.paste(b, (xs[j], y))
            else:
                d.rectangle([xs[j], y, xs[j] + TW, y + TH], outline=LINE, width=2)
                d.text((xs[j] + 24, y + TH // 2 - 14), "(아직)", font=F("Medium", 24), fill=DIM)
        x = xs[3] + TW + 30
        d.text((x, y - 2), f"#{n}", font=F("Heavy", 40), fill=GOLD)
        d.text((x + 90, y + 8), r["t"], font=F("ExtraBold", 22), fill=INK)
        yy = y + 50
        for label, key, fnt, col, mx in (("화면", "ours", F("SemiBold", 18), INK, 4), ("카메라", "cam", F("Medium", 17), (170, 210, 255), 3),
                                          ("말 · 소리", "snd", F("SemiBold", 17), (250, 214, 160), 2)):
            d.text((x, yy), label, font=F("ExtraBold", 17), fill=GOLD)
            for ln in wrap(d, r[key], fnt, TXT - 100)[:mx]:
                d.text((x + 86, yy), ln, font=fnt, fill=col)
                yy += 22
            yy += 4
        d.line([(40, y + TH + 13), (Wd - 40, y + TH + 13)], fill=LINE, width=1)
    im.save(path, quality=88)
    print(path, im.size)


def glance(rows, ns, path):
    """우리 그림 36칸 한 장(폰에서 흐름을 한 번에)"""
    TW, TH, C = 384, 216, 6
    R = (len(ns) + C - 1) // C
    im = Image.new("RGB", (40 + C * (TW + 10), 120 + R * (TH + 44)), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "옆집의 크리스마스 · 이미지 콘티  ·  우리 그림 36컷(60.04초)", font=F("ExtraBold", 36), fill=INK)
    for k, n in enumerate(ns):
        x, y = 40 + (k % C) * (TW + 10), 110 + (k // C) * (TH + 44)
        b = ours(n, TW, TH)
        if b is not None:
            im.paste(b, (x, y))
        else:
            d.rectangle([x, y, x + TW, y + TH], outline=LINE, width=2)
        d.text((x, y + TH + 6), f"#{n}  {rows[n]['t'].split('(')[0].strip()}", font=F("SemiBold", 20), fill=INK)
    im.save(path, quality=88)
    print(path, im.size)


def faces(path):
    """30 · 34 얼굴 시험: 원본 첫 프레임 | 시험 판들(고른 판 금색 테) + SFace 닮음(이미지콘티_닮음.py가 쓴 정지컷/_닮음.json)
    10-28: 1차 a · b · c가 원본과 반대 방향 · 작게 나와 다시 구운 판(30 r · 34 d · e)과 34 꼬리(t2 — 고개를 창 쪽으로)까지 한 줄에 둔다(Opus 검수 P3)"""
    TW, TH = 448, 252
    ROWS = {30: ["a", "b", "c", "r"], 34: ["a", "b", "c", "d", "e", "t2"]}
    sim = {}
    sp = os.path.join(V, "정지컷", "_닮음.json")
    if os.path.exists(sp):
        sim = json.load(open(sp, encoding="utf-8"))
    picked = json.load(open(os.path.join(V, "정지컷", "_고른판.json"), encoding="utf-8")) if os.path.exists(os.path.join(V, "정지컷", "_고른판.json")) else {}
    im = Image.new("RGB", (40 + 7 * (TW + 20), 170 + 2 * (TH + 110)), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 30), "30 · 34 얼굴 시험  ·  a · b · c 1차(방향 · 크기가 원본과 달라 다시) · 30 r · 34 d · e 다시 · 34 t2 꼬리(고개를 창 쪽으로)", font=F("ExtraBold", 32), fill=INK)
    d.text((40, 86), "닮음 = SFace 코사인(캐스팅북 고정 얼굴 세트 평균, 같은 사람 기준선 0.363) · 금색 테 = 고른 판", font=F("Medium", 22), fill=DIM)
    for row, (n, lab) in enumerate(((30, "민재 30 · 알아차림"), (34, "하린 34 · 정체"))):
        y = 150 + row * (TH + 110)
        im.paste(frame(n).resize((TW, TH)), (40, y))
        d.text((40, y + TH + 10), f"원본 #{n}", font=F("ExtraBold", 24), fill=DIM)
        for j, v in enumerate(ROWS[n]):
            k = f"C{n}{v}"
            x = 40 + (j + 1) * (TW + 20)
            p = os.path.join(CUTS, f"{k}.jpg")
            if os.path.exists(p):
                im.paste(Image.open(p).convert("RGB").resize((TW, TH)), (x, y))
            else:
                d.rectangle([x, y, x + TW, y + TH], outline=LINE, width=2)
            chosen = picked.get(f"C{n}", {}).get("src", "").startswith(k + "_") or (k == "C34t2")
            if chosen:
                d.rectangle([x - 4, y - 4, x + TW + 4, y + TH + 4], outline=GOLD, width=5)
            s = sim.get(k)
            d.text((x, y + TH + 10), f"{lab} {v}" + (f"  · 닮음 {s:.3f}" if isinstance(s, (int, float)) else ""), font=F("ExtraBold", 24), fill=GOLD if chosen else INK)
    im.save(path, quality=88)
    print(path, im.size)


def plates(path):
    """기준 판: 복도 고정 와이드 PL1(1 · 12 · 20 · 26 · 35의 같은 자리) · 하린 반묶음 빨간 리본 H3 · 1라운드 SET1"""
    cells = [("복도 고정 와이드 PL1(사람 없음 · 늦가을 밤)", os.path.join(CUTS, "PL1.jpg"), (960, 540)),
             ("하린 반묶음 빨간 리본 H3", os.path.join(V, "ego", "refs", "H3.jpg"), (405, 540)),
             ("1라운드 SET1(건물 꼴 참조)", os.path.join(V, "ego", "refs", "SET1.jpg"), (960, 540))]
    Wd = 40 + sum(c[2][0] + 20 for c in cells)
    im = Image.new("RGB", (Wd, 680), BG)
    d = ImageDraw.Draw(im)
    x = 40
    for lab, p, (w, h) in cells:
        d.text((x, 30), lab, font=F("ExtraBold", 26), fill=GOLD)
        if os.path.exists(p):
            src = Image.open(p).convert("RGB")
            src.thumbnail((w, h))
            im.paste(src, (x, 80))
        x += w + 20
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    rows = rows_from_02()
    ns = list(range(1, 37))
    assert sorted(rows) == ns, sorted(rows)
    pages = [ns[i:i + 8] for i in range(0, 36, 8)]
    for i, p in enumerate(pages):
        board(rows, p, os.path.join(OUT, f"옆집_이미지콘티_{i + 1}.jpg"), i + 1, len(pages))
    glance(rows, ns, os.path.join(OUT, "옆집_이미지콘티_한눈.jpg"))
    faces(os.path.join(OUT, "옆집_얼굴시험.jpg"))
    plates(os.path.join(OUT, "옆집_기준판.jpg"))
