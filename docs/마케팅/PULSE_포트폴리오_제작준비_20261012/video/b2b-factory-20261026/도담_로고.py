# 10번 가상 제조사 「도담중공업」 끝 로고를 글꼴이 아니라 도형으로 직접 그린다(2026-11-07, Claude) — 슬롭 점검표 22번 · 결정 11-05 「끝 로고는 치지 말고 그린다」.
# 벤치마크: 원본 끝 화면은 노을 하늘 가운데 흰 단색 원 표식(58.1초 작게 → 커짐) → 표식이 왼쪽으로 비키며 이름이 드러남(58.96초) — 판 없이 하늘에 붙고, 묶음 폭은 화면의 약 37%.
# 표식: 터빈 흡입구의 둥근 고리를 두 토막으로 — 토막 끝을 날개 끝처럼 비스듬히 잘라 도는 결을 주고, 가운데 작은 점(원뿔 · 키워 보낸 아이)을 둔다.
#   두 토막은 도담의 두 「ㄷ」이 감싸 안은 꼴이기도 하다(도담도담 = 아이가 탈 없이 잘 자라는 모양, 02_콘티 1절).
# 글자: 고른 두께 · 평평한 획 끝 · 곧은 각의 기하 한글(중공업다운 단단함), ㅇ은 표식과 같은 원. 좌표는 한 글자 칸 100 기준(y 위가 +).
#   python -X utf8 도담_로고.py [출력 폴더]   → mark.png · name.png(흰 단색 · 투명) · _미리보기.png
import os
import sys

import numpy as np
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

T = 10.0   # 획 두께(글자 칸 100 기준) — 9는 기본 고딕처럼 가벼웠다
SLANT = np.tan(np.radians(35.0)) * T   # 가로획의 열린 끝을 표식의 틈과 같은 35°로 비스듬히 자른다(날개 끝) — 이 글자만의 결


def bar(*pts, t=T):
    """평평한 끝 · 곧은 모서리 획"""
    return LineString(pts).buffer(t / 2, cap_style="flat", join_style="mitre", mitre_limit=3)


def hbar(xa, xb, y, left=True, right=True, t=T):
    """가로획 — 열린 끝(left/right=True)만 「/」 꼴로 비스듬히, 다른 획과 붙는 끝은 곧게"""
    d = SLANT * t / T
    return Polygon([(xa + (d if left else 0), y + t / 2), (xb, y + t / 2), (xb - (d if right else 0), y - t / 2), (xa, y - t / 2)])


def ring(cx, cy, r, t=T):
    return Point(cx, cy).buffer(r + t / 2, quad_segs=48).difference(Point(cx, cy).buffer(r - t / 2, quad_segs=48))


# ---------- 글자(칸 100 × 100, 가로 획은 위아래로 t/2 두께)
def do(x):
    return unary_union([
        hbar(x + 14, x + 84, 90, left=False), bar((x + 14 + T / 2, 90 + T / 2), (x + 14 + T / 2, 56 - T / 2)), hbar(x + 14, x + 86, 56, left=False),   # ㄷ
        bar((x + 50, 56), (x + 50, 24)),                                      # ㅗ 기둥
        hbar(x + 4, x + 96, 20),                                              # ㅗ 가로
    ])


def dam(x):
    return unary_union([
        hbar(x + 6, x + 50, 90, left=False), bar((x + 6 + T / 2, 90 + T / 2), (x + 6 + T / 2, 57 - T / 2)), hbar(x + 6, x + 52, 57, left=False),   # ㄷ
        bar((x + 74, 98), (x + 74, 47)), hbar(x + 74, x + 92, 74, left=False),                                             # ㅏ
        box(x + 14, 2, x + 86, 38).difference(box(x + 14 + T, 2 + T, x + 86 - T, 38 - T)),                                # ㅁ
    ])


def jung(x):
    return unary_union([
        hbar(x + 20, x + 80, 92),                                             # ㅈ 가로
        bar((x + 50, 92), (x + 22, 66)), bar((x + 50, 92), (x + 78, 66)),     # ㅈ 아래 ㅅ
        hbar(x + 4, x + 96, 54), bar((x + 50, 54), (x + 50, 40)),             # ㅜ
        ring(x + 50, 20, 15),                                                 # ㅇ
    ])


def gong(x):
    return unary_union([
        hbar(x + 16, x + 80, 92, right=False), bar((x + 80 - T / 2, 92 + T / 2), (x + 80 - T / 2, 66)),   # ㄱ
        bar((x + 50, 66), (x + 50, 54)), hbar(x + 4, x + 96, 50),                                         # ㅗ
        ring(x + 50, 20, 15),                                                               # ㅇ
    ])


