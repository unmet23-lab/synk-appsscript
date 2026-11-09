# 구운 판(판/*.png)을 렌더용 JPEG(remotion/public/img, 1080×1920)로 옮긴다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_피곤할때_mn_20261109/소리/그림옮기기.py
import glob
import os

from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
이름 = {
    '첫화면': 'open', '수업1': 'class1', '수업2': 'class2', '지하철1': 'sub1', '지하철2': 'sub2',
    '알바1': 'store1', '알바6': 'store2', '과제1': 'desk1', '과제2': 'desk2', '문자': 'phone', '번쩍3': 'up', '노래방': 'karaoke', '다음날3': 'next',
}
for ko, en in 이름.items():
    후보 = sorted(glob.glob(os.path.join(판, f'{ko}_[0-9]*.png')))
    if not 후보:
        raise SystemExit(f'판이 없다: {ko}')
    src = 후보[-1]
    Image.open(src).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(os.path.join(밖, en + '.jpg'), quality=93)
    print(en, '←', os.path.basename(src))
