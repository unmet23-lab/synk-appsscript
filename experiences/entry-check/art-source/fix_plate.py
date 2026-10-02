# -*- coding: utf-8 -*-
"""펠트 판 가장자리에 남은 «흰 판» 걷기 + 그림자 다시 만들기.

2026-10-02 사용자 지적(짐 칸): 키트 판(docs/디자인/펠트부품/assets/ui)은 흰 바탕 사진에서 오렸는데,
펠트와 그림자 사이에 흰 바탕(사진의 접지 그림자 언저리)이 불투명하게 남았다. 크림 판은 바탕과 색이 비슷해
가장 잘 보이고, 코랄·연코랄 판도 아래쪽에 같은 띠가 있다.

가르는 법: 펠트는 색이 있고(채도) 털 결이 있다. 흰 판은 채도가 낮고 매끈하다. 바깥(투명)과 이어진
«채도 낮고 매끈한 불투명 픽셀»만 걷는다. 걷은 뒤 옛 그림자(짙고 옅은 픽셀)도 걷고, 남은 펠트 모양으로
부드러운 바닥 그림자를 새로 만든다.

    python art-source/fix_plate.py <원본.webp> <출력.webp> [--크기 W,H] [--확인 확인.png]
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def local_std(lum, w, k=5):
    sw = np.maximum(ndi.uniform_filter(w, k), 1e-3)
    m = ndi.uniform_filter(lum * w, k) / sw
    m2 = ndi.uniform_filter(lum * lum * w, k) / sw
    return np.sqrt(np.maximum(m2 - m * m, 0))


def fix(src):
    im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3]
    h, w = a.shape
    lum = rgb.mean(-1)
    sat = rgb.max(-1) - rgb.min(-1)
    opaque = a >= 250
    std = local_std(lum, opaque.astype(np.float32))
    scale = max(h, w) / 640.0

    # 1) 흰 판: 바깥과 이어진 채도 낮고 매끈한 불투명 픽셀(바깥에서 일정 거리 안쪽까지만)
    cand = opaque & (sat <= 15) & (lum >= 180) & (std <= 6.5)
    outside = a < 128
    dist_out = ndi.distance_transform_edt(~outside)
    cand &= dist_out <= 34 * scale
    seed = cand & (dist_out <= 3)
    lab, n = ndi.label(cand)
    plate = np.zeros_like(cand)
    if n:
        ids = np.unique(lab[seed])
        plate = np.isin(lab, ids[ids > 0])
    # 판 가장자리 한 줄(펠트와 맞닿은 회색 경계)도 걷는다
    plate = ndi.binary_dilation(plate, iterations=1) & opaque & (sat <= 18)

    # 2) 몸통: 불투명 - 흰 판, 작은 부스러기 정리, 구멍 메우기
    body = opaque & ~plate
    body = ndi.binary_opening(body, iterations=1)
    lab, n = ndi.label(body)
    if n > 1:
        sizes = ndi.sum(body, lab, range(1, n + 1))
        body = lab == (1 + int(np.argmax(sizes)))
    body = ndi.binary_fill_holes(body)

    # 2-1) 색 있는 판(코랄·연코랄): 펠트 끝과 흰 판 사이의 회분홍 그러데이션(흰 바탕에 번진 접지 그림자, 채도 16~39)도
    #      펠트가 아니다. '펠트 색보다 흰색 쪽으로 기운(t>0.25) 탁한(채도<45)' 가장자리 띠를 걷는다. 밝은 펠트 결은 채도가 높아 남는다.
    #      채도 기준만 쓰던 첫 판에서 코랄 판 아래 1~2px 연분홍 줄이 남았다(2026-10-02 검토 + 확대 확인). 크림 판은 펠트가 원래 희어 건너뛴다.
    colored = np.median(sat[body]) > 30
    t = None
    if colored:
        inner = ndi.binary_erosion(body, iterations=max(3, int(8 * scale)))
        C = np.median(rgb[inner], axis=0)
        d = 255.0 - C
        t = ((rgb - C) * d).sum(-1) / max(float((d * d).sum()), 1.0)
        depth = ndi.distance_transform_edt(body)
        rim = body & (depth <= 6 * scale) & (t > 0.25) & (sat < 45)
        plate |= rim
        body = ndi.binary_opening(body & ~rim, iterations=1)
        lab, n = ndi.label(body)
        if n > 1:
            sizes = ndi.sum(body, lab, range(1, n + 1))
            body = lab == (1 + int(np.argmax(sizes)))
        body = ndi.binary_fill_holes(body)

    # 3) 털 보풀(반투명이지만 펠트 색인 픽셀)은 몸통 가까이 있으면 살린다. 옛 그림자(짙고 옅은 픽셀)는 버린다.
    near = ndi.binary_dilation(body, iterations=max(2, int(3 * scale)))
    fuzz = (a > 0) & (a < 250) & (lum >= 110) & near & ~plate
    if colored:
        # 색 있는 판의 반투명 흰 보풀은 흰 바탕이 비친 것이라 가장 가까운 몸통 색으로 바꾼다(모양은 그대로)
        fuzz &= ~((t > 0.25) & (sat < 45) & ~ndi.binary_dilation(body, iterations=1))   # 몸통에서 떨어진 탁한 흰 보풀은 버린다
        whitish = fuzz & (t > 0.42)
        if whitish.any():
            _, (iy, ix) = ndi.distance_transform_edt(~body, return_indices=True)
            rgb = rgb.copy()
            rgb[whitish] = rgb[iy[whitish], ix[whitish]]
    alpha = np.where(body, 255.0, 0.0)
    alpha = np.where(fuzz, a, alpha)
    # 걷은 자리의 계단을 부드럽게: 몸통 경계만 살짝 흐린 값으로
    soft = ndi.gaussian_filter(body.astype(np.float32), 0.7 * scale) * 255
    edge = body & ~ndi.binary_erosion(body, iterations=2)
    alpha = np.where(edge, np.minimum(alpha, np.maximum(soft, 140)), alpha)

    # 4) 새 바닥 그림자: 몸통 모양을 아래로 조금 내려 흐린 것(빛은 위·왼쪽)
    m = body.astype(np.float32)
    dy, dx = 5 * scale, 1.5 * scale
    shifted = ndi.shift(m, (dy, dx), order=1, mode='constant')
    sh = ndi.gaussian_filter(shifted, 7 * scale)
    contact = ndi.gaussian_filter(ndi.shift(m, (2 * scale, 0.5 * scale), order=1), 2.2 * scale)
    shadow_a = np.clip(sh * 0.30 + contact * 0.16, 0, 0.42) * 255

    out = np.zeros((h, w, 4), np.float32)
    sc = np.array([47, 33, 29], np.float32)
    # 그림자 위에 몸통(알파 합성)
    fa = alpha / 255.0
    sa = shadow_a / 255.0 * (1 - fa)
    oa = fa + sa
    col = (rgb * fa[..., None] + sc * sa[..., None]) / np.maximum(oa[..., None], 1e-6)
    out[..., :3] = col
    out[..., 3] = oa * 255
    stats = {'plate_px': int(plate.sum()), 'body_px': int(body.sum())}
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGBA'), stats, plate


def main():
    p = argparse.ArgumentParser()
    p.add_argument('src')
    p.add_argument('dst')
    p.add_argument('--크기', default=None)
    p.add_argument('--확인', default=None)
    a = p.parse_args()
    img, stats, plate = fix(a.src)
    if a.확인:
        base = np.asarray(Image.open(a.src).convert('RGBA')).astype(np.float32)
        bg = np.array([40, 52, 90], np.float32)
        al = base[..., 3:4] / 255.0
        before = (base[..., :3] * al + bg * (1 - al)).astype(np.uint8)
        before[plate] = (255, 40, 40)
        aft = np.asarray(img).astype(np.float32)
        al2 = aft[..., 3:4] / 255.0
        after = (aft[..., :3] * al2 + bg * (1 - al2)).astype(np.uint8)
        page = np.array([243, 236, 224], np.float32)
        after_page = (aft[..., :3] * al2 + page * (1 - al2)).astype(np.uint8)
        sheet = np.concatenate([before, after, after_page], axis=0)
        Image.fromarray(sheet).save(a.확인)
    if a.크기:
        W, H = (int(x) for x in a.크기.split(','))
        img = img.resize((W, H), Image.LANCZOS)
    img.save(a.dst, 'WEBP', lossless=True, quality=100, method=6)
    print(a.dst, stats)


if __name__ == '__main__':
    main()
