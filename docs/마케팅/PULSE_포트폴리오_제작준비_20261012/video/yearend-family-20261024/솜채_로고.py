# 6번 가상 브랜드 「솜채」 로고를 글꼴이 아니라 도형으로 직접 그린다(2026-11-07, Claude) — 슬롭 점검표 22번 · 결정 11-05 「끝 로고는 치지 말고 그린다」.
# 벤치마크: 원본 끝 화면은 문틈 장면 왼쪽 벽에 흰 단색 워드마크 하나(화면 폭 약 14%)와 작은 줄 하나 — 판 없이 장면에 붙는다. 우리도 같은 자리 · 크기.
# 결: 솜(cotton)처럼 획 끝이 둥근 고른 두께의 기하 한글. 숨긴 것 하나 — ㅊ의 꼭지를 작은 솜뭉치(동그라미)로. 작은 줄 「침구」도 같은 획으로 그린다(따로 노는 글꼴을 쓰지 않는다).
# 좌표는 한 글자 칸 100 기준(y 위가 +). 이 파일을 바로 돌리면 PNG(흰 글자 · 투명 바탕)와 미리 보기를 낸다.
#   python -X utf8 솜채_로고.py [출력 폴더]
import os
import sys

import numpy as np
from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union

T = 7.5   # 획 두께 — 11은 기본 둥근 글꼴처럼 무거웠다(첫 판)


def stroke(*pts, t=T):
    return LineString(pts).buffer(t / 2, cap_style="round", join_style="round", quad_segs=24)


def ring(x0, y0, x1, y1, r, t=T):
    # 둥근 네모 띠 — 획 가운데 선이 이 네모를 지나도록
    mid = box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=24)
    return mid.buffer(t / 2, quad_segs=24).difference(mid.buffer(-t / 2, quad_segs=24))


def along(a, b, k):
    return (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)


def siot(top, left, right_end, k=0.38, t=T):
    """ㅅ — 오른 획이 왼 획 중간(k)에서 갈라진다(한글 조판의 ㅅ). 두 획이 한 점에서 벌어지면 「^」 · 막대 사람처럼 읽힌다(첫 판)"""
    return unary_union([stroke(top, left, t=t), stroke(along(top, left, k), right_end, t=t)])


def pillow(x0, y0, x1, y1, pinch, t=T, n=24):
    """베개 꼴 ㅁ — 네 변이 가운데로 조금 들어가고(솜이 찬 베개) 모서리는 살짝 뾰족하다. 둥근 네모 ㅁ은 맹검 둘이 「기본 고딕」으로 읽었다(11-07 Gemini · Fable)"""
    A, B, Cc, D = (x0, y0), (x1, y0), (x1, y1), (x0, y1)
    sides = [(A, B, (0, 1)), (B, Cc, (-1, 0)), (Cc, D, (0, -1)), (D, A, (1, 0))]
    pts = []
    for P, Q, nv in sides:
        for i in range(n):
            s = i / n
            k = pinch * np.sin(np.pi * s)
            pts.append((P[0] + (Q[0] - P[0]) * s + nv[0] * k, P[1] + (Q[1] - P[1]) * s + nv[1] * k))
    pts.append(pts[0])
    return LineString(pts).buffer(t / 2, cap_style="round", join_style="round", quad_segs=24)


def som(x):
    """솜 — 이름 뜻(솜 + 채 = 솜으로 지은 집 한 채)을 숨긴다: ㅅ은 낮은 지붕, ㅗ 가로는 처마, 받침 ㅁ은 솜이 찬 베개 — 「솜」 한 글자가 지붕 밑 베개로 읽힌다.
    지붕 ㅅ은 두 획이 한 점에서 벌어지는 대칭 꼴이다(집 꼴). 채의 ㅊ은 조판 그대로(갈라지는 ㅅ) — 둘 다 대칭이면 막대 사람처럼 읽혔다(첫 판)"""
    g = [
        stroke((x + 22, 76), (x + 50, 97), (x + 78, 76)),   # 지붕 ㅅ
        stroke((x + 50, 70), (x + 50, 59)),          # ㅗ 기둥
        stroke((x + 16, 55), (x + 84, 55)),          # ㅗ 가로 = 처마
        pillow(x + 25, 3, x + 75, 42, 4.6),          # ㅁ 받침 = 베개
    ]
    return unary_union(g)


