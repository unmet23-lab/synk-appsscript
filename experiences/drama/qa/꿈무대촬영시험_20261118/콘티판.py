"""
꿈 무대 촬영 시험판 — 고른 시작 그림 12장을 영상 차례대로 한 장에 놓는 이미지 콘티 판.
컷마다 그림 아래에 컷 이름, 띠(기승전결), 대사, 구도를 적는다. 그림은 git 밖 .tmp/꿈무대촬영시험_20261118/정지/<컷>.png.

    python -I -X utf8 콘티판.py          (이 폴더에서) → .tmp/꿈무대촬영시험_20261118/_콘티판.jpg
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..'))
정지 = os.path.join(ROOT, '.tmp', '꿈무대촬영시험_20261118', '정지')
출력 = os.path.join(ROOT, '.tmp', '꿈무대촬영시험_20261118', '_콘티판.jpg')
표 = json.load(open(os.path.join(HERE, '컷표.json'), encoding='utf-8'))
자세히 = {c['cut']: c for c in 표['detail']}

W, H, 글높이, 열 = 800, 450, 132, 4
굵게 = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 30)
보통 = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 23)
작게 = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 20)


def 줄나눔(d, 글, 글꼴, 너비):
    줄, 지금 = [], ''
    for 자 in 글:
        if d.textlength(지금 + 자, font=글꼴) > 너비:
            줄.append(지금)
            지금 = 자
        else:
            지금 += 자
    return 줄 + ([지금] if 지금 else [])


컷들 = 표['seq']
행 = (len(컷들) + 열 - 1) // 열
판 = Image.new('RGB', (열 * W + (열 + 1) * 16, 행 * (H + 글높이) + (행 + 1) * 16), (246, 244, 240))
d = ImageDraw.Draw(판)
for i, (컷, 시각, 띠, 줄) in enumerate(컷들):
    x = 16 + (i % 열) * (W + 16)
    y = 16 + (i // 열) * (H + 글높이 + 16)
    p = os.path.join(정지, f'{컷}.png')
    if os.path.exists(p):
        im = Image.open(p).convert('RGB')
        im.thumbnail((W, H))
        판.paste(im, (x, y))
    else:
        d.rectangle([x, y, x + W, y + H], fill=(210, 206, 200))
        d.text((x + 24, y + H // 2 - 16), '다시 굽는 중', font=굵게, fill=(90, 90, 90))
    d.text((x + 4, y + H + 8), f'{i + 1}. {컷} · {띠}', font=굵게, fill=(20, 20, 20))
    대사 = 줄나눔(d, 줄, 보통, W - 8)[:2]
    for k, t in enumerate(대사):
        d.text((x + 4, y + H + 48 + k * 28), t, font=보통, fill=(40, 40, 40))
    구도 = 줄나눔(d, 자세히[컷]['구도'], 작게, W - 8)[:1]
    if 구도 and len(대사) < 2:
        d.text((x + 4, y + H + 48 + 28), 구도[0], font=작게, fill=(110, 110, 110))
판.save(출력, quality=90)
print(출력, 판.size)
