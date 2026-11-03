# 판/*.png를 렌더용 jpg로 옮긴다(public/img).
import glob
from PIL import Image

밖 = 'remotion/public/img'
짝 = {'현관': 'hall', '코트': 'coat', '신발': 'shoes', '모자': 'hat', '장갑': 'mitt', '저녁': 'dusk', '벗어요': 'off', '이불': 'blanket', '낑낑0': 'stuck0', '낑낑1': 'stuck1', '눈길': 'street', '모자눈': 'hatslip', '벌렁': 'tipped'}
for a, b in 짝.items():
    Image.open(sorted(glob.glob(f'판/{a}_[0-9]*.png'))[-1]).convert('RGB').save(f'{밖}/{b}.jpg', quality=95)
print('완료')
