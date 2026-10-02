from pathlib import Path
import json, shutil, zipfile, hashlib
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
EP = HERE.parent
OUT = EP / 'output' / 'pdf'
TMP = HERE / 'tmp'
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(exist_ok=True)
pdfmetrics.registerFont(TTFont('SUIT', str(TMP/'SUIT-Regular.ttf')))
pdfmetrics.registerFont(TTFont('SUIT-Bold', str(TMP/'SUIT-Bold.ttf')))
pdfmetrics.registerFontFamily('SUIT',normal='SUIT',bold='SUIT-Bold')
W,H=595.276,841.89
INK='#111111'; BLUE='#3D6BC9'; MUTED='#555F70'; PALE='#EFF4FD'
pdf_path=OUT/'synkbrief-meeting-guide.pdf'
c=canvas.Canvas(str(pdf_path),pagesize=(W,H))
c.setTitle('회의 메모를 할 일 표로 | synkbrief 따라 하기 가이드')
c.setAuthor('synkbrief')
used=[]
def p(text,x,y,width=499,size=11.5,leading=None,color=INK,bold=False):
    style=ParagraphStyle('p',fontName='SUIT-Bold' if bold else 'SUIT',fontSize=size,leading=leading or size*1.52,textColor=HexColor(color),wordWrap='CJK')
    obj=Paragraph(text,style); _,h=obj.wrap(width,H)
    if y<800 and y+h>793: raise ValueError(f'Page overflow: {text[:60]} at {y+h}')
    obj.drawOn(c,x,H-y-h); used.append({'page':c.getPageNumber(),'top':y,'bottom':y+h,'text':text})
    return y+h
def box(x,y,w,h,color=PALE):
    c.setFillColor(HexColor(color)); c.roundRect(x,H-y-h,w,h,10,fill=1,stroke=0)
def image(path,x,y,w):
    im=ImageReader(str(path)); iw,ih=im.getSize(); h=w*ih/iw
    c.drawImage(im,x,H-y-h,w,h,mask='auto'); return y+h
def header(n,label,title,sub):
    p('synkbrief',48,30,220,14,bold=True); p(f'AI 활용법 01   /   {n:02d}',410,33,145,9,color=MUTED)
    p(label,48,81,size=10,color=BLUE,bold=True)
    p(title,48,106,size=27,leading=34,bold=True)
    p(sub,48,157,size=11.5,color=MUTED)
    p(f'2026.09.22 기준   ·   가상 메모로 연습하는 안내서',48,804,420,8.5,color=MUTED)
    p(f'{n} / 4',510,804,55,8.5,color=MUTED)
