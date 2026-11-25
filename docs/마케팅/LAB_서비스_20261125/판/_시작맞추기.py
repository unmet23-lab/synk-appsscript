# 구운 2:3 판(1024×1536)을 Flow 시작 그림 9:16(1080×1920)으로 맞춘다(11-25 E64).
# 인물이 좌우 끝까지 서 있어 옆을 자르지 않고, 위쪽 빈 벽을 늘려 높이를 채운다:
# 맨 위 12줄 띠를 284줄로 늘리고 펠트 결(잔 낟알)을 얹은 뒤 원판 위에 붙인다 — 위 22%는 머리 글 자리라 판 결이 단조로워도 된다.
# 쓰는 법: python -I -X utf8 판/_시작맞추기.py <원판.png> <영상칸/시작/이름.jpg>
import sys
import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
NEED = round(W * 16 / 9)  # 1820
add = NEED - H
band = im.crop((0, 0, W, 12)).resize((W, add), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
rng = np.random.default_rng(64)
a = np.asarray(band).astype(np.float32)
noise = rng.normal(0, 5.0, (add, W, 1)).astype(np.float32)
noise = np.asarray(Image.fromarray(np.clip(noise[:, :, 0] + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)[:, :, None] - 128
a = np.clip(a + noise, 0, 255).astype(np.uint8)
top = Image.fromarray(a)
out = Image.new('RGB', (W, NEED))
out.paste(top, (0, 0))
out.paste(im, (0, add))
# 이음매를 8줄 섞는다
seam = 8
for y in range(seam):
    t = (y + 1) / (seam + 1)
    row_top = np.asarray(top.crop((0, add - seam + y, W, add - seam + y + 1))).astype(np.float32)
    row_im = np.asarray(im.crop((0, y, W, y + 1))).astype(np.float32)
    out.paste(Image.fromarray((row_top * (1 - t) + row_im * t).astype(np.uint8)), (0, add + y))
out = out.resize((1080, 1920), Image.LANCZOS)
out.save(dst, quality=94)
print(dst, out.size)
