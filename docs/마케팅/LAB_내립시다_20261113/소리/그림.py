# LAB 영어 E36 「내립시다」 그림 옮기기 — 구운 판(판/*.png)을 1080×1920 jpg로 remotion/public/img에 두고,
# 문 닫힌 판(close)의 몽글만 산호색으로 따서 조각(m_back.png)을 만든다 — 열차만 있는 판(train)이 미끄러져 나갈 때 몽글은 제자리에 있어야 해서다.
# 만들기(저장소 뿌리에서): python -I -X utf8 docs/마케팅/LAB_내립시다_20261113/소리/그림.py
import glob
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)

for 이름 in ['call', 'think', 'out', 'walk', 'close', 'train', 'alone', 'meant', 'polite', 'bench', 'gap', 'sad', 'empty']:
    파일 = sorted(glob.glob(os.path.join(판, f'{이름}_*.png')))[-1]
    Image.open(파일).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(os.path.join(밖, f'{이름}.jpg'), quality=93)

a = np.asarray(Image.open(os.path.join(밖, 'close.jpg')).convert('RGB'), dtype=np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
산호 = (r > 150) & (r - g > 55) & (r - b > 45) & (g - b < 60)  # 노란 점자 띠(g − b가 크다)는 뺀다
y, x = np.mgrid[0:1920, 0:1080]
산호 &= (x > 540) & (y > 1080) & (y < 1660)
m = ndimage.binary_closing(산호, iterations=10)
m = ndimage.binary_fill_holes(m)
m = ndimage.binary_opening(m, iterations=4)
라벨, 수 = ndimage.label(m)
크기 = ndimage.sum(m, 라벨, range(1, 수 + 1))
m = 라벨 == (1 + int(np.argmax(크기)))
m = ndimage.binary_dilation(m, iterations=5)  # 털 가장자리 · 박음질 밑단까지
알파 = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5))
조각 = Image.open(os.path.join(밖, 'close.jpg')).convert('RGBA')
조각.putalpha(알파)
조각.save(os.path.join(밖, 'm_back.png'))
ys, xs = np.where(m)
print('몽글 조각', xs.min(), xs.max(), ys.min(), ys.max())
