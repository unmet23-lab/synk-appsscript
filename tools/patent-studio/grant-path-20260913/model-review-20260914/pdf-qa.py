from pathlib import Path
from pypdf import PdfReader
from PIL import Image, ImageDraw
import hashlib
import json
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
repo = Path(__file__).resolve().parents[4]
folder = Path('C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/AI_교차검수_20260914')
name = 'SYNK_특허_교차검수_종합자료'
qa = json.loads((folder / '검수/verification.json').read_text(encoding='utf-8'))
pdf = folder / (name + '.pdf')
reader = PdfReader(pdf)
texts = [page.extract_text() for page in reader.pages]
norm = lambda value: ''.join(value.split())
full = norm(''.join(texts))
assert len(texts) == qa['pages'] and all(len(t) > 100 for t in texts)
claims = (repo / 'tools/patent-studio/grant-path-20260913/targeted/CLAIM_DECISIONS.md').read_text(encoding='utf-8')
paragraphs = re.findall(r'^\*\*\[(P[12]-0[1-7])\]\*\*([^\r\n]+)', claims, re.M)
assert len(paragraphs) == 13
for claim, text in paragraphs:
    assert norm('[' + claim + ']' + text) in full, claim
for number in range(1, 19):
    assert f'Q{number:02d}/' in full, number
assert all(x in full for x in ['반박답변요청문', 'source-audio-review', 'cellResultsMatchFull=true', 'D15', 'S20'])
font_names = set()
links = []
for page in reader.pages:
    for ref in page['/Resources']['/Font'].values():
        font = ref.get_object()
        font_names.add(str(font.get('/BaseFont', 'unknown')))
        if font.get('/Subtype') == '/Type3':
            assert font.get('/CharProcs') and font.get('/ToUnicode')
            continue
        for descendant in font.get('/DescendantFonts', [font]):
            descriptor = descendant.get_object().get('/FontDescriptor')
            assert descriptor and any(k in descriptor.get_object() for k in ['/FontFile', '/FontFile2', '/FontFile3'])
    for ref in page.get('/Annots', []):
        action = ref.get_object().get('/A')
        if action and action.get('/URI'):
            links.append(str(action['/URI']))
assert links and all(link.startswith('https://') for link in links)
render = folder / '검수' / ('pdf-' + hashlib.sha256(pdf.read_bytes()).hexdigest()[:10])
render.mkdir(exist_ok=True)
poppler = Path('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
subprocess.run([str(poppler), '-r', '110', '-png', str(pdf), str(render / 'page')], check=True)
pages = sorted(render.glob('page-*.png'), key=lambda p: int(p.stem.split('-')[-1]))
assert len(pages) == len(texts)
contacts = []
for start in range(0, len(pages), 4):
    sheet = Image.new('RGB', (1640, 2360), '#EDE7DC')
    draw = ImageDraw.Draw(sheet)
    for offset, file in enumerate(pages[start:start+4]):
        im = Image.open(file).convert('RGB')
        im.thumbnail((790, 1130))
        x, y = (offset % 2) * 820 + 15, (offset // 2) * 1180 + 30
        sheet.paste(im, (x, y))
        draw.text((x, y-18), f'PAGE {start+offset+1}', fill='#2B2320')
    out = render / f'contact-{start//4+1}.png'
    sheet.save(out)
    contacts.append(str(out))
record = {'pages': len(texts), 'textCharacters': [len(t) for t in texts],
          'exactCurrentClaimParagraphs': 13, 'questionIdsPresent': 18,
          'allSourceTextPreservedInHTML': qa['allSourceTextPreserved'],
          'fontsEmbedded': True, 'fontNames': sorted(font_names),
          'externalLinks': len(links), 'internalLinks': 0, 'renderedPages': len(pages), 'contacts': contacts}
(folder / '검수/pdf-verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(record, ensure_ascii=False))
