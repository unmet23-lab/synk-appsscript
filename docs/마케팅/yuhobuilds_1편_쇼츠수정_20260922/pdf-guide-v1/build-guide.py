"""Four-page beginner companion for the approved EP01. Local, editable, no remote assets."""
from pathlib import Path
from xml.sax.saxutils import escape
import json
import re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A5
from reportlab.pdfbase.pdfdoc import PDFString

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'output/pdf/yuhobuilds_EP01_첫질문_가이드_v1.pdf'
TMP = ROOT / 'tmp/pdfs/yuhobuilds-ep01-v1'
OUT.parent.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
W, H = A5
M = 29
CW = W - M * 2
INK, BLUE, GREY, PALE = '#000000', '#3D68C4', '#535A65', '#EDF2FC'
for weight in (400, 500, 600, 800):
    pdfmetrics.registerFont(TTFont(f'SUIT{weight}', str(TMP / f'fonts/SUIT-{weight}.ttf')))
for weight, filename in ((400, 'Regular'), (500, 'Medium'), (600, 'SemiBold'), (800, 'Bold')):
    pdfmetrics.registerFont(TTFont(f'Inter{weight}', str(ROOT / f'docs/브랜드_폰트/InterTight/InterTight-{filename}.ttf')))
pdfmetrics.registerFont(TTFont('Mono', str(ROOT / 'docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf')))

c = canvas.Canvas(str(OUT), pagesize=A5, pageCompression=1)
c.setTitle('AI로 뭔가 만들고 싶은데, 어디서 시작하죠? | yuhobuilds EP.01')
c.setAuthor('yuhobuilds')
c.setSubject('내 문제 고르기, 첫 질문 보내기, 다시 묻기, 첫 계획 남기기')
c.setCreator('yuhobuilds PDF guide v1')
c.setViewerPreference('DisplayDocTitle', 'true')
c._doc.Catalog.Lang = PDFString('ko-KR')
audit = []
page_no = 0

def mixed(text, weight=500):
    """Keep Korean in SUIT and Latin/digits in Inter Tight, with embedded ToUnicode maps."""
    parts = []
    for chunk in re.findall(r'[A-Za-z0-9]+|[^A-Za-z0-9]+', text):
        face = f'Inter{weight}' if re.fullmatch(r'[A-Za-z0-9]+', chunk) else f'SUIT{weight}'
        parts.append(f'<font name="{face}">{escape(chunk)}</font>')
    return ''.join(parts)

def para(text, x, top, width=CW, size=13.5, weight=500, color=INK, leading=None, max_height=None):
    style = ParagraphStyle('t', fontName=f'SUIT{weight}', fontSize=size,
        leading=leading or size*1.43, textColor=HexColor(color), wordWrap='CJK',
        splitLongWords=False, spaceBefore=0, spaceAfter=0, allowWidows=0, allowOrphans=0)
    markup = '<br/>'.join(mixed(line, weight) for line in text.split('\n'))
    obj = Paragraph(markup, style)
    pw, ph = obj.wrap(width, 900)
    if max_height is not None and ph > max_height + .1:
        raise ValueError(f'Text exceeds intended area: {text} [{ph}>{max_height}]')
    if top+ph > H-34:
        raise ValueError(f'Text touches footer: {text}')
    obj.drawOn(c, x, H-top-ph)
    audit.append(dict(page=page_no, text=text, x=x, top=top, width=width, height=ph, size=size))
    return top+ph

def box(top, height, fill=PALE, x=M, width=CW, radius=11):
    c.setFillColor(HexColor(fill)); c.roundRect(x, H-top-height, width, height, radius, fill=1, stroke=0)

def rule(x1, x2, top):
    c.setStrokeColor(HexColor('#B7C7E8')); c.setLineWidth(.65)
    c.line(x1, H-top, x2, H-top)

