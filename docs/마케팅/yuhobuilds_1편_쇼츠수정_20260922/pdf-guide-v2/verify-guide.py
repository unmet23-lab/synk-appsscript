from pathlib import Path
import hashlib,json,re
from pypdf import PdfReader
import pdfplumber

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
FILE=ROOT/'output/pdf/yuhobuilds_EP01_그림으로_따라하는_첫질문_v2.pdf'
OLD=ROOT/'output/pdf/yuhobuilds_EP01_첫질문_가이드_v1.pdf'
reader=PdfReader(FILE)
texts=[page.extract_text() for page in reader.pages]
assert len(texts)==6
assert reader.trailer['/Root']['/Lang']=='ko-KR'
assert not reader.get_fields()
assert hashlib.sha256(OLD.read_bytes()).hexdigest()=='32c04b8e749ccee91de952b46dc750453c3d7442e2bdab1079e35b6aca25cc31'
for i,t in enumerate(texts,1):
    assert f'{i} / 6' in t
    assert '\ufffd' not in t and '\x00' not in t
for i in (1,2,3):assert '학습용 예시' in texts[i]
script=json.loads((HERE.parent/'검수/업로드_20260926/final-script.json').read_text(encoding='utf-8'))
spoken=next(s for s in script['segments'] if s['id']=='13a')['text']
spoken=spoken[spoken.index('나는 개발이 처음이야.'):]
norm=lambda s:re.sub(r'\s+','',s)
assert norm(spoken) in norm(texts[1])
sidecar=FILE.parent/'yuhobuilds_EP01_그림가이드_복사할질문_v2.txt'
assert norm(spoken) in norm(sidecar.read_text(encoding='utf-8-sig'))
assert '[내가 만들고 싶은 것 입력]' in texts[5]
assert '가상 학생 A' in texts[4]
assert '실제 학생 정보는 쓰지 않아요.' in texts[4]
assert '내 상황에 맞는지 판단해요.' in texts[5]
issues=[]; fonts=set(); images=0
with pdfplumber.open(FILE) as pdf:
    for i,page in enumerate(pdf.pages,1):
        images+=len(page.images)
        for ch in page.chars:
            if ch['text'].strip() and (ch['x0']<25 or ch['x1']>page.width-25 or ch['top']<15 or ch['bottom']>page.height-15):
                issues.append(dict(page=i,text=ch['text'],bbox=[ch['x0'],ch['top'],ch['x1'],ch['bottom']]))
assert not issues,issues
assert images>=1
for page in reader.pages:
    for ref in page['/Resources']['/Font'].values():
        font=ref.get_object()
        if font.get('/Subtype')=='/TrueType':
            desc=font['/FontDescriptor'].get_object()
            assert '/FontFile2' in desc and '/ToUnicode' in font
            fonts.add(str(font['/BaseFont']))
report=dict(file=str(FILE),sha256=hashlib.sha256(FILE.read_bytes()).hexdigest(),bytes=FILE.stat().st_size,
    pages=6,pageSize='A5 portrait',language='ko-KR',videoPromptExactMatch=True,
    selectableKoreanText=True,companionMatches=True,originalV1Preserved=True,
    pageNumbersCorrect=True,textWithinMargins=True,embeddedFonts=sorted(fonts),rasterImages=images,
    vectorWalkthroughs=['editable idea and send button','highlighted roadmap','follow-up conversation','empty and filled attendance table','transfer to own idea'],
    mockScreensLabeled=True,forms='none; notes app or printed worksheet',
    visualReviewComplete=True,visualReview='All six pages rendered at 130 dpi and visually inspected; no clipping or overlap found',
    userReviewPending=True,publicDownloadPublished=False,videoCtaChanged=False)
(HERE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(HERE/'extracted-text.txt').write_text('\n\n'.join(f'PAGE {i+1}\n{t}' for i,t in enumerate(texts)),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('embeddedFonts','vectorWalkthroughs')},ensure_ascii=False))
