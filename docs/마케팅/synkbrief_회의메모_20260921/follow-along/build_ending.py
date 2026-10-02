from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pypdf import PdfReader
import json, zipfile, hashlib, re

ROOT=Path(__file__).resolve().parent
PDF=ROOT.parent/'output/pdf/synkbrief-meeting-guide.pdf'
canvas=Image.new('RGB',(1080,1920),'white')
draw=ImageDraw.Draw(canvas)
blue='#3D6BC9'; black='#111111'; muted='#526079'
def font(size,bold=False):
    return ImageFont.truetype(str(ROOT/'tmp'/('SUIT-Bold.ttf' if bold else 'SUIT-Regular.ttf')),size)
def text(s,x,y,size=40,color=black,bold=False):
    draw.text((x,y),s,font=font(size,bold),fill=color,anchor='lt')

text('synkbrief',78,107,37,bold=True)
text('회의 메모 → 할 일 표',78,245,33,color=blue,bold=True)
text('회의 정리,',73,314,97,bold=True)
text('바로 써보세요.',73,423,97,bold=True)
text('보고 따라 할 PDF와 복사용 요청문',78,559,40,color=muted)

# 실제 PDF 페이지의 미리보기. 새 UI나 가상의 제공물을 만들지 않는다.
for number,x,y,width in [(3,518,725,380),(2,325,685,410),(1,118,652,438)]:
    page=Image.open(ROOT/f'tmp/guide-{number}.png').convert('RGBA')
    height=round(page.height*width/page.width)
    page=page.resize((width,height),Image.Resampling.LANCZOS)
    shadow=Image.new('RGBA',canvas.size,(0,0,0,0))
    sd=ImageDraw.Draw(shadow); sd.rounded_rectangle((x+8,y+15,x+width+8,y+height+15),radius=5,fill=(17,34,60,42))
    canvas.paste(shadow.filter(ImageFilter.GaussianBlur(18)),(0,0),shadow.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(page,(x,y),page)
draw=ImageDraw.Draw(canvas)
text('PDF 4쪽  +  바로 쓰는 파일 3개',78,1364,43,bold=True)
text('복사용 요청문 · 연습 메모 · 결과 확인 예시',78,1427,31,color=muted)
draw.rounded_rectangle((76,1532,1004,1770),radius=30,fill=blue)
text('필요하시면 댓글에',113,1570,44,color='white',bold=True)
text('synk',111,1630,94,color='white',bold=True)
text('를 남겨주세요',379,1670,45,color='white',bold=True)
canvas.save(ROOT/'ending.png')

usage='회의 메모 → 할 일 표 | synkbrief\n\n1. guide.pdf를 먼저 엽니다.\n2. prompt.txt 전체를 ChatGPT 입력창에 붙여넣습니다.\n3. 마지막 메모 자리만 practice-memo.txt로 바꿔 연습합니다.\n4. 요청문과 메모를 함께 보내고 expected-result.txt 및 PDF로 확인합니다.\n5. 자기 메모로 다시 해보고, 확인한 표를 업무에 사용합니다.\n\n확인일: 2026-09-22. 가상 연습 예시이며 답변의 문구와 순서는 달라질 수 있습니다.\n별도 설치형 스킬은 아닙니다.\n'
(ROOT/'START-HERE.txt').write_text(usage,encoding='utf-8-sig')
zip_path=ROOT/'synkbrief-meeting-kit.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(PDF,'guide.pdf')
    for name in ['prompt.txt','practice-memo.txt','expected-result.txt','START-HERE.txt']: z.write(ROOT/name,name)

reader=PdfReader(PDF)
texts=[p.extract_text() for p in reader.pages]
normalize=lambda x:re.sub(r'\s+','',x)
source=(ROOT.parent/'prompt-template.txt').read_text(encoding='utf-8-sig').strip()
copied=(ROOT/'prompt.txt').read_text(encoding='utf-8-sig').strip()
assert source==copied
assert normalize(source) in normalize(texts[1])
assert len(texts)==4 and all(len(t)>400 for t in texts)
assert all('�' not in t for t in texts)
font_set=set()
for page in reader.pages:
    for f in page['/Resources']['/Font'].values():
        obj=f.get_object()
        if 'SUITGuide' in str(obj.get('/BaseFont','')):
            descriptor=obj['/FontDescriptor'].get_object()
            assert '/FontFile2' in descriptor
            font_set.add(str(obj['/BaseFont']))
assert len(font_set)>=2
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    zip_files=z.namelist()
    assert z.read('guide.pdf')==PDF.read_bytes()
verification={'date':'2026-09-22','pdfPages':len(texts),'charactersPerPage':[len(t) for t in texts],'fontsEmbedded':sorted(font_set),'promptMatchesOriginal':True,'pdfPromptExtractableAndMatchesTxt':True,'zipFiles':zip_files,'zipIntegrityPassed':True,'newChatGPTRun':False,'screenshotSource':'existing assets/v2/blank-input.png','sources':[{'url':'https://developers.openai.com/cookbook/examples/chatgpt/chatgpt_prompt_guide/chatgpt_prompt_guide','checked':'2026-09-22','usedFor':'output format, missing information, source review'}],'newVideoRendered':False,'publicDownloadConfigured':False,'commentDeliveryConfigured':False,'files':[]}
for p in [PDF,zip_path,ROOT/'ending.png']:
    verification['files'].append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(ROOT/'verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(texts),'zipFiles':zip_files,'checksPassed':True,'fontsEmbedded':sorted(font_set)}))
