# 4번 「결채」 끝 화면의 뜻 한 줄을 글꼴이 아니라 도형으로 그린다(2026-11-07, Claude) — 유호님 「15초로 편집해」(11-07) 다시 편집 판.
# 원본 MARAH 끝 화면은 워드마크 밑에 작은 줄 하나(「inspired by nature」)가 2초 뒤 떠오른다. 30초 판은 「결채」만 두어 이름의 뜻이 없었다
#   (11-07 유호님 「뭘 말하려는지 내용이 이해가 안가네」). 작은 줄은 결채_로고.py와 같은 획 규칙 — 곧은 굵은 세로 · 가는 가로,
#   작은 크기라 대비를 낮추고(세로 12 · 가로 6 — 로고는 10.5 · 4.4) 획 끝은 평평하게 둔다(FLAT, 아래).
# 글자 칸 100 단위(y 위가 +). 시안 둘: A 「한 벌로 건너는 가을」 · B 「가을을 건너는 한 벌」 — Fable 11-07 B(끝 낱말이 제품이라 로고 밑 줄 구실).
#   python -X utf8 결채_한줄.py [출력 폴더]   → 흰 글자 PNG 둘 + 검은 바탕 미리 보기
import os
import sys

import numpy as np
from shapely import affinity
from shapely.ops import unary_union

import 결채_로고 as L

V2 = 12.0    # 굵은 세로획(작은 크기)
HL2 = 6.0    # 가는 가로획(작은 크기) — 40px 높이에서 2.4px
TRACK = 5.0  # 글자 사이
SPACE = 34.0 # 낱말 사이
FLAT = True  # 작은 줄은 획 끝을 평평하게 — 34px에서 능직 63° 자름이 둥근 끝처럼 뭉개져 「다른 손이 그린 두 글자」로 읽혔다(Fable 11-07).
             #   능직 자름은 큰 로고에만 남긴다


def h(x0, x1, y, cs=False, ce=True):
    if FLAT:
        cs = ce = False
    return L.hline(x0, x1, y, t=HL2, cut_start=cs, cut_end=ce)


def v(cx, y0, y1, foot=False, t=V2):
    return L.vstem(cx, y0, y1, t=t, cut_foot=foot and not FLAT)


def ring(cx, cy, rx, ry):
    return L._ring(cx, cy, rx, ry, V2 * 0.82, HL2)


J = V2 / 2 - 0.6   # 세로 기둥 반 폭(가로획을 기둥에 물릴 때)


def final_n(x, top=32):
    """받침 ㄴ — 세로를 내려 바닥 가로로 오른쪽"""
    return [v(x + 22, 8 - HL2 / 2, top), h(x + 22 - J, x + 88, 8)]


def final_r(x, top=40):
    """받침 ㄹ — 가로 셋 · 세로 둘(결채_로고의 결 받침과 같은 꼴)"""
    mid = (top + 8) / 2
    return [h(x + 18, x + 82 + J, top, cs=True, ce=False), v(x + 82, mid - HL2 / 2, top + HL2 / 2),
            h(x + 24 - J, x + 82 + J, mid, ce=False), v(x + 24, 8 - HL2 / 2, mid + HL2 / 2), h(x + 24 - J, x + 88, 8)]


def 한(x):
    return [v(x + 30, 90, 100, t=V2 * 0.8), h(x + 10, x + 50, 85, cs=True),          # ㅎ 꼭지 · 가로
            ring(x + 30, 66, 14.5, 10.5),                                           # ㅎ 고리
            v(x + 74, 42, 100, foot=True), h(x + 74 + J, x + 93, 71)] + final_n(x)   # ㅏ · 받침 ㄴ


def 벌(x):
    return [v(x + 14, 56 - HL2 / 2, 96), v(x + 46, 56 - HL2 / 2, 96), h(x + 14, x + 46, 76, ce=False),
            h(x + 14 - J, x + 46 + J, 56, ce=False),                                # ㅂ
            v(x + 80, 44, 100, foot=True), h(x + 58, x + 80 - J, 75, cs=True, ce=False)] + final_r(x)   # ㅓ · 받침 ㄹ


