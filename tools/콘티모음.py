# 콘티 정지컷을 곡 순서대로 한 장에 모은다. 칸마다 번호·구간(노란 글자)과 설명(흰 글자)을 붙인다.
# 쓰는 법: docs/마케팅/제작양식/실제얼굴_화보_뮤직비디오.md
#
#   python tools/콘티모음.py <순서.json> <출력.jpg> [--제목 "..."] [--열 3]
#
# 순서.json: [["정지컷 파일 경로", "01 0:00 인트로", "밤 이발소 · 검은 실크 셔츠"], ...]
import argparse, json, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('order'); ap.add_argument('out')
ap.add_argument('--제목', dest='title', default='콘티')
ap.add_argument('--열', dest='cols', type=int, default=3)
a = ap.parse_args()

items = [row for row in json.load(open(a.order, encoding='utf-8')) if os.path.exists(row[0])]
W, H, PAD, CAP, COLS = 640, 360, 16, 58, a.cols
rows = (len(items) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * (W + PAD) + PAD, rows * (H + CAP + PAD) + PAD + 50), (18, 18, 18))
d = ImageDraw.Draw(sheet)
FB, FR = 'C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf'
ft, fs, fh = ImageFont.truetype(FB, 20), ImageFont.truetype(FR, 17), ImageFont.truetype(FB, 26)
d.text((PAD, 12), a.title, font=fh, fill=(240, 240, 240))
for i, (f, label, desc) in enumerate(items):
    r, c = divmod(i, COLS)
    x, y = PAD + c * (W + PAD), 50 + PAD + r * (H + CAP + PAD)
    im = Image.open(f).convert('RGB')
    im = im.resize((W, H), Image.LANCZOS) if abs(im.width / im.height - W / H) < 0.02 else im.resize((W, int(im.height * W / im.width)), Image.LANCZOS).crop((0, 0, W, H))
    sheet.paste(im, (x, y))
    d.text((x, y + H + 6), label, font=ft, fill=(255, 214, 90))
    d.text((x, y + H + 32), desc, font=fs, fill=(215, 215, 215))
sheet.save(a.out, quality=90)
print('saved', a.out, len(items))
