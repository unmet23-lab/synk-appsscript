# 실험 화면을 한 장으로 모은다 — python -X utf8 한장.py <폴더> <출력.jpg> [꼬리(없음|_폰)]
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont

폴더, 출력 = sys.argv[1], sys.argv[2]
꼬리 = sys.argv[3] if len(sys.argv) > 3 else ''
파일들 = sorted(f for f in glob.glob(os.path.join(폴더, '*.png'))
             if (f.endswith(f'{꼬리}.png') if 꼬리 else not (f.endswith('_전체.png') or f.endswith('_폰.png'))))
w, h = (300, 650) if 꼬리 == '_폰' else (640, 400)
열 = 6 if 꼬리 == '_폰' else 3
행 = (len(파일들) + 열 - 1) // 열
판 = Image.new('RGB', (w * 열, (h + 28) * 행), 'white')
그리기 = ImageDraw.Draw(판)
try:
    글꼴 = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 18)
except OSError:
    글꼴 = ImageFont.load_default()
for i, f in enumerate(파일들):
    그림 = Image.open(f).convert('RGB')
    그림 = 그림.crop((0, 0, 그림.width, min(그림.height, int(그림.width * h / w)))).resize((w, h))
    x, y = (i % 열) * w, (i // 열) * (h + 28)
    판.paste(그림, (x, y + 28))
    그리기.text((x + 6, y + 4), os.path.basename(f), fill='black', font=글꼴)
판.save(출력, quality=85)
print(출력, len(파일들))
