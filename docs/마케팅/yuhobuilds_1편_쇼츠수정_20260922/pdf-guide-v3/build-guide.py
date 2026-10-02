"""Visual beginner walkthrough; original v1 and video assets stay unchanged."""
from pathlib import Path
from xml.sax.saxutils import escape
import json, re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfdoc import PDFString
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A5

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
PACKAGE=ROOT/'output/pdf/yuhobuilds_EP01_첫질문_가이드_v3'
OUT=PACKAGE/'그림으로_따라하는_첫질문.pdf'
TMP=ROOT/'tmp/pdfs/yuhobuilds-ep01-v3'
PROMPTS=json.loads((HERE/'prompts.json').read_text(encoding='utf-8'))
Q={x['id']:x for x in PROMPTS}
TOTAL=9
TMP.mkdir(parents=True,exist_ok=True)
OUT.parent.mkdir(parents=True,exist_ok=True)
W,H=A5
M=28; CW=W-2*M
INK='#000000'; BLUE='#3D68C4'; PALE='#EDF2FC'; GRAY='#535A65'; LINE='#CFD9EC'; WHITE='#FFFFFF'
for w in (400,500,600,800):
    pdfmetrics.registerFont(TTFont(f'SUIT{w}',str(ROOT/f'tmp/pdfs/yuhobuilds-ep01-v1/fonts/SUIT-{w}.ttf')))
for w,name in ((400,'Regular'),(500,'Medium'),(600,'SemiBold'),(800,'Bold')):
    pdfmetrics.registerFont(TTFont(f'Inter{w}',str(ROOT/f'docs/브랜드_폰트/InterTight/InterTight-{name}.ttf')))
pdfmetrics.registerFont(TTFont('Mono',str(ROOT/'docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf')))
c=canvas.Canvas(str(OUT),pagesize=A5,pageCompression=1)
c.setTitle('그림으로 따라 하는 첫 AI 질문 | yuhobuilds EP.01')
c.setAuthor('yuhobuilds'); c.setCreator('yuhobuilds visual guide v3')
c.setSubject('질문 입력, 답변 읽기, 다시 묻기, 출석 기록 한 줄 확인하기')
c.setViewerPreference('DisplayDocTitle','true');c._doc.Catalog.Lang=PDFString('ko-KR')
audit=[]; n=0

def p(text,x,y,width=CW,size=13,weight=500,color=INK,leading=None,maxh=None):
    parts=[]
    for line in text.split('\n'):
        bits=[]
        for chunk in re.findall(r'[A-Za-z0-9]+|[^A-Za-z0-9]+',line):
            face=f'Inter{weight}' if re.fullmatch(r'[A-Za-z0-9]+',chunk) else f'SUIT{weight}'
            bits.append(f'<font name="{face}">{escape(chunk)}</font>')
        parts.append(''.join(bits))
    style=ParagraphStyle('text',fontName=f'SUIT{weight}',fontSize=size,leading=leading or size*1.4,
        textColor=HexColor(color),wordWrap='CJK',splitLongWords=False)
    item=Paragraph('<br/>'.join(parts),style);_,height=item.wrap(width,1000)
    assert not maxh or height<=maxh+.1,(n,text,height,maxh)
    assert y+height<H-34,(n,text,y+height)
    item.drawOn(c,x,H-y-height)
    audit.append(dict(page=n,text=text,x=x,top=y,width=width,height=height,size=size))
    return y+height

def box(x,y,w,h,fill=PALE,stroke=None,r=10):
    c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke or fill));c.setLineWidth(.8)
    c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=1 if stroke else 0)

def line(x1,y1,x2,y2,color=LINE,lw=1):
    c.setStrokeColor(HexColor(color));c.setLineWidth(lw);c.line(x1,H-y1,x2,H-y2)

