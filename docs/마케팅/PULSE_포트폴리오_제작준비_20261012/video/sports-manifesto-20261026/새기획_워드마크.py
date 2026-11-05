# 5번 새 기획(11-05 밤) 브랜드 글자를 글꼴이 아니라 도형으로 직접 그린다 — 유호님 「CG로 깔끔하게 타이포그래피로 … 너무 AI 슬롭티나고 정말 초보 디자이너가 디자인한 느낌」.
# 벤치마크(git 밖 레퍼런스/p5_새기획_20261105/끝화면_벤치마크/): 실제 브랜드는 그린 마크 · 워드마크 하나로 닫고, 글꼴을 넓게 벌려 석 줄로 쌓지 않는다.
# 두 골격:
#   lower() — 소문자 무거운 기하형 「gappeum」. g a p p 넷의 둥근 구멍이 곧 신발 니트의 숨구멍 — 구멍 크기(breath 0~1)를 움직일 수 있게 구멍을 따로 돌려준다.
#   upper() — 세로로 긴 대문자 「GAPPEUM」. 포스터처럼 화면 폭을 채워 장면 뒤에 세운다.
# 좌표는 글자 높이 100 기준(y 위가 +). 다른 스크립트가 import해 그린다. 이 파일을 바로 돌리면 미리 보기 그림을 낸다.
import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity


def circle(cx, cy, r):
    return Point(cx, cy).buffer(r, quad_segs=96)


def rbox(x0, y0, x1, y1, r):
    return box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=48)


# ---------- 소문자 ----------
X, R, S = 100.0, 52.0, 29.0     # 글자 높이 · 둥근 반지름(위아래 2 넘침) · 줄기 두께
HOLE = R - S * 0.97             # 숨구멍 반지름
DESC = -58.0                    # 내림 끝


def _bowl(cx):
    return circle(cx, X / 2, R), Point(cx, X / 2)


def lower(gap=7.0):
    """글자마다 (몸, 구멍 목록[(cx, cy, r)])을 돌려준다 — 구멍은 몸에서 아직 빼지 않았다. 글자 사이는 gap."""
    out, x = [], 0.0
    W = 2 * R
    # g: 둥근 몸 + 오른 줄기 + 아래로 감기는 고리
    body, c = _bowl(x + R)
    stem = box(x + W - S, -6, x + W, X)
    Rh = 46.0; cx2, cy2 = x + W - Rh, DESC + Rh
    hook = circle(cx2, cy2, Rh).difference(circle(cx2, cy2, Rh - S)).intersection(box(x, DESC - 2, x + W, cy2))
    stem2 = box(x + W - S, cy2, x + W, 4)
    out.append(("g", unary_union([body, stem, stem2, hook]), [(x + R, X / 2, HOLE)])); x += W + gap
    # a: 둥근 몸 + 오른 줄기
    body, c = _bowl(x + R)
    out.append(("a", unary_union([body, box(x + W - S, 0, x + W, X)]), [(x + R, X / 2, HOLE)])); x += W + gap + 2
    # p p: 왼 줄기(내림) + 둥근 몸
    for _ in range(2):
        body, c = _bowl(x + R)
        out.append(("p", unary_union([body, box(x, DESC, x + S, X)]), [(x + R, X / 2, HOLE)])); x += W + gap
    # e: 둥근 몸 + 가로대, 오른 아래를 연다
    cx = x + R; body = circle(cx, X / 2, R)
    bar = S * 0.62
    ring = body.difference(circle(cx, X / 2, HOLE))
    far = R * 2
    a0, a1 = np.radians(0), np.radians(-44)
    wedge = Polygon([(cx, X / 2 - bar / 2), (cx + far * np.cos(a0), X / 2 - bar / 2 + far * np.sin(a0)), (cx + far * np.cos(a1), X / 2 + far * np.sin(a1))])
    ring = ring.difference(wedge)
    barshape = box(cx - HOLE - 1, X / 2 - bar / 2, cx + R, X / 2 + bar / 2).intersection(body)
    out.append(("e", unary_union([ring, barshape]), [])); x += W + gap + 2
    # u: 두 줄기 + 아래 반원, 오른 줄기는 끝까지
    w = 2 * S + 42.0; ra = w / 2
    cu = (x + ra, ra - 2)
    arc = circle(*cu, ra).difference(circle(*cu, ra - S)).intersection(box(x, -4, x + w, cu[1]))
    out.append(("u", unary_union([arc, box(x, cu[1], x + S, X), box(x + w - S, 0, x + w, X)]), [])); x += w + gap + 5
    # m: 줄기 셋 + 아치 둘
    aw = 2 * S + 40.0; ra = aw / 2
    pts = []
    for k in range(2):
        cm = (x + k * (aw - S) + ra, X + 2 - ra)
        pts.append(circle(*cm, ra).difference(circle(*cm, ra - S)).intersection(box(x + k * (aw - S), cm[1], x + k * (aw - S) + aw, X + 4)))
        pts.append(box(x + (k + 1) * (aw - S), 0, x + (k + 1) * (aw - S) + S, cm[1]))
    pts.append(box(x, 0, x + S, X))
    out.append(("m", unary_union(pts), []))
    return out


