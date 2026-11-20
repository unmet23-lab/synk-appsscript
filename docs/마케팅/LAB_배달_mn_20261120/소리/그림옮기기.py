# 구운 판(판/*.png)을 렌더용 JPEG(remotion/public/img, 1080×1920)로 옮긴다. 판 이름마다 가장 늦게 구운 것을 쓴다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_배달_mn_20261120/소리/그림옮기기.py [영문 이름…]
import glob
import os
import sys

from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
이름 = {
    '첫화면': 'open', '매움': 'spicy', '문앞2': 'door', '벨': 'bell', '진동2': 'buzz', '기사2': 'rider', '열기': 'lid', '킁킁': 'sniff', '깸': 'wake', '벌떡2': 'up', '이동': 'move', '같이': 'eat',
    # 11-20 첫 컷 다른 눈 v1 뒤: 끝 장면을 킁킁 · 벌떡2(얼굴 가까이) · 같이로 나눔(벌떡 첫 판은 넓은 구도라 놀람이 작았다)
    # 11-20 이해 시험 v2: 기사 첫 판은 손가락이 벨 앞에 있어 둘이 「벨을 눌렀는지 모름」 — 쉿 하고 발끝으로 물러나는 판(기사2)으로 다시 구움
    # 11-20: 문앞 · 진동 첫 판은 첫 화면과 구도가 같고(문앞) 폰이 몸에 박혀 보여(진동) 다른 구도로 다시 구움(문앞2 · 진동2)
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
