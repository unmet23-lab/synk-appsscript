"""새로 구운 몽글 사진(굽기/B4_*.png)을 배너·커버 바탕으로, A_*.png를 프로필로 자른다.

    python -I 바탕짓기.py

마스코트를 오려 붙이지 않는다(10-14). 구운 사진 한 장을 통째로 키우고 잘라서, 몽글이
유튜브 PC 띠(2560×423, y508~931)와 휴대폰 안전 영역(x507~2053), 페이스북 휴대폰 영역(가운데 1061px) 안에 오게 한다.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
BAKE = os.path.join(HERE, '..', '굽기')
BANNER_SRC = os.path.join(BAKE, 'B4_035533.png')
PROFILE_SRC = os.path.join(BAKE, 'A_034435.png')


def coral_box(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r > 150) & (r - g > 55) & (r - b > 60)
    ys, xs = np.nonzero(m)
    # 떨어진 점 몇 개에 끌려가지 않게 0.5%~99.5% 분위로 자른다
    x0, x1 = np.percentile(xs, [0.5, 99.5])
    y0, y1 = np.percentile(ys, [0.5, 99.5])
    return float(x0), float(y0), float(x1), float(y1)


def place(src, size, mongle_h, center, name):
    W, H = size
    x0, y0, x1, y1 = coral_box(src)
    s = mongle_h / (y1 - y0)
    s = max(s, W / src.width, H / src.height)  # 바탕이 화면을 다 덮는 만큼은 키운다
    big = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    cx, cy = (x0 + x1) / 2 * s, (y0 + y1) / 2 * s
    left = min(max(round(cx - center[0]), 0), big.width - W)
    top = min(max(round(cy - center[1]), 0), big.height - H)
    out = big.crop((left, top, left + W, top + H)).filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
    out.save(os.path.join(HERE, name), optimize=True)
    mb = (x0 * s - left, y0 * s - top, x1 * s - left, y1 * s - top)
    print(f'{name}: {W}x{H} 확대 {s:.3f} 몽글 {tuple(round(v) for v in mb)} 높이 {round(mb[3] - mb[1])}')
    return mb


if __name__ == '__main__':
    src = Image.open(BANNER_SRC).convert('RGB')
    place(src, (2560, 1440), 300, (1800, 720), 'bg_yt.png')
    place(src, (1640, 596), 210, (1210, 300), 'bg_fb.png')
    # 프로필: 원으로 잘려 24~48px로도 보이니 몽글 폭이 지름의 72%가 되게 당겨 자른다(치마 끝이 원에 걸리지 않는 한도)
    prof = Image.open(PROFILE_SRC).convert('RGB')
    x0, y0, x1, y1 = coral_box(prof)
    side = round((x1 - x0) / 0.72)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    left = min(max(round(cx - side / 2), 0), prof.width - side)
    top = min(max(round(cy - side / 2), 0), prof.height - side)
    prof = prof.crop((left, top, left + side, top + side))
    for n in (1080, 800):
        prof.resize((n, n), Image.LANCZOS).save(os.path.join(HERE, '..', f'프로필_몽글_{n}.png'), optimize=True)
    print('프로필 1080·800 저장', (left, top, side))
