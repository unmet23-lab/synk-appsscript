# 도담중공업 영어 판 끝 로고(2026-11-17, Claude) — 한국어 판 로고(b2b-factory-20261026/도담_로고.py)와 같은 기하 획으로 영문 이름을 그린다.
#   결정 11-05 「끝 로고는 치지 말고 그린다」 · 슬롭 점검표 22번. 표식(두 토막 고리 + 점)은 한국어 판 그대로 쓰고 이름만 바꾼다.
#   획: 고른 두께 T=10(글자 칸 100) · 평평한 획 끝 · 곧은 각. 열린 가로획 끝은 한국어 판처럼 35°로 비스듬히 자른다(날개 끝).
#   시안 A = 표식 + DODAM 한 줄. 시안 B = 표식 + DODAM, 그 아래 같은 획을 0.32배로 줄인 HEAVY INDUSTRIES 한 줄(자간 넓게).
#   render(name_h, 시안)은 한국어 판 L.render와 같은 꼴(mark, name, gap)을 돌려줘 도담_끝로고.logo_alpha가 그대로 쓴다.
#   python -X utf8 로고_영어.py [출력 폴더]   → name_A.png · name_B.png · _미리보기_A.png · _미리보기_B.png
import os
import sys

import numpy as np
from shapely import affinity
from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "PULSE_포트폴리오_제작준비_20261012", "video", "b2b-factory-20261026"))
import 도담_로고 as L   # noqa: E402 — 표식 · 래스터 · 색은 한국어 판 그대로

T = L.T            # 지금 그리는 획 두께(칸 100 기준). DODAM과 작은 줄이 서로 다른 두께로 그린다 — with_t로 바꾼다
SLANT = L.SLANT
T_BIG = 12.0       # DODAM — 한국어 판 이름과 같은 글자 무게로 보이게(한국어 판은 칸 안의 글자가 작아 같은 10이 더 굵어 보인다)
T_SMALL = 13.0     # HEAVY INDUSTRIES — 0.32배로 줄이면 약 4가 된다


def with_t(t, fn):
    global T
    old, T = T, t
    try:
        return fn()
    finally:
        T = old


def bar(*pts, t=None):
    return LineString(pts).buffer((t or T) / 2, cap_style="flat", join_style="mitre", mitre_limit=6)


def hbar(xa, xb, y, left=True, right=True, t=None):
    return L.hbar(xa, xb, y, left=left, right=right, t=t or T)


def hbox(xa, xb, y):
    """곧은 가로획(두 끝이 다른 획 속에 묻히는 자리)"""
    return box(xa, y - T / 2, xb, y + T / 2)


def leg(p, q, ext=30.0):
    """p → q 사선 획을 q 쪽으로 ext만큼 더 늘인다 — 바닥(또는 꼭대기)에서 잘라 평평한 획 끝을 얻는다"""
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = (dx * dx + dy * dy) ** 0.5
    return (q[0] + dx / n * ext, q[1] + dy / n * ext)


def x_at(p, q, y):
    return p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1])


def half_disc(cx, cy, r, side):
    """원의 반쪽(side: 'r' 오른 · 'l' 왼 · 'd' 아래 · 'u' 위)"""
    c = Point(cx, cy).buffer(r, quad_segs=64)
    cut = {"r": box(cx, cy - r - 1, cx + r + 1, cy + r + 1), "l": box(cx - r - 1, cy - r - 1, cx, cy + r + 1),
           "d": box(cx - r - 1, cy - r - 1, cx + r + 1, cy), "u": box(cx - r - 1, cy, cx + r + 1, cy + r + 1)}[side]
    return c.intersection(cut)


def clip(g, x, w):
    return g.intersection(box(x - 20, 0, x + w + 20, 100))


# ---------- 큰 글자(칸 100 × 100, 바닥 0 · 꼭대기 100)
def D(x, w=88):
    r = 50.0
    outer = unary_union([box(x, 0, x + w - r, 100), half_disc(x + w - r, 50, r, "r")])
    inner = unary_union([box(x + T, T, x + w - r, 100 - T), half_disc(x + w - r, 50, r - T, "r")])
    return outer.difference(inner)


