"""인사 그림을 왼쪽으로 밀고 빈 오른쪽을 거울 이음으로 채운다 — 구운 글자가 오른쪽 단추 자리(1080 기준 920px) 안으로 오게.

    python -X utf8 옆으로.py <그림.jpg> <낼 그림.jpg> --왼쪽 45

오른쪽 가장자리 그 폭 안에 인형 · 글자가 없을 때만 쓴다(하늘 펠트와 나무 탁자만 거울로 이어진다).
"""
import sys

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith('--')}
im = np.asarray(Image.open(args[0]).convert('RGB'))
h, w = im.shape[:2]
dx = round(float(opt.get('--왼쪽', 45)) * w / 1080)
res = np.concatenate([im[:, dx:], im[:, w - dx:][:, ::-1]], axis=1)
assert res.shape == im.shape
Image.fromarray(res).save(args[1], quality=95)
print(args[1], '왼쪽', dx)
