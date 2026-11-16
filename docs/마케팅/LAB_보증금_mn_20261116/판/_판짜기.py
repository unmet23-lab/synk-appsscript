# LAB 몽골 M59 「1000/50이 뭐예요?」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다(11-16 곁 세션 lab-mn-21).
# 장면마다 배율 · 자리가 다르다(M47 「눈치」 판짜기에서 갈라 옴 — 탁자 선 맞춤은 쓰지 않는다).
#   A 가게 앞: 1.06배(폭을 다 담음) · 맨 위 맞춤 · 아래 모자란 곳은 기준 판 gA의 빈 보도 띠를 뒤집어 잇는다(a1은 계산기가 아래 끝에 닿아 제 띠를 뒤집으면 계산기가 둘이 된다).
#   B 사무실: 1.0배 · 왼쪽 80px(원본)을 자르고 오른쪽 모자란 곳은 오른쪽 끝 20px 띠를 번갈아 뒤집어 잇는다 · 80px 내림(위는 벽 띠를 뒤집어 잇고
#            아래는 책상 앞판 띠를 뒤집어 잇는다). 까닭: 구운 판에서 몽글이 오른쪽 끝(93~97%)까지 닿아 1.06배면 화면 x 1000~1047 —
#            틱톡 · 쇼츠 오른쪽 단추 자리(x 950~1060)에 몸이 걸린다(조율 세션 11-16 「몽글이 오른쪽 끝에 앉아 앱 단추와 겹치는지」).
#            이렇게 짜면 몽글 오른쪽 끝이 x 913 아래이고, 책상 윗면이 1101px라 그 아래 카드 두 줄(1156~1420px)이 녹아내린 몽글(~1124px)을 덮지 않는다.
#   C 고시원 복도(장면 심사 v1 뒤 새 판 c1m · c2n · c2f · c3n — 문이 커진 카메라): 1.06배 · 20px 내림(위는 천장 띠를 뒤집어 잇는다 — 중개사 머리 위 269~482px에 말풍선이 들게) · 아래는 바닥 맨 아래 220줄을 번갈아 뒤집어 잇는다(그 위 중개사 신발이 거울로 비치지 않게).
#   python -I -X utf8 판/_판짜기.py <칸 이름=장면:구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
import sys, os
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
W, H = 1080, 1920
SCENES = {
    'A': {'k': 1.06, 'left': None, 'down': 0, 'floor': 'gA_213011.png'},
    'B': {'k': 1.0, 'left': 80, 'down': 80},
    'C': {'k': 1.06, 'left': None, 'down': 20, 'bstrip': 220},
    # C3 끝 칸(c3 — 녹아 퍼진 몽글): C와 같고 30px 왼쪽으로 옮긴다. 녹아 퍼진 몸 끝이 화면 x 972까지 닿아 오른쪽 단추 자리(x 950~)에 22px 걸렸다 —
    # 옮긴 뒤 끝은 x 942 언저리. 오른쪽 모자란 27px는 B처럼 오른쪽 끝 20px 띠를 번갈아 뒤집어 잇는다(조율 세션 11-16 「몽글이 오른쪽 끝에 앉아 앱 단추와 겹치는지」).
    'C3': {'k': 1.06, 'left': 30, 'down': 20, 'bstrip': 220},
}


def mirror_extend(im, top=0, bottom=0, right=0, strip=20, floor=None, bstrip=None):
    w, h = im.size
    canvas = Image.new('RGB', (w + right, h + top + bottom))
    canvas.paste(im, (0, top))
    if top:
        canvas.paste(im.crop((0, 0, w, top)).transpose(Image.FLIP_TOP_BOTTOM), (0, 0))
    if bottom:
        src = floor if floor is not None else im  # 칸의 아래 끝에 소품(계산기)이 닿으면 기준 판의 빈 보도 띠를 뒤집어 잇는다
        n = min(bstrip or bottom, bottom)  # bstrip — 아래 끝 몇 줄만 번갈아 뒤집어 잇는다(그 위의 발 · 소품이 거울로 비치지 않게)
        band = src.crop((0, h - n, w, h))
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
    ext = mirror_extend(big, top=top, bottom=bottom, right=right, floor=floor, bstrip=p.get('bstrip'))
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
