# 홈페이지판 공유 미리보기 그림(1200×630 JPEG)을 만든다 — 모델 대표 사진을 명단 순서로 두 줄 칸에 얹는다(열두 명이면 6×2).
# 홀수면 윗줄이 한 칸 더 많고 줄마다 칸 폭을 늘여 가로를 채운다(10-24 열세 명 — 7 + 6, 빈 칸 없음).
# 사용: python make-og.py <출력.jpg> <대표 사진…>  (build-site.cjs가 부른다)
import sys

from PIL import Image

W, H, ROWS, GAP = 1200, 630, 2, 4
out, heroes = sys.argv[1], sys.argv[2:]
if not heroes:
    sys.exit('대표 사진이 없다')
n = len(heroes)
counts = [n // ROWS + (1 if r < n % ROWS else 0) for r in range(ROWS)]
ch = (H - GAP * (ROWS - 1)) // ROWS
sheet = Image.new('RGB', (W, H), 'white')
i = 0
for r, cols in enumerate(counts):
    cw = (W - GAP * (cols - 1)) // cols
    x0 = (W - (cw * cols + GAP * (cols - 1))) // 2
    for c in range(cols):
        im = Image.open(heroes[i]).convert('RGB')
        i += 1
        w, h = im.size
        # 대표 사진은 상반신 세로 컷이다 — 위 74%를 칸 비율로 가운데 잘라 얼굴이 칸의 위쪽 3분의 1쯤에 오게 한다
        bh = int(h * 0.74)
        bw = min(w, int(bh * cw / ch))
        left, top = (w - bw) // 2, int(h * 0.02)
        cell = im.crop((left, top, left + bw, top + bh)).resize((cw, ch), Image.LANCZOS)
        sheet.paste(cell, (x0 + c * (cw + GAP), r * (ch + GAP)))
sheet.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
print('공유 그림', out, ' + '.join(map(str, counts)), f'{n}명')
