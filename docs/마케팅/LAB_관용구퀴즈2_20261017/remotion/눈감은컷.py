# -*- coding: utf-8 -*-
"""몽글 진행자 깜빡임용 눈 감은 컷(10-17 v2). 새로 굽지 않고 같은 판에서 만든다.
구슬 눈 자리는 두 눈 사이 펠트 결을 옆으로 옮겨 덮고, 「뚱」 표정(host_deadpan)의 펠트 눈 선을 떼어 그 자리에 얹는다.
눈 좌표는 판1 조각에서 잰 값(어두운 덩어리, 구멍 채움). 판을 다시 굽거나 오리면 좌표를 다시 잰다.

python -X utf8 눈감은컷.py   (remotion 폴더에서) → public/img/kids/host_curious_blink.webp · host_focused_blink.webp
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

K = 'public/img/kids/'


def load(n):
    return np.asarray(Image.open(K + n + '.webp').convert('RGBA')).astype(np.float32)


def eye_mask(a, boxes, top_limit=None, pad=7):
    """구슬 눈 둘레의 그림자까지 덮게 눈 상자를 pad만큼 키운 타원."""
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    m = np.zeros((H, W), bool)
    for (y0, y1, x0, x1) in boxes:
        cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
        ry, rx = (y1 - y0) / 2 + pad, (x1 - x0) / 2 + pad
        m |= ((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2 <= 1
    if top_limit is not None:
        m[:top_limit] = False
    return m


def cover(a, m, shifts):
    """눈 덩어리마다 옆으로 옮긴 펠트 결로 덮는다. 둘레 고리의 색 평균에 맞춰 밝기를 고르고 가장자리를 부드럽게."""
    out = a.copy()
    lab, n = ndi.label(m)
    for i in range(1, n + 1):
        mi = lab == i
        cx = np.argwhere(mi)[:, 1].mean()
        dx = shifts[0] if cx < a.shape[1] / 2 else shifts[1]
        src = np.roll(a, dx, axis=1)[..., :3]
        ring = ndi.binary_dilation(mi, iterations=6) & ~mi
        gain = a[..., :3][ring].mean(0) / np.maximum(src[mi].mean(0), 1)
        src = np.clip(src * gain, 0, 255)
        soft = ndi.gaussian_filter(mi.astype(np.float32), 2.0)
        soft = np.clip(soft * 1.6, 0, 1)[..., None]
        out[..., :3] = out[..., :3] * (1 - soft) + src * soft
    return out


def line_from_deadpan(box):
    d = load('host_deadpan')
    y0, y1, x0, x1 = box
    patch = d[y0 - 4:y1 + 4, x0 - 4:x1 + 4]
    lum = patch[..., :3].mean(2)
    alpha = np.clip((115 - lum) / 55, 0, 1)
    return patch[..., :3], alpha


def put_line(img, rgb, alpha, cy, cx, width):
    h, w = alpha.shape
    s = width / w
    nh, nw = max(1, round(h * s)), max(1, round(w * s))
    rgb_i = np.asarray(Image.fromarray(rgb.astype(np.uint8)).resize((nw, nh), Image.LANCZOS)).astype(np.float32)
    al_i = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)).astype(np.float32)[..., None] / 255
    y0, x0 = int(round(cy - nh / 2)), int(round(cx - nw / 2))
    reg = img[y0:y0 + nh, x0:x0 + nw, :3]
    img[y0:y0 + nh, x0:x0 + nw, :3] = reg * (1 - al_i) + rgb_i * al_i


DEAD_L, DEAD_R = (150, 166, 114, 183), (145, 168, 249, 322)

# 궁금: 구슬 눈 둘(왼 y112-169 x124-177, 오른 y103-167 x253-315)
c = load('host_curious')
mc = eye_mask(c, [(112, 170, 124, 178), (103, 168, 253, 316)])
c2 = cover(c, mc, (-60, 70))  # np.roll: 왼눈은 오른쪽(두 눈 사이) 결, 오른눈은 왼쪽 결을 끌어온다
for box, (cy, cx, w) in ((DEAD_L, (146, 151, 58)), (DEAD_R, (140, 284, 64))):
    rgb, al = line_from_deadpan(box)
    put_line(c2, rgb, al, cy, cx, w)
Image.fromarray(np.clip(c2, 0, 255).astype(np.uint8), 'RGBA').save(K + 'host_curious_blink.webp', lossless=True)

# 집중: 눈썹 아래 구슬 눈 둘(왼 y128-181 x152-203, 오른 y128-182 x283-338 — 오른 눈은 눈썹과 붙어 있어 128 위는 남김)
f = load('host_focused')
mf = eye_mask(f, [(128, 182, 152, 204), (129, 183, 280, 341)], top_limit=127)
f2 = cover(f, mf, (-62, 70))
for box, (cy, cx, w) in ((DEAD_L, (160, 177, 54)), (DEAD_R, (160, 309, 56))):
    rgb, al = line_from_deadpan(box)
    put_line(f2, rgb, al, cy, cx, w)
Image.fromarray(np.clip(f2, 0, 255).astype(np.uint8), 'RGBA').save(K + 'host_focused_blink.webp', lossless=True)
print('ok')
