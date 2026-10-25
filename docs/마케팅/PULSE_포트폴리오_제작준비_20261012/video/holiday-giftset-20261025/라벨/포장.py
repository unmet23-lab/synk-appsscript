# 시즌 2 · 홀리데이 기프트 세트 — 포장 · 라벨 원고(우리 디자인 파일, 2026-10-26)
# 제품 · 로고 · 글자는 AI로 그리지 않는다(AI 광고영상 제작 규칙). 블렌더 장면(../블렌더/선물상자.py)이 이 그림들을 재질로 쓴다.
#   python 포장.py  →  <밖>/라벨/*.png   (<밖> = Documents/synk-vendor/pulse-season4-20261025/콘티/holiday-giftset)
# 가칭: 브랜드 「유리결」(YURIGYEOL) · 홀리데이 에디션 「서리꽃」(SEORIKKOT) — 03류 상표 확인은 ../01_제품.md 1절.
import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset", "라벨")
SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"


def font(size, weight="Regular"):
    f = ImageFont.truetype(SERIF, size)
    for name in (weight, weight.encode()):  # PIL 판에 따라 이름 목록이 bytes다
        try:
            f.set_variation_by_name(name)
            break
        except Exception:
            continue
    return f


def frost_flowers(size=2048, seeds=16, seed=11, edge_bias=0.85, avoid=None):
    """서리꽃(유리창에 피는 성에 무늬): 곧은 줄기 양쪽으로 60° 깃털 가지가 고르게 나고 끝으로 갈수록 짧아지는
    고사리 꼴. 흰 획 = 볼록(범프). avoid=(cx, cy, r)이면 그 둘레에는 씨앗을 두지 않는다(이름 자리)."""
    rnd = random.Random(seed)
    S = 2  # 두 배로 그리고 줄여 매끈하게
    im = Image.new("L", (size * S, size * S), 0)
    d = ImageDraw.Draw(im)

    def feather(x, y, ang, length, width, depth):
        steps = max(4, int(length / (14 * S)))
        step = length / steps
        pts = [(x, y)]
        bend = rnd.uniform(-0.012, 0.012)
        for i in range(steps):
            ang += bend
            x += math.cos(ang) * step
            y += math.sin(ang) * step
            pts.append((x, y))
            if depth > 0 and i >= 1 and (depth == 2 or i % 2 == 0):
                frac = 1 - i / steps  # 끝으로 갈수록 짧은 깃
                for side in (1, -1):
                    if rnd.random() < 0.8:
                        feather(x, y, ang + side * math.radians(60 + rnd.uniform(-4, 4)),
                                length * (0.30 if depth == 2 else 0.34) * frac, max(1.0, width * 0.55), depth - 1)
        d.line(pts, fill=255, width=max(1, round(width)), joint="curve")

    placed = 0
    tries = 0
    while placed < seeds and tries < 500:
        tries += 1
        if rnd.random() < edge_bias:  # 가장자리에서 안쪽으로 자라는 것이 많다(창틀에서 피는 성에처럼) — 네 변에 고르게
            side = placed % 4
            t = rnd.uniform(0.05, 0.95) * size * S
            x, y = [(t, 0), (size * S, t), (t, size * S), (0, t)][side]
            ang = [math.pi / 2, math.pi, -math.pi / 2, 0][side] + rnd.uniform(-0.6, 0.6)
        else:
            x, y = rnd.uniform(0, size * S), rnd.uniform(0, size * S)
            ang = rnd.uniform(0, 2 * math.pi)
        length = rnd.uniform(0.20, 0.34) * size * S
        if avoid:
            cx, cy, r = (v * S for v in avoid)
            tip = (x + math.cos(ang) * length, y + math.sin(ang) * length)
            if any(math.hypot(px - cx, py - cy) < r for px, py in ((x, y), tip,
                                                                    ((x + tip[0]) / 2, (y + tip[1]) / 2))):
                continue
        feather(x, y, ang, length, rnd.uniform(2.6, 3.4) * S, 2)
        placed += 1
    im = im.resize((size, size), Image.LANCZOS)
    return im


def centered(d, xy, text, f, fill=255, spacing=0):
    if spacing:
        widths = [d.textlength(ch, font=f) for ch in text]
        total = sum(widths) + spacing * (len(text) - 1)
        x = xy[0] - total / 2
        for ch, w in zip(text, widths):
            d.text((x, xy[1]), ch, font=f, fill=fill, anchor="lm")
            x += w + spacing
    else:
        d.text(xy, text, font=f, fill=fill, anchor="mm")


def lid_top(size=2048):
    """뚜껑 윗면: 범프(서리꽃 엠보) + 금박 마스크(이름은 리본이 안 덮는 오른쪽 아래 사분면)."""
    cx, cy = int(size * 0.775), int(size * 0.765)  # 앞 리본 띠(가운데 ±1.8 cm)를 비켜 오른쪽 앞 사분면
    bump = frost_flowers(size, avoid=(cx, cy + 40, size * 0.19))
    gold = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(gold)
    centered(d, (cx, cy - 60), "유리결", font(230, "SemiBold"))
    centered(d, (cx, cy + 120), "YURIGYEOL", font(64, "Regular"), spacing=26)
    centered(d, (cx, cy + 210), "SEORIKKOT  HOLIDAY  EDITION", font(38, "Regular"), spacing=7)
    # 금박 둘레는 엠보를 부드럽게 지운다(둥근 빈자리 — 네모 자국이 나지 않게)
    clear = Image.new("L", (size, size), 0)
    ImageDraw.Draw(clear).ellipse((cx - size * 0.20, cy - size * 0.15, cx + size * 0.20, cy + size * 0.18), fill=255)
    clear = clear.filter(ImageFilter.GaussianBlur(40))
    bump = ImageChops.subtract(bump, clear)
    return bump, gold


