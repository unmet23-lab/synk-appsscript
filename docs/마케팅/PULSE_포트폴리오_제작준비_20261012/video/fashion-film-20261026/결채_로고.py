# 4번 가상 브랜드 「결채」 로고를 글꼴이 아니라 도형으로 직접 그린다(2026-11-07, Claude) — 슬롭 점검표 22번 · 결정 11-05 「끝 로고는 치지 말고 그린다」.
# 벤치마크: 원본 MARAH 끝 화면은 깃털 · 가죽 접사 위 가운데에 대비 큰 세리프 워드마크 하나(화면 폭 약 40%, 컷 0.08초 뒤 바로 섬)와,
#   2초 뒤 천천히 떠오르는 작은 줄 하나(「inspired by nature」). 판 · 그림자 · 번짐 없이 흰 단색.
# 결: 굵은 세로획 · 머리카락처럼 가는 가로획의 명조(패션 하우스 세리프의 한글 짝). 숨긴 것 하나 — 가는 가로획의 끝을 개버딘 능직 각도(63°)로 비스듬히 자른다
#   (결채의 「결」 = 옷감의 결, 첫 컷 · 끝 화면이 같은 능직 접사다).
# 작은 줄 「GYEOLCHAE」는 같은 대비의 세리프 대문자로 그린다(따로 노는 글꼴을 쓰지 않는다) — 자간은 좁게(넓게 벌린 줄은 「초보 디자이너」, 11-05).
# 좌표는 한 글자 칸 100 기준(y 위가 +). 바로 돌리면 PNG(흰 글자 · 투명 바탕)와 미리 보기를 낸다.
#   python -X utf8 결채_로고.py [출력 폴더]
import math
import os
import sys

import numpy as np
from shapely import affinity
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

V = 10.5     # 굵은 세로획
HL = 4.4     # 가는 가로획 — 3.0은 화면 크기(글자 높이 110px)에서 ㅕ 가지가 사라졌다(첫 판)
TWILL = 63   # 능직 결 각도(°) — 가는 획 끝을 이 각도로 자른다


def hline(x0, x1, y, t=HL, cut_end=True, cut_start=False):
    """가는 가로획 — 끝(오른쪽)을 능직 각도로 비스듬히 자른다(위가 더 나간다)"""
    d = t / math.tan(math.radians(TWILL))
    xs0 = (x0 - d / 2, x0 + d / 2) if cut_start else (x0, x0)
    xe = (x1 + d / 2, x1 - d / 2) if cut_end else (x1, x1)
    return Polygon([(xs0[0], y - t / 2), (xe[1], y - t / 2), (xe[0], y + t / 2), (xs0[1], y + t / 2)])


def stem(x, y0, y1, t=V, head=True, foot_flat=True):
    """굵은 세로획 — 머리는 왼쪽 위에서 비스듬히 들어오는 부리(명조 시작), 발은 평평"""
    s = 0.0
    pts = [(x - t / 2, y0), (x + t / 2, y0), (x + t / 2, y1 - (0 if not head else t * 0.18)), (x - t / 2 + t * 0.15, y1)] if head else \
          [(x - t / 2, y0), (x + t / 2, y0), (x + t / 2, y1), (x - t / 2, y1)]
    return Polygon(pts)


def serif_bump(x, y, size=4.2):
    """가로획 끝의 맺음 — 작은 세모(명조의 꺾임)"""
    return Polygon([(x - size * 1.1, y + HL / 2), (x + 0.2, y + HL / 2), (x + 0.2, y + HL / 2 + size)])


def sweep(p0, p1, w0, w1, bend=0.0, n=28):
    """굵기가 w0 → w1로 바뀌는 획(삐침 · 파임). bend는 가운데가 옆으로 휘는 정도"""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = -uy, ux
    left, right = [], []
    for i in range(n + 1):
        s = i / n
        cx = x0 + (x1 - x0) * s + nx * bend * math.sin(math.pi * s)
        cy = y0 + (y1 - y0) * s + ny * bend * math.sin(math.pi * s)
        w = w0 + (w1 - w0) * s
        left.append((cx + nx * w / 2, cy + ny * w / 2))
        right.append((cx - nx * w / 2, cy - ny * w / 2))
    return Polygon(left + right[::-1]).buffer(0)


def vstem(cx, y0, y1, t=V, cut_foot=True):
    """곧은 굵은 세로획 — 발을 능직 각도로 비스듬히 자른다(왼쪽이 더 내려감), 머리는 평평"""
    d = t / math.tan(math.radians(TWILL)) if cut_foot else 0.0
    return Polygon([(cx - t / 2, y0 - d / 2), (cx + t / 2, y0 + d / 2), (cx + t / 2, y1), (cx - t / 2, y1)])


