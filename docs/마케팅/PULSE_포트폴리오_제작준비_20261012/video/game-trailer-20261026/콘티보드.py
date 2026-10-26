# 9번 게임 트레일러 이미지 콘티 보드(2026-10-26) — 행마다: 원본 첫 프레임 | 우리 그림 | 초 · 화면 · 소리. 6번 콘티보드.py와 같은 꼴.
# 글은 02_콘티.md 2절 표에서 그대로 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/p9/보드/)에만 둔다.
#   python -X utf8 콘티보드.py   → 보드/게임트레일러_이미지콘티_1~2.jpg · _한눈.jpg
# 우리 그림은 콘티/p9/정지컷/S??.png(고른 판 — 3:2 판의 가운데 16:9 띠만 보드에 씀, 색은 손대지 않음).
# 2 · 11번은 한 컷 안에서 일이 바뀌어 첫 프레임 · 끝 프레임 두 줄로 본다. 1 · 15 표지와 14번 제목은 후반에서 얹을 글자의 자리 시안이다.
import os
import re

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p9")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, LINE = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (60, 58, 62)
# 보드 줄: (줄 이름, 02 표의 컷 번호, 원본 프레임 파일, 우리 그림 파일, 줄 머리 덧말)
ROWS = [
    ("1", 1, "S01", "card1", ""), ("2 첫", 2, "S02", "S02a", "첫 프레임"), ("2 끝", 2, "S02_끝", "S02b", "끝 프레임 — 친구 셋이 올라옴"),
    ("3", 3, "S03", "S03", ""), ("4", 4, "S04", "S04", ""), ("5", 5, "S05", "S05", "화면은 실제 녹화로 바꿈"),
    ("6", 6, "S06", "S06", ""), ("7", 7, "S07", "game7", "실제 게임 화면 자리 — 3D 주민 시제품(비 · 말풍선)"), ("8 첫", 8, "S08", "S08a", "첫 프레임 — 천둥에 놀람"), ("8 끝", 8, "S08_끝", "S08b", "끝 프레임 — 숨었다 빼꼼"),
    ("9", 9, "S09", "S09", ""), ("10", 10, "S10", "S10", ""), ("11 첫", 11, "S11", "S11a", "첫 프레임 — 꺼진 전구"),
    ("11 끝", 11, "S11_끝", "S11b", "끝 프레임 — 펠트 전구가 켜짐"), ("12", 12, "S12", "S12", ""), ("13", 13, "S13", "S13", ""),
    ("14", 14, "S14", "S14", "제목은 후반"), ("15", 15, "S15", "card15", ""),
]


def clean(s):
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
        out[int(m.group(1))] = {"t": clean(c[0]), "ours": clean(c[1]), "cam": clean(c[2]), "snd": clean(c[3])}
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


