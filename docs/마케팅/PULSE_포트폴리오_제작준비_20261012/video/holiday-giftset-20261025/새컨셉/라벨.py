# -*- coding: utf-8 -*-
"""새 제품 라벨 원고 (2026-10-29) — 앰플 앞면 흰 잉크 · 단지 앞면 금박. 우리 글꼴(Noto Serif KR)로 쓰고 그림 모델은 쓰지 않는다.
시청자 시험에서 「제품에 로고 · 라벨이 하나도 없어 3D 견본 같다」(10-29). 블렌더(시안.py)가 알파를 잉크 · 금박 자리로 읽는다.
    python -I -X utf8 라벨.py   → <밖>/새컨셉/결정/라벨_앰플.png · 라벨_단지.png
"""
import os

from PIL import Image, ImageDraw, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset",
                 "새컨셉", "결정")
SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"


def f(size, w):
    x = ImageFont.truetype(SERIF, size)
    try:
        x.set_variation_by_name(w)
    except Exception:
        pass
    return x


def centered(d, W, y, text, font, track=0.0):
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + track * font.size * (len(text) - 1)
    x = (W - total) / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=(255, 255, 255, 255))
        x += w + track * font.size


# 앰플 앞면 1.85 cm × 1.6 cm 자리(가로 600 px ≈ 1.85 cm)
W, H = 600, 520
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
centered(d, W, 20, "유리결", f(150, "Medium"), 0.10)
centered(d, W, 210, "YURIGYEOL", f(62, "Regular"), 0.32)
d.line([(W * 0.38, 312), (W * 0.62, 312)], fill=(255, 255, 255, 255), width=4)
centered(d, W, 340, "SEORIKKOT  SERUM", f(44, "Regular"), 0.22)
centered(d, W, 410, "30 ml", f(44, "Regular"), 0.10)
im.save(os.path.join(밖, "라벨_앰플.png"))

# 단지 앞면 3.8 cm × 2.2 cm 자리
W, H = 900, 520
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
centered(d, W, 40, "유리결", f(210, "Medium"), 0.12)
centered(d, W, 300, "YURIGYEOL", f(78, "Regular"), 0.34)
centered(d, W, 410, "SEORIKKOT  CREAM  50 ml", f(46, "Regular"), 0.16)
im.save(os.path.join(밖, "라벨_단지.png"))
print("저장", 밖)
