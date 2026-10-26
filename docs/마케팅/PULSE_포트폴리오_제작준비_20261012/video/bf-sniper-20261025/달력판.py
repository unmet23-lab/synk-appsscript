# 블프 스나이퍼 달력 판(2026-10-27) — 달력 컷 다섯(2 · 5 · 13 · 15 · 18)의 숫자 · X · 「00:00」을 코드로 정확히 그린다.
# Gemini가 그린 달력은 다섯 번 모두 글자가 틀렸다(토요일 X 빠짐 · 18일 X 빠짐 · 숫자 건너뜀 · 23 · 24가 두 번 · 00:00이 26일 칸).
# 02_콘티 「만드는 길: A(손 · 펜) + D(달력 글)」대로, 이 판을 Gemini에 Image 1로 주고 「판은 그대로, 손과 펜만 더함」으로 편집한다.
#   python -X utf8 달력판.py   → 콘티/bf-sniper/달력판/C02 · C05 · C13 · C15 · C18.png(1920×1080, 원본 각 컷의 짜임대로 자름)
import calendar
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/달력판")
SUIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf"
SUIT_B = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"
HAND = "C:/Windows/Fonts/segoepr.ttf"   # 손글씨 꼴(Segoe Print)
CW, CH = 560, 420          # 칸 하나
X0, Y0 = 120, 520          # 격자 왼쪽 위
PAPER = (247, 246, 242)
RED = (205, 30, 40)
RNG = random.Random(27)


def stroke(d, p0, p1, w=22):
    """빨간 마커 한 획 — 살짝 휘고 굵기가 흔들린다."""
    n = 24
    bx, by = RNG.uniform(-18, 18), RNG.uniform(-18, 18)   # 획마다 한 번만 휜다(점마다 흔들면 지그재그가 된다)
    pts = []
    for i in range(n + 1):
        t = i / n
        x = p0[0] + (p1[0] - p0[0]) * t + math.sin(t * math.pi) * bx
        y = p0[1] + (p1[1] - p0[1]) * t + math.sin(t * math.pi) * by
        pts.append((x, y))
    for (a, b) in zip(pts, pts[1:]):
        d.line((a, b), fill=RED + (235,), width=int(w * RNG.uniform(0.85, 1.1)))
        d.ellipse((b[0] - w / 2, b[1] - w / 2, b[0] + w / 2, b[1] + w / 2), fill=RED + (235,))


def box(day):
    calendar.setfirstweekday(calendar.SUNDAY)
    for r, week in enumerate(calendar.monthcalendar(2026, 11)):
        if day in week:
            c = week.index(day)
            return X0 + c * CW, Y0 + r * CH
    raise ValueError(day)


def x_mark(d, day, strokes=2):
    x, y = box(day)
    m = 70
    if strokes >= 1:
        stroke(d, (x + m, y + m + 60), (x + CW - m, y + CH - m))
    if strokes >= 2:
        stroke(d, (x + CW - m, y + m + 60), (x + m, y + CH - m))


def circle(d, day, turns=2):
    x, y = box(day)
    cx, cy, rx, ry = x + CW * 0.55, y + CH * 0.62, CW * 0.36, CH * 0.26
    for k in range(turns):
        pts = []
        for i in range(73):
            a = i / 72 * 2 * math.pi + k * 0.4
            pts.append((cx + (rx + k * 10) * math.cos(a) + RNG.uniform(-4, 4), cy + (ry + k * 8) * math.sin(a) + RNG.uniform(-4, 4)))
        d.line(pts, fill=RED + (235,), width=20, joint="curve")


