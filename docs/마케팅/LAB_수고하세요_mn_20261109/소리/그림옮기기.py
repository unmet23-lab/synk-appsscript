# 구운 판(판/*.png)을 렌더용 JPEG(remotion/public/img, 1080×1920)로 옮기고, 펠트 천 그림을 E32에서 가져와 쪽빛 천을 만든다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_수고하세요_mn_20261109/소리/그림옮기기.py
import glob
import os

import numpy as np
from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
이름 = {'방': 'room', '얼음2': 'ice', '햇살': 'sun', '교수얼음2': 'profIce', '빈방': 'roomEmpty', '빈햇살': 'sunEmpty', '빈얼음2': 'iceEmpty'}
for ko, en in 이름.items():
    후보 = sorted(glob.glob(os.path.join(판, f'{ko}_[0-9]*.png')))
    if not 후보:
        raise SystemExit(f'판이 없다: {ko}')
    src = 후보[-1]
    Image.open(src).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(os.path.join(밖, en + '.jpg'), quality=93)
    print(en, '←', os.path.basename(src))
크림 = os.path.join(여기, '..', '..', 'LAB_세시삼십분_20261109', 'remotion', 'public', 'img')
Image.open(os.path.join(크림, 'clothCream.jpg')).save(os.path.join(밖, 'clothCream.jpg'), quality=88)
a = np.asarray(Image.open(os.path.join(크림, 'clothGreen.jpg')).convert('L')).astype(float)
푸름 = np.clip((a / a.mean())[..., None] * np.array([38, 58, 92], float), 0, 255).astype('uint8')
Image.fromarray(푸름).save(os.path.join(밖, 'clothBlue.jpg'), quality=88)
print('천 끝')
