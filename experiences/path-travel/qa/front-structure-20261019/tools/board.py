import sys
from PIL import Image, ImageDraw, ImageFont
d = 'cmp/'
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 26)
small = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 20)
def label(draw, x, y, text, sub=None):
    draw.text((x, y), text, font=font, fill=(20, 28, 23))
    if sub: draw.text((x, y + 34), sub, font=small, fill=(100, 110, 104))
# PC 비교: 2행(첫 화면, 결과) × 2열(원래, 새 구조)
W, H = 840, 525
pad, head = 24, 86
board = Image.new('RGB', (pad * 3 + W * 2, head + (H + head) * 2 - head + pad + 40), (246, 247, 244))
dr = ImageDraw.Draw(board)
rows = [('start', '첫 화면'), ('result', '결과 화면 (예시 01로 만든 하루)')]
y = 20
for key, title in rows:
    for col, (ver, name) in enumerate([('orig', '원래 (지금 공개본과 같음)'), ('new', '새 구조 시안')]):
        x = pad + col * (W + pad)
        label(dr, x, y, f'{name} · {title}')
        im = Image.open(f'{d}{ver}-pc-{key}.png').resize((W, H), Image.LANCZOS)
        board.paste(im, (x, y + 44))
        dr.rectangle([x - 1, y + 43, x + W, y + 44 + H], outline=(210, 216, 208))
    y += H + 44 + 36
board.save(d + 'board-pc.jpg', quality=90)
# 휴대폰 비교: 원래 첫 화면 | 새 첫 화면 | 원래 결과 | 새 결과
w, h = 390, 844
m = Image.new('RGB', (pad * 5 + w * 4, h + 110), (246, 247, 244))
dr = ImageDraw.Draw(m)
for i, (ver, key, name) in enumerate([('orig', 'start', '원래 · 첫 화면'), ('new', 'start', '새 구조 · 첫 화면'), ('orig', 'result', '원래 · 결과'), ('new', 'result', '새 구조 · 결과')]):
    x = pad + i * (w + pad)
    label(dr, x, 20, name)
    im = Image.open(f'{d}{ver}-m-{key}.png').resize((w, h), Image.LANCZOS)
    m.paste(im, (x, 70))
    dr.rectangle([x - 1, 69, x + w, 70 + h], outline=(210, 216, 208))
m.save(d + 'board-m.jpg', quality=90)
print('ok')
