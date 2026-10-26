# 파랑 바탕에서 구운 종이띠(판/P1_종이띠_*.png)를 오려 remotion/public/img/paper.png로 — 비친 파랑은 빨강 채널로 밝기를 잡아 따뜻한 흰색으로 다시 칠한다.
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
blue = np.clip((B - R - 60) / 80, 0, 1)          # 파랑 바탕일수록 1
alpha = 1 - blue
ys, xs = np.where(alpha > 0.5)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
lum = np.clip(R / 255.0, 0, 1)                      # 빨강 채널 = 비친 파랑을 뺀 종이 결
lum = 0.82 + 0.18 * (lum - lum[alpha > 0.9].min()) / max(1e-3, (lum[alpha > 0.9].max() - lum[alpha > 0.9].min()))
warm = np.stack([lum * 252, lum * 249, lum * 242], -1)
rgba = np.dstack([warm, alpha * 255]).astype(np.uint8)[y0:y1, x0:x1]
Image.fromarray(rgba, 'RGBA').save(out)
print(out, rgba.shape)
