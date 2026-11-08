# 구운 판(판/*.png, 941×1672 안팎)을 영상 크기 1080×1920으로 채워(가운데 맞춤) public/img에 옮긴다. 종이컵 조각은 오린 PNG를 그대로 줄여 옮긴다.
# 사용: python -X utf8 docs/마케팅/LAB_이잔주세요_mn_20261108/remotion/판옮기기.py
import os
from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
판 = os.path.join(여기, '..', '판')
밖 = os.path.join(여기, 'public', 'img')
os.makedirs(밖, exist_ok=True)
W, H = 1080, 1920
판들 = {
    'order': '주문_152436.png',
    'lift': '머그_입지움.png',
    'freeze': '굳음_152950.png',
    'menu': '메뉴판_152436.png',
    'success': '성공_152725.png',
    'end': '끝_152951.png',
    'end2': '끝2_034755.png',
}
for 이름, 파일 in 판들.items():
    im = Image.open(os.path.join(판, 파일)).convert('RGB')
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = (im.height - H) // 2
    im.crop((x, y, x + W, y + H)).save(os.path.join(밖, f'{이름}.jpg'), quality=93)
    print(이름, '←', 파일)
컵 = Image.open(os.path.join(판, '종이컵_오림.png')).convert('RGBA')
상자 = 컵.getbbox()
컵 = 컵.crop(상자)
컵.thumbnail((360, 360), Image.LANCZOS)
컵.save(os.path.join(밖, 'cup.png'))
print('cup', 컵.size)
