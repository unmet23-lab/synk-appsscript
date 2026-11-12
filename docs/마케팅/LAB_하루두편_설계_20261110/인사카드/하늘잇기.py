"""인사 장면 그림을 아래로 내리고 빈 윗부분을 하늘 펠트로 잇는다 — 구운 글자의 맨 윗줄이 위 안전선(1920 기준 269px) 아래로 오게.

    python -X utf8 하늘잇기.py <구운 그림.png> <낼 그림.jpg> [--내림 160] [--하늘 90]

--내림: 1920 기준으로 그림을 내릴 px. --하늘: 그림 맨 위에서 글자가 시작하기 전까지의 민무늬 하늘(1920 기준 px).
빈 윗부분은 맨 위 하늘 띠를 뒤집었다 바로 놓았다 번갈아(거울 이음) 채운다 — 이음매의 밝기가 이어지고 글자가 비치지 않는다. 아래쪽 같은 높이는 잘린다(흐린 탁자).
"""
import sys

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith('--')}
src, out = args[0], args[1]
im = np.asarray(Image.open(src).convert('RGB'))
h, w = im.shape[:2]
k = h / 1920
dy = round(float(opt.get('--내림', 160)) * k)
sky = round(float(opt.get('--하늘', 90)) * k)
strip = im[:sky]
rows = []
need = dy
flip = True
while need > 0:
    part = strip[::-1] if flip else strip
    take = part[-need:] if need < sky else part  # 그림에 닿는 쪽(아래)부터 채운다
    rows.insert(0, take)
    need -= take.shape[0]
    flip = not flip
ext = np.concatenate(rows, axis=0)
assert ext.shape[0] == dy, (ext.shape, dy)
res = np.concatenate([ext, im[: h - dy]], axis=0)
assert res.shape == im.shape
Image.fromarray(res).save(out, quality=95)
print(out, res.shape[1], res.shape[0], '내림', dy, '하늘', sky)
