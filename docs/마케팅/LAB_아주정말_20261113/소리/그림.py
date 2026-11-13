# 구운 판(판/*.png)을 렌더용 그림(remotion/public/img)으로 옮긴다.
#  - 방 판(방1 · 방2 · 방3)은 1080×1920 JPEG로
#  - 낱말 조각판(조각)은 흰 바탕에서 조각 열두 장을 하나씩 오려 투명 PNG로(줄 순서대로 w01~w12)
# 만들기(저장소 뿌리에서): python -I -X utf8 docs/마케팅/LAB_아주정말_20261113/소리/그림.py
import glob
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)


def 마지막(이름):
    후보 = sorted(glob.glob(os.path.join(판, f'{이름}_[0-9]*.png')))
    if not 후보:
        return None
    return 후보[-1]


for ko, en in {'방1': 'room1', '방2': 'room2', '방3': 'room3'}.items():
    src = 마지막(ko)
    if not src:
        print('아직 없음:', ko)
        continue
    Image.open(src).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(os.path.join(밖, en + '.jpg'), quality=93)
    print(en, '←', os.path.basename(src))

# 낱말 조각 — 줄 순서: 아주 정말 진짜 / 완전 매우 너무 / 엄청 되게 무척 / 굉장히 몹시 대단히
낱말 = ['아주', '정말', '진짜', '완전', '매우', '너무', '엄청', '되게', '무척', '굉장히', '몹시', '대단히']
def 오리기(src, 접두, 이름표=None):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    mx, mn = a.max(axis=2), a.min(axis=2)
    # 바탕 = 밝고 색이 거의 없는 칸(흰 바탕 · 옅은 회색 그림자)
    바탕 = (mn > 196) & ((mx - mn) < 20)
    몸 = ndimage.binary_opening(~바탕, iterations=2)
    몸 = ndimage.binary_fill_holes(몸)
    표, n = ndimage.label(몸)
    조각들 = []
    for k in range(1, n + 1):
        ys, xs = np.where(표 == k)
        if len(ys) < 4000:
            continue
        조각들.append((ys.min(), ys.max(), xs.min(), xs.max(), k))
    # 줄(위 → 아래) 다음 칸(왼 → 오) 순서
    조각들.sort(key=lambda b: (round((b[0] + b[1]) / 2 / 150), (b[2] + b[3]) / 2))
    if len(조각들) != 12:
        raise SystemExit(f'조각이 12장이 아니다: {len(조각들)}')
    for i, (y0, y1, x0, x1, k) in enumerate(조각들):
        pad = 6
        y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
        y1, x1 = min(a.shape[0], y1 + pad), min(a.shape[1], x1 + pad)
        mask = Image.fromarray(((표[y0:y1, x0:x1] == k) * 255).astype(np.uint8))
        mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
        tile = im.crop((x0, y0, x1, y1)).convert('RGBA')
        tile.putalpha(mask)
        이름 = f'{접두}{i + 1:02d}'
        tile.save(os.path.join(밖, 이름 + '.png'))
        print(이름, 이름표[i] if 이름표 else '', tile.size)


if 마지막('조각'):
    오리기(마지막('조각'), 'w', 낱말)
# 쏟아지는 조각은 글 없는 빈 조각(이해 시험 v3 — 시험관 둘이 「작은 조각 글을 못 읽음」을 세 판 내리 짚음)
if 마지막('빈조각'):
    오리기(마지막('빈조각'), 'b')
