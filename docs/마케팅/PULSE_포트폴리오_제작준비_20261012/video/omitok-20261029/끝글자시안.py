# 오미톡 15초 끝 글자 시안(2026-11-08, Claude) — 유호님 「타이포그래피나 cg로 나레이션이 감각적으로 들어가면 더 좋을것같은데」 → 「시안 두 벌 만들어」.
# 슬롭 점검표 22 · 24번대로 글꼴로 친 자막이 아니라 1번 오미톡의 그린 글자를 쓴다(product-hero-20261024/라벨 — 톡마크.py · 라벨.py).
#   A: 캔이 친구 볼에 닿는 순간 그린 「톡」(획 셋이 한 번에 켜지고 빨간 열매 점이 떠올라 박힌다 — 1번과 같은 점의 몸짓) + 끝 「오미톡」의 「톡」에 같은 결로 그린 「오미톡」.
#   B: A에 「다섯 가지 맛,」 다섯 음절마다 열매 점 하나씩 켜지고, 「톡」에서 다섯 점이 모여 「톡」의 점 하나가 된다.
#   첫 시안 맹검(11-08 Fable B 「고치고 통과」 · 이름 가린 opus A)을 받아 고친 판 — 고친 까닭은 아래 값마다 적었다.
#   python -X utf8 끝글자시안.py [A] [B]   → git 밖 최종/om2/_시안_끝글자/시안A.mp4 · 시안A_폰.mp4 · B …(최종본 그림 위에 얹고 소리는 그대로)
# 글자는 화면에 붙은 그림이다(장면을 따라가지 않는다) — 다만 폰이 움찔하는 장에 「톡」이 같이 한 번 흔들린다.
import importlib.util
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집공통 as C   # noqa: E402

LABEL = os.path.join(HERE, "..", "product-hero-20261024", "라벨")
sys.path.insert(0, LABEL)
import 톡마크 as T   # noqa: E402
_spec = importlib.util.spec_from_file_location("label", os.path.join(LABEL, "라벨.py"))
L = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(L)

FINAL = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/om2/오미톡15_9x16.mp4"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/om2/_시안_끝글자"
W, H, FPS, N = 1080, 1920, 24, 360
RED = (226, 35, 40)          # 1번 「톡」 점과 같은 빨강(화면용)
RUBY = L.색["루비"]          # 라벨 열매 점

# 시각(초) — 사람판편집.py 끝말 자리: 「다섯 가지 맛,」 조각 10.11초 · 「톡.」 11.36초 · 「오미톡.」 13.65초.
#   내레이션 파일 안 소리 덩이를 −38 dB 문턱으로 잰 음절 머리: 다 0.09 · 섯 0.22 · 가 0.49 · 지 0.60 · 맛 0.71(「다섯 가지 맛,」 조각 안), 톡 0.10, 오미톡 0.15.
SYL = [10.11 + s for s in (0.09, 0.22, 0.49, 0.60, 0.71)]
HIT = 11.36 + 0.10           # 「톡」 낱말 머리 — 캔이 화면 위 친구 볼에 가 닿는 때
JOLT = 278                   # 폰이 움찔해 화면이 한 장 통째로 번지는 장(11.58초, Fable)
YELP = 11.91                 # 화면 밖 친구 「으악」 머리 — 마크가 한 번 튕기며 빠지기 시작한다(opus 맹검 「흔들리는 화면 위에 꼼짝 않고 붙어 있다」)
OUT_AT = 11.96               # 「톡」이 빠지기 시작 — 비명에 튕겨 나가 웃음이 터지는 12.1초엔 없다
#   첫 판 12.40초는 0.9초 동안 같은 크기 · 자리로 굳어 「붙여 넣은 스티커」 같았다(opus 둘째 맹검 「짧은 한 방으로」) — 머무는 동안은 조금씩 다가오게(1.00 → 1.04)
END_AT = 14.02               # 「오미톡」의 끝 음절 「톡」 — 돌아온 캔이 그 줄에서 물러난 뒤 한 번에 놓는다
#   첫 판 13.80초는 반투명으로 떠오르는 동안 돌아오는 큰 캔 라벨과 나란히 서 「mitok omitok」로 읽혔다(opus · Fable 맹검)

