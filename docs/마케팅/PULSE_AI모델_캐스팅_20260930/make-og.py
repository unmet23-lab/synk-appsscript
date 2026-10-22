# 홈페이지판 공유 미리보기 그림(1200×630 JPEG)을 만든다 — 모델 대표 사진을 명단 순서로 두 줄 칸에 얹는다(열두 명이면 6×2).
# 사용: python make-og.py <출력.jpg> <대표 사진…>  (build-site.cjs가 부른다)
import math
import sys

from PIL import Image

W, H, ROWS, GAP = 1200, 630, 2, 4
out, heroes = sys.argv[1], sys.argv[2:]
if not heroes:
    sys.exit('대표 사진이 없다')
cols = math.ceil(len(heroes) / ROWS)
cw, ch = (W - GAP * (cols - 1)) // cols, (H - GAP * (ROWS - 1)) // ROWS
x0 = (W - (cw * cols + GAP * (cols - 1))) // 2
sheet = Image.new('RGB', (W, H), 'white')
for i, p in enumerate(heroes):
    im = Image.open(p).convert('RGB')
    w, h = im.size
    # 대표 사진은 상반신 세로 컷이다 — 위 74%를 칸 비율로 가운데 잘라 얼굴이 칸의 위쪽 3분의 1쯤에 오게 한다
    bh = int(h * 0.74)
    bw = min(w, int(bh * cw / ch))
    left, top = (w - bw) // 2, int(h * 0.02)
    cell = im.crop((left, top, left + bw, top + bh)).resize((cw, ch), Image.LANCZOS)
    r, c = divmod(i, cols)
    sheet.paste(cell, (x0 + c * (cw + GAP), r * (ch + GAP)))
sheet.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
print('공유 그림', out, f'{cols}×{ROWS}', f'{len(heroes)}명')
