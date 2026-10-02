"""프로필 사진 5종 검토 시트(../프로필_시트.jpg). 큰 원(채널 화면)과 40px 원(댓글·피드)을 함께 보인다.

    python 시트.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
FONT = os.path.join(ROOT, "docs/브랜드_폰트/SUIT")

ITEMS = [
    ("avatar-lab.png", "LAB 전 계정", "몽골 5 · 해외 24 · 유튜브 17 · 인스타 · 틱톡 · 페이스북 · 텔레그램 · RUTUBE · 샤오훙수"),
    ("avatar-brief.png", "synkbrief", "유튜브 · 인스타 · 틱톡"),
    ("avatar-yuho.png", "yuhobuilds · 유호", "유튜브 · 인스타 · 틱톡 · 스레드 · X · 링크드인 · 클립 · 블로그"),
    ("avatar-synk.png", "SYNK 회사", "링크드인 회사 · Behance · Substack"),
    ("avatar-shift.png", "SYNK SHIFT", "핀터레스트 · 카카오 채널"),
]
COL, BIG, SMALL = 320, 240, 40


def circle(path, d):
    im = Image.open(path).convert("RGB").resize((d * 4, d * 4), Image.LANCZOS)
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, im.width - 1, im.height - 1), fill=255)
    im.putalpha(m)
    return im.resize((d, d), Image.LANCZOS)


def wrap(draw, text, font, width):
    """« · »로 나눈 낱말 단위로만 줄을 바꾼다(낱말 가운데서 끊지 않는다)."""
    lines, cur = [], ""
    for tok in text.split(" · "):
        nxt = tok if not cur else cur + " · " + tok
        if draw.textlength(nxt, font=font) <= width:
            cur = nxt
        else:
            lines.append(cur)
            cur = tok
    lines.append(cur)
    return lines


if __name__ == "__main__":
    h1 = ImageFont.truetype(os.path.join(FONT, "SUIT-ExtraBold.otf"), 24)
    p = ImageFont.truetype(os.path.join(FONT, "SUIT-Medium.otf"), 17)
    W, H = COL * len(ITEMS) + 40, 520
    sheet = Image.new("RGB", (W, H), (247, 245, 241))
    d = ImageDraw.Draw(sheet)
    for i, (f, name, accounts) in enumerate(ITEMS):
        x = 20 + i * COL
        big = circle(os.path.join(HERE, f), BIG)
        sheet.paste(big, (x + (COL - BIG) // 2, 24), big)
        sm = circle(os.path.join(HERE, f), SMALL)
        sheet.paste(sm, (x + (COL - SMALL) // 2, 24 + BIG + 18), sm)
        y = 24 + BIG + 18 + SMALL + 26
        d.text((x + 20, y), name, font=h1, fill=(20, 17, 15))
        y += 38
        for ln in wrap(d, accounts, p, COL - 40):
            d.text((x + 20, y), ln, font=p, fill=(90, 86, 80))
            y += 26
    out = os.path.join(HERE, "..", "프로필_시트.jpg")
    sheet.save(out, quality=90)
    print(out)
