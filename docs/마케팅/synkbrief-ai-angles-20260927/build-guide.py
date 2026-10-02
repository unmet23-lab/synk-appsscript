from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color, white, black
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image

BASE = Path(__file__).resolve().parent
TMP = BASE / 'qa' / 'guide'
TMP.mkdir(parents=True, exist_ok=True)
for weight in ('Regular', 'Bold'):
    pdfmetrics.registerFont(TTFont('SUIT-' + weight, str(TMP / ('SUIT-' + weight + '.ttf'))))
pdfmetrics.registerFontFamily('SUIT', normal='SUIT-Regular', bold='SUIT-Bold')

W, H = 595.276, 841.89
M = 42
CW = W - 2*M
BLUE = HexColor('#274BDD')
GRAY = HexColor('#52565E')
LIGHT = HexColor('#F3F5FA')
LINE = HexColor('#DFE3EB')
images = {}
for name in ['source','hero','detail','lifestyle']:
    im = Image.open(BASE / 'assets' / 'images' / (name + '.png')).convert('RGB')
    im.thumbnail((1200, 1500), Image.Resampling.LANCZOS)
    out = TMP / (name + '.jpg')
    im.save(out, quality=89, optimize=True)
    images[name] = str(out)

c = canvas.Canvas(str(BASE / 'guide.pdf'), pagesize=(W,H), pageCompression=1)
c.setTitle('사진 한 장으로 광고 세 컷 | synkbrief')
c.setAuthor('SYNK')
c.setSubject('AI 이미지 편집과 광고 컷 구성 실습 가이드')

def txt(s, x, top, size=11, bold=False, color=black):
    c.setFillColor(color)
    c.setFont('SUIT-Bold' if bold else 'SUIT-Regular',size)
    c.drawString(x, H-top-size*0.82, s)

def para(s, x, top, width=CW, size=11, leading=16, bold=False, color=black):
    style=ParagraphStyle('body', fontName='SUIT-Bold' if bold else 'SUIT-Regular',
        fontSize=size, leading=leading, textColor=color, wordWrap=None, splitLongWords=True,
        spaceBefore=0, spaceAfter=0, allowWidows=0, allowOrphans=0)
    p=Paragraph(s,style)
    _,height=p.wrap(width,1000)
    p.drawOn(c,x,H-top-height)
    return height

def rect(x,top,width,height,color,stroke=None):
    c.setFillColor(color)
    c.setStrokeColor(stroke or color)
    c.rect(x,H-top-height,width,height,fill=1,stroke=bool(stroke))

def photo(name,x,top,width,height):
    im=Image.open(images[name])
    scale=min(width/im.width,height/im.height)
    iw,ih=im.width*scale,im.height*scale
    c.drawImage(images[name],x+(width-iw)/2,H-top-(height+ih)/2,iw,ih,mask='auto')

def rule(top):
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(M,H-top,W-M,H-top)

def header(page,section):
    txt('synkbrief',M,26,13,True)
    c.setFont('SUIT-Regular',8.2);c.setFillColor(GRAY)
    c.drawRightString(W-M,H-33,section)
    rule(50)
    rule(802)
    txt('사진 한 장으로 광고 세 컷',M,814,8,color=GRAY)
    c.drawRightString(W-M,H-821,f'{page:02d} / 04')

def badge(num,label,top):
    txt(num,M,top,10,True,BLUE)
    txt(label,M+28,top,10,True,BLUE)

header(1,'AI 실습 가이드 · 2026.09.27')
txt('사진 한 장으로',M,77,33,True)
txt('광고 세 컷',M,118,45,True,BLUE)
para('같은 제품을 전체, 디테일, 사용 장면으로 보여주세요.<br/>멋진 결과를 고르는 것만큼, 원본과 대조하는 과정도 중요합니다.',M,184,size=12,leading=18)
txt('기준 사진 1장',M,238,11,True)
txt('실제 생성 결과 3장',M+174,238,11,True)
photo('source',M,262,137,174)
txt('→',M+145,335,20,True,BLUE)
for i,(name,label) in enumerate([('hero','전체'),('detail','디테일'),('lifestyle','사용 장면')]):
    x=M+174+i*113
    photo(name,x,262,105,174)
    txt(label,x,448,10,True)
