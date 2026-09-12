from pathlib import Path
import json
from pypdf import PdfReader
from PIL import Image, ImageDraw
root=Path('C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/선행대조_종합검수_20260912')
reader=PdfReader(root/'SYNK_특허후보_선행대조_종합검수_20260912.pdf')
assert len(reader.pages)==10
fonts=[]
for page in reader.pages:
    assert len(page.extract_text())>180
    for ref in page['/Resources'].get('/Font',{}).values():
        f=ref.get_object()
        if f.get('/Subtype')=='/Type0': f=f['/DescendantFonts'][0].get_object()
        d=f.get('/FontDescriptor')
        embedded=bool(d and any(k in d.get_object() for k in ['/FontFile','/FontFile2','/FontFile3'])) or (f.get('/Subtype')=='/Type3' and bool(f.get('/CharProcs')))
        fonts.append({'name':str(f.get('/BaseFont','Type3 glyphs')),'embedded':embedded})
assert all(f['embedded'] for f in fonts)
pages=sorted((root/'검수').glob('page-*.png'))
assert len(pages)==10
sheet=Image.new('RGB',(1080,4*526),(237,231,220));draw=ImageDraw.Draw(sheet)
for i,file in enumerate(pages):
    im=Image.open(file).convert('RGB');im.thumbnail((340,490))
    x=(i%3)*360+10;y=(i//3)*526+22
    sheet.paste(im,(x,y));draw.text((x,y-16),str(i+1),fill=(43,35,32))
sheet.save(root/'검수/all-pages.png')
result={'pages':10,'fontsEmbedded':all(f['embedded'] for f in fonts),'fontOccurrences':len(fonts),'renderedPages':len(pages)}
(root/'검수/pdf-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