def arrow(x1,y1,x2,y2,color=BLUE):
    import math
    line(x1,y1,x2,y2,color,1.6)
    angle=math.atan2(y2-y1,x2-x1)
    for delta in (-.55,.55):
        line(x2,y2,x2-7*math.cos(angle+delta),y2-7*math.sin(angle+delta),color,1.6)

def badge(num,x,y):
    c.setFillColor(HexColor(BLUE));c.circle(x+10,H-y-10,10,fill=1,stroke=0)
    c.setFont('Mono',10);c.setFillColor(HexColor(WHITE));c.drawCentredString(x+10,H-y-13.5,str(num))

def cursor(x,y):
    path=c.beginPath();path.moveTo(x,H-y);path.lineTo(x+2,H-y-20);path.lineTo(x+7,H-y-14)
    path.lineTo(x+13,H-y-23);path.lineTo(x+17,H-y-20);path.lineTo(x+11,H-y-12)
    path.lineTo(x+20,H-y-11);path.close()
    c.setFillColor(HexColor(INK));c.setStrokeColor(HexColor(WHITE));c.setLineWidth(1.2);c.drawPath(path,fill=1,stroke=1)

def check(x,y):
    line(x,y+5,x+4,y+9,BLUE,2);line(x+4,y+9,x+12,y,BLUE,2)

def start(page,label,title,sub):
    global n
    n=page;c.setFillColor(HexColor(WHITE));c.rect(0,0,W,H,fill=1,stroke=0)
    c.bookmarkPage(f'page-{n}');c.addOutlineEntry(label,f'page-{n}',level=0)
    c.setFont('Inter800',12);c.setFillColor(HexColor(INK));c.drawString(M,H-30,'yuhobuilds')
    c.setFont('Mono',8.5);c.setFillColor(HexColor(GRAY));c.drawRightString(W-M,H-29,'EP.01 / VISUAL GUIDE')
    p(f'{page}쪽  |  {label}',M,51,size=11,weight=600,color=BLUE)
    p(title,M,75,size=25,weight=800,leading=30,maxh=61)
    p(sub,M,148,size=12.2,leading=17.2,maxh=35)

def finish():
    for i in range(TOTAL):box(M+i*(CW/TOTAL),H-43,CW/TOTAL-5,2,BLUE if i<n else LINE,r=1)
    c.setFont('Inter400',8);c.setFillColor(HexColor(GRAY));c.drawString(M,22,'yuhobuilds / 2026.09 / v3')
    c.setFont('Mono',9);c.drawRightString(W-M,22,f'{n} / {TOTAL}');c.showPage()

def window(y,h,label='AI 대화',example=True):
    box(M+3,y+4,CW,h,'#E2E8F2',r=12)
    box(M,y,CW,h,WHITE,LINE,r=12)
    for i in range(3):
        c.setFillColor(HexColor(LINE));c.circle(M+14+i*9,H-y-14,2,fill=1,stroke=0)
    p(label,M+52,y+7,CW-130,size=9.5,weight=600,color=GRAY)
    if example:p('학습용 예시',W-M-77,y+8,65,size=8.5,color=GRAY)
    line(M,y+29,W-M,y+29)

def note(text,y=520):
    p(text,M,y,size=11.2,leading=16,color=GRAY,maxh=33)

# PAGE 1: bridge the familiar video frame to a visible, achievable outcome.
start(1,'영상 다음, 직접 해보기','영상에서 본 첫 질문,\n이제 직접 보내 봐요.',
      '출석 앱을 예로, 질문부터 첫 작업까지 따라가요.\n이 가이드의 목표는 “다음에 뭘 할지” 아는 거예요.')
