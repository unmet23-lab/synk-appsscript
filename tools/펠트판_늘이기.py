# -*- coding: utf-8 -*-
"""펠트 판 늘이기 — 오린 펠트 판(단추·타일·칩)의 가운데를 좌우 반전으로 이어 원하는 가로세로 비율로 늘린다.
docs/디자인/펠트부품/README.md 「만드는 순서」 4 늘이기. 9칸으로 잘라 반복하면 가운데에 이음매 줄이 보였다(2026-10-02),
반전으로 이으면 이음매마다 같은 열이 맞닿아 끊김이 없고, 둥근 모서리와 바늘땀 모서리는 그대로 남는다.

쓰는 법
  python tools/펠트판_늘이기.py <입력.webp> <출력.webp> --비율 5.6 [--높이 160]
    --비율: 출력 가로 ÷ 세로(그림자 여백 포함). 원본보다 짧으면 그대로 둔다.
    --높이: 출력 높이(px). 주면 늘인 뒤 그 높이로 줄인다(화면에서 쓰는 크기의 2배쯤).
    --품질: 주면 색은 손실 압축(웹용, 예 88), 알파는 늘 무손실(손실 알파는 바깥이 흰 네모로 살아난다, 2026-09-08). 안 주면 전부 무손실.
"""
import argparse
import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('src'); p.add_argument('dst')
p.add_argument('--비율', type=float, required=True)
p.add_argument('--높이', type=int, default=0)
p.add_argument('--품질', type=int, default=0)
a = p.parse_args()

im = Image.open(a.src).convert('RGBA')
x = np.asarray(im)
H, W = x.shape[:2]
want = int(round(a.비율 * H))
if want > W:
    # 가운데 왼쪽 띠를 [반전, 그대로] 짝으로 n번 끼운다. 이음매마다 같은 열이 맞닿는다(가운데 왼쪽 끝 = 띠 끝 = 가운데 오른쪽 시작 앞).
    need, mid = want - W, W // 2
    n = -(-need // (2 * max(1, mid - 12)))
    b = -(-need // (2 * n))
    band = x[:, mid - b:mid]
    x = np.concatenate([x[:, :mid]] + [band[:, ::-1], band] * n + [x[:, mid:]], axis=1)
out = Image.fromarray(x, 'RGBA')
if a.높이:
    out = out.resize((int(round(out.size[0] * a.높이 / out.size[1])), a.높이), Image.LANCZOS)
if a.품질: out.save(a.dst, 'WEBP', quality=a.품질, alpha_quality=100, method=6)
else: out.save(a.dst, 'WEBP', lossless=True, quality=100, method=6)
print(a.dst, out.size)
