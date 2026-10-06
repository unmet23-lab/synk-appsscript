# -*- coding: utf-8 -*-
"""qa/play.cjs가 찍은 화면으로 한 판 요약 시트를 만든다(다른 키트 게임의 qa/한판_*.jpg와 같은 꼴).
쓰는 법: python experiences/korean-racing/qa/sheets.py   → qa/한판_컴퓨터.jpg · qa/한판_휴대폰.jpg · qa/한판_320.jpg · qa/한판_움직임줄이기.jpg"""
import glob
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots')
FONT = ImageFont.truetype(r'C:\Windows\Fonts\malgunbd.ttf', 30)
BG = (243, 234, 223)


def find(scene, label):
    hit = sorted(glob.glob(os.path.join(SHOTS, f'play_{scene}_*_{label}.png')))
    return hit[0] if hit else None


def sheet(out, panels, scale, cols):
    ims = [(title, Image.open(path).convert('RGB')) for title, path in panels if path]
    w, h = ims[0][1].size
    tw, th = int(w * scale), int(h * scale)
    pad, head = 16, 52
    rows = (len(ims) + cols - 1) // cols
    canvas = Image.new('RGB', (pad + cols * (tw + pad), pad + rows * (th + head + pad)), BG)
    draw = ImageDraw.Draw(canvas)
    for i, (title, im) in enumerate(ims):
        x, y = pad + (i % cols) * (tw + pad), pad + (i // cols) * (th + head + pad)
        draw.text((x + 2, y + 6), title, font=FONT, fill=(43, 35, 32))
        canvas.paste(im.resize((tw, th), Image.LANCZOS), (x, y + head))
    canvas.save(os.path.join(HERE, out), 'JPEG', quality=86)
    print(out, canvas.size)


ORDER = [('입구', 'lobby'), ('문제 듣기', 'question_listening'), ('답 차선 고르기', 'question_choose'), ('글로 보기', 'text_help'),
         ('맞힘', 'right'), ('틀림', 'wrong'), ('완주 뒤 드라이브', 'cruise'), ('결과', 'results')]
sheet('한판_컴퓨터.jpg', [(t, find('desktop', k)) for t, k in [('입구', 'lobby'), ('코스 고르기', 'courses'), ('조작 연습', 'tutorial_choose')] + ORDER[1:]]
      + [('공통 차고', os.path.join(SHOTS, 'play_garage_desktop_01_equipped.png'))], .5, 4)
sheet('한판_휴대폰.jpg', [(t, find('phone', k)) for t, k in ORDER] + [('공통 차고', os.path.join(SHOTS, 'play_garage_phone_01_equipped.png'))], .5, 9)
sheet('한판_320.jpg', [(t, find('small', k)) for t, k in ORDER], .5, 8)
sheet('한판_움직임줄이기.jpg', [(t, find('reduced', k)) for t, k in ORDER], .5, 4)
