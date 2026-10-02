"""Build informational cards for the AI product-ad listing; no generated product imagery."""
from pathlib import Path
from io import BytesIO
import base64
import html
import json

from PIL import Image, ImageDraw, ImageFont
from fontTools import subset
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent
FONT_DIR = OUT.parents[3] / 'docs' / '브랜드_폰트' / 'SUIT'
BG, ACCENT, SOFT, INK, MUTED = '#F3F0FA', '#654795', '#D9CEEF', '#10131A', '#414750'
FONTS = {'heavy': 'SUIT-Heavy.otf', 'semibold': 'SUIT-SemiBold.otf', 'medium': 'SUIT-Medium.otf'}
TEXTS = [
    '제품 광고 제작', '유코', '제품 사진으로 만드는', 'AI 광고 이미지·영상',
    '제품 이미지부터 짧은 홍보 영상까지', '제품 사진', '광고 이미지', '숏폼 영상',
    'AI 제품 광고 · 안내 01', 'AI 제품 광고 · 안내 02', 'AI 제품 광고 · 안내 03',
    '제공 구성', '영상 1편과 광고용 정지 이미지를 함께.',
    'STANDARD', 'DELUXE', 'PREMIUM', '영상 10초 + 이미지 1컷', '영상 15초 + 이미지 3컷', '영상 30초 + 이미지 5컷',
    '모든 패키지 공통', '제품 1종 · 콘셉트 1종 · 화면비 1종',
    '화면비는 사용처에 맞춰 먼저 정합니다.',
    '제작 순서', '대표 이미지로 방향을 맞춘 뒤 영상으로.',
    '1', '2', '3', '4', '제품 자료 확인', '콘셉트·대표 이미지 확인', '영상 생성·편집', '제품·자막 검수',
    '제작 전 함께 정해요', '제품 특징 · 광고 문구 · 사용 채널',
    '준비 자료와', '제작 범위', '준비해 주세요', '제품 원본 사진 · 로고', '광고 문구 · 사용할 채널',
    '전달하는 파일', '광고 이미지 JPG·PNG', '숏폼 영상 MP4',
    '범위 확인', '실물 촬영·광고 집행은', '포함되지 않습니다.',
    '확인하고 완성합니다', '제품 형태·로고·자막을 원본과 비교합니다.',
]

CSS = []
for face, filename in FONTS.items():
    font = TTFont(FONT_DIR / filename)
    characters = ''.join(TEXTS)
    missing = [c for c in set(characters) - set(map(chr, font.getBestCmap())) if not c.isspace()]
    if missing:
        raise ValueError(f'Missing glyphs: {missing}')
    sub = subset.Subsetter(options=subset.Options())
    sub.populate(text=characters)
    sub.subset(font)
    font.flavor = 'woff2'
    buf = BytesIO()
    font.save(buf)
    CSS.append(f"@font-face{{font-family:'Ads-{face}';src:url(data:font/woff2;base64,{base64.b64encode(buf.getvalue()).decode()}) format('woff2');}}")


