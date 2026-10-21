from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import hashlib, json, re, sys, unicodedata
import pypdfium2 as pdfium
from pypdf import PdfReader
from fontTools.ttLib import TTFont

sys.stdout.reconfigure(encoding='utf-8')
OUT = Path(__file__).resolve().parent
B = OUT.parent
ROOT = B.parents[3]
QA = OUT / 'docx_qa'
checks = []
def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    if not condition: raise AssertionError(name)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def norm(value): return re.sub(r'\s+', '', unicodedata.normalize('NFC', str(value)).replace('\u00ad', ''))
def source_text(page):
    items = [page['title'], page.get('lead', '')]
    for block in page.get('blocks', []):
        items.extend([block.get('text', ''), block.get('title', '')])
        if block['type'] == 'table': items.extend(v for row in [block['headers']] + block['rows'] for v in row)
        for item in block.get('items', []):
            items.extend([item.get('title', ''), item.get('text', ''), item.get('note', '')])
            if 'headers' in item: items.extend(v for row in [item['headers']] + item['rows'] for v in row)
    return [v for v in items if v]

book = json.loads((B / 'book.json').read_text(encoding='utf-8'))
oldbook = json.loads((OUT / 'previous-sources/book.json').read_text(encoding='utf-8'))
check('14-page source retained', len(book) == len(oldbook) == 14)
check('Page order retained', [p['id'] for p in book] == [p['id'] for p in oldbook])
scope = {'shift_offer', 'shift_expansion', 'execution', 'sources'}
check('Other brand and company page content unchanged', all(old == new for old, new in zip(oldbook, book) if old['id'] not in scope))
oldbrands = json.loads((OUT / 'previous-sources/brands.json').read_text(encoding='utf-8'))
brands = json.loads((B / 'brands.json').read_text(encoding='utf-8'))
check('Other brand audit pages unchanged', all(o == n for o, n in zip(oldbrands['pages'], brands['pages']) if o['brand'] != 'SHIFT'))
check('Both previous SHIFT audit pages preserved in full', all(n.get('previous_scope_reference') == o for o, n in zip(oldbrands['pages'], brands['pages']) if o['brand'] == 'SHIFT'))

pdfpath = OUT / 'SYNK_BM_20261007.pdf'
pdf = PdfReader(pdfpath)
check('Designed PDF has 14 pages', len(pdf.pages) == 14)
pdf_missing = []
for index, (page, source) in enumerate(zip(pdf.pages, book), 1):
    actual = norm(page.extract_text())
    missing = [v for v in source_text(source) if norm(v) not in actual]
    if source['id'] == 'world_economics':
        # The retained V2 PDF charts this table and expands its last header.
        check('Retained WORLD chart header gives the contribution meaning', norm('고정비 회수에 보태는 금액') in actual)
        missing = [v for v in missing if v != '남는 금액']
    pdf_missing.extend({'page': index, 'text': v} for v in missing)
    check(f'PDF page {index} source text complete', not missing)
check('Designed PDF has 15 source links', len(pdf.pages[-1]['/Annots']) == 15)
for index, annotation in enumerate(pdf.pages[-1]['/Annots'], 1):
    check(f'PDF source link {index} resolves to file URI', annotation.get_object()['/A']['/URI'].startswith('file:///'))
layout = json.loads((OUT / 'layout.json').read_text(encoding='utf-8'))
check('All measured PDF boxes stay above footer', all(x['y'] + x['h'] < 780 for x in layout))
check('New SHIFT scope appears on cover', '한업무의개인화도입·운영' in norm(pdf.pages[0].extract_text()))
check('Current revenue units present on SHIFT page', all(norm(s) in norm(pdf.pages[4].extract_text()) for s in ['초기 도입비', '정기 이용·운영료', '추가 사용·개발비']))
check('Previous SHIFT prices explicitly separated', '변경전가격안은현재도입비와분리한다' in norm(pdf.pages[4].extract_text()))
check('API and license follows repeat delivery evidence', '반복공급을확인한뒤상품을넓힌다' in norm(pdf.pages[5].extract_text()))
check('Research and testing described as implementation support', '시장조사·제품테스트는도입·활용·검증을돕는지원범위' in norm(pdf.pages[5].extract_text()))
font_paths = [B / 'assets/SUIT-500.ttf', ROOT / 'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf', ROOT / 'docs/브랜드_폰트/SYNKBracket/SYNKBracket-Regular.ttf']
cmap = set().union(*(set(TTFont(p).getBestCmap()) for p in font_paths))
missing_glyphs = [c for c in set(json.dumps(book, ensure_ascii=False)) if not c.isspace() and ord(c) not in cmap]
check('Book uses supported glyphs', not missing_glyphs)

designed_render = OUT / 'pdf_qa'
designed_render.mkdir(exist_ok=True)
designed = pdfium.PdfDocument(pdfpath)
for index, page in enumerate(designed, 1):
    page.render(scale=1.6).to_pil().save(designed_render / f'page-{index}.png')
check('Designed PDF all pages rasterized', len(list(designed_render.glob('page-*.png'))) == 14)

