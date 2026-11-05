"""A안 맞추기 (2026-11-05) — 3:1로 구운 그림을 링크드인 4:1 커버(1584×396)로 옮긴다.

휴대폰 링크드인에서는 프로필 사진이 커버 왼쪽 7~47%를 위아래로 다 덮는다(11-05 실측).
로고 건물이 50%보다 오른쪽에 오게 하는 방법이 둘이다.

  python -I -X utf8 A안_맞추기.py <구운그림.png> <낼이름> 이음 [오른쪽이음px=0]
      왼쪽 끝이 매끈한 어둠(스튜디오)일 때. 왼쪽에 맨 왼쪽 기둥 색을 늘여 붙이고 이음매를 넓게 섞는다.
      오른쪽이음을 주면 그만큼 오른쪽에도 붙여(맨 오른쪽 기둥) 전체를 왼쪽으로 당긴다.
  python -I -X utf8 A안_맞추기.py <구운그림.png> <낼이름> 자르기 [위px=중앙]
      왼쪽에 풍경이 이어져 늘이면 줄무늬가 생길 때. 폭을 그대로 두고 위아래만 4:1로 자른다(위px는 원본 기준).

→ <낼이름>_2x.png (3168×792) · <낼이름>.png (1584×396, 올리는 판)
"""
import sys
import numpy as np
from PIL import Image

src, out, 방식 = sys.argv[1], sys.argv[2], sys.argv[3]
W2, H2 = 3168, 792
im = Image.open(src).convert('RGB')

if 방식 == '자르기':
    h = round(im.width / 4)
    위 = int(sys.argv[4]) if len(sys.argv) > 4 else (im.height - h) // 2
    img = im.crop((0, 위, im.width, 위 + h)).resize((W2, H2), Image.LANCZOS)
else:
    오른쪽 = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    s = H2 / im.height
    im = im.resize((round(im.width * s), H2), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    pad = W2 - a.shape[1] - 오른쪽
    col = a[:, :16].mean(axis=1, keepdims=True)
    parts = [np.repeat(col, pad, axis=1), a]
    if 오른쪽:
        rcol = a[:, -16:].mean(axis=1, keepdims=True)
        parts.append(np.repeat(rcol, 오른쪽, axis=1))
    canvas = np.concatenate(parts, axis=1)
    f = 360  # 이음매 섞기(smoothstep)
    w = np.linspace(0, 1, f)[None, :, None]
    w = w * w * (3 - 2 * w)
    canvas[:, pad:pad + f] = col * (1 - w) + canvas[:, pad:pad + f] * w
    if 오른쪽:
        e = pad + a.shape[1]
        g = min(240, a.shape[1])
        w2 = np.linspace(1, 0, g)[None, :, None]
        w2 = w2 * w2 * (3 - 2 * w2)
        canvas[:, e - g:e] = canvas[:, e - g:e] * w2 + rcol * (1 - w2)
    rng = np.random.default_rng(7)  # 늘인 면에 원본만큼 옅은 입자
    canvas += rng.normal(0, 1.6, canvas.shape[:2])[..., None] * (np.arange(W2) < pad + f)[None, :, None]
    img = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))

img.save(out + '_2x.png')
img.resize((1584, 396), Image.LANCZOS).save(out + '.png')
print(out, 방식, img.size)