# ---------- 작은 줄 — 로마자 「SOMCHAE」를 같은 둥근 획으로(원본 끝 로고처럼 두 단 BI · 11-07 Fable 「원본은 2단 BI라 브랜드로 읽힌다」)
def _arc(cx, cy, r, a0, a1, n=40):
    return [(cx + r * np.cos(np.radians(a)), cy + r * np.sin(np.radians(a))) for a in np.linspace(a0, a1, n)]


def latin(text, t=12.0):
    """대문자 높이 100. 글자 폭 · 획을 돌려준다(자간은 부르는 쪽이)."""
    glyphs = []
    for ch in text:
        if ch == "S":
            top = _arc(27, 73, 23, 20, 270)
            bot = _arc(27, 27, 23, 90, -160)
            g, w = LineString(top + bot).buffer(t / 2, cap_style="round", join_style="round"), 54
        elif ch == "O":
            g, w = LineString(_arc(48, 50, 46, 0, 360, 80)).buffer(t / 2, cap_style="round"), 96
        elif ch == "M":
            g, w = stroke((4, 2), (4, 98), (40, 30), (76, 98), (76, 2), t=t), 80
        elif ch == "C":
            g, w = LineString(_arc(48, 50, 46, 40, 320)).buffer(t / 2, cap_style="round"), 90
        elif ch == "H":
            g, w = unary_union([stroke((4, 2), (4, 98), t=t), stroke((62, 2), (62, 98), t=t), stroke((4, 50), (62, 50), t=t)]), 66
        elif ch == "A":
            g, w = unary_union([stroke((2, 2), (36, 98), (70, 2), t=t), stroke((15, 36), (57, 36), t=t)]), 72
        elif ch == "E":
            g, w = unary_union([stroke((54, 98), (4, 98), (4, 2), (54, 2), t=t), stroke((4, 50), (46, 50), t=t)]), 56
        else:
            raise ValueError(ch)
        glyphs.append((g, w))
    return glyphs


def latin_line(text, width, t=12.0):
    """글자를 width(대문자 높이 100 단위)에 양끝 맞춤으로 벌린다."""
    gl = latin(text, t)
    total = sum(w for _, w in gl)
    track = (width - total) / max(1, len(gl) - 1)
    out, x = [], 0.0
    from shapely import affinity
    for g, w in gl:
        out.append(affinity.translate(g, x, 0))
        x += w + track
    return unary_union(out)


def latin_tracked(text, track=22.0, t=12.0):
    """글자 사이를 정해진 만큼만(대문자 높이 100 단위 — 22는 약 0.15em) 띄운다. 양끝 맞춤으로 넓게 벌린 줄은
    「넓게 벌린 글꼴 = 초보 디자이너」(11-05 유호님, 슬롭 점검표 22번)로 읽혀 11-07 Fable 둘째 판이 줄이라고 했다."""
    from shapely import affinity
    out, x = [], 0.0
    for g, w in latin(text, t):
        out.append(affinity.translate(g, x, 0))
        x += w + track
    return unary_union(out)


def chae(x):
    """채 — ㅊ(왼) · ㅐ(오른)"""
    g = [
        stroke((x + 30, 99), (x + 30, 89)),          # ㅊ 꼭지 — 짧은 세로획
        stroke((x + 9, 84), (x + 51, 84)),           # ㅊ 가로
        siot((x + 30, 84), (x + 7, 24), (x + 52, 26), 0.42),
        stroke((x + 69, 93), (x + 69, 12)),          # ㅐ 앞 기둥
        stroke((x + 69, 55), (x + 80, 55)),          # ㅐ 가운데 가지
        stroke((x + 89, 100), (x + 89, 1)),          # ㅐ 뒤 기둥(가장 길게)
    ]
    return unary_union(g)


