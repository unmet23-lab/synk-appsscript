# 블프 세일 「힘껏」 LED 전광판 층(2026-11-10, Claude) — 시안 A 「전광판으로」.
# 폰트 정본 §10-2 강조 글 「장면 안 실재 물건 · 재질 CG(전광판 …)」 · 크몽 t2 「매진 임박」 LED 전광판(11-07 승인)의 길.
# 스핀 스튜디오 벽 화면(① 전광판 · ⑥ 간판 · ⑬ 끝 벽)과 ② 글자 카드를 같은 LED 점 화면으로 맞춘다 — 글꼴로 친 글 + 빛 번짐(CSS 글로)이 아니라
# 낮은 해상도의 점(실제 전광판처럼 글자를 점에 찍음)이 켜지고, 빛 번짐은 켜진 점에서만 나온다.
#   python -X utf8 LED.py   → 자막시안_public/s3/led/*.png (Remotion이 mix-blend-mode: screen으로 얹는다)
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely import affinity  # noqa: E402
from shapely.geometry import MultiPolygon  # noqa: E402

import 로고  # noqa: E402
from 글자윤곽 import 맞춤  # noqa: E402

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/s3/led"
KO_B = "C:/Windows/Fonts/NotoSansKR-VF.ttf"

AMBER = (255, 178, 70)
CREAM = (255, 236, 214)
DAHONG = (255, 84, 36)

# ── 숫자 · 기호 7줄 점 글꼴(전광판 흔한 꼴, 폭 5) ─────────────────────────
F5 = {
    "0": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    ":": ["0", "1", "1", "0", "1", "1", "0"],
    "%": ["11000", "11001", "00010", "00100", "01000", "10011", "00011"],
}


def 점글자(s, k=1):
    """7줄 점 글꼴로 줄을 만든다(k배 — 큰 숫자는 점 하나를 k×k로)."""
    cols = []
    for i, ch in enumerate(s):
        g = F5[ch]
        w = len(g[0])
        block = np.array([[c == "1" for c in row] for row in g], dtype=bool)
        if i:
            cols.append(np.zeros((7, 1), dtype=bool))
        cols.append(block)
    a = np.concatenate(cols, axis=1)
    return np.kron(a, np.ones((k, k), dtype=bool))


def 한글점(text, size, wght=500):
    """한글을 점으로 — 실제 한글 전광판처럼 작은 크기 비트맵(안티에일리어싱 없이)으로 찍는다.
    11-10 시험: 크기를 4배로 그려 줄이면 획이 뭉개져 「자정까지」가 「자쩡마지」로 읽혔다 → 그 크기 그대로 1비트로 그린다.
    size 16 · wght 500 = 15줄, 18 · 500 = 17줄, 13 · 500 = 12줄(11-10 비교판에서 가장 또렷)."""
    f = ImageFont.truetype(KO_B, size=size)
    f.set_variation_by_axes([wght])
    box = f.getbbox(text)
    img = Image.new("1", (box[2] - box[0] + 4, box[3] - box[1] + 4), 0)
    d = ImageDraw.Draw(img)
    d.fontmode = "1"
    d.text((2 - box[0], 2 - box[1]), text, font=f, fill=1)
    a = np.array(img, dtype=bool)
    ys = np.where(a.any(axis=1))[0]
    xs = np.where(a.any(axis=0))[0]
    return a[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]


