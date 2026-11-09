# 몽글 윤곽 가면 — 몽글 조각을 타원으로 오려 부풀리거나 기울이면 타원 안의 벽 · 책상 · 공책까지 함께 움직여 겹쳐 보인다(M32 「유령 문짝」과 같은 꼴).
# 같은 구도의 판(방 · 놀람 · 뿌듯)과 몽글 없는 빈 판(빈방)의 차이로 몽글만 따서, 조각(몽글)과 밑판(빈 판으로 메울 곳) 가면 두 장씩 낸다.
# M32 「수고하세요」의 소리/몽글가면.py를 옮겨 왔다. 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_세시삼십분_20261109/소리/몽글가면.py
# 결과: remotion/public/mask/mongle_<판>.png(조각) · under_<판>.png(밑판) — 1080×1920 LA, 판은 room · startled · proud
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from scipy.spatial import ConvexHull

여기 = os.path.dirname(os.path.abspath(__file__))
그림 = os.path.join(여기, '..', 'remotion', 'public', 'img')
밖 = os.path.join(여기, '..', 'remotion', 'public', 'mask')
os.makedirs(밖, exist_ok=True)

# 몽글이 있을 수 있는 자리(책상 왼쪽 아래) — 이 타원 밖의 차이는 보지 않는다. 외치는 판은 몸이 위로 늘어 위를 넉넉히 잡는다
CX, CY, RX, RY = 300, 1500, 360, 380
H, W = 1920, 1080
y, x = np.mgrid[0:H, 0:W]
안 = ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2 <= 1


def 읽기(이름):
    return np.asarray(Image.open(os.path.join(그림, f'{이름}.jpg')).convert('RGB'), dtype=np.float32)


빈 = 읽기('roomEmpty')


def 가면(판, 문턱):
    d = np.abs(읽기(판) - 빈).mean(axis=2)
    d = ndimage.gaussian_filter(d, 4)
    m = (d > 문턱) & 안
    # 얇은 띠(빛 · 결 차이)는 끊고 몸통만 — 몽글은 둥근 덩어리라 볼록 껍질로 홈을 메운다
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
    Image.merge('LA', (Image.new('L', (W, H), 255), img)).save(os.path.join(밖, 이름), optimize=True)
    return int(m.sum())


for 판, 문턱 in (('room', 22), ('startled', 22), ('proud', 22)):
    m = 가면(판, 문턱)
    ys, xs = np.nonzero(m)
    조각 = 저장(m, 8, 3, f'mongle_{판}.png')  # 벽은 고른 색이라 조금 넉넉히 — 털끝이 잘리지 않게
    밑판 = 저장(m, 34, 6, f'under_{판}.png')
    print(f'{판}: 몽글 {int(m.sum())}px · x {xs.min()}~{xs.max()} · y {ys.min()}~{ys.max()} · 조각 {조각} · 밑판 {밑판}')
