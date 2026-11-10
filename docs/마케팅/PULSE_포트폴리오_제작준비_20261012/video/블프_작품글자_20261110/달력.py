# 블프 스나이퍼 벽 달력 다시(2026-11-10 밤, Claude) — 슬롭 점검표 55번 훑기 「달력 머리 · 숫자」 + 맹검(블프글자_한번에 23번 기각 4).
# 10-27 판(../bf-sniper-20261025/달력판.py)의 짜임(칸 크기 · 자리 · 컷 다섯의 자르기)은 그대로 두고 인쇄면과 잉크만 바꾼다.
#   맹검 지적 1 「회사 기본 고딕 머리 · 회색 요일 띠 · 단순 격자 — 음력 · 절기 · 여백 비례 없는 디지털 템플릿」
#     → 실제 집 벽 달력 짜임: 큰 월 숫자 + NOVEMBER · 요일 영문/한글 · 토요일 파랑 · 칸마다 음력 · 절기(입동 · 소설) ·
#       마지막 줄 빈칸에 10월 · 12월 작은 달력. 글꼴은 회사 글꼴(SUIT)이 아닌 인쇄 달력 결(Barlow Condensed · Noto Sans KR).
#   맹검 지적 2 「X가 각도 · 굵기 · 끝 모양 · 자리까지 똑같이 복제된 디지털 직선, 「00:」은 마커와 안 맞는 얇은 서체」
#     → X마다 크기 · 기울기 · 자리 · 획 길이 · 끝 삐침 · 누름(굵기)이 다르고, 「00:00」은 글꼴이 아니라 마커 획으로 쓴다.
# 음력은 Meeus 49장 삭(초승) 계산(한국 표준시)으로 낸다 — 2026 추석(음 8.15 = 9.25)으로 맞춰 봤다.
#   python -X utf8 달력.py   → git 밖 최종/글자다시_1110/달력/C02 · C05 · C13 · C15 · C18.png + 비교 한 장
import calendar
import importlib.util
import math
import os
import random
import subprocess
from datetime import date, datetime, timedelta

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("달력판", os.path.join(HERE, "..", "bf-sniper-20261025", "달력판.py"))
옛 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(옛)
CW, CH, X0, Y0, box, shot = 옛.CW, 옛.CH, 옛.X0, 옛.Y0, 옛.box, 옛.shot
W, H = X0 * 2 + CW * 7, Y0 + CH * 5 + 120
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/글자다시_1110/달력"
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
RED = (200, 28, 38)


# ── 음력 · 절기 ──────────────────────────────────────────────────────────
def _jd_to_kst(jd):
    return datetime(2000, 1, 1, 12) + timedelta(days=jd - 2451545.0) + timedelta(hours=9)


def 삭(k):
    """Meeus 49장 — k번째 삭의 JDE(주요 보정항)."""
    T = k / 1236.85
    jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T ** 2 - 0.000000150 * T ** 3 + 0.00000000073 * T ** 4
    r = math.radians
    M = r(2.5534 + 29.10535670 * k - 0.0000014 * T ** 2)
    Mp = r(201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3)
    F = r(160.7108 + 390.67050284 * k - 0.0016118 * T ** 2)
    Om = r(124.7746 - 1.56375588 * k + 0.0020672 * T ** 2)
    E = 1 - 0.002516 * T - 0.0000074 * T ** 2
    c = (-0.40720 * math.sin(Mp) + 0.17241 * E * math.sin(M) + 0.01608 * math.sin(2 * Mp) + 0.01039 * math.sin(2 * F)
         + 0.00739 * E * math.sin(Mp - M) - 0.00514 * E * math.sin(Mp + M) + 0.00208 * E * E * math.sin(2 * M)
         - 0.00111 * math.sin(Mp - 2 * F) - 0.00057 * math.sin(Mp + 2 * F) + 0.00056 * E * math.sin(2 * Mp + M)
         - 0.00042 * math.sin(3 * Mp) + 0.00042 * E * math.sin(M + 2 * F) + 0.00038 * E * math.sin(M - 2 * F)
         - 0.00024 * E * math.sin(2 * Mp - M) - 0.00017 * math.sin(Om))
    return jde + c


