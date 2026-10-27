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
        im = Image.open(p).convert("RGB")
        # 사진 바탕(밝은 회백 상자)을 네 귀퉁이에서 채워 투명으로 — 크림 칸 위에 상자 테두리가 비쳤다(Fable 10-26 P2 8)
        key = (255, 0, 255)
        ff = im.copy()
        for c in ((0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)):
            ImageDraw.floodfill(ff, c, key, thresh=44)   # 44 — 22면 바닥 그림자 줄이 남았다
        mask = Image.new("L", im.size, 255)
        px, mp = ff.load(), mask.load()
        for yy in range(im.height):
            for xx in range(im.width):
                if px[xx, yy] == key:
                    mp[xx, yy] = 0
        im = im.convert("RGBA")
        im.putalpha(mask.filter(ImageFilter.GaussianBlur(1.2)))
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
    # 「운동복」 — 낯선 사람 시험 15초 · 6초 둘 다 「힘껏이 무엇을 파는지 모른다」(10-26), Fable: 끝 카드만으론 늦어 ⑨ ⑪ 띠에도
    t, fs = "운동복 블랙프라이데이", 66
    while 90 + l.width + 24 + d.textlength(t, font=F("ExtraBold", fs)) > 1000:
        fs -= 2
    d.text((90 + l.width + 24, 132 + (66 - fs) // 2), t, font=F("ExtraBold", fs), fill=(255, 255, 255))
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


def card13(clock="00:59:46", out="G13위.png"):
    im = Image.new("RGBA", (W, 830), NAVY + (255,))
    d = ImageDraw.Draw(im)
    l = logo(150)
    im.alpha_composite(l, ((W - l.width) // 2, 70))
    d.text((W // 2, 300), "운동복 블랙프라이데이", font=F("ExtraBold", 72), fill=(255, 255, 255), anchor="mm")
    d.text((W // 2, 410), "오늘 자정까지 전 품목 70%", font=F("Heavy", 68), fill=DAHONG, anchor="mm")
    d.rounded_rectangle([300, 480, 780, 600], radius=24, outline=DAHONG, width=6)
    d.text((W // 2, 540), clock, font=F("Heavy", 84), fill=(255, 255, 255), anchor="mm")
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
    im.save(os.path.join(OUT, out))


def board01():
    # 1번 전광판 — 굽은 판의 벽 화면(이미지콘티_합성.py BOX01 480×138)에 맞춘 투명 판 위 다홍 빛 숫자.
    # 두 줄(한 줄이면 「자정까지」와 숫자가 붙어 보였다), 바탕은 투명(어두운 상자가 화면 톤과 달라 「화면 속 상자」로 보였다 — Fable 10-26 P2 5)
    im = Image.new("RGBA", (480, 138), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((240, 26), "자정까지", font=F("ExtraBold", 42), fill=(255, 160, 120, 255), anchor="mm")   # 42 — 폰 390px에서 15px 남짓
    d.text((240, 94), "00:59:59", font=F("Heavy", 80), fill=(255, 110, 60, 255), anchor="mm")
    g = im.filter(ImageFilter.GaussianBlur(7))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.alpha_composite(g); out.alpha_composite(im)
    out.save(os.path.join(OUT, "G01전광판.png"))


def sign06():
    # ⑥ 벽 간판의 마지막 모습(넘김판 글자가 4.24초에 「힘껏」으로 맞춰진 뒤) — 굽은 빈 간판 판 위에 얹는다
    Image.open(os.path.join(B, "참조", "힘껏_로고_간판.png")).convert("RGBA").save(os.path.join(OUT, "G06간판.png"))


def cards08():
    # ⑧ 터널 벽에 떠서 지나가는 「힘껏」 제품 카드 둘(사진만, 글자 없음) — 기운 크림 카드에 다홍 테두리, 투명 판 1080×1920.
    # 원본처럼 터널 벽 속 · 중간 높이 · 반투명, 사람 뒤(합성에서 사람을 다시 얹는다 — Fable 10-26 P1 1). 10-27 원본 크기 판에서 얼굴 옆을 비켜 레깅스는 왼쪽 중간 · 바람막이는 오른쪽 아래 가장자리
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for (name, x, y, s, rot) in (("레깅스", 60, 760, 230, 9), ("바람막이", 850, 1100, 200, -7)):
        c = Image.new("RGBA", (s + 40, int(s * 1.15) + 40), (0, 0, 0, 0))
        ImageDraw.Draw(c).rounded_rectangle([20, 20, s + 20, int(s * 1.15) + 20], radius=22, fill=CREAM + (240,), outline=DAHONG + (255,), width=7)
        pr = product(name, (0, 0, s - 30, int(s * 1.15) - 30))
        c.alpha_composite(pr, (35, 35))
        c = c.rotate(rot, expand=True, resample=Image.BICUBIC)
        c.putalpha(c.getchannel("A").point(lambda v: int(v * 0.82)))
        im.alpha_composite(c.filter(ImageFilter.GaussianBlur(10)), (x, y))
        im.alpha_composite(c, (x, y))
    im.save(os.path.join(OUT, "G08카드.png"))


sign06()
cards08()
card02()
# 칸 배정(Fable 샷표 P2 12 · P3 22): ⑨ 위 · 가운데에 가장 보여 줄 레깅스 · 바람막이(내레이션 「바람막이도」와 같은 때), 아래 브라탑.
# ⑪ 8.60 하드 컷에 후디 · 조거 · 캡 → 10.2 묶음 회전에서 가운데 · 아래만 집업 재킷 · 반바지로. 시계는 ① 0.5초에 59 → 58로 시작해 1초마다(⑨ 6.16 = 53, ⑪ 8.60 = 50, 10.5 = 48).
grid(["레깅스", "바람막이", "브라탑"], "00:59:53", "G09.png", extra=False)
grid(["후디", "조거 팬츠", "러닝 캡"], "00:59:50", "G11a.png")
grid(["후디", "집업 재킷", "반바지"], "00:59:48", "G11b.png")
card13()
# 6초 판(02 3절) — 같은 판을 쓰면 6초 안에 시계가 13초 흘렀다(Fable 10-26 P2 7). ① 59(0–0.9) → ⑨ 57(2.2) → ⑬ 55(4.6)
grid(["레깅스", "바람막이", "브라탑"], "00:59:57", "G09_6.png", extra=False)
card13("00:59:55", "G13위_6.png")
board01()
print("ok", OUT)