video=HERE.parent/'검수/prompt-complete.png'
box(M+3,204,119,211,'#E2E8F2',r=8)
c.drawImage(str(video),M,H-201-211,119,211,preserveAspectRatio=True,mask='auto')
p('영상 속 첫 질문',M,421,125,size=10.2,color=GRAY)
for i,(title,desc) in enumerate([('내 아이디어 입력','만들고 싶은 걸 말해요.'),('첫 작업 하나 선택','긴 계획에서 시작점을 찾아요.'),('결과를 눈으로 확인','출석 기록 한 줄을 읽어 봐요.')]):
    yy=209+i*73
    badge(i+1,M+139,yy)
    p(title,M+167,yy-1,CW-167,size=14,weight=800,maxh=22)
    p(desc,M+167,yy+25,CW-167,size=11.3,color=GRAY,maxh=34)
    if i<2:arrow(M+149,yy+33,M+149,yy+61)
box(M,462,CW,75)
p('이번에 눈으로 확인할 결과',M+14,473,CW-28,size=10.8,weight=600,color=BLUE)
p('가상 학생 A  /  9월 26일  /  출석',M+14,498,CW-28,size=16,weight=800,maxh=25)
finish()

# A real copy/paste instruction page; individual TXT files contain no labels.
start(2,'복사·붙여넣기부터','질문을 다 칠 필요 없이,\n복사해서 보내면 돼요.',
      '프롬프트는 AI에게 보내는 질문이나 부탁이에요.\n함께 받은 “프롬프트” 폴더에서 파일 하나를 열어요.')
for i,(head,body) in enumerate([
 ('첫 질문 파일 하나 고르기','내 아이디어는 01번, 출석 앱 연습은 02번.\n둘 중 하나만 골라요. 02번은 그대로 쓸 수 있어요.'),
 ('텍스트 파일에서 질문 복사하기','Windows: Ctrl+A → Ctrl+C\nMac: Command+A → Command+C'),
 ('AI 입력칸에 붙여넣고 보내기','Windows: Ctrl+V / Mac: Command+V\n[대괄호 부분]을 바꾼 뒤 전송 버튼을 눌러요.')]):
    yy=207+i*94;badge(i+1,M,yy)
    p(head,M+28,yy-1,CW-28,size=14,weight=800)
    p(body,M+28,yy+27,CW-28,size=11.8,leading=18,maxh=38)
p('A는 전체 선택, C는 복사, V는 붙여넣기예요.',M+28,367,CW-28,size=10.2,color=GRAY,maxh=15)
p('03~07번은 같은 대화에 필요한 것만 골라 보내요.',M,472,size=10.7,weight=600,color=BLUE,maxh=16)
box(M,495,CW,51)
p('휴대폰에서는 문장을 길게 눌러 선택·복사하고,\nAI 입력칸을 길게 눌러 붙여넣어요.',M+12,501,CW-24,size=11.4,leading=17)
finish()

# The input screen retains the exact EP01 example.
start(3,'질문 01 또는 02 · 새 대화','파란 문장만\n내 아이디어로 바꿔요.',
      '쓰고 있는 AI에서 새 대화를 열어요.\n아래 문장을 입력한 뒤 전송 버튼을 누르세요.')
badge(1,M,199);p('대괄호까지 지우고 내 문장으로 바꿔요',M+28,199,size=12.2,weight=600)
box(M+28,225,CW-28,34)
p('[내가 만들고 싶은 것 입력]',M+42,231,CW-56,size=14,weight=600,color=BLUE)
arrow(M+48,265,M+48,283)
window(291,204,'새 대화 · 질문 입력')
p('나는 개발이 처음이야.',M+17,335,CW-34,size=16,weight=600)
box(M+12,363,CW-24,33)
p('학원 출석 앱을 만들고 싶어.',M+17,368,CW-34,size=16,weight=800,color=BLUE)
p('가장 효율적으로 만들 수 있는\n로드맵을 추천해 줘.',M+17,405,CW-34,size=15,weight=600,leading=21)
badge(2,W-M-111,462);box(W-M-81,458,66,28,BLUE,r=14)
p('전송',W-M-64,462,39,size=12,weight=600,color=WHITE)
cursor(W-M-25,474)
note('02번 파일은 위 예시와 같아서 바꾸지 않아도 돼요.\n로드맵은 할 일의 순서예요. 화면은 학습용 예시예요.',513)
finish()

