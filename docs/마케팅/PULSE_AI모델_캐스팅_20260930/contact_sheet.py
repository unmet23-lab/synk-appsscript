# 사용: python contact_sheet.py 출력.jpg 제목 "라벨|경로" "라벨|경로" ...
# 여러 시안을 같은 높이로 줄여 한 장에 나란히 놓고 라벨을 붙인다(검토용).
import sys
from PIL import Image, ImageDraw, ImageFont
FONT = 'docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf'
out, title, items = sys.argv[1], sys.argv[2], sys.argv[3:]
import os
cols = min(int(os.environ.get("COLS", 4)), len(items)); rows = (len(items) + cols - 1) // cols
cell_w, cell_h, pad, lab, top = 560, 747, 24, 64, 90
W = cols * cell_w + (cols + 1) * pad
H = top + rows * (cell_h + lab) + (rows + 1) * pad
sheet = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(sheet)
d.text((pad, 28), title, fill='#10131A', font=ImageFont.truetype(FONT, 36))
f = ImageFont.truetype(FONT, 26)
for i, it in enumerate(items):
    label, path = it.split('|', 1)
    im = Image.open(path).convert('RGB')
    im.thumbnail((cell_w, cell_h), Image.LANCZOS)
    r, c = divmod(i, cols)
    x = pad + c * (cell_w + pad); y = top + pad + r * (cell_h + lab + pad)
    sheet.paste(im, (x + (cell_w - im.width) // 2, y + (cell_h - im.height) // 2))
    d.text((x, y + cell_h + 14), label, fill='#99295D', font=f)
sheet.save(out, quality=88)
print(out, sheet.size)
