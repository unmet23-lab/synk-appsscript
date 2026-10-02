# -*- coding: utf-8 -*-
"""흰 바탕 판에서 오린 부품의 바닥 그림자를 진한 반투명으로 바꾼다.

python experiences/entry-check/art-source/fix_shadow.py <오린폴더> <낼폴더> [--debug <확인그림폴더>]
(원본 크기의 오린 부품에 먼저 적용한다. 줄인 뒤에는 털 결이 뭉개져 그림자와 구별이 안 된다.)

왜: tools/펠트부품_오리기.py는 흰색과의 거리가 큰 곳을 몸통으로 잡는다. 색이 조금 비친 바닥 그림자
(초록 도장·종 아래 등)는 거리가 커서 몸통(불투명)에 들어가고, 밝은 회색 그대로 남아 진한 바탕·코랄 위에서
흰 번짐으로 보였다(2026-10-02 확인 시트).
어떻게: 그림자는 매끈하고(털 결이 없음) 밝고 채도가 낮다. 그런 픽셀 덩어리 가운데 바깥(투명 쪽)과
맞닿은 것만 '흰 바탕이 어두워진 그림자'로 보고 짙은 갈색 + 옅은 알파로 바꾼다. 털 결이 있는 크림 펠트는
결이 있어서 남는다. 몸통 밖 반투명 띠의 밝은 픽셀도 같은 방식으로 바꾼다.
"""
import sys, os, glob
import numpy as np
from PIL import Image
from scipy import ndimage

SHADE = np.array([46, 32, 28], np.float32)

src_dir, out_dir = sys.argv[1], sys.argv[2]
debug = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
os.makedirs(out_dir, exist_ok=True)
if debug: os.makedirs(debug, exist_ok=True)
if True:
    for f in sorted(glob.glob(os.path.join(src_dir, '*.webp'))):
        im = np.asarray(Image.open(f).convert('RGBA')).astype(np.float32)
        rgb, a = im[:, :, :3], im[:, :, 3] / 255.0
        seen = a[..., None] * rgb + (1 - a[..., None]) * 255.0      # 흰 바탕 위에서 보이던 색
        lum = seen.mean(axis=2)
        sat = seen.max(axis=2) - seen.min(axis=2)
        m1 = ndimage.uniform_filter(lum, 7); m2 = ndimage.uniform_filter(lum * lum, 7)
        tex = np.sqrt(np.clip(m2 - m1 * m1, 0, None))
        smooth = (lum > 168) & (tex < 3.4) & (sat < 30) & (a > 0.02)
        smooth = ndimage.binary_opening(smooth, iterations=1)
        outside = a < 0.5
        lab, n = ndimage.label(smooth | outside)
        # 바깥 투명 영역과 이어진 매끈한 밝은 덩어리만 그림자로 본다(안쪽의 크림 펠트 면은 바깥과 끊겨 있다)
        border = np.zeros_like(outside); border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
        touching = set(np.unique(lab[border & (lab > 0)])) - {0}
        shadow = np.isin(lab, list(touching)) & smooth
        # 몸통 밖 반투명 띠의 밝은 픽셀도 그림자 쪽으로
        core = (a >= 0.99) & ~shadow
        near = ndimage.binary_dilation(core, iterations=2)
        halo = (~near) & (a > 0) & (lum > 150)
        shadow |= halo
        sa = np.clip((255 - lum) / 255.0 * 1.8, 0, 0.42)
        a2 = np.where(shadow, sa, a)
        rgb2 = np.where(shadow[..., None], SHADE, rgb)
        out = Image.fromarray(np.dstack([rgb2, a2 * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
        out.save(os.path.join(out_dir, os.path.basename(f)), 'WEBP', lossless=True, method=6)
        if debug:
            dbg = seen.copy(); dbg[shadow] = [255, 0, 200]
            Image.fromarray(dbg.astype(np.uint8)).save(os.path.join(debug, os.path.basename(f).replace('.webp', '.jpg')), quality=85)
        print(os.path.basename(f), int(shadow.sum()))