def chim(x, t):
    g = [stroke((x + 27, 99), (x + 27, 90), t=t), stroke((x + 8, 85), (x + 46, 85), t=t), siot((x + 27, 85), (x + 7, 44), (x + 47, 46), 0.42, t=t),
         stroke((x + 70, 97), (x + 70, 42), t=t), ring(x + 18, 3, x + 76, 31, 6, t=t)]
    return unary_union(g)


def gu(x, t):
    g = [stroke((x + 20, 88), (x + 78, 88), (x + 78, 64), t=t), stroke((x + 10, 46), (x + 90, 46), t=t), stroke((x + 50, 46), (x + 50, 6), t=t)]
    return unary_union(g)


def wordmark():
    return unary_union([som(0), chae(104)])


# ---------- 표장 — 누빔 한 장(11-07 Gemini 심사 「로고가 일반 기본 서체 레이어로 얹혀 있다」 → 글자만으로는 BI로 안 읽혀 표장을 붙인다)
# 둥근 네모 이불 한 장 + 제품의 잔 마름모 누빔을 바늘땀(끊어진 선)으로. 땀은 대각선 두 방향, 간격 25.
def emblem_frame(t=6.8):   # 글자 획(7.5 / 글자 높이 107)과 화면에서 같은 굵기가 되게 — 5.2는 테두리만 가늘어 따로 놀았다
    return ring(0, 0, 100, 100, 24, t=t)


def _dashed(a, b, dash=5.0, gap=3.8, t=2.9):
    L = LineString([a, b])
    n = L.length
    out, s = [], 2.0
    while s < n - 1:
        e = min(s + dash, n - 1)
        p0, p1 = L.interpolate(s), L.interpolate(e)
        out.append(stroke((p0.x, p0.y), (p1.x, p1.y), t=t))
        s = e + gap
    return unary_union(out)


def emblem_stitch():
    # 잔 마름모 누빔 한 칸 — 가운데 마름모를 바늘땀으로. 다섯 줄 격자는 철망, 세 줄은 엇갈림마다 「+」,
    # 격자에서 오려 낸 마름모는 꼭짓점 둘레에 땀 조각이 점처럼 남았다(1~3판) → 네 변을 꼭짓점에서 꼭짓점까지, 꼭짓점 앞뒤 3씩 비운다
    v = [(50, 84), (84, 50), (50, 16), (16, 50)]
    out = []
    for k in range(4):
        a, b = v[k], v[(k + 1) % 4]
        L = LineString([a, b])
        n = L.length
        p0, p1 = L.interpolate(3.0), L.interpolate(n - 3.0)
        out.append(_dashed((p0.x, p0.y), (p1.x, p1.y), dash=6.2, gap=4.0))
    return unary_union(out)


def render_lockup(height_px, sub_ratio=0.17, gap_ratio=0.24):
    """두 단 로고 — 위 「솜채」(높이 height_px) · 아래 「SOMCHAE」(대문자 높이 = 글자 높이 × sub_ratio, 약 0.15em만 띄워 왼쪽 맞춤).
    겹 둘(글자 · 작은 줄)을 같은 캔버스로 돌려준다 — 끝 화면에서 따로 움직인다."""
    wm = wordmark()
    x0, y0, x1, y1 = wm.bounds
    sx = height_px / (y1 - y0)
    wpx = (x1 - x0) * sx
    cap = height_px * sub_ratio
    s2 = cap / 100.0
    sl = latin_tracked("SOMCHAE")   # 옛 판은 워드마크 폭에 양끝 맞춤(latin_line) — 「S O M C H A E」로 넓게 벌어졌다
    b = sl.bounds
    pad = int(height_px * 0.12)
    gap = height_px * gap_ratio
    W = int(wpx + 2 * pad)
    H = int(height_px + gap + cap + 2 * pad)
    word = raster(wm, W, H, sx, pad - x0 * sx, pad + y1 * sx)
    sub = raster(sl, W, H, s2, pad - b[0] * s2 + 1, pad + height_px + gap + b[3] * s2)

    def rgba(a):
        im = np.zeros((H, W, 4), np.uint8)
        im[..., :3] = 248
        im[..., 3] = a
        return im
    return rgba(word), rgba(sub)


