# 5번 새 기획(11-05 밤) 브랜드 심벌 스케치 — 맹검 둘(Fable · 아르곤) 다 「글자만으로는 기본 글꼴로 친 모형 브랜드, 벤치마크는 그린 마크가 있다」.
# 재료는 이 편 안에서만 뽑는다: 트랙(위에서 본 경기장 꼴) · 숨구멍(원) · 빛 기둥(세로 한 줄).
#   python -X utf8 새기획_심벌시안.py   → 콘티/p5n/로고시안/심벌_스케치.png (큰 그림 + 폰 크기)
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
sys.path.insert(0, str(Path(__file__).resolve().parent))
import 새기획_워드마크 as WM


def stadium(w, h, cx=0, cy=0):
    r = h / 2
    return box(cx - w / 2 + r, cy - r, cx + w / 2 - r, cy + r).buffer(r, quad_segs=64)


def track_g(w=200, h=118, t=17, gap=11):
    """가: 위에서 본 트랙 두 레인이 G가 된다 — 오른쪽 위를 열고, 안쪽 레인이 가로대로 꺾여 들어온다."""
    outer = stadium(w, h).difference(stadium(w - 2 * t, h - 2 * t))
    w2, h2 = w - 2 * (t + gap), h - 2 * (t + gap)
    inner = stadium(w2, h2).difference(stadium(w2 - 2 * t, h2 - 2 * t))
    cut = box(w * 0.14, 6, w, h)                    # 오른쪽 위를 연다(가로대 윗선 위)
    shape = unary_union([outer.difference(cut), inner.difference(box(w2 * 0.12, 6, w, h))])
    bar = box(w * 0.14, -t * 0.0 - t + 6, w / 2 - 0.0, 6)
    return unary_union([shape, bar])


def pillar_pore(r=70, slit=11):
    """나: 숨구멍 원을 빛 기둥 한 줄이 가른다 — 원 안의 세로 틈."""
    return Point(0, 0).buffer(r, quad_segs=96).difference(box(-slit / 2, -r - 1, slit / 2, r + 1))


def two_breaths(r=52, t=19, over=26):
    """다: 들숨 · 날숨 — 두 고리가 겹치고 겹친 자리를 빛 기둥처럼 비운다(P 둘의 원 구멍과 같은 꼴)."""
    a = Point(-r + over / 2, 0).buffer(r, quad_segs=96); b = Point(r - over / 2, 0).buffer(r, quad_segs=96)
    ring_a = a.difference(Point(-r + over / 2, 0).buffer(r - t, quad_segs=96)); ring_b = b.difference(Point(r - over / 2, 0).buffer(r - t, quad_segs=96))
    return unary_union([ring_a, ring_b]).difference(a.intersection(b).buffer(-2))


def lane_arc(w=190, h=120, t=20):
    """라: 트랙 곡선 한 쌍 — 위에서 본 곡주로 두 레인을 비스듬히 자른 조각(앞으로 기운 속도감)."""
    o = stadium(w, h).difference(stadium(w - 2 * t, h - 2 * t))
    i = stadium(w - 2 * t - 22, h - 2 * t - 22).difference(stadium(w - 4 * t - 22, h - 4 * t - 22))
    keep = Polygon([(-w, h), (w * 0.1, h), (-w * 0.1, -h), (-w, -h)])
    return unary_union([o.intersection(keep), i.intersection(keep)])


SYMS = {"가 트랙 G": track_g(), "나 숨구멍+빛": pillar_pore(), "다 두 숨": two_breaths(), "라 곡주": lane_arc()}
OUT = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/로고시안")
word = WM.solid(WM.classic())
tile_w, tile_h = 520, 420
sheet = np.zeros((tile_h * 2 + 200, tile_w * 4), np.uint8)
for k, (name, g) in enumerate(SYMS.items()):
    x0, y0, x1, y1 = g.bounds
    # 큰 잠금: 심벌 위 + 글자 아래
    s1 = 150 / max(x1 - x0, y1 - y0)
    m = WM.raster(g, tile_w, tile_h, s1, tile_w / 2 - (x0 + x1) / 2 * s1, 150 + (y0 + y1) / 2 * s1)
    wx0, wy0, wx1, wy1 = word.bounds; sw = 400 / (wx1 - wx0)
    m2 = WM.raster(word, tile_w, tile_h, sw, tile_w / 2 - (wx0 + wx1) / 2 * sw, 340)
    sheet[0:tile_h, k * tile_w:(k + 1) * tile_w] = np.maximum(m, m2)
    # 심벌만 크게
    s2 = 300 / max(x1 - x0, y1 - y0)
    sheet[tile_h:tile_h * 2, k * tile_w:(k + 1) * tile_w] = WM.raster(g, tile_w, tile_h, s2, tile_w / 2 - (x0 + x1) / 2 * s2, tile_h / 2 + (y0 + y1) / 2 * s2)
    # 폰 크기(잠금 폭 60px 상당)
    s3 = 40 / max(x1 - x0, y1 - y0)
    sheet[tile_h * 2:tile_h * 2 + 200, k * tile_w:(k + 1) * tile_w] = WM.raster(g, tile_w, 200, s3, tile_w / 2 - (x0 + x1) / 2 * s3, 60 + (y0 + y1) / 2 * s3) | WM.raster(word, tile_w, 200, 150 / (wx1 - wx0), tile_w / 2 - (wx0 + wx1) / 2 * 150 / (wx1 - wx0), 118)
Image.fromarray(sheet).save(OUT / "심벌_스케치.png")
print("ok")
