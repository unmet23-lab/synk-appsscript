# M57 「авах」 구운 판(1024×1536 · 2:3)을 세로 화면 판(1080×1920)으로 — 1.25배(높이를 꼭 맞춤) · 왼쪽 80px(원본 기준)을 잘라
# 지우와 몽글을 가운데에, 붕어빵 수레 · 사진 부스는 양 끝에 반쯤 걸치게 둔다. 말풍선은 위쪽 흐린 가게 앞 자리, 꼬리는 아래로 인형 머리를 가리킨다.
# 지우(겨자색 패딩)와 몽글(산호색) 덩어리의 위 끝 · 가운데를 재어 꼬리 자리를 _판자리.json에 남긴다(Film.tsx가 칸마다 tip으로 쓴다).
# 쓰는 법: python -I -X utf8 판/_판짜기.py <편 폴더>
import sys, glob, os, json
from PIL import Image
import numpy as np
편 = sys.argv[1]
S, X0 = 1.25, 80
# 칸 이름 → 구운 판 이름(다시 구운 판은 뒤에 b · c)
판들 = {'c1': 'c1', 'c1b': 'c1b', 'c2': 'c2', 'c3': 'c3', 'c4': 'c4', 'c5': 'c5', 'c6': 'c6b', 'c6m': 'c6m', 'c6c': 'c6e', 'c7': 'c7c', 'c8': 'c8c', 'c9': 'c9b', 'c10': 'c10c'}  # 장면 심사 v1 · v2 · v3로 c6 · c7 · c8 · c9를 다시 굽고 c6m(반쯤 내밂) · c6c(내미는 판)를 더함
낼곳 = os.path.join(편, 'remotion', 'public', 'img')
os.makedirs(낼곳, exist_ok=True)
자리 = {}
for 이름, n in 판들.items():
    후보 = sorted(glob.glob(os.path.join(편, '판', n + '_[0-9]*.png')))
    if not 후보:
        continue
    src = 후보[-1]
    im = Image.open(src).convert('RGB')
    w, h = round(1024 * S), round(1536 * S)
    im = im.resize((w, h), Image.LANCZOS)
    x0 = round(X0 * S)
    판 = im.crop((x0, 0, x0 + 1080, 1920))
    판.save(os.path.join(낼곳, 이름 + '.jpg'), quality=93)
    a = np.asarray(판).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    def 덩어리(mask):
        ys, xs = np.nonzero(mask)
        if len(ys) < 200:
            return None
        위 = int(np.percentile(ys, 1))
        줄 = xs[ys < 위 + 40]
        return {'위': 위, '가운데x': int(np.median(줄)), '왼': int(np.percentile(xs, 1)), '오른': int(np.percentile(xs, 99))}
    산호 = (r > 175) & (g < 130) & (b < 120) & (r - g > 75)
    산호[:500, :] = False
    산호[1500:, :] = False
    산호[:, :330] = False  # 왼쪽 수레의 빨간 줄무늬 차양 · 몸통을 뺀다
    겨자 = (r > 170) & (g > 120) & (g < 190) & (b < 90) & (r - b > 110)
    겨자[:600, :] = False
    겨자[1500:, :] = False
    머리 = (r < 110) & (g < 80) & (b < 60)  # 지우의 짙은 갈색 단발
    머리[:500, :] = False
    머리[1300:, :] = False
    자리[이름] = {'원본': os.path.basename(src), '몽글': 덩어리(산호), '지우옷': 덩어리(겨자), '지우머리': 덩어리(머리)}
json.dump(자리, open(os.path.join(편, '판', '_판자리.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in 자리.items(): print(k, v)
