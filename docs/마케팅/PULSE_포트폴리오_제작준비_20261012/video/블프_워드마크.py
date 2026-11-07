# 블프 두 편 끝 로고(2026-11-07, Claude) — 글꼴로 치지 않고 도형으로 그린 워드마크(점검표 22번 · 장부 「끝 로고는 치지 말고 그린다」).
#   힘껏(시즌 3 가상 운동복): 무겁고 앞으로 기운 사각 획. ㅎ의 ㅇ은 스핀 자전거 플라이휠처럼 납작한 고리, 획 끝은 진행 방향으로 비스듬히 잘린다.
#   느지막(시즌 4 가상 가전 · 생활 온라인몰): 둥근 획끝의 고른 굵기 — 「서두르지 않는」 결. ㄴ의 바닥 · 막의 ㄱ이 옆으로 길게 눕는다.
# 좌표는 글자 높이 100(y 위가 +). 바로 돌리면 미리 보기 PNG와 Remotion이 읽는 SVG 경로 JSON을 낸다.
#   python -X utf8 블프_워드마크.py   → 자막시안_20261103/remotion/src/bf/로고.json · git 밖 최종/s3/_로고_미리.png · 최종/s4/_로고_미리.png
import json
import math
import os

from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUTJ = os.path.join(HERE, "자막시안_20261103", "remotion", "src", "bf", "로고.json")
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종"


def ell(cx, cy, rx, ry):
    return affinity.scale(Point(cx, cy).buffer(1, quad_segs=96), rx, ry)


def slash(g, x_cut, angle_deg, keep="left"):
    """세로획 끝을 비스듬히 자른다 — x_cut을 지나는 기운 선의 한쪽만 남김."""
    t = math.tan(math.radians(angle_deg))
    big = 400
    if keep == "left":
        cut = Polygon([(x_cut - big, -big), (x_cut + big * t, big), (x_cut - big * 2, big)])
    else:
        cut = Polygon([(x_cut + big, -big), (x_cut + big * t, big), (x_cut + big * 2, big)])
    return g.intersection(cut)


def himkkeot():
    S, H2 = 15.0, 10.5           # 세로 · 가로 획 굵기
    parts = []
    # --- 힘 ---
    x = 0.0
    kkok = box(x + 17, 90, x + 41, 100)                       # ㅎ 꼭지
    garo = box(x + 1, 75.5, x + 57, 75.5 + H2)                 # ㅎ 가로
    ring = ell(x + 29, 55.5, 28, 15).difference(ell(x + 29, 55.5, 28 - S, 15 - H2 * 0.78))   # 납작한 고리(플라이휠)
    i_stem = box(x + 67, 38, x + 67 + S, 100)                 # ㅣ
    m_out = box(x + 7, 0, x + 81, 31)                         # ㅁ 받침
    m = m_out.difference(box(x + 7 + S, H2 * 0.95, x + 81 - S, 31 - H2 * 0.95))
    parts.append(unary_union([kkok, garo, ring, i_stem, m]))
    # --- 껏 ---
    x = 101.0
    gw, gap = 24.0, 7.0
    gg = []
    for k in range(2):                                         # ㄲ — ㄱ 둘, 세로는 아래로 갈수록 살짝 왼쪽
        x0 = x + k * (gw + gap)
        top = box(x0, 89.5, x0 + gw, 100)
        leg = Polygon([(x0 + gw - S * 0.95, 100), (x0 + gw, 100), (x0 + gw - 4, 44), (x0 + gw - 4 - S * 0.95, 44)])
        gg += [top, leg]
    eo_stem = box(x + 70, 38, x + 70 + S, 100)                # ㅓ 세로
    eo_arm = box(x + 57, 64.5, x + 70.5, 64.5 + H2)           # ㅓ 짧은 가로(왼쪽으로)
    apex = (x + 42.5, 31.5)
    s_l = LineString([apex, (x + 6, 0)]).buffer(S * 0.68, cap_style="flat", join_style="mitre")
    s_r = LineString([(x + 40.5, 25.5), (x + 84, 0)]).buffer(S * 0.68, cap_style="flat", join_style="mitre")
    s = unary_union([s_l, s_r]).intersection(box(x - 10, 0, x + 92, 31.5))
    parts.append(unary_union(gg + [eo_stem, eo_arm, s]))
    g = unary_union(parts)
    # 앞으로 기울임(달리는 결) — 11°
    g = affinity.skew(g, xs=11, origin=(0, 0))
    return g


