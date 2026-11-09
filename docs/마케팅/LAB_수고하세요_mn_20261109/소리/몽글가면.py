# 몽글 윤곽 가면 — 몽글 조각을 타원으로 오려 돌리면 타원 안의 문짝 · 벽까지 함께 돌아 꾸벅할 때 문 옆에 「유령 문짝」이 비쳤다(v9 끝 21.5초).
# 같은 구도로 구운 판과 몽글 없는 빈 판의 차이로 몽글만 따서, 조각(몽글)과 밑판(빈 판으로 메울 곳) 가면 두 장씩 낸다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_수고하세요_mn_20261109/소리/몽글가면.py
# 결과: remotion/public/mask/mongle_<판>.png(조각) · under_<판>.png(밑판) — 1080×1920 LA, 판은 room · sun · ice
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.spatial import ConvexHull
from PIL import ImageDraw

여기 = os.path.dirname(os.path.abspath(__file__))
그림 = os.path.join(여기, '..', 'remotion', 'public', 'img')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'mask')
os.makedirs(밖, exist_ok=True)

# 몽글 자리(Film.tsx MONGLE과 같다) — 이 타원 밖의 차이는 보지 않는다
CX, CY, RX, RY = 287, 1390, 330, 380
H, W = 1920, 1080
y, x = np.mgrid[0:H, 0:W]
안 = ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2 <= 1


def 읽기(이름):
    return np.asarray(Image.open(os.path.join(그림, f'{이름}.jpg')).convert('RGB'), dtype=np.float32)


def 가면(판, 빈판, 문턱):
    a, b = 읽기(판), 읽기(빈판)
    d = np.abs(a - b).mean(axis=2)
    d = ndimage.gaussian_filter(d, 4)
    m = (d > 문턱) & 안
    # 얇은 띠(그림자 · 서리 결 차이)는 끊고 몸통만 — 몽글은 둥근 덩어리라 볼록 껍질로 홈을 메운다
    m = ndimage.binary_opening(m, iterations=9)
    라벨, 수 = ndimage.label(m)
    if 수 == 0:
        raise SystemExit(f'{판}: 몽글을 못 찾음')
    크기 = ndimage.sum(m, 라벨, range(1, 수 + 1))
    m = 라벨 == (np.argmax(크기) + 1)
    ys, xs = np.nonzero(m)
    점 = np.stack([xs, ys], 1)[::7]
    껍질 = 점[ConvexHull(점).vertices]
    판그림 = Image.new('L', (W, H), 0)
    ImageDraw.Draw(판그림).polygon([tuple(map(int, q)) for q in 껍질], fill=255)
    return np.asarray(판그림) > 0


def 저장(m, 늘림, 흐림, 이름):
    if 늘림 > 0:
        m = ndimage.binary_dilation(m, iterations=늘림)
    img = Image.fromarray((m * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(흐림))
    la = Image.merge('LA', (Image.new('L', (W, H), 255), img))
    la.save(os.path.join(밖, 이름), optimize=True)
    return int(m.sum())


# 햇살 판은 몽글 오른쪽 아래가 그늘이라 빈 판과 차이가 30 안팎 — 문턱을 낮춘다(배경 차이는 7~14)
for 판, 빈판, 문턱 in (('room', 'roomEmpty', 34), ('sun', 'sunEmpty', 22), ('ice', 'iceEmpty', 34)):
    m = 가면(판, 빈판, 문턱)
    ys, xs = np.nonzero(m)
    조각 = 저장(m, 1, 2.5, f'mongle_{판}.png')
    밑판 = 저장(m, 26, 6, f'under_{판}.png')
    print(f'{판}: 몽글 {int(m.sum())}px · x {xs.min()}~{xs.max()} · y {ys.min()}~{ys.max()} · 조각 {조각} · 밑판 {밑판}')