def lid_side(w=4096, h=512):
    """뚜껑 옆띠: 가운데에 작은 금박 글자 한 줄(리본이 가운데를 덮으니 양쪽 끝 가까이 둘)."""
    gold = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(gold)
    for x in (w * 0.25, w * 0.75):
        centered(d, (int(x), h // 2), "YURIGYEOL · 서리꽃", font(70, "Regular"), spacing=10)
    return gold


def lid_front(w=4096, h=896, cx_frac=0.80):
    """2판(Fable 1차 P2-5): 이름은 뚜껑 앞 옆띠에 — 모든 3/4 각도에서 보이고 나비에 안 가린다. 앞 리본 띠(가운데 ±1.8 cm)를
    비켜 오른쪽(가로 0.80 = x +5.5 cm)에 금박 「유리결」 + 작은 영문 한 줄. 위아래 = 옆띠 높이 4 cm."""
    gold = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(gold)
    cx = int(w * cx_frac)
    centered(d, (cx, int(h * 0.40)), "유리결", font(380, "Medium"))  # 3판: 히어로 거리에서 간신히 읽혀 15 % 키움
    centered(d, (cx, int(h * 0.82)), "YURIGYEOL  ·  SEORIKKOT", font(80, "Regular"), spacing=12)
    return gold


def ampoule_label(w=2048, h=1024):
    """앰플 유리병 인쇄(흰 잉크 + 금): 위 이름, 아래 용량."""
    white = Image.new("L", (w, h), 0)
    gold = Image.new("L", (w, h), 0)
    dw, dg = ImageDraw.Draw(white), ImageDraw.Draw(gold)
    centered(dg, (w // 2, int(h * 0.30)), "유리결", font(170, "SemiBold"))
    centered(dw, (w // 2, int(h * 0.56)), "GLASS  AMPOULE", font(64, "Regular"), spacing=10)
    centered(dw, (w // 2, int(h * 0.70)), "글래스 앰플 · 서리꽃 에디션", font(52, "Regular"))
    centered(dw, (w // 2, int(h * 0.86)), "30 ml", font(52, "Regular"))
    return white, gold


def jar_lid(size=1024):
    """크림 단지 금 뚜껑 윗면: 3판(Fable 2차 P2-3) — 흩뿌린 서리꽃 엠보가 접사에서 먼지 · 긁힘으로 보여, 가장자리 안쪽
    가는 테 한 줄 + 가운데 이름 음각만."""
    ring = Image.new("L", (size, size), 0)
    r0, lw = size * 0.405, max(3, size // 220)
    ImageDraw.Draw(ring).ellipse((size / 2 - r0, size / 2 - r0, size / 2 + r0, size / 2 + r0), outline=255, width=lw)
    ring = ring.filter(ImageFilter.GaussianBlur(1.2))
    name = Image.new("L", (size, size), 0)
    centered(ImageDraw.Draw(name), (size // 2, size // 2), "유리결", font(120, "SemiBold"))
    return ring, name


def tube_label(w=2048, h=1024):
    """핸드크림 금 튜브 인쇄(흰 잉크)."""
    white = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(white)
    centered(d, (w // 2, int(h * 0.38)), "유리결", font(150, "SemiBold"))
    centered(d, (w // 2, int(h * 0.62)), "HAND  CREAM  ·  서리꽃", font(60, "Regular"), spacing=6)
    return white


def main():
    os.makedirs(밖, exist_ok=True)
    bump, gold = lid_top()
    bump.save(os.path.join(밖, "뚜껑_엠보.png"))
    gold.save(os.path.join(밖, "뚜껑_금박.png"))
    lid_side().save(os.path.join(밖, "옆띠_금박.png"))
    lid_front().save(os.path.join(밖, "뚜껑앞_금박.png"))
    # 2판 윗면은 엠보만(이름 없이) — 이름 자리를 비워 둔 1판 엠보에서 빈자리 없이 다시
    frost_flowers(2048, seeds=18, seed=11, edge_bias=0.85).save(os.path.join(밖, "뚜껑_엠보2.png"))
    w, g = ampoule_label()
    w.save(os.path.join(밖, "앰플_흰잉크.png"))
    g.save(os.path.join(밖, "앰플_금.png"))
    r, n = jar_lid()
    r.save(os.path.join(밖, "단지뚜껑_테.png"))
    n.save(os.path.join(밖, "단지뚜껑_이름.png"))
    tube_label().save(os.path.join(밖, "튜브_흰잉크.png"))
    # 보기용 한 장
    prev = Image.new("RGB", (2048, 2048), (236, 236, 240))
    prev.paste((198, 160, 92), (0, 0), gold)
    prev = Image.blend(prev, Image.merge("RGB", [bump] * 3), 0.25)
    prev.save(os.path.join(밖, "_보기_뚜껑.jpg"), quality=88)
    print("끝", 밖)


if __name__ == "__main__":
    main()
