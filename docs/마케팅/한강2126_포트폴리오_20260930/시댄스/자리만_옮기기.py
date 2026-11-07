"""GPT 이미지로 고친 시작 그림에서 바뀐 자리(가방 까몽을 뺀 곳)만 원래 프레임에 옮겨 붙인다 — 얼굴 · 나머지 화면은 원래 픽셀 그대로(11-07).
  python -X utf8 자리만_옮기기.py <원래 png> <고친 png> <나갈 jpg> [<x0> <y0> <x1> <y1> — 찾을 범위, 1080×1920 기준]
"""
import sys

import cv2
import numpy as np
from PIL import Image

src, edit, out = sys.argv[1:4]
a = np.asarray(Image.open(src).convert('RGB'), np.float32)
H, W = a.shape[:2]
b = np.asarray(Image.open(edit).convert('RGB').resize((W, H), Image.LANCZOS), np.float32)
ga, gb = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY), cv2.cvtColor(b, cv2.COLOR_RGB2GRAY)
(dx, dy), resp = cv2.phaseCorrelate(ga, gb)
print(f'고친 판 어긋남 dx={dx:.2f} dy={dy:.2f} (응답 {resp:.2f})')
M = np.float32([[1, 0, -dx], [0, 1, -dy]])
b = cv2.warpAffine(b, M, (W, H), borderMode=cv2.BORDER_REFLECT)
d = np.abs(cv2.GaussianBlur(a, (0, 0), 3) - cv2.GaussianBlur(b, (0, 0), 3)).mean(axis=2)
roi = np.zeros_like(d, bool)
if len(sys.argv) >= 8:
    x0, y0, x1, y1 = map(int, sys.argv[4:8])
    roi[y0:y1, x0:x1] = True
else:
    roi[:] = True
m = ((d > 18) & roi).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
x, y, w, h = stats[k, :4]
print(f'바뀐 자리 x{x} y{y} {w}×{h} (넓이 {stats[k, cv2.CC_STAT_AREA]})')
pad = 40
mask = np.zeros((H, W), np.float32)
mask[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad] = 1.0
mask = cv2.GaussianBlur(mask, (0, 0), 14)[..., None]
o = a * (1 - mask) + b * mask
Image.fromarray(o.clip(0, 255).round().astype(np.uint8)).save(out, quality=95)
print('나감', out)
