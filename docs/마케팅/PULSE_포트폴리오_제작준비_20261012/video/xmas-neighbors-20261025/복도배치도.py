# 시즌 1 「옆집의 크리스마스」 복도 고정 와이드(1 · 12 · 20 · 26 · 35)의 원근 배치도(2026-10-26).
# 원본 1의 사람 자리(머리 34% · 발 70% · 가로 40~49%)에 민재가 오도록 카메라를 잰다 — 눈높이 1.5 m · 28 mm(16:9) · 지평선 42%,
# 복도 폭 1.6 m, 민재는 왼쪽 벽 문(503) 앞 6.8 m(벽에서 0.35 m)에 서면 머리 37% · 발 72% · 가로 42~48%가 된다.
# 받은 1판(PL1)은 카메라가 문 앞 2.5 m라 503이 30% 자리에 왔다 — 이 그림을 「흐린 배치도」로 주고 다시 굽는다.
#   python -X utf8 복도배치도.py  → git 밖 배치/PL_원근.png · ego/refs/배치/PL_원근.jpg(1600×900)
import os
from pathlib import Path

import cv2
import numpy as np

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors")
W, H = 1920, 1080
CAM_H, HORIZON, TX, TY = 1.5, 0.42, 1.285, 0.724   # 눈높이(m) · 지평선(화면 높이 비) · 28 mm 16:9의 2·tan(시야/2)
WALL_L, WALL_R, CEIL, PARAPET = -0.8, 0.8, 2.5, 1.1


def p(x, y, z):
    """복도 좌표(가로 x · 높이 y · 깊이 z, m) → 화면 픽셀"""
    return int((0.5 + x / z / TX) * W), int((HORIZON + (CAM_H - y) / z / TY) * H)


def quad(img, pts, val):
    cv2.fillPoly(img, [np.array(pts, np.int32)], val)


def wall_rect(img, z0, z1, y0, y1, val, x=WALL_L):
    quad(img, [p(x, y0, z0), p(x, y0, z1), p(x, y1, z1), p(x, y1, z0)], val)


if __name__ == "__main__":
    img = np.full((H, W), 40, np.uint8)                       # 바깥 밤하늘 · 먼 동네
    Z0, Z1 = 0.9, 23.0
    quad(img, [p(WALL_L, 0, Z0), p(WALL_L, 0, Z1), p(WALL_L, CEIL, Z1), p(WALL_L, CEIL, Z0)], 92)    # 왼쪽 벽
    quad(img, [p(WALL_L, CEIL, Z0), p(WALL_L, CEIL, Z1), p(WALL_R, CEIL, Z1), p(WALL_R, CEIL, Z0)], 58)  # 천장
    quad(img, [p(WALL_L, 0, Z0), p(WALL_L, 0, Z1), p(WALL_R, 0, Z1), p(WALL_R, 0, Z0)], 74)        # 바닥
    quad(img, [p(WALL_R, 0, Z0), p(WALL_R, 0, Z1), p(WALL_R, PARAPET, Z1), p(WALL_R, PARAPET, Z0)], 120)  # 난간 벽
    quad(img, [p(WALL_L, 0, Z1), p(WALL_R, 0, Z1), p(WALL_R, CEIL, Z1), p(WALL_L, CEIL, Z1)], 205)    # 복도 끝 계단참(밝음)
    # 문 다섯(왼쪽 벽, 폭 0.95 m · 높이 2.05 m): 가까운 문 · 503(민재 — 깜깜) · 504(하린 — 등빛) · 먼 문 둘(끝이 502)
    doors = [(2.4, 3.35, 50), (6.3, 7.25, 8), (8.8, 9.75, 60), (12.6, 13.55, 50), (17.2, 18.15, 50)]
    for z0, z1, v in doors:
        wall_rect(img, z0, z1, 0, 2.05, v)
    # 504 등빛 웅덩이(문턱 바닥 · 벽) — 민재 몸 바로 뒤에 온다. 물건처럼 안 보이게 넓고 흐린 빛으로 얹는다
    glow = np.zeros((H, W), np.float32)
    for (cx, cy), r in ((p(-0.6, 0.0, 9.3), 60), (p(-0.8, 1.0, 9.3), 50)):
        cv2.circle(glow, (cx, cy), r, 1.0, -1)
    glow = cv2.GaussianBlur(glow, (0, 0), 45)
    img = np.clip(img.astype(np.float32) + glow / glow.max() * 70, 0, 255).astype(np.uint8)
    cv2.circle(img, p(-0.55, CEIL, 9.3), 9, 255, -1)          # 504 위 켜진 센서등
    cv2.circle(img, p(-0.55, CEIL, 6.8), 9, 30, -1)           # 503 위 죽은 센서등
    # 난간 너머 길 건너 편의점 불빛(호박빛 띠 자리)
    quad(img, [(int(W * 0.64), int(H * 0.495)), (int(W * 0.80), int(H * 0.495)), (int(W * 0.80), int(H * 0.55)), (int(W * 0.64), int(H * 0.55))], 190)
    img = cv2.GaussianBlur(img, (0, 0), 9)
    bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    out = V / "배치" / "PL_원근.png"
    ok, buf = cv2.imencode(".png", bgr)
    buf.tofile(str(out))
    (V / "ego" / "refs" / "배치").mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(".jpg", cv2.resize(bgr, (1600, 900), interpolation=cv2.INTER_AREA))
    buf.tofile(str(V / "ego" / "refs" / "배치" / "PL_원근.jpg"))
    # 확인: 민재가 설 자리(벽에서 0.35 m · 6.8 m)
    print("민재 발", p(-0.45, 0, 6.8), "머리", p(-0.45, 1.75, 6.8), "→ 화면 %", round(p(-0.45, 0, 6.8)[1] / H * 100), round(p(-0.45, 1.75, 6.8)[1] / H * 100))
    print(out)
