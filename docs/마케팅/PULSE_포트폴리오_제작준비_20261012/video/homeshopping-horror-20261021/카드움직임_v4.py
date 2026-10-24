# 콘티 v4 광고 카드 넷을 원본 박대로 움직인다(2026-10-24) — 영상 모델에 넣지 않는다(제품을 AI가 다시 그린다 — 현장노트 브라우저_게시).
# 층 셋: 바탕(손 그림에서 손 · 물건을 지워 메운 판) · 손과 물건(카드합성_v4.py의 합성판을 사람 분할 u2net_human_seg + 블렌더 렌더 알파로 오린 층)
# · 글자(04 4절 박표 — 원본 마지막 화면을 10% 격자로 잰 자리). 카드 1은 손이 아래에서 올라오고, 카드 2는 위에서 상자가 내려오고 둘째 손이
# 가리켰다 빠지며, 「?」 카드는 아래에서 도시락이 올라오고, 카드 3은 같은 손이 멈춰 있다. 번호는 한 자씩, 이름은 한 줄씩, 띠는 깜박인다.
#   python -X utf8 카드움직임_v4.py [11 21 27 29]  → synk-vendor/…/영상/v4/카드/C<컷>.mp4(1920×1080 · 24fps · 소리 없음, 원본 컷 프레임 수) · C<컷>_끝.jpg
# 서체: 숫자 · 띠 Black Han Sans, 카드 2 · 3 번호는 원본처럼 세리프(한컴 바탕 굵게), 상품 이름 필기체 자리는 궁서(batang.ttc 3번째),
# 「???」는 Brush Script(원본 분홍 이탤릭 필기체) — 이미지 콘티 Fable 검토의 「글자 서체는 최종에서」(P3-7)를 여기서 고쳤다.
import importlib.util
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rembg import new_session, remove

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("K", os.path.join(HERE, "카드합성_v4.py"))
K = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(K)
V = K.V
W, H, FPS = 1920, 1080, 24
SH = {s["n"]: s for s in json.load(open(os.path.join(V, "원본", "원본_샷.json"), encoding="utf-8"))}
OUT = os.path.join(V, "영상", "v4", "카드")
BHS = K.BHS
SUIT_EB = os.path.join(K.SUIT, "SUIT-ExtraBold.otf")
SUIT_M = os.path.join(K.SUIT, "SUIT-Medium.otf")
SERIF_B = "C:/Windows/Fonts/HANBatangB.ttf"
GUNGSUH = ("C:/Windows/Fonts/batang.ttc", 2)
BRUSH = "C:/Windows/Fonts/BRUSHSCI.TTF"
SES = None


def font(spec, size):
    return ImageFont.truetype(spec[0], size, index=spec[1]) if isinstance(spec, tuple) else ImageFont.truetype(spec, size)


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def ramp(t, t0, t1):
    return 0.0 if t <= t0 else 1.0 if t >= t1 else (t - t0) / (t1 - t0)


# ── 층 만들기 ──────────────────────────────────────────────────────────────
def prop_canvas(plate, prop_p, narrow, tint, bottom_align):
    """카드합성_v4.composite와 같은 자리 셈으로 블렌더 렌더를 앉힌 색 · 알파(전체 화면 크기)"""
    gm = K.green_mask(plate)
    gx, gy, gw, gh = cv2.boundingRect(gm)
    prop = K.load(prop_p)
    bx, by, bw, bh = K.body_box(prop[..., 3], narrow)
    k = max(gw / bw, gh / bh) * 1.06
    pr = cv2.resize(prop, (max(1, int(prop.shape[1] * k)), max(1, int(prop.shape[0] * k))), interpolation=cv2.INTER_AREA)
    ox = int(gx + gw / 2 - (bx + bw / 2) * k)
    oy = int(gy + gh - (by + bh) * k) if bottom_align else int(gy + gh / 2 - (by + bh / 2) * k)
    rgb = np.zeros((H, W, 3), np.float32)
    a = np.zeros((H, W), np.float32)
    x0, y0, x1, y1 = max(ox, 0), max(oy, 0), min(ox + pr.shape[1], W), min(oy + pr.shape[0], H)
    sub = pr[y0 - oy: y1 - oy, x0 - ox: x1 - ox].astype(np.float32)
    rgb[y0:y1, x0:x1] = sub[..., :3] * np.array(tint, np.float32)
    a[y0:y1, x0:x1] = sub[..., 3] / 255.0
    return rgb, a, (gx, gy, gw, gh)