def render_layers(height_px):
    """끝 화면 겹 셋을 같은 캔버스에 — 표장 테두리 · 표장 바늘땀 · 글자(솜채). 표장 높이 = 글자 높이, 사이 = 글자 높이의 0.42"""
    wm = wordmark()
    x0, y0, x1, y1 = wm.bounds
    sx = height_px / (y1 - y0)
    es = height_px / 100.0 * 0.92
    gap = height_px * 0.42
    pad = int(height_px * 0.12)
    W = int(pad + 100 * es + gap + (x1 - x0) * sx + pad)
    H = int(height_px + 2 * pad)
    ey = pad + (height_px - 100 * es) / 2
    frame = raster(emblem_frame(), W, H, es, pad, ey + 100 * es)
    stitch = raster(emblem_stitch(), W, H, es, pad, ey + 100 * es)
    word = raster(wm, W, H, sx, pad + 100 * es + gap - x0 * sx, pad + y1 * sx)
    def rgba(a):
        im = np.zeros((H, W, 4), np.uint8)
        im[..., :3] = 248
        im[..., 3] = a
        return im
    return rgba(frame), rgba(stitch), rgba(word)


def subline(t=8.5):
    return unary_union([chim(0, t), gu(102, t)])


def raster(geom, W, H, sx, ox, oy, ss=4):
    import cv2
    m = np.zeros((H * ss, W * ss), np.uint8)
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)

    def pts(r):
        return np.array([[(ox + x * sx) * ss, (oy - y * sx) * ss] for x, y in r.coords], np.float64).round().astype(np.int32)
    for p in polys:
        cv2.fillPoly(m, [pts(p.exterior)], 255, lineType=cv2.LINE_8)
    for p in polys:
        for it in p.interiors:
            cv2.fillPoly(m, [pts(it)], 0, lineType=cv2.LINE_8)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)


def render(width_px, sub=True):
    """흰 글자 · 투명 바탕 RGBA. 워드마크 폭 = width_px, 작은 줄은 그 아래(워드마크 높이의 28%, 왼쪽 맞춤)"""
    wm = wordmark()
    x0, y0, x1, y1 = wm.bounds
    sx = width_px / (x1 - x0)
    pad = int(width_px * 0.06)
    hm = (y1 - y0) * sx
    sl = subline()
    sx2 = sx * 0.26
    gap = hm * 0.30
    sb = sl.bounds
    hs = (sb[3] - sb[1]) * sx2 if sub else 0
    W, H = int(width_px + 2 * pad), int(hm + (gap + hs if sub else 0) + 2 * pad)
    a = raster(wm, W, H, sx, pad - x0 * sx, pad + y1 * sx)
    if sub:
        a = np.maximum(a, raster(sl, W, H, sx2, pad - sb[0] * sx2 + width_px * 0.005, pad + hm + gap + sb[3] * sx2))
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = 248
    rgba[..., 3] = a
    return rgba


if __name__ == "__main__":
    from PIL import Image
    out = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/p6"
    os.makedirs(out, exist_ok=True)
    Image.fromarray(render(900)).save(os.path.join(out, "somchae.png"))
    Image.fromarray(render(900, sub=False)).save(os.path.join(out, "somchae_mark.png"))
    wd, sb = render_lockup(300)
    for name, im in (("lock_word", wd), ("lock_sub", sb)):
        Image.fromarray(im).save(os.path.join(out, f"{name}.png"))
    al = np.maximum(wd[..., 3], sb[..., 3])[..., None] / 255.0
    bg = np.zeros((wd.shape[0], wd.shape[1], 3), np.uint8) + 40
    Image.fromarray((bg * (1 - al) + 248 * al).astype(np.uint8)).save(os.path.join(out, "_lock_미리보기.png"))
    print(out, wd.shape)
