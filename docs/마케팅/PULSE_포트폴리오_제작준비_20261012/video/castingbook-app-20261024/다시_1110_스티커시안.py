# 8번 11번 컷 스티커 원고 시안 셋(2026-11-10, Claude) — 11-10 유호님 「텍스트가 상당히 슬롭같아. ai로 만든티가 확 나는데 … 왜 이렇게 형편없이 ai슬롭느낌으로 텍스트를 만든거야」.
# 앞 원고(다시_1109_스티커원고.py)는 회사 화면 글꼴 SUIT Heavy를 원색 띠에 꽉 채우고 NEW 알약을 붙였다 — 폰트 정본 §10-1 「회사 화면의 헤드 800을 작품 안으로 끌고 오지 않는다」를
# 어겼고, §10-4의 「실제 장면 위 시안 둘 이상 · 기성 글꼴을 얹은 티 맹검」 없이 한 판으로 갔다. Fable 글자 심사는 「원고와 같은가」만 물어 원고 자체의 템플릿 티를 못 잡았다.
# 그래서 셋을 나란히 만든다(폰트 정본 §10-2 · 점검표 46).
#   A 글 없음 — 하린 + 딸기 라떼 컵을 따라 오린 칼선 스티커(흰 테두리). 원본 11번(뜨개 키링 접사)에도 글이 없고, §10-4 1 「말 · 그림으로 되면 글을 넣지 않는다」.
#   B 작은 명조 묶음 — 크림 종이 카드, 송명(붓 맛 명조) 「딸기 라떼」 + 작은 영문 이탤릭 + 띄어 쓴 NEW · 값. 동네 감성 카페 인쇄물의 위계(작게 · 여백).
#   C 둥근 굵은 레터링 — 베이글 팻 원 「딸기라떼」를 사진 아래 크림 판에 살짝 기울여, 딸기우유 색 한 벌. 프랜차이즈 판촉물 쪽.
# 글꼴은 Google Fonts(OFL) — 저장소 밖 synk-vendor/fonts/google_20261110/.
#   python -X utf8 다시_1110_스티커시안.py   → git 밖 콘티/p8/다시_1110/스티커_A · B · C.png(회색 판 위)
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

F02 = "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/img/F02/context.webp"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8/다시_1110"
FD = "C:/Users/q1212/Documents/synk-vendor/fonts/google_20261110/"
SONG = FD + "SongMyung-Regular.ttf"
BAGEL = FD + "BagelFatOne-Regular.ttf"
ITAL = FD + "InstrumentSerif-Italic.ttf"
ROMAN = FD + "InstrumentSerif-Regular.ttf"
GREY = (150, 150, 150)
CREAM = (246, 239, 228)
BERRY = (158, 31, 53)
MILK = (243, 176, 192)