def start(n, label, title, subtitle=None):
    global page_no
    page_no = n
    c.setFillColor(white); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.bookmarkPage(f'page-{n}'); c.addOutlineEntry(label, f'page-{n}', level=0, closed=False)
    c.setFont('Inter800', 12); c.setFillColor(HexColor(INK)); c.drawString(M, H-31, 'yuhobuilds')
    c.setFont('Mono', 9); c.setFillColor(HexColor(GREY)); c.drawRightString(W-M, H-30, 'EP.01 / GUIDE')
    para(f'{n:02d}  {label}', M, 55, size=11.5, weight=600, color=BLUE)
    para(title, M, 82, size=25, weight=800, leading=30, max_height=62)
    if subtitle:
        para(subtitle, M, 155, size=13.1, leading=18.5, max_height=38)

def finish():
    c.setFont('Inter400', 8.5); c.setFillColor(HexColor(GREY))
    c.drawString(M, 22, 'yuhobuilds / 2026.09 / v1')
    c.setFont('Mono', 9); c.drawRightString(W-M, 22, f'{page_no} / 4')
    c.showPage()

# 1. A single concrete problem, followed by a matching worksheet.
start(1, '내 문제 고르기', 'AI로 뭔가 만들고 싶은데,\n어디서 시작하죠?',
      '거창한 아이디어보다,\n내가 매번 겪는 불편 하나면 충분해요.')
box(214, 142)
para('출석 앱으로 생각해 보면', M+17, 229, CW-34, size=12, weight=600, color=BLUE)
examples=[('누가?', '선생님이'), ('어떤 불편?', '출석을 따로 정리하기 번거롭다.'), ('첫 기능은?', '학생 한 명의 출석을 기록한다.')]
for i,(label,value) in enumerate(examples):
    top=258+i*29
    para(label, M+17, top, 111, size=11.7, weight=600, color=GREY)
    para(value, M+131, top, CW-147, size=12.1, max_height=22)
para('이제 내 상황으로 바꿔 적어요', M, 379, size=16, weight=800)
for i,label in enumerate(['누가 쓰나요?', '무엇이 불편한가요?', '처음엔 어떤 기능 하나만 있으면 좋을까요?']):
    top=414+i*35
    para(label, M, top, size=11.7, weight=600, color=GREY)
    rule(M, W-M, top+28)
para('빈칸은 메모장에 적거나 인쇄해서 채워 주세요.\n첫 기능 하나만 정하면 2쪽으로 넘어가요.', M, 523,
     size=11.7, leading=16.5, color=BLUE)
finish()

# 2. The exact sentence used in the final episode, followed by the replaceable template.
start(2, '첫 질문 보내기', '이 질문부터\n보내 보세요.',
      '쓰고 있는 AI의 새 대화를 열고, 아래 글을 복사해요.\n파란 문장만 내 아이디어로 바꾼 뒤 보내 주세요.')
box(213, 149)
para('복사해서 쓰는 질문', M+17, 227, size=11.5, weight=600, color=BLUE)
para('나는 개발이 처음이야.', M+17, 254, CW-34, size=15, weight=600)
para('[내가 만들고 싶은 것 입력]', M+17, 280, CW-34, size=15, weight=800, color=BLUE)
para('가장 효율적으로 만들 수 있는\n로드맵을 추천해 줘.', M+17, 306, CW-34, size=15, weight=600, leading=21)
para('영상 속 출석 앱 예시', M, 381, size=12, weight=600, color=BLUE)
prompt = '나는 개발이 처음이야.\n학원 출석 앱을 만들고 싶어.\n가장 효율적으로 만들 수 있는 로드맵을 추천해 줘.'
para(prompt, M, 405, size=13.5, leading=19.5, max_height=79)
para('로드맵 = 무엇을 어떤 순서로 할지 정리한 계획\n프롬프트 = AI에게 입력하는 질문이나 부탁', M, 498,
     size=11.8, leading=18, color=GREY, max_height=38)
para('아직 AI를 쓰지 않는다면 질문을 메모장에 먼저 적어둬도 좋아요.', M, 544,
     size=9.4, leading=13, color=GREY, max_height=14)
