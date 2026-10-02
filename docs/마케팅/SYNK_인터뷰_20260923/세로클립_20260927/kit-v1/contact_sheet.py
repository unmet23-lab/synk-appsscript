# -*- coding: utf-8 -*-
"""스냅샷 PNG(clips/<폴더>/snapshots/frame-*-at-<초>s.png)를 한 장짜리 확인 시트로 묶는다(저장소에 남기는 작은 JPG).
안전선(위 269 · 아래 672 · 오른쪽 160)을 옅게 그어 글자가 들어가지 않았는지 한눈에 본다.
쓰는 법: python contact_sheet.py A B-synk ...   → clips/<폴더>/snapshots/시트.jpg"""
import os, re, sys, glob
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, *[".."] * 5))
FONT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-SemiBold.otf")
W, COLS = 270, 7
H = W * 1920 // 1080
S = W / 1080

def sheet(folder):
    d = os.path.join(HERE, "clips", folder, "snapshots")
    shots = []
    for p in glob.glob(os.path.join(d, "frame-*-at-*s.png")):
        m = re.search(r"-at-([\d.]+)s\.png$", p)
        if m: shots.append((float(m.group(1)), p))
    shots.sort()
    if not shots: print(folder, "스냅샷 없음"); return
    rows = (len(shots) + COLS - 1) // COLS
    pad, lab = 8, 30
    img = Image.new("RGB", (COLS * (W + pad) + pad, 44 + rows * (H + lab + pad)), (24, 24, 26))
    dr = ImageDraw.Draw(img); f = ImageFont.truetype(FONT, 20); ft = ImageFont.truetype(FONT, 24)
    dr.text((pad, 10), f"{folder} · 확인 시트 · 붉은 선 = 9:16 안전선(위 269, 아래 672, 오른쪽 160)", font=ft, fill=(235, 235, 235))
    for i, (t, p) in enumerate(shots):
        x = pad + (i % COLS) * (W + pad); y = 44 + (i // COLS) * (H + lab + pad)
        im = Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS)
        g = ImageDraw.Draw(im, "RGBA")
        for yy in (269, 1920 - 672):
            g.line([(0, yy * S), (W, yy * S)], fill=(255, 60, 60, 150), width=1)
        g.line([((1080 - 160) * S, 0), ((1080 - 160) * S, H)], fill=(255, 60, 60, 150), width=1)
        img.paste(im, (x, y + lab))
        dr.text((x + 2, y + 4), f"{t:g}s", font=f, fill=(250, 210, 90))
    out = os.path.join(d, "시트.jpg")
    img.save(out, quality=78, optimize=True)
    print(folder, len(shots), "장 →", os.path.relpath(out, HERE), f"{os.path.getsize(out) // 1024}KB")

if __name__ == "__main__":
    for f in sys.argv[1:] or sorted(os.listdir(os.path.join(HERE, "clips"))):
        if os.path.isdir(os.path.join(HERE, "clips", f)): sheet(f)
