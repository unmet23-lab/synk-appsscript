# 블프 세일 이미지 콘티 — 모션그래픽 장면(경로 D)의 정지 판(2026-10-26). 글자 · 가격 · 로고는 AI로 그리지 않고 여기서 그린다.
#   python -X utf8 이미지콘티_글자.py  → git 밖 콘티/bf-sale/정지컷/G02.png(글자 카드) · G09.png · G11a.png · G11b.png(제품 칸) ·
#                                       G13위.png(끝 카드 위 절반, 투명) · G01전광판.png(1번 전광판 숫자, 투명)
# 제품 사진은 콘티/bf-sale/정지컷/제품_<이름>.png가 있으면 쓰고, 없으면 회색 자리 표시. 칸 모양은 원본(갈매기 꼴 칸)과 다른 우리 꼴 —
# 앞으로 기운 둥근 네모(로고의 기울기와 같은 12도) 테두리에 다홍 네온.
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HOME = os.environ["USERPROFILE"]
REPO = os.path.join(HOME, "Documents", "SYNK-appsscript")
B = os.path.join(HOME, "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale")
OUT = os.path.join(B, "정지컷")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
W, H = 1080, 1920
DAHONG, NAVY, CREAM, AMBER = (255, 74, 28), (27, 20, 70), (255, 240, 228), (255, 168, 64)
LOGO = Image.open(os.path.join(B, "참조", "힘껏_로고.png")).convert("RGBA")
os.makedirs(OUT, exist_ok=True)

# 제품 · 가격(정가 → 70%, 정가 × 0.3 — 02_콘티 2절)
P = {
    "레깅스": (59000, 17700), "브라탑": (39000, 11700), "집업 재킷": (89000, 26700),
    "후디": (79000, 23700), "조거 팬츠": (69000, 20700), "러닝 캡": (29000, 8700),
    "바람막이": (129000, 38700), "반바지": (45000, 13500),
}
for k, (a, b) in P.items():
    assert round(a * 0.3) == b, k


def won(n):
    return f"{n:,}원"


def logo(h):
    l = LOGO.copy()
    l.thumbnail((10000, h))
    return l


def glow_line(base, draw_fn, color, blur=14, passes=2):
    lay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(lay), color)
    g = lay.filter(ImageFilter.GaussianBlur(blur))
    for _ in range(passes):
        base.alpha_composite(g)
    base.alpha_composite(lay)


def card_bg():
    im = Image.new("RGBA", (W, H), NAVY + (255,))
    # 옅은 빛줄기(원본의 빨간 빛줄기 자리 — 우리 색 다홍 · 호박)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for i, (y, a) in enumerate([(380, 60), (760, 40), (1180, 55), (1560, 35)]):
        d.polygon([(0, y), (W, y - 260), (W, y - 230), (0, y + 30)], fill=DAHONG + (a,))
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(30)))
    return im


def slanted_box(d, x, y, w, h, r, color, width):
    sk = 0.21 * h   # 12도
    pts = [(x + sk, y), (x + w + sk, y), (x + w, y + h), (x, y + h)]
    d.line(pts + [pts[0]], fill=color, width=width, joint="curve")