def diag(p0, p1, t, flat_y=None):
    """곧은 사선 획 — 굵기 t(획에 수직), 끝은 수평으로 자른다(flat_y가 주어지면 그 높이에서)"""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    nx, ny = -(y1 - y0) / L * t / 2, (x1 - x0) / L * t / 2
    ext = 30.0
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    poly = Polygon([(x0 + nx - ux * 2, y0 + ny - uy * 2), (x1 + nx + ux * ext, y1 + ny + uy * ext),
                    (x1 - nx + ux * ext, y1 - ny + uy * ext), (x0 - nx - ux * 2, y0 - ny - uy * 2)])
    if flat_y is not None:
        poly = poly.intersection(box(-1e3, flat_y, 1e3, 1e3))
    return poly


def gyeol(x):
    """결 — ㄱ(왼 위) · ㅕ(오른 위) · ㄹ 받침(아래). 곧은 굵은 세로 · 가는 가로(모던 하이 컨트라스트)"""
    g = [
        hline(x + 8, x + 47, 88, cut_end=False, cut_start=True),   # ㄱ 가로 — 왼 끝 능직, 오른 끝은 내림이 받는다
        vstem(x + 42.5, 56, 88 + HL / 2),                       # ㄱ 내림 — 곧은 굵은 기둥
        vstem(x + 78, 49, 100),                                 # ㅕ 기둥
        hline(x + 57, x + 78 - V / 2 + 0.6, 86, cut_end=False, cut_start=True),   # ㅕ 가지 둘 — 기둥에서 왼쪽으로, 왼 끝을 능직으로
        hline(x + 57, x + 78 - V / 2 + 0.6, 67, cut_end=False, cut_start=True),
        # ㄹ 받침 — 가로 셋 · 세로 둘
        hline(x + 18, x + 82 + V / 2 - 0.6, 42, cut_end=False, cut_start=True),
        vstem(x + 82, 25 - HL / 2, 42 + HL / 2, cut_foot=False),
        hline(x + 24 - V / 2 + 0.6, x + 82 + V / 2 - 0.6, 25, cut_end=False, cut_start=False),
        vstem(x + 24, 8 - HL / 2, 25 + HL / 2, cut_foot=False),
        hline(x + 24 - V / 2 + 0.6, x + 88, 8, cut_end=True),
    ]
    return unary_union(g)


def chae(x):
    """채 — ㅊ(왼) · ㅐ(오른). ㅅ은 굵은 왼 사선 + 가는 오른 사선, 오른 획은 왼 사선의 가운데(50%)에서 갈라진다
    — 가로 바로 밑에서 갈라지면 「大」로 읽혔다(첫 판)"""
    top, foot = (x + 34.5, 86), (x + 9, 21)
    k = 0.50
    split = (top[0] + (foot[0] - top[0]) * k, top[1] + (foot[1] - top[1]) * k)
    g = [
        vstem(x + 33.5, 92, 100, t=V * 0.9),                    # ㅊ 꼭지 — 짧은 굵은 세로(발은 능직)
        hline(x + 9, x + 58, 86, cut_end=True, cut_start=True),  # ㅊ 가로
        diag(top, foot, V, flat_y=foot[1]),                     # ㅅ 왼 — 굵은 사선
        diag(split, (x + 58, 21), HL * 1.15, flat_y=21),         # ㅅ 오른 — 가는 사선
        vstem(x + 72, 17, 94),                                  # ㅐ 앞 기둥
        hline(x + 72 + V / 2 - 0.6, x + 92 - V / 2 + 0.6, 56, cut_end=False),    # ㅐ 가지 — 두 기둥을 잇는다
        vstem(x + 92, 0, 100),                                  # ㅐ 뒤 기둥(가장 길게)
    ]
    return unary_union(g).intersection(box(x - 5, foot[1] - 0.01 if False else -10, x + 110, 110))


# ---------- 작은 줄 — 같은 대비의 세리프 대문자(대문자 높이 100)
def _ring(cx, cy, rx, ry, thick_x, thin_y, n=96):
    """대비 있는 고리(O · C · G) — 바깥 타원에서 안쪽 타원(옆은 굵고 위아래는 가늘게)을 뺀다"""
    outer = Polygon([(cx + rx * math.cos(a), cy + ry * math.sin(a)) for a in np.linspace(0, 2 * math.pi, n)])
    inner = Polygon([(cx + (rx - thick_x) * math.cos(a), cy + (ry - thin_y) * math.sin(a)) for a in np.linspace(0, 2 * math.pi, n)])
    return outer.difference(inner)


