# E58 판 짜기(E57에서 가져옴) — 2:3 구운 판(1024×1536)을 1.25배(1280×1920)로 키워 가로 80~1160을 잘라 1080×1920 jpg로 쓴다(E42 「세트 주세요」와 같은 셈).
# 쓰는 법: python -I -X utf8 _판짜기.py <판 폴더> <img 폴더> s1=s1_080221 s6=s6_080520@0 …(@x0 = 자를 왼쪽 끝, 기본 80 — 카메라가 당겨진 판만 옮긴다)
import sys
from pathlib import Path
from PIL import Image

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
for pair in sys.argv[3:]:
    name, stem = pair.split('=')
    x0 = 80
    if '@' in stem:
        stem, x0 = stem.split('@')
        x0 = int(x0)
    im = Image.open(src / f'{stem}.png').convert('RGB')
    assert im.size == (1024, 1536), (stem, im.size)
    im = im.resize((1280, 1920), Image.LANCZOS).crop((x0, 0, x0 + 1080, 1920))
    im.save(dst / f'{name}.jpg', quality=92)
    print(name, '←', stem)
