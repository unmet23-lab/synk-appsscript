"""정본 마스코트를 «몸은 크로마 한 색 · 바탕은 크로마 화면»으로 미리 물들인 참조 그림을 만든다 (0원).

■ 왜 (2026-09-06 밤 · 까몽 · 인계 §① 「각도」의 뿌리를 파니 여기였다)
  조각 뜨는 그림을 구울 때 제미나이에게 「참조의 몸을 자홍으로 물들여라」고 시켰더니, «물들이는» 그 말이
  몸을 다시 그리게 했다 — 21벌 중 여럿이 위에서 본 둥근 몸이 아니라 «서 있는 봉제 인형»으로 나왔다
  (머리·몸통·다리 둘). 실루엣이 다르니 몸으로 자리를 맞추는 자가 옷을 엉뚱한 크기로 앉혔다
  (겨울 델이 몸을 삼키고 · 배지 코트가 오른쪽으로 밀리고 · 확신 0.71).
  ⇒ 물들이는 일은 «우리가» 한다. 정본 PNG 의 알파가 곧 몸이니 0원으로 정확히 물들일 수 있고,
    제미나이에겐 「이 그림 그대로 + 옷만」을 시킨다. 실측: 크기 1.008 · 확신 0.97 (같은 옷 · 같은 날).

■ 무엇을 지키나
  · 실루엣·자세·크기·자리 = 정본 그대로(알파를 그대로 쓴다) · 털 가장자리도 그대로
  · 털의 «결»은 밝기로 남긴다 — 자홍 한 색을 밝기로만 흔들어, 제미나이가 «털 난 것»으로 읽되
    떼는 자(`자홍인가`)에는 전부 자홍으로 걸리게 한다(가장 어두운 곳도 r-g·b-g 가 14 를 훌쩍 넘는다)
  · 눈은 제 색 그대로 — 자리를 잡는 첫 자가 눈이고, 「눈은 그대로」가 지시문에도 선다
  · 화면 = 초록(#00B140) 또는 파랑(#0047FF). 옷 자체가 초록이면(잎망토·새싹·화관) 파랑을 준다

쓰는 법:
  python tools/옷참조물들이기.py --몸 docs/캐릭터/정본_4K/까몽_본체.png --눈 초록 --몸색 자홍 --화면 초록 --낼곳 <png>
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 옷자리맞추기 import 눈들  # noqa: E402

몸색표 = {'자홍': (214, 0, 154), '초록': (0, 177, 64)}
화면표 = {'초록': (0, 177, 64), '파랑': (0, 71, 255), '흰': (255, 255, 255)}


def _눈골(rgb, 눈결):
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    if 눈결 == '초록':
        return (g > 90) & (g - r > 15) & (g - b > 20)
    if 눈결 == '버터':
        return (r > 190) & (g > 150) & (b < 150) & (r - b > 70)
    밝기 = rgb.mean(axis=2)
    채도 = rgb.max(axis=2) - rgb.min(axis=2)
    return (밝기 < 70) & (채도 < 60)


def 물들인다(몸경로, 눈결='초록', 몸색='자홍', 화면='초록'):
    im = Image.open(몸경로).convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[:, :, :3], a[:, :, 3] / 255.0
    L = rgb.mean(axis=2)
    몸 = al > 0.5
    lo, hi = np.percentile(L[몸], 2), np.percentile(L[몸], 98)
    t = np.clip((L - lo) / max(1.0, hi - lo), 0, 1)
    # 🔑 0.42~1.0 — 제일 어두운 올도 크로마로 걸리는 밝기(자홍 0.42 = (90,0,65) · r-g 90)
    색 = np.array(몸색표[몸색], np.float32)[None, None, :] * (0.42 + 0.58 * t)[:, :, None]

    # 눈은 제 색으로 — 홍채(또는 구슬·렌즈) 덩어리를 찾아 그 둘레 원반을 남긴다
    눈 = 눈들(im, 눈결)
    if 눈 is None:
        raise SystemExit('🔴 정본에서 눈을 못 찾았다 — 물들일 수 없다(눈 없이는 자리를 못 잡는다)')
    h, w = L.shape
    yy, xx = np.ogrid[:h, :w]
    표, _ = ndimage.label(_눈골(rgb, 눈결) & 몸)
    눈마스크 = np.zeros((h, w), bool)
    for ex, ey in 눈:
        ex, ey = int(ex), int(ey)
        근처 = 표[max(0, ey - 80):ey + 80, max(0, ex - 80):ex + 80]
        labs = [v for v in np.unique(근처) if v]
        if not labs:
            raise SystemExit('🔴 눈 둘레에 눈 덩어리가 없다 — 사람이 본다')
        lab = max(labs, key=lambda v: int((근처 == v).sum()))
        ys, xs = np.where(표 == lab)
        반지름 = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 * 1.12
        cx, cy = (xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2
        눈마스크 |= ((xx - cx) ** 2 + (yy - cy) ** 2) <= 반지름 ** 2
    색[눈마스크] = rgb[눈마스크]

    바탕 = np.array(화면표[화면], np.float32)[None, None, :]
    out = 색 * al[:, :, None] + 바탕 * (1 - al[:, :, None])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--몸', required=True)
    ap.add_argument('--눈', default='초록', choices=['검정', '버터', '초록'])
    ap.add_argument('--몸색', default='자홍', choices=list(몸색표))
    ap.add_argument('--화면', default='초록', choices=list(화면표))
    ap.add_argument('--낼곳', required=True)
    a = ap.parse_args()
    im = 물들인다(a.몸, a.눈, a.몸색, a.화면)
    os.makedirs(os.path.dirname(os.path.abspath(a.낼곳)), exist_ok=True)
    im.save(a.낼곳)
    print(f'✅ {a.낼곳} — 몸 {a.몸색} · 화면 {a.화면} · {im.width}×{im.height}')


if __name__ == '__main__':
    main()
