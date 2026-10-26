# 2번 남성 향수 · 이미지 콘티 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 8번 · 「매진 임박」(만족 사례 장부 S31)과 같은 방식.
# 원본 배우의 얼굴 · 몸 · 머리 · 장신구가 옮겨 오지 않게 사람을 검은 실루엣으로, 바탕은 원본의 빛 자리만 남게 크게 흐린 파랑으로 둔다
# (우리 바탕도 같은 코발트 무대라 빛 자리는 원본 그대로가 맞다). 손에 든 병 자리는 크로마 초록(블렌더 병을 얹는다).
#   python -I -X utf8 이미지콘티_배치도.py [S01 S04 …]  → git 밖 콘티/p2/배치/<컷>.png(1456×816) · 배치/_확인/<컷>.jpg
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

P2 = Path(os.environ["USERPROFILE"]) / "Documents" / "synk-vendor" / "pulse-portfolio12-20261024" / "콘티" / "p2"
F = P2 / "원본첫프레임"
OUT = P2 / "배치"
GREEN = (0, 177, 64)
INK = 12

# 컷마다: seg(사람 분할) · green(초록 자리, 1920×1080 좌표) · blur(바탕 흐림 반경)
CUT = {
    "S01": {"seg": True, "blur": 18},                 # 와이드 무대 · 빛줄기 아래 작은 실루엣
    "S04": {"seg": True, "blur": 30},                 # 어깨 너머 · 팔을 위로 뻗음
    "S05": {"seg": True, "blur": 30},                 # 낮은 각도 정면 · 두 팔 벌림
    "S12": {"seg": True, "blur": 30,                  # 병을 목 옆으로 든 미디엄 클로즈업 — 병 자리 초록
            # 10-26 밤: 원본 병은 윗부분이 화면 오른쪽으로 17°쯤 기울었다(뚜껑 위 가운데 1480,450 · 바닥 가운데 1400,712) — 1판 대역은 거꾸로 기울었다
            "green": [[(1424, 433), (1535, 467), (1455, 729), (1344, 695)]]},
    "S16": {"seg": True, "blur": 30},                 # 얼굴 클로즈업(정면에서 시작)
}


def main(cuts):
    from rembg import new_session, remove
    ses = new_session("u2net_human_seg")
    (OUT / "_확인").mkdir(parents=True, exist_ok=True)
    rec = {}
    for n in cuts:
        cfg = CUT[n]
        im = Image.open(F / f"{n}.png").convert("RGB")
        W, H = im.size
        m = np.zeros((H, W), np.uint8)
        if cfg.get("seg"):
            mm = np.asarray(remove(im, session=ses, only_mask=True)).astype(np.float32) / 255
            m = ((mm > 0.5) * 255).astype(np.uint8)
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        g = np.zeros((H, W), np.uint8)
        for poly in cfg.get("green", []):
            cv2.fillPoly(g, [np.array(poly, np.int32)], 255)
        bg = np.asarray(im.filter(ImageFilter.GaussianBlur(cfg.get("blur", 24)))).copy()
        lay = bg.copy()
        lay[m > 0] = INK
        lay[g > 0] = GREEN
        Image.fromarray(lay).resize((1456, 816), Image.LANCZOS).save(OUT / f"{n}.png")
        a = np.asarray(im).copy()
        a[m > 0] = (a[m > 0] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
        a[g > 0] = (a[g > 0] * 0.4 + np.array(GREEN) * 0.6).astype(np.uint8)
        Image.fromarray(a).resize((960, 540)).save(OUT / "_확인" / f"{n}.jpg", quality=85)
        rec[n] = {"사람%": round((m > 0).mean() * 100, 1), "초록%": round((g > 0).mean() * 100, 1)}
        print(n, rec[n])
    json.dump(rec, open(OUT / "_배치기록.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1:] or sorted(CUT))
