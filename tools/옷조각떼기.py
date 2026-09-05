"""씌워 구운 그림에서 «옷만» 곧바로 떼어낸다 — 다시 굽지 않는다 (2026-09-06 · 0원).

■ 왜 이 길인가
  「옷만 다시 굽기」(tools/옷굽기.js ② 단계)는 절반쯤에서 물체를 프레임 가득 키워 그리거나
  딴 조각을 붙여 낸다(09-06 실측 몽글 21벌 중 8벌). 한 장에 336원이 나가고, 다시 굽어도
  또 어긋날 수 있다.
  여기서는 «이미 있는 그림»에서 떼어낸다. 두 눈으로 정본 몸과 겹쳐 놓으면, 몸과 «다른 곳»이
  곧 옷이다. 자리가 어긋날 수가 없다 — 떼어낸 그 자리에 그대로 두기 때문이다.

■ 09-05 에 반려된 「오려 얹기」와 무엇이 다른가
  그때는 «색»으로 오렸다(코랄이 아닌 곳). 결이 있어 픽셀마다 색이 달라 가장자리가 무너졌고,
  목도리 술이 잘리고 색이 흐려졌다.
  여기서는 «정본과의 차이»로 가른다. 같은 그림 두 장을 견주므로 결이 상쇄되고, 술처럼 가는
  것도 «몸과 다르다»는 사실 하나로 살아남는다.

■ 남는 한계 (숨기지 않는다)
  씌워 구울 때 몸도 조금 다시 그려지므로, 몸 가장자리에 얇은 테가 남을 수 있다.
  그래서 ①차이를 크게 잡고 ②덩어리로 다듬고 ③몸 색에 가까운 «떨어진» 조각은 걷는다.

쓰는 법:
  python tools/옷조각떼기.py <씌워구운.png> <낼곳_층.png> [--몸 <정본.png>] [--눈 검정|버터]
                              [--얹음 <미리보기.png>] [--문턱 60]
"""
import argparse
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from 옷자리맞추기 import 눈들, 눈에서_옮김, 눈으로_옮긴판, 으뜸색  # noqa: E402


def 떼어낸다(씌운경로, 몸경로, 눈결='검정', 문턱=60):
    몸 = Image.open(몸경로).convert('RGBA')
    씌운 = Image.open(씌운경로).convert('RGB')

    씌운눈 = 눈들(씌운, 눈결)
    정본눈 = 눈들(몸, 눈결)
    if 씌운눈 is None or 정본눈 is None:
        raise SystemExit(f'🔴 눈을 못 찾았다(씌운 {bool(씌운눈)} · 정본 {bool(정본눈)}) — 사람이 본다')
    맞춤 = 눈에서_옮김(씌운눈, 정본눈)
    if 맞춤 is None:
        raise SystemExit('🔴 두 눈 사이를 못 쟀다 — 사람이 본다')
    배율, c씌, c정 = 맞춤
    옮긴 = 눈으로_옮긴판(씌운, 몸, 배율, c씌, c정)

    바탕 = Image.new('RGB', 몸.size, (255, 255, 255))
    바탕.paste(몸, (0, 0), 몸)
    a = np.asarray(옮긴).astype(np.int16)
    b = np.asarray(바탕).astype(np.int16)
    차 = np.abs(a - b).sum(axis=2)

    옷 = 차 > 문턱 * 3
    # 옮기면서 생긴 «빈 테두리»는 옷이 아니다 — 옮긴 그림이 흰색이고 몸도 흰색인 자리를 뺀다
    옮긴흰 = (a > 246).all(axis=2)
    몸흰 = (b > 246).all(axis=2)
    옷 &= ~(옮긴흰 & 몸흰)

    옷 = ndimage.binary_opening(옷, np.ones((9, 9), bool))
    옷 = ndimage.binary_closing(옷, np.ones((25, 25), bool))
    옷 = ndimage.binary_fill_holes(옷)
    표, 수 = ndimage.label(옷, structure=np.ones((3, 3), bool))
    if 수 == 0:
        raise SystemExit('🔴 몸과 다른 곳이 없다 — 옷이 안 보이는 그림이다')
    크기 = ndimage.sum(옷, 표, range(1, 수 + 1))

    # 몸 색에 가까운 «떨어진» 조각은 딸려온 몸이다 — 본 덩어리만 남기되, 큰 조각은 색을 본다
    몸색 = 으뜸색(몸)
    본 = int(np.argmax(크기)) + 1
    남길 = {본}
    for i in range(1, 수 + 1):
        if i == 본 or 크기[i - 1] < 크기.max() * 0.04:
            continue
        골 = 표 == i
        색 = np.median(a[골], axis=0).astype(np.int16)
        if int(np.abs(색 - 몸색).sum()) > 110:
            남길.add(i)
    옷 = np.isin(표, list(남길))

    알파 = Image.fromarray((옷 * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(2.0))
    층 = 옮긴.convert('RGBA')
    층.putalpha(알파)
    return 층, 몸, int(옷.sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('씌운'); ap.add_argument('낼곳')
    ap.add_argument('--몸', default='docs/캐릭터/정본_4K/몽글_본체.png')
    ap.add_argument('--눈', default='검정', choices=['검정', '버터'])
    ap.add_argument('--문턱', type=int, default=60)
    ap.add_argument('--얹음', help='몸 위에 얹은 미리보기도 낸다')
    a = ap.parse_args()
    층, 몸, 칸수 = 떼어낸다(a.씌운, a.몸, a.눈, a.문턱)
    층.save(a.낼곳)
    if a.얹음:
        판 = 몸.copy()
        판.alpha_composite(층)
        판.save(a.얹음)
    print(f'✅ {a.낼곳} — 옷 {칸수:,}점')


if __name__ == '__main__':
    main()
