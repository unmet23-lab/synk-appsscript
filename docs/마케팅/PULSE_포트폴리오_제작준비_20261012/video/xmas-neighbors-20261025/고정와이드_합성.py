# 시즌 1 「옆집의 크리스마스」 고정 와이드(1 · 12 · 20 · 26)의 민재 앉히기(2026-10-27).
# Gemini는 이 복도 판에서 문 앞 6.5 m의 작은 사람(화면 높이 35%)을 끝내 그리지 않았다 — 실루엣 배치도 · 크기 숫자 · 「실루엣만 바꿔라」 편집 모두
# 첫 문 앞 3.5~4 m에 화면 높이 52~64%로 그렸다(C01 · C01r · C01e · C12 · C20m). 판(복도 · 계절 · 장식)은 편집으로 잘 지켰으므로, Gemini가 그린 민재를
# rembg(u2net_human_seg)로 따서 원본 사람 크기 · 자리(배치도 상자)로 줄여 그 계절의 판(정지컷/PL1 · PL12 · PL20 · PL26)에 앉힌다
# (장부 S31의 블렌더 제품 합성과 같은 길 — 색 · 밝기는 손대지 않고 크기 · 자리만, 가장자리만 살짝 부드럽게).
#   python -X utf8 고정와이드_합성.py C01 PL1 C01e_212425.jpg 42,36,47.5,71.5
#   → git 밖 정지컷/C01.png · 컷/C01.jpg · ego/refs/C01.jpg · 배치/_합성확인/C01.jpg(딴 사람 · 상자) · 정지컷/_고른판.json
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from 이미지콘티_배치도 import imread, imwrite, person_mask  # noqa: E402

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors")


def seat(name, plate, src, box):
    pl = imread(V / "정지컷" / f"{plate}.png")
    hp, wp = pl.shape[:2]
    s = imread(V / "받음" / src)
    m = person_mask(s)
    # 가장 큰 덩이(사람 + 든 봉투)만 — 멀리 지나가는 이웃 같은 작은 덩이는 뺀다
    n, lab, stats, _ = cv2.connectedComponentsWithStats((m > 0).astype(np.uint8))
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    mk = (lab == k).astype(np.uint8) * 255
    ys, xs = np.nonzero(mk)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    person, alpha = s[y0:y1, x0:x1], mk[y0:y1, x0:x1]
    bx0, by0, bx1, by1 = [float(v) / 100 for v in box.split(",")]
    sc = (by1 - by0) * hp / (y1 - y0)
    pw, ph = max(1, round((x1 - x0) * sc)), max(1, round((y1 - y0) * sc))
    person = cv2.resize(person, (pw, ph), interpolation=cv2.INTER_AREA).astype(np.float32)
    a = cv2.GaussianBlur(cv2.resize(alpha, (pw, ph), interpolation=cv2.INTER_AREA).astype(np.float32) / 255, (3, 3), 0)[..., None]
    top, left = round(by1 * hp) - ph, round((bx0 + bx1) / 2 * wp - pw / 2)
    out = pl.astype(np.float32)
    out[top:top + ph, left:left + pw] = out[top:top + ph, left:left + pw] * (1 - a) + person * a
    out = out.astype(np.uint8)
    imwrite(V / "정지컷" / f"{name}.png", out)
    imwrite(V / "컷" / f"{name}.jpg", cv2.resize(out, (1920, 1080), interpolation=cv2.INTER_AREA))
    imwrite(V / "ego" / "refs" / f"{name}.jpg", cv2.resize(out, (1600, 900), interpolation=cv2.INTER_AREA))
    chk = s.copy()
    cv2.rectangle(chk, (int(x0), int(y0)), (int(x1), int(y1)), (0, 255, 255), 4)
    chk[mk == 0] = (chk[mk == 0] * 0.35).astype(np.uint8)
    (V / "배치" / "_합성확인").mkdir(parents=True, exist_ok=True)
    imwrite(V / "배치" / "_합성확인" / f"{name}.jpg", cv2.resize(chk, (1280, round(1280 * chk.shape[0] / chk.shape[1]))))
    lp = V / "정지컷" / "_고른판.json"
    log = json.load(open(lp, encoding="utf-8")) if lp.exists() else {}
    log[name] = {"src": src, "note": f"합성 — 판 {plate}에 {src}의 민재를 상자 {box}(%)로 줄여 앉힘"}
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(name, plate, src, "사람", (int(x1 - x0), int(y1 - y0)), "→", (pw, ph), "자리", (left, top))


def door(plate, out_name, box, base="PL1"):
    """503 문간 되돌리기 — 계절 판 고침(PL12 · PL20)이 장식을 503(어두운 둘째 문간)에 달았다(바로잡는 편집 PL12f · PL20f도 그 문간에
    다시 달거나 문을 닫았다). 계절 판은 PL1을 고친 판이라 자리가 픽셀까지 맞으므로, 그 상자만 PL1의 어두운 문간으로 되돌린다(가장자리 부드럽게)."""
    pl = imread(V / "정지컷" / f"{plate}.png").astype(np.float32)
    b = imread(V / "정지컷" / f"{base}.png").astype(np.float32)
    hp, wp = pl.shape[:2]
    x0, y0, x1, y1 = [float(v) / 100 for v in box.split(",")]
    a = np.zeros((hp, wp), np.float32)
    a[round(y0 * hp):round(y1 * hp), round(x0 * wp):round(x1 * wp)] = 1
    a = cv2.GaussianBlur(a, (0, 0), 4)[..., None]
    out = (pl * (1 - a) + b * a).astype(np.uint8)
    imwrite(V / "정지컷" / f"{out_name}.png", out)
    lp = V / "정지컷" / "_고른판.json"
    log = json.load(open(lp, encoding="utf-8")) if lp.exists() else {}
    log[out_name] = {"src": f"{plate}.png", "note": f"503 문간 {box}(%)만 {base}에서 되돌림"}
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(out_name, "←", plate, "문간", box, "←", base)


if __name__ == "__main__":
    if sys.argv[1] == "문간":   # python -X utf8 고정와이드_합성.py 문간 PL20 PL20d 39.6,29,42.2,74
        door(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        seat(*sys.argv[1:5])
