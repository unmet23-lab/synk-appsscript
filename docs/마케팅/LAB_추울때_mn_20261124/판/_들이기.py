# 구운 판(판/<이름>_<시각>.png) 가운데 이름마다 가장 새것을 1080×1920 JPEG로 remotion/public/img/<이름>.jpg에 들인다.
# 쓰는 법: python -I -X utf8 판/_들이기.py <편 폴더> [이름…]
import sys, re
from pathlib import Path
from PIL import Image
ed = Path(sys.argv[1]); names = set(sys.argv[2:])
out = ed / 'remotion' / 'public' / 'img'; out.mkdir(parents=True, exist_ok=True)
best = {}
for p in (ed / '판').glob('*.png'):
    m = re.match(r'(.+)_(\d{6})$', p.stem)
    if not m or (names and m.group(1) not in names): continue
    if m.group(1) not in best or p.stem > best[m.group(1)].stem: best[m.group(1)] = p
for n, p in sorted(best.items()):
    Image.open(p).convert('RGB').resize((1080, 1920), Image.LANCZOS).save(out / f'{n}.jpg', quality=92)
    print(n, '←', p.name)
