# LAB 몽골 M43 「붙다」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다.
# 1.25배(1280×1920)로 키워 가로 80~1160을 자르고, 그림을 위로 SHIFT px 올린다 — 아래 자막 판(1140~1420px)이 몽글 밑단(구운 판 64~66% 높이)을 덮지 않게.
# 위로 올려 아래가 빈 띠는 그림 맨 아래 띠(민무늬 바닥 · 포장도로)를 뒤집어 이어 붙인다(단디 편과 같은 방법).
#   python -I -X utf8 판/_판짜기.py p1=p1_164451 p2=… → remotion/public/img/<이름>.jpg
# 판마다 올리는 양을 바꾸려면 이름=판:<px>(시험장 문 판 p6a~p6c는 40 — 문 위 「TOPIK 시험장」 표지가 위 질문 판(285~500px)에 가리지 않게. 첫 판 p1은 300 — 엿 붙은 교문 앞 몽글 얼굴이 자막 판 위로 오게. 엿 상자 판 p4도 300 — 뜻 줄이 세 줄이 되어도 상자가 자막 판 위로 오게).
import os
import sys
from PIL import Image, ImageOps

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
os.makedirs(out, exist_ok=True)
SHIFT = 160

for pair in sys.argv[1:]:
    name, stem = pair.split('=')
    shift = SHIFT
    if ':' in stem:
        stem, s = stem.split(':')
        shift = int(s)
    im = Image.open(os.path.join(here, f'{stem}.png')).convert('RGB')
    assert im.size == (1024, 1536), (stem, im.size)
    im = im.resize((1280, 1920), Image.LANCZOS).crop((80, 0, 1160, 1920))
    canvas = Image.new('RGB', (1080, 1920))
    if shift:
        canvas.paste(im.crop((0, shift, 1080, 1920)), (0, 0))
        band = ImageOps.flip(im.crop((0, 1920 - shift, 1080, 1920)))
        canvas.paste(band, (0, 1920 - shift))
    else:
        canvas.paste(im, (0, 0))
    canvas.save(os.path.join(out, f'{name}.jpg'), quality=92)
    print(name, '←', stem, shift)
