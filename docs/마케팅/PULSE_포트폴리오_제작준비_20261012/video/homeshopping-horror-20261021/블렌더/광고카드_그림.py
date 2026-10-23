# 콘티 v4 광고 카드 물건 셋의 인쇄 그림(2026-10-23) — 광고카드_물건.py가 읽는다.
#   python -X utf8 광고카드_그림.py          → 라벨 · 뚜껑판(금장 미니 · 핑크) · 상자 옆면
#   python -X utf8 광고카드_그림.py --상자    → 상자 앞면(6종 렌더 set6_0001.png가 있어야 한다 — 광고카드_물건.py --what set6 먼저)
# 서체는 브랜드 서체 SUIT(꽉_라벨.py와 같은 길). 금장 미니는 검정 라벨에 금빛 글자, 핑크 에디션은 흰 글자.
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "..", ".."))
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
XB, HV, MD = (os.path.join(SUIT, f"SUIT-{w}.otf") for w in ("ExtraBold", "Heavy", "Medium"))
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021", "블렌더", "카드v4")
GOLD, GOLD_DK, BLACK = (226, 188, 112, 255), (92, 66, 26, 255), (18, 16, 14, 255)
PINK, PINK_DK, WHITE = (244, 186, 204, 255), (214, 92, 132, 255), (255, 255, 255, 255)


def font(p, s):
    return ImageFont.truetype(p, s)


def mini_label():
    W, H = 900, 380
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=60, fill=BLACK)
    d.rounded_rectangle([14, 14, W - 15, H - 15], radius=50, outline=GOLD, width=6)
    d.text((70, 44), "꽉", font=font(XB, 250), fill=GOLD)
    d.text((372, 52), "KKWAK", font=font(XB, 116), fill=GOLD)
    d.text((376, 186), "GOLD MINI", font=font(XB, 64), fill=GOLD)   # 한 줄에 「· 한정판」까지 넣으면 라벨 밖으로 잘렸다(10-23)
    d.text((378, 262), "한정판", font=font(XB, 56), fill=GOLD)
    return im


def lid_print(ink, sub):
    im = Image.new("RGBA", (1600, 1120), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((150, 170), "꽉", font=font(XB, 520), fill=ink)
    d.text((170, 760), sub, font=font(XB, 120), fill=ink)
    return im


def box_side():
    W, H = 2400, 320
    im = Image.new("RGBA", (W, H), PINK)
    d = ImageDraw.Draw(im)
    d.text((80, 70), "꽉 KKWAK  ·  PINK EDITION  ·  진공 4중 잠금 6종 세트", font=font(XB, 140), fill=WHITE)
    return im


def box_front(set6):
    """1600² 상자 앞면 — 분홍 바탕 · 브랜드 · 「핑크 에디션」 · 6종 렌더 · 「홈쇼핑 단독」 원 딱지 · 아래 띠."""
    S = 1600
    im = Image.new("RGBA", (S, S), PINK)
    g = Image.linear_gradient("L").resize((S, S))   # 위 밝게 → 아래 조금 진하게
    im = Image.composite(Image.new("RGBA", (S, S), (236, 160, 184, 255)), im, g.point(lambda v: int(v * 0.8)))
    d = ImageDraw.Draw(im)
    d.text((110, 90), "꽉", font=font(HV, 230), fill=WHITE)
    d.text((370, 120), "KKWAK", font=font(XB, 110), fill=WHITE)
    d.text((374, 240), "VACUUM CONTAINER", font=font(MD, 54), fill=WHITE)
    d.text((110, 380), "핑크 에디션", font=font(HV, 190), fill=WHITE)
    d.text((116, 600), "진공 4중 잠금 6종 세트", font=font(XB, 92), fill=(120, 34, 66, 255))
    # 딱지
    cx, cy, r = 1350, 300, 150
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PINK_DK)
    d.ellipse([cx - r + 12, cy - r + 12, cx + r - 12, cy + r - 12], outline=WHITE, width=5)
    for t, y, s in (("홈쇼핑", -62, 64), ("단독", 18, 92)):
        w = d.textlength(t, font=font(HV, s))
        d.text((cx - w / 2, cy + y - 10), t, font=font(HV, s), fill=WHITE)
    # 6종 렌더
    p = Image.open(set6).convert("RGBA")
    bb = p.getbbox()
    p = p.crop(bb)
    k = min(1100 / p.width, 640 / p.height)   # 부제(위 · 700px까지)와 아래 띠(1440px부터) 사이에(10-23 첫 판은 부제를 가렸다)
    p = p.resize((int(p.width * k), int(p.height * k)), Image.LANCZOS)
    sh = Image.new("RGBA", p.size, (90, 20, 50, 0))
    sh.putalpha(p.getchannel("A").point(lambda v: int(v * 0.35)).filter(ImageFilter.GaussianBlur(18)))
    x0, y0 = (S - p.width) // 2, 1420 - p.height
    im.alpha_composite(sh, (x0 + 14, y0 + 24))
    im.alpha_composite(p, (x0, y0))
    # 아래 띠
    d.rectangle([0, 1440, S, S], fill=(120, 34, 66, 255))
    d.text((110, 1478), "뚜껑 색 다른 버전 · 라벨 스티커 포함", font=font(XB, 70), fill=WHITE)
    return im


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    if "--상자" in sys.argv:
        src = os.path.join(OUT, "set6", "set6_0001.png")
        p = os.path.join(OUT, "카드_상자앞면.png")
        box_front(src).save(p)
        print(p)
    else:
        for name, im in (("카드_미니라벨.png", mini_label()), ("카드_미니뚜껑판.png", lid_print(GOLD_DK, "KKWAK GOLD")),
                         ("카드_핑크뚜껑판.png", lid_print(WHITE, "PINK EDITION")), ("카드_상자옆면.png", box_side())):
            p = os.path.join(OUT, name)
            im.save(p)
            print(p, im.size)
