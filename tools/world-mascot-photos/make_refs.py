# 정본 표정 여덟 개를 흰 바탕 4×2 표정표 한 장으로(생김새·표정 참고). 칸 순서 = 굽는 판의 칸 순서.
# 사용: python make_refs.py  → ref/표정표_<id>.jpg, ref/본체_<id>.jpg
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
CANON = 'C:/Users/q1212/Documents/SYNK-appsscript/docs/캐릭터/정본_4K'
# 칸 순서(왼→오, 위→아래). 이름은 앱의 표정 이름.
ORDER = {
    'mongle': [('기본', '몽글_본체'), ('잔잔감음', '몽글_눈감음'), ('눈웃음', '몽글_눈웃음'), ('놀람', '몽글_놀람'),
               ('민망', '몽글_민망'), ('윙크', '몽글_윙크'), ('으쓱', '몽글_으쓱'), ('졸림', '몽글_졸림')],
    'kkamong': [('기본', '까몽_본체'), ('잔잔감음', '까몽_눈감음'), ('눈웃음', '까몽_눈웃음'), ('놀람', '까몽_놀람'),
                ('민망', '까몽_민망'), ('윙크', '까몽_윙크'), ('으쓱', '까몽_으쓱'), ('졸림', '까몽_졸림')],
    'marin': [('기본', '마린_본체'), ('잔잔감음', '마린_눈감음'), ('눈웃음', '마린_눈웃음'), ('놀람', '마린_놀람'),
              ('민망', '마린_민망'), ('기쁨', '마린_몰래기쁨'), ('집중', '마린_집중'), ('졸림', '마린_졸림')],
}
os.makedirs(os.path.join(ROOT, 'ref'), exist_ok=True)


def on_white(path, size):
    im = Image.open(path).convert('RGBA')
    bbox = im.getbbox()
    im = im.crop(bbox)
    im.thumbnail((int(size * .86), int(size * .86)), Image.LANCZOS)
    bg = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    bg.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return bg.convert('RGB')


for tid, faces in ORDER.items():
    cell = 384
    sheet = Image.new('RGB', (cell * 4, cell * 2), (255, 255, 255))
    for i, (_, src) in enumerate(faces):
        sheet.paste(on_white(os.path.join(CANON, src + '.png'), cell), ((i % 4) * cell, (i // 4) * cell))
    sheet.save(os.path.join(ROOT, 'ref', f'표정표_{tid}.jpg'), quality=90)
    on_white(os.path.join(CANON, faces[0][1] + '.png'), 1024).save(os.path.join(ROOT, 'ref', f'본체_{tid}.jpg'), quality=92)
    print(tid, [f for f, _ in faces])
