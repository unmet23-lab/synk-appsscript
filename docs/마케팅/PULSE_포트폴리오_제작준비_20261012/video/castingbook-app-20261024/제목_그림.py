# 8번 제목 「손님을 / 부르는 / 모델」 그린 글자 시안(2026-11-07, Claude — v3 Fable 2차 「한 글꼴 균일 굵기 · 글꼴로 친 문장」, 슬롭 점검표 24번).
# 원본 「나를 / 움직이는 / 탐색」은 손으로 오린 듯한 덩이 글자다. 카페 사장이 직접 만든 가게 광고라는 이야기에 맞춰 두꺼운 종이를 가위로 오린 글자로 그린다
# (손님을 · 부르는 = 흰 종이, 모델 = PULSE 베리 종이). GPT 2.5(구독 경로)로 초록 바탕에 굽고 → 초록을 빼 투명 PNG → 줄마다 덩이 셋으로 잘라 P8.tsx가 띄운다.
#   python -X utf8 제목_그림.py 굽기 [이름]        → git 밖 최종/p8/제목/<이름>.png(기본 T_r<n>)
#   python -X utf8 제목_그림.py 오리기 <그림.png>  → 최종/자막시안_public/p8/title-1 · 2 · 3.png(덩이마다 투명 PNG) · 최종/p8/제목/<이름>_덩이.json · _미리보기.jpg
import json
import os
import subprocess
import sys

import cv2
import numpy as np

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종"
OUT = os.path.join(ROOT, "p8", "제목")
PUB = os.path.join(ROOT, "자막시안_public", "p8")

PROMPT = (
    "Hand-made Korean title lettering photographed flat from straight above on a flat, evenly lit, pure chroma-green background (#00FF00). Nothing else in the image — "
    "no table, no props, no hands, and no shadows on the green background.\n\n"
    "Three Korean words in three stacked lines, left-aligned, every line tilted the same way, rising to the right by about 10 degrees:\n"
    "line 1 (smaller): 손님을\n"
    "line 2 (bigger): 부르는\n"
    "line 3 (biggest): 모델\n\n"
    "Every letter is cut out by hand with scissors from thick matte paper card — 손님을 and 부르는 from warm off-white card, 모델 from deep berry-red card (#99295D). "
    "Bold, chunky, confident shapes like a hand-cut collage title on a magazine cover: each glyph a little different in size, weight and tilt, with clean but not perfectly straight "
    "scissor-cut edges, a thin visible paper edge, and a fine paper-fiber texture. Strokes are thick and the counters stay open so every letter reads clearly from far away.\n\n"
    "The Hangul must be spelled exactly 손님을 / 부르는 / 모델 — correct Korean letters, nothing missing, no extra strokes, no other text, letters or numbers anywhere. "
    "The lettering fills most of the image with a clear gap between the lines. Horizontal 16:9.")


def bake(name=None):
    os.makedirs(OUT, exist_ok=True)
    if not name:
        n = 1
        while os.path.exists(os.path.join(OUT, f"T_r{n}.png")):
            n += 1
        name = f"T_r{n}"
    txt = os.path.join(OUT, "제목_지시문.txt")
    open(txt, "w", encoding="utf-8").write(PROMPT)
    out = os.path.join(OUT, name + ".png")
    subprocess.run(["node", os.path.join(REPO, "tools", "GPT콘티굽기.mjs"), txt, out, "--크기", "2048x1152"], check=True)
    print(out)


def key(img):
    """초록 빼기 — 초록 우세(G − max(R, B))로 알파, 가장자리 초록 번짐은 G를 max(R, B)로 눌러 지운다."""
    f = img.astype(np.float32)
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    chroma = g - np.maximum(r, b)
    a = 1 - np.clip((chroma - 28) / (90 - 28), 0, 1)            # 28 아래는 종이, 90 위는 바탕
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    g2 = np.where(chroma > 0, np.maximum(r, b) + np.minimum(chroma, 6), g)   # 남은 초록기를 누름(종이 흰색은 거의 그대로)
    out = np.dstack([b, g2, r, a * 255]).clip(0, 255).astype(np.uint8)
    return out


