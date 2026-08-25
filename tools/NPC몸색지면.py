# -*- coding: utf-8 -*-
"""NPC 몸색 판정 지면 — A안 넷을 «정본(가드 켬)»과 «섬유 강제» 두 줄로 세운다.

두 물음이 한 지면에서 답되게 짠다:
  ① 이 몸색이 좋은가            → 윗줄 넷을 옆으로 훑는다
  ② 섬유 문턱을 올려도 되는가   → 같은 칸을 위아래로 본다(씻기면 문턱 유지가 옳다)
"""
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image, ImageDraw, ImageFont

루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # tools/ 의 위
밖 = os.path.join(루트, 'docs', '캐릭터', 'NPC공방_0824', '_몸색시안')

A안 = [('boss', 'Butter Soft', '사장님 — 보상의 버터'),
       ('prof', 'Lapis Soft', '교수님 — 안내의 라피스'),
       ('lead', 'Meadow Soft', '리드 — 정답의 메도우'),
       ('insp', 'Pop Soft', '검수 — 기념의 팝')]
크로마 = {'Butter Soft': 0.31, 'Lapis Soft': 0.19, 'Meadow Soft': 0.165, 'Pop Soft': 0.19}


def 글꼴(크기, 굵게=False):
    for 길 in ([r'C:\Windows\Fonts\malgunbd.ttf'] if 굵게 else []) + [r'C:\Windows\Fonts\malgun.ttf']:
        try:
            return ImageFont.truetype(길, 크기)
        except OSError:
            pass
    return ImageFont.load_default()


칸, 여백, 머리, 줄머리 = 420, 16, 128, 40
W = 여백 + (칸 + 여백) * 4
H = 머리 + (줄머리 + 칸 + 56) * 2 + 여백
장 = Image.new('RGB', (W, H), (17, 17, 19))
d = ImageDraw.Draw(장)
d.text((여백, 18), 'NPC 몸색 판정 — A안 넷 × (정본 · 섬유 강제)', font=글꼴(34, True), fill=(246, 246, 248))
d.text((여백, 64), '① 몸색을 고르실 때는 옆으로 훑으십시오.  ② 같은 칸을 위아래로 보시면 «섬유를 켰을 때 색이 씻기나»가 보입니다.',
       font=글꼴(19), fill=(168, 172, 182))
d.text((여백, 92), '지금 정본은 크로마 0.16 위에서 섬유를 끕니다 — A안 넷은 0.165~0.31 이라 윗줄은 «잔털만» 나온 판입니다.',
       font=글꼴(19), fill=(196, 168, 120))

for r, (꼬리, 줄이름, 설명) in enumerate([('_정본', '정본 (가드 켬 — 섬유 없음)', '지금 코드 그대로'),
                                        ('_섬유강제', '섬유 강제 (섬유문턱=1.0)', '문턱을 올렸을 때')]):
    y0 = 머리 + r * (줄머리 + 칸 + 56)
    d.text((여백, y0), f'{줄이름}', font=글꼴(23, True), fill=(235, 220, 160))
    d.text((여백 + 380, y0 + 3),설명, font=글꼴(18), fill=(150, 154, 164))
    for i, (역, 색, 뜻) in enumerate(A안):
        x = 여백 + i * (칸 + 여백)
        y = y0 + 줄머리
        p = os.path.join(밖, f'{역}_{색.replace(" ", "")}{꼬리}.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB')
            im.thumbnail((칸, 칸))
            장.paste(im, (x + (칸 - im.width) // 2, y + (칸 - im.height) // 2))
        else:
            d.text((x + 10, y + 칸 // 2), '(안 나옴)', font=글꼴(18), fill=(120, 120, 125))
        d.text((x, y + 칸 + 6), f'{역} · {색}', font=글꼴(20, True), fill=(225, 228, 236))
        d.text((x, y + 칸 + 32), f'{뜻}  (크로마 {크로마[색]})', font=글꼴(16), fill=(158, 162, 172))

os.makedirs(밖, exist_ok=True)   # 굽기 전에 지면만 그려 봐도 죽지 않게(칸은 「안 나옴」으로 뜬다)
낼곳 = os.path.join(밖, '_판정지면.png')
장.save(낼곳)
print('■ → %s (%dKB · %dx%d)' % (낼곳, os.path.getsize(낼곳) // 1024, W, H))
