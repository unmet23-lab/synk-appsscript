# LAB 몽골 M53 「먹어요」 — 구운 판(2:3, 1024×1536)을 1080×1920 화면 판으로 짠다.
# 1.484배(1520×2279)로 키우고 왼쪽 210 · 위 283px부터 1080×1920을 자른다 — 장면 심사 v2 「아래 절반이 빈 나무판이라 인물이 작다」로 처음 판(1.325배)보다 12% 당겼다.
# 계산대 윗면(화면 약 1290px)은 그대로 두고 인물을 키웠다. 펜던트 등과 냄비 · 웍 바깥쪽이 조금 잘린다.
# 고정 카메라라 모든 칸이 같은 자름이다.
#   python -I -X utf8 판/_판짜기.py <칸 이름=구운 파일 …>   → remotion/public/img/<칸 이름>.jpg
import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
os.makedirs(out, exist_ok=True)
for arg in sys.argv[1:]:
    name, src = arg.split('=', 1)
    im = Image.open(os.path.join(here, src)).convert('RGB')
    k = 2279 / im.height
    im = im.resize((round(im.width * k), 2279), Image.LANCZOS)
    im = im.crop((210, 283, 1290, 2203))
    assert im.size == (1080, 1920), im.size
    im.save(os.path.join(out, f'{name}.jpg'), quality=93)
    print(name, '←', src)