# PAGE 3: long reply becomes a highlighted first task, not a wall of advice.
start(4,'질문 03 · 답을 받은 같은 대화','답변이 길어도,\n첫 작업 하나만 찾아요.',
      'AI가 이런 순서를 제안했다고 가정해 볼게요.\n지금 손으로 해볼 수 있는 첫 항목에 집중해요.')
window(196,230,'AI 답변 · 로드맵')
box(M+13,245,CW-26,69)
badge(1,M+24,255);p('출석에 필요한 항목 정하기',M+53,254,CW-73,size=14,weight=800,color=BLUE)
p('이름 · 날짜 · 출석 여부를 표로 정리해요.',M+53,280,CW-72,size=11.5,color=GRAY)
cursor(W-M-27,294)
for j,(head,sub) in enumerate([('출석 입력 화면 만들기','누가 왔는지 입력할 화면을 만들어요.'),('저장하고 확인하기','입력한 기록이 남는지 확인해요.')]):
    yy=326+j*48
    p(str(j+2),M+27,yy,18,size=13,color=GRAY,weight=600)
    p(head,M+53,yy,CW-73,size=13,weight=600,color=GRAY)
    p(sub,M+53,yy+22,CW-73,size=10.7,color=GRAY)
badge('?',M,447)
p('03번 파일을 그대로 복사해 보내요',M+28,446,size=11.8,weight=600)
p(Q['03']['text'],M+28,473,CW-28,size=11.9,weight=600,color=BLUE,leading=17,maxh=70)
finish()

# PAGE 4: a concrete second question and response, drawn as a conversation.
start(5,'질문 04 · 출석 앱 대화에서만','막히는 말을 그대로\n물어봐도 괜찮아요.',
      '예를 들어 “표로 정리하라”는 말이 막막하다면?\n새 대화를 열지 말고, 바로 이어서 물어봐요.')
window(202,294,'이어지는 대화')
p('04번 파일 · 그대로 보내기',M+81,243,CW-102,size=10.5,weight=600,color=BLUE)
box(M+65,262,CW-78,91)
p(Q['04']['text'],M+77,272,CW-104,size=11.5,leading=16,maxh=76)
arrow(M+45,282,M+45,349)
p('AI 답변 예시',M+16,365,CW-32,size=10.5,weight=600,color=BLUE)
p('종이에 세 칸을 나눠 보세요.\n이름 / 날짜 / 출석 여부를 적고,\n그 아래에 가상 학생 한 명을 써 보세요.',M+16,391,CW-32,size=13.1,leading=20,maxh=63)
check(M+16,467);p('이제 다음 쪽 그림처럼 해볼 수 있어요.',M+36,462,CW-53,size=11.6,weight=600,color=BLUE)
note('다른 아이디어를 진행 중이라면 이 예시는 건너뛰어도 돼요.\n모르는 단어를 설명받는 05번 질문은 7쪽에 있어요.',515)
finish()

# PAGE 5: before / after / observable success, no software prerequisite.
start(6,'직접 해보고 결과 확인하기','빈 표가 기록 한 줄로.\n이렇게 확인하면 돼요.',
      '종이나 메모장에 아래 예시를 따라 적어요.\n앱을 만들기 전에 필요한 기록을 정해 보는 연습이에요.')

def table(y,filled=False):
    box(M+10,y,CW-20,94,WHITE,LINE,r=5)
    width=(CW-20)/3
    for i in range(1,3):line(M+10+width*i,y,M+10+width*i,y+94)
    line(M+10,y+35,W-M-10,y+35)
    for j,label in enumerate(['이름','날짜','출석 여부']):p(label,M+21+j*width,y+9,width-17,size=11.5,weight=600,color=GRAY)
    for j,label in enumerate(['가상 학생 A','9월 26일','출석'] if filled else ['','','']):
        if filled:p(label,M+21+j*width,y+54,width-17,size=12.9,weight=800,color=BLUE,maxh=23)
        else:line(M+25+j*width,y+67,M+width-6+j*width,y+67,LINE,.8)

