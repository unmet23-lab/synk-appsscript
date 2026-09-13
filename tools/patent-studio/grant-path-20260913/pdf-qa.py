from pathlib import Path
from PIL import Image, ImageDraw
from pypdf import PdfReader
import json

folder = Path(r'C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/등록성_보강_20260913')
reader = PdfReader(folder / 'SYNK_결합반론_대응구성.pdf')
texts = [p.extract_text() for p in reader.pages]
assert len(texts) == 8 and all(len(text) > 300 for text in texts)
assert '결합반론' in ''.join(texts[0].split()) and '9쌍' in ''.join(''.join(texts).split())
font_names = set()
for page in reader.pages:
    for font_ref in page['/Resources']['/Font'].values():
        font = font_ref.get_object()
        descriptor = font.get('/FontDescriptor')
        font_names.add(str(font.get('/BaseFont') or (descriptor.get_object().get('/FontName') if descriptor else 'unnamed')))
        if font.get('/Subtype') == '/Type3':
            assert font.get('/CharProcs') and font.get('/ToUnicode')
            assert all(len(stream.get_object().get_data()) > 0 for stream in font['/CharProcs'].values())
            continue
        fonts = font.get('/DescendantFonts', [font])
        for descendant in fonts:
            descriptor = descendant.get_object().get('/FontDescriptor')
            assert descriptor and any(k in descriptor.get_object() for k in ['/FontFile', '/FontFile2', '/FontFile3'])
images = sorted((folder / '검수').glob('page-*.png'))
assert len(images) == len(texts)
sheet = Image.new('RGB', (1440, 1050), '#FBF7F0')
draw = ImageDraw.Draw(sheet)
for i, file in enumerate(images):
    page = Image.open(file).convert('RGB')
    page.thumbnail((340, 490))
    x, y = (i % 4) * 360 + 10, (i // 4) * 525 + 26
    sheet.paste(page, (x, y))
    draw.text((x, y - 18), f'PAGE {i + 1}', fill='#2B2320')
sheet.save(folder / '검수/pdf-contact.png')
result = {'pages': len(texts), 'textCharacters': list(map(len, texts)), 'fontNames': sorted(font_names), 'fontProgramsOrType3GlyphsEmbedded': True, 'renderedPages': len(images)}
(folder / '검수/pdf-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(result, ensure_ascii=False))
