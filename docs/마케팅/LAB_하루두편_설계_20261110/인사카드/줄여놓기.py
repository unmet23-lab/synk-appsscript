"""인사 그림을 조금 줄여 놓아 글자는 내리고 탁자 쪽 얼굴은 올린다 — 납작 엎드린 몽글처럼 얼굴이 낮은 장면에 쓴다.

    python -X utf8 줄여놓기.py <구운 그림.png> <낼 그림.jpg> --배율 0.96 --축 872 [--왼쪽 25]
    python -X utf8 줄여놓기.py <구운 그림.png> <낼 그림.jpg> --배율 0.9 --위 193 --하늘 85

그림을 1080x1920으로 맞춘 뒤 --배율로 줄여 가로 가운데에 놓는다. 세로 자리는 둘 가운데 하나로 준다:
  --축 y   줄여도 그 높이(1920 기준 px)가 제자리다. 축 위는 내려오고 축 아래는 올라온다.
  --위 px  줄인 그림의 윗변을 그 높이에 놓는다(글자가 아주 높게 구워져 많이 내려야 할 때).
빈 가장자리는 거울 이음으로 채운다. 위쪽 빈 자리가 글자 위 민무늬 하늘보다 길면 글자가 거꾸로 비치니
--하늘(구운 그림에서 글자가 시작하기 전까지의 민무늬 하늘, 1920 기준 px)을 주면 그 하늘 띠만 뒤집었다 바로 놓았다 이어 채운다(하늘잇기.py와 같다).
--왼쪽은 놓은 뒤 왼쪽으로 미는 px(옆으로.py와 같다). 아래로 넘친 줄은 잘린다(흐린 탁자).

숫자 고르기: 구운 그림을 1080x1920으로 봤을 때 글자 윗변 t, 얼굴 아랫변 f를 재고
  글자 윗변이 272px 아래:  위 + 배율 * t >= 272
  얼굴이 확대(Greeting.tsx — 축 (492, 300) · 1.04배) 뒤에도 아래 안전선 1428px 위:  위 + 배율 * f <= 1384
를 같이 채우는 가장 큰 배율을 쓴다(--축 y는 위 = y - 배율 * y). 11-14 「미안 · 죄송합니다」: 미국 0.96 · 축 872, 호주 0.9 · 위 193.
하늘잇기.py로 내리기만 하면 얼굴이 캡션 자리로 내려가는 장면에서 이것을 쓴다.

거울 이음은 결이 고른 펠트에서만 안 보인다 — 한쪽으로 빗은 결의 바탕은 이음매가 「ㅅ」 꼴로 드러나니 그 그림은 다시 굽는다.
"""
import sys

import numpy as np
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith('--')}
s = float(opt.get('--배율', 0.96))
dx = round(float(opt.get('--왼쪽', 0)))
W, H = 1080, 1920
im = np.asarray(Image.open(args[0]).convert('RGB').resize((W, H), Image.LANCZOS))
sw, sh = round(W * s), round(H * s)
small = np.asarray(Image.fromarray(im).resize((sw, sh), Image.LANCZOS)) if s != 1 else im
if '--위' in opt:
    y_off = round(float(opt['--위']))
else:
    y0 = float(opt.get('--축', 900))
    y_off = round(y0 - s * y0)
assert y_off >= 0, y_off
x_off = round(W / 2 - sw / 2)

# 위: 민무늬 하늘 띠를 번갈아 뒤집어 잇거나(--하늘) 거울 이음
if y_off and '--하늘' in opt:
    sky = max(1, round(float(opt['--하늘']) * s))
    strip = small[:sky]
    rows, need, flip = [], y_off, True
    while need > 0:
        part = strip[::-1] if flip else strip
        take = part[-need:] if need < sky else part  # 그림에 닿는 쪽(아래)부터 채운다
        rows.insert(0, take)
        need -= take.shape[0]
        flip = not flip
    body = np.concatenate(rows + [small], axis=0)
elif y_off:
    body = np.pad(small, ((y_off, 0), (0, 0), (0, 0)), mode='symmetric')
else:
    body = small
# 아래: 모자라면 거울 이음, 넘치면 자른다
if body.shape[0] < H:
    body = np.pad(body, ((0, H - body.shape[0]), (0, 0), (0, 0)), mode='symmetric')
body = body[:H]
res = np.pad(body, ((0, 0), (x_off, W - x_off - sw), (0, 0)), mode='symmetric')
assert res.shape == im.shape, (res.shape, im.shape)
if dx:
    res = np.concatenate([res[:, dx:], res[:, W - dx:][:, ::-1]], axis=1)
Image.fromarray(res).save(args[1], quality=92)
print(args[1], '배율', s, '위 채움', y_off, '좌우 채움', x_off, '왼쪽', dx)
