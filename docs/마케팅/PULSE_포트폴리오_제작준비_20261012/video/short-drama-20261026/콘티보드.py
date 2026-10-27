# 7번 「사랑 한 칸」 이미지 콘티 보드(2026-10-26) — 컷마다 「원본 첫 프레임 | 우리 그림」 한 쌍 + 컷 · 초 · 입 맞춤 · 말. 93컷이라 한 장에 24쌍씩(6 × 4).
# 글은 콘티표.py가 낸 git 밖 콘티/p7/컷목록.json에서 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/p7/보드/)에만 둔다.
#   python -X utf8 콘티보드.py   → 콘티/p7/보드/사랑한칸_이미지콘티_<화>_<n>.jpg · _한눈_<화>.jpg(우리 그림만 차례로) · _장소.jpg(장소 기준 그림)
# 우리 그림은 콘티/p7/정지컷/<화>-<컷>.jpg(고른 판 그대로 — 색 손대지 않음, 9:16 아닌 판만 가운데로 잘라 맞춤).
import json
import sys
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p7")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, LINE = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (60, 58, 62)
SAY, LIP = (170, 220, 170), (240, 140, 140)
FW, FH = 198, 352          # 세로 그림 칸
COLS, ROWS = 6, 4
TITLE = {1: "1화 「빈 칸」", 2: "2화 「꽉 찬 칸」"}


