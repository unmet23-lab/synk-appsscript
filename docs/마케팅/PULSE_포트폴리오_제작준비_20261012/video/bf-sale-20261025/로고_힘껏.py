# 가상 운동복 브랜드 「힘껏」 로고(2026-10-26) — 글자 로고는 AI로 그리지 않고 여기서 만든다(제작 규칙 원칙).
# 장면 속 간판(6번 벽)은 이 그림을 참고로 넣어 정지컷에 함께 굽고, 끝 카드 · 글자 카드에는 이 그림을 그대로 얹는다.
#   python -X utf8 로고_힘껏.py  → git 밖 콘티/bf-sale/참조/힘껏_로고.png(투명) · 힘껏_로고_흰바탕.png · 힘껏_로고_간판.png(남보라 벽 위 빛 글자)
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

REPO = os.path.join(os.environ["USERPROFILE"], "Documents", "SYNK-appsscript")
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale", "참조")
FONT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-Heavy.otf")
DAHONG = (255, 74, 28)      # 다홍 #FF4A1C — 브랜드 색
NAVY = (27, 20, 70)         # 깊은 남보라 #1B1446
os.makedirs(OUT, exist_ok=True)


def wordmark(color, h=420):
    f = ImageFont.truetype(FONT, h)
    tmp = Image.new("L", (10, 10))
    x0, y0, x1, y1 = ImageDraw.Draw(tmp).textbbox((0, 0), "힘껏", font=f)
    w, hh = x1 - x0, y1 - y0
    pad = int(h * 0.35)
    m = Image.new("L", (w + pad * 2, hh + pad * 2), 0)
    ImageDraw.Draw(m).text((pad - x0, pad - y0), "힘껏", font=f, fill=255)
    # 앞으로 기운 글자(달리는 느낌) — 12도 기울임
    sk = 0.21
    W2 = int(m.width + m.height * sk)
    m = m.transform((W2, m.height), Image.AFFINE, (1, sk, -m.height * sk, 0, 1, 0), Image.BICUBIC)
    # 왼쪽 속도 줄 셋(굵기 다름)
    d = ImageDraw.Draw(m)
    cy = m.height // 2
    for i, (dy, ln, th) in enumerate([(-int(h * 0.22), 0.30, 0.055), (0, 0.42, 0.07), (int(h * 0.22), 0.22, 0.045)]):
        x_end = int(pad * 0.9)
        d.rounded_rectangle([x_end - int(h * ln), cy + dy - int(h * th / 2), x_end, cy + dy + int(h * th / 2)], radius=int(h * th / 2), fill=255)
    bbox = m.getbbox()
    m = m.crop((bbox[0] - 20, bbox[1] - 20, bbox[2] + 20, bbox[3] + 20))
    rgba = Image.new("RGBA", m.size, color + (0,))
    rgba.putalpha(m)
    return rgba


logo = wordmark(DAHONG)
logo.save(os.path.join(OUT, "힘껏_로고.png"))
wb = Image.new("RGB", (logo.width + 200, logo.height + 200), (255, 255, 255))
wb.paste(logo, (100, 100), logo)
wb.save(os.path.join(OUT, "힘껏_로고_흰바탕.png"))
# 간판 — 남보라 벽 위에 빛나는 다홍 글자(장면 속 간판을 정지컷에 굽기 위한 참고)
sign = Image.new("RGB", (logo.width + 400, logo.height + 300), NAVY)
glow = Image.new("RGBA", sign.size, (0, 0, 0, 0))
glow.paste(logo, (200, 150), logo)
g = glow.filter(ImageFilter.GaussianBlur(28))
sign = Image.alpha_composite(sign.convert("RGBA"), g)
sign = Image.alpha_composite(sign, g)
core = wordmark((255, 196, 160))
sign.paste(core, (200, 150), core)
sign.convert("RGB").save(os.path.join(OUT, "힘껏_로고_간판.png"))
print(OUT, logo.size)
