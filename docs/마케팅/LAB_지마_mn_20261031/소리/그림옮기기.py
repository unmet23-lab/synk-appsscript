# 판/*.png를 렌더용 jpg로 옮긴다(public/img).
import glob
from PIL import Image

밖 = 'remotion/public/img'
짝 = {'케이크': 'cake', '잠': 'sleep', '가방': 'bag', '손': 'pat', '끝': 'end'}
for a, b in 짝.items():
    Image.open(sorted(glob.glob(f'판/{a}_*.png'))[-1]).convert('RGB').save(f'{밖}/{b}.jpg', quality=95)
Image.open('판/참고/시안_b.png').convert('RGB').save(f'{밖}/dusk.jpg', quality=95)
print('완료')