finish()

# 3. Three concrete obstacles and a low-effort response for each.
start(3, '막히면 다시 묻기', '답이 어려우면,\n이어서 물어보세요.',
      '처음부터 전부 이해할 필요는 없어요.\n같은 대화에서 필요한 질문 하나만 더 해보세요.')
followups=[
 ('모르는 말이 쏟아질 때', '방금 나온 용어를 내 출석 앱에 빗대어,\n개발을 처음 하는 사람에게 설명해 줘.'),
 ('할 일이 너무 많을 때', '출석 하나를 기록하는 데 필요한 첫 작업만\n골라 줘. 지금 할 일을 하나씩 알려 줘.'),
 ('끝낸 건지 모르겠을 때', '이 단계가 제대로 됐는지 눈으로 확인할\n결과와 확인 방법을 알려 줘.'),
]
for i,(heading,question) in enumerate(followups):
    top=214+i*91
    para(heading, M, top, size=15.5, weight=800)
    para(question, M, top+28, size=13.2, leading=19, color=BLUE, max_height=40)
para('출석 앱과 출석 기록은 내 목표에 맞게 바꿔 주세요.', M, 487,
     size=11.6, color=GREY)
para('도구를 추천받았다면, 고르기 전에 한 번 더', M, 517, size=11.8, weight=600)
para('추천 이유와 비용을 물어보고, 요금·제한은 공식 안내에서 확인해요.',
     M, 538, size=10.3, leading=14, color=GREY, max_height=17)
finish()

# 4. A finished example and writable space on the same page.
start(4, '내 첫 계획 남기기', '이 네 칸을 채우면,\n시작할 준비가 된 거예요.',
      '메모장이나 인쇄한 이 페이지에 한 줄씩 적어요.\n모르겠는 칸은 3쪽 질문으로 다시 물어보세요.')
rows=[
 ('만들 것', '예: 선생님이 쓰는 출석 앱'),
 ('첫 기능 하나', '예: 가상 학생 한 명의 출석을 기록하기'),
 ('지금 할 첫 작업', '예: 가상 이름·날짜·출석 여부를 표 한 줄로 적기'),
 ('잘됐는지 확인할 결과', '예: 표 한 줄에서 누가 언제 왔는지 읽을 수 있다'),
]
for i,(heading,example) in enumerate(rows):
    top=210+i*64
    para(heading, M, top, size=13.2, weight=800)
    para(example, M, top+21, size=10.9, leading=15, color=GREY, max_height=17)
    rule(M, W-M, top+54)
para('학생 정보는 가상 이름으로 연습해요.', M, 470, size=10.3, color=GREY)
para('앱을 완성하지 않아도 괜찮아요.', M, 500, size=15.5, weight=800)
para('첫 작업과 확인할 결과를 말할 수 있으면, 이번 단계는 끝!', M, 524,
     size=11.8, color=BLUE, max_height=19)
finish()
c.save()

# Plain-text companion protects copy/paste on PDF viewers that reflow selected text.
sidecar = 'yuhobuilds EP.01 - 복사할 첫 질문\n\n[내 아이디어로 바꿔 쓰기]\n나는 개발이 처음이야.\n[내가 만들고 싶은 것 입력]\n가장 효율적으로 만들 수 있는 로드맵을 추천해 줘.\n\n[영상 속 출석 앱 예시]\n'+prompt+'\n\n[답이 어려울 때 이어 묻기]\n'
for heading,question in followups:
    sidecar += '\n'+heading+'\n'+question.replace('\n',' ')+'\n'
sidecar+='\n위 예시의 출석 앱과 출석 기록은 내 목표에 맞게 바꿔 주세요.\n'
(OUT.parent / 'yuhobuilds_EP01_복사할_질문.txt').write_text(sidecar, encoding='utf-8-sig')
(HERE / 'page-content.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'output':str(OUT),'pages':4,'textBlocks':len(audit)},ensure_ascii=False))