# 「톡」 마크 자리: 팔이 화면 왼쪽 위를 덮는 11.1~12.5초, 얼굴은 오른쪽(11.4초 x 0.65~0.95) → 마크는 왼쪽 x 0.08~0.50 · y 0.19~0.54
#   첫 판(가운데 y 640 · 높이 720)은 윗변이 14.7%라 릴스 머리에 물렸다(Fable) — 70px 내리고 조금 줄였다
MARK = (310, 700, 680)       # 가운데 x · y · 높이(px). 너비는 높이의 0.66배(약 450px, 화면 폭 42%)
# 끝 낱말 자리: 14초 뒤 캔은 왼쪽(오른 끝 x 0.40~0.45) · 머리는 y 0.42 아래 → 그 사이 오른쪽의 빈 코트 바닥(고른 어둠)에 오른쪽 맞춤.
#   라틴 낱말표 omitok을 얹었더니 캔 라벨의 omitok과 같은 높이에 나란히 「omitok omitok」으로 섰고, 「톡」 마크(둥근 막대)와 다른 회사 글씨 같았다(opus) →
#   실제 광고(스프라이트 한국판 끝: 영문 로고 캔 옆 한글 이름)처럼 한글 「오미톡」을 「톡」 마크와 같은 결로 그렸다(word_geoms).
#   첫 판은 오른쪽 위 나무 · 가로등 불빛 위라 지저분했고(opus), 친 한 줄 「다섯 가지 맛, 톡」은 1번에서 유호님이 「짜친다」고 하신 그 줄이라 뺐다(내레이션이 말한다)
LOCK_RIGHT, LOCK_BASE, LOCK_SIZE = 1012, 730, 220   # 오른쪽 끝 · 아랫변 · 글자 높이(px) — 낱말 너비 약 494px(화면 폭 46%)


def ease(u):
    u = max(0.0, min(1.0, u))
    return 1 - (1 - u) ** 3


def pop(t):
    """박힌 뒤 한 번 크게 튀었다가 가라앉는 배율(1번 「톡」 점과 같은 감쇠 진동)."""
    return 1.0 + 0.28 * np.exp(-t * 14) * np.cos(t * 22) if t >= 0 else 1.0


