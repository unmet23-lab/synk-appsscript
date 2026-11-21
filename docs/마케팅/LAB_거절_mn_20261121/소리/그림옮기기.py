# 구운 판(판/*.png)을 렌더용 JPEG(remotion/public/img, 1080×1920)로 옮긴다. 판 이름마다 가장 늦게 구운 것을 쓴다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_거절_mn_20261121/소리/그림옮기기.py [영문 이름…]
import glob
import os
import sys

from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
이름 = {
    '첫화면': 'open', '얼음': 'freeze', '움찔': 'cringe', '움찔2': 'cringe2', '괜찮아': 'fine', '다음에': 'next', '생각': 'think', '봉투': 'envelope', '마이크': 'mic', '얼음끝': 'freeze2',
}
고를것 = set(sys.argv[1:])
for ko, en in 이름.items():
    if 고를것 and en not in 고를것:
        continue
    후보 = sorted(glob.glob(os.path.join(판, f'{ko}_[0-9]*.png')))
    if not 후보:
        print(f'판이 없다: {ko}')
        continue
    src = 후보[-1]
    Image.open(src).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(os.path.join(밖, en + '.jpg'), quality=93)
    print(en, '←', os.path.basename(src))
