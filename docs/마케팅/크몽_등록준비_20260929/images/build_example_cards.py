"""Build clearly labelled, fictional Kmong service examples. No browser/network."""
from pathlib import Path
from io import BytesIO
import base64
import html
import json

from PIL import Image, ImageDraw, ImageFont
from fontTools import subset
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
FONT_DIR = ROOT / 'docs' / '브랜드_폰트' / 'SUIT'
W, H, S = 1000, 1200, 2
INK, MUTED = '#10131A', '#414750'
FONTS = {'heavy': 'SUIT-Heavy.otf', 'semibold': 'SUIT-SemiBold.otf', 'medium': 'SUIT-Medium.otf'}
DISCLAIMER = '이해를 돕는 가상 예시 · 실제 고객 사례 아님'
STRINGS = [
    '유코', 'AI 업무 자동화 · 결과 예시', 'AI 실무 교육 · 실습 예시',
    '문의가 들어오면', '이렇게 정리합니다', 'DELUXE 기준 · 구글 설문·시트 흐름',
    '문의 입력', '상품 A 20개를 주문하고 싶어요.', '금요일까지 받을 수 있나요?',
    '정리 결과', '요약', '상품 A 20개 · 금요일 수령 문의', '분류', '상품 주문 / 납기',
    '답변 초안', '재고와 배송 일정을 확인한 뒤', '가능 여부를 안내드리겠습니다.',
    '시트 저장', '문의·요약·분류·초안을 한 행에',
    '답변은 담당자가 확인한 뒤 보냅니다.',
    '수업 뒤에도 다시 쓰는', '업무 순서', '메모를 표로 바꾸고, 원문과 비교합니다.',
    '회의 메모', '민지는 금요일까지 시안 2개 준비.', '가격 확인 담당자는 아직 정하지 않음.',
    '할 일 표', '할 일', '담당', '기한', '시안 2개 준비', '민지', '금요일', '가격 확인', '미정',
    '함께 확인하고 다시 사용합니다', '숫자·기한은 원문과 비교', '없는 담당자는 임의로 채우지 않기',
    DISCLAIMER,
]
CSS = []
for face, filename in FONTS.items():
    font = TTFont(FONT_DIR / filename)
    chars = ''.join(STRINGS)
    missing = [c for c in set(chars) - set(map(chr, font.getBestCmap())) if not c.isspace()]
    if missing:
        raise ValueError(f'Missing glyphs: {missing}')
    sub = subset.Subsetter(options=subset.Options())
    sub.populate(text=chars)
    sub.subset(font)
    font.flavor = 'woff2'
    buf = BytesIO()
    font.save(buf)
    CSS.append(f"@font-face{{font-family:'Example-{face}';src:url(data:font/woff2;base64,{base64.b64encode(buf.getvalue()).decode()}) format('woff2');}}")


