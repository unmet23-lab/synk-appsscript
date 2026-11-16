# LAB 몽골 M44 「눈 + 물 = 눈물?」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다(11-16 곁 세션 lab-mn-21, M59 「1000/50」 판짜기에서 옮김).
#   D 게르 마을: 1.25배(높이를 다 채움 — 장면 심사 v2 · v3 「인물이 작고 아래 35~40%가 늘인 땅 얼룩」) · 가운데 자르기 · 150px 올림(하늘 위 끝을 자름) · 아래 모자란 150줄만 맨 아래 160줄을 뒤집어 늘여 잇는다. 카드는 위 하늘(290px~)에 둔다.
#   몽글은 모든 칸에서 화면 x 52~595라 오른쪽 단추 자리(x 950~1060)에 들지 않는다(눈사람 나뭇가지 팔 끝 · 웅덩이 목도리 끝만 x 1000 언저리).
#   python -I -X utf8 판/_판짜기.py <칸 이름=장면:구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
import sys, os
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
W, H = 1080, 1920
SCENES = {
    'D': {'k': 1.25, 'left': None, 'down': -150, 'bstrip': 160, 'stretch': True},
}


def mirror_extend(im, top=0, bottom=0, right=0, strip=20, floor=None, bstrip=None, stretch=False):
    w, h = im.size
    canvas = Image.new('RGB', (w + right, h + top + bottom))
    canvas.paste(im, (0, top))
    if top:
        canvas.paste(im.crop((0, 0, w, top)).transpose(Image.FLIP_TOP_BOTTOM), (0, 0))
    if bottom:
        src = floor if floor is not None else im  # 칸의 아래 끝에 소품(계산기)이 닿으면 기준 판의 빈 보도 띠를 뒤집어 잇는다
        n = min(bstrip or bottom, bottom)  # bstrip — 아래 끝 몇 줄만 번갈아 뒤집어 잇는다(그 위의 발 · 소품이 거울로 비치지 않게)
        band = src.crop((0, h - n, w, h))
        if stretch:  # 늘이기 — 아래 끝 n줄을 세로로 늘여 채운다(가까운 땅일수록 결이 커지는 원근과 같고, 번갈아 뒤집은 이음 줄무늬가 없다)
            canvas.paste(band.transpose(Image.FLIP_TOP_BOTTOM).resize((w, bottom), Image.BICUBIC), (0, top + h))  # 뒤집어 늘인다 — 잇는 첫 줄이 그림의 마지막 줄과 같아 이음선이 없다
            return canvas
        y, flip = top + h, True
        while y < top + h + bottom:
            canvas.paste(band.transpose(Image.FLIP_TOP_BOTTOM) if flip else band, (0, y))
            y += n
            flip = not flip
    if right:
        band = canvas.crop((w - strip, 0, w, canvas.height))
        x, flip = w, True
        while x < w + right:
            canvas.paste(band.transpose(Image.FLIP_LEFT_RIGHT) if flip else band, (x, 0))
            x += strip
            flip = not flip
    return canvas


def plate(scene, src):
    p = SCENES[scene]
    im = Image.open(src).convert('RGB')
    k = p['k']
    big = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    left = round((big.width - W) / 2) if p['left'] is None else round(p['left'] * k)
    right = max(0, left + W - big.width)
    floor = None
    if p.get('floor'):
        f = Image.open(os.path.join(here, p['floor'])).convert('RGB')
        floor = f.resize(big.size, Image.LANCZOS)
    top = p['down']
    if top < 0:  # 올림 — 위 끝을 잘라 낸다
        big = big.crop((0, -top, big.width, big.height))
        if floor is not None:
            floor = floor.crop((0, -top, floor.width, floor.height))
        top = 0
    bottom = max(0, H - top - big.height)
    ext = mirror_extend(big, top=top, bottom=bottom, right=right, floor=floor, bstrip=p.get('bstrip'), stretch=p.get('stretch', False))
    crop = ext.crop((left, 0, left + W, H))
    assert crop.size == (W, H), crop.size
    return crop


if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    for arg in sys.argv[1:]:
        name, rest = arg.split('=', 1)
        scene, src = rest.split(':', 1)
        plate(scene, os.path.join(here, src)).save(os.path.join(out, f'{name}.jpg'), quality=93)
        print(name, '←', scene, src)
