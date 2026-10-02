from pathlib import Path
import hashlib,json,re,zipfile
from pypdf import PdfReader
import pdfplumber
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
PKG=ROOT/'output/pdf/yuhobuilds_EP01_첫질문_가이드_v3'
PDF=PKG/'그림으로_따라하는_첫질문.pdf'
ZIP=PKG.with_suffix('.zip')
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(ROOT/'output/pdf/yuhobuilds_EP01_첫질문_가이드_v1.pdf')=='32c04b8e749ccee91de952b46dc750453c3d7442e2bdab1079e35b6aca25cc31'
assert sha(ROOT/'output/pdf/yuhobuilds_EP01_그림으로_따라하는_첫질문_v2.pdf')=='8bb6bacb1f0eb612e9119ac332028ff89aa97827a97f2a4e34766a8719c691a4'
r=PdfReader(PDF);texts=[p.extract_text() for p in r.pages]
assert len(texts)==9 and r.trailer['/Root']['/Lang']=='ko-KR'
norm=lambda t:re.sub(r'\s+','',t)
alltext=norm(''.join(texts))
qs=json.loads((HERE/'prompts.json').read_text(encoding='utf-8'))
full=(PKG/'처음부터_읽는_가이드.txt').read_text(encoding='utf-8-sig')
combined=(PKG/'프롬프트_모음.txt').read_text(encoding='utf-8-sig')
for q in qs:
    assert (PKG/'프롬프트'/q['file']).read_text(encoding='utf-8-sig')==q['text']+'\n'
    assert norm(q['text']) in alltext,q['id']
    assert q['text'] in full and q['text'] in combined
    for key in ['when','where','replace','example','next']:assert q[key] in full
for block in json.loads((HERE/'page-content.json').read_text(encoding='utf-8')):assert block['text'] in full
assert len(list((PKG/'프롬프트').glob('*.txt')))==7
for txt in PKG.rglob('*.txt'):
    raw=txt.read_bytes();assert raw.startswith(b'\xef\xbb\xbf')
    value=raw.decode('utf-8-sig');assert '\ufffd' not in value and '\x00' not in value
for i,t in enumerate(texts,1):
    assert f'{i} / 9' in t
    assert '\ufffd' not in t and '\x00' not in t
for i in [2,3,4]:assert '학습용 예시' in texts[i]
script=json.loads((HERE.parent/'검수/업로드_20260926/final-script.json').read_text(encoding='utf-8'))
spoken=next(s for s in script['segments'] if s['id']=='13a')['text']
spoken=spoken[spoken.index('나는 개발이 처음이야.'):]
assert norm(spoken)==norm(qs[1]['text'])
assert norm(spoken) in norm(texts[2])
issues=[];fonts=set()
with pdfplumber.open(PDF) as doc:
    for i,page in enumerate(doc.pages,1):
        for ch in page.chars:
            if ch['text'].strip() and (ch['x0']<25 or ch['x1']>page.width-25 or ch['top']<15 or ch['bottom']>page.height-15):
                issues.append([i,ch['text'],ch['x0'],ch['top'],ch['x1'],ch['bottom']])
assert not issues,issues
for page in r.pages:
    for ref in page['/Resources']['/Font'].values():
        font=ref.get_object()
        if font.get('/Subtype')=='/TrueType':
            assert '/FontFile2' in font['/FontDescriptor'].get_object() and '/ToUnicode' in font
            fonts.add(str(font['/BaseFont']))
files=sorted(p for p in PKG.rglob('*') if p.is_file())
assert len(files)==11,len(files)
with zipfile.ZipFile(ZIP,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for file in files:z.write(file,f'{PKG.name}/{file.relative_to(PKG).as_posix()}')
with zipfile.ZipFile(ZIP) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(files)
    for file in files:
        assert z.read(f'{PKG.name}/{file.relative_to(PKG).as_posix()}')==file.read_bytes()
report=dict(pdf=str(PDF),pdfSha256=sha(PDF),pdfBytes=PDF.stat().st_size,pages=9,
    zip=str(ZIP),zipSha256=sha(ZIP),zipBytes=ZIP.stat().st_size,zipMembers=len(files),
    allPromptsMatchPdfAndTxt=True,promptCount=7,individualTxtContainsOnlyPrompt=True,
    fullTextIncludesAllPdfBodyTextAndDiagramDescriptions=True,utf8BomRoundTrip=True,
    videoPromptExactMatch=True,v1AndV2Preserved=True,textWithinMargins=True,fontsEmbedded=sorted(fonts),
    visualReviewComplete=False,userReviewPending=True,videoChanged=False,published=False,
    files=[dict(file=f.relative_to(PKG).as_posix(),sha256=sha(f)) for f in files])
(HERE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['fontsEmbedded','files']},ensure_ascii=False))
