# 1번 오미톡 끝 「톡」 마크 — 글꼴로 치지 않고 도형으로 그린다(유호님 11-06 「cg나 더 세련되게 타이포그래피를 써줘야해」, 슬롭 점검표 24번).
# 생각: 라벨 워드마크 omitok의 i 점이 빨간 열매 점이다. 「톡」의 ㅗ 세로획을 그 빨간 점으로 바꿔, 점이 기포처럼 떠올라 박히는 순간이 곧 「톡」이다.
# 글자 결은 라벨 워드마크처럼 굵고 끝이 둥근 꼴. 좌표는 글자 너비 100 기준(y 위가 +). 이 파일을 바로 돌리면 미리 보기 그림을 낸다.
import numpy as np
from shapely.geometry import Point, box
from shapely.ops import unary_union

S = 32.0          # 획 두께 — 라벨 워드마크(omitok)처럼 묵직하게(Fable 맹검 「획이 가늘다」로 27 → 32)
RND = 11.0        # 획 모서리 둥글기 — 라벨 워드마크의 부드러운 끝
W = 190.0         # ㅗ 가로 너비(글자 너비) — 한 글자가 네모 칸에 차게
GAP = 0.5 * S     # ㅌ 가로 사이 · ㅗ와 ㄱ 사이 틈
DOT_GAP = 1.7 * S # ㅗ 가로와 ㅌ 사이(빨간 점 자리)


def bar(x0, y0, x1, y1):
    return box(x0 + RND, y0 + RND, x1 - RND, y1 - RND).buffer(RND, quad_segs=24)


def strokes():
    """(이름, 도형) — ㅌ · ㅗ 가로 · ㄱ. 빨간 점은 dot()으로 따로."""
    L, Rx = 12.0, W - 12.0
    g_top = 1.6 * S + 6.0                  # ㄱ 가로 윗변
    o_y = g_top + GAP                      # ㅗ 가로 아랫변
    t_bot = o_y + S + DOT_GAP              # ㅌ 아래 가로 아랫변
    giyeok = unary_union([bar(L, g_top - S, Rx, g_top), bar(Rx - S, 0.0, Rx, g_top)])
    obar = bar(0, o_y, W, o_y + S)
    y1, y2, y3 = t_bot, t_bot + S + GAP, t_bot + 2 * (S + GAP)
    teu = unary_union([
        bar(L, y3, Rx, y3 + S),
        bar(L, y2, Rx - 26, y2 + S),
        bar(L, y1, Rx, y1 + S),
        bar(L, y1, L + S, y3 + S),
    ])
    return [("ㅌ", teu), ("ㅗ", obar), ("ㄱ", giyeok)]


def dot():
    """ㅗ 세로획 자리 — (cx, cy, r). ㅗ 가로와 ㅌ 사이 가운데, 획 두께보다 조금 크게."""
    o_top = 1.6 * S + 6.0 + GAP + S
    return (W / 2, o_top + DOT_GAP / 2, DOT_GAP / 2 - 3.0)


def bounds():
    u = unary_union([g for _, g in strokes()] + [Point(*dot()[:2]).buffer(dot()[2])])
    return u.bounds


def draw(img_w, img_h, cx, cy, height_px, parts=None, dot_scale=1.0, dot_dy=0.0, scale=1.0, alpha=1.0,
         white=(255, 255, 255), red=(226, 35, 40), ss=4):
    """RGBA 그림 한 장(numpy uint8). cx, cy는 마크 가운데(화면 px), height_px는 마크 높이. parts는 그릴 획 이름들(None이면 다)."""
    import cv2
    x0, y0, x1, y1 = bounds()
    k = height_px / (y1 - y0) * scale * ss
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    H, Wd = img_h * ss, img_w * ss
    canvas = np.zeros((H, Wd, 4), np.uint8)

    def to_px(pts):
        return np.array([[(cx * ss + (x - mx) * k), (cy * ss - (y - my) * k)] for x, y in pts], np.int32)

    for name, g in strokes():
        if parts is not None and name not in parts:
            continue
        geoms = getattr(g, "geoms", [g])
        for poly in geoms:
            ext = to_px(poly.exterior.coords)
            cv2.fillPoly(canvas, [ext], (*white[::-1], int(255 * alpha)), lineType=cv2.LINE_AA)
            for hole in poly.interiors:
                cv2.fillPoly(canvas, [to_px(hole.coords)], (0, 0, 0, 0), lineType=cv2.LINE_AA)
    if dot_scale > 0:
        dx, dy, r = dot()
        c = to_px([(dx, dy + dot_dy)])[0]
        cv2.circle(canvas, (int(c[0]), int(c[1])), int(r * k * dot_scale), (*red[::-1], 255), -1, lineType=cv2.LINE_AA)
    return cv2.resize(canvas, (img_w, img_h), interpolation=cv2.INTER_AREA)


if __name__ == "__main__":
    import sys
    import cv2
    out = sys.argv[1] if len(sys.argv) > 1 else "톡마크_미리보기.png"
    bg = np.full((600, 600, 3), (60, 20, 10), np.uint8)
    m = draw(600, 600, 300, 300, 420)
    a = m[..., 3:4].astype(np.float32) / 255
    bg = (bg * (1 - a) + m[..., :3] * a).astype(np.uint8)
    ok, b = cv2.imencode(".png", bg)
    b.tofile(out)
    print(out, bounds())