def month(crossed, partial=None, circle27=0):
    W, H = X0 * 2 + CW * 7, Y0 + CH * 5 + 120
    img = Image.new("RGBA", (W, H), PAPER + (255,))
    d = ImageDraw.Draw(img, "RGBA")
    d.text((W / 2, 170), "2026년 11월", font=ImageFont.truetype(SUIT_B, 170), fill=(30, 30, 30), anchor="mm")
    for i, wd in enumerate("일월화수목금토"):
        d.rectangle((X0 + i * CW, Y0 - 120, X0 + (i + 1) * CW, Y0), fill=(230, 232, 236))
        d.text((X0 + i * CW + CW / 2, Y0 - 60), wd, font=ImageFont.truetype(SUIT, 72), fill=(200, 40, 50) if i == 0 else (60, 60, 60), anchor="mm")
    for r in range(6):
        d.line((X0, Y0 + r * CH, X0 + 7 * CW, Y0 + r * CH), fill=(150, 160, 175), width=5)
    for c in range(8):
        d.line((X0 + c * CW, Y0 - 120, X0 + c * CW, Y0 + 5 * CH), fill=(150, 160, 175), width=5)
    calendar.setfirstweekday(calendar.SUNDAY)
    for r, week in enumerate(calendar.monthcalendar(2026, 11)):
        for c, day in enumerate(week):
            if day:
                d.text((X0 + c * CW + 34, Y0 + r * CH + 22), str(day), font=ImageFont.truetype(SUIT_B, 110),
                       fill=(200, 40, 50) if c == 0 else (25, 25, 25))
    x, y = box(27)
    d.text((x + CW * 0.55, y + CH * 0.62), "00:00", font=ImageFont.truetype(HAND, 120), fill=RED + (240,), anchor="mm")
    ink = Image.new("RGBA", img.size, (0, 0, 0, 0))
    di = ImageDraw.Draw(ink, "RGBA")
    for day in crossed:
        x_mark(di, day)
    if partial:
        x_mark(di, partial[0], partial[1])
    if circle27:
        circle(di, 27, circle27)
    ink = ink.filter(ImageFilter.GaussianBlur(1.2))
    img = Image.alpha_composite(img, ink)
    return img.convert("RGB")


def shot(img, rect, skew=0.0, tilt=0.0):
    """rect(달력 좌표)를 1920×1080으로 — 원근을 조금 줘서 사진처럼(skew: 왼쪽이 가까움, tilt: 아래가 가까움).
    종이 밖으로 나간 자리는 종이색으로 채운다(검은 띠가 남지 않게)."""
    pad = 1600
    big = Image.new("RGB", (img.width + pad * 2, img.height + pad * 2), PAPER)
    big.paste(img, (pad, pad))
    l, t, r, b = [v + pad for v in rect]
    crop = big.crop((int(l), int(t), int(r), int(b))).resize((1920, 1080), Image.LANCZOS)
    w, h = crop.size
    dx, dy = w * skew, h * tilt
    src = [(0 + dx, 0 + dy), (w - dx * 0.2, 0), (w, h), (0, h - dy * 0.2)]
    coeffs = _persp([(0, 0), (w, 0), (w, h), (0, h)], src)
    out = crop.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(235, 233, 228))
    a = np.asarray(out).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    v = 1 - 0.18 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    a = np.clip(a * v[..., None] + np.random.default_rng(1).normal(0, 2.2, a.shape), 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def _persp(dst, src):
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(m, float)
    B = np.array(src, float).reshape(8)
    return np.linalg.solve(A, B)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    full = (0, 0, X0 * 2 + CW * 7, Y0 + CH * 5 + 120)
    def r_cols(a, b, cy, extra=0.15):   # a~b 칸 너비(앞뒤로 칸의 extra만큼 더)와 가운데 높이 cy로 16:9를 자른다
        x1, _ = box(a)
        x2, _ = box(b)
        l, r = x1 - CW * extra, x2 + CW * (1 + extra)
        h = (r - l) * 9 / 16
        return (l, cy - h / 2, r, cy + h / 2)
    jobs = {
        "C02": (month(range(1, 20), (20, 1)), (0, 40, full[2], 40 + full[2] * 9 / 16), 0.03, 0.0),
        # 원본 5: 6칸 남짓 · 세 줄(가운데가 둘째 · 셋째 줄 경계) / 13 · 15: 다섯 칸 · 두 줄 / 18: 결전의 날이 가운데인 석 칸 남짓
        "C05": (month(range(1, 24), (24, 1)), r_cols(16, 21, box(22)[1], 0.3), 0.02, 0.04),
        "C13": (month(range(1, 25), (25, 1)), r_cols(23, 27, box(23)[1] + CH * 0.35, 0.25), 0.02, 0.05),
        "C15": (month(range(1, 26), (26, 1)), r_cols(23, 27, box(23)[1] + CH * 0.35, 0.25), 0.02, 0.04),
        "C18": (month(range(1, 27), None, 1), r_cols(26, 28, box(27)[1] + CH * 0.55, 0.3), 0.02, 0.03),
    }
    for k, (img, rect, sk, tl) in jobs.items():
        shot(img, rect, sk, tl).save(OUT / f"{k}.png")
        print(k)