def O(x, w=100):
    return L.ring(x + w / 2, 50, w / 2 - T / 2, T)


def A(x, w=96, cy=30.0):
    top = (x + w / 2, 100 - T * 0.3)
    lb, rb = (x + T * 0.62, 0), (x + w - T * 0.62, 0)
    legs = bar(leg(top, lb), top, leg(top, rb))
    cross = hbox(x_at(top, lb, cy), x_at(top, rb, cy), cy)
    return clip(unary_union([legs, cross]), x, w)


def M(x, w=104):
    s = bar((x + T / 2, -20), (x + T / 2, 100 - T / 2), (x + w / 2, 38), (x + w - T / 2, 100 - T / 2), (x + w - T / 2, -20))
    return clip(s, x, w)


# ---------- 작은 줄 글자(같은 칸 100 기준으로 그리고 통째로 줄인다)
def H(x, w=80):
    return unary_union([box(x, 0, x + T, 100), box(x + w - T, 0, x + w, 100), hbox(x + T / 2, x + w - T / 2, 52)])


def E(x, w=70):
    return unary_union([box(x, 0, x + T, 100), hbar(x + T / 2, x + w, 100 - T / 2, left=False), hbar(x + T / 2, x + w * 0.88, 52, left=False),
                        hbar(x + T / 2, x + w, T / 2, left=False)])


def V(x, w=90):
    bot = (x + w / 2, T * 0.3)
    lt, rt = (x + T * 0.62, 100), (x + w - T * 0.62, 100)
    return clip(bar(leg(bot, lt), bot, leg(bot, rt)), x, w)


def Y(x, w=88):
    mid = (x + w / 2, 46)
    lt, rt = (x + T * 0.62, 100), (x + w - T * 0.62, 100)
    return clip(unary_union([bar(leg(mid, lt), mid, leg(mid, rt)), box(x + w / 2 - T / 2, 0, x + w / 2 + T / 2, 46)]), x, w)


def I(x, w=None):
    return box(x, 0, x + T, 100)


def N(x, w=82):
    s = bar((x + T / 2, -20), (x + T / 2, 100 - T / 2), (x + w - T / 2, T / 2), (x + w - T / 2, 120))
    return clip(s, x, w)


def U(x, w=82):
    r = w / 2
    outer = unary_union([box(x, r, x + w, 100), half_disc(x + r, r, r, "d")])
    inner = unary_union([box(x + T, r, x + w - T, 101), half_disc(x + r, r, r - T, "d")])
    return outer.difference(inner)


def S(x, w=None):
    """두 고리를 가운데 획 하나로 잇는 기하 S — 바깥 반지름 Ro = (100 + T) / 4라야 두 고리의 가운데 획이 한 줄로 겹친다"""
    ro = (100 + T) / 4
    rc = ro - T / 2
    cx = x + ro
    top = L.ring(cx, 100 - ro, rc, T).difference(box(cx, 100 - 2 * ro - 1, cx + ro + 1, 100 - ro))
    bot = L.ring(cx, ro, rc, T).difference(box(cx - ro - 1, ro, cx, 2 * ro + 1))
    return unary_union([top, bot])


def Tt(x, w=78):
    return unary_union([hbar(x, x + w, 100 - T / 2), box(x + w / 2 - T / 2, 0, x + w / 2 + T / 2, 100 - T / 2)])


def R(x, w=78):
    r = 26.0
    bowl_o = unary_union([box(x, 100 - 2 * r, x + w - r, 100), half_disc(x + w - r, 100 - r, r, "r")])
    bowl_i = unary_union([box(x + T, 100 - 2 * r + T, x + w - r, 100 - T), half_disc(x + w - r, 100 - r, r - T, "r")])
    kick = bar((x + w * 0.42, 100 - 2 * r + T / 2), leg((x + w * 0.42, 100 - 2 * r + T / 2), (x + w - T * 0.62, 0)))
    return clip(unary_union([bowl_o.difference(bowl_i), box(x, 0, x + T, 100), kick]), x, w)


