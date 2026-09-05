"""«씌운 채» 구운 그림에서 악세사리만 오려 원본 마스코트에 얹는다 (2026-09-05 · 0원).

유호 09-05 밤: 「꽃 장식이나 머리띠같은것도 마스코트가 착용한 위치에따라 자연스럽게 각도도 변하고해야지」

🔑 왜 옷과 «다른 자»인가
  옷(목도리·델)은 몸을 크게 감싸므로 「결이 다른 넓은 띠」로 잡는다(tools/옷오려얹기.py).
  악세(꽃핀·선글라스·배지)는 **작고 국소적인 덩어리 하나**다. 같은 자를 쓰면
  색 차이가 몸 전체를 잡아 61% 가 「옷」으로 나온다(09-05 밤 실측 · 꽃핀에서 밟았다).
  ⇒ 여기서는 «원본과 다른 곳» 중 **큰 덩어리 몇 개만** 남긴다. 나머지는 「모델이 몸을
     조금 다르게 그린 자국」이라 버려야 한다.

🔑 씌운 채 굽기는 악세에서 훨씬 잘 지켜진다(09-05 실측) — 악세가 몸을 거의 안 가리므로
  모델이 «가려진 부분을 상상»할 일이 없다. 그래도 눈 크기·간격은 미세하게 달라지므로
  이 오리기로 얼굴을 원본으로 되돌린다.

쓰기: python tools/악세오려얹기.py <씌운채누끼.png> <원본.png> <낼곳.png> [덩어리수=1] [넓힘=7]
"""
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None

씌운경로, 원본경로, 낼곳 = sys.argv[1], sys.argv[2], sys.argv[3]
덩어리수 = int(sys.argv[4]) if len(sys.argv) > 4 else 1
넓힘 = int(sys.argv[5]) if len(sys.argv) > 5 else 7


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


씌운0 = Image.open(씌운경로).convert('RGBA')
씌운 = 씌운0.crop(알파상자(씌운0))
원본0 = Image.open(원본경로).convert('RGBA')
원본 = 원본0.crop(알파상자(원본0))

# 머리 폭으로 크기를 맞춘다. 악세가 머리에 걸치면 폭이 늘어나므로 «아래쪽 몸폭»으로 잰다
def 몸폭(im):
    a = np.array(im.getchannel('A'))
    h = a.shape[0]
    띠 = a[int(h * 0.80):int(h * 0.95)]
    xs = np.where(띠.max(axis=0) > 40)[0]
    return xs.max() - xs.min() + 1


비 = 몸폭(원본) / 몸폭(씌운)
씌운 = 씌운.resize((max(int(씌운.width * 비), 1), max(int(씌운.height * 비), 1)), Image.LANCZOS)

폭 = max(원본.width, 씌운.width)
높 = max(원본.height, 씌운.height)
판 = Image.new('RGBA', (폭, 높), (0, 0, 0, 0))
바탕 = Image.new('RGBA', (폭, 높), (0, 0, 0, 0))
# 바닥을 맞춘다 — 악세는 위로 삐져나오므로 아래를 기준으로 겹친다
판.paste(씌운, ((폭 - 씌운.width) // 2, 높 - 씌운.height), 씌운)
바탕.paste(원본, ((폭 - 원본.width) // 2, 높 - 원본.height), 원본)

A = np.array(판.convert('RGB')).astype(int)
B = np.array(바탕.convert('RGB')).astype(int)
알파 = np.array(판.getchannel('A'))
원알파 = np.array(바탕.getchannel('A'))

차 = np.abs(A - B).max(axis=2)
다름 = ((차 > 55) & (알파 > 60)) | ((원알파 < 40) & (알파 > 120))
다름 = ndimage.binary_opening(다름, np.ones((9, 9)))
다름 = ndimage.binary_closing(다름, np.ones((21, 21)))

표, 수 = ndimage.label(다름)
if 수 == 0:
    print('🔴 다른 곳을 못 찾았다')
    sys.exit(1)
크기 = ndimage.sum(다름, 표, range(1, 수 + 1))
차례 = np.argsort(크기)[::-1][:덩어리수]
악세 = np.isin(표, [i + 1 for i in 차례])
악세 = ndimage.binary_fill_holes(악세)
if 넓힘 > 0:
    악세 = ndimage.binary_dilation(악세, np.ones((넓힘, 넓힘)))
악세 &= (알파 > 40)

마스크 = Image.fromarray((악세 * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1))
조각 = 판.copy()
조각.putalpha(Image.fromarray(np.minimum(np.array(마스크), 알파).astype(np.uint8), 'L'))
결과 = 바탕.copy()
결과.alpha_composite(조각)
결과 = 결과.crop(알파상자(결과))
결과.save(낼곳)
print('OK %s · 악세 %.2f%% · 덩어리 %d개 중 %d개 살림'
      % (낼곳, 악세.mean() * 100, 수, len(차례)))
