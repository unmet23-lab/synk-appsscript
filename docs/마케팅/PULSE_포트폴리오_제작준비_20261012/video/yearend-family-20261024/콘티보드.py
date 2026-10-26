# 6번 「연말 빈방」 이미지 콘티 보드(2026-10-25) — 15행: 원본 첫 프레임 | 우리 그림 | 초 · 화면 · 말 · 소리. 「매진 임박」 콘티보드_v4.py와 같은 꼴.
# 글은 02_콘티.md 2절 표에서 그대로 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/p6/)에만 둔다.
#   python -X utf8 콘티보드.py   → 콘티/p6/연말빈방_이미지콘티_1~2.jpg(8행 · 7행) · _한눈.jpg(우리 그림 15칸) · _11번_두판.jpg · _방판_기준.jpg
# 우리 그림은 콘티/p6/컷/S01.jpg …(받은 판 그대로 — 색 손대지 않음). 검은 글판(2 · 17)은 우리 글판 시안을 그 자리에서 그린다.
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p6")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
CUTS = os.path.join(V, "컷")
BG, INK, DIM, GOLD, LINE = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (60, 58, 62)
CARDS = {2: ["열일곱 살 딸의 방문에 노크가 필요해졌다"], 17: ["닫힌 문 앞이", "엄마의 자리였다"]}   # 원본처럼 첫 글판은 가운데 한 줄 · 둘째는 두 줄(02 3절)
# 보드의 「우리」 칸은 02 2절 표(계획)를 읽는다 — 받은 그림이 계획과 다른 컷만 결과를 덧붙인다
RESULT = {}


def clean(s):
    # SUIT에 없는 글자(– · →)는 보드에서 바꿔 쓴다
    return re.sub(r"\*\*", "", s).replace("–", "~").replace("—", "-").replace("→", ">").replace("·", "·")


def rows_from_02():
    md = open(os.path.join(HERE, "02_콘티.md"), encoding="utf-8").read()
    sec = md[md.index("## 2. 글 콘티"):md.index("## 3.")]
    out = {}
    for line in sec.splitlines():
        m = re.match(r"\|\s*(\d+)\s*\|(.+)\|\s*$", line)
        if not m:
            continue
        cells = [c.strip() for c in m.group(2).split("|")]
        n = int(m.group(1))
        out[n] = {"t": clean(cells[0]), "ours": RESULT.get(n, clean(cells[1])), "cam": clean(re.sub(r"\[([^]]*)\]\([^)]*\)", r"\1", cells[2])),
                  "say": clean(cells[3]), "snd": clean(cells[4])}
    return out


MOVING = (19, 20, 21)   # 원본 카메라가 움직이는 컷 — 원본 칸에 끝 프레임을 작게 함께(02 7-1절)


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


def card(n, size):
    """검은 바탕 글판 시안(최종은 후반에서 얹는 글자)"""
    W, H = size
    im = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(im)
    f = F("Medium", int(H * 0.055))
    ls = CARDS[n]
    lh = int(H * 0.085)
    y0 = H // 2 - lh * len(ls) // 2
    for i, s in enumerate(ls):
        w = d.textlength(s, font=f)
        d.text(((W - w) / 2, y0 + i * lh), s, font=f, fill=(225, 225, 225))
    return im


def frame(n):
    p = os.path.join(V, "원본프레임", f"F{n:02d}_첫.jpg")
    if os.path.exists(p):
        return Image.open(p).convert("RGB")
    return Image.new("RGB", (1920, 1080), (0, 0, 0))   # 2 · 17 원본은 검은 글판(원본 글자는 보드에도 옮기지 않는다)


def ours(n, TW, TH):
    if n in CARDS:
        return card(n, (TW, TH))
    p = os.path.join(CUTS, f"S{n:02d}.jpg")
    return Image.open(p).convert("RGB").resize((TW, TH)) if os.path.exists(p) else None


