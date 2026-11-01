# 흰 바탕(#FEFEFE)에서 구운 펠트 물건을 「테두리에 닿은 거의 흰 덩어리」만 지워 오린다(2026-11-01 E22).
# tools/펠트_흰바탕오리기.py는 매끈한 그늘을 지우는 규칙이 크림 털(강아지 귀 · 물개 배)을 같이 먹어, 이 편의 흰 바탕 물건은
# 그늘을 빼고 순백에 가까운 칸만 본다(구운 판에 바닥 그늘이 없다). 가장자리 2칸은 흰빛을 풀어 반투명으로.
# 사용: python -I -X utf8 흰바탕오리기_단순.py <입력.png> <출력.png> [문턱=244]
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, dst = sys.argv[1], sys.argv[2]
th = int(sys.argv[3]) if len(sys.argv) > 3 else 244
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
mn = im.min(axis=2)
cand = mn >= th
lab, n = ndi.label(cand)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
# 안쪽 작은 구멍은 메운다(물건 안 하이라이트)
obj = ~bg
obj = ndi.binary_fill_holes(obj)
# 부스러기 지우기: 가장 큰 덩어리와 그 넓이의 2% 넘는 덩어리만
lab2, n2 = ndi.label(obj)
if n2 > 1:
    sizes = ndi.sum(obj, lab2, range(1, n2 + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.02]
    obj = np.isin(lab2, keep)
# 가장자리 반투명: 바탕과의 거리로 알파
dist = ndi.distance_transform_edt(obj)
whiteness = np.clip((mn - 200) / (254 - 200), 0, 1)
alpha = np.where(dist > 2.5, 1.0, np.where(obj, 1.0 - 0.85 * whiteness * (dist <= 2.5), 0.0))
alpha = np.clip(alpha, 0, 1)
# 흰빛 풀기: 관측 = a·물건 + (1−a)·254
a3 = np.maximum(alpha, 1e-3)[..., None]
rgb = np.clip((im - (1 - a3) * 254) / a3, 0, 255)
out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
ys, xs = np.where(alpha > 0.02)
out = out[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
Image.fromarray(out, 'RGBA').save(dst)
print(dst, out.shape[1], 'x', out.shape[0])
