"""구운 판(위아래로 쌓은 장면 칸)을 흰 띠에서 잘라 편 그림으로 둔다(2026-11-10).

   python -X utf8 docs/마케팅/LAB_퀴즈은행/틀/장면자르기.py <판.png> <낼 그림…>
     예) 판 하나에 두 칸(위 = 글자 그대로 · 아래 = 뜻):  … q1_파김치_043051.png <편>/remotion/public/img/q1_lit.jpg <편>/remotion/public/img/q1_mean.jpg
         판 하나에 세 칸(끝 장면 셋):                   … 끝장면셋_*.png a/img/end.jpg b/img/end.jpg c/img/end.jpg

흰 띠 찾기: 줄마다 밝기 평균 245 넘고 흔들림이 작은 줄이 이어진 곳(가장자리 6% 밖). 칸 수만큼 갈라지지 않으면 멈춘다 — 조용히
엉뚱한 자리를 자르지 않게. 칸 가장자리에 남은 흰 줄도 걷는다. JPEG 품질 92(편 사본 public은 git에 오르니 PNG 원본은 판/에만 둔다).
"""
import sys

import numpy as np
from PIL import Image


def bands(arr):
    g = arr.mean(axis=2)
    mean = g.mean(axis=1)
    std = g.std(axis=1)
    white = (mean > 245) & (std < 9)
    h = len(white)
    runs = []
    i = 0
    while i < h:
        if white[i]:
            j = i
            while j < h and white[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    return runs, h


def main():
    src, outs = sys.argv[1], sys.argv[2:]
    im = Image.open(src).convert('RGB')
    arr = np.asarray(im).astype(np.float32)
    runs, h = bands(arr)
    inner = [(a, b) for a, b in runs if a > h * 0.06 and b < h * 0.94 and b - a >= 6]
    inner.sort(key=lambda r: r[1] - r[0], reverse=True)
    need = len(outs) - 1
    if len(inner) < need:
        sys.exit(f'흰 띠 {len(inner)}개 — 칸 {len(outs)}개로 못 가른다: {src}')
    cuts = sorted(inner[:need])
    edges = [0] + [x for a, b in cuts for x in (a, b)] + [h]
    for k, out in enumerate(outs):
        top, bot = edges[2 * k], edges[2 * k + 1]
        # 칸 안쪽 가장자리에 남은 흰 줄 걷기
        for a, b in runs:
            if a <= top + 2 and b > top and b - top < 40:
                top = b
            if b >= bot - 2 and a < bot and bot - a < 40:
                bot = a
        panel = im.crop((0, top, im.width, bot))
        panel.save(out, quality=92)
        print(f'{out} · {panel.width}×{panel.height}')


if __name__ == '__main__':
    main()
