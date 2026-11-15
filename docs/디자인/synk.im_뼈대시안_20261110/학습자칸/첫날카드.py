# 첫날 튜터 카드 그림을 자른다(2026-11-16). 그림.py(synk.im_개인화면_20261108)의 튜터 카드 자르기와 같다: 흰 단추 위 글 덩어리 끝 + 위 여백에서 자르고 모서리를 둥글린다.
#   python -I -X utf8 첫날카드.py <01-home-new.crop.png> <낼 piece-tutor-first.webp>
import sys, numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
def 둥글게(im, r):
    m = Image.new('L', (im.width * 4, im.height * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, m.width - 1, m.height - 1), r * 4, fill=255)
    m = m.resize(im.size, Image.LANCZOS); im = im.convert('RGBA'); im.putalpha(m)
    return im
def 단추자리(im):
    a = np.array(im.convert('RGB')).astype(int); h, w, _ = a.shape
    bright = (a[:, int(w * .15):int(w * .85)].min(axis=2) > 200).mean(axis=1)
    rows = np.where(bright > .55)[0]
    blocks = np.split(rows, np.where(np.diff(rows) > 3)[0] + 1)
    b = max(blocks, key=len); assert len(b) > 60
    return int(b[0]), int(b[-1])
def 덩어리(im, 틈=20, 가=40):
    a = np.array(im.convert('RGB')).astype(int); h, w, _ = a.shape
    bg = np.median(a[:, w // 2].reshape(-1, 3), axis=0)
    줄 = np.where((np.abs(a[:, 가:w - 가] - bg).sum(axis=2) > 60).any(axis=1))[0]
    줄 = 줄[줄 > 3]
    묶음 = np.split(줄, np.where(np.diff(줄) > 틈)[0] + 1)
    return [(int(b[0]), int(b[-1])) for b in 묶음]
im = Image.open(src).convert('RGB'); 위, _ = 단추자리(im)
글 = 덩어리(im.crop((0, 0, im.width, 위 - 2)))
print('button', 위, 'blocks', 글)
c = im.crop((0, 0, im.width, min(im.height, 글[-1][1] + 글[0][0])))
c = 둥글게(c, 58); c.save(out, 'WEBP', quality=88, method=6); print(c.size)