def 로(x):
    return [h(x + 18, x + 82 + J, 94, cs=True, ce=False), v(x + 82, 74 - HL2 / 2, 94 + HL2 / 2),
            h(x + 22 - J, x + 82 + J, 74, ce=False), v(x + 22, 54 - HL2 / 2, 74 + HL2 / 2), h(x + 22 - J, x + 86, 54),   # ㄹ
            v(x + 50, 20, 42, t=V2 * 0.9), h(x + 4, x + 96, 20, cs=True)]            # ㅗ


def 건(x):
    return [h(x + 8, x + 46 + J, 90, cs=True, ce=False), v(x + 46, 56, 90 + HL2 / 2, foot=True),   # ㄱ
            v(x + 80, 44, 100, foot=True), h(x + 60, x + 80 - J, 75, cs=True, ce=False)] + final_n(x)


def 너(x):
    return [v(x + 18, 26 - HL2 / 2, 88), h(x + 18 - J, x + 58, 26),                   # ㄴ
            v(x + 82, 4, 100, foot=True), h(x + 62, x + 82 - J, 55, cs=True, ce=False)]   # ㅓ — 기둥 발은 4(0이면 옆 글자 바닥보다 처졌다)


def 는(x):
    return [v(x + 24, 68 - HL2 / 2, 94), h(x + 24 - J, x + 80, 68),                   # ㄴ
            h(x + 4, x + 96, 47, cs=True)] + [v(x + 24, 8 - HL2 / 2, 28), h(x + 24 - J, x + 82, 8)]   # ㅡ · 받침 ㄴ


def 가(x):
    return [h(x + 8, x + 50 + J, 88, cs=True, ce=False), v(x + 50, 22, 88 + HL2 / 2, foot=True),   # ㄱ
            v(x + 76, 4, 100, foot=True), h(x + 76 + J, x + 96, 54)]                 # ㅏ


def 을(x):
    return [ring(x + 50, 82, 18, 12.5), h(x + 4, x + 96, 61, cs=True)] + final_r(x, top=46)


GLYPH = {"한": 한, "벌": 벌, "로": 로, "건": 건, "너": 너, "는": 는, "가": 가, "을": 을}
COPY = {"A": "한 벌로 건너는 가을", "B": "가을을 건너는 한 벌"}


def line(text):
    out, x = [], 0.0
    for ch in text:
        if ch == " ":
            x += SPACE - TRACK
            continue
        out += GLYPH[ch](x)
        x += 100 + TRACK
    return unary_union(out)


def render(which, height_px):
    return L.raster(line(COPY[which]), height_px)


def main():
    from PIL import Image
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "_로고")
    os.makedirs(out, exist_ok=True)
    word = L.raster(L.wordmark(), 176)
    rows = [word]
    for k in COPY:
        im = render(k, 34)
        Image.fromarray(im).save(os.path.join(out, f"한줄_{k}_흰.png"))
        rows.append(im)
        rows.append(render(k, 120))   # 크게 — 획 확인
    W = max(r.shape[1] for r in rows) + 120
    H = sum(r.shape[0] for r in rows) + 60 * len(rows) + 60
    bg = np.zeros((H, W, 3), np.float32)
    y = 60
    for r in rows:
        a = r[..., 3:4] / 255.0
        x = (W - r.shape[1]) // 2
        bg[y:y + r.shape[0], x:x + r.shape[1]] = bg[y:y + r.shape[0], x:x + r.shape[1]] * (1 - a) + r[..., :3] * a
        y += r.shape[0] + 60
    Image.fromarray(bg.astype(np.uint8)).save(os.path.join(out, "한줄_미리보기.png"))
    print(out)


if __name__ == "__main__":
    main()
