# 원본 첫 프레임 | 우리 블렌더 렌더를 나란히 — 굽고 나서 구도 · 빛 · 크기를 견주는 작업판(원본 프레임이 들어가 git 밖에만 쓴다).
#   python -I -X utf8 비교판.py <이름> S02:s02 S03:s03 …   → <밖>/렌더/_비교_<이름>.jpg
import os
import sys

from PIL import Image, ImageDraw, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p2")
F = ImageFont.truetype(os.path.join(os.environ["USERPROFILE"], "Documents", "SYNK-appsscript", "docs", "브랜드_폰트", "SUIT", "SUIT-ExtraBold.otf"), 26)
name, pairs = sys.argv[1], [p.split(":") for p in sys.argv[2:]]
W, H = 640, 360
sheet = Image.new("RGB", (W * 2 + 30, (H + 40) * len(pairs)), (16, 16, 16))
d = ImageDraw.Draw(sheet)
for i, (o, r) in enumerate(pairs):
    a = Image.open(os.path.join(밖, "원본첫프레임", f"{o}.png")).convert("RGB").resize((W, H))
    b = Image.open(os.path.join(밖, "렌더", f"{r}.png")).convert("RGB").resize((W, H))
    y = i * (H + 40) + 36
    sheet.paste(a, (10, y))
    sheet.paste(b, (W + 20, y))
    d.text((10, y - 32), f"원본 {o}", font=F, fill=(240, 200, 120))
    d.text((W + 20, y - 32), f"우리 {r}", font=F, fill=(170, 220, 170))
out = os.path.join(밖, "렌더", f"_비교_{name}.jpg")
sheet.save(out, quality=85)
print(out)