def 음력표(y0=2026):
    """양력 날짜 → (음력 달, 날). 추석 2026-09-25 = 음 8.15에 맞춰 달 번호를 붙인다(이 해 끝에는 윤달 없음)."""
    k0 = round((y0 - 2000 + 7.5 / 12) * 12.3685)
    news = sorted(_jd_to_kst(삭(k)).date() for k in range(k0 - 2, k0 + 6))
    m8 = max(d for d in news if d <= date(2026, 9, 25))
    assert (date(2026, 9, 25) - m8).days == 14, f"추석 대조 실패: 음 8.1 = {m8}"
    i8 = news.index(m8)
    table = {}
    for i in range(i8, len(news) - 1):
        for n in range((news[i + 1] - news[i]).days):
            table[news[i] + timedelta(days=n)] = (8 + i - i8, n + 1)
    return table


def 절기(y0=2026):
    """낮은 정밀 태양 황경(Meeus 25장)으로 입동(225°) · 소설(240°) 날짜(한국 표준시)."""
    def lon(jd):
        T = (jd - 2451545.0) / 36525
        L0 = 280.46646 + 36000.76983 * T
        M = math.radians(357.52911 + 35999.05029 * T)
        C = (1.914602 - 0.004817 * T) * math.sin(M) + 0.019993 * math.sin(2 * M) + 0.000289 * math.sin(3 * M)
        om = math.radians(125.04 - 1934.136 * T)
        return (L0 + C - 0.00569 - 0.00478 * math.sin(om)) % 360
    out = {}
    jd = 2451545.0 + (datetime(y0, 11, 1) - datetime(2000, 1, 1, 12)).total_seconds() / 86400
    for name, tgt in (("입동", 225), ("소설", 240)):
        j = jd
        while (lon(j) - tgt) % 360 > 180:
            j += 0.01
        out[_jd_to_kst(j).date()] = name
    return out


# ── 인쇄면(HTML → 크롬) ──────────────────────────────────────────────────
def mini(y, m):
    calendar.setfirstweekday(calendar.SUNDAY)
    rows = "".join("<tr>" + "".join(f"<td class='{'s' if i == 0 else 't' if i == 6 else ''}'>{d or ''}</td>" for i, d in enumerate(w)) + "</tr>"
                   for w in calendar.monthcalendar(y, m))
    head = "".join(f"<th class='{'s' if i == 0 else 't' if i == 6 else ''}'>{c}</th>" for i, c in enumerate("SMTWTFS"))
    return f"<div class='mini'><div class='mm'>{m}<span>{calendar.month_name[m].upper()}</span></div><table><tr>{head}</tr>{rows}</table></div>"


