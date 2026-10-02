"""Render informational AI clothing service cards locally, without browser access."""
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
W, H, S = 1000, 1200, 2
BG, ACCENT, SOFT, INK, MUTED = '#F9EFF2', '#8D3955', '#ECC2CF', '#10131A', '#414750'
FONTS = {'heavy':'SUIT-Heavy.otf', 'semibold':'SUIT-SemiBold.otf', 'medium':'SUIT-Medium.otf'}
STRINGS = [
    'AI 의류 이미지 · 안내 01','AI 의류 이미지 · 안내 02','AI 의류 이미지 · 안내 03','유코',
    '제공 구성','상품 수와 컷 수를 먼저 확인해 주세요.',
    '의류 1개','3컷','의류 2개','6컷','의류 3개','12컷',
    '공통 제공','가상 성인 모델 1명','JPG·PNG · 긴 변 2048px 이상',
    '품번·색상 1종을 상품 1개로 계산합니다.',
    '제작 순서','대표 컷으로 방향을 맞춘 뒤 완성합니다.',
    '1','2','3','4','제품 사진 확인','모델·배경 합의','상품별 대표 1컷 확인','나머지 제작·검수',
    '대표 컷은 최종 수량에 포함됩니다.','준비해 주세요','정면 사진','후면 사진','디테일 사진',
    '제작 범위와','품질 확인','제작하는 이미지','모델컷·룩북 정지 이미지',
    '원본과 비교','로고·패턴·소재는 원본과 비교합니다.',
    '수정 범위','밝기·색감·크롭 수정',
    '이용 전 확인','실제 피팅·정확한 핏을','증명하는 사진이 아닙니다.',
    '상세페이지 전체 디자인·영상은 별도입니다.'
]
CSS = []
for face, filename in FONTS.items():
    font = TTFont(FONT_DIR / filename)
    chars = ''.join(STRINGS)
    missing = sorted(set(chars) - set(map(chr, font.getBestCmap())))
    missing = [c for c in missing if not c.isspace()]
    if missing:
        raise ValueError(f'Missing font glyphs: {missing}')
    opt = subset.Options()
    sub = subset.Subsetter(options=opt)
    sub.populate(text=chars)
    sub.subset(font)
    font.flavor = 'woff2'
    buf = BytesIO()
    font.save(buf)
    CSS.append(f"@font-face{{font-family:'Detail-{face}';src:url(data:font/woff2;base64,{base64.b64encode(buf.getvalue()).decode()}) format('woff2');}}")


class Card:
    def __init__(self, number):
        self.im = Image.new('RGB', (W*S,H*S), BG)
        self.d = ImageDraw.Draw(self.im)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
                    '<style>'+''.join(CSS)+'</style>', f'<rect width="{W}" height="{H}" fill="{BG}"/>']
        self.bounds = []
        self.text(80,104,f'AI 의류 이미지 · 안내 {number:02}',26,'semibold',ACCENT)
        self.text(920,104,'유코',27,'heavy',INK,'end')

    def rect(self, box, fill, radius=0):
        x0,y0,x1,y1 = box
        self.d.rounded_rectangle(tuple(int(v*S) for v in box),radius=radius*S,fill=fill)
        self.svg.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="{radius}" fill="{fill}"/>')

    def panel(self, y, height):
        self.rect((80,y+7,920,y+height+7),SOFT,26)
        self.rect((80,y,920,y+height),'#FFFFFF',26)

    def text(self,x,baseline,value,size,face='medium',fill=INK,anchor='start'):
        font = ImageFont.truetype(str(FONT_DIR/FONTS[face]),size*S)
        length = self.d.textlength(value,font=font)/S
        left = x - (length/2 if anchor=='middle' else length if anchor=='end' else 0)
        pos = (round(left*S),round(baseline*S))
        bounds = tuple(v/S for v in self.d.textbbox(pos,value,font=font,anchor='ls'))
        if not (bounds[0]>=80 and bounds[1]>=80 and bounds[2]<=920 and bounds[3]<=1120):
            raise ValueError(f'Unsafe text: {value} {bounds}')
        self.bounds.append({'text':value,'bounds':bounds})
        self.d.text(pos,value,font=font,fill=fill,anchor='ls')
        self.svg.append(f'<text x="{x}" y="{baseline}" text-anchor="{anchor}" font-family="Detail-{face}" font-size="{size}" fill="{fill}">{html.escape(value)}</text>')

    def save(self,name):
        self.im.resize((W,H),Image.Resampling.LANCZOS).save(OUT/(name+'.png'))
        (OUT/(name+'.svg')).write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8')
        return self.bounds


