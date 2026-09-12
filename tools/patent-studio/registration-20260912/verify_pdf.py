from pathlib import Path
import json
from pypdf import PdfReader

base = Path('C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/등록우선전략_20260912')
pdf = base / 'SYNK_등록특허_1건을_위한_전략.pdf'
reader = PdfReader(pdf)
assert len(reader.pages) == 16
fonts = {}
page_checks = []
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    assert len(text) > 180, (i, len(text))
    assert '\ufffd' not in text
    for ref in page['/Resources'].get('/Font', {}).values():
        font = ref.get_object()
        f = font['/DescendantFonts'][0].get_object() if '/DescendantFonts' in font else font
        descriptor = f.get('/FontDescriptor')
        if font.get('/Subtype') == '/Type3':
            # Skia stores Korean variable-font glyph drawings as Type3 CharProcs.
            glyphs = font.get('/CharProcs', {})
            embedded = bool(glyphs) and all(len(g.get_object().get_data()) > 0 for g in glyphs.values())
            name = f'Type3 embedded glyph set {ref.idnum}'
        else:
            embedded = bool(descriptor and any(k in descriptor.get_object() for k in ['/FontFile', '/FontFile2', '/FontFile3']))
            name = str(font.get('/BaseFont'))
        fonts[name] = embedded
    page_checks.append({'page': i+1, 'textCharacters': len(text), 'width': float(page.mediabox.width), 'height': float(page.mediabox.height)})
assert fonts and all(fonts.values()), fonts
result = {'pageCount': len(reader.pages), 'bytes': pdf.stat().st_size, 'embeddedFonts': fonts, 'pages': page_checks, 'textExtraction': True}
(base/'검수/pdf-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'pages': len(reader.pages), 'bytes': pdf.stat().st_size, 'allFontsEmbedded': True, 'fonts': len(fonts)}, ensure_ascii=False))