# ---------- 세로로 긴 대문자 ----------
def upper(s=19.0, h=100.0, track=3.2):
    """세로 줄기 s, 가로 획은 조금 얇게. 둥근 글자는 긴 경기장 꼴(트랙 모양)."""
    hs = s * 0.8
    gl, x = [], 0.0
    # G — 경기장 꼴 고리, 오른쪽을 열고 가로대
    w = 53.0; r = 22.0; ri = max(2.5, r - s * 0.74)
    outer = rbox(x, 0, x + w, h, r); inner = rbox(x + s, hs, x + w - s, h - hs, ri)
    ringg = outer.difference(inner).difference(box(x + w - s - 1, h * 0.40, x + w + 1, h * 0.685))
    bar = box(x + w * 0.54, h * 0.385, x + w, h * 0.385 + hs * 0.86)
    gl.append(unary_union([ringg, bar])); x += w + track
    # A — 두 다리와 가로대, 꼭대기는 넓게 자른다
    w = 60.0; top = 22.0
    apx0, apx1 = x + (w - top) / 2, x + (w + top) / 2
    legl = Polygon([(x, 0), (x + s * 1.04, 0), (apx0 + s * 0.86, h), (apx0, h)])
    legr = Polygon([(x + w - s * 1.04, 0), (x + w, 0), (apx1, h), (apx1 - s * 0.86, h)])
    fill = box(apx0 + 3, h - 8, apx1 - 3, h)
    crossy = h * 0.235
    cross = box(x + 10, crossy, x + w - 10, crossy + hs * 0.84).intersection(Polygon([(x, 0), (x + w, 0), (apx1, h), (apx0, h)]))
    gl.append(unary_union([legl, legr, fill, cross])); x += w + track - 0.8
    # P P
    for _ in range(2):
        w = 49.0; r = 21.0; bowl_b = h * 0.385
        outer = unary_union([rbox(x, bowl_b, x + w, h, r), box(x, bowl_b, x + w * 0.5, h)])
        ri2 = max(2.5, r - s * 0.74)
        inner = unary_union([rbox(x + s, bowl_b + hs * 0.9, x + w - s * 0.98, h - hs, ri2), box(x + s, bowl_b + hs * 0.9, x + s + ri2 + 1, h - hs)])
        gl.append(unary_union([outer.difference(inner), box(x, 0, x + s, h)])); x += w + track
    # E
    w = 41.0
    gl.append(unary_union([box(x, 0, x + s, h), box(x, h - hs, x + w, h), box(x, 0, x + w, hs), box(x, h * 0.5 - hs * 0.44, x + w * 0.9, h * 0.5 + hs * 0.44)])); x += w + track + 0.8
    # U
    w = 51.0; r = 22.0
    outer = rbox(x, 0, x + w, h + 40, r).intersection(box(x, 0, x + w, h))
    inner = rbox(x + s, hs, x + w - s, h + 40, max(2.5, r - s * 0.74))
    gl.append(outer.difference(inner)); x += w + track + 0.8
    # M — 두 줄기와 가운데 V(바닥까지 안 내리고 뾰족하지 않게)
    w = 72.0; vb = 0.0; vw = 15.0; c = x + w / 2
    gl.append(unary_union([box(x, 0, x + s * 0.94, h), box(x + w - s * 0.94, 0, x + w, h),
                           Polygon([(x, h), (x + s * 1.04, h), (c + vw / 2, vb + 26), (c + vw / 2, vb), (c - vw / 2, vb)]),
                           Polygon([(x + w, h), (x + w - s * 1.04, h), (c - vw / 2, vb + 26), (c - vw / 2, vb), (c + vw / 2, vb)])]))
    return gl


