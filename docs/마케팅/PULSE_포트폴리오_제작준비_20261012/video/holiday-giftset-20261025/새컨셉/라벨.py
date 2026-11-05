# -*- coding: utf-8 -*-
"""새 제품 라벨 원고 (2026-10-29) — 앰플 앞면 흰 잉크 · 단지 앞면 금박. 그림 모델은 쓰지 않고 글꼴로 쓴다.
시청자 시험에서 「제품에 로고 · 라벨이 하나도 없어 3D 견본 같다」(10-29). 블렌더(시안.py)가 알파를 잉크 · 금박 자리로 읽는다.

11-06 유호님 「일본어로 옮긴 서릿결로 한국어를 전부 일본어로」 → 「이 판으로 바꿔」: 브랜드를 「유리결 YURIGYEOL」에서
「霜の肌理 SHIMO NO KIME」로 바꿨다. 글꼴은 시퍼리 명조(OFL, synk-vendor/fonts/shippori), 가나 「の」는 한자보다 작게 낮춘다.
라인 이름 「霜花」는 そうか(創価)로 읽히고 雪花秀와 한 글자 차이라 뺐다(Fable 교정). 한글 판 원고는 git 기록과
<밖>/결정/라벨_*_유리결.png에 남아 있다.
    python -I -X utf8 라벨.py   → <밖>/새컨셉/결정/라벨_앰플.png · 라벨_단지.png
"""
import os

from PIL import Image, ImageDraw, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset",
                 "새컨셉", "결정")
FONT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "fonts", "shippori", "ShipporiMincho-{}.ttf")
ROMA = "SHIMO NO KIME"


def f(size, w="Medium"):
    return ImageFont.truetype(FONT.format(w), size)


def run(d, W, y, parts, track=0.0):
    """parts = [(글자, 글꼴, 세로 밀기)…]를 한 줄 가운데에 — 글자마다 너비를 재서 자간 track(px)을 준다."""
    glyphs = [(ch, font, dy, d.textlength(ch, font=font)) for text, font, dy in parts for ch in text]
    x = (W - sum(g[3] for g in glyphs) - track * (len(glyphs) - 1)) / 2
    for ch, font, dy, w in glyphs:
        d.text((x, y + dy), ch, font=font, fill=(255, 255, 255, 255))
        x += w + track


def name(d, W, y, big):
    """霜の肌理 — 「の」는 한자의 0.72배로 줄이고 아래로 맞춘다(일본 로고타입 관습)."""
    k, no = f(big), f(int(big * 0.72))
    run(d, W, y, [("霜", k, 0), ("の", no, int(big * 0.21)), ("肌理", k, 0)], track=big * 0.04)


# 앰플 앞면 1.85 cm × 1.6 cm 자리(가로 600 px ≈ 1.85 cm)
W, H = 600, 520
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
name(d, W, 24, 128)
run(d, W, 214, [(ROMA, f(40, "Regular"), 0)], track=40 * 0.22)
d.line([(W * 0.40, 300), (W * 0.60, 300)], fill=(255, 255, 255, 255), width=4)
run(d, W, 326, [("美容液", f(50), 0)], track=50 * 0.08)
run(d, W, 404, [("30mL", f(44, "Regular"), 0)], track=44 * 0.06)
im.save(os.path.join(밖, "라벨_앰플.png"))

# 단지 앞면 3.8 cm × 2.2 cm 자리
W, H = 900, 520
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
name(d, W, 36, 184)
run(d, W, 300, [(ROMA, f(54, "Regular"), 0)], track=54 * 0.24)
run(d, W, 404, [("クリーム  50g", f(52), 0)], track=52 * 0.08)
im.save(os.path.join(밖, "라벨_단지.png"))
print("저장", 밖)