class Card:
    def __init__(self, label, bg, accent, soft):
        self.bg, self.accent, self.soft = bg, accent, soft
        self.im = Image.new('RGB', (W*S, H*S), bg)
        self.d = ImageDraw.Draw(self.im)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
                    '<style>'+''.join(CSS)+'</style>', f'<rect width="{W}" height="{H}" fill="{bg}"/>']
        self.bounds = []
        self.text(80,104,label,26,'semibold',accent)
        self.text(920,104,'유코',27,'heavy',INK,'end')

    def rect(self, box, fill, radius=0):
        x0,y0,x1,y1 = box
        self.d.rounded_rectangle(tuple(int(v*S) for v in box),radius=radius*S,fill=fill)
        self.svg.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="{radius}" fill="{fill}"/>')

    def line(self, points, fill, width=2):
        self.d.line([(round(x*S),round(y*S)) for x,y in points],fill=fill,width=width*S,joint='curve')
        self.svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{fill}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>')

    def panel(self, y, height, tape=False):
        self.rect((80,y+7,920,y+height+7),self.soft,26)
        self.rect((80,y,920,y+height),'#FFFFFF',26)
        if tape:
            self.rect((761,y-10,861,y+12),self.soft,3)

    def text(self,x,baseline,value,size,face='medium',fill=INK,anchor='start'):
        font = ImageFont.truetype(str(FONT_DIR/FONTS[face]),size*S)
        length = self.d.textlength(value,font=font)/S
        left = x - (length/2 if anchor=='middle' else length if anchor=='end' else 0)
        pos = (round(left*S),round(baseline*S))
        bounds = tuple(v/S for v in self.d.textbbox(pos,value,font=font,anchor='ls'))
        if not (bounds[0]>=80 and bounds[1]>=80 and bounds[2]<=920 and bounds[3]<=1125):
            raise ValueError(f'Unsafe text: {value} {bounds}')
        self.bounds.append({'text':value,'bounds':bounds,'fontSize':size})
        self.d.text(pos,value,font=font,fill=fill,anchor='ls')
        self.svg.append(f'<text x="{x}" y="{baseline}" text-anchor="{anchor}" font-family="Example-{face}" font-size="{size}" fill="{fill}">{html.escape(value)}</text>')

    def arrow(self):
        self.line([(500,531),(498,552),(504,565)],self.accent,5)
        self.line([(489,554),(504,565),(516,550)],self.accent,5)

    def save(self,name):
        output = self.im.resize((W,H),Image.Resampling.LANCZOS)
        output.save(OUT/(name+'.png'))
        (OUT/(name+'.svg')).write_text('\n'.join(self.svg+['</svg>']),encoding='utf-8')
        output.resize((W//2,H//2),Image.Resampling.LANCZOS).save(OUT/('QA_'+name+'_50pct.png'))
        return self.bounds


report = {}
card = Card('AI 업무 자동화 · 결과 예시','#F0F4FC','#3D6BC9','#C5D6F5')
card.text(80,193,'문의가 들어오면',60,'heavy')
card.rect((80,248,573,268),card.soft,8)
card.text(80,265,'이렇게 정리합니다',60,'heavy')
card.text(80,316,'DELUXE 기준 · 구글 설문·시트 흐름',30,'medium',MUTED)
card.panel(355,155,tape=True)
card.text(116,396,'문의 입력',26,'semibold',card.accent)
card.text(116,443,'상품 A 20개를 주문하고 싶어요.',36,'semibold')
card.text(116,488,'금요일까지 받을 수 있나요?',36,'semibold')
card.arrow()
card.panel(587,390)
card.text(116,632,'정리 결과',26,'semibold',card.accent)
card.text(116,690,'요약',27,'semibold',card.accent)
card.text(283,690,'상품 A 20개 · 금요일 수령 문의',31,'semibold')
card.line([(116,713),(884,713)],'#E1E8F4')
card.text(116,757,'분류',27,'semibold',card.accent)
card.text(283,757,'상품 주문 / 납기',32,'semibold')
card.line([(116,782),(884,782)],'#E1E8F4')
card.text(116,826,'답변 초안',27,'semibold',card.accent)
card.text(283,826,'재고와 배송 일정을 확인한 뒤',29,'semibold')
card.text(283,867,'가능 여부를 안내드리겠습니다.',29,'semibold')
card.line([(116,891),(884,891)],'#E1E8F4')
card.text(116,940,'시트 저장',27,'semibold',card.accent)
card.text(283,940,'문의·요약·분류·초안을 한 행에',29,'semibold')
card.text(80,1042,'답변은 담당자가 확인한 뒤 보냅니다.',32,'heavy')
card.text(80,1114,DISCLAIMER,28,'semibold',MUTED)
report['detail_automation_결과예시'] = card.save('detail_automation_결과예시')

card = Card('AI 실무 교육 · 실습 예시','#EDF6F0','#25674C','#BCE2CC')
card.text(80,193,'수업 뒤에도 다시 쓰는',59,'heavy')
card.rect((80,248,352,268),card.soft,8)
card.text(80,265,'업무 순서',60,'heavy')
card.text(80,316,'메모를 표로 바꾸고, 원문과 비교합니다.',30,'medium',MUTED)
card.panel(355,155,tape=True)
card.text(116,396,'회의 메모',26,'semibold',card.accent)
card.text(116,443,'민지는 금요일까지 시안 2개 준비.',35,'semibold')
card.text(116,488,'가격 확인 담당자는 아직 정하지 않음.',35,'semibold')
card.arrow()
card.panel(587,270)
card.text(116,632,'할 일 표',26,'semibold',card.accent)
card.rect((106,652,894,706),card.bg,12)
for x,label in [(126,'할 일'),(580,'담당'),(766,'기한')]:
    card.text(x,690,label,27,'semibold',card.accent)
card.text(126,756,'시안 2개 준비',34,'heavy')
card.text(580,756,'민지',34,'semibold')
card.text(766,756,'금요일',34,'semibold')
card.line([(116,779),(884,779)],'#DDEBE2')
card.text(126,830,'가격 확인',34,'heavy')
card.text(580,830,'미정',34,'semibold')
card.text(766,830,'미정',34,'semibold')
card.text(80,922,'함께 확인하고 다시 사용합니다',28,'semibold',card.accent)
for y,value in [(976,'숫자·기한은 원문과 비교'),(1025,'없는 담당자는 임의로 채우지 않기')]:
    card.line([(84,y-14),(93,y-5),(109,y-26)],card.accent,4)
    card.text(134,y,value,33,'heavy')
card.text(80,1114,DISCLAIMER,28,'semibold',MUTED)
report['detail_education_실습예시'] = card.save('detail_education_실습예시')

proof = Image.new('RGB',(1000,600),'#FFFFFF')
for index,name in enumerate(report):
    with Image.open(OUT/(name+'.png')) as im:
        proof.paste(im.resize((500,600),Image.Resampling.LANCZOS),(index*500,0))
proof.save(OUT/'QA_업무교육_예시_50pct.png')
(OUT/'QA_업무교육_예시_글자영역.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Created 2 fictional example cards: 1000x1200 RGB, embedded SUIT fonts, 50% previews, and safe text bounds.')