badge(1,M,201);p('세 칸의 이름을 먼저 적어요',M+28,201,size=12.6,weight=800)
table(230,False)
arrow(W/2,333,W/2,355)
badge(2,M,369);p('가상 학생의 기록 한 줄을 넣어요',M+28,369,size=12.6,weight=800)
table(399,True)
check(M,511);p('누가 · 언제 · 왔는지 읽히면 성공!',M+21,506,CW-21,size=14,weight=800,color=BLUE)
p('실제 학생 정보는 쓰지 않아요. 잘됐는지 모르겠다면 다음 쪽 06번!',M,532,size=9.8,color=GRAY,maxh=15)
finish()

# Two independently copyable follow-up prompts, with explicit substitution.
start(7,'질문 05·06 · 필요할 때 하나만','모르는 말, 끝낸 작업.\n이렇게 다시 물어봐요.',
      '둘 다 앞서 작업하던 같은 대화에 보내요.\n파란 질문만 복사하고 대괄호 안을 내 상황으로 바꿔요.')
p('05  모르는 말이 나왔을 때',M,204,size=14.2,weight=800)
p('[모르는 말]을 단어로 바꿔요. 예: 데이터베이스',M,231,size=11.1,color=GRAY)
box(M,258,CW,79)
p(Q['05']['text'],M+13,270,CW-26,size=12.6,color=BLUE,leading=18,maxh=58)
p('06  작업이 잘됐는지 모르겠을 때',M,359,size=14.2,weight=800)
p('한 일과 지금 보이는 결과를 직접 적어요.\n예: 가상 학생 A / 9월 26일 / 출석 한 줄을 적었어.',M,386,size=11.1,color=GRAY,leading=16,maxh=34)
box(M,432,CW,114)
p(Q['06']['text'],M+13,442,CW-26,size=11.5,color=BLUE,leading=16.2,maxh=99)
finish()

start(8,'질문 07 · 하던 대화에 이어서','안내와 내 화면이 다르면,\n막힌 상황을 알려줘요.',
      '같은 질문을 반복하기보다, 내가 한 행동과\n지금 보이는 문구를 알려 주면 원인을 좁히기 쉬워요.')
badge(1,M,202);p('두 곳을 내 상황으로 바꿔요',M+28,202,size=13,weight=800)
box(M,238,CW,157)
p(Q['07']['text'],M+14,252,CW-28,size=12.5,color=BLUE,leading=19,maxh=130)
badge(2,M,417);p('답을 받으면 하나만 해보고 알려줘요',M+28,417,size=13,weight=800)
p('어떤 걸 바꿨고, 결과가 어떻게 달라졌는지 적어요.\n추가 질문을 받았다면 아는 부분부터 답하면 돼요.',M+28,446,CW-28,size=12,leading=18,maxh=38)
note('화면을 보여 줄 때는 계정 정보와 실제 학생 정보를 가려요.\nAI의 설명과 실제 결과가 맞는지는 직접 확인해요.',514)
finish()

# Final worksheet and the complete reusable starter prompt.
start(9,'질문 01 · 내 아이디어로 새 출발','그림대로 한 번 봤다면,\n이제 내 걸로 바꿔요.',
      '출석 앱 대신 내가 만들고 싶은 걸 넣어요.\n빈칸은 메모장에 적거나 인쇄해서 채워 주세요.')
for i,label in enumerate(['질문 보내기','첫 작업 하기','결과 확인하기']):
    xx=M+i*126
    box(xx,202,111,36,PALE,r=18)
    p(label,xx+13,211,90,size=11.3,weight=600,color=BLUE,maxh=17)
    if i<2:arrow(xx+114,220,xx+123,220)
