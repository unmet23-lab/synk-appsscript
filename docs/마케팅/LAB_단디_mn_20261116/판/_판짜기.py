# LAB 몽골 M55 「단디」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다.
# 칸마다 GPT가 카메라를 조금씩 다르게 잡아(탁자 윗면 높이가 62~70%) 고정 카메라인데 칸이 바뀔 때 탁자가 뛰었다.
# 그래서 칸마다 탁자 윗면 선(나무 탁자 앞판이 시작하는 가로 경계)을 찾아 화면 TABLE_Y에 오게 세로로 맞춘다.
# 배율은 칸마다 같은 1.25배(1280×1920)로 둔다(칸마다 키우면 인물 크기가 뛴다). 위로 밀어 아래가 비면 탁자 앞판 아래 띠를 뒤집어 이어 붙인다(민무늬 펠트). 가로는 가운데를 자른다.
#   python -I -X utf8 판/_판짜기.py <칸 이름=구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
#   python -I -X utf8 판/_판짜기.py --재기 <구운 파일 …>      → 탁자 선만 잰다
import sys, os
import numpy as np
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
W, H = 1080, 1920
TABLE_Y = 1230  # 화면 판에서 탁자 앞판 윗선이 올 자리 — 탁자 윗면(몽글 밑단)이 약 1113px, 그 아래 1140~1420px가 자막 판 자리(글자 안전선 아래 끝 1428)
BASE_K = 1.25


def table_top(im):
    """탁자 윗면 선 — 가운데 70% 폭에서 세로 밝기 변화가 가장 큰 행(55~78% 높이 안), 아래가 탁자 색(밝은 황토)인 것."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    x0, x1 = int(w * 0.15), int(w * 0.85)
    band = a[:, x0:x1, :]
    # 탁자 앞판 색과의 거리: 아래 끝 10% 평균 색을 탁자 색으로 본다
    ref = a[int(h * 0.9):, x0:x1, :].reshape(-1, 3).mean(0)
    dist = np.sqrt(((band - ref) ** 2).sum(2))  # h × w
    near = (dist < 38).mean(1)  # 행마다 탁자 색 비율
    lo, hi = int(h * 0.55), int(h * 0.80)
    # 위에서 아래로 처음으로 탁자 색 비율이 0.8을 넘는 행 — 그 행부터 앞판이 계속된다
    for y in range(lo, hi):
        if near[y] > 0.8 and near[y:y + 20].mean() > 0.8:
            return y
    return int(h * 0.64)


def plate(src):
    im = Image.open(src).convert('RGB')
    y = table_top(im)
    k = BASE_K
    big = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    top = round(y * k - TABLE_Y)
    if top < 0:  # 탁자가 너무 위 — 위를 벽 색으로 채운다
        canvas = Image.new('RGB', (big.width, big.height - top), big.getpixel((10, 10)))
        canvas.paste(big, (0, -top))
        big, top = canvas, 0
    short = top + H - big.height
    if short > 0:  # 아래가 모자라면 앞판 아래 띠를 뒤집어 잇는다
        strip = big.crop((0, big.height - short, big.width, big.height)).transpose(Image.FLIP_TOP_BOTTOM)
        canvas = Image.new('RGB', (big.width, big.height + short))
        canvas.paste(big, (0, 0)); canvas.paste(strip, (0, big.height))
        big = canvas
    left = round((big.width - W) / 2)
    crop = big.crop((left, top, left + W, top + H))
    assert crop.size == (W, H), crop.size
    return crop, y, k


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--재기':
        for f in args[1:]:
            im = Image.open(os.path.join(here, f))
            print(f, '탁자 선', table_top(im), '/', im.height)
        sys.exit(0)
    os.makedirs(out, exist_ok=True)
    for arg in args:
        name, src = arg.split('=', 1)
        crop, y, k = plate(os.path.join(here, src))
        crop.save(os.path.join(out, f'{name}.jpg'), quality=93)
        print(name, '←', src, f'탁자 선 {y}px · 배율 {k:.2f}')
