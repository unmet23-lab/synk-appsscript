# 판/*.png · 판/오림/*.webp를 렌더용으로 옮긴다(public/img). 장면은 jpg, 오린 소품은 png.
import glob
from PIL import Image

밖 = 'remotion/public/img'
짝 = {'보통': 'normal', '놀람': 'shock', '기쁨': 'joy', '끝거북이': 'end', '어질': 'dizzy', '끝물음': 'end2', '끝밥': 'end3'}
for a, b in 짝.items():
    Image.open(sorted(glob.glob(f'판/{a}_[0-9]*.png'))[-1]).convert('RGB').save(f'{밖}/{b}.jpg', quality=95)
for 이름 in ['block1', 'block2', 'block3', 'block4', 'turtle', 'plank', 'wedge']:
    Image.open(f'판/오림/{이름}.webp').convert('RGBA').save(f'{밖}/{이름}.png')
print('완료')
