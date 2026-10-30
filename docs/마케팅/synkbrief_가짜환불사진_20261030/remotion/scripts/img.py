# 영상용 사본 만들기(public/img/ — git 밖): python -I scripts/img.py
# 그림/ · 화면/(실제 제미나이 화면)에서 1080×1920 사진 판과 화면 조각을 만든다. 계정 사진(왼쪽 아래 동그라미)은 잘라 낸다.
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
HERE = Path(__file__).resolve().parent.parent
EP = HERE.parent
OUT = HERE / 'public' / 'img'
OUT.mkdir(parents=True, exist_ok=True)

def nine16(src, dst):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    tw = round(h * 9 / 16)
    if tw < w:
        im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h))
    elif tw > w:
        th = round(w * 16 / 9)
        im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    im = im.resize((1080, 1920), Image.LANCZOS)
    im.save(dst, quality=93)
    return im

fake = nine16(EP / '그림' / '가짜_치킨.jpg', OUT / '가짜.jpg')
orig = nine16(EP / '그림' / '원래_치킨.png', OUT / '원래.jpg')
d = ImageChops.difference(fake.convert('L'), orig.convert('L'))
# 속살 말고(위쪽 배경) 차이가 작으면 두 판의 구도가 맞는다
top = d.crop((0, 0, 1080, 700))
print('배경 차이(0~255 평균):', round(ImageStat.Stat(top).mean[0], 2), '· 전체:', round(ImageStat.Stat(d).mean[0], 2))

# 실제 제미나이 화면(1141×761) — 왼쪽 메뉴 띠 · 아래 입력창 · 계정 사진을 빼고 대화 칸만
for name in ['T1_파일그대로_답', 'T2_다시저장_답']:
    im = Image.open(EP / '화면' / f'{name}.png').convert('RGB')
    chat = im.crop((200, 50, 1000, 640))
    chat.save(OUT / f'{name}.png')
    print(name, chat.size)