def word(letters, gap):
    gs, x = [], 0.0
    for f in letters:
        if f is None:          # 낱말 사이
            x += 52
            continue
        g = f(x)
        gs.append(g)
        x = g.bounds[2] + gap
    return unary_union(gs)


def dodam():
    return with_t(T_BIG, lambda: word([D, O, D, A, M], 16.0))


def heavy():
    return with_t(T_SMALL, lambda: word([H, E, A, V, Y, None, I, N, D, U, S, Tt, R, I, E, S], 30.0))


def name_geom(시안):
    big = dodam()
    if 시안 == "A":
        return big
    bx0, by0, bx1, by1 = big.bounds
    small = heavy()
    sx0, sy0, sx1, sy1 = small.bounds
    k = (bx1 - bx0) / (sx1 - sx0)          # 작은 줄 폭 = DODAM 폭
    k = min(k, 0.32)
    small = affinity.scale(small, k, k, origin=(sx0, sy0))
    sx0, sy0, sx1, sy1 = small.bounds
    small = affinity.translate(small, bx0 + ((bx1 - bx0) - (sx1 - sx0)) / 2 - sx0, by0 - 34 - sy1)
    return unary_union([big, small])


def render(name_h, 시안="A"):
    """한국어 판 L.render와 같은 꼴 — (표식 RGBA, 이름 RGBA, 사이 px). name_h는 DODAM 글자 높이(px)"""
    wm = name_geom(시안)
    x0, y0, x1, y1 = wm.bounds
    big = dodam().bounds
    s = name_h / (big[3] - big[1])
    pad = int(name_h * 0.1)
    Wn, Hn = int((x1 - x0) * s + 2 * pad), int((y1 - y0) * s + 2 * pad)
    name = L.raster(wm, Wn, Hn, s, pad - x0 * s, pad + y1 * s)
    mk = L.mark()
    mx0, my0, mx1, my1 = mk.bounds
    md = name_h * 1.32
    sm = md / (my1 - my0)
    Wm = Hm = int(md + 2 * pad)
    mimg = L.raster(mk, Wm, Hm, sm, pad - mx0 * sm, pad + my1 * sm)
    if 시안 == "B":
        # 표식은 DODAM 줄 가운데에 맞춘다 — 이름 그림은 아래로 길어졌으니 표식 그림 위아래에 같은 몫을 붙여 세로 가운데를 DODAM 줄로 옮긴다
        extra = Hn - int(name_h + 2 * pad)
        mimg = np.pad(mimg, ((0, extra), (0, 0)))
    return L.rgba(mimg), L.rgba(name), name_h * 0.55


if __name__ == "__main__":
    from PIL import Image
    out = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10_en/로고"
    os.makedirs(out, exist_ok=True)
    for 시안 in ("A", "B"):
        m, n, gap = render(120, 시안)
        Image.fromarray(n).save(os.path.join(out, f"name_{시안}.png"))
        pw = m.shape[1] + int(gap) + n.shape[1] + 80
        ph = max(m.shape[0], n.shape[0]) + 80
        bg = np.zeros((ph, pw, 3), np.float32) + np.array([60, 72, 96], np.float32)

        def put(img, x, y):
            a = img[..., 3:4] / 255.0
            h, w = img.shape[:2]
            bg[y:y + h, x:x + w] = bg[y:y + h, x:x + w] * (1 - a) + img[..., :3] * a
        cy = ph // 2
        put(m, 40, cy - m.shape[0] // 2)
        put(n, 40 + m.shape[1] + int(gap), cy - n.shape[0] // 2)
        Image.fromarray(bg.astype(np.uint8)).save(os.path.join(out, f"_미리보기_{시안}.png"))
        print(시안, m.shape, n.shape)
