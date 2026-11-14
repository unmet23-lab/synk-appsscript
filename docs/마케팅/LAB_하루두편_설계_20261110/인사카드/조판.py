"""인사 카드 조판 원고 — 흰 바탕 1400x1000에 세 줄(인사말 · 한글 나라 이름 · 읽는 법)을 SUIT로 찍는다(2026-11-14).

    python -X utf8 조판.py <낼 파일.jpg> "<첫 줄>" "<둘째 줄>" "<셋째 줄>" [--둘째크기 330]

굽기의 첫 참고 그림이다(README 「새 나라를 더할 때」 1). 색은 「미안」 편 조판에서 잰 값이다: 첫 줄과 셋째 줄 (41,27,18), 둘째 줄 (248,105,88).
둘째 줄이 넉 자 이상이면 --둘째크기를 250쯤으로 줄여 한 줄에 둔다(줄이 꺾이면 구운 글자도 꺾인다).
SUIT에는 「¡」가 없어서 첫 줄이 「¡」로 시작하면 같은 글꼴의 「!」를 뒤집어 그린다.
"""
import sys

from PIL import Image, ImageDraw, ImageFont

import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '브랜드_폰트', 'SUIT') + os.sep
opt, args, i = {}, [], 1
while i < len(sys.argv):
    if sys.argv[i].startswith('--'):
        opt[sys.argv[i]] = sys.argv[i + 1]
        i += 2
    else:
        args.append(sys.argv[i])
        i += 1
out, l1, l2, l3 = args
s2 = int(opt.get('--둘째크기', 330))
W, H = 1400, 1000
DARK, CORAL = (41, 27, 18), (248, 105, 88)
f1 = ImageFont.truetype(ROOT + 'SUIT-ExtraBold.otf', 190)
f2 = ImageFont.truetype(ROOT + 'SUIT-Heavy.otf', s2)
f3 = ImageFont.truetype(ROOT + 'SUIT-ExtraBold.otf', 120)
im = Image.new('RGB', (W, H), (255, 255, 255))
d = ImageDraw.Draw(im)
lines = [(l1, f1, DARK), (l2, f2, CORAL), (l3, f3, DARK)]
boxes = [d.textbbox((0, 0), t, font=f) for t, f, _ in lines]
heights = [b[3] - b[1] for b in boxes]
gap = 40
total = sum(heights) + gap * 2
y = (H - total) // 2
def 뒤집은느낌표(f, c):
    # SUIT에는 ¡가 없다 — 같은 글꼴의 !를 뒤집어 쓴다(「미안」 · 정본 조판과 같은 방법)
    bb = d.textbbox((0, 0), '!', font=f)
    g = Image.new('RGBA', (bb[2] - bb[0] + 4, bb[3] - bb[1] + 4), (0, 0, 0, 0))
    ImageDraw.Draw(g).text((2 - bb[0], 2 - bb[1]), '!', font=f, fill=c)
    return g.rotate(180)
for (t, f, c), b, h in zip(lines, boxes, heights):
    if t.startswith('¡'):
        g = 뒤집은느낌표(f, c)
        rest = t[1:]
        rb = d.textbbox((0, 0), rest, font=f)
        w = g.width + 10 + (rb[2] - rb[0])
        x = (W - w) // 2
        cap = d.textbbox((0, 0), 'O', font=f)
        im.paste(g, (x, y - b[1] + cap[1] - 2 + round((cap[3] - cap[1]) * 0.18)), g)
        d.text((x + g.width + 10 - rb[0], y - b[1]), rest, font=f, fill=c)
    else:
        w = b[2] - b[0]
        if w > W - 80:
            raise SystemExit(f'줄이 너무 넓다: {t} {w}px')
        d.text(((W - w) // 2 - b[0], y - b[1]), t, font=f, fill=c)
    y += h + gap
im.save(out, quality=95)
print(out, [b[2] - b[0] for b in boxes])