def 도형점(g, rows, thr=0.45):
    """shapely 도형(로고 · 70%)을 rows줄 높이의 점으로."""
    from 글자윤곽 import 마스크
    minx, miny, maxx, maxy = g.bounds
    s = rows * 6 / (maxy - miny)
    W = int((maxx - minx) * s) + 12
    m = 마스크(g, W, rows * 6 + 12, 6, 6, s)
    small = m.resize((max(1, W // 6), rows + 2), Image.BOX)
    a = np.asarray(small, dtype=np.float32) / 255.0 > thr
    ys = np.where(a.any(axis=1))[0]
    xs = np.where(a.any(axis=0))[0]
    return a[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]


# ── 그리기 ───────────────────────────────────────────────────────────────
def 판(cols, rows):
    return np.zeros((rows, cols, 3), dtype=np.float32)


def 찍기(board, lit, r0, c0, color):
    h, w = lit.shape
    sub = board[r0: r0 + h, c0: c0 + w]
    sub[lit] = np.array(color, dtype=np.float32) / 255.0
    return board


def 가운데(cols, w):
    return (cols - w) // 2


def 그림(board, pitch, unlit=True, seed=7, glow=1.0, bg=(8, 7, 12), out_alpha=False, gain=1.0):
    """점 판(rows×cols×색, 0이면 꺼짐)을 사진 같은 LED 화면으로. 켜진 점: 뜨거운 가운데 → 색 → 가장자리, 빛 번짐은 켜진 점에서만."""
    rng = np.random.default_rng(seed)
    rows, cols, _ = board.shape
    W, H = cols * pitch, rows * pitch
    yy, xx = np.mgrid[0:pitch, 0:pitch].astype(np.float32)
    c = (pitch - 1) / 2
    d = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (pitch * 0.5)
    rad = 0.74
    lens = np.clip(1 - (d / rad) ** 2, 0, 1)                 # 점 렌즈 모양
    core = np.exp(-(d / (rad * 0.42)) ** 2)                    # 가운데 뜨거운 곳
    spec = np.exp(-(((xx - c + pitch * 0.14) ** 2 + (yy - c + pitch * 0.16) ** 2) / (pitch * 0.09) ** 2))
    emit = np.zeros((H, W, 3), dtype=np.float32)
    base = np.zeros((H, W, 3), dtype=np.float32)
    base[:] = np.array(bg, dtype=np.float32) / 255.0
    var = 1 + rng.normal(0, 0.06, size=(rows, cols)).astype(np.float32)
    dead = rng.random((rows, cols)) < 0.0015
    for r in range(rows):
        for q in range(cols):
            y0, x0 = r * pitch, q * pitch
            col = board[r, q]
            if unlit:
                # 꺼진 점: 어두운 연기빛 렌즈 + 아주 작은 반사
                base[y0: y0 + pitch, x0: x0 + pitch] += (lens[..., None] * np.array([0.05, 0.045, 0.06]) + spec[..., None] * 0.05)
            if col.any() and not dead[r, q]:
                k = var[r, q]
                e = lens[..., None] * col * 0.85 * k + core[..., None] * (0.55 * col + 0.45) * k
                emit[y0: y0 + pitch, x0: x0 + pitch] += e
    # 빛 번짐 — 좁게 · 넓게 두 겹(켜진 점에서만)
    em = Image.fromarray(np.clip(emit * 255, 0, 255).astype(np.uint8))
    b1 = np.asarray(em.filter(ImageFilter.GaussianBlur(pitch * 0.9)), dtype=np.float32) / 255.0
    b2 = np.asarray(em.filter(ImageFilter.GaussianBlur(pitch * 3.2)), dtype=np.float32) / 255.0
    light = (emit + glow * (0.55 * b1 + 0.45 * b2)) * gain
    if out_alpha:
        # 화면(검은 벽 화면) 위에 screen으로 얹을 층 — 빛만
        return Image.fromarray(np.clip(light * 255, 0, 255).astype(np.uint8))
    img = 1 - (1 - base) * (1 - np.clip(light, 0, 1))
    return Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8))


def 칠십점(k=4):
    """「70%」 — 7 · 0은 5×7 점 글꼴을 k배(획 k점), %는 속 빈 두 고리와 사선을 점 격자에 바로 찍는다(5×7의 %는 동그라미가 막힌 네모가 된다)."""
    seven = 점글자("7", k)
    zero = 점글자("0", k)
    h = 7 * k
    w = 5 * k + 1
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32) + 0.5
    pct = np.zeros((h, w), dtype=bool)
    ro, ri = 1.55 * k, 0.62 * k            # 고리 바깥 · 안쪽 반지름(점)
    for cx, cy in ((ro, ro), (w - ro, h - ro)):
        d = np.hypot(xx - cx, yy - cy)
        pct |= (d <= ro) & (d >= ri)
    # 사선 — 오른쪽 위에서 왼쪽 아래로, 굵기 k점
    x0, y0, x1, y1 = w - 0.6 * k, 0.4 * k, 0.6 * k, h - 0.4 * k
    t = np.clip(((xx - x0) * (x1 - x0) + (yy - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2), 0, 1)
    dist = np.hypot(xx - (x0 + t * (x1 - x0)), yy - (y0 + t * (y1 - y0)))
    pct |= dist <= k * 0.52
    gap = np.zeros((h, k), dtype=bool)
    return np.concatenate([seven, gap, zero, gap, pct], axis=1)


def 테(img, pitch, top=12, bottom=12, seam=16):
    """가까이 찍은 전광판 — 위아래 몇 줄을 점 없는 검은 몸통(가는 모서리 빛)으로, 모듈 이음(seam점마다)을 아주 옅은 어둔 줄로."""
    a = np.asarray(img, dtype=np.float32) / 255.0
    H, W, _ = a.shape
    yt, yb = top * pitch, H - bottom * pitch
    body = np.array([0.035, 0.033, 0.04], dtype=np.float32)
    grain = np.random.default_rng(3).normal(0, 0.006, size=(H, W, 1)).astype(np.float32)
    a[:yt] = body + grain[:yt]
    a[yb:] = body + grain[yb:]
    # 모서리 빛 — 몸통과 점판이 만나는 곳에 가는 밝은 선(금속 테 모서리)
    for y, k in ((yt - 2, 0.16), (yt - 1, 0.08), (yb, 0.14), (yb + 1, 0.06)):
        a[y] = np.clip(a[y] + k * np.array([0.9, 0.85, 1.0]), 0, 1)
    # 모듈 이음 — seam점마다 아주 옅게
    for c in range(seam * pitch, W, seam * pitch):
        a[yt:yb, c - 1: c + 1] *= 0.55
    for r in range(yt + seam * pitch, yb, seam * pitch):
        a[r - 1: r + 1, :] *= 0.55
    return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))


