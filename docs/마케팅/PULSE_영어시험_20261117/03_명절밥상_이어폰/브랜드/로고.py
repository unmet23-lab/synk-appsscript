# 셋째 편 가상 이어폰 브랜드 로고타입 세 벌(2026-11-17, Claude) — 글꼴로 치지 않고 기하 획으로 그린다(슬롭 점검표 22 · 46 · 55).
#   A GOYO  — 한국말 「고요」. 두 O를 이어폰 바깥 면(꽉 찬 원 + 가는 은색 고리)으로 그린다 — 두 귀의 두 알.
#   B nunchi — 한국말 「눈치」(누구 말을 들여보낼지 아는 이어폰). 소문자, i의 점이 케이스 뚜껑의 작은 원.
#   C TACET — 악보에서 「그 악기는 쉰다」. 가는 대문자, 넓은 자간, C가 반쯤 닫힌 고리.
#   python -X utf8 로고.py [출력 폴더]  → 로고_A_GOYO.png · 로고_B_nunchi.png · 로고_C_TACET.png(흰 글자 + 투명 바탕, 긴 변 2400px)
import math
import os
import sys

from PIL import Image, ImageDraw
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
INK = (246, 243, 236)          # 따뜻한 흰색


def stroke(pts, t, cap="round"):
    return LineString(pts).buffer(t / 2, cap_style=cap, join_style="round")


def ring(cx, cy, r, t):
    return Point(cx, cy).buffer(r, quad_segs=96).difference(Point(cx, cy).buffer(r - t, quad_segs=96))


def wedge(cx, cy, r, a0, a1):
    """중심에서 a0°~a1°(수학 각, 반시계)로 벌어진 부채꼴 — 고리를 열 때 뺀다"""
    pts = [(cx, cy)] + [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in [a0 + (a1 - a0) * i / 48 for i in range(49)]]
    return Polygon(pts)


def arc_ring(cx, cy, r, t, open0, open1, round_ends=True):
    g = ring(cx, cy, r, t).difference(wedge(cx, cy, r * 1.6, open0, open1))
    if round_ends:
        mid = r - t / 2
        for a in (open0, open1):
            g = g.union(Point(cx + mid * math.cos(math.radians(a)), cy + mid * math.sin(math.radians(a))).buffer(t / 2, quad_segs=32))
    return g


def bud(cx, cy, r, ring_t, gap):
    """이어폰 바깥 면 — 가는 고리 + 틈 + 꽉 찬 원"""
    return ring(cx, cy, r, ring_t).union(Point(cx, cy).buffer(r - ring_t - gap, quad_segs=96))


def place(glyphs, gap):
    """글자(도형, 너비) 목록을 왼쪽부터 gap만큼 띄워 늘어놓는다"""
    x, out = 0.0, []
    for g, w in glyphs:
        out.append(affinity.translate(g, xoff=x))
        x += w + gap
    return unary_union(out), x - gap


# A GOYO — 글자 높이 100, 획 12, 둥근 끝
def logo_goyo():
    T = 12
    G = ring(50, 50, 50, T).difference(wedge(50, 50, 80, 0, 48))
    G = G.union(Point(50 + (50 - T / 2) * math.cos(math.radians(48)), 50 + (50 - T / 2) * math.sin(math.radians(48))).buffer(T / 2, quad_segs=32))
    G = G.union(box(56, 50 - T / 2, 100, 50 + T / 2).intersection(Point(50, 50).buffer(50))).union(Point(56, 50).buffer(T / 2, quad_segs=32))
    O = bud(50, 50, 50, 5.0, 6.0)
    Y = unary_union([stroke([(T / 2, 100 - T / 2), (46, 52)], T), stroke([(92 - T / 2, 100 - T / 2), (46, 52)], T), stroke([(46, 52), (46, T / 2)], T)])
    return place([(G, 100), (O, 100), (Y, 92), (O, 100)], 20)


# B nunchi — 소문자, x높이 70, 오름 104, 획 11
def logo_nunchi():
    T = 11
    xh = 70

    def n_glyph(stem_top=xh):
        w = 62
        r = (w - T) / 2
        cy = xh - r - T / 2 + T / 2
        arch = arc_ring(w / 2, xh - (w / 2), w / 2, T, 180, 360, round_ends=False)
        g = unary_union([stroke([(T / 2, T / 2), (T / 2, stem_top - T / 2)], T), arch, stroke([(w - T / 2, xh - w / 2), (w - T / 2, T / 2)], T)])
        g = g.union(stroke([(T / 2, xh - w / 2), (T / 2, xh - T / 2)], T))
        return g, w

    n, wn = n_glyph()
    u = affinity.rotate(n, 180, origin=(wn / 2, xh / 2))
    c = arc_ring(xh / 2, xh / 2, xh / 2, T, -42, 42)
    h, wh = n_glyph(stem_top=104)
    i_stem = stroke([(T / 2, T / 2), (T / 2, xh - T / 2)], T)
    dot = bud(T / 2, 92, 11, 2.6, 2.6)
    i = i_stem.union(dot)
    return place([(n, wn), (u, wn), (n, wn), (c, xh), (h, wh), (i, T)], 14)


# C TACET — 가는 대문자, 높이 100, 획 7, 넓은 자간
def logo_tacet():
    T = 7

    def t_glyph():
        return unary_union([stroke([(0, 100 - T / 2), (76, 100 - T / 2)], T, "flat"), stroke([(38, 100 - T / 2), (38, 0)], T, "flat")]), 76

    A = LineString([(2, -10), (44, 100), (86, -10)]).buffer(T / 2, cap_style="flat", join_style="mitre", mitre_limit=8)
    A = A.union(stroke([(18, 34), (70, 34)], T, "flat")).intersection(box(-10, 0, 100, 100 + T))
    C = arc_ring(50, 50, 50, T, -40, 40, round_ends=False)
    E = unary_union([stroke([(T / 2, 0), (T / 2, 100)], T, "flat"), stroke([(0, 100 - T / 2), (70, 100 - T / 2)], T, "flat"), stroke([(0, 50), (62, 50)], T, "flat"), stroke([(0, T / 2), (70, T / 2)], T, "flat")])
    t, wt = t_glyph()
    return place([(t, wt), (A, 88), (C, 100), (E, 70), (t, wt)], 34)


def raster(geom, width_px, pad=0.06):
    minx, miny, maxx, maxy = geom.bounds
    w, h = maxx - minx, maxy - miny
    ss = 4
    s = width_px * ss / (w * (1 + 2 * pad))
    W, H = int(width_px * ss), int((h + 2 * pad * w) * s)
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)

    def tr(x, y):
        return ((x - minx + pad * w) * s, H - (y - miny + pad * w) * s)

    polys = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    for p in polys:
        d.polygon([tr(x, y) for x, y in p.exterior.coords], fill=255)
        for hole in p.interiors:
            d.polygon([tr(x, y) for x, y in hole.coords], fill=0)
    a = im.resize((W // ss, H // ss), Image.LANCZOS)
    out = Image.new("RGBA", a.size, INK + (0,))
    out.putalpha(a)
    return out


if __name__ == "__main__":
    for tag, fn in (("A_GOYO", logo_goyo), ("B_nunchi", logo_nunchi), ("C_TACET", logo_tacet)):
        g, _ = fn()
        im = raster(g, 2400)
        p = os.path.join(OUT, f"로고_{tag}.png")
        im.save(p)
        print(p, im.size)
