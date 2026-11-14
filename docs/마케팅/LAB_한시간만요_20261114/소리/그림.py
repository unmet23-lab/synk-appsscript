# LAB 영어 E38 「한 시간만요」 그림 옮기기 — 구운 판(판/*.png)을 1080×1920 jpg로 remotion/public/img에 두고,
# 바늘 판(hands)에서 분 바늘 · 시 바늘을 따로 오려(갈색 펠트 → 알파) 바늘 축이 그림 아래쪽 가운데에 오는 PNG로 만든다.
# 방 그림마다 바늘 없는 벽시계의 가운데 · 반지름을 재서 clock.json에 적는다(Film이 그 자리에 바늘을 꽂아 돌린다).
# 만들기(저장소 뿌리에서): python -I -X utf8 docs/마케팅/LAB_한시간만요_20261114/소리/그림.py
import glob
import json
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)

이름들 = ['door', 'counter', 'enter', 'comic', 'sleep', 'clock', 'peek', 'wake']
for 이름 in 이름들:
    파일 = sorted(glob.glob(os.path.join(판, f'{이름}_*.png')))[-1]
    Image.open(파일).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(os.path.join(밖, f'{이름}.jpg'), quality=93)

# 바늘 — 흰 바탕의 갈색 펠트 두 개(왼쪽 긴 분 바늘 · 오른쪽 짧은 시 바늘)
h = np.asarray(Image.open(sorted(glob.glob(os.path.join(판, 'hands_*.png')))[-1]).convert('RGB'), dtype=np.float32)
밝기 = h.mean(axis=2)
m = 밝기 < 200
m = ndimage.binary_opening(m, iterations=2)
라벨, 수 = ndimage.label(m)
크기 = ndimage.sum(m, 라벨, range(1, 수 + 1))
큰둘 = np.argsort(크기)[-2:] + 1
조각 = []
for k in 큰둘:
    mk = 라벨 == k
    ys, xs = np.where(mk)
    조각.append((xs.mean(), mk, ys.min(), ys.max(), xs.min(), xs.max()))
조각.sort(key=lambda c: c[0])  # 왼쪽 = 분, 오른쪽 = 시
바늘 = {}
for 이름, (cx, mk, y0, y1, x0, x1) in zip(['minute', 'hour'], 조각):
    알파 = np.clip((215 - 밝기) / 60, 0, 1) * ndimage.binary_dilation(mk, iterations=3)
    알파 = ndimage.gaussian_filter(알파, 0.8)
    # 축(둥근 머리)은 아래쪽 끝 — 그 가운데를 그림 아래 가운데에 둔다
    폭 = x1 - x0
    축y = y1 - 폭 * 0.5
    축x = (x0 + x1) / 2
    위 = int(y0 - 6)
    길이 = int(축y - 위)
    상자 = (int(축x - 폭 * 0.7), 위, int(축x + 폭 * 0.7), int(축y + 길이))  # 축 아래로 같은 길이를 비워 축이 가운데
    rgba = np.dstack([h, 알파 * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA').crop(상자)
    im.save(os.path.join(밖, f'hand_{이름}.png'))
    바늘[이름] = {'w': im.width, 'h': im.height, 'len': 길이}
    print(이름, im.size, '길이', 길이)

# 방 그림의 시계 — 크림색 둥근 판(밝고 채도 낮음)에서 가장 둥근 덩어리
시계 = {}
for 이름 in ['enter', 'comic', 'sleep', 'clock', 'peek', 'wake']:
    a = np.asarray(Image.open(os.path.join(밖, f'{이름}.jpg')).convert('RGB'), dtype=np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    크림 = (r > 200) & (g > 140) & (b > 90)  # 따뜻한 빛 아래 크림 판은 살구빛(235 · 178 · 126 안팎)이다
    yy, xx = np.mgrid[0:1920, 0:1080]
    크림 &= (yy > 300) & (yy < (1500 if 이름 == 'clock' else 950)) & (xx > 200) & (xx < 880)
    크림 = ndimage.binary_opening(크림, iterations=3)
    크림 = ndimage.binary_fill_holes(ndimage.binary_closing(크림, iterations=6))
    라벨, 수 = ndimage.label(크림)
    best = None
    for k in range(1, 수 + 1):
        mk = 라벨 == k
        n = mk.sum()
        if n < 5000:
            continue
        ys, xs = np.where(mk)
        w, hh = xs.max() - xs.min(), ys.max() - ys.min()
        둥금 = n / (np.pi * (w / 2) * (hh / 2) + 1)
        if abs(w - hh) / max(w, hh) > 0.15 or 둥금 < 0.85:
            continue
        if best is None or n > best[0]:
            best = (n, xs.mean(), ys.mean(), (w + hh) / 4)
    if best:
        시계[이름] = {'x': round(best[1], 1), 'y': round(best[2], 1), 'r': round(best[3], 1)}
    print(이름, 시계.get(이름))
json.dump({'시계': 시계, '바늘': 바늘}, open(os.path.join(밖, 'clock.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('그림 끝')