# ── 만들 것 ──────────────────────────────────────────────────────────────
def 카드():
    """② 글자 카드 — 화면 가득한 LED 판 가까이: 「자정까지」 · 「전 품목」 · 「70%」(팡에 켜짐), 줄마다 따로 켜려고 층을 나눈다.
    11-10 맹검 1차(고쳐서 냄 5): 「70%」를 매끈한 윤곽에서 찍어 점이 구슬처럼 휘고, 「오늘 자정까지」가 가늘어 1.4초에 덜 읽히고,
    글줄이 판을 당긴 뒤 오른쪽 끝에 붙었다 → 「70%」는 실제 전광판 숫자처럼 5×7 점 글꼴을 4배(획 넷 점 고른 두께)로,
    첫 줄은 내레이션 「자정까지!」대로 두 점 굵기 18줄로 키우고, 가장 넓은 줄도 판 폭의 65% 안 · 판이 오른쪽으로 가는 만큼(4점) 왼쪽에 둔다."""
    # 11-10 맹검 2차(고쳐서 냄 7): %의 동그라미가 막힌 네모 점 · 「까」 「품」 획 두께가 들쭉날쭉 · 「70%」가 「전 품목」보다 어두움 ·
    # 테 · 조명 반사 없는 평면 배경 같음 → 두 줄 모두 19/600(두 점 획이 가장 고른 값, 비교판), %는 속 빈 고리로 직접 찍고,
    # 「70%」를 가장 밝게, 판 위아래에 전광판 테(점 없는 검은 몸통 + 모서리 빛)와 모듈 이음을 넣는다
    cols, rows, pitch = 108, 192, 10   # 1080×1920
    l1 = 한글점("자정까지", 19, 600)   # 18줄
    l2 = 한글점("전 품목", 19, 600)    # 18줄
    big = 칠십점(4)                    # 28줄
    g1, g2 = 6, 11   # 줄 사이(점)
    total = l1.shape[0] + g1 + l2.shape[0] + g2 + big.shape[0]
    r1 = (rows - total) // 2 - 4          # 살짝 위로(아래는 릴스 · 쇼츠 글 자리)
    r2 = r1 + l1.shape[0] + g1
    r3 = r2 + l2.shape[0] + g2
    left = lambda w: 가운데(cols, w) - 2   # ②는 판이 오른쪽으로 40px(4점) 간다 — 반만큼 왼쪽에
    layers = {}
    for name, lit, r0, color in (("l1", l1, r1, AMBER), ("l2", l2, r2, CREAM), ("70", big, r3, (255, 96, 40))):
        L = 판(cols, rows)
        찍기(L, lit, r0, left(lit.shape[1]), color)
        layers[name] = L
    os.makedirs(OUT, exist_ok=True)
    fit = lambda im: im.resize((1080, 1920), Image.LANCZOS)
    base = 그림(판(cols, rows), pitch, unlit=True)
    fit(테(base, pitch, top=13, bottom=14)).save(f"{OUT}/card_base.png")
    fit(그림(layers["l1"], pitch, unlit=False, out_alpha=True, gain=1.15)).save(f"{OUT}/card_l1.png")
    fit(그림(layers["l2"], pitch, unlit=False, out_alpha=True, gain=1.0)).save(f"{OUT}/card_l2.png")
    fit(그림(layers["70"], pitch, unlit=False, out_alpha=True, glow=1.3, gain=2.0)).save(f"{OUT}/card_70.png")
    for old in ("card_head.png", "card_flash.png"):   # 11-10 1차 판의 층(이제 안 씀)
        if os.path.exists(f"{OUT}/{old}"):
            os.remove(f"{OUT}/{old}")
    return {"cols": cols, "rows": rows, "pitch": pitch, "r1": int(r1), "r2": int(r2), "r3": int(r3), "l1_cols": int(l1.shape[1]), "big_cols": int(big.shape[1])}


