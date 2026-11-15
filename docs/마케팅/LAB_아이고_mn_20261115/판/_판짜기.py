# LAB 몽골 M52 「아이고」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다.
# v2(장면 심사 v1 「아래 절반이 빈 깔개 — 잘라서 인물을 키워라」): 1.45배(1485×2227)로 키우고 왼쪽 60 · 위 200px부터 1080×1920을 자른다
# (TV 틀 왼끝을 살리고, 오른쪽 소파 반쪽 · 화분과 아래 깔개가 잘린다). 고정 카메라라 모든 칸이 같은 자름이다.
#   python -I -X utf8 판/_판짜기.py <칸 이름=구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
os.makedirs(out, exist_ok=True)
for arg in sys.argv[1:]:
    name, src = arg.split('=', 1)
    im = Image.open(os.path.join(here, src)).convert('RGB')
    k = 2227 / im.height
    im = im.resize((round(im.width * k), 2227), Image.LANCZOS)
    im = im.crop((60, 200, 1140, 2120))
    assert im.size == (1080, 1920), im.size
    im.save(os.path.join(out, f'{name}.jpg'), quality=93)
    print(name, '←', src)
