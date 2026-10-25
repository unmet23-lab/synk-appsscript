# 시즌 1 · 가상 편의점 「늘켬」(가칭) 글자 로고 시안 — 간판 · 봉투 · 케이크 띠지 · 끝 화면에 쓸 우리 원고(2026-10-26)
# 로고 · 글자는 AI로 그리지 않는다(AI 광고영상 제작 규칙). 장면 속 간판은 이 원고를 참고로 넣어 정지컷에 굽고, 끝 화면은 후반에 얹는다.
#   python 로고_늘켬.py  →  <밖>/라벨/늘켬_로고시안.jpg · 늘켬_A.png …   (<밖> = Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors)
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "xmas-neighbors", "라벨")
SUIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/"
F = lambda w, s: ImageFont.truetype(SUIT + f"SUIT-{w}.otf", s)
NAVY = (22, 34, 64)
AMBER = (246, 176, 62)
CREAM = (250, 244, 230)
RED = (206, 44, 52)


def bulb(d, cx, cy, r, col):
    """「늘 켜 둔 불」 표: 둥근 전구 빛(동그라미 + 짧은 빛살 다섯)."""
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)
    for k, ang in enumerate((-90, -45, -135, 0, 180)):
        import math
        a = math.radians(ang)
        x0, y0 = cx + math.cos(a) * r * 1.45, cy + math.sin(a) * r * 1.45
        x1, y1 = cx + math.cos(a) * r * 2.0, cy + math.sin(a) * r * 2.0
        d.line((x0, y0, x1, y1), fill=col, width=max(3, r // 4))


def mark(variant, w=1200, h=520):
    im = Image.new("RGB", (w, h), {"C": CREAM, "D": AMBER}.get(variant, NAVY))
    d = ImageDraw.Draw(im)
    if variant == "A":  # 남색 바탕 · 크림 글자 · 「ㅕ」 자리 위에 호박빛 불
        f = F("Heavy", 300)
        d.text((w / 2, h / 2 + 20), "늘켬", font=f, fill=CREAM, anchor="mm")
        bulb(d, int(w * 0.66), int(h * 0.16), 26, AMBER)
    elif variant == "B":  # 남색 바탕 · 호박빛 글자 · 아래 「24시 · 동네 편의점」
        f = F("Heavy", 270)
        d.text((w / 2, h / 2 - 20), "늘켬", font=f, fill=AMBER, anchor="mm")
        d.text((w / 2, h * 0.86), "24시 동네 편의점", font=F("SemiBold", 54), fill=CREAM, anchor="mm")
    elif variant == "D":  # D 호박빛 바탕 · 흰 글자 — 큰 편의점 색(보라 · 초록 · 파랑 · 주황)을 피함(Fable 1차), 「늘 켜 둔 불」이 간판 바탕색
        f = F("Heavy", 300)
        d.text((w / 2, h / 2 + 10), "늘켬", font=f, fill=(255, 252, 244), anchor="mm")
        d.text((w / 2, h * 0.88), "24시 동네 편의점", font=F("SemiBold", 48), fill=NAVY, anchor="mm")
    else:  # C 크림 바탕(봉투 · 띠지) · 남색 글자 · 빨간 1+1 동그라미
        f = F("Heavy", 280)
        d.text((w * 0.40, h / 2 + 10), "늘켬", font=f, fill=NAVY, anchor="mm")
        cx, cy, r = int(w * 0.80), int(h * 0.50), 150
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=RED)
        d.text((cx, cy - 6), "1+1", font=F("Heavy", 120), fill=CREAM, anchor="mm")
    return im


def sign_glow(im):
    """밤 간판처럼 보기: 글자 빛 번짐을 살짝(보기용 — 실제 간판은 정지컷 굽기에서 빛을 정한다)."""
    g = im.filter(ImageFilter.GaussianBlur(18))
    return Image.blend(im, g, 0.25)


def main():
    os.makedirs(밖, exist_ok=True)
    tiles = []
    for v in "ABCD":
        m = mark(v)
        m.save(os.path.join(밖, f"늘켬_{v}.png"))
        tiles.append(sign_glow(m) if v in "AB" else m)
    W = 1200 * 4 + 100
    board = Image.new("RGB", (W, 520 + 200), (18, 20, 28))
    d = ImageDraw.Draw(board)
    for i, (t, cap) in enumerate(zip(tiles, ["A 간판 · 끝 화면(남색 · 크림 글자 · 호박빛 불)", "B 간판(호박빛 글자 · 24시 동네 편의점)",
                                            "C 봉투 · 케이크 상자 스티커(크림 · 1+1)", "D 간판 추천(호박빛 바탕 · 흰 글자)"])):
        x = 20 + i * (1200 + 20)
        board.paste(t, (x, 20))
        d.text((x, 560), cap, font=F("SemiBold", 40), fill=(236, 232, 222))
    d.text((20, 630), "가칭 「늘켬」 · 늘 켜 둔 불 · 편의점 35류 · 배달 39류 · 모든 류에 같은 이름 없음(KIPRIS 10-26) · 서체 SUIT", font=F("Regular", 34),
           fill=(168, 166, 158))
    out = os.path.join(밖, "늘켬_로고시안.jpg")
    board.save(out, quality=90)
    print(out)


if __name__ == "__main__":
    main()
