# 「늘켬」 워드마크를 글꼴이 아니라 도형으로 그린다(2026-11-07, Claude) — 슬롭 점검표 22번 「끝 로고는 치지 말고 그린다」(11-05),
# 승인 결은 로고 D(호박빛 바탕 · 흰 글자, 결정 10-29)라 무겁고 기하적인 획 · 짧은 자간은 D를 따르고 글자꼴만 우리 것으로 그린다.
# 끝 화면 묶음에는 오른쪽 위에 호박빛 점 하나 — 「늘 켜 둔 불」, 마지막에 센서등 「딸깍」과 함께 켜진다(엔드카드 가이드 「로고에 본질 하나 숨기기」).
# 같은 획 결로 「1+1」(상자 스티커)과 배터리 표시(17번 폰)도 그린다. 좌표는 위가 +y, 글자 높이 120 기준.
#   python -X utf8 늘켬_워드마크.py   → <밖>/라벨/늘켬_워드마크_미리보기.png(검정 · 호박빛 바탕 둘)
import os

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "xmas-neighbors", "라벨")
S = 14.0      # 획 두께
ROUND = 2.0   # 모서리 둥글림(획 끝은 반듯하게 — D의 무거운 기하 획)
H = 128.0     # 글자 높이


def rect(x0, y0, x1, y1):
    return box(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def stroke(pts, s=S):
    # 꺾인 선 하나를 획으로 — 끝은 반듯(flat), 꺾임은 각(mitre)
    return LineString(pts).buffer(s / 2, cap_style=2, join_style=2, mitre_limit=4)


def soften(g, r=ROUND):
    return g.buffer(-r, join_style=1).buffer(r, join_style=1)


def neul(x0=0.0):
    # 늘 — 위 ㄴ(y 97~128), 가운데 ㅡ(74~88), 아래 ㄹ(0~65 — 획 셋 · 사이 11.5)
    parts = [rect(x0 + 6, 97, x0 + 20, H), rect(x0 + 6, 97, x0 + 96, 111),            # ㄴ
             rect(x0 + 0, 74, x0 + 102, 88),                                          # ㅡ
             rect(x0 + 6, 51, x0 + 96, 65), rect(x0 + 82, 25.5, x0 + 96, 65),         # ㄹ 위 가로 · 오른 세로
             rect(x0 + 6, 25.5, x0 + 96, 39.5), rect(x0 + 6, 0, x0 + 20, 39.5),      # ㄹ 가운데 가로 · 왼 세로
             rect(x0 + 6, 0, x0 + 98, 14)]                                            # ㄹ 아래 가로
    return unary_union(parts)


def kyeom(x0=114.0):
    # 켬 — 위 왼쪽 ㅋ(x 0~52), 위 오른쪽 ㅕ(기둥 86~100 · 짧은 가로 64~86), 아래 ㅁ(y 0~50)
    parts = [rect(x0 + 0, 114, x0 + 52, H), rect(x0 + 38, 62, x0 + 52, H), rect(x0 + 0, 87, x0 + 38, 101),   # ㅋ
             rect(x0 + 86, 60, x0 + 100, H), rect(x0 + 64, 103, x0 + 86, 117), rect(x0 + 64, 77, x0 + 86, 91),  # ㅕ
             rect(x0 + 4, 0, x0 + 100, 50).difference(rect(x0 + 18, 14, x0 + 86, 36))]                        # ㅁ
    return unary_union(parts)


def wordmark():
    return soften(unary_union([neul(0), kyeom(116)]))


def one_plus_one():
    s = 16.0
    one = lambda x: unary_union([rect(x, 0, x + s, 100), Polygon([(x + 1, 100), (x - 15, 82), (x - 15, 70), (x + 1, 86)])])
    plus = unary_union([rect(52, 42, 96, 58), rect(66, 28, 82, 72)])
    return soften(unary_union([one(20), plus, one(130)]), 1.5)


def battery():
    # 폰 화면 귀퉁이 배터리 — 테두리 + 끝 꼭지 + 빨간 칸(10%)
    outline = box(0, 0, 100, 46).difference(box(7, 7, 93, 39))
    cap = box(100, 13, 108, 33)
    fill = box(12, 12, 22, 34)
    return soften(unary_union([outline, cap]), 2.5), fill


def bounds(g):
    x0, y0, x1, y1 = g.bounds
    return x0, y0, x1, y1


def raster(g, height_px, pad=0.06, color=(255, 252, 244), extra=None):
    """g(위가 +y)를 높이 height_px의 RGBA로. extra = [(도형, 색)] — 같은 좌표계로 함께 그린다."""
    x0, y0, x1, y1 = bounds(g if extra is None else unary_union([g] + [e[0] for e in extra]))
    k = 4   # 4배로 그려 줄인다(가장자리 부드럽게)
    sc = height_px * k / (y1 - y0) / (1 + 2 * pad)
    W, H = int((x1 - x0) * sc + 2 * pad * (y1 - y0) * sc), int(height_px * k)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = pad * (y1 - y0) * sc - x0 * sc, H - (pad * (y1 - y0) * sc - y0 * sc)

    def poly(p, col):
        polys = getattr(p, "geoms", [p])
        for q in polys:
            ext = [(ox + x * sc, oy - y * sc) for x, y in q.exterior.coords]
            d.polygon(ext, fill=col + (255,))
            for hole in q.interiors:
                d.polygon([(ox + x * sc, oy - y * sc) for x, y in hole.coords], fill=(0, 0, 0, 0))

    poly(g, color)
    for e, col in extra or []:
        poly(e, col)
    return img.resize((W // k, H // k), Image.LANCZOS)


def lockup_dot(r=9.0):
    # 끝 화면 묶음의 호박빛 점 — 워드마크 오른쪽 위(ㅕ 기둥 끝 오른쪽)
    from shapely.geometry import Point
    x0, y0, x1, y1 = wordmark().bounds
    return Point(x1 + r + 7, y1 - r).buffer(r, quad_segs=48)


def main():
    os.makedirs(밖, exist_ok=True)
    wm = raster(wordmark(), 300)
    dot = raster(wordmark(), 300, color=(255, 252, 244), extra=[(lockup_dot(), (246, 176, 62))])
    opo = raster(one_plus_one(), 160)
    bat, fill = battery()
    bt = raster(bat, 120, extra=[(fill, (232, 48, 44))])
    W = max(wm.width, dot.width) * 2 + 120
    board = Image.new("RGB", (W, 820), (14, 16, 22))
    board.paste(dot, (40, 40), dot)
    amber = Image.new("RGB", (wm.width + 80, 380), (246, 176, 62))
    amber.paste(wm, (40, 40), wm)
    board.paste(amber, (dot.width + 80, 0))
    red = Image.new("RGB", (opo.width + 60, opo.height + 60), (206, 44, 52))
    red.paste(opo, (30, 30), opo)
    board.paste(red, (40, 440))
    board.paste(bt, (red.width + 100, 470), bt)
    out = os.path.join(밖, "늘켬_워드마크_미리보기.png")
    board.save(out)
    print(out, wm.size)


if __name__ == "__main__":
    main()
