"""PDF 읽기 전용 감사. PDF/원고는 수정하지 않고 이 QA 폴더에만 결과를 둔다."""
from pathlib import Path
import hashlib
import json
import logging
import re
import unicodedata
from datetime import datetime, timezone
from pypdf import PdfReader
import pdfplumber

logging.getLogger('pdfminer.pdffont').setLevel(logging.ERROR)

qa = Path(__file__).resolve().parent
source = qa.parents[1] / '제공자료'

def norm(text):
    # PDF의 닫는 작은따옴표는 U+02BC로 추출된다. 문자로 취급되는 이 부호도 구두점으로 제외한다.
    return ''.join(c for c in unicodedata.normalize('NFKC', text) if c.isalnum() and c != '\u02bc')

def md_units(text):
    rows = []
    code = False
    for i, line in enumerate(text.splitlines(), 1):
        if line.startswith('```'):
            code = not code
            continue
        if not line.strip() or re.fullmatch(r'[\s|:\-]+', line):
            continue
        line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
        line = re.sub(r'^\s*(?:#{1,6}\s+|[-*]\s+|\d+\.\s+)', '', line)
        parts = line.strip('|').split('|') if line.startswith('|') else [line]
        for part in parts:
            clean = norm(part)
            if len(clean) >= 4:
                rows.append({'line': i, 'text': part.strip(), 'normalized': clean})
    return rows

out = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'method': '원본 MD의 내용 단위를 구두점·공백 제외 후 PDF 추출 텍스트에 대조. 표는 셀별. U+02BC도 따옴표로 제외. 이 검사는 실제 픽셀 검토와 별개.', 'coordinateLimitation': 'pdfminer가 일부 FontBBox 없는 서체에서 fallback 경고를 냈으므로 좌표 0건을 정밀 글리프 경계 보증으로 쓰지 않는다. 실제 Poppler 렌더를 병행한다.', 'files': []}
for pdf in sorted(source.glob('*.pdf')):
    reader = PdfReader(pdf)
    texts = [page.extract_text() or '' for page in reader.pages]
    joined = norm('\n'.join(texts))
    units = md_units(pdf.with_suffix('.md').read_text(encoding='utf-8'))
    missing = [{k: v for k, v in u.items() if k != 'normalized'} for u in units if u['normalized'] not in joined]
    links = []
    for i, page in enumerate(reader.pages, 1):
        for ref in page.get('/Annots', []):
            annot = ref.get_object()
            action = annot.get('/A', {})
            uri = action.get('/URI')
            if uri:
                links.append({'page': i, 'uri': str(uri)})
    outside = []
    with pdfplumber.open(pdf) as document:
        for i, page in enumerate(document.pages, 1):
            for char in page.chars:
                if char['x0'] < -0.5 or char['x1'] > page.width + 0.5 or char['top'] < -0.5 or char['bottom'] > page.height + 0.5:
                    outside.append({'page': i, 'text': char['text'], 'x0': char['x0'], 'x1': char['x1'], 'top': char['top'], 'bottom': char['bottom']})
    record = {'file': pdf.name, 'sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(), 'bytes': pdf.stat().st_size, 'pages': len(reader.pages), 'pageTextChars': [len(t) for t in texts], 'testedUnits': len(units), 'missingUnits': missing, 'links': links, 'outsidePageChars': outside}
    out['files'].append(record)
(qa / '원문대조.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{'file': x['file'], 'pages': x['pages'], 'testedUnits': x['testedUnits'], 'missingUnits': x['missingUnits'], 'linkCount': len(x['links']), 'outsidePageChars': len(x['outsidePageChars'])} for x in out['files']], ensure_ascii=False, indent=2))
