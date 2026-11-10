# 블프 두 편 작품 글자 다시(2026-11-10, Claude) — 글꼴 윤곽을 shapely 도형으로 꺼내는 공용 도구.
# 폰트 정본 §10-2 「브랜드 이름 · 끝 로고 — 글자 원고(글꼴 윤곽을 다듬거나 조판)」의 「다듬기」를 하려고 쓴다: 글꼴은 출발점이고,
# 꺼낸 윤곽을 자르고 · 늘리고 · 다른 획을 붙여 로고타입으로 만든다. 그대로 쓰지 않는다.
#   from 글자윤곽 import 글꼴, 글자도형, 경로, 미리보기
import math
from functools import lru_cache

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"
SANS = "C:/Windows/Fonts/NotoSansKR-VF.ttf"


@lru_cache(maxsize=None)
def 글꼴(path, wght):
    f = TTFont(path)
    if "fvar" in f:
        f = instantiateVariableFont(f, {"wght": wght}, inplace=False)
    return f


class _납작펜(BasePen):
    """곡선을 잘게 나눠 꺾은선 고리 목록으로 받는다."""

    def __init__(self, glyphSet, step=24):
        super().__init__(glyphSet)
        self.rings, self.cur, self.step = [], [], step

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.step + 1):
            t = i / self.step
            a = (1 - t) ** 3
            b = 3 * (1 - t) ** 2 * t
            c = 3 * (1 - t) * t * t
            d = t ** 3
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.step + 1):
            t = i / self.step
            self.cur.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))

    def _closePath(self):
        if len(self.cur) >= 3:
            self.rings.append(self.cur)
        self.cur = []

    _endPath = _closePath


def 글자도형(path, wght, ch):
    """글자 하나의 도형(글꼴 단위, y 위가 +)과 전진 폭. 트루타입 규칙대로 시계 방향 고리 = 몸, 반시계 = 구멍."""
    f = 글꼴(path, wght)
    gs = f.getGlyphSet()
    name = f.getBestCmap()[ord(ch)]
    pen = _납작펜(gs)
    gs[name].draw(pen)
    outer, holes = [], []
    for r in pen.rings:
        p = Polygon(r).buffer(0)
        if p.is_empty:
            continue
        signed = sum((r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1]) for i in range(len(r))) / 2
        (outer if signed < 0 else holes).append(p)
    g = unary_union(outer)
    if holes:
        g = g.difference(unary_union(holes))
    return g, gs[name].width


def 조판(path, wght, text, track=0.0):
    """낱자를 이어 놓는다. track은 글꼴 단위(1000 = 1em)로 글자 사이에 더한다."""
    x, parts = 0.0, []
    for ch in text:
        if ch == " ":
            x += 280 + track
            continue
        g, adv = 글자도형(path, wght, ch)
        parts.append(affinity.translate(g, x, 0))
        x += adv + track
    return unary_union(parts)


def 경로(g):
    """Remotion Logo.tsx가 읽는 SVG 경로(왼쪽 위 0,0 · y 아래가 +)와 폭 · 높이."""
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    minx, miny, maxx, maxy = g.bounds
    out = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)
            out.append("M" + " L".join(f"{x - minx:.2f},{maxy - y:.2f}" for x, y in pts) + " Z")
    return " ".join(out), round(maxx - minx, 2), round(maxy - miny, 2)


def 맞춤(g, h=100.0):
    """높이를 h로 맞추고 왼쪽 아래를 0,0으로."""
    minx, miny, maxx, maxy = g.bounds
    s = h / (maxy - miny)
    g = affinity.scale(g, s, s, origin=(minx, miny))
    return affinity.translate(g, -minx, -miny)


def 그리기(d, g, ox, oy, scale, fill):
    """PIL ImageDraw에 도형을 그린다(구멍은 바탕색이 아니라 빈칸으로 남게 마스크로)."""
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    minx, miny, maxx, maxy = g.bounds
    tf = lambda c: [(ox + (x - minx) * scale, oy + (maxy - y) * scale) for x, y in c]
    for p in polys:
        d.polygon(tf(p.exterior.coords), fill=fill)


def 마스크(g, W, H, ox, oy, scale, ss=4):
    """안티에일리어싱 마스크(L) — 구멍까지 정확히."""
    from PIL import Image, ImageChops, ImageDraw
    m = Image.new("L", (W * ss, H * ss), 0)
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    minx, miny, maxx, maxy = g.bounds
    tf = lambda c: [((ox + (x - minx) * scale) * ss, (oy + (maxy - y) * scale) * ss) for x, y in c]
    for p in polys:
        # 덩어리마다 따로 그려 합친다 — 한 판에 차례로 그리면 앞 덩어리의 구멍이 뒤(구멍 안에 든 덩어리)를 지운다
        one = Image.new("L", m.size, 0)
        d = ImageDraw.Draw(one)
        d.polygon(tf(p.exterior.coords), fill=255)
        for hole in p.interiors:
            d.polygon(tf(hole.coords), fill=0)
        m = ImageChops.lighter(m, one)
    return m.resize((W, H), Image.LANCZOS)
