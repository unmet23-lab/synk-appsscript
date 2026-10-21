from pathlib import Path
import json, re, html, hashlib, sys, argparse
from PIL import Image
from fontTools.ttLib import TTFont as FTFont
from fontTools.varLib.instancer import instantiateVariableFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.utils import ImageReader

sys.stdout.reconfigure(encoding='utf-8')
BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[3]
OUT=BASE/'output-20261007'
ASSETS=BASE/'assets'; ASSETS.mkdir(exist_ok=True)
W,H=595.276,841.89
M=40; CW=W-M*2
INK='#10131A'; MUTED='#565A61'; BLUE='#24448C'; LINE='#D6DBE3'
PALETTE={'LAB':'#AE322A','SHIFT':'#24448C','PULSE':'#863369','PATH':'#28614C','WORLD':'#24448C','SYNK':'#24448C'}
SOURCE_TARGETS=[
 'docs/마케팅_정본.md','docs/엔진8종_상향설계_v3.md','docs/SYNK_플랫폼_계정과_연결_설계.md',
 'docs/정본/SYNK 보안/SYNK_사업계획서.txt','docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/02_학생_복지_프로그램.txt',
 'C:/Users/q1212/OneDrive/Desktop/bm 설계표/99_이전자료/20261005_정리전',
 'docs/BM_목록.md','docs/디자인/싱크타운_생활경제와_상품_설계.md','docs/_ops/결정.md',
 'docs/유지비_BM/회사전체_권리등록_출시_제작비_20261001.md','docs/유지비_BM/법인설립_비용_20261001.md',
 'docs/유지비_BM/학원_개원_예산과_준비기간_20261001.md','docs/마케팅/크몽_3개서비스_등록초안_20260929.md',
 'docs/마케팅/SHIFT.md','docs/사업발전_정본.md']

def setup_fonts():
    for weight in (400,500,600,800):
        dest=ASSETS/f'SUIT-{weight}.ttf'
        if not dest.exists():
            f=FTFont(ROOT/'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2')
            f=instantiateVariableFont(f,{'wght':weight},inplace=True)
            f.flavor=None; f.save(dest)
            f=FTFont(dest)
            for rec in f['name'].names:
                if rec.nameID in (1,2,4,6):
                    val={1:f'SUIT BM {weight}',2:'Regular',4:f'SUIT BM {weight}',6:f'SUIT-BM-{weight}'}[rec.nameID]
                    rec.string=val.encode(rec.getEncoding())
            f.save(dest)
        pdfmetrics.registerFont(TTFont(f'SUIT{weight}',str(dest)))
    for suffix,source in [('500','Medium'),('700','Bold')]:
        pdfmetrics.registerFont(TTFont('Inter'+suffix,str(ROOT/f'docs/브랜드_폰트/InterTight/InterTight-{source}.ttf')))
    pdfmetrics.registerFont(TTFont('Mono',str(ROOT/'docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf')))
    pdfmetrics.registerFont(TTFont('Bracket',str(ROOT/'docs/브랜드_폰트/SYNKBracket/SYNKBracket-Regular.ttf')))

def rich(text,weight=500):
    # Explicit font per glyph: Hangul SUIT, Latin/numbers/monetary symbols Inter.
    chunks=[]; last=None; buf=''
    for ch in str(text):
        code=ord(ch)
        it='Inter700' if weight>=600 else 'Inter500'
        font='Bracket' if ch in '「」' else it if code in pdfmetrics.getFont(it).face.charToGlyph else f'SUIT{weight}'
        if font!=last and buf:
            chunks.append(f'<font name="{last}">{html.escape(buf)}</font>'); buf=''
        last=font; buf+=ch
    if buf: chunks.append(f'<font name="{last}">{html.escape(buf)}</font>')
    return ''.join(chunks).replace('\n','<br/>')

def para(text,size=10.3,leading=None,color=INK,weight=500):
    return Paragraph(rich(text,weight),ParagraphStyle('p',fontName=f'SUIT{weight}',fontSize=size,leading=leading or size*1.48,textColor=HexColor(color),wordWrap='CJK',splitLongWords=True,spaceAfter=0))