def html():
    lunar, terms = 음력표(), 절기()
    calendar.setfirstweekday(calendar.SUNDAY)
    cells = []
    for r, week in enumerate(calendar.monthcalendar(2026, 11)):
        for c, d in enumerate(week):
            x, y = X0 + c * CW, Y0 + r * CH
            cls = "s" if c == 0 else "t" if c == 6 else ""
            if d:
                lm, ld = lunar[date(2026, 11, d)]
                lun = f"{lm}.{ld}" if ld in (1, 15) or d in (1,) else f"{ld}"
                term = terms.get(date(2026, 11, d), "")
                cells.append(f"<div class='cell {cls}' style='left:{x}px;top:{y}px'><div class='d'>{d}</div>"
                             f"<div class='lun'>{lun}</div>{f'<div class=term>{term}</div>' if term else ''}</div>")
    # 마지막 줄 빈칸(화 ~ 토)에 10월 · 12월 작은 달력
    x10, y5 = X0 + 3 * CW, Y0 + 4 * CH
    cells.append(f"<div class='minis' style='left:{x10}px;top:{y5}px;width:{CW * 4}px;height:{CH}px'>{mini(2026, 10)}{mini(2026, 12)}</div>")
    heads = "".join(f"<div class='wd {'s' if i == 0 else 't' if i == 6 else ''}' style='left:{X0 + i * CW}px'>{e}<span>{k}</span></div>"
                    for i, (e, k) in enumerate(zip(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], "일월화수목금토")))
    lines = "".join(f"<div class='hl' style='top:{Y0 + r * CH}px'></div>" for r in range(6))
    lines += "".join(f"<div class='vl' style='left:{X0 + c * CW}px'></div>" for c in range(8))
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600&family=Noto+Sans+KR:wght@400;500;700&display=block" rel="stylesheet">
<style>
body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#F6F3EC}}
.p{{position:relative;width:{W}px;height:{H}px;color:#23211F;font-family:'Barlow Condensed',sans-serif}}
.grain{{position:absolute;inset:0;opacity:.28;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5 0 0 0 0 .47 0 0 0 0 .42 0 0 0 .3 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")}}
.big{{position:absolute;left:{X0 + 40}px;top:30px;font-weight:600;font-size:330px;line-height:1;letter-spacing:-6px}}
.mon{{position:absolute;left:{X0 + 360}px;top:120px;font-weight:500;font-size:96px;letter-spacing:22px;line-height:1}}
.mon span{{display:block;margin-top:26px;font-size:64px;letter-spacing:10px;color:#6E6A64}}
.ko{{position:absolute;right:{X0 + 10}px;top:150px;font-family:'Noto Sans KR';font-weight:500;font-size:58px;color:#6E6A64;letter-spacing:4px}}
.wd{{position:absolute;top:{Y0 - 100}px;width:{CW}px;text-align:center;font-weight:500;font-size:62px;letter-spacing:8px}}
.wd span{{font-family:'Noto Sans KR';font-weight:400;font-size:44px;letter-spacing:0;margin-left:16px;color:#8A857E}}
.wd.s,.cell.s .d{{color:#C8323A}} .wd.t,.cell.t .d{{color:#2D5BA8}}
.hl{{position:absolute;left:{X0}px;width:{CW * 7}px;height:3px;background:#B9B6AF}}
.vl{{position:absolute;top:{Y0}px;width:3px;height:{CH * 5}px;background:#CFCBC3}}
.cell{{position:absolute;width:{CW}px;height:{CH}px}}
.d{{position:absolute;left:30px;top:6px;font-weight:500;font-size:150px;line-height:1}}
.lun{{position:absolute;right:30px;top:24px;font-family:'Noto Sans KR';font-size:40px;color:#9A958D}}
.term{{position:absolute;right:30px;top:80px;font-family:'Noto Sans KR';font-weight:500;font-size:44px;color:#7D776F}}
.minis{{position:absolute;background:#F6F3EC;margin-left:3px;margin-top:3px;display:flex;justify-content:flex-end;gap:120px;align-items:center;padding-right:60px;box-sizing:border-box}}
.mini{{display:flex;gap:30px;align-items:flex-start;color:#4A4641}}
.mm{{font-weight:600;font-size:110px;line-height:.9}} .mm span{{display:block;font-weight:500;font-size:30px;letter-spacing:6px;color:#8A857E;margin-top:8px}}
.mini table{{border-collapse:collapse;font-size:38px;font-weight:500}} .mini td,.mini th{{width:50px;height:46px;text-align:center;padding:0}}
.mini th{{font-size:28px;color:#8A857E}} .mini .s{{color:#C8323A}} .mini .t{{color:#2D5BA8}}
</style></head><body><div class="p">
<div class="big">11</div><div class="mon">NOVEMBER<span>2026</span></div><div class="ko">2026 병오년</div>
{heads}{lines}{''.join(cells)}<div class="grain"></div></div></body></html>"""


def 인쇄면():
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, "_인쇄면.html")
    png = os.path.join(OUT, "_인쇄면.png")
    open(p, "w", encoding="utf-8").write(html())
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--screenshot={png}", f"--window-size={W},{H}",
                    "--virtual-time-budget=9000", "--force-device-scale-factor=1", "file:///" + p.replace("\\", "/")],
                   check=True, capture_output=True, timeout=180)
    return Image.open(png).convert("RGBA")


# ── 잉크(마커) ──────────────────────────────────────────────────────────
RNG = random.Random(1127)


class 잉크:
    """획 하나를 따로 그려(불투명 마스크) 일정한 농도로 겹친다 — 두 획이 겹친 자리만 진해진다(마커 결)."""
    def __init__(self, size, alpha=0.84):
        self.size, self.alpha = size, alpha
        self.acc = np.zeros(size[::-1], np.float32)

    def 획(self):
        m = Image.new("L", self.size, 0)
        return m, ImageDraw.Draw(m)

    def 더함(self, m):
        a = np.asarray(m.filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255 * self.alpha
        self.acc = 1 - (1 - self.acc) * (1 - a)

    def 층(self):
        out = np.zeros(self.size[::-1] + (4,), np.uint8)
        out[..., 0], out[..., 1], out[..., 2] = RED
        out[..., 3] = (np.clip(self.acc, 0, 1) * 255).astype(np.uint8)
        return Image.fromarray(out, "RGBA")


def 마커획(ink, p0, p1, w, bend=0.0, taper=0.25, hook=None):
    """한 획 — 휘고, 누르는 힘이 처음에 세고 끝에서 빠지며(taper), 끝에 짧은 삐침(hook)이 있을 수 있다."""
    n = 40
    pts = []
    nx, ny = -(p1[1] - p0[1]), p1[0] - p0[0]
    nn = math.hypot(nx, ny) or 1
    nx, ny = nx / nn, ny / nn
    for i in range(n + 1):
        t = i / n
        b = math.sin(t * math.pi) * bend
        pts.append((p0[0] + (p1[0] - p0[0]) * t + nx * b, p0[1] + (p1[1] - p0[1]) * t + ny * b))
    if hook:
        hx, hy = hook
        pts += [(pts[-1][0] + hx * s, pts[-1][1] + hy * s) for s in (0.35, 0.7, 1.0)]
    ph = RNG.uniform(0, 6.28)
    m, d = ink.획()
    for i, (a, b2) in enumerate(zip(pts, pts[1:])):
        t = i / len(pts)
        ww = w * (1.05 - taper * t ** 1.6) * (1 + 0.035 * math.sin(t * 6.28 + ph))
        d.line((a, b2), fill=255, width=max(2, int(ww)))
        d.ellipse((b2[0] - ww / 2, b2[1] - ww / 2, b2[0] + ww / 2, b2[1] + ww / 2), fill=255)
    ink.더함(m)


def X표(ink, day, strokes=2):
    x, y = box(day)
    cx = x + CW * RNG.uniform(0.42, 0.58)
    cy = y + CH * RNG.uniform(0.5, 0.6)
    sx, sy = CW * RNG.uniform(0.23, 0.31), CH * RNG.uniform(0.22, 0.3)
    rot = math.radians(RNG.uniform(-9, 9))
    w = RNG.uniform(19, 25)

    def R(px, py):
        qx, qy = cx + px * math.cos(rot) - py * math.sin(rot), cy + px * math.sin(rot) + py * math.cos(rot)
        return (min(max(qx, x + 30), x + CW - 30), min(max(qy, y + 40), y + CH - 26))   # 칸 밖으로 나가지 않게
    # 첫 획: 왼쪽 위 → 오른쪽 아래, 둘째 획: 오른쪽 위 → 왼쪽 아래(길이 · 시작점이 조금씩 다르다)
    a0 = R(-sx * RNG.uniform(0.9, 1.1), -sy * RNG.uniform(0.85, 1.1))
    a1 = R(sx * RNG.uniform(0.85, 1.12), sy * RNG.uniform(0.9, 1.15))
    b0 = R(sx * RNG.uniform(0.8, 1.05), -sy * RNG.uniform(0.95, 1.2))
    b1 = R(-sx * RNG.uniform(0.9, 1.2), sy * RNG.uniform(0.8, 1.05))
    if strokes >= 1:
        마커획(ink, a0, a1, w, bend=RNG.uniform(-14, 14), hook=(RNG.uniform(4, 12), RNG.uniform(-14, -4)) if RNG.random() < 0.3 else None)
    if strokes >= 2:
        마커획(ink, b0, b1, w * RNG.uniform(0.9, 1.05), bend=RNG.uniform(-16, 16), hook=(RNG.uniform(-12, -4), RNG.uniform(2, 10)) if RNG.random() < 0.35 else None)


def 손글씨_0(ink, cx, cy, h, w):
    """마커로 쓴 0 — 위에서 시작해 반시계로 돌고 시작점을 조금 지나 끝난다(살짝 기운 타원)."""
    rx, ry = h * 0.25, h * 0.48
    sl = math.radians(10)
    a0 = math.radians(RNG.uniform(75, 100))
    sweep = math.radians(RNG.uniform(366, 380))
    ph = RNG.uniform(0, 1)
    pts = []
    for i in range(49):
        a = a0 + i / 48 * sweep
        r = 1 + 0.02 * math.sin(a * 2 + ph)
        px, py = rx * r * math.cos(a), -ry * r * math.sin(a)
        pts.append((cx + px - py * math.tan(sl), cy + py))
    m, d = ink.획()
    for a, b in zip(pts, pts[1:]):
        d.line((a, b), fill=255, width=int(w))
        d.ellipse((b[0] - w / 2, b[1] - w / 2, b[0] + w / 2, b[1] + w / 2), fill=255)
    ink.더함(m)


def 손글씨_시각(ink, cx, cy, h=110, w=15):
    """「00:00」을 글꼴 없이 마커 획으로 — 글자 사이 · 크기가 조금씩 다르다."""
    xs = [-1.06, -0.44, 0.0, 0.44, 1.06]
    for i, k in enumerate(xs):
        x = cx + k * h + RNG.uniform(-4, 4)
        y = cy + RNG.uniform(-5, 5) + (i - 2) * -3
        if i == 2:
            for dy in (-0.2, 0.22):
                r = w * 0.62
                m, d = ink.획()
                d.ellipse((x - r, y + dy * h - r, x + r, y + dy * h + r), fill=255)
                ink.더함(m)
        else:
            손글씨_0(ink, x, y, h * RNG.uniform(0.92, 1.05), w)


def 동그라미(ink, day, turns=2):
    x, y = box(day)
    cx, cy, rx, ry = x + CW * 0.55, y + CH * 0.62, CW * 0.38, CH * 0.27
    for k in range(turns):
        pts = []
        a0 = RNG.uniform(0, 1)
        for i in range(81):
            a = a0 + i / 80 * 2 * math.pi * 1.04 + k * 0.5
            pts.append((cx + (rx + k * 12) * math.cos(a) + RNG.uniform(-3, 3), cy + (ry + k * 9) * math.sin(a) * (1 + 0.05 * math.cos(a)) + RNG.uniform(-3, 3)))
        m, d = ink.획()
        d.line(pts, fill=255, width=19, joint="curve")
        ink.더함(m)


def 달(sheet, crossed, partial=None, ring=0):
    img = sheet.copy()
    ink = 잉크(img.size)
    d = ink
    RNG.seed(1127)   # 컷마다 같은 날의 X가 같은 모양이어야 한다(같은 달력) — 날 순서대로 같은 난수
    for day in range(1, 27):
        if day in crossed:
            X표(d, day)
        elif partial and day == partial[0]:
            X표(d, day, partial[1])
        else:
            for _ in range(24):   # 안 그은 날도 난수를 같은 만큼 써서 뒤 날의 모양이 컷마다 같게
                RNG.random()
    x, y = box(27)
    RNG.seed(2727)
    손글씨_시각(d, x + CW * 0.55, y + CH * 0.62)
    if ring:
        RNG.seed(2728)
        동그라미(d, 27, ring)
    return Image.alpha_composite(img, ink.층()).convert("RGB")


def main():
    sheet = 인쇄면()
    full = (0, 0, W, H)

    def r_cols(a, b, cy, extra=0.15):
        x1, _ = box(a)
        x2, _ = box(b)
        l, r = x1 - CW * extra, x2 + CW * (1 + extra)
        h = (r - l) * 9 / 16
        return (l, cy - h / 2, r, cy + h / 2)
    jobs = {
        "C02": (달(sheet, range(1, 20), (20, 1)), (0, 40, full[2], 40 + full[2] * 9 / 16), 0.03, 0.0),
        "C05": (달(sheet, range(1, 24), (24, 1)), r_cols(16, 21, box(22)[1], 0.3), 0.02, 0.04),
        "C13": (달(sheet, range(1, 25), (25, 1)), r_cols(23, 27, box(23)[1] + CH * 0.35, 0.25), 0.02, 0.05),
        "C15": (달(sheet, range(1, 26), (26, 1)), r_cols(23, 27, box(23)[1] + CH * 0.35, 0.25), 0.02, 0.04),
        "C18": (달(sheet, range(1, 27), None, 1), r_cols(26, 28, box(27)[1] + CH * 0.55, 0.3), 0.02, 0.03),
    }
    for k, (img, rect, sk, tl) in jobs.items():
        shot(img, rect, sk, tl).save(os.path.join(OUT, f"{k}.png"))
        print(k)
    return jobs


if __name__ == "__main__":
    t = 음력표()
    print("음력 11/1 =", t[date(2026, 11, 1)], " 11/27 =", t[date(2026, 11, 27)], " 절기 =", 절기())
    main()
