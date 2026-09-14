from pathlib import Path
from pypdf import PdfReader
from PIL import Image, ImageDraw
import hashlib
import json
import re
import subprocess
import sys
import zipfile

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
repo = Path(__file__).resolve().parents[4]
folder = Path('C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/변리사전달_이해설명_20260914')
qa = json.loads((folder / '검수/verification.json').read_text(encoding='utf-8'))
claims = (repo / 'tools/patent-studio/grant-path-20260913/targeted/CLAIM_DECISIONS.md').read_text(encoding='utf-8')
paragraphs = re.findall(r'^\*\*\[(P1-0[1-7])\]\*\*([^\r\n]+)', claims, re.M)
assert len(paragraphs) == 7
norm = lambda value: ''.join(value.replace('\u02bc', '\u2019').split())
poppler = Path('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
records = []
for doc in qa['documents']:
    pdf = folder / (doc['name'] + '.pdf')
    pdf_hash = hashlib.sha256(pdf.read_bytes()).hexdigest()
    assert pdf_hash == doc['pdfHash']
    reader = PdfReader(pdf)
    texts = [page.extract_text() for page in reader.pages]
    assert len(texts) == doc['pages'] and all(len(t) > 100 for t in texts)
    for i, (page_text, chunks) in enumerate(zip(texts, doc['expectedText'])):
        for text in chunks:
            assert norm(text) in norm(page_text), (doc['kind'], i + 1, text)
    full = norm(''.join(texts))
    if doc['kind'] == 'attorney':
        for claim, text in paragraphs:
            assert norm('[' + claim + ']' + text) in full, claim
        assert all(x in full for x in ['D01', 'D02', 'D03', 'D04', 'timeBounds', 'P1-07'])
    else:
        assert all(x in full for x in ['30초설명', '2분설명', '5분동안', '철회1개', '유지2개', '아직수정하지않았습니다'])
    assert all(x not in full for x in ['{{P1_', '공개이력', '공개시점', 'C:/Users/', 'unmet23'])
    font_names = set()
    links = []
    for page in reader.pages:
        assert abs(float(page.mediabox.width) - 595.28) < 2
        assert abs(float(page.mediabox.height) - 841.89) < 2
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
    render = folder / '검수' / (doc['kind'] + '-' + pdf_hash[:10])
    render.mkdir(exist_ok=True)
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
    records.append({'kind': doc['kind'], 'name': doc['name'], 'pages': len(texts),
                    'pdfHash': pdf_hash, 'textCharacters': [len(t) for t in texts],
                    'allExpectedTextPreserved': True,
                    'pdfTextNormalization': 'whitespace and U+02BC/U+2019 equivalent apostrophe glyph',
                    'exactCurrentP1Paragraphs': 7 if doc['kind'] == 'attorney' else None,
                    'fontsEmbedded': True, 'fontNames': sorted(font_names),
                    'externalLinks': len(links), 'renderedPages': len(pages),
                    'mobile': doc['mobile'], 'contacts': contacts})
result = {'documents': records, 'totalPages': sum(r['pages'] for r in records)}
(folder / '검수/pdf-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
readme = '''SYNK 특허 미팅 자료 · 2026.09.14

변리사에게 전달할 문서: SYNK_특허_변리사전달용_목적과사실관계.pdf (10쪽)
유호님이 먼저 읽을 문서: SYNK_특허_쉬운이해와미팅설명서.pdf (15쪽)

쉬운 설명서 2~5쪽으로 원리를 이해한 뒤 10~11쪽의 시연을 따라 하고,
13쪽 발표 대본과 14쪽 미팅 순서를 읽으세요.

각 HTML은 인터넷 없이 열어 볼 수 있는 화면용 문서입니다.
각 Markdown(.md)은 수정 가능한 본문이며, 자산 폴더를 함께 보관하세요.
문안을 수정하면 인쇄·PDF의 페이지 배치를 다시 확인해야 합니다.

기준은 한국 등록 검토입니다. 현재 구현·합성 검증과 남은 문제를 함께 적었습니다.
이 묶음의 제작은 변리사에게 실제 발송하거나 특허를 출원한 것을 뜻하지 않습니다.
'''
archive = folder / 'SYNK_특허_미팅자료_두버전_원본포함.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    bundle.writestr('먼저읽기.txt', readme)
    for doc in qa['documents']:
        for suffix in ['.pdf', '.html', '.md']:
            f = folder / (doc['name'] + suffix)
            bundle.write(f, f.name)
    for f in sorted((folder / '자산').iterdir()):
        if f.is_file():
            bundle.write(f, '자산/' + f.name)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None and len(bundle.namelist()) == 10
result['archive'] = {'name': archive.name, 'entries': 10, 'bytes': archive.stat().st_size,
                     'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}
(folder / '검수/package-verification.json').write_text(json.dumps(result['archive'], ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
