# 셋째 편 글자 시안(2026-11-17) — 실제 장면 그림 위에 가상 브랜드 로고 세 벌과 끝 화면 두 벌을 얹어 본다(슬롭 점검표 7 · 22 · 24 · 46).
#   로고타입은 브랜드/로고.py가 그린 PNG, 끝 로고는 승인 파일 SYNK-PULSE-Paper.png(브랜드킷 배치용)를 그대로 쓴다.
#   주소 · 고지 줄은 정보 글이라 Inter Tight(브랜드 폰트 정본의 라틴)로 친다.
#   이름은 두 사람 머리 위 밝은 벽(y 269~450 — 메타 9:16 안전 영역 위 269 아래, 머리 꼭대기 460 위)에 둔다. 사람을 덮지 않는다.
#   끝 A는 어둡게 흐린 장면에 종이색 로고, 끝 B는 밝게 흐린 장면에 잉크색 로고 — 글자 묶음은 안전 영역(y 269~1248) 가운데.
#   python -X utf8 시안.py <장면 그림(9:16)> [출력 폴더]  → 이름_A_GOYO.jpg · 이름_B_nunchi.jpg · 이름_C_TACET.jpg · 끝_A.jpg · 끝_B.jpg
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
KIT = os.path.join(ROOT, "docs", "홍보물", "마케팅실행_20260909", "브랜드킷", "배치용")
PULSE = os.path.join(KIT, "SYNK-PULSE-Paper.png")       # 어두운 바탕용
PULSE_INK = os.path.join(KIT, "SYNK-PULSE-Ink.png")    # 밝은 바탕용
FONT_M = os.path.join(ROOT, "docs", "브랜드_폰트", "InterTight", "InterTight-Medium.ttf")
FONT_R = os.path.join(ROOT, "docs", "브랜드_폰트", "InterTight", "InterTight-Regular.ttf")
W, H = 1080, 1920
NOTE = "Fictional brand · Every person on screen is an AI model"
TAGLINE = "Hear only what matters."   # 정보 글(회사 글꼴) — 이름 로고타입은 그린 글자


def scene(p):
    im = Image.open(p).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


INK = (43, 35, 32)


LAST_INK = [False]   # 바로 앞 paste_logo가 잉크색으로 바꿨는지 — 로고 밑 한 줄을 같은 색으로 맞춘다


def paste_logo(base, logo, width, cy, shadow=0.35, auto_ink=False):
    lg = logo.resize((width, round(logo.height * width / logo.width)), Image.LANCZOS)
    x, y = (W - lg.width) // 2, round(cy - lg.height / 2)
    if auto_ink:   # 로고 자리가 밝으면(평균 밝기 140 넘음) 진한 잉크색으로 — 밝은 벽 위 흰 글자는 안 읽힌다
        zone = base.convert("L").crop((x, y, x + lg.width, y + lg.height))
        mean = sum(zone.get_flattened_data()) / (zone.width * zone.height)
        if mean > 140:
            ink = Image.new("RGBA", lg.size, INK + (0,))
            ink.putalpha(lg.split()[-1])
            lg, shadow = ink, 0
    LAST_INK[0] = bool(auto_ink and shadow == 0)
    if shadow:
        a = lg.split()[-1].point(lambda v: int(v * shadow))
        sh = Image.new("RGBA", lg.size, (0, 0, 0, 0))
        sh.putalpha(a)
        sh = sh.filter(ImageFilter.GaussianBlur(14))
        base.paste(sh, (x + 3, y + 6), sh)
    base.paste(lg, (x, y), lg)
    return y + lg.height


def text(d, xy, s, font, fill, anchor="mm", spacing=0):
    if not spacing:
        d.text(xy, s, font=font, fill=fill, anchor=anchor)
        return
    widths = [d.textlength(c, font=font) for c in s]
    total = sum(widths) + spacing * (len(s) - 1)
    x = xy[0] - total / 2 if anchor[0] == "m" else (xy[0] - total if anchor[0] == "r" else xy[0])
    for c, w in zip(s, widths):
        d.text((x, xy[1]), c, font=font, fill=fill, anchor="l" + anchor[1])
        x += w + spacing


