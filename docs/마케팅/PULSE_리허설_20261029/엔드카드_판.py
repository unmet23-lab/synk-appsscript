"""리허설(10-29) 엔드카드 판 v2 — 캔을 지운 벤치 판(Gemini 편집 S5e) 위에 블렌더 팩샷(그림자 받는 바닥 포함)을 얹는다.

v1은 장면 그림의 캔 자리(화면 43~71%)에 맞춰 얹어 글 다섯 줄이 캔 위에 몰리고 아래 띠가 앱 글 칸(65%) 밖이었다(Fable 완성본 P1-3).
벤치 먼 쪽 끝이 화면 57% 둘레라 캔을 그보다 위로 올리면 떠 보인다 — 먼 쪽 끝에 세워 작게(높이 440px, 바닥 1115px — v2 P3-4로 15px 올림) 두고
글은 캔 위(로고 · 이름 · 문구)와 아래(출시 · 고지)에 나눈다. 라벨 색은 손님 파일 그대로, 해 질 녘 빛은 렌더에서 맞춘다(리허설_캔.py pack v2 — 배율 1.0).
  python -X utf8 엔드카드_판.py [--밝기 0.62] [--높이 470] [--바닥 1150] [--x 492]   → 작업 폴더 합성/S5_v2.png(1080×1920)
"""
import argparse
import os

import numpy as np
from PIL import Image

작업 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-rehearsal-20261029")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--밝기", dest="gain", type=float, default=1.0)
    ap.add_argument("--높이", dest="h", type=int, default=440)
    ap.add_argument("--바닥", dest="bottom", type=int, default=1115)
    ap.add_argument("--x", dest="x", type=int, default=492)
    a = ap.parse_args()
    plate = Image.open(os.path.join(작업, "장면그림", "S5e_g1.png")).convert("RGB")
    W, H = plate.size
    th = round(W * 16 / 9)
    y0 = (H - th) // 2
    plate = np.asarray(plate.crop((0, y0, W, y0 + th)).resize((1080, 1920), Image.LANCZOS)).astype(np.float32)
    r = np.asarray(Image.open(os.path.join(작업, "렌더", "팩샷.png")).convert("RGBA")).astype(np.float32) / 255.0
    al = r[..., 3]
    can = al > 0.98
    ys, xs = np.nonzero(can)
    top, bot, cx = ys.min(), ys.max(), (xs.min() + xs.max()) / 2
    s = a.h / (bot - top)
    rim = Image.fromarray((r * 255).astype(np.uint8), "RGBA").resize((round(r.shape[1] * s), round(r.shape[0] * s)), Image.LANCZOS)
    rr = np.asarray(rim).astype(np.float32) / 255.0
    ox, oy = round(a.x - cx * s), round(a.bottom - bot * s)
    out = plate.copy()
    h, w = rr.shape[:2]
    y1, x1 = max(0, oy), max(0, ox)
    y2, x2 = min(1920, oy + h), min(1080, ox + w)
    sub = rr[y1 - oy:y2 - oy, x1 - ox:x2 - ox]
    rgb = sub[..., :3] * 255.0 * a.gain  # 밝기 배율 하나(색상 · 채도 그대로)
    # 그림자 받는 바닥은 캔에서 먼 곳까지 판 전체를 27~50% 어둡게 해(바닥 둘레 알파 68~131) 붙인 자리가 네모로 보였다 —
    # 캔 밖 알파는 버리고, 캔 바닥 아래에 부드러운 타원 그림자를 따로 깐다(가운데 45%, 가우스로 옅어짐)
    A = np.where(sub[..., 3:4] > 0.98, sub[..., 3:4], 0.0)
    yy, xx = np.mgrid[0:1920, 0:1080].astype(np.float32)
    ccx, cby, cw = ox + cx * s, oy + bot * s, (xs.max() - xs.min()) * s
    shadow = 0.45 * np.exp(-(((xx - ccx) / (0.55 * cw)) ** 2 + ((yy - cby + 0.01 * a.h) / (0.045 * a.h)) ** 2))
    out *= (1 - shadow)[..., None]
    out[y1:y2, x1:x2] = out[y1:y2, x1:x2] * (1 - A) + rgb * A  # 그림자 받는 바닥은 검은 반투명이라 판을 그대로 어둡게 한다
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(작업, "합성", "S5_v2.png"))
    print(f"캔 {a.h}px · 위 {a.bottom - a.h} · 바닥 {a.bottom} · 가운데 x {a.x} · 밝기 {a.gain}")


if __name__ == "__main__":
    main()
