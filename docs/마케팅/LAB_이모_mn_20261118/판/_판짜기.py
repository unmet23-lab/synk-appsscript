# LAB 몽골 M61 「이모~!」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다.
# 폭을 다 담는다(배율 1080/1024 = 1.0547 → 1080×1620). 모자라는 위 300px는 판 맨 위 벽 띠를 뒤집어 잇는다(민무늬 펠트 벽 — 카드 자리).
#   python -I -X utf8 판/_판짜기.py <칸 이름=구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
import sys, os
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
W, H = 1080, 1920
TOP = 300

def plate(src):
    im = Image.open(src).convert('RGB').resize((W, round(1536 * W / 1024)), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H))
    canvas.paste(im, (0, TOP))
    strip = im.crop((0, 0, W, TOP)).transpose(Image.FLIP_TOP_BOTTOM)
    canvas.paste(strip, (0, 0))
    return canvas

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    for a in sys.argv[1:]:
        name, src = a.split('=', 1)
        p = src if os.path.isabs(src) else os.path.join(here, src)
        plate(p).save(os.path.join(out, name + '.jpg'), quality=93)
        print('판', name, '←', os.path.basename(src))
