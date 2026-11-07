# 구운 판(판/*.png, git 밖 원본)을 렌더용 JPEG(remotion/public/img, 1080×1920)로 옮긴다.
# 만들기: python -I -X utf8 docs/마케팅/LAB_괜찮아요_20261108/소리/그림옮기기.py
import os
import glob
from PIL import Image
여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
이름 = {
    '제안': 'offer', '반짝': 'sparkle', '신남': 'bounce', '거둠': 'back', '냠': 'bite', '빈봉지': 'empty',
    '연습': 'practice', '새것': 'again', '네좋아요': 'eager', '받음': 'got', '거울': 'mirror',
}
for ko, en in 이름.items():
    후보 = sorted(glob.glob(os.path.join(판, f'{ko}_*.png')))
    if not 후보:
        raise SystemExit(f'판이 없다: {ko}')
    src = 후보[-1]  # 가장 최근 판
    im = Image.open(src).convert('RGB').resize((1080, 1920), Image.LANCZOS)
    im.save(os.path.join(밖, en + '.jpg'), quality=93)
    print(en, '←', os.path.basename(src))
