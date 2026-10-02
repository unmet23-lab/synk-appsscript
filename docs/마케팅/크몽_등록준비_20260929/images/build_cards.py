"""Create local Kmong cover cards. No browser, network, or publication steps."""
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
W, H, SCALE = 652, 488, 3
INK = '#10131A'
CARDS = [
    dict(id='01_구글시트_AI_업무자동화', bg='#F0F4FC', accent='#3D6BC9', soft='#C5D6F5',
         eyebrow='업무 도구 제작', title=['구글시트 AI', '업무 자동화'], size=54,
         sub='문의 정리 · 답변 초안', labels=['구글시트', '문의 정리', '답변 초안'], mode='workflow'),
    dict(id='02_내업무로_배우는_AI실습', bg='#EDF6F0', accent='#25674C', soft='#BCE2CC',
         eyebrow='온라인 실습', title=['내 업무로 배우는', 'AI 실습'], size=49,
         sub='온라인 1대1 · 업무 템플릿', labels=['내 업무', '함께 실습', '내 템플릿'], mode='practice'),
    dict(id='03_의류_AI모델컷_룩북', bg='#F9EFF2', accent='#8D3955', soft='#ECC2CF',
         eyebrow='패션 이미지 제작', title=['의류 AI 모델컷', '룩북'], size=52,
         sub='제품 사진 기반 · 가상 모델 이미지', labels=['제품 사진', 'AI 모델컷', '룩북'], mode='fashion'),
]

ALL_TEXT = '유코' + ''.join(c['eyebrow'] + ''.join(c['title']) + c['sub'] + ''.join(c['labels']) for c in CARDS)
FONTS = {'heavy': 'SUIT-Heavy.otf', 'medium': 'SUIT-Medium.otf', 'semibold': 'SUIT-SemiBold.otf'}
FONT_CSS = []
for name, file in FONTS.items():
    font = TTFont(FONT_DIR / file)
    missing = sorted(set(ALL_TEXT) - set(map(chr, font.getBestCmap())))
    missing = [ch for ch in missing if not ch.isspace()]
    if missing:
        raise RuntimeError(f'Missing glyphs in {file}: {missing}')
    options = subset.Options()
    options.flavor = 'woff2'
    sub = subset.Subsetter(options=options)
    sub.populate(text=ALL_TEXT)
    sub.subset(font)
    font.flavor = 'woff2'
    stream = BytesIO()
    font.save(stream)
    data = base64.b64encode(stream.getvalue()).decode('ascii')
    FONT_CSS.append(f"@font-face{{font-family:'Card-{name}';src:url(data:font/woff2;base64,{data}) format('woff2');}}")


class Canvas:
    def __init__(self, bg):
        self.image = Image.new('RGB', (W * SCALE, H * SCALE), bg)
        self.draw = ImageDraw.Draw(self.image)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
                    '<style>' + ''.join(FONT_CSS) + '</style>',
                    f'<rect width="{W}" height="{H}" fill="{bg}"/>']
        self.bounds = []

    def rect(self, box, fill, radius=0, stroke=None, width=1):
        x0, y0, x1, y1 = box
        scaled = tuple(round(v * SCALE) for v in box)
        self.draw.rounded_rectangle(scaled, radius=radius * SCALE, fill=fill, outline=stroke, width=width * SCALE)
        self.svg.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="{radius}" fill="{fill}"'
                        + (f' stroke="{stroke}" stroke-width="{width}"' if stroke else '') + '/>')

    def line(self, points, fill, width=2):
        self.draw.line([(int(x*SCALE), int(y*SCALE)) for x, y in points], fill=fill, width=width*SCALE, joint='curve')
        self.svg.append('<polyline points="' + ' '.join(f'{x},{y}' for x,y in points) + f'" fill="none" stroke="{fill}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>')

    def text(self, x, baseline, value, size, face='medium', fill=INK, anchor='start'):
        font = ImageFont.truetype(str(FONT_DIR / FONTS[face]), size * SCALE)
        length = self.draw.textlength(value, font=font) / SCALE
        start_x = x - (length/2 if anchor == 'middle' else length if anchor == 'end' else 0)
        self.draw.text((round(start_x * SCALE), round(baseline * SCALE)), value, font=font, fill=fill, anchor='ls')
        b = self.draw.textbbox((round(start_x*SCALE), round(baseline*SCALE)), value, font=font, anchor='ls')
        b = tuple(v/SCALE for v in b)
        self.bounds.append({'text':value, 'bounds':b})
        if not (b[0] >= 50 and b[1] >= 50 and b[2] <= W-50 and b[3] <= H-50):
            raise ValueError(f'Unsafe text bounds: {value}: {b}')
        self.svg.append(f'<text x="{x}" y="{baseline}" text-anchor="{anchor}" font-family="Card-{face}" font-size="{size}" fill="{fill}">{html.escape(value)}</text>')
        return length

    def finish(self, name):
        self.image.resize((W, H), Image.Resampling.LANCZOS).save(OUT / f'{name}.png')
        (OUT / f'{name}.svg').write_text('\n'.join(self.svg + ['</svg>']), encoding='utf-8')
        return self.bounds