p('복사해서 쓰는 첫 질문',M,260,size=12.2,weight=800)
box(M,285,CW,103)
p('나는 개발이 처음이야.',M+14,298,CW-28,size=13.5,weight=600)
p('[내가 만들고 싶은 것 입력]',M+14,321,CW-28,size=13.5,weight=800,color=BLUE)
p('가장 효율적으로 만들 수 있는 로드맵을 추천해 줘.',M+14,345,CW-28,size=12.5,leading=18,maxh=36)
for i,label in enumerate(['지금 해볼 첫 작업 하나','잘됐는지 확인할 결과']):
    yy=409+i*54
    p(label,M,yy,size=12.4,weight=800)
    line(M,yy+38,W-M,yy+38)
p('AI의 제안은 참고하고, 내 상황에 맞는지 판단해요.',M,526,size=11.5,weight=600,color=BLUE,maxh=19)
finish();c.save()
(HERE/'page-content.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
promptdir=PACKAGE/'프롬프트';promptdir.mkdir(exist_ok=True)
for q in PROMPTS:
    (promptdir/q['file']).write_text(q['text']+'\n',encoding='utf-8-sig')
combined=['yuhobuilds EP.01 | 복사할 프롬프트 모음','한 번에 전부 보내지 마세요. 처음에는 01 또는 02 하나, 이후에는 필요한 질문만 보내요.',
          '제목이나 안내까지 복사하기 어렵다면 프롬프트 폴더의 개별 TXT를 열어 전체 선택 후 복사하세요. 개별 파일에는 질문만 있어요.']
for q in PROMPTS:
    combined.extend(['',f"{q['id']}. {q['title']}",f"언제: {q['when']}",f"어디에: {q['where']}",f"바꿀 부분: {q['replace']}",'--- 여기부터 질문 ---',q['text'],'--- 질문 끝 ---',f"답을 받으면: {q['next']}"])
(PACKAGE/'프롬프트_모음.txt').write_text('\n'.join(combined)+'\n',encoding='utf-8-sig')

# Text companion includes all PDF body text and verbal descriptions of diagrams.
diagram={
1:'[그림 설명] 영상의 첫 질문 장면 옆에 내 아이디어 입력 → 첫 작업 하나 선택 → 결과 확인 순서가 있어요. 마지막 예시는 가상 학생 A / 9월 26일 / 출석이에요.',
2:'[따라 하기] 파일에서 복사 → AI 입력칸에 붙여넣기 → 대괄호 부분 바꾸기 → 전송 순서예요. 01번과 02번은 둘 중 하나만 고르세요.',
3:'[그림 설명] [내가 만들고 싶은 것 입력]을 학원 출석 앱을 만들고 싶어.로 바꾼 모습이에요. 그 아래 전송 버튼이 있어요. 실제 버튼 모양은 서비스마다 달라요.',
4:'[그림 설명] AI 답변 예시 세 항목 중 첫 번째인 출석에 필요한 항목 정하기만 파란색으로 강조돼 있어요. 뒤의 화면 만들기와 저장하기는 이후 작업이에요.',
5:'[그림 설명] 오른쪽 말풍선은 내가 보낼 질문, 아래는 AI 답변 예시예요. 같은 대화에 이어서 보내는 흐름이에요.',
6:'[표 설명] 이름 / 날짜 / 출석 여부 세 열 아래 빈칸이 있어요. 다음 표에는 가상 학생 A / 9월 26일 / 출석이 들어 있어요. 누가 언제 왔는지 읽히면 이번 연습의 결과를 확인한 거예요.',
7:'[사용법] 05번과 06번은 따로 보내는 질문이에요. 제목을 복사하지 말고 개별 질문 TXT를 사용하세요.',
8:'[사용법] [내가 한 행동]과 [오류 문구 또는 화면 상태] 두 곳을 바꿔요. 결과를 모르면 모른다고 말해도 돼요.',
9:'[작성란] 지금 해볼 첫 작업 하나: __________\n잘됐는지 확인할 결과: __________'
}
full=['yuhobuilds EP.01 | 처음부터 읽는 텍스트 가이드 | v3',
      '이 파일은 PDF 9쪽 전체의 글과 그림 설명을 담은 텍스트판이에요. 그림은 함께 받은 PDF에서 볼 수 있어요.',
      '처음에는 01 또는 02 중 하나만 보내요. 03~07은 차례대로 전부 보내는 과제가 아니라 필요할 때 골라 쓰는 질문이에요.',
      'PDF 속 AI 대화와 답변은 학습용 예시이며, 실제 답변은 달라질 수 있어요. 앱 설치나 완성을 보장하는 가이드가 아니에요.',
      'AI를 아직 쓰지 않는다면 가입 과정에서 막히는 부분부터 도움을 요청하거나, 질문을 메모장에 먼저 준비해 둬도 좋아요.']
for page in range(1,TOTAL+1):
    full.extend(['','='*40,f'PDF {page}쪽','='*40])
    full.extend(a['text'] for a in audit if a['page']==page)
    full.append(diagram[page])
full.extend(['','='*40,'질문마다 어디에 붙이고 무엇을 바꾸는지','='*40])
for q in PROMPTS:
    full.extend(['',f"{q['id']}. {q['title']}",f"파일: 프롬프트/{q['file']}",f"언제: {q['when']}",f"어디에: {q['where']}",f"바꿀 부분: {q['replace']}",f"예시: {q['example']}",'복사할 질문:',q['text'],f"답을 받으면: {q['next']}"])
(PACKAGE/'처음부터_읽는_가이드.txt').write_text('\n'.join(full)+'\n',encoding='utf-8-sig')
readme='''yuhobuilds EP.01 | 첫 질문 가이드 v3\n\n처음이라면 아래 순서로 열어 보세요.\n\n1. 그림으로_따라하는_첫질문.pdf\n   화면 예시와 화살표로 따라가는 9쪽 가이드입니다.\n\n2. 처음부터_읽는_가이드.txt\n   PDF의 모든 글, 그림 설명, 질문별 사용법이 있는 텍스트판입니다.\n\n3. 프롬프트 폴더\n   각 파일에는 AI에게 붙여넣을 질문만 들어 있습니다.\n   처음에는 01 또는 02 중 하나만 골라 새 대화에 보내세요.\n   03~07은 답을 받은 같은 대화에서 필요한 것만 사용하세요.\n   숫자가 순서대로 있다고 모두 보내는 것은 아닙니다.\n\n4. 프롬프트_모음.txt\n   모든 질문을 한 파일에서 찾고 싶을 때 열어 보세요.\n\n복사하는 법\nWindows: 개별 TXT에서 Ctrl+A, Ctrl+C → AI 입력칸을 누르고 Ctrl+V\nMac: 개별 TXT에서 Command+A, Command+C → AI 입력칸에서 Command+V\n휴대폰: 문장을 길게 눌러 선택·복사 → AI 입력칸을 길게 눌러 붙여넣기\n대괄호가 있는 질문은 대괄호까지 지우고 내 상황으로 바꾼 뒤 전송하세요.\n02·03·04번은 해당 상황이라면 그대로 보낼 수 있습니다.\n\nPDF에서 줄바꿈 때문에 복사가 어색하면 개별 TXT를 사용하세요.\n텍스트 파일은 UTF-8로 저장되어 있습니다.\n'''
(PACKAGE/'먼저_읽어주세요.txt').write_text(readme,encoding='utf-8-sig')
print(json.dumps(dict(file=str(OUT),pages=TOTAL,blocks=len(audit),individualPrompts=len(PROMPTS)),ensure_ascii=False))