def mark_geom():
    x0, y0, x1, y1 = T.bounds()
    k = MARK[2] / (y1 - y0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy, r = T.dot()
    return k, (MARK[0] + (dx - mx) * k, MARK[1] - (dy - my) * k), r * k   # 배율 · 점 가운데(화면) · 점 반지름(px)


def over(layer, m, ox=0, oy=0):
    """layer(H×W×4)에 m(같은 크기 RGBA)을 알파로 덮는다 — ox, oy만큼 옮겨서."""
    if ox or oy:
        m = cv2.warpAffine(m, np.float32([[1, 0, ox], [0, 1, oy]]), (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    a = m[..., 3:4].astype(np.float32) / 255
    layer[..., :3] = (layer[..., :3] * (1 - a) + m[..., :3] * a).astype(np.uint8)
    layer[..., 3] = np.maximum(layer[..., 3], m[..., 3])


def berry(layer, cx, cy, r, alpha=1.0, ring=1.0, color=None):
    """라벨 i 점과 같은 열매 점 — 루비 원 + 얇은 흰 테(4배로 그려 줄임). ring은 흰 테의 짙기(점이 모일 때 걷는다)."""
    if r <= 0.5 or alpha <= 0:
        return
    ss = 4
    R = int(r * ss + 4 * ss)
    tile = np.zeros((2 * R, 2 * R, 4), np.uint8)
    rgb = color or tuple(int(RUBY[i:i + 2], 16) for i in (1, 3, 5))
    cv2.circle(tile, (R, R), int(r * ss), (rgb[2], rgb[1], rgb[0], int(255 * alpha)), -1, lineType=cv2.LINE_AA)
    if ring > 0.02:
        ring_layer = np.zeros_like(tile)
        cv2.circle(ring_layer, (R, R), int(r * ss), (255, 255, 255, int(255 * alpha * ring)), max(1, int(0.09 * r * ss)), lineType=cv2.LINE_AA)
        a = ring_layer[..., 3:4].astype(np.float32) / 255
        tile[..., :3] = (tile[..., :3] * (1 - a) + ring_layer[..., :3] * a).astype(np.uint8)
        tile[..., 3] = np.maximum(tile[..., 3], ring_layer[..., 3])
    tile = cv2.resize(tile, (2 * R // ss, 2 * R // ss), interpolation=cv2.INTER_AREA)
    h, w = tile.shape[:2]
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    m = np.zeros((H, W, 4), np.uint8)
    xs, ys = max(0, x0), max(0, y0)
    xe, ye = min(W, x0 + w), min(H, y0 + h)
    if xe <= xs or ye <= ys:
        return
    m[ys:ye, xs:xe] = tile[ys - y0:ye - y0, xs - x0:xe - x0]
    over(layer, m)


def word_geoms():
    """끝 낱말 「오미톡」 — 「톡」 마크(1번에서 고르신 그린 글자)와 같은 둥근 막대 결로 「오 · 미」를 그린다. 빨간 열매 점은 「톡」의 ㅗ에만.
    좌표는 「톡」 마크 단위(y 위가 +, 글자 높이 287.6). 돌려주는 값: (흰 도형 하나, [(점 가운데 x, y, 반지름) …], 너비)."""
    from shapely.affinity import translate
    from shapely.geometry import Point
    from shapely.ops import unary_union
    S, Wg = T.S, T.W
    x0, y0, x1, y1 = T.bounds()
    Hh = y1 - y0
    # 글자 사이 0.30W · 「미」 안 ㅁ–ㅣ 틈 0.12W — 둘 다 0.2W 안팎이면 「오 미 톡」 리듬이 고르지 않았다(opus 둘째 맹검 「세 덩이로 보이게」).
    #   첫 판 0.42W는 「넓게 벌린 글꼴」(점검표 22번)처럼 떠 보였다
    gap = 0.30 * Wg
    # 오: 위 ㅇ(고리) · 아래 ㅗ(가로 + 흰 세로획) — 빨간 점은 「톡」에만 남겨 앞의 큰 「톡」을 되부른다(opus 「점이 오는 낮고 톡은 높아 들쭉날쭉」)
    ring_r = Wg / 2
    ring = Point(Wg / 2, Hh - ring_r).buffer(ring_r, quad_segs=48).difference(Point(Wg / 2, Hh - ring_r).buffer(ring_r - S, quad_segs=48))
    o_bar = T.bar(0, 0, Wg, S)
    o_stem = T.bar(Wg / 2 - S / 2, S / 2, Wg / 2 + S / 2, Hh - 2 * ring_r + S / 2)
    oh = unary_union([ring, o_bar, o_stem])
    # 미: 왼쪽 ㅁ(막대 넷) · 오른쪽 ㅣ(온 높이)
    m_w, m_top, m_bot = Wg - S - 0.12 * Wg, Hh - 0.14 * Hh, 0.14 * Hh   # ㅁ — 0.60 · 온 높이 80%는 좁고 길어 「0」처럼 보였다
    mi = unary_union([T.bar(0, m_bot, S, m_top), T.bar(m_w - S, m_bot, m_w, m_top), T.bar(0, m_top - S, m_w, m_top), T.bar(0, m_bot, m_w, m_bot + S),
                      T.bar(Wg - S, 0, Wg, Hh)])
    tok = unary_union([g for _, g in T.strokes()])
    tdx, tdy, tr = T.dot()
    xs = [0, Wg + gap, 2 * (Wg + gap)]
    white = unary_union([translate(oh, xs[0]), translate(mi, xs[1]), translate(tok, xs[2])])
    dots = [(tdx + xs[2], tdy, tr)]
    return white, dots, xs[2] + Wg, Hh


def word_layer(right, base, height, scale=1.0, dot_scales=(1.0, 1.0), alpha=1.0, ss=4):
    """「오미톡」 RGBA 한 장(화면 크기). right · base는 낱말 오른쪽 끝 · 아랫변(px), height는 글자 높이(px)."""
    white, dots, wd, hh = word_geoms()
    k = height / hh * scale
    cxw, cyw = right - wd * height / hh / 2, base - height / 2   # 낱말 가운데(배율은 가운데 기준)
    can = np.zeros((H * ss, W * ss, 4), np.uint8)

    def px(pts):
        return np.array([[(cxw + (x - wd / 2) * k) * ss, (cyw - (y - hh / 2) * k) * ss] for x, y in pts], np.int32)

    for poly in getattr(white, "geoms", [white]):
        cv2.fillPoly(can, [px(poly.exterior.coords)], (255, 255, 255, int(255 * alpha)), lineType=cv2.LINE_AA)
        for hole in poly.interiors:
            cv2.fillPoly(can, [px(hole.coords)], (0, 0, 0, 0), lineType=cv2.LINE_AA)
    for (dx, dy, r), dsc in zip(dots, dot_scales):
        if dsc > 0:
            c = px([(dx, dy)])[0]
            cv2.circle(can, (int(c[0]), int(c[1])), int(r * k * dsc * ss), (RED[2], RED[1], RED[0], int(255 * alpha)), -1, lineType=cv2.LINE_AA)
    return cv2.resize(can, (W, H), interpolation=cv2.INTER_AREA)


def frames(variant):
    k, (tdx, tdy), tdr = mark_geom()
    cx, cy, mh = MARK
    seq = os.path.join(OUT, f"_층_{variant}")
    os.makedirs(seq, exist_ok=True)
    for f in os.listdir(seq):
        os.remove(os.path.join(seq, f))
    blank = np.zeros((H, W, 4), np.uint8)
    ok, blank_png = cv2.imencode(".png", blank)
    # 다섯 점(B): 오른쪽 위 코트 배경에 얕은 활꼴
    five = [(650 + 80 * j, 438 - 12 * np.sin(np.pi * j / 4)) for j in range(5)]   # 첫 판(600~)은 10.8초 렌즈로 다가온 캔 띠에 걸렸다(opus)
    five_r = 30.0   # 첫 판 21px은 휴대폰에서 장식 점으로 읽혔다
    gather0 = HIT - 6 / FPS
    for i in range(N):
        t = i / FPS
        layer = np.zeros((H, W, 4), np.uint8)
        # --- B: 다섯 음절마다 점 하나
        if variant == "B" and SYL[0] <= t < HIT + 1 / FPS:
            for j, (px, py) in enumerate(five):
                u = (t - SYL[j]) / (4 / FPS)
                if u < 0:
                    continue
                sc = ease(u) * (1.0 + 0.32 * np.exp(-max(0, t - SYL[j] - 4 / FPS) * 16) * np.cos(max(0, t - SYL[j] - 4 / FPS) * 24))
                ring, col = 1.0, None
                if t >= gather0:   # 「톡」 앞 여섯 장에 「톡」의 점 자리로 모이며 「톡」 점 크기 · 빨강으로 자라고 흰 테는 걷힌다
                    g = ease((t - gather0) / (6 / FPS))
                    px, py = px + (tdx - px) * g, py + (tdy - py) * g
                    sc *= 1.0 + (tdr / five_r - 1.0) * g
                    ring = 1.0 - g
                    ruby = tuple(int(RUBY[q:q + 2], 16) for q in (1, 3, 5))
                    col = tuple(int(ruby[c] + (RED[c] - ruby[c]) * g) for c in range(3))
                berry(layer, px, py, five_r * sc, ring=ring, color=col)
        # --- 「톡」 마크: 획 셋이 한 번에 흰색으로 켜진다(첫 판은 획이 하나씩 회색으로 켜져 11.3초 정지 장이 「E」 · 「꺼진 단추」로 읽혔다 — opus · Fable)
        S0 = HIT - 3 / FPS
        if S0 <= t < OUT_AT + 5 / FPS:
            grow = (1.10 - 0.10 * ease((t - S0) / (4 / FPS))) * (1.0 + 0.04 * min(1.0, max(0.0, t - S0) / (OUT_AT - S0)))   # 머무는 동안 조금씩 다가옴
            if t >= YELP:   # 비명 머리에 한 번 튕기며 빠진다
                grow *= 1.0 + 0.09 * np.sin(np.pi * min(1.0, (t - YELP) / (4 / FPS)))
            out_u = (t - OUT_AT) / (4 / FPS)
            alpha_all = 1.0 if out_u <= 0 else max(0.0, 1 - out_u)
            scale_out = 1.0 if out_u <= 0 else 1.0 - 0.08 * ease(out_u)
            shake = {JOLT: (8, -5), JOLT + 1: (-6, 3), JOLT + 2: (3, -1)}.get(i, (0, 0))
            mark = np.zeros((H, W, 4), np.uint8)
            a_in = min(1.0, (t - S0) / (2 / FPS) + 0.5)
            m = T.draw(W, H, cx, cy, mh, parts=["ㅌ", "ㅗ", "ㄱ"], dot_scale=0, scale=grow * scale_out, alpha=a_in * alpha_all, ss=2)
            over(mark, m)
            if alpha_all > 0:
                tp = t - HIT
                dot = None
                if variant == "A":
                    rise0 = HIT - 4 / FPS
                    if t >= rise0:
                        u = (t - rise0) / (4 / FPS)
                        dy = -2.4 * T.S * (1 - ease(u)) if u < 1 else 0.0
                        ds = max(0.55, min(1.0, 0.55 + u * 0.45)) * pop(tp)
                        dot = T.draw(W, H, cx, cy, mh, parts=[], dot_scale=ds, dot_dy=dy, scale=grow * scale_out, red=RED, ss=2)
                elif t >= HIT:   # B: 모인 점이 「톡」의 점이 된다
                    dot = T.draw(W, H, cx, cy, mh, parts=[], dot_scale=pop(tp), scale=grow * scale_out, red=RED, ss=2)
                if dot is not None:
                    dot[..., 3] = (dot[..., 3].astype(np.float32) * alpha_all).astype(np.uint8)
                    over(mark, dot)
            if shake != (0, 0):   # 움찔하는 장은 화면처럼 마크도 그 방향으로 번진다(Fable 「영상은 번지는데 마크는 또렷」)
                n_s = 7
                acc = np.zeros((H, W, 4), np.float32)
                for s_k in np.linspace(-0.5, 0.5, n_s):
                    acc += cv2.warpAffine(mark, np.float32([[1, 0, shake[0] * (1 + s_k)], [0, 1, shake[1] * (1 + s_k)]]), (W, H),
                                          flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0)).astype(np.float32)
                mark = (acc / n_s).astype(np.uint8)
            over(layer, mark)
        # --- 끝 「오미톡」: 「오미톡」의 끝 음절에 한 번에 놓고(22번 「한 방에 함께 켠다」), ㅗ의 빨간 점 둘이 「톡」처럼 차례로 튄다
        if t >= END_AT:
            a = min(1.0, (t - END_AT) / (1 / FPS) * 0.5 + 0.5)
            sc = 1.04 - 0.04 * ease((t - END_AT) / (5 / FPS))
            ds = []
            for d0 in (2 / FPS,):   # 「톡」의 빨간 점 하나만 튄다
                td = t - END_AT - d0
                ds.append(0.0 if td < 0 else ease(td / (3 / FPS)) * pop(td - 3 / FPS))
            over(layer, word_layer(LOCK_RIGHT, LOCK_BASE, LOCK_SIZE, scale=sc, dot_scales=ds, alpha=a))
        path = os.path.join(seq, f"{i:04d}.png")
        if layer[..., 3].any():
            ok, buf = cv2.imencode(".png", layer)
            buf.tofile(path)
        else:
            blank_png.tofile(path)
    return seq


def render(variant):
    seq = frames(variant)
    out = os.path.join(OUT, f"시안{variant}.mp4")
    vf = "[1:v]format=rgba[k];[0:v][k]overlay=0:0:shortest=1,scale=out_color_matrix=bt709,format=yuv420p[v]"
    C.run("ffmpeg", "-y", "-v", "error", "-i", FINAL, "-framerate", str(FPS), "-i", os.path.join(seq, "%04d.png"),
          "-filter_complex", vf, "-map", "[v]", "-map", "0:a", "-frames:v", str(N), "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-r", str(FPS),
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "copy", "-movflags", "+faststart", out)
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart", os.path.join(OUT, f"시안{variant}_폰.mp4"))
    print(out, f"{os.path.getsize(out) / 2**20:.1f} MiB")


if __name__ == "__main__":
    for v in sys.argv[1:] or ["A", "B"]:
        render(v)