report = {}

card = Card(1)
card.rect((80,193,365,217),SOFT,10)
card.text(80,211,'제공 구성',70,'heavy')
card.text(80,269,'상품 수와 컷 수를 먼저 확인해 주세요.',30,'medium',MUTED)
for y, item, count in [(324,'의류 1개','3컷'),(480,'의류 2개','6컷'),(636,'의류 3개','12컷')]:
    card.panel(y,132)
    card.text(124,y+85,item,44,'heavy')
    card.text(876,y+88,count,60,'heavy',ACCENT,'end')
card.text(80,854,'공통 제공',27,'semibold',ACCENT)
card.text(80,912,'가상 성인 모델 1명',37,'heavy')
card.text(80,967,'JPG·PNG · 긴 변 2048px 이상',35,'semibold')
card.rect((80,1010,920,1110),'#FFFFFF',20)
card.text(116,1074,'품번·색상 1종을 상품 1개로 계산합니다.',29,'semibold',MUTED)
report['detail01_제공구성'] = card.save('detail01_제공구성')

card = Card(2)
card.rect((80,193,365,217),SOFT,10)
card.text(80,211,'제작 순서',70,'heavy')
card.text(80,269,'대표 컷으로 방향을 맞춘 뒤 완성합니다.',30,'medium',MUTED)
for index,(y,label) in enumerate([(326,'제품 사진 확인'),(457,'모델·배경 합의'),(588,'상품별 대표 1컷 확인'),(719,'나머지 제작·검수')],1):
    card.panel(y,105)
    card.rect((110,y+24,168,y+82),BG,16)
    card.text(139,y+68,str(index),32,'heavy',ACCENT,'middle')
    card.text(201,y+67,label,38,'heavy')
card.text(80,897,'대표 컷은 최종 수량에 포함됩니다.',30,'semibold',MUTED)
card.rect((80,946,920,1113),'#FFFFFF',24)
card.text(114,995,'준비해 주세요',28,'semibold',ACCENT)
for x,label in [(114,'정면 사진'),(376,'후면 사진'),(638,'디테일 사진')]:
    card.rect((x,1021,x+246,1087),BG,15)
    card.text(x+123,1064,label,28,'semibold',INK,'middle')
report['detail02_제작순서'] = card.save('detail02_제작순서')

card = Card(3)
card.text(80,207,'제작 범위와',68,'heavy')
card.rect((80,267,382,291),SOFT,10)
card.text(80,286,'품질 확인',68,'heavy')
for y,label,value in [
    (345,'제작하는 이미지','모델컷·룩북 정지 이미지'),
    (514,'원본과 비교','로고·패턴·소재는 원본과 비교합니다.'),
    (683,'수정 범위','밝기·색감·크롭 수정')
]:
    card.panel(y,138)
    card.text(116,y+46,label,27,'semibold',ACCENT)
    card.text(116,y+101,value,34,'heavy')
card.rect((80,866,920,1055),SOFT,24)
card.text(116,914,'이용 전 확인',27,'semibold',ACCENT)
card.text(116,965,'실제 피팅·정확한 핏을',36,'heavy')
card.text(116,1013,'증명하는 사진이 아닙니다.',36,'heavy')
card.text(80,1110,'상세페이지 전체 디자인·영상은 별도입니다.',29,'semibold',MUTED)
report['detail03_범위와품질확인'] = card.save('detail03_범위와품질확인')

proof = Image.new('RGB',(1200,480),'#FFFFFF')
for index,name in enumerate(report):
    with Image.open(OUT/(name+'.png')) as im:
        proof.paste(im.resize((400,480),Image.Resampling.LANCZOS),(index*400,0))
proof.save(OUT/'QA_상세이미지_축소보기.png')
(OUT/'QA_상세이미지_글자영역.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Created 3 detail cards: 1000x1200 RGB, 80px text safe margins, SVG editable text with embedded fonts.')