def note(base, alpha=240, fill=(250, 248, 243)):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    # 9:16 안전 영역의 아래 가운데(y 1236) — 릴스 · 쇼츠 단추와 설명 글 자리를 피한다(Fable 콘티 검수 1차 7 · 2차 6: 오른쪽 아래 음식 위 흰 글이 안 읽힘)
    f = ImageFont.truetype(FONT_R, 24)
    if fill != INK:   # 밝은 글은 바탕이 바빠도 읽히게 옅은 그림자를 깐다
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        text(ImageDraw.Draw(sh), (W / 2 + 2, 1236 + 2), NOTE, f, (0, 0, 0, 200), anchor="ms")
        base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3)))
    text(d, (W / 2, 1236), NOTE, f, fill + (alpha,), anchor="ms")
    base.alpha_composite(ov)


def name_variants(sc, out):
    tag_f = ImageFont.truetype(FONT_R, 30)
    for tag, width, cy in (("A_GOYO", 400, 332), ("B_nunchi", 400, 332), ("C_TACET", 440, 336)):
        logo = Image.open(os.path.join(HERE, f"로고_{tag}.png")).convert("RGBA")
        b = sc.copy().convert("RGBA")
        bottom = paste_logo(b, logo, width, cy, auto_ink=True)
        col = INK if LAST_INK[0] else (246, 243, 236)
        text(ImageDraw.Draw(b), (W / 2, bottom + 22), TAGLINE, tag_f, col + (225,), spacing=1)
        note(b)
        b.convert("RGB").save(os.path.join(out, f"이름_{tag}.jpg"), quality=92)


def end_variants(sc, out):
    pulse = Image.open(PULSE).convert("RGBA")
    url_f = ImageFont.truetype(FONT_M, 40)
    small = ImageFont.truetype(FONT_M, 30)
    # A — 장면을 어둡게 흐리고 가운데 로고, 아래 주소. 위에 한 줄 「Directed by an actor.」
    a = ImageEnhance.Brightness(sc.filter(ImageFilter.GaussianBlur(18))).enhance(0.38).convert("RGBA")
    bottom = paste_logo(a, pulse, 700, 930, shadow=0)
    d = ImageDraw.Draw(a)
    text(d, (W / 2, bottom + 92), "synk.im/en/pulse", url_f, (246, 243, 236, 235), spacing=2)
    text(d, (W / 2, 930 - 190 / 2 - 110), "Directed by an actor.", small, (246, 243, 236, 190), spacing=1)
    note(a)
    a.convert("RGB").save(os.path.join(out, "끝_A.jpg"), quality=92)
    # B — 같은 장면을 밝게 흐리고(방의 크림색으로 덮음) 잉크색 로고 · 주소 · 한 줄을 A와 같은 자리에
    wash = Image.new("RGB", (W, H), (244, 238, 228))
    b = Image.blend(sc.filter(ImageFilter.GaussianBlur(18)), wash, 0.62).convert("RGBA")
    bottom = paste_logo(b, Image.open(PULSE_INK).convert("RGBA"), 700, 930, shadow=0)
    d = ImageDraw.Draw(b)
    text(d, (W / 2, bottom + 92), "synk.im/en/pulse", url_f, INK + (235,), spacing=2)
    text(d, (W / 2, 930 - 190 / 2 - 110), "Directed by an actor.", small, INK + (200,), spacing=1)
    note(b, fill=INK)
    b.convert("RGB").save(os.path.join(out, "끝_B.jpg"), quality=92)


if __name__ == "__main__":
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "시안")
    os.makedirs(out, exist_ok=True)
    sc = scene(src)
    name_variants(sc, out)
    end_variants(sc, out)
    print("시안:", out)
