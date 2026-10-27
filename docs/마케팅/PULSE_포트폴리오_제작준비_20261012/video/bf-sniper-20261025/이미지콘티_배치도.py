# 블프 스나이퍼 이미지 콘티의 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 「매진 임박」 v4(S31) · 6번 연말 빈방과 같은 길:
# 원본 배우의 얼굴 · 몸 · 옷이 옮겨 오지 않게 사람 자리만 검은 실루엣(밝은 회색 바탕)으로 두거나, 사람 없는 접사는 크게 흐린다.
# 원본 장소(매장 · 현관 · 포장대)는 우리 장소(거실 · 현관 · 욕실)와 달라서 원본 방을 흐려 넣지 않고 실루엣과 큰 소품 윤곽만 둔다.
#   python -X utf8 이미지콘티_배치도.py 프레임   → 원본첫프레임/K??.png(컷마다 대표 프레임 — 첫 프레임에 사람이 덜 보이는 3 · 8은 중간)
#   python -X utf8 이미지콘티_배치도.py 실루엣   → 배치/S??_실루엣.png · _확인/S??.jpg(사람 컷)
#   python -X utf8 이미지콘티_배치도.py 흐림     → 배치/S??_흐림.png(달력 · 손 접사)
#   python -X utf8 이미지콘티_배치도.py 틀       → 배치/S??_틀.png(흐린 원본 + 실루엣 — 앞 소품이 짜임을 잡는 4 · 6 · 17, 실루엣 뒤에)
#   python -X utf8 이미지콘티_배치도.py 링       → 배치/S04_링.png · S17_링.png(코드로 그린 링 라이트 + 우리 판에서 딴 실루엣, 10-27)
# 원본 프레임 · 배치도는 git 밖(synk-vendor/pulse-season4-20261025/콘티/bf-sniper/)에만 둔다.
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper")
SRC = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/레퍼런스/bf-sniper/원본영상/vm_74699350/vm_74699350.mp4")
F = V / "원본첫프레임"
OUT = V / "배치"
W, H = 1920, 1080
# 컷마다 대표 프레임 시각(원본 2011년판 초) — 컷 시작 + 0.1초, 3 · 8은 사람이 들어온 뒤
KEY = {2: 1.12, 3: 4.80, 4: 5.39, 5: 7.73, 6: 8.73, 7: 10.57, 8: 14.85, 9: 15.21, 10: 16.80, 11: 17.33, 12: 18.00,
       13: 19.00, 14: 19.50, 15: 20.80, 16: 21.45, 17: 23.15, 18: 25.40, 19: 26.30}
PEOPLE = [3, 4, 6, 7, 8, 9, 11, 14, 16, 17]
CLOSE = [2, 5, 10, 12, 13, 15, 18]


def imread(p):   # cv2.imread는 한글 경로를 못 읽는다
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img)
    buf.tofile(str(p))


def frames():
    F.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(SRC))
    for n, t in KEY.items():
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, fr = cap.read()
        imwrite(F / f"K{n:02d}.png", cv2.resize(fr, (W, H), interpolation=cv2.INTER_CUBIC))
    print("대표 프레임", len(KEY))


_ses = None


def person_mask(img):
    global _ses
    from rembg import new_session, remove
    _ses = _ses or new_session("u2net_human_seg")
    m = np.asarray(remove(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), session=_ses, only_mask=True)).astype(np.float32) / 255
    m = (m > 0.5).astype(np.uint8) * 255
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))


def silhouettes():
    (OUT / "_확인").mkdir(parents=True, exist_ok=True)
    for n in PEOPLE:
        img = imread(F / f"K{n:02d}.png")
        m = person_mask(img)
        if n in (4, 17):   # 원본의 지나가는 손님(앞 흐림)은 지운다 — 가장 큰 덩어리(주인공)만 남김
            k, lab, st, _ = cv2.connectedComponentsWithStats(m)
            if k > 2:
                cx = W / 2
                best = min(range(1, k), key=lambda i: abs(st[i][0] + st[i][2] / 2 - cx) - st[i][4] / 1e5)
                m = np.where(lab == best, 255, 0).astype(np.uint8)
        imwrite(OUT / f"S{n:02d}_mask.png", m)
        out = np.full((H, W, 3), 205, np.uint8)
        out[m > 0] = (18, 18, 18)
        imwrite(OUT / f"S{n:02d}_실루엣.png", out)
        dbg = img.copy()
        dbg[m > 0] = (dbg[m > 0] * 0.4 + np.array([0, 0, 255]) * 0.6).astype(np.uint8)
        imwrite(OUT / "_확인" / f"S{n:02d}.jpg", cv2.resize(dbg, (960, 540)))
        ys, xs = np.nonzero(m)
        box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) else None
        print(n, f"사람 {round((m > 0).mean() * 100, 1)}%", "상자", box)


