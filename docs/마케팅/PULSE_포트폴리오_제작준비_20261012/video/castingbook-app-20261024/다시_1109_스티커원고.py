# 8번 11번 컷 스티커 인쇄 원고(2026-11-09, Claude) — Gemini Flash 「냉장고 유리 안에 얼굴만 둥둥」 · v3 Fable 「냉장고 안 액자」를 푼다.
# 얼굴만 있던 스티커를 「하린이 딸기 라떼를 든 신메뉴 광고」로 — 19 · 20번 벽 포스터와 같은 사진(캐스팅북 F02 context)이라 끝에서 되불리고,
# 바로 다음 12번 「딸기 라떼 신메뉴」와 그림으로 이어진다. 글자는 화면에 얹지 않고 이 원고를 참고로 장면과 한 장으로 굽는다(슬롭 점검표 46, 만족 사례 S43).
#   python -X utf8 다시_1109_스티커원고.py   → git 밖 콘티/p8/다시_1109/스티커_<판>.png
import os

from PIL import Image, ImageDraw, ImageFont

F02 = "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/img/F02/context.webp"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8/다시_1109"
BLACK = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/fonts/BlackHanSans-Regular.ttf"
SUIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/SHIFT_과정1편_20260921/runtime-public/폰트/SUIT-Heavy.otf"
W, H = 1200, 1560
EDGE = 30      # 칼선 안 흰 테두리
RADIUS = 72


def rounded(w, h, r):
    m = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), r * 4, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def make(name, font, band, ink, tag_bg, tag_ink):
    art = Image.new("RGB", (W, H), "white")
    iw, ih = W - EDGE * 2, H - EDGE * 2
    band_h = 372
    ph = ih - band_h
    src = Image.open(F02).convert("RGB")
    sw, sh = src.size
    ch = round(sw * ph / iw)
    y0 = 136       # 머리 위부터 잔 밑까지(1600 기준 266 · 1342)
    photo = src.crop((0, y0, sw, y0 + ch)).resize((iw, ph), Image.LANCZOS)
    inner = Image.new("RGB", (iw, ih), band)
    inner.paste(photo, (0, 0))
    d = ImageDraw.Draw(inner)
    size = 300
    while True:
        f = ImageFont.truetype(font, size)
        box = d.textbbox((0, 0), "딸기 라떼", font=f)
        if box[2] - box[0] <= iw - 130:
            break
        size -= 2
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(((iw - tw) / 2 - box[0], ph + (band_h - th) / 2 - box[1] - 6), "딸기 라떼", font=f, fill=ink)
    # NEW — 사진 왼쪽 위 둥근 표
    sf = ImageFont.truetype(SUIT, 62)
    t = "NEW"
    b = d.textbbox((0, 0), t, font=sf)
    pw, ph2 = b[2] - b[0] + 62, b[3] - b[1] + 42
    d.rounded_rectangle((46, 46, 46 + pw, 46 + ph2), ph2 // 2, fill=tag_bg)
    d.text((46 + 31 - b[0], 46 + 21 - b[1]), t, font=sf, fill=tag_ink)
    art.paste(inner, (EDGE, EDGE), rounded(iw, ih, RADIUS - 14))
    # 칼선 밖은 투명 — 굽기 참고는 회색 판 위에 놓아 모양이 보이게
    out = Image.new("RGB", (W + 160, H + 160), (150, 150, 150))
    out.paste(art, (80, 80), rounded(W, H, RADIUS))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"스티커_{name}.png")
    out.save(p)
    print(p, out.size, "글자 크기", size)


make("딸기띠_수트", SUIT, (226, 62, 113), (255, 255, 255), (255, 255, 255), (226, 62, 113))
make("딸기띠_검한", BLACK, (226, 62, 113), (255, 255, 255), (255, 255, 255), (226, 62, 113))
make("크림띠_검한", BLACK, (255, 247, 240), (219, 48, 100), (226, 62, 113), (255, 255, 255))