rule(480)
badge('01','원본을 넣고',501)
para('이미지 편집이 가능한 AI 도구에 기준 제품 사진을 첨부합니다.',M+28,521,width=CW-28,size=11,leading=16)
badge('02','고정할 조건을 적고',558)
para('모양·비율·재질·색은 유지하고 배경·조명·구도를 바꿉니다.',M+28,578,width=CW-28,size=11,leading=16)
badge('03','세 컷을 만들어 대조하세요',615)
para('제품이 같은지 확인한 뒤, 검수한 이미지만 짧은 광고로 연결합니다.',M+28,635,width=CW-28,size=11,leading=16)
rect(M,687,CW,85,LIGHT)
para('이번 예시의 원본과 결과는 모두 AI로 만든 가상 머그컵 이미지입니다. 실제 상품의 성능이나 정확한 재현을 보증하지 않습니다. 생성된 사진을 후편집해 세로 광고로 구성했으며, 동영상의 새 카메라 시점을 생성한 사례는 아닙니다.',M+14,701,width=CW-28,size=9.2,leading=13.5,color=GRAY)
c.showPage()

header(2,'PREPARE + PROMPT')
txt('먼저, 바꾸지 않을 것을',M,80,28,True)
txt('분명히 적으세요.',M,116,28,True,BLUE)
para('사진 첨부 → 미리보기 확인 → 요청문 붙여넣기 → 생성 순서로 진행합니다.<br/>도구마다 버튼 이름과 지원 비율은 다르므로 해당 도구의 표시를 확인하세요.',M,163,size=11,leading=17)
rect(M,217,CW,69,LIGHT)
txt('준비할 것',M+15,231,11,True)
para('제품 전체가 보이는 사진 1장 · 이미지 편집 AI 도구 · 이 요청문<br/>직접 촬영했거나 사용할 권리가 있는 사진을 준비하세요.',M+15,252,width=CW-30,size=10.2,leading=15,color=GRAY)
txt('공통 요청문',M,317,15,True)
para('아래 문장을 사진과 함께 보내세요. [제품]만 내 제품으로 바꾸면 됩니다.',M,344,size=10.5,leading=15,color=GRAY)
rect(M,378,CW,259,HexColor('#F5F7FF'))
rect(M,378,3,259,BLUE)
prompt=('첨부한 사진은 [제품]의 기준 사진입니다.<br/><br/>'
'이 제품의 광고 이미지 3장을 각각 따로 만들어 주세요. 콜라주가 아니라 컷별 독립 이미지가 필요합니다.<br/><br/>'
'제품의 모양, 비율, 재질, 색을 유지하세요. 손잡이·뚜껑·연결부의 개수와 위치도 원본과 같아야 합니다. 원본에서 확인할 수 없는 부품이나 기능을 새로 만들지 마세요.<br/><br/>'
'무지 표면과 라벨은 그대로 비우고, 글자·가격·로고를 새로 넣지 마세요. 바꿀 것은 배경, 조명, 제품을 보여주는 각도입니다.<br/><br/>'
'전체 모습, 디테일, 사용하는 장면을 한 장씩 만들어 주세요. 같은 제품을 촬영한 것처럼 색과 조명 분위기를 통일하세요.')
para(prompt,M+17,395,width=CW-34,size=10.6,leading=15.1)
txt('한 번에 세 장이 나오지 않으면',M,665,13,True)
para('같은 사진과 공통 조건을 유지한 채 “전체 컷만 먼저 만들어 주세요”라고 요청합니다. 다음 페이지의 디테일·사용 장면 요청을 차례로 이어 보내세요.',M,690,size=10.7,leading=16)
para('전체 복사용 문장과 수정문은 함께 제공한 prompt.txt에 있습니다.',M,753,size=9.5,leading=14,color=BLUE)
c.showPage()