def blurred():
    OUT.mkdir(parents=True, exist_ok=True)
    for n in CLOSE:
        img = imread(F / f"K{n:02d}.png")
        imwrite(OUT / f"S{n:02d}_흐림.png", cv2.GaussianBlur(img, (0, 0), 14))
    print("흐린 접사", len(CLOSE))


# 앞 소품이 짜임을 잡는 컷(4 · 17 링 라이트 원 · 6 앞의 트로피 셋)은 흐린 원본 위에 실루엣을 얹어 소품 자리까지 넘긴다
FRAMED = [4, 6, 17]


def framed():
    for n in FRAMED:
        img = cv2.GaussianBlur(imread(F / f"K{n:02d}.png"), (0, 0), 10)
        m = imread(OUT / f"S{n:02d}_mask.png")[:, :, 0]
        img[m > 0] = (18, 18, 18)
        imwrite(OUT / f"S{n:02d}_틀.png", img)
    print("소품 틀", len(FRAMED))


# 10-27 링 배치도 — 실루엣 · 틀로는 Gemini가 링을 화면 폭의 72~75%로 키워(원본 원은 가운데 x≈52% · 바깥 지름 약 50%),
# 링 자체를 코드로 정확한 자리 · 크기에 그리고, 사람 자리는 우리 판(17 S17_160442 · 4 S04_180024)의 준호에서 딴 실루엣을 둔다.
RING_C, RING_R, RING_BAND = (0.52, 0.50), 0.26, 0.13   # 가운데(폭 · 높이 비), 바깥 반지름(폭 비), 띠 두께(반지름 비)
RING_SRC = {4: "S04_180024.jpg", 17: "S17_160442.jpg"}   # 17은 다리가 책상에 안 가린 판


def ring():
    cx, cy, R = int(W * RING_C[0]), int(H * RING_C[1]), int(W * RING_R)
    r = int(R * (1 - RING_BAND))
    # 두 판에서 링 크기가 거의 같아(72 · 74%) 같은 배율로 줄인다 — 서 있는 17번 키가 링 바깥 지름의 60%
    s = None
    for n in (17, 4):
        img = imread(V / "받음" / RING_SRC[n])
        img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
        m = person_mask(img)
        k, lab, st, _ = cv2.connectedComponentsWithStats(m)
        m = np.where(lab == 1 + int(np.argmax(st[1:, 4])), 255, 0).astype(np.uint8)
        ys, xs = np.nonzero(m)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
        s = s or 0.6 * 2 * R / (y1 - y0)
        crop = cv2.resize(m[y0:y1 + 1, x0:x1 + 1], None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        out = np.full((H, W, 3), 205, np.uint8)
        glow = np.zeros((H, W), np.float32)
        cv2.circle(glow, (cx, cy), (R + r) // 2, 1.0, R - r)
        glow = np.maximum(glow, cv2.GaussianBlur(glow, (0, 0), 18) * 0.8)
        out = (out * (1 - glow[..., None]) + 252 * glow[..., None]).astype(np.uint8)
        ch, cw = crop.shape
        fx, fy = cx - cw // 2, int(H * 0.88) - ch   # 발은 링 안쪽 아래 가까이
        sub = out[fy:fy + ch, fx:fx + cw]
        sub[crop > 127] = (18, 18, 18)
        imwrite(OUT / f"S{n:02d}_링.png", out)
        print(n, "링 가운데", (cx, cy), "바깥 지름", 2 * R, f"({2 * R / W:.0%} 폭)", "사람 키", ch, f"({ch / (2 * R):.0%} 링)")


if __name__ == "__main__":
    {"프레임": frames, "실루엣": silhouettes, "흐림": blurred, "틀": framed, "링": ring}[sys.argv[1]]()
