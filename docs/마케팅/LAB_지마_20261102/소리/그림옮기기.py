# 판/*.png를 렌더용 jpg로 옮긴다(public/img). 몽골판 M22에서 나눠 쓰는 그림(dusk · pat · end · end2 · cake · sleep · bag)은 복사해 둔 그대로 둔다.
import glob
from PIL import Image

밖 = 'remotion/public/img'
# 몰래 · 막는손 · 앞치마는 뒤쪽에 그의 가방 · 외투를 심은 판(…가방_*, v6 — 볼 이유 심사 「처음부터 떠날 준비가 보이게」)
짝 = {'몰래가방': 'sneak', '막는손가방': 'block', '앞치마가방': 'apron', '가방열기': 'open', '앞치마걸기': 'hang'}
for a, b in 짝.items():
    Image.open(sorted(glob.glob(f'판/{a}_[0-9]*.png'))[-1]).convert('RGB').save(f'{밖}/{b}.jpg', quality=95)
print('완료')