def title(im, W, H):
    """14번 제목 자리 시안 — 「SYNK WORLD」와 무엇인지 알리는 한 줄(낯선이 시험 1차: 무엇을 알리는 광고인지 모르겠다)"""
    d = ImageDraw.Draw(im)
    f1, f2 = F("Heavy", int(H * 0.095)), F("Bold" if os.path.exists(os.path.join(SUIT, "SUIT-Bold.otf")) else "ExtraBold", int(H * 0.042))
    s1, s2 = "SYNK WORLD", "펠트 친구들이 사는 작은 한국 동네"
    x2 = W - d.textlength(s2, font=f2) - W * 0.05
    x1 = W - d.textlength(s1, font=f1) - W * 0.05
    d.text((x1, H * 0.56), s1, font=f1, fill=(255, 255, 255), stroke_width=max(2, H // 270), stroke_fill=(40, 30, 30))
    d.text((x2, H * 0.56 + H * 0.115), s2, font=f2, fill=(255, 255, 255), stroke_width=max(2, H // 360), stroke_fill=(40, 30, 30))


def band(img):
    """GPT 3:2 판에서 가운데 16:9 띠(위아래 같은 만큼 자름)"""
    w, h = img.size
    nh = round(w * 9 / 16)
    if nh >= h:
        return img
    t = (h - nh) // 2
    return img.crop((0, t, w, t + nh))


def card(kind, size):
    W, H = size
    im = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    if kind == "card1":
        f = F("Heavy", int(H * 0.16))
        s = "SYNK WORLD"
        d.text(((W - d.textlength(s, font=f)) / 2, H * 0.34), s, font=f, fill=(20, 20, 24))
        f2 = F("SemiBold", int(H * 0.06))
        s2 = "아늑한 한국 동네 게임"
        d.text(((W - d.textlength(s2, font=f2)) / 2, H * 0.56), s2, font=f2, fill=(90, 90, 96))
        d.text((12, H - 34), "로고 자리(후반)", font=F("Medium", 20), fill=(150, 150, 150))
    else:
        logo = os.path.join(REPO, "experiences", "brand-opening", "assets", "synk-paper.webp")
        if os.path.exists(logo):
            lg = Image.open(logo).convert("RGBA")
            lg.thumbnail((int(W * 0.42), int(H * 0.42)))
            im.paste(lg, ((W - lg.width) // 2, int(H * 0.28)), lg)
        f = F("SemiBold", int(H * 0.07))
        s = "synk.im/world 에서 만나요"
        d.text(((W - d.textlength(s, font=f)) / 2, H * 0.74), s, font=f, fill=(40, 40, 44))
    return im


def frame(name):
    p = os.path.join(V, "원본첫프레임", f"{name}.jpg")
    return Image.open(p).convert("RGB") if os.path.exists(p) else Image.new("RGB", (1920, 1080), (0, 0, 0))


def ours(name, TW, TH):
    if name.startswith("card"):
        return card(name, (TW, TH))
    p = os.path.join(V, "정지컷", f"{name}.png")
    if not os.path.exists(p):
        return None
    im = band(Image.open(p).convert("RGB")).resize((TW, TH))
    if name == "S14":
        title(im, TW, TH)
    return im


def board(rows, sel, path, page, pages):
    TW, TH = 576, 324
    TXT = 940
    RH = TH + 28
    Wd = 40 + TW * 2 + 24 + TXT + 40
    Hd = 190 + RH * len(sel) + 30
    im = Image.new("RGB", (Wd, Hd), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "9번 게임 트레일러(SYNK WORLD) · 이미지 콘티  ·  원본 15컷의 자리 · 초 · 구도 · 빛 그대로", font=F("ExtraBold", 40), fill=INK)
    d.text((40, 92), f"{page}/{pages}   왼쪽: 원본 컷 첫 프레임 · 가운데: 우리 그림(같은 카메라 자리 · 크기 · 빛, 받은 색 그대로) · 오른쪽: 우리 초 · 화면 · 카메라 · 소리", font=F("Medium", 22), fill=DIM)
    d.text((40, 128), "게임 화면(2 · 5 · 7 · 14 화면 속)은 실제 SYNK WORLD 녹화로 바꾼다 — 그림 속 화면은 자리만. 표지 · 제목 글자는 후반에서 얹는다.", font=F("Medium", 22), fill=(236, 170, 120))
    for i, (lab, n, fr, ou, note) in enumerate(sel):
        y = 190 + i * RH
        r = rows[n]
        im.paste(frame(fr).resize((TW, TH)), (40, y))
        b = ours(ou, TW, TH)
        if b is not None:
            im.paste(b, (40 + TW + 12, y))
        else:
            d.rectangle([40 + TW + 12, y, 40 + 2 * TW + 12, y + TH], outline=LINE, width=2)
            d.text((40 + TW + 40, y + TH // 2 - 14), "(아직)", font=F("Medium", 26), fill=DIM)
        x = 40 + TW * 2 + 36
        d.text((x, y - 2), f"#{lab}", font=F("Heavy", 40), fill=GOLD)
        d.text((x + 150, y + 8), r["t"] + (f"  ·  {note}" if note else ""), font=F("ExtraBold", 23), fill=INK)
        yy = y + 60
        for label, key, fnt, col, mx in (("화면", "ours", F("SemiBold", 20), INK, 5), ("카메라", "cam", F("Medium", 19), (250, 214, 160), 2), ("소리", "snd", F("Medium", 19), DIM, 2)):
            d.text((x, yy), label, font=F("ExtraBold", 19), fill=GOLD)
            for ln in wrap(d, r[key], fnt, TXT - 90)[:mx]:
                d.text((x + 78, yy), ln, font=fnt, fill=col)
                yy += 26
            yy += 5
        d.line([(40, y + TH + 13), (Wd - 40, y + TH + 13)], fill=LINE, width=1)
    im.save(path, quality=88)
    print(path, im.size)


def glance(sel, path):
    """우리 그림만 한 장(폰에서 흐름을 한 번에)"""
    TW, TH, C = 384, 216, 6
    R = (len(sel) + C - 1) // C
    im = Image.new("RGB", (40 + C * (TW + 10), 120 + R * (TH + 44)), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "9번 게임 트레일러(SYNK WORLD) · 우리 그림 흐름(36.04초)", font=F("ExtraBold", 36), fill=INK)
    for k, (lab, n, fr, ou, note) in enumerate(sel):
        x, y = 40 + (k % C) * (TW + 10), 110 + (k // C) * (TH + 44)
        b = ours(ou, TW, TH)
        if b is not None:
            im.paste(b, (x, y))
        d.text((x, y + TH + 6), f"#{lab}", font=F("SemiBold", 20), fill=INK)
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__":
    rows = rows_from_02()
    assert sorted(rows) == list(range(1, 16)), sorted(rows)
    out = os.path.join(V, "보드")
    os.makedirs(out, exist_ok=True)
    pages = [ROWS[:9], ROWS[9:]]
    for i, p in enumerate(pages):
        board(rows, p, os.path.join(out, f"게임트레일러_이미지콘티_{i + 1}.jpg"), i + 1, len(pages))
    glance(ROWS, os.path.join(out, "게임트레일러_이미지콘티_한눈.jpg"))
