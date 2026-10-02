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
OUT=ROOT/'output/pdf/yuhobuilds_EP01_그림으로_따라하는_첫질문_v2.pdf'
TMP=ROOT/'tmp/pdfs/yuhobuilds-ep01-v2'
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
c.setAuthor('yuhobuilds'); c.setCreator('yuhobuilds visual guide v2')
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
    p(f'{page:02d}  {label}',M,51,size=11,weight=600,color=BLUE)
    p(title,M,75,size=25,weight=800,leading=30,maxh=61)
    p(sub,M,148,size=12.2,leading=17.2,maxh=35)

def finish():
    for i in range(6):box(M+i*(CW/6),H-43,CW/6-5,2,BLUE if i<n else LINE,r=1)
    c.setFont('Inter400',8);c.setFillColor(HexColor(GRAY));c.drawString(M,22,'yuhobuilds / 2026.09 / v2')
    c.setFont('Mono',9);c.drawRightString(W-M,22,f'{n} / 6');c.showPage()

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

# PAGE 2: placeholder-to-input transformation, with obvious focus and send action.
start(2,'질문 입력하기','파란 문장만\n내 아이디어로 바꿔요.',
      '쓰고 있는 AI에서 새 대화를 열어요.\n아래 문장을 입력한 뒤 전송 버튼을 누르세요.')
badge(1,M,199);p('이 자리에 내 아이디어를 넣어요',M+28,199,size=12.2,weight=600)
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
note('로드맵 = 무엇을 어떤 순서로 할지 정리한 계획\n화면은 학습용 예시예요. 실제 버튼 모양은 다를 수 있어요.',513)
finish()

# PAGE 3: long reply becomes a highlighted first task, not a wall of advice.
start(3,'답변에서 시작점 찾기','답변이 길어도,\n첫 작업 하나만 찾아요.',
      'AI가 이런 순서를 제안했다고 가정해 볼게요.\n지금 손으로 해볼 수 있는 첫 항목에 집중해요.')
window(202,257,'AI 답변 · 로드맵')
box(M+13,245,CW-26,69)
badge(1,M+24,255);p('출석에 필요한 항목 정하기',M+53,254,CW-73,size=14,weight=800,color=BLUE)
p('이름 · 날짜 · 출석 여부를 표로 정리해요.',M+53,280,CW-72,size=11.5,color=GRAY)
cursor(W-M-27,294)
for j,(head,sub) in enumerate([('출석 입력 화면 만들기','누가 왔는지 입력할 화면을 만들어요.'),('저장하고 확인하기','입력한 기록이 남는지 확인해요.')]):
    yy=332+j*60
    p(str(j+2),M+27,yy,18,size=13,color=GRAY,weight=600)
    p(head,M+53,yy,CW-73,size=13,weight=600,color=GRAY)
    p(sub,M+53,yy+22,CW-73,size=10.7,color=GRAY)
badge('?',M,480)
p('첫 작업도 막막하면, 같은 대화에',M+28,479,size=11.8,weight=600)
p('“지금 할 첫 작업을 하나만,\n따라 할 수 있게 알려 줘.”',M+28,501,CW-28,size=14,weight=800,color=BLUE,leading=20)
finish()

# PAGE 4: a concrete second question and response, drawn as a conversation.
start(4,'같은 대화에서 다시 묻기','막히는 말을 그대로\n물어봐도 괜찮아요.',
      '예를 들어 “표로 정리하라”는 말이 막막하다면?\n새 대화를 열지 말고, 바로 이어서 물어봐요.')
window(202,294,'이어지는 대화')
p('내가 보낼 질문',M+81,246,CW-102,size=10.5,weight=600,color=BLUE)
box(M+72,265,CW-85,81)
p('표를 어떻게 만들지 모르겠어.\n설치 없이 종이에 먼저 해볼 수 있게\n예시 하나를 보여 줘.',M+85,276,CW-112,size=12.7,leading=19,maxh=58)
arrow(M+45,282,M+45,349)
p('AI 답변 예시',M+16,365,CW-32,size=10.5,weight=600,color=BLUE)
p('종이에 세 칸을 나눠 보세요.\n이름 / 날짜 / 출석 여부를 적고,\n그 아래에 가상 학생 한 명을 써 보세요.',M+16,391,CW-32,size=13.1,leading=20,maxh=63)
check(M+16,467);p('이제 다음 쪽 그림처럼 해볼 수 있어요.',M+36,462,CW-53,size=11.6,weight=600,color=BLUE)
note('모르는 용어가 나오면 “그 말이 무슨 뜻이야?\n내 출석 앱에 빗대어 설명해 줘.”라고 물어보세요.',515)
finish()

# PAGE 5: before / after / observable success, no software prerequisite.
start(5,'손으로 해보고 확인하기','빈 표가 기록 한 줄로.\n이렇게 확인하면 돼요.',
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
p('하나가 비어 있다면 그 칸부터 채워요. 실제 학생 정보는 쓰지 않아요.',M,532,size=9.8,color=GRAY,maxh=15)
finish()

# PAGE 6: transfer the demonstrated action to the reader's own idea.
start(6,'이제 내 아이디어로','그림대로 한 번 봤다면,\n이제 내 걸로 바꿔요.',
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
sidecar='''yuhobuilds EP.01 - 그림으로 따라 하는 첫 질문\n\n[내 아이디어로 바꿔 쓰기]\n나는 개발이 처음이야.\n[내가 만들고 싶은 것 입력]\n가장 효율적으로 만들 수 있는 로드맵을 추천해 줘.\n\n[영상 속 출석 앱 예시]\n나는 개발이 처음이야.\n학원 출석 앱을 만들고 싶어.\n가장 효율적으로 만들 수 있는 로드맵을 추천해 줘.\n\n[첫 작업이 막막할 때]\n지금 할 첫 작업을 하나만, 따라 할 수 있게 알려 줘.\n\n[표를 어떻게 만들지 모르겠을 때]\n표를 어떻게 만들지 모르겠어. 설치 없이 종이에 먼저 해볼 수 있게 예시 하나를 보여 줘.\n\n[모르는 용어가 나올 때]\n그 말이 무슨 뜻이야? 내 출석 앱에 빗대어 설명해 줘.\n\n[끝낸 건지 확인할 때]\n이 단계가 제대로 됐는지 눈으로 확인할 결과와 확인 방법을 알려 줘.\n\n예시 속 출석 앱은 내 목표에 맞게 바꿔 주세요.\n'''
(OUT.parent/'yuhobuilds_EP01_그림가이드_복사할질문_v2.txt').write_text(sidecar,encoding='utf-8-sig')
print(json.dumps(dict(file=str(OUT),pages=6,blocks=len(audit)),ensure_ascii=False))