# ---------- 곧은 기하 대문자(11-05 밤 맹검 뒤 본판) ----------
# Fable 맹검: 「벤치마크의 웅장함은 작은 마크 둘레의 빈 공간에서 온다 — 크기 · 효과로 만들지 말 것」 · 「글자에 한 군데만 손을 대 그 브랜드의 것으로」.
# 손댄 한 군데: P 둘의 구멍을 완전한 원으로 — 니트의 숨구멍이 낱말 가운데에 나란히 뚫린다. 나머지는 군말 없는 기하형(둥근 G · U, 발이 벌어진 M, 낮은 가로대의 A).
def classic(v=13.5, track=15.0, ligature=False):
    """글자마다 (이름, 몸, 숨구멍 목록). 숨구멍은 몸에서 아직 빼지 않았다(움직일 수 있게). 대문자 높이 100.
    ligature: 첫 P의 머리를 둘째 P의 줄기에 맞붙이는 시험 — 올빼미 눈처럼 보이고 「GAPEUM」으로 읽혀 쓰지 않는다(11-05 밤). 버릇은 P의 원 구멍과 그 구멍이 열리는 움직임으로 둔다."""
    h = v * 0.86; out = []; x = 0.0
    # G: 둥근 고리, 오른 위를 열고 가로대만(가시 없음)
    R = 51.0; cx, cy = x + R, 50.0
    ring = circle(cx, cy, R).difference(circle(cx, cy, R - v * 1.04))
    far = R * 2.2; a1 = np.radians(40)
    bary = 44.0
    cut = Polygon([(cx, bary + h), (cx + far, bary + h), (cx + far * np.cos(a1), cy + far * np.sin(a1))])
    ring = ring.difference(cut)
    bar = box(cx + 2, bary, x + 2 * R, bary + h).intersection(circle(cx, cy, R))
    out.append(("G", unary_union([ring, bar]), [])); x += 2 * R + track - 3.5   # G-A · A-P를 눌러 두면 앞 세 글자가 「GAP」 한 덩이로 읽힌다
    # A: 낮은 가로대, 꼭대기는 좁게 자른다
    w = 94.0; ap = 6.0; c = x + w / 2; t = v * 1.08
    outer = Polygon([(x, 0), (x + w, 0), (c + ap / 2 + 0.0, 100), (c - ap / 2, 100)])
    yb = 100 - (100 * (t * 1.04) / (w / 2 - ap / 2))   # 안쪽 삼각형 꼭대기
    inner = Polygon([(x + t * 1.04, 0), (x + w - t * 1.04, 0), (c, yb)])
    cross = box(x, 24, x + w, 24 + h).intersection(outer)
    out.append(("A", unary_union([outer.difference(inner), cross]), [])); x += w + track - 3
    # P P: 곧은 줄기 + 둥근 머리, 구멍은 완전한 원
    for k in range(2):
        Rp = 28.5; hole = Rp - v * 0.96; cyp = 100 - Rp; cxp = x + v + hole - 0.5
        body = unary_union([box(x, 0, x + v, 100), circle(cxp, cyp, Rp), box(x, cyp - Rp, cxp, 100)])
        out.append(("P", body, [(cxp, cyp, hole)]))
        # 맞붙일 때는 첫 머리의 벽과 둘째 줄기가 한 획이 되게 겹친다
        x += (cxp - x) + Rp + (-v * 0.96 if (ligature and k == 0) else track + 5)
    # E
    w = 50.0
    out.append(("E", unary_union([box(x, 0, x + v, 100), box(x, 100 - h, x + w, 100), box(x, 0, x + w, h), box(x, 50 - h / 2, x + w * 0.88, 50 + h / 2)]), [])); x += w + track + 6
    # U
    w = 74.0; ra = w / 2; cu = (x + ra, ra - 1.2)
    arc = circle(*cu, ra).difference(circle(*cu, ra - v)).intersection(box(x, -3, x + w, cu[1]))
    out.append(("U", unary_union([arc, box(x, cu[1], x + v, 100), box(x + w - v, cu[1], x + w, 100)]), [])); x += w + track + 6
    # M: 발이 조금 벌어진 두 다리와 바닥까지 내려오는 V
    w = 104.0; sp = 7.0; c = x + w / 2; tv = v * 1.02; td = v * 1.12
    legl = Polygon([(x, 0), (x + tv, 0), (x + sp + tv, 100), (x + sp, 100)])
    legr = Polygon([(x + w - tv, 0), (x + w, 0), (x + w - sp, 100), (x + w - sp - tv, 100)])
    dl = Polygon([(x + sp, 100), (x + sp + td, 100), (c + td / 2, 0), (c - td / 2, 0)])
    dr = Polygon([(x + w - sp, 100), (x + w - sp - td, 100), (c - td / 2, 0), (c + td / 2, 0)])
    out.append(("M", unary_union([legl, legr, dl, dr]), []))
    return out


