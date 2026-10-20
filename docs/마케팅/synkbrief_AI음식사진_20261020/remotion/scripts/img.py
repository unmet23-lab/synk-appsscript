# -*- coding: utf-8 -*-
"""그림/의 원본·구운 판을 영상용 public/img/로 옮긴다(파생 사본이라 git 밖 — .gitignore의 out·public/img).

    python -I scripts/img.py

- 모두 1536×1024(3:2) JPEG q90. 원본 스톡(2400×1600)은 구운 판과 같은 크기로 줄인다.
- 국물 색 칩: 각 판의 냄비 가운데(560,420)–(980,760) 평균색을 colors.json으로 — 07·08 장면의 색 칩이 읽는다.
"""
import colorsys, json, os, sys
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '그림')
OUT = os.path.join(HERE, '..', 'public', 'img')
os.makedirs(OUT, exist_ok=True)

FILES = {
    'before': '원본_라볶이_pexels32196399.jpg',
    'after1': '판1_다듬기.png',
    'after2': '판4_색지정.png',
    'ai': '판2_AI생성.png',
}
BOX = (560, 420, 980, 760)
colors = {}
for key, name in FILES.items():
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    if im.size != (1536, 1024):
        im = im.resize((1536, 1024), Image.LANCZOS)
    im.save(os.path.join(OUT, key + '.jpg'), quality=90)
    r, g, b = np.asarray(im.crop(BOX)).reshape(-1, 3).mean(0)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    colors[key] = {'hex': '#%02x%02x%02x' % (round(r), round(g), round(b)), 'hue': round(h * 360, 1), 'sat': round(s, 2), 'val': round(v, 2)}
    print(key, name, colors[key])
with open(os.path.join(OUT, 'colors.json'), 'w', encoding='utf-8') as f:
    json.dump(colors, f, ensure_ascii=False, indent=1)
