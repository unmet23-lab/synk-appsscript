# LAB 몽골 M69 「써요」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다.
# 1.25배(1280×1920)로 키우고 왼쪽 50px부터 1080을 자른다 — 왼쪽 끝의 몽글을 살리고 오른쪽 커피 기계 · 점원 등이 조금 잘린다.
# 위 28%는 빈 펠트 벽(머리 카드 자리), 아래 25%는 계산대 앞면이다. 고정 카메라라 모든 칸이 같은 자름이다.
#   python -I -X utf8 판/_판짜기.py <칸 이름=구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
os.makedirs(out, exist_ok=True)
for arg in sys.argv[1:]:
    name, src = arg.split('=', 1)
    im = Image.open(os.path.join(here, src)).convert('RGB')
    k = 1920 / im.height
    im = im.resize((round(im.width * k), 1920), Image.LANCZOS)
    im = im.crop((50, 0, 1130, 1920))
    assert im.size == (1080, 1920), im.size
    im.save(os.path.join(out, f'{name}.jpg'), quality=93)
    print(name, '←', src)
