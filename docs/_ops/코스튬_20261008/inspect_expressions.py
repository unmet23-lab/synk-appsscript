from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
import json

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 21)
NAMES = ['목도리', '앞치마', '여름델', '겨울델', '펠트헤드폰']
sheet = Image.new('RGB', (4 * 400, 5 * 440), '#eee6d8')
draw = ImageDraw.Draw(sheet)
stats = []
for row, name in enumerate(NAMES):
    basic = None
    for col, expr in enumerate(['단품원본','본체','눈감음','눈웃음']):
        if col == 0:
            p = ROOT / f'docs/Loom_자산/옷/GPT_누끼_틀_avif/까몽_{name}.avif'
        else:
            p = ROOT / f'docs/Loom_자산/옷/GPT_표정_누끼_틀_avif/까몽_{name}_{expr}.avif'
        im = Image.open(p).convert('RGBA')
        original = im.copy()
        if col == 1:
            basic = im.copy()
        if col > 1:
            diff = ImageChops.difference(basic, original)
            stats.append({'name': name, 'expression': expr, 'alpha_difference_bbox': diff.getchannel('A').getbbox(), 'rgb_difference_bbox':diff.convert('RGB').getbbox()})
        im.thumbnail((396,396), Image.Resampling.LANCZOS)
        x,y = col*400,row*440
        sheet.paste(im,(x+(400-im.width)//2,y),im)
        draw.text((x+8,y+404), f'{name} / {expr}', font=FONT, fill='#202730')
sheet.save(OUT/'expressions-contact.png')
(OUT/'expression-check.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
print('Expression sheet ready')