header(3,'THREE SHOTS')
txt('세 장, 서로 다른 역할.',M,80,30,True)
para('제품 설명을 세 번 반복하지 말고, 컷마다 한 가지 질문에 답하게 만드세요.',M,125,size=11,leading=17,color=GRAY)
shots=[('hero','01','전체','어떤 제품인가?',
'제품 전체가 보이는 3/4 정면 컷을 만들어 주세요. 단순한 배경과 자연스러운 그림자를 쓰고, 제품 윤곽이 잘리지 않게 해 주세요.',
'확인: 전체 형태 · 손잡이 위치 · 제품 비율'),
('detail','02','디테일','어떻게 생겼나?',
'원본에 보이는 손잡이와 표면 질감을 가까이 보여 주세요. 손잡이의 두께·곡률·연결 위치를 유지하고 부품을 새로 만들지 마세요.',
'확인: 연결부 · 표면 재질 · 두께'),
('lifestyle','03','사용 장면','언제 쓰나?',
'밝은 책상에서 성인의 한 손이 제품을 자연스럽게 잡는 장면을 만들어 주세요. 크기와 비율을 유지하고 손가락과 접촉 위치를 정확히 표현하세요.',
'확인: 손가락 · 잡는 위치 · 실제 사용 가능성')]
for i,(name,num,title,question,body,check) in enumerate(shots):
    top=177+i*195
    photo(name,M,top,123,154)
    x=M+143
    txt(num,x,top+1,11,True,BLUE)
    txt(title,x+28,top,17,True)
    txt(question,x,top+29,11,True)
    para(body,x,top+57,width=CW-143,size=10.6,leading=15.5)
    para(check,x,top+131,width=CW-143,size=9.2,leading=13,color=BLUE)
    if i<2:rule(top+173)
para('세로 광고가 목적이면 9:16을 요청하세요. 이 예시 사진은 약 4:5로 생성됐고,<br/>본편의 9:16 화면 안에 배치했습니다. 비율을 바꿀 때 제품이 잘리지 않는지 확인하세요.',M,765,size=9.1,leading=13,color=GRAY)
c.showPage()

header(4,'CHECK + EDIT')
txt('보기 좋다고, 바로 쓰지는',M,80,27,True)
txt('마세요. 원본과 확인하세요.',M,116,27,True,BLUE)
para('각 결과를 같은 기준 사진 옆에 놓고, 아래 항목을 한 번씩 확인합니다.',M,163,size=11,leading=17,color=GRAY)
checks=[('모양과 구조','손잡이·뚜껑·연결부의 수와 위치가 같은가?'),('색과 재질','색이 달라지거나 광택이 과장되지 않았는가?'),('비율과 크기','컷마다 높이·두께·실제 크기가 달라지지 않았는가?'),('손과 접촉','손가락·관절·잡는 위치가 자연스러운가?'),('문자와 사실','없던 로고·인증·기능이 새로 생기지 않았는가?')]
for i,(a,b) in enumerate(checks):
    top=205+i*49
    c.setStrokeColor(BLUE);c.setLineWidth(.9);c.rect(M,H-top-11,10,10,fill=0,stroke=1)
    txt(a,M+23,top,11.5,True)
    txt(b,M+23,top+19,10,color=GRAY)
rect(M,465,CW,92,LIGHT)
txt('틀린 부분만 구체적으로 고쳐 달라고 요청하세요.',M+14,479,11,True)
para('“두 번째 결과의 손잡이가 원본보다 두꺼워졌습니다. 다시 첨부한 원본의 두께와 연결 위치로 맞춰 주세요. 나머지 배경과 조명은 유지하세요.”',M+14,506,width=CW-28,size=10.3,leading=15.5)
txt('확인한 컷만 광고로 연결하기',M,585,15,True)
txt('전체  →  디테일  →  사용 장면',M,615,18,True,BLUE)
para('각 컷을 1.5~2.5초로 시작해 제품을 볼 시간을 조절합니다. 약한 확대나 이동으로 시선을 잇고, 가격·상품명·혜택은 확인한 정보만 편집에서 넣으세요.',M,650,size=10.6,leading=16)
para('1080×1920 MP4로 출력한 뒤 끝까지 재생하세요. 휴대폰 크기에서 글자 잘림, 컷 속도, 말과 화면의 타이밍을 확인합니다. 출력 해상도가 원본의 세부 정보를 새로 만들어 주지는 않습니다.',M,704,size=10.1,leading=15.3,color=GRAY)
c.showPage()
c.save()

print(json.dumps({'pdf':str(BASE/'guide.pdf'),'pages':4,'bytes':(BASE/'guide.pdf').stat().st_size},ensure_ascii=False))
