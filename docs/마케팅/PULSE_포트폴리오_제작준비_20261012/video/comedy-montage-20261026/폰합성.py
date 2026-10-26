# 12번 16컷 폰 화면 합성(2026-10-26) — Gemini가 구운 정지컷의 초록 화면(C16a 여행자 폰 · C16b 그의 폰과 여행자 폰)에
# 앱화면.py가 만든 「모두의코스」 화면 한 장을 원근대로 얹는다. 두 화면이 한눈에 같아 보이는 것이 16컷의 웃음 자리다(02_콘티 1절).
#   python -X utf8 폰합성.py C16a_g1.png C16b_g1.png  →  git 밖 콘티/p12/정지컷/<이름>_합성.png
# 초록 판은 채도 · 밝기가 높은 초록 덩어리 가운데 사각형에 가까운 것(넓이가 바깥 사각형의 80% 넘음)만 고른다 — 뒤의 나뭇잎은 어둡고 들쭉날쭉해 빠진다.
import sys
from pathlib import Path

import cv2
import numpy as np

P = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p12")
APP = P / "합성" / "앱화면.png"


def read(p):
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def order(pts):
    # 왼위 · 오른위 · 오른아래 · 왼아래
    s, d = pts.sum(1), np.diff(pts, axis=1).ravel()
    return np.float32([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]])


def screens(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (40, 110, 110), (85, 255, 255))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in cs:
        a = cv2.contourArea(c)
        if a < img.shape[0] * img.shape[1] * 0.002:
            continue
        r = cv2.minAreaRect(c)
        if a / max(r[1][0] * r[1][1], 1) < 0.8:
            continue
        # 폰 화면은 모서리가 둥글어 꼭짓점 넷으로 줄이면 안쪽으로 깎인다(C16b 첫 합성에 초록 띠가 남음) — 초록 전체를 감싸는 돌린 사각형을 쓴다
        out.append((a, order(np.float32(cv2.boxPoints(r)))))
    return [q for _, q in sorted(out, key=lambda x: -x[0])[:2]], m


def paste(img, quad, app):
    h, w = app.shape[:2]
    # 초록 테두리가 남지 않게 사각형을 가운데에서 2% 넓혀 덮는다
    c = quad.mean(0)
    quad = np.float32(c + (quad - c) * 1.02)
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), quad)
    warped = cv2.warpPerspective(app, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_AREA)
    mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), M, (img.shape[1], img.shape[0]))
    mask = cv2.GaussianBlur(cv2.erode(mask, np.ones((3, 3), np.uint8)), (3, 3), 0).astype(np.float32)[..., None] / 255
    # 저녁 장면이라 화면을 조금 낮추고 따뜻하게(폰 화면이 장면보다 튀지 않게)
    warped = np.clip(warped.astype(np.float32) * np.float32([0.86, 0.9, 0.95]), 0, 255)
    return (img * (1 - mask) + warped * mask).astype(np.uint8)


if __name__ == "__main__":
    app = read(APP)
    for name in sys.argv[1:]:
        src = P / "정지컷" / name
        img = read(src)
        qs, m = screens(img)
        print(name, "초록 화면", len(qs), [q.astype(int).tolist() for q in qs])
        if not qs:
            continue
        band = np.zeros(img.shape[:2], np.uint8)
        for q in qs:
            img = paste(img, q, app)
            cv2.fillConvexPoly(band, np.int32(q), 255)
        # 초록 번짐은 화면 테두리 띠에서만 눌러 준다(앱 화면 안의 민트색 · 뒤의 나뭇잎 초록은 그대로)
        band = cv2.dilate(band, np.ones((15, 15), np.uint8)) & ~cv2.erode(band, np.ones((15, 15), np.uint8))
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        spill = cv2.inRange(hsv, (40, 110, 110), (85, 255, 255)) & band
        hsv[..., 1][spill > 0] = 20
        img = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        out = src.with_name(src.stem + "_합성.png")
        cv2.imencode(".png", img)[1].tofile(str(out))
        print(" ->", out)
