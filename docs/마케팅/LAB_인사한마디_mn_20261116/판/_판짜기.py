# LAB 몽골 M51 「인사 한마디의 힘」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다.
# 1.25배(1280×1920)로 키우고 왼쪽 70px부터 1080px을 자른다(왼쪽 몽글 밑단 · 기운 귤 탑 꼭대기를 살리고, 오른쪽 바구니 끝이 조금 잘린다).
# 고정 카메라라 모든 칸이 같은 자름이다. v5부터 짠 판을 좌우로 뒤집는다(글자 없는 펠트 장면이라 뒤집어도 된다).
#   python -I -X utf8 판/_판짜기.py <칸 이름=구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
import sys, os
from PIL import Image, ImageOps
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
os.makedirs(out, exist_ok=True)
for arg in sys.argv[1:]:
    name, src = arg.split('=', 1)
    im = Image.open(os.path.join(here, src)).convert('RGB')
    k = 1920 / im.height
    im = im.resize((round(im.width * k), 1920), Image.LANCZOS)
    im = im.crop((70, 0, 1150, 1920))
    im = ImageOps.mirror(im)  # v5: 좌우를 뒤집어 몽글을 오른쪽 · 할머니를 왼쪽에(이해 시험 v4 haiku · GPT 「지난 편과 같은 무대 — 왼쪽 주인공 · 오른쪽 가게 사람」)
    assert im.size == (1080, 1920), im.size
    im.save(os.path.join(out, f'{name}.jpg'), quality=93)
    print(name, '←', src)