def board(rows, ns, path, page, pages):
    TW, TH = 576, 324
    TXT = 940
    RH = TH + 64
    Wd = 40 + TW * 2 + 24 + TXT + 40
    Hd = 190 + RH * len(ns) + 30
    im = Image.new("RGB", (Wd, Hd), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "연말 빈방 · 이미지 콘티  ·  원본 15조각의 자리 · 초 · 구도 · 빛 그대로", font=F("ExtraBold", 40), fill=INK)
    d.text((40, 92), f"{page}/{pages}   왼쪽: 원본 조각 첫 프레임(움직이는 컷은 끝 프레임을 작게) · 가운데: 우리 그림(같은 카메라 자리 · 크기 · 빛, 받은 색 그대로) · 오른쪽: 우리 초 · 화면 · 카메라(원본 실측) · 말 · 소리", font=F("Medium", 22), fill=DIM)
    d.text((40, 128), "글판 · 자막 · 끝 문구 · 로고는 후반에서 얹는다(2 · 17은 글판 시안). 자리 표시(AI 그림): 침대 위 새 겨울 이불(블렌더로 바꿀지 정함) · 벽 액자 속 얼굴(영상 시작 그림에서 은정 · 지유로).", font=F("Medium", 22), fill=(236, 170, 120))
    for i, n in enumerate(ns):
        y = 190 + i * RH
        r = rows[n]
        im.paste(frame(n).resize((TW, TH)), (40, y))
        end = os.path.join(V, "원본프레임", f"F{n:02d}_끝.jpg")
        if n in MOVING and os.path.exists(end):
            iw, ih = TW // 3, TH // 3
            im.paste(Image.open(end).convert("RGB").resize((iw, ih)), (40 + TW - iw - 6, y + TH - ih - 6))
            d.rectangle([40 + TW - iw - 7, y + TH - ih - 7, 40 + TW - 6, y + TH - 6], outline=GOLD, width=2)
            d.text((40 + TW - iw - 4, y + TH - ih - 34), "끝 프레임", font=F("ExtraBold", 20), fill=GOLD, stroke_width=2, stroke_fill=(0, 0, 0))
        b = ours(n, TW, TH)
        if b is not None:
            im.paste(b, (40 + TW + 12, y))
        else:
            d.rectangle([40 + TW + 12, y, 40 + 2 * TW + 12, y + TH], outline=LINE, width=2)
            d.text((40 + TW + 40, y + TH // 2 - 14), "(아직)", font=F("Medium", 26), fill=DIM)
        x = 40 + TW * 2 + 36
        d.text((x, y - 2), f"#{n}", font=F("Heavy", 44), fill=GOLD)
        d.text((x + 100, y + 10), r["t"], font=F("ExtraBold", 24), fill=INK)
        yy = y + 62
        for label, key, fnt, col, mx in (("화면", "ours", F("SemiBold", 21), INK, 3), ("카메라", "cam", F("SemiBold", 19), (150, 205, 240), 2),
                                         ("말", "say", F("SemiBold", 21), (250, 214, 160), 4), ("소리", "snd", F("Medium", 19), DIM, 2)):
            d.text((x, yy), label, font=F("ExtraBold", 20), fill=GOLD)
            for ln in wrap(d, r[key], fnt, TXT - 70)[:mx]:
                d.text((x + 64, yy), ln, font=fnt, fill=col)
                yy += 27
            yy += 6
        d.line([(40, y + TH + 13), (Wd - 40, y + TH + 13)], fill=LINE, width=1)
    im.save(path, quality=88)
    print(path, im.size)


def glance(rows, ns, path):
    """우리 그림 15칸 한 장(폰에서 흐름을 한 번에)"""
    TW, TH, C = 384, 216, 5
    R = (len(ns) + C - 1) // C
    im = Image.new("RGB", (40 + C * (TW + 10), 120 + R * (TH + 44)), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "연말 빈방 · 이미지 콘티  ·  우리 그림 15조각(59.99초)", font=F("ExtraBold", 36), fill=INK)
    for k, n in enumerate(ns):
        x, y = 40 + (k % C) * (TW + 10), 110 + (k // C) * (TH + 44)
        b = ours(n, TW, TH)
        if b is not None:
            im.paste(b, (x, y))
        d.text((x, y + TH + 6), f"#{n}  {rows[n]['t'].split('·')[0].strip()}", font=F("SemiBold", 20), fill=INK)
    im.save(path, quality=88)
    print(path, im.size)


def two11(path):
    """11번 판 견주기: 원본 첫 프레임 · 방 참조 있음(고른 판 — 두 단계면 엄마만 굽고 그 판에 딸을 더함) · 방 참조 있음 한 번에(S11c) · 없음(실루엣만, S11b)"""
    TW, TH = 560, 315
    picked = json.load(open(os.path.join(V, "정지컷", "_고른판.json"), encoding="utf-8")).get("S11", {}).get("src", "")
    two_step = picked.startswith(("S11d", "S11e"))
    cells = [("원본", os.path.join(V, "원본프레임", "F11_첫.jpg")),
             ("방 참조 있음 · 두 단계(고름)" if two_step else "방 참조 있음(고름)", os.path.join(CUTS, "S11.jpg")),
             ("방 참조 있음 · 두 사람 한 번에", os.path.join(CUTS, "S11c.jpg")), ("방 참조 없음(실루엣만)", os.path.join(CUTS, "S11b.jpg"))]
    im = Image.new("RGB", (40 + len(cells) * (TW + 20), 200 + TH + 90), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "11번 두 사람 컷 · 방 참조 있음 / 없음", font=F("ExtraBold", 40), fill=INK)
    d.text((40, 96), "두 단계 = 우리 거실 판 위 엄마 실루엣만 먼저 굽고, 그 판의 문간에 딸 실루엣을 놓아 딸만 그려 넣음 · 한 번에 = 두 실루엣을 한 장에 · 실루엣만 = 회색 바탕, 방은 글로만", font=F("Medium", 22), fill=DIM)
    for j, (lab, p) in enumerate(cells):
        x = 40 + j * (TW + 20)
        if os.path.exists(p):
            im.paste(Image.open(p).convert("RGB").resize((TW, TH)), (x, 160))
        else:
            d.rectangle([x, 160, x + TW, 160 + TH], outline=LINE, width=2)
        d.text((x, 160 + TH + 14), lab, font=F("Bold" if os.path.exists(os.path.join(SUIT, "SUIT-Bold.otf")) else "ExtraBold", 26), fill=GOLD)
    im.save(path, quality=88)
    print(path, im.size)


def plates(path):
    """거실 판 기준 한 장: 위 R1 · R2 · R3 2판(지금 쓰는 판), 아래 R1 1판(고치기 전 — 앞 식탁이 컸다) · 20번 빈방 · 50대 은정 기준"""
    TW, TH = 800, 450
    im = Image.new("RGB", (40 + 3 * (TW + 20), 60 + 2 * (TH + 60)), BG)
    d = ImageDraw.Draw(im)
    cells = [("R1 피아노 시대(2판)", os.path.join(CUTS, "R1.jpg")), ("R2 낮은 장 시대(2판)", os.path.join(CUTS, "R2.jpg")),
             ("R3 마지막 거실(2판)", os.path.join(CUTS, "R3.jpg")), ("R1 1판(고치기 전 - 앞 식탁이 컸다)", os.path.join(V, "받음", "R1_152416.jpg")),
             ("20번 빈방(2판)", os.path.join(CUTS, "S20.jpg")), ("50대 은정 기준(E50)", os.path.join(CUTS, "E50.jpg"))]
    for k, (lab, p) in enumerate(cells):
        x, y = 20 + (k % 3) * (TW + 20), 20 + (k // 3) * (TH + 60)
        d.text((x, y), lab, font=F("ExtraBold", 26), fill=GOLD)
        if os.path.exists(p):
            src = Image.open(p).convert("RGB")
            w, h = src.size
            if abs(w / h - 16 / 9) > 0.01:   # 받은 판이 16:9가 아니면 가운데만(보드에서만 — 원본 파일은 그대로)
                nw = round(h * 16 / 9)
                src = src.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
            im.paste(src.resize((TW, TH)), (x, y + 40))
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__":
    rows = rows_from_02()
    ns = [1, 2, 3, 4, 7, 11, 12, 14, 16, 17, 18, 19, 20, 21, 22]
    assert sorted(rows) == ns, sorted(rows)
    pages = [ns[:8], ns[8:]]
    for i, p in enumerate(pages):
        board(rows, p, os.path.join(V, f"연말빈방_이미지콘티_{i + 1}.jpg"), i + 1, len(pages))
    glance(rows, ns, os.path.join(V, "연말빈방_이미지콘티_한눈.jpg"))
    two11(os.path.join(V, "연말빈방_11번_두판.jpg"))
    plates(os.path.join(V, "연말빈방_방판_기준.jpg"))