def layers(hand, prop, narrow, tint, bottom_align, split_pointer=False):
    global SES
    if SES is None:
        SES = new_session("u2net_human_seg")
    plate_p = os.path.join(V, "정지컷", "v4", f"{hand}.png")
    plate = cv2.resize(K.load(plate_p, cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_AREA)
    prop_p = os.path.join(K.PROPS, prop)
    comp = K.composite(plate_p, prop_p, narrow=narrow, bottom_align=bottom_align, tint=tint).astype(np.float32)
    prgb, pa, (gx, gy, gw, gh) = prop_canvas(plate, prop_p, narrow, tint, bottom_align)
    ha = np.array(remove(Image.fromarray(cv2.cvtColor(plate, cv2.COLOR_BGR2RGB)), session=SES, only_mask=True)).astype(np.float32) / 255.0
    hand_bin = (ha > 0.5).astype(np.uint8)
    # 사람 분할이 놓친 팔(카드 2 왼쪽에서 상자 옆을 받친 팔): 상자 왼쪽 띠 안의 살빛 덩어리 중 화면 왼쪽 끝이나 상자에 닿는 것
    hsv = cv2.cvtColor(plate, cv2.COLOR_BGR2HSV)
    skin = (((hsv[..., 0] < 25) | (hsv[..., 0] > 165)) & (hsv[..., 1] > 40) & (hsv[..., 2] > 60)).astype(np.uint8)
    band = np.zeros_like(skin)
    band[max(gy - 60, 0): min(gy + gh + 60, H), : max(gx + 30, 0)] = 1
    n, lab, st, _ = cv2.connectedComponentsWithStats(skin & band)
    extra = np.zeros_like(skin)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area > 1500 and (x <= 4 or x + w >= gx - 6):
            extra[lab == i] = 1
    extra = cv2.morphologyEx(extra, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    pointer = np.zeros((H, W), np.float32)
    main_hand = np.maximum(ha, extra.astype(np.float32))
    if split_pointer:   # 아래 가장자리에 닿는 손(가리키는 손)은 따로
        n, lab, st, _ = cv2.connectedComponentsWithStats(hand_bin)
        pm = np.zeros((H, W), np.uint8)
        for i in range(1, n):
            x, y, w, h, area = st[i]
            if y + h >= H - 3 and area > 2000:
                pm[lab == i] = 1
        pm = cv2.dilate(pm, np.ones((5, 5), np.uint8))
        pointer = ha * pm
        main_hand = main_hand * (1 - pm)
    main_a = np.clip(np.maximum(pa, main_hand), 0, 1)
    main_a = cv2.GaussianBlur(main_a, (0, 0), 0.8)
    main_img = comp.copy()
    if split_pointer:   # 가리키는 손가락이 상자 앞에 있던 자리는 상자 렌더로 되돌린다(손이 빠졌을 때 손끝이 남지 않게)
        m = (pointer > 0.05).astype(np.float32)[..., None] * pa[..., None]
        main_img = main_img * (1 - m) + prgb * m
    every = np.clip(np.maximum(main_a, pointer), 0, 1)
    hole = cv2.dilate((every > 0.03).astype(np.uint8) * 255, np.ones((31, 31), np.uint8))
    return soft_fill(comp, hole), (main_img, main_a), (comp, cv2.GaussianBlur(pointer, (0, 0), 0.8)), (gx, gy, gw, gh)


def soft_fill(img, hole):
    """큰 자리를 제 크기에서 메우면 X자 번짐이 남았다(10-24 카드 2) — 1/8로 줄여 메운 뒤 키워 흐리게, 가장자리는 부드럽게 섞고 입자를 얹는다"""
    s = 8
    small = cv2.resize(img.astype(np.uint8), (W // s, H // s), interpolation=cv2.INTER_AREA)
    # 줄인 판에서 가장자리 화소에 물건 빛이 섞여 들어오지 않게 구멍을 넉넉히(2칸 = 원래 16px) 넓힌다
    hs = cv2.dilate(cv2.resize(hole, (W // s, H // s), interpolation=cv2.INTER_NEAREST), np.ones((5, 5), np.uint8))
    fill = cv2.inpaint(small, hs, 6, cv2.INPAINT_TELEA)
    fill = cv2.GaussianBlur(cv2.resize(fill, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32), (0, 0), 9)
    # 섞는 띠는 구멍 바깥쪽에만 — 구멍 안(물건 자리)은 완전히 메운 판(가장자리에 물건 윤곽이 15% 비쳐 유령처럼 남았다, 10-24)
    feather = np.maximum(cv2.GaussianBlur(cv2.dilate(hole, np.ones((41, 41), np.uint8)).astype(np.float32) / 255.0, (0, 0), 14), hole.astype(np.float32) / 255.0)[..., None]
    grain = np.random.default_rng(7).normal(0, 2.5, img.shape).astype(np.float32)
    return img * (1 - feather) + (fill + grain) * feather


def paste(canvas, img, a, dx, dy):
    if a is None or a.max() <= 0:
        return canvas
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    ia = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)[..., None]
    ii = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
    return canvas * (1 - ia) + ii * ia


# ── 글자 조각(투명 RGBA 한 장 + 자리) ──────────────────────────────────────────
def text_piece(t, f, fill, shadow=None, off=6, stroke=0, stroke_fill=(0, 0, 0)):
    d0 = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    l, tp, r, b = d0.textbbox((0, 0), t, font=f, stroke_width=stroke)
    pad = 12 + off
    im = Image.new("RGBA", (r - l + pad * 2, b - tp + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shadow is not None:
        d.text((pad - l + off, pad - tp + off), t, font=f, fill=shadow, stroke_width=stroke, stroke_fill=shadow)
    d.text((pad - l, pad - tp), t, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im, (pad - l, pad - tp)


def gold_fill(mask_img, c0=(252, 226, 140), c1=(196, 150, 52)):
    w, h = mask_img.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    g = np.clip((xx / w * 0.5 + yy / h * 0.5), 0, 1)[..., None]
    rgb = (np.array(c0, np.float32) * (1 - g) + np.array(c1, np.float32) * g).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, np.array(mask_img)]), "RGBA")
    return out


def seal_piece(kind, rx, ry, big, small="+배송비", rot=0, ink=(92, 62, 16)):
    S = 2.2
    w, h = int(rx * S), int(ry * S)
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    cx, cy = w / 2, h / 2
    if kind == "oval":
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    else:
        n, inner = (26, 0.80) if kind == "burst" else (48, 0.92)
        pts = [(cx + rx * (1 if i % 2 == 0 else inner) * np.cos(np.pi * i / n), cy + ry * (1 if i % 2 == 0 else inner) * np.sin(np.pi * i / n)) for i in range(2 * n)]
        d.polygon(pts, fill=255)
    im = gold_fill(m)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - rx * 0.78, cy - ry * 0.78, cx + rx * 0.78, cy + ry * 0.78], outline=(255, 238, 170, 255), width=4)
    f = font(BHS, int(ry * 0.5))
    tw = d.textlength(big, font=f)
    d.text((cx - tw / 2, cy - ry * 0.42), big, font=f, fill=ink)
    f2 = font(SUIT_EB, int(ry * 0.22))
    tw2 = d.textlength(small, font=f2)
    d.text((cx - tw2 / 2, cy + ry * 0.2), small, font=f2, fill=ink)
    return im.rotate(rot, expand=True, resample=Image.BICUBIC)


class Card:
    """글자 조각과 나타날 때(초) — draw(t)가 그 순간의 투명 RGBA 한 장을 돌려준다"""

    def __init__(self):
        self.items = []

    def add(self, im, xy, t0, t1=99.0, pop=0.0, blink=None, anchor="lt"):
        # anchor: lt(왼쪽 위) · ct(가운데 위) · rt(오른쪽 위) · cc(가운데)
        self.items.append(dict(im=im, xy=xy, t0=t0, t1=t1, pop=pop, blink=blink, anchor=anchor))

    def typing(self, text, f, fill, xy, t0, t1, anchor="ct", **kw):
        n = len(text)
        pieces = [text_piece(text[:k], f, fill, **kw)[0] for k in range(1, n + 1)]
        full_w = pieces[-1].size[0]
        for k, im in enumerate(pieces):
            a = t0 + (t1 - t0) * k / n
            b = t0 + (t1 - t0) * (k + 1) / n if k < n - 1 else 99.0
            # 한 자씩 늘어도 왼쪽 끝은 그대로(가운데 맞춤이면 다 쓴 폭 기준)
            x = xy[0] - full_w / 2 if anchor == "ct" else xy[0]
            self.items.append(dict(im=im, xy=(x, xy[1]), t0=a, t1=b, pop=0.0, blink=None, anchor="lt"))

    def draw(self, t):
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for it in self.items:
            if not (it["t0"] <= t < it["t1"]):
                continue
            if it["blink"]:
                start, on, off, until = it["blink"]
                if t >= until or ((t - start) % (on + off)) >= on:
                    continue
            im = it["im"]
            s = 1.0
            if it["pop"]:
                p = ramp(t, it["t0"], it["t0"] + abs(it["pop"]))
                s = (1.35 - 0.35 * ease_out(p)) if it["pop"] < 0 else (0.82 + 0.18 * ease_out(p))   # 음수 = 도장처럼 크게에서 쾅
            if s != 1.0:
                im = im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))), Image.BICUBIC)
            w, h = im.size
            x, y = it["xy"]
            if it["anchor"] == "ct":
                x -= w / 2
            elif it["anchor"] == "rt":
                x -= w
            elif it["anchor"] == "cc":
                x -= w / 2
                y -= h / 2
            ov.alpha_composite(im, (int(x), int(y)))
        return ov