def eop(x):
    return unary_union([
        ring(x + 30, 73, 17),                                                 # ㅇ
        bar((x + 80, 98), (x + 80, 47)), hbar(x + 60, x + 80, 73, right=False),   # ㅓ
        bar((x + 16 + T / 2, 40), (x + 16 + T / 2, 2)), bar((x + 84 - T / 2, 40), (x + 84 - T / 2, 2)),   # ㅂ 기둥
        bar((x + 16, 22), (x + 84, 22)), bar((x + 16, 2 + T / 2), (x + 84, 2 + T / 2)),                   # ㅂ 가로
    ])


def wordmark(gap=10.0):
    gs, x = [], 0.0
    for f in (do, dam, jung, gong, eop):
        gs.append(f(x))
        x += 100 + gap
    return unary_union(gs)


# ---------- 표식(칸 100): 두 토막 고리 + 가운데 점
def mark(t=11.0):
    r = 40.0
    g = ring(50, 50, r, t)
    # 날개 끝처럼 비스듬한 틈 둘(서로 반대편, 반지름에서 35° 기운 띠)
    for ang in (35.0, 215.0):
        cut = box(-3.4, -60, 3.4, 60)                    # 틈 폭 6.8
        cut = affinity.rotate(cut, 35.0, origin=(0, 0))   # 반지름 방향에서 비스듬히
        cut = affinity.translate(cut, 0, 0)
        a = np.radians(ang)
        cut = affinity.rotate(cut, ang - 90.0, origin=(0, 0))
        cut = affinity.translate(cut, 50 + r * np.cos(a), 50 + r * np.sin(a))
        g = g.difference(cut.intersection(Point(50 + r * np.cos(a), 50 + r * np.sin(a)).buffer(t * 1.6)))
    core = Point(50, 50).buffer(10.5, quad_segs=32)
    return unary_union([g, core])


def raster(geom, W, H, sx, ox, oy, ss=4):
    import cv2
    m = np.zeros((H * ss, W * ss), np.uint8)
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)

    def pts(rr):
        return np.array([[(ox + x * sx) * ss, (oy - y * sx) * ss] for x, y in rr.coords], np.float64).round().astype(np.int32)
    for p in polys:
        cv2.fillPoly(m, [pts(p.exterior)], 255, lineType=cv2.LINE_8)
    for p in polys:
        for it in p.interiors:
            cv2.fillPoly(m, [pts(it)], 0, lineType=cv2.LINE_8)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)


def rgba(a, c=248):
    im = np.zeros(a.shape + (4,), np.uint8)
    im[..., :3] = c
    im[..., 3] = a
    return im


def render(name_h):
    """글자 높이 name_h(px) 기준으로 표식 · 이름을 따로 그린다. 표식 지름 = 글자 높이 × 1.32, 사이 = 글자 높이 × 0.55(원본 묶음 비례)."""
    wm = wordmark()
    x0, y0, x1, y1 = wm.bounds
    s = name_h / (y1 - y0)
    pad = int(name_h * 0.1)
    Wn, Hn = int((x1 - x0) * s + 2 * pad), int(name_h + 2 * pad)
    name = raster(wm, Wn, Hn, s, pad - x0 * s, pad + y1 * s)
    mk = mark()
    mx0, my0, mx1, my1 = mk.bounds
    md = name_h * 1.32
    sm = md / (my1 - my0)
    Wm = Hm = int(md + 2 * pad)
    mimg = raster(mk, Wm, Hm, sm, pad - mx0 * sm, pad + my1 * sm)
    return rgba(mimg), rgba(name), name_h * 0.55


if __name__ == "__main__":
    from PIL import Image
    out = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10/로고"
    os.makedirs(out, exist_ok=True)
    m, n, gap = render(120)
    Image.fromarray(m).save(os.path.join(out, "mark.png"))
    Image.fromarray(n).save(os.path.join(out, "name.png"))
    W = m.shape[1] + int(gap) + n.shape[1] + 80
    H = max(m.shape[0], n.shape[0]) + 80
    bg = np.zeros((H, W, 3), np.float32) + np.array([60, 72, 96], np.float32)
    def put(img, x, y):
        a = img[..., 3:4] / 255.0
        h, w = img.shape[:2]
        bg[y:y + h, x:x + w] = bg[y:y + h, x:x + w] * (1 - a) + img[..., :3] * a
    put(m, 40, (H - m.shape[0]) // 2)
    put(n, 40 + m.shape[1] + int(gap), (H - n.shape[0]) // 2)
    Image.fromarray(bg.astype(np.uint8)).save(os.path.join(out, "_미리보기.png"))
    print(out, m.shape, n.shape)