def fit(p, w=FW, h=FH):
    if not os.path.exists(p):
        im = Image.new("RGB", (w, h), (40, 40, 44))
        ImageDraw.Draw(im).text((20, h // 2 - 14), "아직 없음", font=F("Medium", 22), fill=DIM)
        return im
    im = Image.open(p).convert("RGB")
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def wrap(d, text, font, width, maxl):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            lines.append(cur)
            cur = ch.lstrip()
        else:
            cur += ch
    if cur:
        lines.append(cur)
    if len(lines) > maxl:
        lines = lines[:maxl]
        lines[-1] = lines[-1][:-1] + "…"
    return lines


def ours(k):
    return os.path.join(V, "정지컷", f"{k}.jpg")


def board(cs, path, title):
    pad, gap, inner = 36, 26, 6
    cw = FW * 2 + inner
    ch = FH + 116
    W = pad * 2 + COLS * cw + (COLS - 1) * gap
    rows = (len(cs) + COLS - 1) // COLS
    H = 130 + rows * (ch + gap) + 20
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((pad, 28), title, font=F("ExtraBold", 38), fill=INK)
    d.text((pad, 82), "칸마다 왼쪽 원본 첫 프레임(컷 · 구도 · 카메라 · 빛을 옮긴 자리) | 오른쪽 우리 그림(받은 판 그대로). 아래 글: 컷 · 길이 · 입 맞춤 · 말. 초록은 후반 합성 자리.",
           font=F("Medium", 21), fill=DIM)
    for i, c in enumerate(cs):
        k = f"{c['화']}-{c['컷']}"
        x = pad + (i % COLS) * (cw + gap)
        y = 130 + (i // COLS) * (ch + gap)
        im.paste(fit(os.path.join(V, "원본첫프레임", f"{k}.jpg")), (x, y))
        im.paste(fit(ours(k)), (x + FW + inner, y))
        d.text((x + 6, y + 4), f"원본 {c['원본']}", font=F("ExtraBold", 18), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        d.text((x + FW + inner + 6, y + 4), k, font=F("ExtraBold", 18), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        ty = y + FH + 8
        lip = c["입맞춤"] == "있음"
        d.text((x, ty), f"{k}  {c['길이']:.2f}초", font=F("ExtraBold", 22), fill=GOLD)
        if lip:
            d.text((x + cw - 98, ty + 2), "입 맞춤", font=F("ExtraBold", 19), fill=LIP)
        ty += 32
        for ln in wrap(d, c["화면"], F("Medium", 17), cw, 2):
            d.text((x, ty), ln, font=F("Medium", 17), fill=INK)
            ty += 22
        for ln in wrap(d, c["말"], F("Medium", 17), cw, 1):
            d.text((x, ty), ln, font=F("Medium", 17), fill=SAY)
            ty += 22
    im.save(path, quality=86)
    print(path, im.size)


def glance(cs, path, title):
    w, h, gap, cols = 144, 256, 8, 16
    rows = (len(cs) + cols - 1) // cols
    im = Image.new("RGB", (gap + cols * (w + gap), 70 + rows * (h + 34)), BG)
    d = ImageDraw.Draw(im)
    d.text((gap + 4, 16), title, font=F("ExtraBold", 30), fill=INK)
    for i, c in enumerate(cs):
        k = f"{c['화']}-{c['컷']}"
        x, y = gap + (i % cols) * (w + gap), 70 + (i // cols) * (h + 34)
        im.paste(fit(ours(k), w, h), (x, y))
        d.text((x + 2, y + h + 4), k, font=F("ExtraBold", 20), fill=GOLD)
    im.save(path, quality=86)
    print(path, im.size)


def places(path):
    names = [("L1", "회사"), ("L2", "집 식탁 · 부엌"), ("L3", "현관 복도"), ("L4", "세탁기 앞"), ("L5", "침실"), ("L6", "카페")]
    w, h, gap = 300, 533, 16
    im = Image.new("RGB", (gap + len(names) * (w + gap), h + 120), BG)
    d = ImageDraw.Draw(im)
    d.text((gap, 14), "7번 「사랑 한 칸」 — 장소 기준 그림(같은 장소 컷마다 참고로 넣는다)", font=F("ExtraBold", 30), fill=INK)
    for i, (n, lab) in enumerate(names):
        im.paste(fit(os.path.join(V, "정지컷", f"{n}.png"), w, h), (gap + i * (w + gap), 64))
        d.text((gap + i * (w + gap), h + 76), f"{n} · {lab}", font=F("Medium", 22), fill=DIM)
    im.save(path, quality=88)
    print(path, im.size)


def review(cs, path, title):
    """검수용 판(10-28 아르곤 검수) — 한 장에 12쌍(4 × 3)을 보드보다 크게, 아래에 화면 · 카메라 · 말을 다 적는다. 우리 그림이 없는 컷은 뺀다."""
    w, h, inner, gap, pad = 300, 533, 6, 24, 30
    cw, th = w * 2 + inner, 150
    im = Image.new("RGB", (pad * 2 + 4 * cw + 3 * gap, 90 + 3 * (h + th + gap)), BG)
    d = ImageDraw.Draw(im)
    d.text((pad, 24), title, font=F("ExtraBold", 32), fill=INK)
    for i, c in enumerate(cs):
        k = f"{c['화']}-{c['컷']}"
        x, y = pad + (i % 4) * (cw + gap), 90 + (i // 4) * (h + th + gap)
        im.paste(fit(os.path.join(V, "원본첫프레임", f"{k}.jpg"), w, h), (x, y))
        im.paste(fit(ours(k), w, h), (x + w + inner, y))
        d.text((x + 6, y + 4), "원본", font=F("ExtraBold", 22), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        d.text((x + w + inner + 6, y + 4), f"우리 {k}", font=F("ExtraBold", 22), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        ty = y + h + 6
        d.text((x, ty), f"{k}  {c['길이']:.2f}초  얼굴: {c.get('얼굴') or '-'}" + ("  · 입 맞춤" if c["입맞춤"] == "있음" else ""), font=F("ExtraBold", 19), fill=GOLD)
        ty += 26
        for ln in wrap(d, "화면: " + c["화면"], F("Medium", 16), cw, 2):
            d.text((x, ty), ln, font=F("Medium", 16), fill=INK)
            ty += 21
        for ln in wrap(d, "카메라: " + (c.get("카메라") or "-"), F("Medium", 16), cw, 2):
            d.text((x, ty), ln, font=F("Medium", 16), fill=(170, 190, 230))
            ty += 21
        for ln in wrap(d, "말: " + c["말"], F("Medium", 16), cw, 1):
            d.text((x, ty), ln, font=F("Medium", 16), fill=SAY)
            ty += 21
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__" and "--검수" in sys.argv:
    # python -X utf8 콘티보드.py --검수 <폴더 이름>   → 콘티/p7/검수/<폴더 이름>/판_<n>.jpg
    allc = json.load(open(os.path.join(V, "컷목록.json"), encoding="utf-8"))
    have = [c for c in allc if os.path.exists(ours(f"{c['화']}-{c['컷']}"))]
    out = os.path.join(V, "검수", sys.argv[sys.argv.index("--검수") + 1])
    os.makedirs(out, exist_ok=True)
    for p in range(0, len(have), 12):
        part = have[p:p + 12]
        review(part, os.path.join(out, f"판_{p // 12 + 1}.jpg"),
               f"7번 「사랑 한 칸」 이미지 콘티 검수 판 {p // 12 + 1}/{(len(have) + 11) // 12} — 칸마다 왼쪽 원본 첫 프레임 | 오른쪽 우리 그림 ({part[0]['화']}-{part[0]['컷']} ~ {part[-1]['화']}-{part[-1]['컷']})")
    sys.exit(0)

if __name__ == "__main__":
    allc = json.load(open(os.path.join(V, "컷목록.json"), encoding="utf-8"))
    out = os.path.join(V, "보드")
    os.makedirs(out, exist_ok=True)
    per = COLS * ROWS
    for ep in (1, 2):
        cs = [c for c in allc if c["화"] == ep]
        pages = (len(cs) + per - 1) // per
        for p in range(pages):
            part = cs[p * per:(p + 1) * per]
            board(part, os.path.join(out, f"사랑한칸_이미지콘티_{ep}화_{p + 1}.jpg"),
                  f"7번 「사랑 한 칸」 {TITLE[ep]} · 이미지 콘티 {p + 1}/{pages} ({part[0]['화']}-{part[0]['컷']} ~ {part[-1]['화']}-{part[-1]['컷']})")
        glance(cs, os.path.join(out, f"사랑한칸_한눈_{ep}화.jpg"), f"7번 「사랑 한 칸」 {TITLE[ep]} — 우리 그림 {len(cs)}컷 차례대로")
    places(os.path.join(out, "사랑한칸_장소.jpg"))