def cut(path):
    img = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_COLOR)   # 한글 경로는 OpenCV 읽기가 None을 준다
    rgba = key(img)
    a = rgba[..., 3]
    n, lab, st, cen = cv2.connectedComponentsWithStats((a > 128).astype(np.uint8), 8)
    big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.0004 * a.size]
    H, W = a.shape
    # 줄 나누기 — 한글은 낱자가 따로 떨어진 조각이라 가운데 높이 간격으로는 안 갈린다(첫 판이 14 · 4 · 1조각으로 잘못 묶음).
    # ① 「모델」은 베리 종이 — 색으로 뗀다. ② 흰 두 줄은 기울기(오른쪽으로 오름)를 바로잡은 높이 구간 [최소, 최대]가 겹치는 조각끼리 잇고, 두 묶음이 되는 기울기를 찾는다.
    yy, xx = np.indices((H, W))
    red = []
    for i in big:
        m = lab == i
        bgr = img[m].mean(0)
        if bgr[2] > bgr[1] + 40 and bgr[2] > bgr[0] + 15:
            red.append(i)
    white = [i for i in big if i not in red]

    def merge(th):
        k = yy + np.tan(np.radians(th)) * xx
        iv = sorted((float(k[lab == i].min()), float(k[lab == i].max()), i) for i in white)
        gs, hi = [], -1e9
        for lo, h, i in iv:
            if lo > hi + 6:
                gs.append([])
            gs[-1].append(i)
            hi = max(hi, h)
        return gs

    best = None
    for th in np.arange(4, 16.5, 0.5):
        gs = merge(th)
        if len(gs) == 2 and (best is None or min(len(g) for g in gs) > min(len(g) for g in best[1])):
            best = (th, gs)
    if best is None:
        raise SystemExit(f"흰 글자 줄이 둘로 안 갈림 — 조각 {len(white)}개")
    groups = [best[1][0], best[1][1], red]
    print(f"기울기 {best[0]}° · 흰 줄 {[len(g) for g in best[1]]}조각 · 베리 {len(red)}조각")
    os.makedirs(PUB, exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]
    info = []
    for gi, ids in enumerate(groups, 1):
        m = np.isin(lab, ids)
        m = cv2.dilate(m.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0   # 가장자리 반투명까지
        ys_, xs_ = np.where(m)
        x0, x1, y0, y1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
        piece = rgba[y0:y1, x0:x1].copy()
        piece[..., 3] = (piece[..., 3] * m[y0:y1, x0:x1]).astype(np.uint8)
        cv2.imencode(".png", piece)[1].tofile(os.path.join(PUB, f"title-{gi}.png"))
        info.append({"덩이": gi, "x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0), "조각": len(ids)})
    json.dump({"그림": path, "크기": [W, H], "덩이": info}, open(os.path.join(OUT, base + "_덩이.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # 미리 보기 — 회색 바둑판 위에 투명 그림
    chk = ((np.indices((H, W)).sum(0) // 32) % 2 * 40 + 90).astype(np.uint8)
    bg = cv2.merge([chk, chk, chk]).astype(np.float32)
    al = rgba[..., 3:4].astype(np.float32) / 255
    prev = (rgba[..., :3] * al + bg * (1 - al)).astype(np.uint8)
    cv2.imencode(".jpg", cv2.resize(prev, (W // 2, H // 2)), [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(os.path.join(OUT, base + "_미리보기.jpg"))
    print(json.dumps(info, ensure_ascii=False))


if __name__ == "__main__":
    what = sys.argv[1]
    if what == "굽기":
        bake(sys.argv[2] if len(sys.argv) > 2 else None)
    elif what == "오리기":
        cut(sys.argv[2])