def neujimak():
    S = 13.0                                                   # 고른 굵기 · 둥근 끝
    r = S / 2
    def stroke(*pts):
        return LineString(pts).buffer(r, cap_style="round", join_style="round", quad_segs=24)
    parts = []
    # --- 느 --- ㄴ 위 · ㅡ 아래(받침 없는 가로 모음)
    x = 0.0
    n = stroke((x + 14, 98), (x + 14, 62), (x + 70, 62))
    eu = stroke((x + 4, 26), (x + 82, 26))
    parts += [n, eu]
    # --- 지 --- ㅈ 왼쪽 · ㅣ 오른쪽
    x = 96.0
    j_top = stroke((x + 6, 92), (x + 50, 92))
    j_l = stroke((x + 30, 92), (x + 6, 18))
    j_r = stroke((x + 30, 70), (x + 52, 18))
    i_ = stroke((x + 72, 100), (x + 72, 4))
    parts += [j_top, j_l, j_r, i_]
    # --- 막 --- ㅁ 왼쪽 위 · ㅏ 오른쪽 · ㄱ 받침이 옆으로 길게 눕는다
    x = 192.0
    m = stroke((x + 6, 96), (x + 50, 96), (x + 50, 52), (x + 6, 52), (x + 6, 96))
    a_stem = stroke((x + 70, 100), (x + 70, 44))
    a_arm = stroke((x + 70, 72), (x + 88, 72))
    g_ = stroke((x + 6, 30), (x + 86, 30), (x + 86, 2))   # 받침 ㄱ — 가로를 ㅏ 끝까지만(11-07 Fable 「막 뒤 꼬리 · 쉼표처럼 보임」: 옛 판은 가로가 ㅏ 밖까지 길어 세로가 떨어진 꼬리로 읽힘)
    parts += [m, a_stem, a_arm, g_]
    return unary_union(parts)


def to_path(g):
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    minx, miny, maxx, maxy = g.bounds
    out = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)
            out.append("M" + " L".join(f"{x - minx:.2f},{maxy - y:.2f}" for x, y in pts) + " Z")
    return " ".join(out), round(maxx - minx, 2), round(maxy - miny, 2)


def preview(g, path, fg=(255, 255, 255), bg=(20, 18, 40), scale=4.0, pad=40):
    from PIL import Image, ImageDraw
    minx, miny, maxx, maxy = g.bounds
    W, H = int((maxx - minx) * scale + pad * 2), int((maxy - miny) * scale + pad * 2)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    for p in polys:
        tf = lambda c: [(pad + (x - minx) * scale, pad + (maxy - y) * scale) for x, y in c]
        d.polygon(tf(p.exterior.coords), fill=fg)
        for hole in p.interiors:
            d.polygon(tf(hole.coords), fill=bg)
    img.save(path)
    return path


def main():
    os.makedirs(os.path.dirname(OUTJ), exist_ok=True)
    data = {}
    for name, fn, piece, fg, bg in (("himkkeot", himkkeot, "s3", (255, 74, 28), (27, 20, 70)), ("neujimak", neujimak, "s4", (238, 150, 52), (14, 18, 30))):
        g = fn()
        p, w, h = to_path(g)
        data[name] = {"d": p, "w": w, "h": h}
        os.makedirs(os.path.join(ROOT, piece), exist_ok=True)
        print(preview(g, os.path.join(ROOT, piece, "_로고_미리.png"), fg=fg, bg=bg), w, h)
    json.dump(data, open(OUTJ, "w", encoding="utf-8"), ensure_ascii=False)
    print(OUTJ)


if __name__ == "__main__":
    main()
