# 가상 투명 우산 「비침」 로고타입(2026-11-07, Claude) — 글꼴로 치지 않고 획을 그린다(메모 end-logo-draw-not-type · 슬롭 점검표 22 · 24번).
#   python -X utf8 비침_로고.py   → git 밖 최종/rs/_로고/비침_시안.png(어두운 · 밝은 바탕 시안) — 최종편집.py publish가 renders()를 Remotion public에 넣는다
# 둘째 판(첫 편집본 맹검 뒤): 첫 판(가는 둥근 한 굵기 4.2 · 「비」의 ㅣ 아래 젖빛 마개 점)은 Fable이 「ㅣ + 점 = 비!」, Gemini가 「기본 폰트에 그림자만 넣은
#   꼴 · 촌스러움」으로 읽었다. 점을 빼고 획을 8.6으로 굵혔고, 끝은 둥글리지 않고 반듯이 잘랐다(제품의 곧은 투명 손잡이 · 잘린 마개 결).
#   표식은 하나만 — 「ㅊ」의 ㅅ 두 다리를 바깥으로 살짝 부풀려 펼친 우산 덮개의 곡선처럼 그렸다(글자가 먼저 읽히는 만큼만). 그림자 · 빛 번짐 같은 효과는 없다.
import os

import numpy as np
from PIL import Image, ImageDraw

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/rs/_로고"

# 단위: 글자 높이 100. ("l", x0, y0, x1, y1, 앞 늘림, 뒤 늘림) 반듯한 끝 선분 — 늘림은 획 굵기의 반만큼 이어 모서리를 메우는지(0 · 1)
#   ("q", x0, y0, cx, cy, x1, y1) 2차 곡선(반듯한 끝) · ("rect", x0, y0, x1, y1) 모서리 각진 네모 테
ST = 8.6
GLYPHS = [
    # 비 — ㅂ(6–46) + ㅣ(72)
    ("l", 6, 12, 6, 88, 0, 1), ("l", 46, 12, 46, 88, 0, 1),
    ("l", 6, 49, 46, 49, 0, 0), ("l", 6, 88, 46, 88, 1, 1),
    ("l", 72, 2, 72, 98, 0, 0),
    # 침 — ㅊ(꼭지 · 가로 · 덮개처럼 부푼 ㅅ) + ㅣ + ㅁ 받침
    ("l", 121, -1, 121, 9, 0, 0),
    ("l", 100, 16, 142, 16, 0, 0),
    ("q", 121, 16, 103, 26, 98, 52),
    ("q", 121, 16, 139, 26, 144, 52),
    ("l", 163, 0, 163, 60, 0, 0),
    ("rect", 104, 70, 163, 98),
]
SPAN = (-2, -6, 170, 104)   # 그림 둘레(획 굵기 포함)


def _quad(p0, c, p1, n=48):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * np.array(p0) + 2 * (1 - t) * t * np.array(c) + t ** 2 * np.array(p1)


def _strip(pts, st):
    """점 줄을 굵기 st의 띠 다각형으로(반듯한 끝)."""
    pts = np.asarray(pts, np.float64)
    tang = np.gradient(pts, axis=0)
    tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
    nrm = np.stack([-tang[:, 1], tang[:, 0]], 1) * (st / 2)
    left, right = pts + nrm, pts - nrm
    return [tuple(p) for p in np.vstack([left, right[::-1]])]


def mask(width_px, scale=6):
    x0, y0, x1, y1 = SPAN
    k = width_px * scale / (x1 - x0)
    Wd, Hd = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
    im = Image.new("L", (Wd, Hd), 0)
    d = ImageDraw.Draw(im)
    st = ST * k
    P = lambda x, y: ((x - x0) * k, (y - y0) * k)
    for g in GLYPHS:
        if g[0] == "l":
            a = np.array(P(g[1], g[2]))
            b = np.array(P(g[3], g[4]))
            u = (b - a) / (np.linalg.norm(b - a) + 1e-9)
            a = a - u * st / 2 * g[5]
            b = b + u * st / 2 * g[6]
            d.polygon(_strip([a, b], st), fill=255)
        elif g[0] == "q":
            pts = _quad(P(g[1], g[2]), P(g[3], g[4]), P(g[5], g[6]))
            d.polygon(_strip(pts, st), fill=255)
        elif g[0] == "rect":
            a, b = P(g[1], g[2])
            c, e = P(g[3], g[4])
            d.rectangle([a - st / 2, b - st / 2, c + st / 2, e + st / 2], fill=255)
            d.rectangle([a + st / 2, b + st / 2, c - st / 2, e - st / 2], fill=0)
    return im.resize((max(1, Wd // scale), max(1, Hd // scale)), Image.LANCZOS)


def draw(width_px, color=(255, 255, 255), alpha=255):
    a = np.asarray(mask(width_px), np.float32) / 255.0 * (alpha / 255.0)
    rgba = np.zeros((a.shape[0], a.shape[1], 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = color
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return rgba


INK = (34, 44, 54)   # 끝 카드 — 비 갠 낮 장면 위의 짙은 먹청(원본 끝 카드도 밝은 장면 위 짙은 글)


def renders():
    return {
        "logo_title": draw(300),             # C06 제목 카드(밤 · 어두운 바탕)
        "logo_bug": draw(84),                # 현재 장면 오른쪽 위
        "logo_end": draw(300, color=INK),    # 끝 카드(밝은 낮)
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    big = draw(520)
    ink = draw(520, color=INK)
    small = draw(84)
    h, w = big.shape[:2]
    sheet = Image.new("RGB", (w * 2 + 120, h * 2 + 140), (12, 14, 18))
    for i, (bg, im) in enumerate((((12, 14, 18), big), ((228, 232, 226), ink))):
        tile = Image.new("RGB", (w + 40, h + 40), bg)
        tile.paste(Image.fromarray(im), (20, 20), Image.fromarray(im))
        sheet.paste(tile, (20 + i * (w + 80), 20))
    tile = Image.new("RGB", (w + 40, h + 40), (120, 140, 150))
    tile.paste(Image.fromarray(small), (20, 20), Image.fromarray(small))
    sheet.paste(tile, (20, h + 100))
    sheet.save(os.path.join(OUT, "비침_시안.png"))
    print(os.path.join(OUT, "비침_시안.png"), big.shape)


if __name__ == "__main__":
    main()
