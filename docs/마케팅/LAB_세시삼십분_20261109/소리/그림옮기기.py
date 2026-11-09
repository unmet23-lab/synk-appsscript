# 구운 판(판/*.png)을 렌더용으로 옮긴다 — 방 · 놀람 · 뿌듯은 1080×1920 JPEG, 바늘 넷은 흰 바탕에서 오려 webp + 축(고리 구멍 중심) 값을 hands.json에.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_세시삼십분_20261109/소리/그림옮기기.py
import glob
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
뿌리 = os.path.abspath(os.path.join(여기, '..', '..', '..', '..'))


def 최근(이름):
    후보 = sorted(glob.glob(os.path.join(판, f'{이름}_[0-9]*.png')))
    if not 후보:
        raise SystemExit(f'판이 없다: {이름}')
    return 후보[-1]


for ko, en in {'방2': 'room', '놀람2': 'startled', '뿌듯6': 'proud', '빈방': 'roomEmpty'}.items():
    src = 최근(ko)
    Image.open(src).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(os.path.join(밖, en + '.jpg'), quality=93)
    print(en, '←', os.path.basename(src))

def 오리기(src, 낼):
    subprocess.run([sys.executable, '-X', 'utf8', os.path.join(뿌리, 'tools', '펠트_흰바탕오리기.py'), src, 낼], check=True)
    im = Image.open(낼).convert('RGBA')
    # 아르곤 맹검 「하얀 오려내기 테두리」 — 털끝의 흰빛을 안쪽으로 8칸 깎고 가장자리만 살짝 부드럽게
    r, g, b, a = im.split()
    a = a.filter(ImageFilter.MinFilter(17)).filter(ImageFilter.GaussianBlur(1.6))
    im = Image.merge('RGBA', (r, g, b, a))
    im.save(낼, quality=95)
    return im


축 = {}
for ko, en in {'시침_몸': 'hourBody', '분침_몸': 'minuteBody'}.items():
    im = 오리기(최근(ko), os.path.join(밖, en + '.webp'))
    a = np.asarray(im)[:, :, 3] > 40
    ys, xs = np.where(a)
    # 고리 구멍 — 물건 안에 갇힌 빈 칸 가운데 맨 아래 덩어리의 중심이 돌릴 축이다
    빈칸, 수 = ndi.label(~a)
    구멍 = []
    for i in range(1, 수 + 1):
        yy, xx = np.where(빈칸 == i)
        if yy.min() == 0 or xx.min() == 0 or yy.max() == a.shape[0] - 1 or xx.max() == a.shape[1] - 1:
            continue
        if len(yy) > 150:
            구멍.append((float(yy.mean()), float(xx.mean()), len(yy)))
    if not 구멍:
        raise SystemExit(f'고리 구멍을 못 찾았다: {en}')
    y0, x0, _ = max(구멍, key=lambda h: h[0])
    축[en] = {'w': im.width, 'h': im.height, 'px': round(x0, 1), 'py': round(y0, 1), 'len': round(y0 - float(ys.min()), 1)}
    print(en, 축[en])
for ko, en in {'시침머리3_평': 'hourHeadCalm', '시침머리3_외침': 'hourHeadShout', '시침머리3_환호': 'hourHeadCheer', '분침머리3_평': 'minuteHeadCalm', '분침머리3_외침': 'minuteHeadShout', '분침머리3_환호': 'minuteHeadCheer', '시침머리3_움찔': 'hourHeadGasp', '분침머리3_움찔': 'minuteHeadGasp'}.items():
    im = 오리기(최근(ko), os.path.join(밖, en + '.webp'))
    축[en] = {'w': im.width, 'h': im.height}
    print(en, 축[en])
with open(os.path.join(밖, 'hands.json'), 'w', encoding='utf8') as f:
    json.dump(축, f, ensure_ascii=False, indent=1)
for 옛 in ['hour', 'hourShout', 'hourCheer', 'minute', 'minuteShout', 'minuteCheer']:
    옛파일 = os.path.join(밖, 옛 + '.webp')
    if os.path.exists(옛파일):
        os.remove(옛파일)