def latin(ch, T=17.0, t=5.0):
    """세리프 대문자 하나(폭 반환). T 굵은 획, t 가는 획 · 세리프"""
    def bar(x0, x1, y):
        return box(x0, y - t / 2, x1, y + t / 2)

    def serifs(x, w=24):
        return unary_union([box(x - w / 2, 0, x + w / 2, t), box(x - w / 2, 100 - t, x + w / 2, 100)])
    if ch == "G":
        r = _ring(46, 50, 44, 50, T, t).difference(box(70, 56, 100, 80))
        g = unary_union([r, box(74, 8, 74 + T * 0.8, 46), bar(56, 92, 46)])
        return g, 96
    if ch == "Y":
        g = unary_union([sweep((8, 100), (40, 48), T, T), sweep((80, 100), (44, 48), t, t), box(42 - T / 2, 0, 42 + T / 2, 50),
                         box(26, 0, 58, t), box(-2, 100 - t, 22, 100), box(68, 100 - t, 92, 100)])
        return g, 88
    if ch == "E":
        g = unary_union([box(8, 0, 8 + T, 100), bar(8, 72, t / 2), bar(8, 70, 100 - t / 2), bar(8, 58, 50), box(0, 0, 8, t), box(0, 100 - t, 8, 100),
                         box(70 - t, 0, 72, 22), box(68 - t, 78, 70, 100), box(56 - t, 40, 58, 60)])
        return g, 76
    if ch == "O":
        return _ring(48, 50, 46, 50, T, t), 96
    if ch == "L":
        g = unary_union([box(8, 0, 8 + T, 100), bar(8, 68, t / 2), box(0, 100 - t, 32, 100), box(0, 0, 8, t), box(66 - t, 0, 68, 24)])
        return g, 72
    if ch == "C":
        r = _ring(48, 50, 46, 50, T, t).difference(box(66, 28, 100, 72))
        g = unary_union([r, box(86 - t, 62, 86, 92), box(86 - t, 8, 86, 38)])
        return g, 90
    if ch == "H":
        g = unary_union([box(8, 0, 8 + T, 100), box(68, 0, 68 + T, 100), bar(8, 68 + T, 50), serifs(8 + T / 2), serifs(68 + T / 2)])
        return g, 94
    if ch == "A":
        g = unary_union([sweep((2, 0), (42, 100), t, t), sweep((80, 0), (44, 100), T, T), bar(18, 66, 30), box(-6, 0, 16, t), box(66, 0, 92, t)])
        return g, 86
    raise ValueError(ch)


def latin_line(text, track=10.0):
    out, x = [], 0.0
    for ch in text:
        g, w = latin(ch)
        out.append(affinity.translate(g, x, 0))
        x += w + track
    return unary_union(out), x - track


def wordmark():
    """결 · 채 두 글자와 작은 줄을 돌려준다(글자 칸 100 단위, y 위가 +)"""
    word = unary_union([gyeol(0), chae(97)])   # 104는 두 글자가 따로 놀았다(11-07 Fable 「결 · 채 간격이 넓다」)
    return word


def raster(geom, height_px, pad=6):
    """흰 RGBA(높이 height_px의 칸 100) — 4배로 그려 줄인다(가장자리 부드럽게)"""
    import cv2
    minx, miny, maxx, maxy = geom.bounds
    s = height_px / 100.0 * 4
    W, H = int((maxx - minx) * s) + 8 * pad, int((maxy - miny) * s) + 8 * pad
    img = np.zeros((H, W), np.uint8)
    geoms = getattr(geom, "geoms", [geom])
    for g in geoms:
        ext = np.array([((x - minx) * s + 4 * pad, (maxy - y) * s + 4 * pad) for x, y in g.exterior.coords], np.int32)
        cv2.fillPoly(img, [ext], 255, lineType=cv2.LINE_AA)
        for hole in g.interiors:
            h = np.array([((x - minx) * s + 4 * pad, (maxy - y) * s + 4 * pad) for x, y in hole.coords], np.int32)
            cv2.fillPoly(img, [h], 0, lineType=cv2.LINE_AA)
    a = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    rgba = np.zeros((a.shape[0], a.shape[1], 4), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = a
    return rgba


def render(word_h, line_h=None):
    """끝 화면용: (결채 RGBA, 작은 줄 RGBA 또는 None, 두 줄 사이 px)"""
    word = raster(wordmark(), word_h)
    small = None
    if line_h:
        geom, _ = latin_line("GYEOLCHAE")
        small = raster(geom, line_h)
    return word, small, int(round(word_h * 0.42))


def main():
    from PIL import Image
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "_로고")
    os.makedirs(out, exist_ok=True)
    w, s, gap = render(240, 30)
    Image.fromarray(w).save(os.path.join(out, "결채_흰.png"))
    Image.fromarray(s).save(os.path.join(out, "GYEOLCHAE_흰.png"))
    # 미리 보기 — 검은 바탕
    W = max(w.shape[1], s.shape[1]) + 200
    H = w.shape[0] + gap + s.shape[0] + 200
    bg = np.zeros((H, W, 3), np.float32)
    def put(img, x, y):
        a = img[..., 3:4] / 255.0
        bg[y:y + img.shape[0], x:x + img.shape[1]] = bg[y:y + img.shape[0], x:x + img.shape[1]] * (1 - a) + img[..., :3] * a
    put(w, (W - w.shape[1]) // 2, 100)
    put(s, (W - s.shape[1]) // 2, 100 + w.shape[0] + gap)
    Image.fromarray(bg.astype(np.uint8)).save(os.path.join(out, "미리보기.png"))
    print(out, w.shape, s.shape)


if __name__ == "__main__":
    main()
