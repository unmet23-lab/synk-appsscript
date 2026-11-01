"""
홀 꾸미기 칸을 「칸만 다른 짝」으로 붙인다 (2026-11-01, 결정 11-01 「꾸미기는 칸 영역 합성」).
0단계 `카페0단계시험-20261031/벽합성.py`를 판마다 다각형만 바꿔 쓰게 넓혔다 — 편집 굽기는 「벽만 바꿔」라고 해도
그림 전체를 다시 그려(벽 밖 15~21%) 손님 고개까지 바뀌므로, 판 A를 바탕으로 판 B의 칸 다각형만 페더로 붙인다.

    python -I -X utf8 칸합성.py <판 A> <판 B> <낼.png> --칸 "x,y x,y …" [--빼기 "x0,y0,x1,y1;…"] [--머리 "x0,y0,x1,y1:밝기"] [--페더 5]

--빼기는 A 그대로 둘 타원 상자. --머리는 칸 아래 변에 걸친 손님 머리를 윤곽대로 뺀다(Fable 11-01 P2-1 — 타원으로 빼면
머리 윗선이 B 판 머리와 섞이거나, 크게 잡으면 칸 아래 변에 옛 게시판 조각이 남았다): 상자 안에서 A의 밝기가 「밝기」보다 어두운
덩어리 가운데 상자 아래 변에 닿는 것(머리 · 어깨로 이어짐)만 골라 2px 넓히고, 페더를 입힌 칸 가림에서 그 자리를 0으로 둔다 —
머리 픽셀은 A 그대로이고 페더는 벽 쪽으로만 번진다.
낸 것: <낼.png>, 칸 밖 바뀐 픽셀 수(0이어야 한다), --머리를 주면 머리 안 바뀐 픽셀 수(0이어야 한다).
"""
import argparse

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("A")
ap.add_argument("B")
ap.add_argument("낼")
ap.add_argument("--칸", required=True)
ap.add_argument("--빼기", default="")
ap.add_argument("--머리", default="")
ap.add_argument("--페더", type=float, default=5)
a = ap.parse_args()

A = Image.open(a.A).convert("RGB")
B = Image.open(a.B).convert("RGB")
if B.size != A.size:
    B = B.resize(A.size, Image.LANCZOS)
칸 = [tuple(int(v) for v in p.split(",")) for p in a.칸.split()]
m = Image.new("L", A.size, 0)
d = ImageDraw.Draw(m)
d.polygon(칸, fill=255)
for 상자 in filter(None, a.빼기.split(";")):
    d.ellipse(tuple(int(v) for v in 상자.split(",")), fill=0)
m = np.asarray(m.filter(ImageFilter.GaussianBlur(a.페더)), dtype=np.float32) / 255.0

머리 = np.zeros(m.shape, bool)
if a.머리:
    상자, 밝기 = a.머리.split(":")
    x0, y0, x1, y1 = (int(v) for v in 상자.split(","))
    밝 = np.asarray(A.convert("L"), dtype=np.float32)[y0:y1, x0:x1]
    # 닫기(작은 틈 메우기)는 가장자리를 깎으므로 둘레를 늘여 붙인 뒤 닫고 잘라 낸다 — 안 그러면 아래 변에 닿는 덩어리가 사라진다
    어둠 = np.pad(밝 < float(밝기), 3, mode="edge")
    덩, n = ndimage.label(ndimage.binary_closing(어둠, iterations=2)[3:-3, 3:-3])
    닿음 = set(np.unique(덩[-1, :])) - {0}
    조각 = ndimage.binary_fill_holes(np.isin(덩, list(닿음)))
    머리[y0:y1, x0:x1] = ndimage.binary_dilation(조각, iterations=2)
    m[머리] = 0.0

m8 = Image.fromarray(np.clip(m * 255 + 0.5, 0, 255).astype(np.uint8))
out = Image.composite(B, A, m8)
out.save(a.낼)
차 = np.asarray(ImageChops.difference(A, out).convert("L")) > 2
print("칸 밖 바뀐 픽셀", int((차 & (np.asarray(m8) == 0) & ~머리).sum()))
if a.머리:
    print("머리 안 바뀐 픽셀", int((차 & 머리).sum()), "· 머리 픽셀", int(머리.sum()))
