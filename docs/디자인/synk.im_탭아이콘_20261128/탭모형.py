"""브라우저 탭 모형: 아이콘 시안 × 밝은 · 어두운 탭. 2배 화면(아이콘 32px) 기준으로 그리고 오른쪽에 실제 16px를 둔다."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
D = Path(__file__).parent / '시안'
F = ImageFont.truetype(r'C:/Windows/Fonts/malgun.ttf', 24)
FB = ImageFont.truetype(r'C:/Windows/Fonts/malgunbd.ttf', 26)
FS = ImageFont.truetype(r'C:/Windows/Fonts/malgun.ttf', 20)

ROWS = [
    ('지금', 'now', 'SYNK — 한국 유학, AI 강의, 광고'),
    ('솔리오 (추천)', 'solio_rim', 'SYNK — AI 직원과 일하는 회사'),
    ('몽글', 'mongle', 'SYNK — AI 직원과 일하는 회사'),
]
THEMES = [  # 탭 줄 바탕, 고른 탭, 글자
    ('밝은 탭', (222, 225, 230), (255, 255, 255), (32, 33, 36)),
    ('어두운 탭', (32, 24, 20), (59, 44, 37), (236, 230, 224)),
]
TW, TH = 480, 72
W = 200 + len(THEMES) * (TW + 40) + 140
H = 70 + len(ROWS) * (TH + 34)
img = Image.new('RGB', (W, H), (250, 248, 244))
d = ImageDraw.Draw(img)
for j, (tn, *_ ) in enumerate(THEMES):
    d.text((200 + j * (TW + 40), 22), tn, font=FB, fill=(40, 40, 40))
d.text((200 + len(THEMES) * (TW + 40), 22), '실제 16px', font=FB, fill=(40, 40, 40))
for i, (name, key, title) in enumerate(ROWS):
    y = 70 + i * (TH + 34)
    d.text((20, y + 20), name, font=F, fill=(40, 40, 40))
    ic32 = Image.open(D / ('지금_48.png' if key == 'now' else f'{key}_32.png')).convert('RGBA')
    if key == 'now':
        ic32 = ic32.resize((32, 32), Image.LANCZOS)
    ic16 = Image.open(D / ('지금_48.png' if key == 'now' else f'{key}_16.png')).convert('RGBA')
    if key == 'now':
        ic16 = ic16.resize((16, 16), Image.LANCZOS)
    for j, (tn, strip, tab, ink) in enumerate(THEMES):
        x = 200 + j * (TW + 40)
        d.rectangle((x - 12, y - 8, x + TW + 12, y + TH + 8), fill=strip)
        d.rounded_rectangle((x, y, x + TW, y + TH + 8), radius=16, fill=tab)
        tile = Image.new('RGBA', ic32.size, tab + (255,))
        tile.alpha_composite(ic32)
        img.paste(tile.convert('RGB'), (x + 22, y + 20))
        txt = title
        while d.textlength(txt, font=F) > TW - 120:
            txt = txt[:-1]
        if txt != title:
            txt = txt.rstrip() + '…'
        d.text((x + 70, y + 18), txt, font=F, fill=ink)
        d.text((x + TW - 36, y + 16), '×', font=F, fill=ink)
    x = 200 + len(THEMES) * (TW + 40)
    for j, (tn, strip, tab, ink) in enumerate(THEMES):
        bx = x + j * 50
        d.rectangle((bx, y + 18, bx + 36, y + 54), fill=tab)
        t = Image.new('RGBA', (16, 16), tab + (255,))
        t.alpha_composite(ic16)
        img.paste(t.convert('RGB'), (bx + 10, y + 28))
img.save(D.parent / '탭모형.png')
print(img.size)