class Book:
    def __init__(self,pages):
        self.pages=pages; self.c=canvas.Canvas(str(OUT/'SYNK_BM_20261007.pdf'),pagesize=(W,H),pageCompression=1)
        self.c.setTitle('SYNK 사업모델 | 상품·가격·수익·실행'); self.c.setAuthor('SYNK')
        self.boxes=[]; self.y=0; self.n=0

    def p(self,text,x,y,w,size=10.3,leading=None,color=INK,weight=500):
        p=para(text,size,leading,color,weight); _,h=p.wrap(w,H)
        p.drawOn(self.c,x,H-y-h)
        self.boxes.append({'page':self.n,'x':x,'y':y,'w':w,'h':h,'text':str(text)})
        return h

    def image(self,path,x,y,w,h=None):
        im=Image.open(path); iw,ih=im.size
        if h is None: h=w*ih/iw
        self.c.drawImage(ImageReader(im),x,H-y-h,width=w,height=h,mask='auto',preserveAspectRatio=True,anchor='c')

    def label(self,text,x,y,color=BLUE,size=9):
        self.c.setFont('Mono',size); self.c.setFillColor(HexColor(color)); self.c.drawString(x,H-y-size,text)

    def header(self,page,n):
        self.n=n; self.pageid=page['id']; self.brand=page.get('brand','SYNK'); self.accent=PALETTE[self.brand]
        self.label('SYNK / BUSINESS MODEL',M,26,INK,8)
        self.label('2026.10.07 / V2.1',W-163,26,MUTED,8)
        self.label(page.get('kicker','BUSINESS REVIEW'),M,65,self.accent,9)
        self.y=85
        title=page['title']; fs=28 if len(title)<24 else 25
        self.y+=self.p(title,M,self.y,CW,fs,fs*1.24,INK,800)+12
        if page.get('lead'):
            self.y+=self.p(page['lead'],M,self.y,CW,11.2,17.3,MUTED)+14
        self.c.bookmarkPage(page['id']); self.c.addOutlineEntry(page['title'],page['id'],0)

    def footer(self,page):
        # Real embroidered thread, small and undistorted.
        path=ROOT/'docs/디자인/SNS키트/assets/thread-lapis-soft.webp'
        # Show only the straight top edge of the approved stitched frame.
        for j in range(7):
            self.c.saveState(); clip=self.c.beginPath(); clip.rect(M+j*78.5,H-800,min(78.5,CW-j*78.5),9);self.c.clipPath(clip,stroke=0)
            self.image(path,M-23+j*78.5,784,125.4,125.4)
            self.c.restoreState()
        self.label('SYNK / INTERNAL WORKING DOCUMENT',M,812,MUTED,7)
        self.label(f'{self.n:02d} / {len(self.pages):02d}',W-M-45,810,INK,9)

    def section(self,text):
        self.y+=7
        self.y+=self.p(text,M,self.y,CW,13,18,INK,800)+6

    def paragraph(self,text,size=10.3,color=INK):
        self.y+=self.p(text,M,self.y,CW,size,color=color)+7

    def table(self,headers,rows,widths=None,size=9.5,x=None,width=None):
        x=M if x is None else x; width=CW if width is None else width
        ws=[width*w/sum(widths) for w in (widths or [1]*len(headers))]
        data=[[para(x,size,13.5,INK,600) for x in headers]]
        data += [[para(x,size,13.5,INK,500) for x in row] for row in rows]
        t=Table(data,colWidths=ws,hAlign='LEFT')
        cmds=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('BACKGROUND',(0,0),(-1,0),HexColor('#F0F4FC')),('LINEBELOW',(0,0),(-1,0),.8,HexColor(self.accent))]
        for r in range(1,len(data)):
            cmds.append(('LINEBELOW',(0,r),(-1,r),.35,HexColor(LINE)))
        t.setStyle(TableStyle(cmds)); _,ht=t.wrap(width,H)
        t.drawOn(self.c,x,H-self.y-ht)
        if getattr(self,'pageid',None)=='sources':
            yy=H-self.y-t._rowHeights[0]
            for rh,target in zip(t._rowHeights[1:],SOURCE_TARGETS):
                file=(ROOT/target).resolve(); assert file.exists(),file
                self.c.linkURL(file.as_uri(),(x,yy-rh,x+width,yy),relative=0,thickness=0)
                yy-=rh
        self.boxes.append({'page':self.n,'x':x,'y':self.y,'w':width,'h':ht,'text':'TABLE '+str(headers)})
        self.y+=ht+8

    def table_pair(self,items):
        start=self.y; ends=[]; width=(CW-20)/2
        for j,it in enumerate(items):
            x=M+j*(width+20); self.y=start
            self.y+=self.p(it['title'],x,self.y,width,12,17,INK,800)+9
            self.table(it['headers'],it['rows'],it.get('widths'),9.1,x,width)
            if it.get('note'):self.y+=self.p(it['note'],x,self.y,width,9.3,14,MUTED)
            ends.append(self.y)
        self.y=max(ends)+15

    def economics_chart(self,rows):
        self.p('유료 1건 직접비 / 유료 1명당 무료 이용자',M,self.y,280,8.7,12,MUTED)
        self.p('고정비 회수에 보태는 금액',W-M-135,self.y,135,8.7,12,MUTED)
        self.y+=23
        for i,row in enumerate(rows):
            self.p(row[0]+' / '+row[1],M,self.y+3,158,9.5,14)
            val=int(row[2].replace(',','').replace('원',''))
            x=M+171; barw=252*val/5000
            self.c.setFillColor(HexColor(BLUE if i==1 else '#C5D6F5'))
            self.c.roundRect(x,H-self.y-18,max(3,barw),14,2,stroke=0,fill=1)
            self.p(row[2],M+433,self.y+2,82,10,14,INK,600)
            self.y+=26
        self.y+=8

    def callout(self,title,text):
        p=para(text,10.1,15.2); _,ph=p.wrap(CW-30,H)
        h=ph+45
        self.c.setFillColor(HexColor('#F0F4FC')); self.c.roundRect(M,H-self.y-h,CW,h,5,fill=1,stroke=0)
        self.c.setFillColor(HexColor('#FFE07A')); self.c.saveState(); self.c.translate(M+16,H-self.y+3);self.c.rotate(-3);self.c.rect(0,0,43,9,fill=1,stroke=0);self.c.restoreState()
        self.p(title,M+15,self.y+13,CW-30,10.5,15,self.accent,800)
        self.p(text,M+15,self.y+35,CW-30,10.1,15.2)
        self.y+=h+12

    def columns(self,items):
        gap=20; w=(CW-gap)/2
        heights=[]
        for j,it in enumerate(items):
            x=M+j*(w+gap); yy=self.y
            yy+=self.p(it['title'],x,yy,w,12,17,INK,800)+7
            yy+=self.p(it['text'],x,yy,w,10,15)
            heights.append(yy-self.y)
        self.y+=max(heights)+14

    def sources(self,page):
        if page.get('sources'):
            text='근거  '+ ' · '.join(page['sources'])
            self.y+=6
            self.y+=self.p(text,M,self.y,CW,8.1,11.5,MUTED)+7

    def cover(self,page):
        self.n=1; self.brand='SYNK'; self.accent=BLUE
        self.image(ROOT/'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Ink.png',M,30,83)
        self.label('BUSINESS MODEL / 2026.10.07',W-238,44,MUTED,8)
        self.p('SYNK\n사업모델',M,102,305,40,46,INK,800)
        self.p('무엇을 팔고,\n어떻게 수익을 남길 것인가',M,214,330,19,27,INK,600)
        self.image(ROOT/'docs/디자인/웹_단락이미지/20260919/shift-ai-workshop.png',382,102,162)
        self.label('PRODUCT / PRICE / MARGIN / NEXT',M,291,BLUE,8)
        self.y=315
        self.paragraph('개인화 엔진 Atlas를 중심으로 교육·기업 서비스·콘텐츠·생활 지원을 연결한다. 한국어는 첫 적용 분야다. 아래는 사업별 판매 단위와 지금 검증해야 할 숫자를 한 장에 모은 것이다.',10.6)
        self.table(['사업','판매 단위','지금 볼 숫자'],[
            ['LAB','정규 한국어 수강료','등록 인원 × 월 단가 - 실제 운영비'],
            ['SHIFT','한 업무의 개인화 도입·운영','도입·지원 시간과 반복 공급의 수익성'],
            ['PULSE','의뢰 제작 · 콘텐츠/IP','수정·생성·편집 시간을 포함한 원가'],
            ['PATH','상담·지원 건 · 제휴 연결','학생 지원료와 제휴 수수료를 분리'],
            ['WORLD','타운 정액 · AI/시험 · 기관 좌석','유료 1명당 잔액과 무료 이용 원가']
        ],[.7,1.3,2.1],9.5)
        self.callout('먼저 볼 결론','SHIFT는 한 업무부터 도입·운영하고 반복 공급·수익성 확인 뒤 API·라이선스로 확장한다. 학원과 WORLD는 등록·전환·반복비를 분리한다. 계획비 4,618만원은 일부 항목의 합계이며 전체 창업자금이 아니다.')
        self.paragraph('읽는 순서  회사 구조 02  ·  LAB 03–04  ·  SHIFT 05–06  ·  PULSE 07  ·  PATH 08  ·  WORLD 09–10  ·  비용·자금 11–12  ·  실행 13  ·  근거 14',8.9,MUTED)
        self.p('현행 기준 / 과거 가격안 / 이번 계산 예시를 구분했습니다.\n계산표는 의사결정용이며 실제 매출·청구·운영 성과를 뜻하지 않습니다.',M,self.y,CW,8.5,12,MUTED)
        self.y+=30

    def build(self):
        for i,page in enumerate(self.pages,1):
            if page.get('cover'): self.cover(page)
            else:
                self.header(page,i)
                for block in page.get('blocks',[]):
                    kind=block['type']
                    if kind=='heading':self.section(block['text'])
                    elif kind=='p':self.paragraph(block['text'],block.get('size',10.3),block.get('color',INK))
                    elif kind=='table':
                        if page['id']=='world_economics' and block['headers'][0]=='유료 직접비':self.economics_chart(block['rows'])
                        else:self.table(block['headers'],block['rows'],block.get('widths'),block.get('size',9.5))
                    elif kind=='callout':self.callout(block['title'],block['text'])
                    elif kind=='columns':self.columns(block['items'])
                    elif kind=='table_pair':self.table_pair(block['items'])
                self.sources(page)
            if self.y>779: raise ValueError(f"Page {i} overflow: {self.y:.1f} {page['title']}")
            print(i,page['title'],round(self.y,1))
            self.footer(page);self.c.showPage()
        self.c.save()
        (OUT/'layout.json').write_text(json.dumps(self.boxes,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output-dir',type=Path,default=OUT)
    args=parser.parse_args()
    OUT=args.output_dir.resolve(); OUT.mkdir(parents=True,exist_ok=True)
    setup_fonts()
    pages=json.loads((BASE/'book.json').read_text(encoding='utf-8'))
    Book(pages).build()
