"""이번 최종 제출 후보 4개만 검사하고 파일 지문을 남긴다."""
from pathlib import Path
import hashlib
import json
from pypdf import PdfReader

root = Path(__file__).resolve().parents[3]
out = root / 'output/pdf/XR_하남_20260911'
expected = {
    'XR_부문2_아이디어제안서_교체본_20260911.pdf': 4,
    'XR_첨부1_이해공존감_구조도_교체본_20260911.pdf': 1,
    '하남 창업경진대회_예비_양유호_기본신청서류.pdf': 3,
    '하남 창업경진대회_양유호_사업계획서.pdf': 14,
}
files = []
for name, count in expected.items():
    path = out / name
    reader = PdfReader(path)
    assert len(reader.pages) == count, (name, len(reader.pages))
    texts = [p.extract_text() or '' for p in reader.pages]
    assert all(len(t.strip()) > 80 for t in texts), (name, 'blank page')
    assert '\ufffd' not in ''.join(texts), (name, 'replacement glyph')
    if name.startswith('XR_'):
        assert all(v not in ''.join(texts) for v in ['양유호', 'unmet23', 'SYNK', '19/19'])
    if '기본신청서류' in name:
        assert all(len(reader.pages[i].images) >= 1 for i in [1, 2]), 'signature absent'
        consent = ''.join(texts[2].split())
        assert '2년' in consent and '즉시' in consent and '파기' in consent
    fonts = {}
    for page in reader.pages:
        for ref in page.get('/Resources', {}).get('/Font', {}).values():
            font = ref.get_object()
            leaf = font.get('/DescendantFonts', [font])[0].get_object()
            descriptor = leaf.get('/FontDescriptor', {})
            descriptor = descriptor.get_object() if hasattr(descriptor, 'get_object') else descriptor
            embedded = any(k in descriptor for k in ['/FontFile','/FontFile2','/FontFile3']) or font.get('/Subtype') == '/Type3'
            fonts[str(font.get('/BaseFont', 'Type3'))] = bool(embedded)
    files.append({'path':str(path), 'pages':count, 'bytes':path.stat().st_size,
                  'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'fonts':fonts})
sources = []
for rel in ['docs/AI_운영원칙.md','docs/SYNK_철학.md','docs/제품방향.md','docs/비전_정본.md',
            'docs/개원전판매_설계_v1.md','docs/디자인_토큰.json',
            'tmp/xr_official_notice_20260911.pdf','tmp/xr_official_features_20260911.pdf',
            'tmp/xr_official_form_20260911.hwpx','tmp/hanam_official_notice_20260911.hwpx']:
    path = root / rel
    sources.append({'path':str(path), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
report = {'scope':'Local artifact validation, not submission or learning-effect validation',
          'files':files, 'sources':sources}
target = Path(__file__).with_name('pdf_verification.json')
target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status':'PASS','page_counts':[v['pages'] for v in files],
                  'report':str(target)}, ensure_ascii=True))