class Canvas:
    def __init__(self, width, height, margin, scale=2):
        self.w, self.h, self.m, self.s = width, height, margin, scale
        self.im = Image.new('RGB', (width*scale, height*scale), BG)
        self.d = ImageDraw.Draw(self.im)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
                    '<style>'+''.join(CSS)+'</style>', f'<rect width="{width}" height="{height}" fill="{BG}"/>']
        self.bounds = []

    def rect(self, box, fill, radius=0, stroke=None, width=1):
        x0, y0, x1, y1 = box
        self.d.rounded_rectangle(tuple(round(v*self.s) for v in box), radius=radius*self.s, fill=fill, outline=stroke, width=width*self.s)
        self.svg.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="{radius}" fill="{fill}"'
                        + (f' stroke="{stroke}" stroke-width="{width}"' if stroke else '') + '/>')

    def line(self, points, fill=ACCENT, width=2):
        self.d.line([(round(x*self.s),round(y*self.s)) for x,y in points], fill=fill, width=width*self.s, joint='curve')
        self.svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{fill}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>')

    def text(self, x, baseline, value, size, face='medium', fill=INK, anchor='start'):
        font = ImageFont.truetype(str(FONT_DIR/FONTS[face]), size*self.s)
        length = self.d.textlength(value,font=font)/self.s
        left = x-(length/2 if anchor=='middle' else length if anchor=='end' else 0)
        position = (round(left*self.s), round(baseline*self.s))
        box = tuple(v/self.s for v in self.d.textbbox(position, value, font=font, anchor='ls'))
        if not (box[0]>=self.m and box[1]>=self.m and box[2]<=self.w-self.m and box[3]<=self.h-self.m):
            raise ValueError(f'Unsafe text: {value} {box}')
        self.bounds.append({'text':value, 'bounds':box, 'size':size})
        self.d.text(position,value,font=font,fill=fill,anchor='ls')
        self.svg.append(f'<text x="{x}" y="{baseline}" text-anchor="{anchor}" font-family="Ads-{face}" font-size="{size}" fill="{fill}">{html.escape(value)}</text>')

    def panel(self, y, height):
        self.rect((80,y+7,920,y+height+7),SOFT,26)
        self.rect((80,y,920,y+height),'#FFFFFF',26)

    def header(self, number, title, subtitle):
        self.text(80,104,f'AI 제품 광고 · 안내 {number:02}',26,'semibold',ACCENT)
        self.text(920,104,'유코',27,'heavy',INK,'end')
        self.rect((80,194,366,217),SOFT,10)
        self.text(80,211,title,70,'heavy')
        self.text(80,269,subtitle,30,'medium',MUTED)

    def save(self, name):
        image = self.im.resize((self.w,self.h),Image.Resampling.LANCZOS)
        image.save(OUT/(name+'.png'))
        image.resize((self.w//2,self.h//2),Image.Resampling.LANCZOS).save(OUT/('QA_'+name+'_50pct.png'))
        (OUT/(name+'.svg')).write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8')
        return {'size':[self.w,self.h], 'mode':image.mode, 'safe_margin':self.m, 'text_bounds':self.bounds}


report = {}
c = Canvas(652,488,50,3)
c.text(56,76,'제품 광고 제작',18,'semibold',ACCENT)
c.text(596,76,'유코',19,'heavy',INK,'end')
c.text(56,169,'제품 사진으로 만드는',43,'heavy')
c.rect((53,220,527,240),SOFT,8)
c.text(56,236,'AI 광고 이미지·영상',49,'heavy')
c.text(56,284,'제품 이미지부터 짧은 홍보 영상까지',23,'semibold',MUTED)
c.rect((56,330,596,435),SOFT,20)
c.rect((56,325,596,430),'#FFFFFF',20)
for index,(cx,label) in enumerate([(139,'제품 사진'),(326,'광고 이미지'),(513,'숏폼 영상')]):
    c.rect((cx-17,344,cx+17,370),BG,5,ACCENT,2)
    if index<2:
        c.line([(cx-11,364),(cx-4,356),(cx+3,362),(cx+11,352)])
    else:
        c.line([(cx-4,351),(cx+5,357),(cx-4,364),(cx-4,351)])
    c.text(cx,407,label,20,'semibold',INK,'middle')
for x in [224,411]:
    c.line([(x-9,370),(x+9,370)])
    c.line([(x+3,364),(x+9,370),(x+3,376)])
report['main04_AI제품광고'] = c.save('main04_AI제품광고')

c = Canvas(1000,1200,80)
c.header(1,'제공 구성','영상 1편과 광고용 정지 이미지를 함께.')
for y,label,value in [(324,'STANDARD','영상 10초 + 이미지 1컷'),(496,'DELUXE','영상 15초 + 이미지 3컷'),(668,'PREMIUM','영상 30초 + 이미지 5컷')]:
    c.panel(y,146)
    c.text(116,y+45,label,25,'semibold',ACCENT)
    c.text(116,y+108,value,48,'heavy')
c.text(80,902,'모든 패키지 공통',27,'semibold',ACCENT)
c.text(80,960,'제품 1종 · 콘셉트 1종 · 화면비 1종',37,'heavy')
c.rect((80,1009,920,1109),'#FFFFFF',20)
c.text(116,1073,'화면비는 사용처에 맞춰 먼저 정합니다.',29,'semibold',MUTED)
report['detail_ads_01_제공구성'] = c.save('detail_ads_01_제공구성')

c = Canvas(1000,1200,80)
c.header(2,'제작 순서','대표 이미지로 방향을 맞춘 뒤 영상으로.')
for index,(y,label) in enumerate([(326,'제품 자료 확인'),(463,'콘셉트·대표 이미지 확인'),(600,'영상 생성·편집'),(737,'제품·자막 검수')],1):
    c.panel(y,109)
    c.rect((110,y+25,170,y+85),BG,16)
    c.text(140,y+71,str(index),32,'heavy',ACCENT,'middle')
    c.text(204,y+69,label,38,'heavy')
c.rect((80,938,920,1109),'#FFFFFF',24)
c.text(116,991,'제작 전 함께 정해요',28,'semibold',ACCENT)
c.text(116,1056,'제품 특징 · 광고 문구 · 사용 채널',36,'heavy')
report['detail_ads_02_제작순서'] = c.save('detail_ads_02_제작순서')

c = Canvas(1000,1200,80)
c.text(80,104,'AI 제품 광고 · 안내 03',26,'semibold',ACCENT)
c.text(920,104,'유코',27,'heavy',INK,'end')
c.text(80,207,'준비 자료와',68,'heavy')
c.rect((80,267,383,291),SOFT,10)
c.text(80,286,'제작 범위',68,'heavy')
c.panel(344,199)
c.text(116,393,'준비해 주세요',27,'semibold',ACCENT)
c.text(116,454,'제품 원본 사진 · 로고',40,'heavy')
c.text(116,508,'광고 문구 · 사용할 채널',40,'heavy')
c.panel(578,199)
c.text(116,627,'전달하는 파일',27,'semibold',ACCENT)
c.text(116,688,'광고 이미지 JPG·PNG',40,'heavy')
c.text(116,742,'숏폼 영상 MP4',40,'heavy')
c.rect((80,814,920,988),SOFT,24)
c.text(116,858,'범위 확인',27,'semibold',ACCENT)
c.text(116,912,'실물 촬영·광고 집행은',36,'heavy')
c.text(116,959,'포함되지 않습니다.',36,'heavy')
c.text(80,1036,'확인하고 완성합니다',27,'semibold',ACCENT)
c.text(80,1094,'제품 형태·로고·자막을 원본과 비교합니다.',33,'semibold',MUTED)
report['detail_ads_03_준비와범위'] = c.save('detail_ads_03_준비와범위')

proof = Image.new('RGB',(1500,600),'#FFFFFF')
for index,name in enumerate(list(report)[1:]):
    with Image.open(OUT/('QA_'+name+'_50pct.png')) as im:
        proof.paste(im,(index*500,0))
proof.save(OUT/'QA_ads_상세이미지_50pct.png')
(OUT/'QA_ads_글자영역.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'created':list(report), 'glyphs':'passed','bounds':'passed','color_mode':'RGB'},ensure_ascii=False))
