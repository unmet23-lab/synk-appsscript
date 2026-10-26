# 회색 펠트(비구름 · 승강장)가 든 칸만 다시 오린다 — tools/펠트_흰바탕오리기.py는 무채색 그늘을 벗기다 회색 펠트까지 뜯었다(10-26).
# 이 판은 그늘 없이 순백 바탕이라, 테두리에 닿은 흰 덩어리만 바탕으로 걷고 가장자리는 「관측 = a·물건 + (1−a)·흰색」을 풀어 흰 테를 뺀다.
#   python -X utf8 판/회색펠트_오리기.py <판.png> <칸 열> <칸 행> <출력.webp>   (3×2 판, 열·행은 0부터)
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, col, row, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
H, W = im.shape[:2]; cw, ch = W // 3, H // 2
c = im[row * ch:(row + 1) * ch, col * cw:(col + 1) * cw]
d = np.sqrt(((1 - c) ** 2).sum(-1)) / np.sqrt(3)          # 흰색과의 거리
near = d < 0.06
lab, n = ndi.label(near)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
a = np.clip((d - 0.02) / 0.10, 0, 1)
a[~bg] = 1.0
a = np.maximum(a, ndi.binary_erosion(~bg, iterations=2).astype(np.float32))
a = ndi.gaussian_filter(a, 0.6)
a[bg & (d < 0.02)] = 0
rgb = np.clip((c - (1 - a[..., None]) * 1.0) / np.maximum(a[..., None], 1e-3), 0, 1)
ys, xs = np.where(a > 0.05)
y0, y1, x0, x1 = max(0, ys.min() - 4), ys.max() + 5, max(0, xs.min() - 4), xs.max() + 5
rgba = np.dstack([rgb, a])[y0:y1, x0:x1]
Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').save(out, quality=92)
print(out, rgba.shape)