def table(rows,y,widths,fontsize=10):
    styles=ParagraphStyle('cell',fontName='SUIT',fontSize=fontsize,leading=fontsize*1.5,wordWrap='CJK')
    items=[[Paragraph(escape(t),styles) for t in row] for row in rows]
    t=Table(items,colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#C5D6F5')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),('ROWBACKGROUNDS',(0,1),(-1,-1),[HexColor('#F4F7FC'),HexColor('#FFFFFF')])]))
    tw,th=t.wrap(499,650)
    if y+th>790: raise ValueError('table overflow')
    t.drawOn(c,48,H-y-th); return y+th

prompt=(EP/'prompt-template.txt').read_text(encoding='utf-8-sig').strip()
demo=(EP/'prompt-v2-demo.txt').read_text(encoding='utf-8-sig').split('[가상 회의 메모]',1)[1].strip()
(HERE/'prompt.txt').write_text(prompt+'\n',encoding='utf-8-sig')
(HERE/'practice-memo.txt').write_text(demo+'\n',encoding='utf-8-sig')
shutil.copyfile(EP/'demo-response-v2.txt',HERE/'expected-result.txt')

header(1,'시작하기','회의 메모를 할 일 표로','ChatGPT를 처음 써도, 아래 순서와 예시를 따라 연습할 수 있어요.')
box(48,199,499,70)
p('완성하면 얻는 것',64,212,455,11,color=BLUE,bold=True)
p('할 일 · 담당자 · 기한 · 근거 문장이 있는 표와, 팀에 물어볼 질문.',64,235,455,12,bold=True)
p('01  ChatGPT를 열고 입력창 찾기',48,297,size=17,bold=True)
p('<link href="https://chatgpt.com" color="#3D6BC9">chatgpt.com</link>에 접속하세요. 로그인이 필요하면 완료하고 새 채팅을 여세요. 이미 대화 중이면 메뉴에서 새 채팅을 선택합니다.',48,332,499)
image(EP/'assets/v2/blank-input.png',62,397,300)
p('← 이 입력창에<br/>요청문과 메모를<br/>함께 넣습니다.',387,408,143,11,color=BLUE,bold=True)
p('실제 시연 화면의 입력창 부분. 화면 크기·계정에 따라 배치는 달라질 수 있어요.',48,500,499,9,color=MUTED)
p('준비할 것은 두 가지예요',48,545,size=17,bold=True)
p('① 글로 적힌 회의 메모<br/>② 함께 받은 prompt.txt의 전체 내용',48,580,499,12)
p('처음이라면 practice-memo.txt로 연습하세요. 이 안내서는 녹음 파일을 받아쓰는 기능이나 별도 스킬 설치를 사용하지 않습니다.',48,640,499)
box(48,706,499,63)
p('이 순서로 진행하세요',63,718,465,10,color=BLUE,bold=True)
p('입력창 찾기 → 요청문 복사 → 메모 교체 → 보내기 → 결과 확인',63,740,465,11)
c.showPage()

header(2,'입력하기','이 요청문을 그대로 복사하세요','프롬프트는 AI에게 맡길 일과 지켜야 할 조건을 적은 요청문이에요.')
box(48,201,499,265)
y=216
for line in prompt.splitlines():
    if not line: y+=11; continue
    y=p(escape(line),65,y,465,11.5,18,color=BLUE if line.startswith('[') else INK)+8
p('02  전체 붙여넣기 → 마지막 자리만 바꾸기',48,493,size=16,bold=True)
p('prompt.txt를 열고 전체를 복사해 ChatGPT 입력창에 붙여넣으세요. 맨 아래 [여기에 회의 메모 붙여넣기]만 지우고, 그 자리에 내 메모를 넣습니다. 위의 요청 문장은 그대로 둡니다.',48,528,499)
p('03  요청문과 메모를 한 번에 보내기',48,611,size=16,bold=True)
p('입력창에 두 내용이 모두 들어갔는지 확인한 뒤 보내기 버튼을 누르세요. 예시 화면에서는 입력창 오른쪽 아래의 위쪽 화살표입니다. 답변이 끝날 때까지 기다립니다.',48,646,499)
box(48,724,499,49)
p('PC 단축키: 전체 선택 Ctrl+A · 복사 Ctrl+C · 붙여넣기 Ctrl+V<br/>휴대폰: 글자를 길게 눌러 선택·복사한 뒤 입력창에서 붙여넣기',61,734,470,9.5)
c.showPage()

header(3,'원리와 연습','왜 조건을 같이 넣을까요?','AI가 무엇을 뽑고, 무엇을 확정하지 말아야 하는지 구분하도록 요청해요.')
rows=[['요청문에 넣은 조건','필요한 이유'],['할 일 / 담당자 / 기한 / 근거 문장','누가 무엇을 언제까지 할지 정리하고, 원문의 어느 말에서 나왔는지 대조하기 위해서예요.'],['없는 정보는 “확인 필요”','아직 정하지 않은 정보를 AI가 임의로 채우지 않도록 요청해요. 결과도 직접 확인해야 합니다.'],['제안은 확인할 질문으로 분리','“해보자”라는 의견이 이미 맡겨진 업무처럼 섞이지 않게 해요.'],['다음 회의 날짜를 기한으로 쓰지 않기','다음에 만나는 날짜와 일을 끝내기로 한 날짜는 다를 수 있어요.']]
y=table(rows,198,[180,319],10.5)
p('연습용 메모',48,y+28,size=17,bold=True)
p('practice-memo.txt에 아래 내용이 들어 있어요. 2쪽 요청문 맨 아래의 메모 자리를 이 네 문장으로 바꿔보세요.',48,y+60,499,11)
yy=y+117
box(48,yy,499,176)
p(escape(demo).replace('\n','<br/><br/>'),63,yy+14,468,10.5,15)
p('가상 예시입니다. 실제 회사 메모는 회사에서 사용을 허용한 환경과 자료로 진행하세요.',48,yy+189,499,9,color=MUTED)
c.showPage()

header(4,'확인하고 활용하기','표가 나오면, 원문과 대조하세요','예시의 확인 기준은 아래와 같아요. 답변의 문구나 질문 순서는 달라질 수 있어요.')
rows=[['할 일','담당자','기한','근거 문장'],['소개 페이지 문구 수정','지수','9월 23일','소개 페이지 문구는 제가 9월 23일까지 수정할게요.'],['설문 초안 작성','민호','확인 필요','설문 초안은 제가 맡을게요. 마감은 아직 정하지 않았어요.']]
y=table(rows,198,[132,57,86,224],10)
p('04  이 세 가지를 확인하세요',48,y+23,size=16,bold=True)
p('• 민호의 기한에 9월 25일이 들어가면 안 돼요. 그날은 다음 회의 날짜예요.<br/>• 고객 인터뷰는 제안 단계라 확정된 할 일 표에 넣지 않습니다.<br/>• 각 행의 근거 문장이 원래 메모에 실제로 있는지 대조하세요.',48,y+57,499,10.5,16)
p('05  미정인 내용은 묻고, 확인한 표를 공유하세요',48,y+125,size=15,bold=True)
p('“민호님, 설문 초안은 언제까지 가능할까요?”처럼 빠진 내용을 물어보세요. 기한이 확정되면 표를 고치고, 표 부분을 선택·복사해 팀이 쓰는 문서나 메신저에 붙여넣습니다. 보내기 전에 표 모양과 내용도 다시 확인하세요.',48,y+157,499,10.5,16)
p('원하는 답이 안 나오면 이렇게 이어서 요청하세요',48,y+237,size=13,bold=True)
box(48,y+263,499,79)
p('표가 없어요 → “할 일 / 담당자 / 기한 / 근거 문장 4열 표로 다시 정리해줘.”<br/>없는 날짜가 있어요 → “메모에서 확인되지 않는 기한은 확인 필요로 고쳐줘.”<br/>메모를 달라고 해요 → 마지막 자리에 실제 메모를 넣었는지 확인하세요.',61,y+275,473,9.5,16)
p('제공 파일: PDF 가이드 · prompt.txt · practice-memo.txt · expected-result.txt',48,724,499,9,color=MUTED)
p('자료 확인: 2026-09-22 · <link href="https://developers.openai.com/cookbook/examples/chatgpt/chatgpt_prompt_guide/chatgpt_prompt_guide" color="#3D6BC9">OpenAI 공식 프롬프팅 가이드</link><br/>결과 예시는 이 회차의 기존 ChatGPT 시연을 바탕으로 재구성했습니다.',48,749,499,8.7,13,color=MUTED)
c.save()
(HERE/'layout-check.json').write_text(json.dumps({'pdf':str(pdf_path),'pages':4,'textBlocks':used},ensure_ascii=False,indent=2),encoding='utf-8')
print(pdf_path)
