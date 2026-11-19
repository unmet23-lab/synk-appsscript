# 구운 판(판/*.png)을 렌더용 JPEG(remotion/public/img, 1080×1920)로 옮긴다. 판 이름마다 가장 늦게 구운 것을 쓴다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_아무거나_mn_20261119/소리/그림옮기기.py [영문 이름…]
import glob
import os
import sys

from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'img')
os.makedirs(밖, exist_ok=True)
이름 = {
    '첫화면2': 'open', '물음': 'ask', '아무1': 'any', '떡볶이': 'ttok1', '떡볶이2': 'ttok2', '치킨': 'chick1', '치킨2': 'chick2',
    '라면': 'ramen1', '라면2': 'ramen2', '폭발2': 'boom', '폭발3': 'boom2', '메뉴판2': 'menu1', '메뉴판3': 'menu2', '내려놓음': 'lower', '털썩': 'drop', '주저앉음2': 'sit', '기울어짐': 'lean', '엎어짐2': 'flop',
    # 첫 컷 검사 v6 뒤(11-19): 메뉴판에서 털썩 사이에 「내려놓음」(두 손으로 판을 탁자에 내려놓음)을 더함
    # 첫 컷 검사 v1 뒤(11-19): 폭발 → 폭발2(뒤에 탁자 · 의자), 메뉴판 → 메뉴판2 · 3(폭발과 같은 크림 바탕 메뉴판), 주저앉음2를 더함
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
