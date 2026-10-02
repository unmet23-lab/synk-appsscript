from pathlib import Path
import hashlib
import json
import re
from pypdf import PdfReader
import pdfplumber

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
FILE = ROOT / 'output/pdf/yuhobuilds_EP01_첫질문_가이드_v1.pdf'
reader = PdfReader(FILE)
texts = [p.extract_text() for p in reader.pages]
assert len(texts) == 4
assert reader.trailer['/Root']['/Lang'] == 'ko-KR'
assert not reader.get_fields()
for i,t in enumerate(texts,1):
    assert f'{i} / 4' in t, f'Wrong footer on page {i}'
    assert '\ufffd' not in t and '\x00' not in t, f'Invalid extracted text on page {i}'

script=json.loads((HERE.parent / '검수/업로드_20260926/final-script.json').read_text(encoding='utf-8'))
segment=next(s for s in script['segments'] if s['id']=='13a')['text']
spoken_prompt=segment[segment.index('나는 개발이 처음이야.'):]
normalize=lambda s: re.sub(r'\s+','',s)
assert normalize(spoken_prompt) in normalize(texts[1]), 'Episode prompt differs from PDF'
companion=(FILE.parent / 'yuhobuilds_EP01_복사할_질문.txt').read_text(encoding='utf-8-sig')
assert normalize(spoken_prompt) in normalize(companion)
assert '[내가 만들고 싶은 것 입력]' in texts[1]

issues=[]
font_names=set()
with pdfplumber.open(FILE) as doc:
    for i,page in enumerate(doc.pages,1):
        for char in page.chars:
            font_names.add(char['fontname'])
            if char['text'].strip() and (char['x0'] < 26 or char['x1'] > page.width-26 or char['top'] < 15 or char['bottom'] > page.height-15):
                issues.append({'page':i,'text':char['text'],'bbox':[char['x0'],char['top'],char['x1'],char['bottom']]})
assert not issues, issues
resources=[]
for page in reader.pages:
    for ref in page['/Resources']['/Font'].values():
        font=ref.get_object()
        if font.get('/Subtype')!='/TrueType':
            continue
        desc=font['/FontDescriptor'].get_object()
        assert any(key in desc for key in ('/FontFile','/FontFile2','/FontFile3'))
        assert '/ToUnicode' in font
        resources.append(str(font['/BaseFont']))
assert len(set(resources))>=4
report={
 'file':str(FILE),'sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'bytes':FILE.stat().st_size,
 'pages':len(texts),'pageSize':'A5 portrait','language':'ko-KR','selectableText':True,
 'videoPromptExactMatch':True,'plainTextCompanionMatches':True,'allPageNumbersCorrect':True,
 'fontEmbeddingPassed':True,'fontResources':sorted(set(resources)),'usedFonts':sorted(font_names),
 'textWithinPageMargins':True,'missingReplacementCharacters':False,'forms':'none; write in notes or on paper as explained in the PDF',
 'visualReviewComplete':False,'publicDownloadPublished':False,'videoCtaChanged':False,
}
(HERE / 'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(HERE / 'extracted-text.txt').write_text('\n\n'.join(f'PAGE {i+1}\n{t}' for i,t in enumerate(texts)),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('fontResources','usedFonts')},ensure_ascii=False))
