# E40 판 짜기 — 2:3 구운 판(1024×1536)을 1.25배(1280×1920)로 키워 가로 80~1160을 잘라 1080×1920 jpg로 쓴다(E44와 같은 셈).
# 쓰는 법: python -I -X utf8 _판짜기.py <판 폴더> <img 폴더> b1=b1_152412 b2=…
import sys
from pathlib import Path
from PIL import Image

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
for pair in sys.argv[3:]:
    name, stem = pair.split('=')
    im = Image.open(src / f'{stem}.png').convert('RGB')
    assert im.size == (1024, 1536), (stem, im.size)
    im = im.resize((1280, 1920), Image.LANCZOS).crop((80, 0, 1160, 1920))
    im.save(dst / f'{name}.jpg', quality=92)
    print(name, '←', stem)
