# 구운 판(1024×1536)을 세로 화면 판(1080×1920)으로 — M49 「더 먹어」(11-22).
# 1.0547배(가로 1080)로 키워 위 150px 자리에 놓는다. 위 빈 띠는 벽 맨 위 띠를 거울로, 아래 빈 띠는 깔개 맨 아래 띠를 거울로 잇는다.
# 얼굴은 화면 가운데 위(어머니 머리 약 560~890px), 밥상 앞판과 깔개(약 1100~1920px)는 말풍선 자리다.
# 몽글(산호색) 덩어리의 위 · 아래 · 가운데를 재어 말풍선 꼬리와 칸마다의 카메라 축을 잡는다. 쓰는 법: python -I -X utf8 판/_판짜기.py <편 폴더>
import sys, glob, os, json
from PIL import Image, ImageOps
import numpy as np
편 = sys.argv[1]
S, Y0 = 1080 / 1024, 150
판들 = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7c', 'g8a', 'g8m', 'g8b', 'g8c', 'g9', 'g10']
낼곳 = os.path.join(편, 'remotion', 'public', 'img')
os.makedirs(낼곳, exist_ok=True)
자리 = {}
for n in 판들:
    src = sorted(glob.glob(os.path.join(편, '판', n + '_*.png')))[-1]
    im = Image.open(src).convert('RGB').resize((1080, round(1536 * S)), Image.LANCZOS)
    h = im.size[1]
    판 = Image.new('RGB', (1080, 1920))
    판.paste(im, (0, Y0))
    판.paste(ImageOps.flip(im.crop((0, 0, 1080, Y0))), (0, 0))
    아래 = 1920 - (Y0 + h)
    if 아래 > 0:
        판.paste(ImageOps.flip(im.crop((0, h - 아래, 1080, h))), (0, Y0 + h))
    판.save(os.path.join(낼곳, n + '.jpg'), quality=93)
    a = np.asarray(판).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    산호 = (r > 170) & (g < 120) & (b < 115) & (r - g > 85)
    산호[:, :430] = False
    산호[:, 900:] = False
    산호[:500, :] = False
    산호[1150:, :] = False
    ys, xs = np.nonzero(산호)
    위 = int(np.percentile(ys, 1)); 아래끝 = int(np.percentile(ys, 99))
    자리[n] = {'원본': os.path.basename(src), '몽글위': 위, '몽글아래': 아래끝, '몽글가운데x': int(np.median(xs)), '왼': int(np.percentile(xs, 1)), '오른': int(np.percentile(xs, 99))}
json.dump(자리, open(os.path.join(편, '판', '_판자리.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in 자리.items(): print(k, v)
