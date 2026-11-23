# LAB 몽골 M48 「더워 · 뜨거워」 — 구운 판(2:3, 1024×1536)과 층(같은 크기 투명 PNG)을 1.25배(1280×1920)로 키워 remotion/public/img에 둔다.
# 자르지 않는다 — 화면(1080 폭)에 어느 자리를 보일지는 Remotion이 칸마다 정한다(넓은 칸 왼쪽 40px · 가까운 칸 100px).
# 층은 tools/층나누기.py가 낸 <이름>_bg.jpg · <이름>_m.png, 자리 값은 <이름>_층.json(원본 화소) — data 쪽에 1.25배로 옮겨 적는다.
#   python -I -X utf8 판/_판짜기.py <칸 이름=판 폴더 기준 파일 …>   → remotion/public/img/<칸 이름>.(jpg|png)
import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'remotion', 'public', 'img')
os.makedirs(out, exist_ok=True)
for arg in sys.argv[1:]:
    name, src = arg.split('=', 1)
    im = Image.open(os.path.join(here, src))
    alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if alpha else 'RGB')
    k = 1920 / im.height
    im = im.resize((round(im.width * k), 1920), Image.LANCZOS)
    assert im.size == (1280, 1920), im.size
    if alpha:
        im.save(os.path.join(out, f'{name}.png'))
    else:
        im.save(os.path.join(out, f'{name}.jpg'), quality=93)
    print(name, '←', src)
