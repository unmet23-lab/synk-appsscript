# 12번 가상 여행 코스 앱 「모두의코스」 화면 · 끝 글 시안(2026-10-26) — 16b 컷의 두 폰 화면(초록 대역 자리)과 17 끝 글.
# 앱 화면은 AI로 그리지 않고 여기서 그린다(AI 광고영상 제작 규칙 — 앱 화면은 실제 디자인 이미지). 글꼴은 SUIT(브랜드 폰트 폴더).
#   python -X utf8 앱화면.py  →  git 밖 콘티/p12/합성/앱화면.png(1080×2340) · 앱아이콘.png(512) · 끝글.png(1080×1920)
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p12/합성")
FONT = r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT"
BG, INK, SUB, LINE, MINT, MINT_D, WHITE = (248, 247, 243), (26, 28, 30), (120, 124, 128), (226, 224, 218), (32, 178, 150), (18, 132, 110), (255, 255, 255)

# 지나온 열다섯 곳(02_콘티 3절 순서) — 첫 판(목록)에서 쓴 것, 지금 화면은 지도 · 배지라 글로는 안 쓴다
PLACES = [("1일차", ["김포에서 제주로", "공항 렌터카 셔틀", "바다 전망 호텔 수영장", "요트 투어", "해변 카페 데이베드"]),
          ("2일차", ["억새 오름", "ATV 체험", "비양도 보이는 해변", "성산일출봉", "해녀의 집"]),
          ("3일차", ["우도 해안 자전거", "감귤밭 체험", "야시장", "바다 카페 노을", "흑돼지 숯불 저녁"])]


def f(w, s):
    return ImageFont.truetype(os.path.join(FONT, f"SUIT-{w}.otf"), s)


def icon(sz):
    im = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, sz - 1, sz - 1], radius=int(sz * 0.23), fill=MINT)
    # 세 점을 잇는 길 — 「모두가 지난 코스」
    pts = [(0.24, 0.70), (0.42, 0.40), (0.60, 0.62), (0.78, 0.30)]
    P = [(int(x * sz), int(y * sz)) for x, y in pts]
    d.line(P, fill=WHITE, width=max(3, int(sz * 0.06)), joint="curve")
    for i, (x, y) in enumerate(P):
        r = int(sz * (0.075 if i in (0, 3) else 0.05))
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    return im


def app_screen():
    """폰을 가슴 높이로 든 세로 화면에서 폭 10~15%로 보여도 두 화면이 「똑같다」로 읽히게 — 목록 글자 대신 큰 색 덩어리 · 지도 · 배지(Fable 1차 P1-6 ①)."""
    import math
    W, H = 1080, 2340
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((60, 60), "19:42", font=f("SemiBold", 40), fill=INK)
    im.paste(icon(120), (60, 150), icon(120))
    d.text((200, 168), "모두의코스", font=f("ExtraBold", 66), fill=INK)
    # 큰 민트 판 — 제주 섬과 코스
    top, bot = 330, 1500
    d.rounded_rectangle([40, top, W - 40, bot], radius=56, fill=MINT)
    cx, cy, rx, ry = W // 2, (top + bot) // 2 + 30, 430, 240
    isl = []
    for k in range(72):
        a = 2 * math.pi * k / 72
        wob = 1 + 0.05 * math.sin(3 * a) + 0.03 * math.cos(5 * a)
        x, y = rx * math.cos(a) * wob, ry * math.sin(a) * wob
        t = math.radians(-12)
        isl.append((cx + x * math.cos(t) - y * math.sin(t), cy + x * math.sin(t) + y * math.cos(t)))
    d.polygon(isl, fill=(238, 250, 246))
    d.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill=(200, 236, 226))   # 한라산 자리
    # 열다섯 핀을 섬 둘레 안쪽으로 잇는 코스 선
    pins = []
    for k in range(15):
        a = math.radians(200 - k * 24)
        x, y = 0.72 * rx * math.cos(a), 0.66 * ry * math.sin(a)
        t = math.radians(-12)
        pins.append((cx + x * math.cos(t) - y * math.sin(t), cy + x * math.sin(t) + y * math.cos(t)))
    d.line(pins, fill=MINT_D, width=14, joint="curve")
    for i, (x, y) in enumerate(pins):
        r = 30 if i in (0, 14) else 20
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE, outline=MINT_D, width=8)
    d.text((80, top + 40), "제주 2박 3일", font=f("ExtraBold", 60), fill=WHITE)
    # 큰 배지
    d.rounded_rectangle([60, 1570, W - 60, 1830], radius=60, fill=INK)
    d.text((W // 2, 1700), "인기 1위 코스", font=f("Heavy", 110), fill=WHITE, anchor="mm")
    d.text((W // 2, 1930), "12,480명이 이 코스로", font=f("ExtraBold", 58), fill=MINT_D, anchor="mm")
    d.rounded_rectangle([60, H - 250, W - 60, H - 90], radius=80, fill=MINT)
    d.text((W // 2, H - 170), "15곳 · 지금 여기", font=f("ExtraBold", 60), fill=WHITE, anchor="mm")
    return im


def end_card():
    W, H = 1080, 1920
    im = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((W // 2, 780), "모두가 고른 제주 코스 그대로", font=f("ExtraBold", 58), fill=WHITE, anchor="mm")
    ic = icon(150)
    im.paste(ic, (W // 2 - 75 - 190, 900), ic)
    d.text((W // 2 - 90, 975), "모두의코스", font=f("ExtraBold", 84), fill=WHITE, anchor="lm")
    return im


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    app_screen().save(OUT / "앱화면.png")
    icon(512).save(OUT / "앱아이콘.png")
    end_card().save(OUT / "끝글.png")
    print(OUT)