def 벽(name, w, h, pitch, lines, gain=1.45):
    """벽 화면 한 장(검은 화면 위에 screen으로 얹을 빛 층). lines: [(점 배열, 색, 위 줄)…] — 가운데 정렬."""
    cols, rows = int(w // pitch), int(h // pitch)
    B = 판(cols, rows)
    for lit, color, r0 in lines:
        찍기(B, lit, r0, 가운데(cols, lit.shape[1]), color)
    img = 그림(B, pitch, unlit=False, out_alpha=True, glow=1.25, gain=gain)
    img.save(f"{OUT}/{name}.png")
    return cols, rows


def 벽들():
    made = {}
    # ① 전광판(442×277 · 55줄) — 시계만, 강사 머리 위 줄에(3 ~ 17줄). 11-10 맹검 2차: 「자정까지」를 크게 올리자 시계 가운데 「59:」가
    # 머리에 가려 「기각 4」(지금 판은 시계가 머리 위라 이김) — 내레이션이 「자정까지!」를 외치고 바로 다음 ② 카드 첫 줄이 「자정까지」라 벽은 숫자만
    # 맹검 3차: 숫자만 두면 「마감 단서가 없어 운동 타이머처럼 읽힘」 → 작은 「자정까지」(9줄)를 시계 위에 — 둘 다 머리 위(1 ~ 26줄)
    head = 한글점("자정까지", 10, 600)
    for s in ("00:59:59", "00:59:58", "00:59:46", "00:59:45", "00:59:44", "00:59:55", "00:59:54"):
        clk = 점글자(s, 2)
        cols, rows = 벽(f"clock_{s.replace(':', '')}", 442, 277, 5, [(head, AMBER, 1), (clk, CREAM, 1 + head.shape[0] + 2)], gain=1.75)
        made[s] = [cols, rows]
    # ⑥ 간판(642×376 · 62줄) — 남은 초 두 자리를 넘기다 로고. ⑥ 컷은 사람 다시 얹기 가면이 없어(벽 화면 아래쪽에 채원 머리가 들어옴, 46줄쯤부터)
    # 글은 위 42줄 안에만 둔다 — 11-10 1차 판(로고 36줄 · 가운데)은 머리카락 위에 점이 비쳤다
    for s in ("59", "57", "54", "51"):
        big = 점글자(s, 4)
        벽(f"sign_{s}", 642, 376, 6, [(big, CREAM, 8)])
    w70 = 칠십점(3)   # ② 카드와 같은 점 숫자(11-10 맹검 — 매끈한 윤곽을 찍은 점은 구슬처럼 휨)
    hd = 한글점("전 품목", 16, 700)
    벽("wall_70", 438, 257, 5, [(hd, CREAM, 6), (w70, DAHONG, 6 + hd.shape[0] + 5)])
    # 11-10 맹검 2차 「넓은 화면에 비해 글자가 작고 어둡다」 → 30줄 · 더 밝게. 맹검 3차: 홈 고리가 있는 원판을 점으로 찍으면 ㅎ 속이 지저분하게 깨진다 →
    # LED 판은 홈 없는 속 찬 원판(축 구멍만)으로 찍는다(점 화면에서는 가는 홈이 안 선다)
    logo = 도형점(로고.힘껏(groove=None), 30)
    벽("sign_logo", 642, 376, 6, [(logo, DAHONG, 6)], gain=1.95)
    return made


def main():
    info = {"card": 카드(), "walls": 벽들()}
    json.dump(info, open(os.path.join(OUT, "_info.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(OUT)


if __name__ == "__main__":
    main()
