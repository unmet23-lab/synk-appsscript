# 판/*.png를 렌더용 jpg로 옮기고, 문 장면에서 문보다 앞에 있어야 할 몽글을 닫힌 문 그림에서 오려 낸다(public/img/mongle_back.png).
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
import glob, os
판 = '판'
밖 = 'remotion/public/img'
def 최신(이름):
    return sorted(glob.glob(f'{판}/{이름}_*.png'))[-1]
짝 = {'패널꺼짐': 'panel_off', '안': 'in', '놀람': 'react', '문닫힘': 'door_closed', '문열림': 'door_open', '안도': 'relief'}
for a, b in 짝.items():
    Image.open(최신(a)).convert('RGB').save(f'{밖}/{b}.jpg', quality=95)
Image.open('판/참고/시안_b.png').convert('RGB').save(f'{밖}/panel_ghost.jpg', quality=95)
im = Image.open(최신('문닫힘')).convert('RGB')
hsv = np.asarray(im.convert('HSV')).astype(float)
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
m = ((h < 16) | (h > 240)) & (s > 95) & (v > 120)
m[:840] = False
m[1345:] = False
m = ndi.binary_closing(m, iterations=4)
라벨, n = ndi.label(m)
크기 = ndi.sum(m, 라벨, range(1, n + 1))
m = 라벨 == (1 + int(np.argmax(크기)))
m = ndi.binary_fill_holes(m)
a = Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.6))
out = im.copy()
out.putalpha(a)
out.save(f'{밖}/mongle_back.png')
ys, xs = np.where(m)
print('몽글', xs.min(), xs.max(), ys.min(), ys.max(), m.sum())

# 문짝 그림 — 닫힌 문에서 몽글 자리를 위쪽 문 면을 뒤집어 채운다(문이 밀릴 때 몽글이 문에 묻어 가지 않게)
a = np.asarray(im).copy()
y0, y1 = 835, 1283
위 = a[y0 - (y1 - y0): y0, 178:762][::-1]
섞임 = np.clip((np.arange(y1 - y0) / 40.0), 0, 1)[:, None, None]
a[y0:y1, 178:762] = (a[y0:y1, 178:762] * (1 - 섞임) + 위 * 섞임).astype('uint8')
# 가운데 틈은 그대로 이어지게 위쪽 틈 열을 아래로 늘인다
틈 = np.asarray(im)[700:705, 462:480].mean(axis=0).astype('uint8')
a[y0:y1, 462:480] = 틈
Image.fromarray(a).save(f'{밖}/door_leaf.jpg', quality=95)
