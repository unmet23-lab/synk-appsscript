from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 20)
sources = [ROOT / 'docs/캐릭터/정본_4K/까몽_본체.png'] + sorted((ROOT / 'docs/Loom_자산/옷/GPT_누끼_틀_avif').glob('*.avif'))
sheet = Image.new('RGB', (5 * 360, 5 * 400), '#eee6d8')
d = ImageDraw.Draw(sheet)
stats = []
for i, p in enumerate(sources):
    im = Image.open(p).convert('RGBA')
    a = im.getchannel('A')
    box = a.getbbox()
    stats.append({'source': str(p), 'size': im.size, 'bbox': box, 'alpha_extrema': a.getextrema()})
    im.thumbnail((352, 352), Image.Resampling.LANCZOS)
    x, y = (i % 5) * 360, (i // 5) * 400
    sheet.paste(im, (x + (360-im.width)//2, y), im)
    d.text((x+8, y+354), p.stem.replace('까몽_', ''), font=FONT, fill='#1e222a')
sheet.save(OUT / 'costume-candidates-contact.png')
(OUT / 'asset-inventory.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT / 'costume-candidates-contact.png'))