def text_line(text, v=15.5, track=20.0, space=44.0):
    """작은 줄도 같은 기하 대문자로 직접 그린다(따로 노는 시스템 글꼴을 버림). 대문자 높이 100. 한 덩어리 도형을 돌려준다."""
    h = v * 0.88; x = 0.0; out = []
    def add(g, w, extra=0.0):
        nonlocal x
        out.append(g); x += w + track + extra
    for ch in text:
        if ch == " ": x += space; continue
        if ch == "O":
            R = 51.0; add(circle(x + R, 50, R).difference(circle(x + R, 50, R - v * 1.04)), 2 * R, -4)
        elif ch == "U":
            w = 74.0; ra = w / 2; cu = (x + ra, ra - 1.2)
            add(unary_union([circle(*cu, ra).difference(circle(*cu, ra - v)).intersection(box(x, -3, x + w, cu[1])), box(x, cu[1], x + v, 100), box(x + w - v, cu[1], x + w, 100)]), w)
        elif ch == "T":
            w = 68.0; add(unary_union([box(x, 100 - h, x + w, 100), box(x + w / 2 - v / 2, 0, x + w / 2 + v / 2, 100)]), w, -6)
        elif ch == "F":
            w = 48.0; add(unary_union([box(x, 0, x + v, 100), box(x, 100 - h, x + w, 100), box(x, 50 - h / 2, x + w * 0.86, 50 + h / 2)]), w, -4)
        elif ch == "B":
            w = 58.0; r1, r2 = 28.0, 24.5; c1, c2 = (x + w - r1, r1), (x + w - r2 - 3, 100 - r2)
            outer = unary_union([box(x, 0, c1[0], 2 * r1), box(x, 100 - 2 * r2, c2[0], 100), circle(*c1, r1), circle(*c2, r2)])
            i1 = unary_union([box(x + v, h, c1[0], 2 * r1 - h * 0.9), circle(c1[0], c1[1], r1 - v)]); i2 = unary_union([box(x + v, 100 - 2 * r2 + h * 0.9, c2[0], 100 - h), circle(c2[0], c2[1], r2 - v)])
            add(outer.difference(i1).difference(i2), w)
        elif ch == "R":
            Rp = 28.5; hole = Rp - v * 0.96; cyp = 100 - Rp; cxp = x + v + hole - 0.5
            bd = unary_union([box(x, 0, x + v, 100), circle(cxp, cyp, Rp), box(x, cyp - Rp, cxp, 100)]).difference(circle(cxp, cyp, hole))
            leg = Polygon([(cxp - 6, cyp - Rp + 1), (cxp - 6 + v * 1.1, cyp - Rp + 1), (x + 62, 0), (x + 62 - v * 1.15, 0)])
            add(unary_union([bd, leg]), 62, -2)
        elif ch == "E":
            w = 50.0; add(unary_union([box(x, 0, x + v, 100), box(x, 100 - h, x + w, 100), box(x, 0, x + w, h), box(x, 50 - h / 2, x + w * 0.88, 50 + h / 2)]), w)
        elif ch == "A":
            w = 88.0; ap = 6.0; c = x + w / 2; t = v * 1.08
            outer = Polygon([(x, 0), (x + w, 0), (c + ap / 2, 100), (c - ap / 2, 100)])
            yb = 100 - (100 * (t * 1.04) / (w / 2 - ap / 2))
            inner = Polygon([(x + t * 1.04, 0), (x + w - t * 1.04, 0), (c, yb)])
            add(unary_union([outer.difference(inner), box(x, 24, x + w, 24 + h).intersection(outer)]), w, -6)
        elif ch == "H":
            w = 72.0; add(unary_union([box(x, 0, x + v, 100), box(x + w - v, 0, x + w, 100), box(x, 50 - h / 2, x + w, 50 + h / 2)]), w)
        elif ch == "I":
            add(box(x, 0, x + v, 100), v)
        elif ch == "N":
            w = 78.0; add(unary_union([box(x, 0, x + v, 100), box(x + w - v, 0, x + w, 100), Polygon([(x, 100), (x + v * 1.15, 100), (x + w, 0), (x + w - v * 1.15, 0)])]), w)
        elif ch == "J":
            w = 44.0; ra = w / 2; cu = (x + ra, ra - 1.2)
            add(unary_union([circle(*cu, ra).difference(circle(*cu, ra - v)).intersection(box(x, -3, x + w, cu[1])), box(x + w - v, cu[1], x + w, 100)]), w)
        elif ch == "Y":
            w = 80.0; c = x + w / 2; t = v * 1.12
            add(unary_union([Polygon([(x, 100), (x + t, 100), (c + v / 2, 44), (c - v / 2, 44)]), Polygon([(x + w, 100), (x + w - t, 100), (c - v / 2, 44), (c + v / 2, 44)]), box(c - v / 2, 0, c + v / 2, 46)]), w, -6)
        elif ch == ",":
            add(unary_union([box(x, 0, x + v, v), Polygon([(x + v, 0), (x + v, -16), (x + v * 0.34, -24), (x + v * 0.2, -18), (x, 0)])]), v, 6)
        else:
            raise ValueError(ch)
    return unary_union(out)


