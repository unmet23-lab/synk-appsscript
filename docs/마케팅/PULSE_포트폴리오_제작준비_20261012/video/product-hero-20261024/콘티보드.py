"""PULSE 1 · 3번 이미지 콘티 보드 — 원본 프레임 | 우리 판을 컷(박)마다 나란히 (2026-10-25).

원본 프레임이 들어가므로 보드는 git 밖에만 쓴다(<밖>/보드). 우리 판은 블렌더 렌더 · Gemini 바탕 합성.
  python 콘티보드.py <판 이름 v1|v2…>
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

저장소 = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5))
밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3"
원본 = os.path.join(밖, "원본프레임")
글꼴 = os.path.join(저장소, "docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf")
글꼴굵게 = os.path.join(저장소, "docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf")

판 = sys.argv[1] if len(sys.argv) > 1 else "v1"
칸 = json.load(open(os.path.join(밖, "보드", f"보드칸_{판}.json"), encoding="utf-8"))


def font(size, bold=False):
    return ImageFont.truetype(글꼴굵게 if bold else 글꼴, size)


def fit(path, w, h):
    im = Image.open(path).convert("RGB")
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0 = (im.width - w) // 2
    y0 = (im.height - h) // 2
    return im.crop((x0, y0, x0 + w, y0 + h))


def wrap(d, text, f, width):
    lines, cur = [], ""
    for word in text.split(" "):
        t = (cur + " " + word).strip()
        if d.textlength(t, font=f) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def board(title, cells, cols, out, pw=405, ph=720):
    """cells: [{원본, 우리, 머리, 설명}] — 칸 하나 = 원본 | 우리 두 장 + 아래 글."""
    gap, pad, cap_h, head_h = 14, 28, 132, 92
    cw = pw * 2 + 6
    rows = (len(cells) + cols - 1) // cols
    W = pad * 2 + cols * cw + (cols - 1) * gap * 2
    H = head_h + pad + rows * (ph + 34 + cap_h) + (rows - 1) * gap + pad
    B = Image.new("RGB", (W, H), (246, 245, 242))
    d = ImageDraw.Draw(B)
    d.text((pad, 26), title, font=font(34, True), fill=(20, 24, 40))
    for i, c in enumerate(cells):
        r, k = divmod(i, cols)
        x = pad + k * (cw + gap * 2)
        y = head_h + pad + r * (ph + 34 + cap_h + gap)
        d.text((x, y), c["머리"], font=font(22, True), fill=(20, 24, 40))
        y += 34
        B.paste(fit(c["원본"], pw, ph), (x, y))
        B.paste(fit(c["우리"], pw, ph), (x + pw + 6, y))
        for tx, lab in ((x + 10, "원본"), (x + pw + 16, "우리 판")):
            tw = d.textlength(lab, font=font(18, True))
            d.rounded_rectangle((tx - 6, y + 10, tx + tw + 8, y + 38), radius=6, fill=(20, 24, 40))
            d.text((tx + 1, y + 13), lab, font=font(18, True), fill=(255, 255, 255))
        ty = y + ph + 10
        for line in wrap(d, c["설명"], font(17), cw)[:5]:
            d.text((x, ty), line, font=font(17), fill=(50, 54, 70))
            ty += 24
    B.save(out, quality=90)
    print(out, B.size)


os.makedirs(os.path.join(밖, "보드"), exist_ok=True)
for b in 칸["보드"]:
    cells = [dict(c, 원본=os.path.join(원본, c["원본"]), 우리=os.path.join(밖, c["우리"])) for c in b["칸"]]
    board(b["제목"], cells, b.get("열", 2), os.path.join(밖, "보드", b["파일"]))
