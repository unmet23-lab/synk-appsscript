# 시안 판에서 바탕을 빼 투명 로고로 — 실제 카드에 얹어 보기 위한 임시 오림(2026-11-05).
# 가장자리와 이어진 바탕색 + 그 색과 같은 큰 안쪽 구멍(O · A · B 속)을 뺀다.
import glob
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '오림')
os.makedirs(OUT, exist_ok=True)
JOBS = {'O5_오팔글자': 30, 'O2_보석': 26, 'O3_빛갈림': None, 'B8_칠보': 40, 'B5_매듭': 38, 'B6_쪽물': 30}


def latest(name):
    return sorted(glob.glob(os.path.join(HERE, '판', name + '_*.png')), key=os.path.getmtime)[-1]


for name, T in JOBS.items():
    im = Image.open(latest(name)).convert('RGB')
    if T is None:  # 빛갈림은 벽 빛까지가 로고라 오리지 않고 자르기만 한다
        im.save(os.path.join(OUT, name + '.png'))
        continue
    a = np.asarray(im).astype(float)
    # 바탕은 위치마다 조금씩 달라 크게 흐린 판을 기준으로 삼지 않고 네 가장자리 중앙값으로 잰다
    edge = np.concatenate([a[:40].reshape(-1, 3), a[-40:].reshape(-1, 3), a[:, :40].reshape(-1, 3), a[:, -40:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    near = d < T
    lab, n = ndimage.label(near)
    sizes = ndimage.sum(near, lab, range(1, n + 1))
    touch = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    keep = np.zeros(n + 1, bool)
    for i, s in enumerate(sizes, 1):
        if i in touch or s > 900:
            keep[i] = True
    fg = ~keep[lab]
    fg = ndimage.binary_opening(fg, iterations=1)
    lab2, m = ndimage.label(fg)
    if m:
        s2 = ndimage.sum(fg, lab2, range(1, m + 1))
        fg = np.isin(lab2, [i + 1 for i, v in enumerate(s2) if v > 150])
    fg = ndimage.binary_fill_holes(fg) & ~(keep[lab] & (lab > 0) & np.isin(lab, [i for i in range(1, n + 1) if keep[i] and i not in touch])) if name != 'O2_보석' else fg
    alpha = Image.fromarray((fg * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    out.crop((box[0] - 6, box[1] - 6, box[2] + 6, box[3] + 6)).save(os.path.join(OUT, name + '.png'))
    print(name, box, 'bg', bg.round())