def product(name, box):
    p = os.path.join(OUT, f"제품_{name}.png")
    x, y, w, h = box
    if os.path.exists(p):
        im = Image.open(p).convert("RGBA")
        im.thumbnail((w, h))
        return im
    ph = Image.new("RGBA", (w, h), (200, 200, 205, 255))
    ImageDraw.Draw(ph).text((20, h // 2 - 20), name, font=F("ExtraBold", 34), fill=(90, 90, 100))
    return ph


def cell(im, y, name, tag=True):
    """칸 하나 — 제품 사진(왼쪽) · 이름 · 정가(줄 그음) · 70% 가격(크게) · -70% 꼬리표(⑪만 — ⑨는 1.52초라 덜어냄, Fable 샷표 P2 13)."""
    x0, w, h = 110, 860, 420
    d = ImageDraw.Draw(im)
    glow_line(im, lambda dd, c: slanted_box(dd, x0, y, w, h, 30, c, 9), DAHONG + (255,), blur=16)
    # 칸 속 크림 판
    lay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    sk = 0.21 * h
    ld.polygon([(x0 + sk + 14, y + 14), (x0 + w + sk - 14, y + 14), (x0 + w - 14, y + h - 14), (x0 + 14, y + h - 14)], fill=CREAM + (235,))
    im.alpha_composite(lay)
    pr = product(name, (0, 0, 330, 360))
    im.alpha_composite(pr, (int(x0 + 70), int(y + (h - pr.height) // 2)))
    tx = x0 + 440
    d.text((tx, y + 40), name, font=F("ExtraBold", 44), fill=NAVY)
    a, b = P[name]
    old = won(a)
    d.text((tx, y + 108), old, font=F("SemiBold", 44), fill=(120, 110, 140))
    ow = d.textlength(old, font=F("SemiBold", 44))
    d.line([(tx - 4, y + 134), (tx + ow + 4, y + 134)], fill=DAHONG, width=6)
    d.text((tx, y + 182), won(b), font=F("Heavy", 92), fill=DAHONG)
    if tag:   # -70% 꼬리표
        t = "-70%"
        tw = d.textlength(t, font=F("Heavy", 46))
        d.rounded_rectangle([x0 + w - tw - 40, y + 30, x0 + w + 6, y + 96], radius=18, fill=DAHONG)
        d.text((x0 + w - tw - 17, y + 36), t, font=F("Heavy", 46), fill=(255, 255, 255))


def grid(names, clock, out, extra=True):
    im = card_bg()
    d = ImageDraw.Draw(im)
    # 위 띠 — 행사 이름 + 카운트다운(원본: 행사 이름 · 날짜 띠)
    l = logo(92)
    im.alpha_composite(l, (90, 120))
    d.text((90 + l.width + 24, 132), "블랙프라이데이", font=F("ExtraBold", 66), fill=(255, 255, 255))
    pill = f"자정까지 {clock}"
    pw = d.textlength(pill, font=F("ExtraBold", 40))
    d.rounded_rectangle([990 - pw - 40, 236, 990, 300], radius=14, fill=DAHONG)
    d.text((990 - pw - 20, 268), pill, font=F("ExtraBold", 40), fill=(255, 255, 255), anchor="lm")
    for i, n in enumerate(names):
        cell(im, 360 + i * 470, n, tag=extra)
    if extra:   # 밑줄 글(수량 한정 신호 — 00_레퍼런스 형식 근거)은 ⑪(3.12초)에만
        d.text((90, 1790), "오늘 자정까지 · 사이즈 품절이 빨라요", font=F("Medium", 34), fill=(210, 200, 230))
    im.convert("RGB").save(os.path.join(OUT, out))


def card02():
    im = Image.new("RGBA", (W, H), DAHONG + (255,))
    d = ImageDraw.Draw(im)
    d.text((W // 2, 760), "오늘 자정까지", font=F("ExtraBold", 92), fill=(255, 255, 255), anchor="mm")
    d.text((W // 2, 960), "전 품목", font=F("Heavy", 150), fill=NAVY, anchor="mm")
    d.text((W // 2, 1170), "70%", font=F("Heavy", 300), fill=(255, 255, 255), anchor="mm")
    im.convert("RGB").save(os.path.join(OUT, "G02.png"))


def card13():
    im = Image.new("RGBA", (W, 830), NAVY + (255,))
    d = ImageDraw.Draw(im)
    l = logo(150)
    im.alpha_composite(l, ((W - l.width) // 2, 70))
    d.text((W // 2, 300), "블랙프라이데이", font=F("ExtraBold", 72), fill=(255, 255, 255), anchor="mm")
    d.text((W // 2, 410), "오늘 자정까지 전 품목 70%", font=F("Heavy", 68), fill=DAHONG, anchor="mm")
    d.rounded_rectangle([300, 480, 780, 600], radius=24, outline=DAHONG, width=6)
    d.text((W // 2, 540), "00:59:46", font=F("Heavy", 84), fill=(255, 255, 255), anchor="mm")
    d.text((W // 2, 680), "지금 힘껏 앱에서", font=F("ExtraBold", 56), fill=CREAM, anchor="mm")
    # 주황 조각(12.9–13.5초에 터지는 자리 — 정지 판엔 퍼진 뒤 모습)
    import random
    random.seed(7)
    for _ in range(26):
        x, y = random.randint(20, W - 20), random.randint(20, 800)
        if 260 < x < 820 and 60 < y < 720:
            continue
        s = random.randint(14, 34)
        col = random.choice([DAHONG, AMBER, (255, 214, 150)])
        d.polygon([(x, y), (x + s, y + s // 3), (x + s // 2, y + s)], fill=col)
    im.save(os.path.join(OUT, "G13위.png"))


def board01():
    # 1번 전광판(원본 초록 자리 327×94px) — 어두운 판 위 다홍 빛 숫자
    im = Image.new("RGBA", (327, 94), (12, 8, 24, 255))
    d = ImageDraw.Draw(im)
    d.text((14, 47), "자정까지", font=F("ExtraBold", 26), fill=(255, 150, 110), anchor="lm")
    d.text((318, 47), "00:59:59", font=F("Heavy", 50), fill=(255, 110, 60), anchor="rm")
    im.save(os.path.join(OUT, "G01전광판.png"))


card02()
# 칸 배정(Fable 샷표 P2 12 · P3 22): ⑨ 위 · 가운데에 가장 보여 줄 레깅스 · 바람막이(내레이션 「바람막이도」와 같은 때), 아래 브라탑.
# ⑪ 8.60 하드 컷에 후디 · 조거 · 캡 → 10.2 묶음 회전에서 가운데 · 아래만 집업 재킷 · 반바지로. 시계는 ① 0.5초에 59 → 58로 시작해 1초마다(⑨ 6.16 = 53, ⑪ 8.60 = 50, 10.5 = 48).
grid(["레깅스", "바람막이", "브라탑"], "00:59:53", "G09.png", extra=False)
grid(["후디", "조거 팬츠", "러닝 캡"], "00:59:50", "G11a.png")
grid(["후디", "집업 재킷", "반바지"], "00:59:48", "G11b.png")
card13()
board01()
print("ok", OUT)