def rounded(w, h, r):
    m = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), r * 4, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def tracked(d, xy, text, font, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + track
    return x


def on_grey(art, mask, name, pad=80):
    out = Image.new("RGB", (art.width + pad * 2, art.height + pad * 2), GREY)
    out.paste(art, (pad, pad), mask)
    p = os.path.join(OUT, f"스티커_{name}.png")
    out.save(p)
    print(p, out.size)


def photo(w, h, y0=136):
    src = Image.open(F02).convert("RGB")
    sw, sh = src.size
    ch = round(sw * h / w)
    return src.crop((0, y0, sw, y0 + ch)).resize((w, h), Image.LANCZOS)


def sticker_a():
    from rembg import new_session, remove
    src = Image.open(F02).convert("RGB")
    cut = remove(src, session=new_session("bria-rmbg"))   # 사람 + 컵 — isnet은 팔꿈치 옆 카운터 조각을, u2net은 등 뒤 의자를 함께 땄다(11-10 셋 견줌)
    a = np.asarray(cut.split()[-1])
    border = 34
    a = np.pad(a, ((0, border + 6), (0, 0)))   # 사진 아래 끝에서 잘린 몸에도 흰 테두리가 돌게
    src = Image.fromarray(np.pad(np.asarray(src), ((0, border + 6), (0, 0), (0, 0)), mode="edge"))
    m = Image.fromarray((a > 128).astype(np.uint8) * 255)
    bbox = m.getbbox()
    m2 = m.filter(ImageFilter.MaxFilter(border * 2 + 1)).filter(ImageFilter.GaussianBlur(3)).point(lambda v: 255 if v > 128 else 0)
    x0, y0, x1, y1 = m2.getbbox()
    art = Image.new("RGB", src.size, (255, 255, 255))
    art.paste(src, (0, 0), m)
    art, m2 = art.crop((x0, y0, x1, y1)), m2.crop((x0, y0, x1, y1))
    print("A 칼선 상자", (x0, y0, x1, y1), "사람 상자", bbox)
    on_grey(art, m2, "A_글없음")


def sticker_b():
    W, H, E = 1200, 1560, 30
    art = Image.new("RGB", (W, H), CREAM)
    pw, ph = W - E * 2, 1090
    art.paste(photo(pw, ph), (E, E), rounded(pw, ph, 40))
    d = ImageDraw.Draw(art)
    x = 86
    tracked(d, (x, ph + E + 70), "NEW", ImageFont.truetype(ROMAN, 40), BERRY, 14)
    d.text((x - 6, ph + E + 118), "딸기 라떼", font=ImageFont.truetype(SONG, 148), fill=BERRY)
    d.text((x, ph + E + 300), "Strawberry Latte", font=ImageFont.truetype(ITAL, 66), fill=(122, 90, 80))
    price = ImageFont.truetype(ROMAN, 66)
    d.text((W - 86 - d.textlength("5.8", font=price), ph + E + 300), "5.8", font=price, fill=(122, 90, 80))
    on_grey(art, rounded(W, H, 70), "B_명조")


def sticker_c():
    W, H, E = 1200, 1560, 30
    art = Image.new("RGB", (W, H), CREAM)
    pw, ph = W - E * 2, 1130
    art.paste(photo(pw, ph), (E, E), rounded(pw, ph, 40))
    layer = Image.new("RGBA", (W, 420), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    f = ImageFont.truetype(BAGEL, 210)
    t = "딸기라떼"
    tw = ld.textlength(t, font=f)
    ld.text(((W - tw) / 2, 70), t, font=f, fill=BERRY)
    layer = layer.rotate(4, resample=Image.BICUBIC, center=(W / 2, 210))
    art.paste(layer, (0, ph - 70), layer)
    d = ImageDraw.Draw(art)
    nf = ImageFont.truetype(ITAL, 58)
    d.text((W - 92 - d.textlength("new!", font=nf), ph + E + 300), "new!", font=nf, fill=(122, 90, 80))
    on_grey(art, rounded(W, H, 70), "C_레터링")


def sticker_c2():
    """C 둘째 판(11-10 Fable 맹검 뒤) — C(7.5)의 약점 둘: 글자가 판 폭을 꽉 채워 여백이 빠듯함, 위계가 한 단. 같은 글꼴로 작은 「신메뉴」를 위에 얹어 두 단으로 하고
    (다음 컷 폰 「딸기 라떼 신메뉴」와 같은 낱말), 「딸기라떼」는 판 폭의 70%로 줄여 좌우 여백을 둔다. 들린 귀퉁이는 굽는 지시문에서 뺀다(맹검 「목업 효과 티」)."""
    W, H, E = 1200, 1560, 30
    art = Image.new("RGB", (W, H), CREAM)
    pw, ph = W - E * 2, 1110
    art.paste(photo(pw, ph), (E, E), rounded(pw, ph, 40))
    d = ImageDraw.Draw(art)
    size = 220
    while True:
        f = ImageFont.truetype(BAGEL, size)
        if d.textlength("딸기라떼", font=f) <= W * 0.70:
            break
        size -= 2
    small = ImageFont.truetype(BAGEL, round(size * 0.36))
    b1 = d.textbbox((0, 0), "신메뉴", font=small)
    b2 = d.textbbox((0, 0), "딸기라떼", font=f)
    gap = round(size * 0.16)
    block = (b1[3] - b1[1]) + gap + (b2[3] - b2[1])
    top = ph + E + (H - E - (ph + E) - block) / 2   # 사진 아래 크림 칸 가운데
    d.text(((W - (b1[2] - b1[0])) / 2 - b1[0], top - b1[1]), "신메뉴", font=small, fill=BERRY)
    d.text(((W - (b2[2] - b2[0])) / 2 - b2[0], top + (b1[3] - b1[1]) + gap - b2[1]), "딸기라떼", font=f, fill=BERRY)
    print("C2 글자 크기", size, "폭", b2[2] - b2[0], "/", W, "묶음 높이", block, "/", H - E - (ph + E))
    on_grey(art, rounded(W, H, 70), "C2_레터링")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    sticker_a()
    sticker_b()
    sticker_c()
    sticker_c2()
