"""초록 몸에 입혀 구운 그림에서 옷만 떼어낸다 — 이 길이 정본이다 (2026-09-06 · 0원).

■ 왜 초록인가 (09-06 새벽 · 실측으로 네 길을 태운 끝)
  ⓐ 옷만 굽기            : 몸을 모른 채 구워 「그냥 딱 잘린」 모양(유호 반려 09-05)
  ⓑ 다 구운 그림 오리기   : 색으로 오려 술이 잘리고 색이 흐려졌다(유호 반려 09-05)
  ⓒ 씌워 굽고 옷만 다시 굽기 : 절반은 좋은데 절반은 프레임을 바꾸거나 딴 조각을 붙인다(21벌 중 8벌)
  ⓓ 정본과의 «차이»로 떼기  : 그늘진 크림이 코랄과 가까워 옷에 구멍이 뚫린다
  ⓔ **몸을 단색 초록으로 두고 입혀 굽기** ← 여기. 초록이 아닌 곳이 곧 옷이라 가를 것이 없다.
     덤으로 «가림»이 공짜다 — 몸이 앞을 가린 자리는 애초에 옷이 안 그려진다(깃의 뒤쪽 안벽 문제가
     원리적으로 사라진다). 자리는 검은 구슬 눈 두 개로 잡는다.

■ 무엇을 조심하나
  · 옷에 초록이 있으면 그 부분이 뚫린다. 지금 목록에 초록 옷은 «잎망토·새싹·화관» 셋이다 —
    그 셋은 초록의 «결»이 달라(잎 초록 vs 크로마 초록) 색상·채도로 가른다. 그래도 뚫리면
    그 장만 사람이 본다(조용히 넘어가지 않는다).
  · 초록 가장자리에 초록 빛이 번진다(spill). 가장자리 한 겹을 깎고 채도를 낮춰 눌러 준다.

쓰는 법:
  python tools/옷초록떼기.py <초록입힘.png> <낼곳_층.png> [--몸 <정본.png>] [--눈 검정|버터|초록]
                              [--얹음 <미리보기.png>]
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 옷자리맞추기 import 눈들, 눈에서_옮김  # noqa: E402


def 자홍인가(a):
    """크로마 자홍 = 붉음과 파랑이 초록보다 뚜렷이 세다. 초록 옷(잎·새싹)을 안 먹는다."""
    r, g, b = a[:, :, 0].astype(np.int16), a[:, :, 1].astype(np.int16), a[:, :, 2].astype(np.int16)
    return (r - g > 14) & (b - g > 14) & (np.maximum(r, b) > 40)


def 초록인가(a):
    """크로마 초록 = 초록이 다른 둘보다 뚜렷이 세고, 색이 확실히 있다.
    잎사귀 초록(#7FA86A 계열)은 초록이 덜 세고 붉은빛이 남아 여기 안 걸린다."""
    r, g, b = a[:, :, 0].astype(np.int16), a[:, :, 1].astype(np.int16), a[:, :, 2].astype(np.int16)
    # 🔴 그늘진 초록도 잡는다(09-06 실측: 목도리가 엇갈린 틈에 어두운 초록이 남았다).
    #   문턱을 밝기가 아니라 «초록이 얼마나 더 센가»로 잡으면 그늘도 같이 걸린다.
    return (g - r > 14) & (g - b > 14) & (g > 40)


def 떼어낸다(초록경로, 몸경로, 눈결='검정', 바탕='초록'):
    몸 = Image.open(몸경로).convert('RGBA')
    초록 = Image.open(초록경로).convert('RGB')

    초록눈 = 눈들(초록, 눈결)
    정본눈 = 눈들(몸, 눈결)
    if 초록눈 is None or 정본눈 is None:
        raise SystemExit(f'🔴 눈을 못 찾았다(초록 {bool(초록눈)} · 정본 {bool(정본눈)}) — 사람이 본다')
    맞춤 = 눈에서_옮김(초록눈, 정본눈)
    if 맞춤 is None:
        raise SystemExit('🔴 두 눈 사이를 못 쟀다 — 사람이 본다')
    배율, c초, c정 = 맞춤

    a = np.asarray(초록)
    # 🔴 바탕이 «순백»이 아닌 장이 있다(09-06 실측 · 까몽 목도리는 옅은 회색 스튜디오 바닥으로 나왔다).
    #   밝기로만 자르면 그 회색이 옷으로 잡혀 조각에 네모 배경이 통째로 들어온다.
    #   ⇒ 「밝고 색이 거의 없고 «테두리에서 이어지는» 곳」을 바탕으로 본다.
    #   🔴 바탕 «색»을 네 귀퉁이에서 «재서» 정한다 (09-06 셋째 갈이).
    #     고정 문턱으로 잡으면 두 번 다 틀렸다 — 넓게 잡으면 크림 옷이 바탕으로 먹히고
    #     (SYNK 후드가 찢어졌다), 좁게 잡으면 옅은 회색 스튜디오 바닥을 놓친다
    #     (자홍 판이 회색으로 나와 까몽 여덟 벌에 배경 조각이 딸려 왔다).
    #     귀퉁이는 언제나 바탕이므로, 거기서 재면 밝든 회색이든 다 맞는다.
    귀 = np.concatenate([a[:60, :60].reshape(-1, 3), a[:60, -60:].reshape(-1, 3),
                         a[-60:, :60].reshape(-1, 3), a[-60:, -60:].reshape(-1, 3)])
    바탕색 = np.median(귀, axis=0).astype(np.int16)
    닮음 = np.abs(a.astype(np.int16) - 바탕색).sum(axis=2) < 40
    표0, 수0 = ndimage.label(닮음)
    큼 = a.shape[0] * a.shape[1] * 0.03
    테두리 = set(표0[0, :]) | set(표0[-1, :]) | set(표0[:, 0]) | set(표0[:, -1])
    테두리.discard(0)
    테두리 = {i for i in 테두리 if (표0 == i).sum() > 큼}
    씨앗 = np.isin(표0, list(테두리)) if 테두리 else (a > 244).all(axis=2)
    # 🔑 바탕에서 «번져 나가» 옅은 그림자까지 따라간다 (09-06 넷째 갈이).
    #   바탕에 깔린 부드러운 그림자는 바탕 색과 조금 달라 옷으로 잡히고, 얹으면 흰 얼룩이 된다.
    #   그림자는 «색이 거의 없고 바탕보다 아주 어둡지는 않은» 자리이고, 바탕과 «이어져» 있다.
    #   그래서 색 하나로 자르지 않고 바탕에서 번지게 한다 — 옷은 색이 있거나 짙어서 번짐이 멈춘다.
    채 = a.max(axis=2).astype(np.int16) - a.min(axis=2).astype(np.int16)
    밝 = a.max(axis=2).astype(np.int16)
    #   🔴 번지는 조건은 «색이 거의 0인 곳»으로 좁힌다(09-06 다섯째 갈이).
    #     넓게 두면 번짐이 크림 옷으로 흘러 들어가 배지 코트·후드·앞치마가 파였다.
    #     그림자는 색이 아예 없고(채 0~8) 크림 양모는 따뜻한 기운이 남는다(채 14~20).
    허용 = (채 < 11) & (밝 > int(바탕색.max()) - 70)
    흰 = ndimage.binary_propagation(씨앗, mask=(씨앗 | 허용))

    바탕인가 = 자홍인가 if 바탕 == '자홍' else 초록인가
    옷 = ~바탕인가(a) & ~흰
    # 🔴 눈은 초록이 아니라 «옷»으로 잡힌다(09-06 실측 · 첫 목소리 목도리에 검은 구슬 넷이 떴다).
    #   눈 자리는 이미 알고 있으니 그 둘레를 통째로 뺀다. 옷이 눈을 가리는 컷(안경·모자)에서도
    #   가려진 부분은 어차피 옷 쪽 픽셀이라 옷 덩어리에 붙어 살아남는다.
    h, w = 옷.shape
    눈지름 = max(24, int(abs(초록눈[1][0] - 초록눈[0][0]) * 0.32))
    yy, xx = np.ogrid[:h, :w]
    for ex, ey in 초록눈:
        옷 &= ((xx - ex) ** 2 + (yy - ey) ** 2) > 눈지름 ** 2
    # 눈은 몸이지 옷이 아니다 — 초록 안에 박힌 검은 구슬을 옷으로 오해하지 않게 «구멍»을 메우기 전에 뺀다
    옷 = ndimage.binary_opening(옷, np.ones((7, 7), bool))
    표, 수 = ndimage.label(옷, structure=np.ones((3, 3), bool))
    if 수 == 0:
        raise SystemExit('🔴 초록이 아닌 곳이 없다 — 옷이 안 보이는 그림이다')
    크기 = ndimage.sum(옷, 표, range(1, 수 + 1))
    남길 = np.where(크기 >= max(크기.max() * 0.02, a.shape[0] * a.shape[1] * 1e-4))[0] + 1
    옷 = np.isin(표, 남길)
    옷 = ndimage.binary_closing(옷, np.ones((9, 9), bool))
    # 🔑 초록 빛 번짐(spill)을 한 겹 깎는다 — 안 깎으면 옷 가장자리에 초록 테가 남는다
    옷 = ndimage.binary_erosion(옷, np.ones((13, 13), bool))

    알파 = Image.fromarray((옷 * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1.6))
    # 🔑 남은 초록 기운을 눌러 준다(de-spill) — 초록이 다른 둘보다 세면 그만큼만 깎아 회색으로 당긴다
    rgb = np.asarray(초록).astype(np.float32)
    if 바탕 == '자홍':
        넘침 = np.maximum(np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1], 0)
        rgb[:, :, 0] -= 넘침
        rgb[:, :, 2] -= 넘침
    else:
        넘침 = np.maximum(rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2]), 0)
        rgb[:, :, 1] -= 넘침
    층0 = Image.fromarray(rgb.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    층0.putalpha(알파)

    # 정본 좌표계로 옮긴다(두 눈이 겹치게)
    큰 = 몸.width
    n = max(8, int(round(층0.width * 배율)))
    작 = 층0.resize((n, n), Image.LANCZOS)
    층 = Image.new('RGBA', 몸.size, (0, 0, 0, 0))
    층.paste(작, (round(c정[0] - c초[0] * 배율), round(c정[1] - c초[1] * 배율)), 작)
    return 층, 몸, int(옷.sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('초록'); ap.add_argument('낼곳')
    ap.add_argument('--몸', default='docs/캐릭터/정본_4K/몽글_본체.png')
    ap.add_argument('--눈', default='검정', choices=['검정', '버터', '초록'])
    ap.add_argument('--바탕', default='초록', choices=['초록', '자홍'],
                    help='몸을 어떤 색으로 구웠나. 옷 자체가 초록이면 자홍으로 굽고 여기도 자홍을 준다')
    ap.add_argument('--얹음', help='몸 위에 얹은 미리보기도 낸다')
    a = ap.parse_args()
    층, 몸, 칸수 = 떼어낸다(a.초록, a.몸, a.눈, a.바탕)
    층.save(a.낼곳)
    if a.얹음:
        판 = 몸.copy()
        판.alpha_composite(층)
        판.save(a.얹음)
    print(f'✅ {a.낼곳} — 옷 {칸수:,}점')


if __name__ == '__main__':
    main()
