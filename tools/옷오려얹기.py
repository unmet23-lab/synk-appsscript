"""«두른 채» 그림에서 옷만 오려 원본에 얹는다 — 3판 (0원).

유호 09-05 밤: 「오려얹기가 가장 좋을것같은데 목도리 퀄리티가 완전 깨지는것처럼 보이네」

🔴 2판이 깨진 까닭 셋:
   ① 마스크를 «빠듯하게» 잡아 가장자리로 아래 몸이 비쳤다(색이 흐려짐)
   ② 마스크를 3px 흐렸는데, 흐린 띠 안에서 옷과 몸이 섞였다
   ③ 술(fringe)이 몸 «안»에 겹쳐 있어 「원본 밖」 조건에 안 걸렸다

✅ 3판 처방:
   ① 마스크를 넉넉히 넓힌다(팽창) — 옷 둘레를 조금 더 덮어 아래가 안 비친다
   ② 안쪽은 완전 불투명, 가장자리 1px 만 부드럽게
   ③ 술은 «가는 세로 결»이라 결 문턱을 따로 낮춰 잡는다
"""
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None

두른경로, 원본경로, 낼곳 = sys.argv[1], sys.argv[2], sys.argv[3]
결문턱 = float(sys.argv[4]) if len(sys.argv) > 4 else 1.5
넓힘 = int(sys.argv[5]) if len(sys.argv) > 5 else 9


def 알파상자(im):
    a = np.array(im.getchannel('A'))
    ys, xs = np.where(a > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def 머리폭(im, 몫=0.18):
    a = np.array(im.getchannel('A'))
    h = a.shape[0]
    띠 = a[int(h * 0.10):int(h * (0.10 + 몫))]
    xs = np.where(띠.max(axis=0) > 40)[0]
    return xs.max() - xs.min() + 1


두른0 = Image.open(두른경로).convert('RGBA')
두른 = 두른0.crop(알파상자(두른0))
원본0 = Image.open(원본경로).convert('RGBA')
원본 = 원본0.crop(알파상자(원본0))

비 = 머리폭(원본) / 머리폭(두른)
두른 = 두른.resize((max(int(두른.width * 비), 1), max(int(두른.height * 비), 1)), Image.LANCZOS)
# 두른 쪽이 더 길 수 있다(목도리 술) — 판을 그만큼 넓힌다
폭 = max(원본.width, 두른.width)
높 = max(원본.height, 두른.height)
판 = Image.new('RGBA', (폭, 높), (0, 0, 0, 0))
판.paste(두른, ((폭 - 두른.width) // 2, 0), 두른)
바탕 = Image.new('RGBA', (폭, 높), (0, 0, 0, 0))
바탕.paste(원본, ((폭 - 원본.width) // 2, 0), 원본)

회 = np.array(판.convert('L')).astype(float)
알파 = np.array(판.getchannel('A'))
원회 = np.array(바탕.convert('L')).astype(float)
원알파 = np.array(바탕.getchannel('A'))

창 = 9
평 = ndimage.uniform_filter(회, 창)
결 = np.sqrt(np.maximum(ndimage.uniform_filter(회 * 회, 창) - 평 * 평, 0))
원평 = ndimage.uniform_filter(원회, 창)
원결 = np.sqrt(np.maximum(ndimage.uniform_filter(원회 * 원회, 창) - 원평 * 원평, 0))
몸안 = (원알파 > 60) & (알파 > 60)
바탕결 = float(np.median(원결[몸안])) if 몸안.any() else 1.0

옷 = (결 > 바탕결 * 결문턱) & (알파 > 60)
A = np.array(판.convert('RGB')).astype(int)
B = np.array(바탕.convert('RGB')).astype(int)
옷 |= (np.abs(A - B).max(axis=2) > 60) & (알파 > 60)
옷 |= (원알파 < 40) & (알파 > 100)          # 원본 밖 = 술·삐져나온 자락

옷 = ndimage.binary_closing(옷, np.ones((25, 25)))
옷 = ndimage.binary_opening(옷, np.ones((5, 5)))
표, 수 = ndimage.label(옷)
if 수:
    크기 = ndimage.sum(옷, 표, range(1, 수 + 1))
    살릴 = [i + 1 for i, c in enumerate(크기) if c >= 크기.max() * 0.02]
    옷 = np.isin(표, 살릴)
옷 = ndimage.binary_fill_holes(옷)
# ✅ 넉넉히 넓힌다 — 옷 둘레를 조금 더 덮어야 아래가 안 비친다
if 넓힘 > 0:
    옷 = ndimage.binary_dilation(옷, np.ones((넓힘, 넓힘)))
옷 &= (알파 > 40)

# ✅ 안쪽은 완전 불투명, 가장자리 한 겹만 부드럽게
마스크 = Image.fromarray((옷 * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1))
옷조각 = 판.copy()
옷조각.putalpha(Image.fromarray(np.minimum(np.array(마스크), 알파).astype(np.uint8), 'L'))
결과 = 바탕.copy()
결과.alpha_composite(옷조각)
결과 = 결과.crop(알파상자(결과))
결과.save(낼곳)
print('OK %s · 옷 %.1f%% (바탕결 %.1f · 문턱 ×%.1f · 넓힘 %d)'
      % (낼곳, 옷.mean() * 100, 바탕결, 결문턱, 넓힘))