structure = json.loads((QA / 'structure.json').read_text(encoding='utf-8'))
render = json.loads((QA / 'render_report.json').read_text(encoding='utf-8'))
word = json.loads((QA / 'word_pages.json').read_text(encoding='utf-8-sig'))
check('Word built from current source SHA', structure['source_sha256'] == sha(B / 'book.json'))
check('Word editable source has no omitted text', structure['editable_source_text_missing'] == [])
check('Word is editable', word.get('read_only') is False)
check('Word actual pagination is 14 pages', word['pages'] == render['actual_pages'] == 14)
check('Word all pages rasterized', len(list(QA.glob('page-*.png'))) == 14)
word_missing = []
for index, (page, source) in enumerate(zip(render['pages'], book), 1):
    actual = norm(page['text'])
    missing = [v for v in source_text(source) if norm(v) not in actual]
    word_missing.extend({'page': index, 'text': v} for v in missing)
    check(f'Word page {index} rendered source text complete', not missing)
check('Word cover updated', '한업무의개인화도입·운영' in norm(render['pages'][0]['text']))
check('Word every footer uses current revision date', all('2026.10.07' in page['text'] for page in render['pages']))
font_names = set()
for page in PdfReader(QA / 'SYNK_BM_Word_QA.pdf').pages:
    for ref in page['/Resources']['/Font'].values():
        font = ref.get_object()
        descendant = font['/DescendantFonts'][0].get_object() if '/DescendantFonts' in font else font
        descriptor = descendant.get('/FontDescriptor')
        if descriptor and '/FontFile2' in descriptor.get_object():
            font_names.add(TTFont(BytesIO(descriptor.get_object()['/FontFile2'].get_data()))['name'].getDebugName(6))
check('Actual Word output uses approved SUIT and Inter fonts', {'SUIT-BM-Regular', 'InterTight-Medium', 'InterTight-Bold'} <= font_names)
check('No unexpected Word font fallback', not {'Batang', 'Gulim', 'Calibri'} & font_names)
with ZipFile(OUT / 'SYNK_BM_수정용.docx') as z:
    check('Word document not flattened to page images', len([n for n in z.namelist() if n.startswith('word/media/')]) == 1)
    check('Word has two editable-compatible embedded Inter fonts', len([n for n in z.namelist() if n.endswith('.odttf')]) == 2)
    check('Word edit protection not enabled', b'documentProtection' not in z.read('word/settings.xml'))

old_delivery = json.loads((B.parents[1] / '통합계산_20261006/qa/delivery.json').read_text(encoding='utf-8'))
desk = Path('C:/Users/q1212/OneDrive/Desktop/bm 설계표')
for item in old_delivery:
    check(f'Existing desktop {item["name"]} byte-identical', sha(desk / item['name']).upper() == item['sha256'].upper())
for artifact, entry in [('SYNK_BM_20261005.pdf', old_delivery[0]), ('SYNK_BM_수정용.docx', old_delivery[1])]:
    check(f'Previous V2 output {artifact} byte-identical', sha(B / 'output' / artifact).upper() == entry['sha256'].upper())
original = json.loads((B.parent / 'original-manifest.json').read_text(encoding='utf-8'))
for item in original:
    check(f'Preserved original {item["path"]}', sha(desk / '99_이전자료/20261005_정리전' / item['path']) == item['sha256'])

names = ['app.json', 'brands.json', 'brand_pages.json', 'curate.py', 'book.json', 'build_v2.py', 'build_docx_v2.py', 'verify_v2.py']
report = {
    'status': 'automated-and-rendered-awaiting-final-visual-review', 'as_of': '2026-10-07',
    'checks': len(checks), 'passed': sum(x['passed'] for x in checks), 'tests': checks,
    'pdf_pages': 14, 'word_pages': 14, 'rendered_pages': 28,
    'editable_word': True, 'missing_source_text': {'pdf': pdf_missing, 'word': word_missing},
    'missing_glyphs': missing_glyphs, 'actual_word_font_names': sorted(font_names),
    'preserved_desktop_files': len(old_delivery), 'preserved_original_files': len(original),
    'sources': {name: {'sha256': sha(B / name), 'bytes': (B / name).stat().st_size} for name in names},
    'files': {name: {'sha256': sha(OUT / name), 'bytes': (OUT / name).stat().st_size} for name in ['SYNK_BM_20261007.pdf', 'SYNK_BM_수정용.docx']},
    'not_verified': ['Actual customers and prices', 'Supplier current billing', 'Real customer effects and profitability', 'Publication or deployment']
}
review_path = OUT / 'visual-review.json'
if review_path.exists():
    review = json.loads(review_path.read_text(encoding='utf-8'))
    check('All 28 final page images visually reviewed', len(review['pages']) == 28 and review['all_pages_clean'] is True)
    check('Visual review corresponds to final PDF and Word SHA', all(review['artifacts'][name] == sha(OUT / name) for name in report['files']))
    check('Visual review page images still byte-identical', all(sha(OUT / name) == digest for name, digest in review['pages'].items()))
    report['status'] = 'local-content-and-visual-verified'
    report['visual_review'] = review
    report['checks'] = len(checks)
    report['passed'] = sum(x['passed'] for x in checks)
    report['tests'] = checks
report['renderer'] = {'pdf': 'ReportLab and full-page PDFium rasterization', 'word': 'Actual Microsoft Word COM export and full-page PDFium rasterization', 'packaged_docx_renderer': 'Attempted; LibreOffice soffice.exe unavailable on this Windows runtime. Native Word rendered all 14 pages.', 'python': sys.executable, 'fonttools': '4.66.1 installed into task-local temporary dependencies; not included in final document delivery'}
(OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k not in ('sources', 'files', 'tests')}, ensure_ascii=False, indent=2))
