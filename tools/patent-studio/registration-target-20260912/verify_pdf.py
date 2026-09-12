"""Inspect the generated PDF and create contact sheets for human visual review."""
from pathlib import Path
import json
import math
import subprocess
from pypdf import PdfReader
from PIL import Image, ImageDraw

root = Path('C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/등록목표_공보형_초안_20260912')
qa = root / '검수'
pdf = root / 'SYNK_등록목표_공보형_초안.pdf'
reader = PdfReader(pdf)
expected = json.loads((qa / 'verification.json').read_text(encoding='utf-8'))['pdfPages']
assert len(reader.pages) == expected
font_checks = []
text_pages = []
for page in reader.pages:
    text_pages.append(page.extract_text())
    assert len(text_pages[-1]) > 150, 'Unexpected empty or unextractable page'
    for ref in page['/Resources'].get('/Font', {}).values():
        font = ref.get_object()
        if font.get('/Subtype') == '/Type0':
            font = font['/DescendantFonts'][0].get_object()
        desc = font.get('/FontDescriptor')
        embedded = bool(desc and any(k in desc.get_object() for k in ['/FontFile', '/FontFile2', '/FontFile3']))
        embedded = embedded or (font.get('/Subtype') == '/Type3' and bool(font.get('/CharProcs')))
        font_checks.append(embedded)
assert font_checks and all(font_checks)
text = ' '.join('\n'.join(text_pages).split())
for value in ['청구항 1', '청구항 8', '부호의 설명', '실제 등록 공보 아님', 'Abstract']:
    assert value in text, value
poppler = 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe'
subprocess.run([poppler, '-r', '110', '-png', str(pdf), str(qa / 'page')], check=True)
pages = [qa / ('page-' + str(i).zfill(len(str(expected))) + '.png') for i in range(1, expected + 1)]
assert all(p.is_file() for p in pages)
for group in range(math.ceil(expected / 9)):
    selected = pages[group * 9:(group + 1) * 9]
    sheet = Image.new('RGB', (1080, math.ceil(len(selected) / 3) * 526), (237, 231, 220))
    draw = ImageDraw.Draw(sheet)
    for i, file in enumerate(selected):
        im = Image.open(file).convert('RGB')
        im.thumbnail((340, 490))
        x, y = (i % 3) * 360 + 10, (i // 3) * 526 + 22
        sheet.paste(im, (x, y))
        draw.text((x, y - 16), str(group * 9 + i + 1), fill=(43, 35, 32))
    sheet.save(qa / f'contact-{group + 1}.png')
result = {'pages': expected, 'fontsEmbedded': all(font_checks), 'renderedPages': len(pages), 'requiredTextPresent': True}
(qa / 'pdf-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