def solid(glyphs):
    return unary_union([b.difference(unary_union([circle(*c) for c in hs])) if hs else b for _, b, hs in glyphs])


def bounds(geoms):
    return unary_union(geoms).bounds


def raster(geom, W, H, sx, ox, oy, ss=4):
    """shapely 도형을 8비트 덮임 판으로(4배로 그려 줄인다). 좌표는 글자 단위, (ox, oy)는 글자 원점의 화면 위치, y 위가 +."""
    import cv2
    m = np.zeros((H * ss, W * ss), np.uint8)
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
    def pts(ring): return np.array([[(ox + x * sx) * ss, (oy - y * sx) * ss] for x, y in ring.coords], np.float64).round().astype(np.int32)
    for p in polys:
        cv2.fillPoly(m, [pts(p.exterior)], 255, lineType=cv2.LINE_8)
    for p in polys:
        for it in p.interiors:
            cv2.fillPoly(m, [pts(it)], 0, lineType=cv2.LINE_8)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)


if __name__ == "__main__":
    from pathlib import Path
    from PIL import Image
    out = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/로고시안"); out.mkdir(parents=True, exist_ok=True)
    W, H = 1400, 900
    canvas = np.zeros((H, W), np.uint8)
    # 소문자
    lo = lower()
    g = unary_union([b.difference(unary_union([circle(c[0], c[1], c[2]) for c in holes])) if holes else b for _, b, holes in lo])
    x0, y0, x1, y1 = g.bounds; sx = 1200 / (x1 - x0)
    canvas = np.maximum(canvas, raster(g, W, H, sx, 100 - x0 * sx, 300))
    # 대문자
    up = unary_union(upper()); x0, y0, x1, y1 = up.bounds; sx = 1200 / (x1 - x0)
    canvas = np.maximum(canvas, raster(up, W, H, sx, 100 - x0 * sx, 860))
    # 본판
    cl = solid(classic()); x0, y0, x1, y1 = cl.bounds; sx = 1200 / (x1 - x0)
    c2 = np.zeros((360, 1400), np.uint8); c2 = np.maximum(c2, raster(cl, 1400, 360, sx, 100 - x0 * sx, 280))
    Image.fromarray(c2).save(out / "글자_본판.png")
    Image.fromarray(canvas).save(out / "글자_미리보기.png")
    print("소문자 폭", round(g.bounds[2] - g.bounds[0]), "대문자 폭", round(up.bounds[2] - up.bounds[0]))