report = {}
for card in CARDS:
    canvas = Canvas(card['bg'])
    canvas.text(56, 76, card['eyebrow'], 18, 'semibold', card['accent'])
    canvas.text(596, 76, '유코', 19, 'heavy', INK, 'end')
    # Paper marker and restrained embossing use the scrapbook palette without fake stitching.
    marker_width = min(430, len(card['title'][1]) * card['size'] * .82 + 34)
    canvas.rect((53, 218, 53 + marker_width, 238), card['soft'], 8)
    canvas.text(56, 169, card['title'][0], card['size'], 'heavy')
    canvas.text(56, 236, card['title'][1], card['size'], 'heavy')
    canvas.text(56, 284, card['sub'], 23, 'semibold', '#414750')
    canvas.rect((56, 330, 596, 435), card['soft'], 20)
    canvas.rect((56, 325, 596, 430), '#FFFFFF', 20)
    centers = [139, 326, 513]
    for i, (cx, label) in enumerate(zip(centers, card['labels'])):
        # Abstract document shapes, clearly not a screenshot or a delivered product sample.
        if card['mode'] == 'fashion' and i == 0:
            canvas.rect((cx-15, 343, cx+15, 371), card['bg'], 5, card['accent'], 2)
            canvas.line([(cx-9,365),(cx-2,358),(cx+4,362),(cx+10,353)], card['accent'], 2)
        elif card['mode'] == 'practice' and i == 1:
            canvas.rect((cx-17, 343, cx+17, 368), card['bg'], 6, card['accent'], 2)
            canvas.line([(cx-8,368),(cx-8,374),(cx-1,368)], card['accent'], 2)
            canvas.line([(cx-9,353),(cx+9,353)], card['accent'], 2)
            canvas.line([(cx-9,360),(cx+3,360)], card['accent'], 2)
        else:
            canvas.rect((cx-15, 342, cx+15, 372), card['bg'], 5, card['accent'], 2)
            canvas.line([(cx-8,351),(cx+8,351)], card['accent'], 2)
            canvas.line([(cx-8,357),(cx+8,357)], card['accent'], 2)
            canvas.line([(cx-8,363),(cx+4,363)], card['accent'], 2)
        canvas.text(cx, 407, label, 20, 'semibold', INK, 'middle')
    for x in [224, 411]:
        canvas.line([(x-9,370),(x+9,370)], card['accent'], 2)
        canvas.line([(x+3,364),(x+9,370),(x+3,376)], card['accent'], 2)
    report[card['id']] = canvas.finish(card['id'])

# Side-by-side half-size proof for the list/thumbnail consumption size.
proof = Image.new('RGB', (326*3, 244), '#FFFFFF')
for i, card in enumerate(CARDS):
    with Image.open(OUT / (card['id'] + '.png')) as im:
        proof.paste(im.resize((326,244), Image.Resampling.LANCZOS), (326*i,0))
proof.save(OUT / 'QA_축소보기_326x244.png')
(OUT / 'QA_글자영역.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'created':[c['id']+'.png' for c in CARDS], 'size':[W,H], 'text_safe_margin':50, 'font_glyphs':'passed'}, ensure_ascii=False))
