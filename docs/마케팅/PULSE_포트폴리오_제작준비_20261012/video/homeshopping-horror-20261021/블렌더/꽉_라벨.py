# 2안 가상 브랜드 「꽉 KKWAK」 인쇄 그림 두 장(2026-10-22) — 밀폐용기.py가 읽는다.
#   python -X utf8 꽉_라벨.py   → synk-vendor/homeshopping-horror-20261021/블렌더/2안/꽉_뚜껑판.png · 꽉_앞라벨.png
# 뚜껑판: 뚜껑 윗면 인쇄(투명 바탕에 진한 민트 글자, 가운데 진공 단추 자리는 비움, 뚜껑 비율 약 200×140).
# 앞라벨: 용기 앞면 스티커(흰 둥근 판 + 민트 글자, 900×380). 서체는 브랜드 서체 SUIT ExtraBold.
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "..", ".."))
F = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-ExtraBold.otf")
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021", "블렌더", "2안")
INK, INK_LABEL, GREY = (36, 96, 86, 255), (40, 128, 112, 255), (70, 90, 86, 255)


def lid_print():
    im = Image.new("RGBA", (1600, 1120), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((150, 170), "꽉", font=ImageFont.truetype(F, 520), fill=INK)
    d.text((170, 760), "KKWAK VACUUM", font=ImageFont.truetype(F, 120), fill=INK)
    return im


def front_label():
    W, H = 900, 380
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=60, fill=(250, 251, 250, 255))
    d.text((60, 40), "꽉", font=ImageFont.truetype(F, 260), fill=INK_LABEL)
    d.text((380, 80), "KKWAK", font=ImageFont.truetype(F, 120), fill=INK_LABEL)
    d.text((384, 214), "진공 밀폐용기", font=ImageFont.truetype(F, 84), fill=GREY)
    return im


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, im in (("꽉_뚜껑판.png", lid_print()), ("꽉_앞라벨.png", front_label())):
        p = os.path.join(OUT, name)
        im.save(p)
        print(p, im.size)