def script_lines(card, lines, size, fill, right_x, y0, times, gap=1.18, shadow=(40, 22, 10, 200)):
    f = font(GUNGSUH, size)
    for (txt, t) , i in zip(zip(lines, times), range(len(lines))):
        im, _ = text_piece(txt, f, fill, shadow=shadow, off=3)
        card.add(im, (right_x, y0 + i * size * gap), t, anchor="rt", pop=0.12)


def card1():
    c = Card()
    num = font(BHS, 200)
    c.typing("1577-꽉꽉", num, (255, 255, 255), (970, 800), 0.26, 0.62, shadow=(20, 12, 8, 255), off=9)
    script_lines(c, ["금장", "꽉 KKWAK", "미니"], 100, (238, 214, 160), 1770, 445, [0.45, 1.76, 2.45])
    c.add(seal_piece("oval", 210, 140, "99,000원", rot=16), (1555, 205), 1.76, anchor="cc", pop=0.12)
    band = Image.new("RGBA", (600, 132), (160, 22, 42, 255))
    bim, _ = text_piece("한정판", font(BHS, 96), (255, 255, 255))
    band.alpha_composite(bim, ((600 - bim.size[0]) // 2, (132 - bim.size[1]) // 2))
    c.add(band, (24, 52), 1.56, blink=(1.56, 0.333, 0.333, 4.21))
    c.typing("*홈쇼핑 단독 구성*", font(SUIT_EB, 46), (255, 255, 255), (250, 236), 2.96, 4.15, anchor="lt", shadow=(0, 0, 0, 200), off=3)
    return c


def card2():
    c = Card()
    # 「지금 주문!!!」 거품(내내 깜박)
    bw, bh = 760, 230
    m = Image.new("L", (bw, bh), 0)
    d = ImageDraw.Draw(m)
    n = 22
    pts = [(bw / 2 + (bw / 2 - 6) * (1 if i % 2 == 0 else 0.86) * np.cos(np.pi * i / n), bh / 2 + (bh / 2 - 6) * (1 if i % 2 == 0 else 0.7) * np.sin(np.pi * i / n)) for i in range(2 * n)]
    d.polygon(pts, fill=255)
    bub = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    col = Image.new("RGBA", (bw, bh), (178, 202, 246, 255))
    bub.paste(col, (0, 0), m)
    ImageDraw.Draw(bub).polygon(pts, outline=(40, 50, 100, 255), width=5)
    tim, _ = text_piece("지금 주문!!!", font(BHS, 104), (250, 232, 110), stroke=5, stroke_fill=(40, 50, 100))
    bub.alpha_composite(tim, ((bw - tim.size[0]) // 2, (bh - tim.size[1]) // 2))
    c.add(bub, (1535, 875), 0.0, anchor="cc", blink=(0.0, 0.27, 0.13, 99))
    # 「단독」 원 딱지
    st = Image.new("RGBA", (290, 290), (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    sd.ellipse([0, 0, 289, 289], fill=(200, 26, 62, 255), outline=(255, 255, 255, 255), width=4)
    for i, s in enumerate(["뚜껑 색 다른 버전", "+ 라벨 스티커"]):
        f = font(SUIT_EB, 24)
        sd.text(((290 - sd.textlength(s, font=f)) / 2, 70 + i * 30), s, font=f, fill=(255, 255, 255))
    f = font(BHS, 92)
    sd.text(((290 - sd.textlength("단독", font=f)) / 2, 138), "단독", font=f, fill=(255, 255, 255))
    c.add(st, (190, 880), 0.35, anchor="cc", pop=0.12)
    c.typing("1577-꽉꽉", font(SERIF_B, 124), (255, 255, 255), (330, 918), 0.35, 0.62, anchor="lt", shadow=(10, 6, 6, 255), off=6)
    pink = (236, 66, 146)
    c.typing("핑크 에디션!", font(BHS, 76), pink, (1060, 56), 0.45, 0.85, anchor="lt")
    im, _ = text_piece("홈쇼핑 단독", font(BHS, 44), pink)
    c.add(im, (1064, 142), 1.25)
    c.add(seal_piece("burst", 196, 150, "999,000원", rot=-14), (1735, 200), 1.25, anchor="cc", pop=0.12)
    for i, (s, t) in enumerate(zip(["진공", "4중 잠금", "6종", "세트", "뚜껑 색 다른 버전"], [1.65, 2.07, 2.49, 2.91, 3.33])):
        im, _ = text_piece(s, font(BHS, 84), (226, 74, 128))
        c.add(im, (1060, 226 + i * 100), t)
    # 노란 띠 「라벨 스티커 포함!」 세 번
    bd = Image.new("RGBA", (1320, 220), (250, 240, 70, 255))
    ImageDraw.Draw(bd).rectangle([0, 0, 1319, 219], outline=(30, 30, 30, 255), width=7)
    tim, _ = text_piece("라벨 스티커 포함!", font(BHS, 140), (176, 30, 196))
    bd.alpha_composite(tim, ((1320 - tim.size[0]) // 2, (220 - tim.size[1]) // 2))
    bd = bd.rotate(9, expand=True, resample=Image.BICUBIC)
    for a, b in ((5.67, 5.92), (6.17, 6.42), (6.75, 7.0)):
        c.add(bd, (960, 520), a, b, anchor="cc")
    return c


def card_q():
    c = Card()
    f = font(BRUSH, 230)
    for s, t, u in (("?", 0.45, 0.75), ("??", 0.75, 1.0), ("???", 1.0, 99.0)):
        im, _ = text_piece(s, f, (230, 150, 200))
        c.add(im, (1660, 380), t, u, anchor="rt")
    return c


def card3():
    c = Card()
    c.add(seal_piece("scallop", 245, 150, "9,999,000원"), (1600, 190), 0.0, anchor="cc")
    num, _ = text_piece("1577-꽉꽉", font(SERIF_B, 124), (255, 255, 255), shadow=(10, 6, 6, 255), off=6)
    c.add(num, (1465, 925), 0.0, anchor="ct")
    script_lines(c, ["코케트", "떡볶이"], 160, (232, 156, 204), 1800, 400, [0.62, 1.22], gap=1.1, shadow=(60, 20, 40, 160))
    stp = Image.new("RGBA", (960, 180), (0, 0, 0, 0))
    sdr = ImageDraw.Draw(stp)
    sdr.rectangle([0, 0, 959, 179], outline=(196, 28, 40, 255), width=12)
    tim, _ = text_piece("특별 할인", font(BHS, 124), (196, 28, 40))
    stp.alpha_composite(tim, ((960 - tim.size[0]) // 2, (180 - tim.size[1]) // 2))
    stp = stp.rotate(12, expand=True, resample=Image.BICUBIC)
    c.add(stp, (600, 215), 2.52, anchor="cc", pop=-0.1)
    yc = Image.new("RGBA", (290, 290), (0, 0, 0, 0))
    yd = ImageDraw.Draw(yc)
    yd.ellipse([0, 0, 289, 289], fill=(252, 232, 40, 255))
    f = font(BHS, 76)
    yd.text(((290 - yd.textlength("9,900원", font=f)) / 2, 100), "9,900원", font=f, fill=(206, 20, 30))
    c.add(yc, (1710, 185), 3.12, anchor="cc", pop=0.12)
    im, _ = text_piece("*파리 미포함*", font(SUIT_M, 40), (232, 228, 222))
    c.add(im, (1690, 838), 4.42, anchor="ct")
    return c


JOBS = {
    # bg_lab(쓰지 않음): 바탕 판을 원본 카드 첫 프레임의 Lab 평균으로 옮기던 칸 — 10-24 유호님 「뭐든 후보정은 최대한 피하는게 좋아보여」로 뺐다.
    #   바탕 색이 틀리면 손 그림을 지시문으로 다시 굽는다. 다시 켜려면 bg_lab=(L, a, b)(OpenCV 8비트)를 넣는다.
    11: dict(hand="H1", prop="mini/mini_0001.png", narrow=0.5, tint=(1.0, 1.0, 1.0), bottom=True, split=False, card=card1,
             main=lambda t: (0.0, 780 * (1 - ease_out(ramp(t, 0.20, 0.62))))),
    21: dict(hand="H2", prop="giftbox/giftbox_0001.png", narrow=0.5, tint=(0.66, 0.78, 0.92), bottom=False, split=True, card=card2,
             main=lambda t: (0.0, -1000 * (1 - ease_out(ramp(t, 0.35, 0.78)))),
             pointer=lambda t: None if t < 4.33 or t > 5.66 else (0.0, 520 * (1 - ease_out(ramp(t, 4.33, 4.56))) + 520 * ease_out(ramp(t, 5.42, 5.66)))),
    27: dict(hand="H3", prop="tteok/tteok_0001.png", narrow=0.55, tint=(0.66, 0.78, 0.92), bottom=True, split=False, card=card_q,
             main=lambda t: (0.0, 760 * (1 - ease_out(ramp(t, 0.45, 0.95))))),
    29: dict(hand="H3", prop="tteok/tteok_0001.png", narrow=0.55, tint=(0.66, 0.78, 0.92), bottom=True, split=False, card=card3,
             main=lambda t: (0.0, 0.0)),
}


def render(n):
    j = JOBS[n]
    nf = SH[n]["f1"] - SH[n]["f0"]
    bg, (mi, ma), (pi_, pa_), _ = layers(j["hand"], j["prop"], j["narrow"], j["tint"], j["bottom"], j["split"])
    if "bg_lab" in j:   # 손 · 물건 층은 그대로 두고 바탕만 원본 색으로
        lab = cv2.cvtColor(np.clip(bg, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        lab += np.array(j["bg_lab"], np.float32) - lab.reshape(-1, 3).mean(0)
        bg = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    card = j["card"]()
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f"C{n}.mp4")
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                           "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    last = None
    for f in range(nf):
        t = f / FPS
        # 손에 든 느낌의 작은 흔들림
        jx, jy = 4.0 * np.sin(2 * np.pi * 0.55 * t + 0.7), 3.0 * np.sin(2 * np.pi * 0.8 * t + 1.9)
        canvas = bg.copy()
        dx, dy = j["main"](t)
        canvas = paste(canvas, mi, ma, dx + jx, dy + jy)
        if "pointer" in j:
            pp = j["pointer"](t)
            if pp is not None:
                canvas = paste(canvas, pi_, pa_, pp[0] + jx * 0.6, pp[1] + jy * 0.6)
        frame = Image.fromarray(cv2.cvtColor(np.clip(canvas, 0, 255).astype(np.uint8), cv2.COLOR_BGR2RGB)).convert("RGBA")
        frame.alpha_composite(card.draw(t))
        bgr = cv2.cvtColor(np.asarray(frame.convert("RGB")), cv2.COLOR_RGB2BGR)
        ff.stdin.write(bgr.tobytes())
        last = bgr
    ff.stdin.close()
    ff.wait()
    cv2.imencode(".jpg", last, [cv2.IMWRITE_JPEG_QUALITY, 90])[1].tofile(os.path.join(OUT, f"C{n}_끝.jpg"))
    print(n, nf, "프레임 →", out)


if __name__ == "__main__":
    for a in (sys.argv[1:] or ["11", "21", "27", "29"]):
        render(int(a))
