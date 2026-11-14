# 구운 판(1024×1536)을 세로 화면 판(1080×1920)으로 — 1.18배 · 왼쪽 40px · 위 280px를 잘라 할머니 · 케이크 · 몽글을 화면 위쪽에(원본 M11처럼 얼굴은 위, 말풍선은 아래 나무판),
# 모자란 아래는 나무 앞판 아래 띠를 거울로 이어 붙인다.
# 몽글(산호색) 덩어리의 위 끝 · 가운데를 재어 말풍선 꼬리 자리를 찍는다. 쓰는 법: python -I -X utf8 판/_판짜기.py <편 폴더>
import sys, glob, os, json
from PIL import Image, ImageOps
import numpy as np
편 = sys.argv[1]
S, X0, Y0 = 1.18, 40, 280
판들 = ['g1b', 'g2', 'g3', 'g4', 'g5', 'g5b', 'g6', 'g7', 'g8a', 'g8b', 'g9']
낼곳 = os.path.join(편, 'remotion', 'public', 'img')
os.makedirs(낼곳, exist_ok=True)
자리 = {}
for n in 판들:
    src = sorted(glob.glob(os.path.join(편, '판', n + '_*.png')))[-1]
    im = Image.open(src).convert('RGB')
    w, h = round(1024 * S), round(1536 * S)
    im = im.resize((w, h), Image.LANCZOS)
    x0 = round(X0 * S)
    im = im.crop((x0, Y0, x0 + 1080, h))
    h = h - Y0
    판 = Image.new('RGB', (1080, 1920))
    판.paste(im, (0, 0))
    모자람 = 1920 - h
    if 모자람 > 0:
        띠 = ImageOps.flip(im.crop((0, h - 모자람, 1080, h)))
        판.paste(띠, (0, h))
    이름 = n.replace('g1b', 'g1')
    판.save(os.path.join(낼곳, 이름 + '.jpg'), quality=93)
    a = np.asarray(판).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    산호 = (r > 170) & (g < 125) & (b < 120) & (r - g > 80)
    산호[:, :470] = False
    산호[:300, :] = False
    산호[1000:, :] = False
    ys, xs = np.nonzero(산호)
    위 = int(np.percentile(ys, 1)); 아래 = int(np.percentile(ys, 99))
    줄 = xs[ys < 위 + 40]
    자리[이름] = {'원본': os.path.basename(src), '몽글위': 위, '몽글아래': 아래, '몽글가운데x': int(np.median(줄)), '왼': int(np.percentile(xs, 1)), '오른': int(np.percentile(xs, 99))}
json.dump(자리, open(os.path.join(편, '판', '_판자리.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in 자리.items(): print(k, v)
