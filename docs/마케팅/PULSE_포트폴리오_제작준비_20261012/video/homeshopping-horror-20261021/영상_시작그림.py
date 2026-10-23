# 「매진 임박」 콘티 v3.1 영상 시작 · 끝 그림(2026-10-23, 지시문/영상_v3.json): 고른 정지컷 원본(색감 없이)을 16:9 1920×1080으로 채워 자르고,
# 거실 와이드(C01a · C01a_clean)는 택배 상자의 깨진 글자를 정지컷 준비와 같은 자리에서 흐린다. 색감 「붉은밤」은 받은 영상에 후반에서 입힌다.
#   python -X utf8 영상_시작그림.py   → synk-vendor/homeshopping-horror-20261021/영상/시작/<그림>.jpg
import json
import os

from PIL import Image

import 정지컷_준비_v3 as 준비  # cover · blur_boxes를 같이 쓴다

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(준비.V, "영상", "시작")


def main():
    spec = json.load(open(os.path.join(HERE, "지시문", "영상_v3.json"), encoding="utf-8"))
    names = sorted({c[k] for c in spec["클립"] for k in ("시작", "끝") if k in c})
    os.makedirs(OUT, exist_ok=True)
    done, missing = [], []
    for n in names:
        src = os.path.join(준비.SRC, f"{n}.png")
        if not os.path.exists(src):
            missing.append(n)
            continue
        im = 준비.cover(Image.open(src).convert("RGB"))
        if n in 준비.ROOM:
            im = 준비.blur_boxes(im)
        im.save(os.path.join(OUT, f"{n}.jpg"), quality=95)
        done.append(n)
    print(f"영상/시작: {len(done)}장 {done} · 없음 {missing}")


if __name__ == "__main__":
    main()
