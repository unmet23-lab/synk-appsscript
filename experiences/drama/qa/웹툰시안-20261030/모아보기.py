# 드라마 말하기 1화 웹툰 시안 — 한 장 모아보기(2026-10-30). Fable 검수 · 나란히 보기용으로 <작업>/보드/에 쓴다.
#   python -X utf8 모아보기.py <작업> [앞 판 폴더(받음/ 아래, 기본 검수전)]
#   → 시트.jpg(교수 셋 | 선배 셋) · 칸_A.jpg(칸 1 · 4 · 8 · 12 · 14) · 화풍.jpg(칸 1 · 8 × A · B · C) · 전후.jpg(앞 판 ↔ 지금, 있는 칸만)
import os
import sys

from PIL import Image, ImageDraw, ImageFont

work = sys.argv[1]
got = os.path.join(work, "받음")
out = os.path.join(work, "보드")
os.makedirs(out, exist_ok=True)
try:
    FONT = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 26)
except OSError:
    FONT = ImageFont.load_default()


def tile(path, h, label):
    im = Image.open(path).convert("RGB")
    im = im.resize((round(im.width * h / im.height), h))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.width, 38], fill=(25, 25, 25))
    d.text((10, 5), label, fill=(255, 255, 255), font=FONT)
    return im


def row(tiles, gap=12, bg=(240, 240, 236)):
    w = sum(t.width for t in tiles) + gap * (len(tiles) - 1)
    h = max(t.height for t in tiles)
    canvas = Image.new("RGB", (w, h), bg)
    x = 0
    for t in tiles:
        canvas.paste(t, (x, 0))
        x += t.width + gap
    return canvas


def stack(rows, gap=12, bg=(240, 240, 236)):
    w = max(r.width for r in rows)
    h = sum(r.height for r in rows) + gap * (len(rows) - 1)
    canvas = Image.new("RGB", (w, h), bg)
    y = 0
    for r in rows:
        canvas.paste(r, (0, y))
        y += r.height + gap
    return canvas


def p(name, sub=""):
    return os.path.join(got, sub, f"{name}.png")


def save(im, name):
    im.save(os.path.join(out, name), "JPEG", quality=85)
    print(name, im.size)


sheets = [[tile(p(f"sheet-{k}-{n}"), 420, f"{k} {n}") for n in (1, 2, 3) if os.path.exists(p(f"sheet-{k}-{n}"))] for k in ("prof", "senior")]
if all(sheets):
    save(stack([row(r) for r in sheets]), "시트.jpg")
panels = [tile(p(f"panel-{n}-A"), 900, f"칸 {int(n)} · A") for n in ("01", "04", "08", "12", "14") if os.path.exists(p(f"panel-{n}-A"))]
if panels:
    save(row(panels), "칸_A.jpg")
styles = [[tile(p(f"panel-{n}-{s}"), 760, f"칸 {int(n)} · {s}") for s in ("A", "B", "C") if os.path.exists(p(f"panel-{n}-{s}"))] for n in ("01", "08")]
if all(len(r) == 3 for r in styles):
    save(stack([row(r) for r in styles]), "화풍.jpg")
before = sys.argv[2] if len(sys.argv) > 2 else "검수전"
pairs = [row([tile(p(f"panel-{n}-A", before), 700, f"칸 {int(n)} · {before}"), tile(p(f"panel-{n}-A"), 700, f"칸 {int(n)} · 지금")])
         for n in ("01", "04", "08", "12", "14") if os.path.exists(p(f"panel-{n}-A", before)) and os.path.exists(p(f"panel-{n}-A"))]
if pairs:
    save(stack(pairs), "전후.jpg")
