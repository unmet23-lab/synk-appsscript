"""뜬 옷을 마스코트의 «맞는 자리»에 앉힌다 — 사람이 앵커를 안 적는다 (2026-09-06 · 0원).

■ 무엇이 문제였나
  옷을 따로 뜨면(씌워 구운 그림을 본보기로 주고 «옷만» 다시 굽기) 가장자리는 성한데
  «자리와 크기»가 조금씩 어긋난다. 09-06 첫 판에서 겨울 델이 1.1배쯤 커져 몽글의 눈을 덮었다.
  옷 예순 벌마다 사람이 자리를 맞추면 그건 통로가 아니다. 그래서 기계가 맞춘다.

■ 어떻게 맞추나 — 두 걸음
  ⓐ 뜬 옷 → 씌워 구운 그림  : 같은 옷이 두 그림에 다 있으므로, 밝기 무늬를 겹쳐 맞춘다
                              (크기 후보마다 FFT 로 «가장 잘 겹치는 자리»를 한 번에 찾는다).
  ⓑ 씌워 구운 그림 → 정본 몸 : **눈 두 개**를 기준점으로 삼는다. 눈은 셋 다 반드시 있고,
                              또렷하고, 옷에 안 가린다. 두 눈 사이 거리가 크기를, 가운데가 자리를 준다.
  둘을 이어 붙이면 «뜬 옷 → 정본 몸»이 나온다.

  🔑 왜 눈인가: 몸 상자(bbox)로 맞추면 옷이 몸 밖으로 삐져나온 만큼 상자가 커져서 어긋난다.
     머리 꼭대기로 맞추면 모자를 쓴 컷에서 무너진다. 눈은 옷이 바뀌어도 안 움직인다.
  ⚠ 눈을 못 찾으면 «찾았다고 하지 않는다» — 그 장은 넘기고 사람이 본다(조용한 폴백 금지).

■ 쓰는 법
  python tools/옷자리맞추기.py <뜬옷_누끼.png> <씌워구운.png> <낼곳.png> [--몸 <정본.png>] [--눈 검정|버터]
"""
import argparse
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


작은판 = 512          # 겹쳐 맞추기는 작은 판에서 한다(4096 으로 하면 몇 분씩 걸린다)


# ── 눈 찾기 ────────────────────────────────────────────────────────────────

def 눈들(im: Image.Image, 결='검정'):
    """위쪽 절반에서 «눈 두 개»의 가운데 점을 찾는다. 못 찾으면 None.

    검정 = 몽글·까몽의 유리 구슬(아주 어둡고 색이 없다).
    버터 = 마린의 렌즈(밝은 노랑이 헬멧의 짙은 남색 위에 있다).
    """
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    알파 = np.asarray(im.convert('RGBA'))[:, :, 3] if im.mode == 'RGBA' else None
    h, w = a.shape[:2]
    밝기 = a.mean(axis=2)
    채도 = a.max(axis=2) - a.min(axis=2)

    if 결 == '버터':
        r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
        골 = (r > 190) & (g > 150) & (b < 150) & (r - b > 70)
    else:
        골 = (밝기 < 70) & (채도 < 60)
    if 알파 is not None:
        골 &= 알파 > 128
    골[int(h * 0.62):, :] = False          # 아래쪽은 그림자·옷이라 안 본다

    표, 수 = ndimage.label(골)
    if 수 < 2:
        return None

    # 🔴 «제일 큰 둘»을 눈이라고 하면 틀린다(09-06 실측). 짙은 남색 델의 접힌 그늘이
    #   눈보다 큰 덩어리로 잡혀, 겨울 델에서 눈 대신 옷 주름 둘을 물었다.
    #   ⇒ 크기가 아니라 «한 쌍인가»로 고른다: 높이가 같고 · 크기가 비슷하고 · 둥글고 ·
    #     적당히 떨어져 있는 두 덩어리. 눈은 이 넷을 동시에 만족하는 유일한 짝이다.
    크기 = ndimage.sum(골, 표, range(1, 수 + 1))
    후보 = [i for i in np.argsort(크기)[::-1][:14] if 크기[i] > h * w * 2e-5]
    if len(후보) < 2:
        return None
    상자 = ndimage.find_objects(표)
    잼 = []
    for i in 후보:
        sl = 상자[i]
        bh, bw = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        c = ndimage.center_of_mass(골, 표, [int(i + 1)])[0]
        둥근 = 크기[i] / max(1.0, bh * bw)              # 원이면 0.785 쯤
        납작 = min(bh, bw) / max(1, max(bh, bw))        # 1 이면 정사각
        잼.append({'i': i, 'x': c[1], 'y': c[0], '크기': 크기[i],
                   '둥근': 둥근, '납작': 납작, 'w': bw, 'h': bh})

    제일, 점수제일 = None, -1e9
    for p in range(len(잼)):
        for q in range(p + 1, len(잼)):
            A, B = 잼[p], 잼[q]
            거리 = abs(A['x'] - B['x'])
            if 거리 < w * 0.06 or 거리 > w * 0.60:      # 너무 붙거나 너무 벌어지면 눈이 아니다
                continue
            if abs(A['y'] - B['y']) > h * 0.035:        # 높이가 같아야 한다
                continue
            크기비 = min(A['크기'], B['크기']) / max(A['크기'], B['크기'])
            if 크기비 < 0.45:
                continue
            점수 = (크기비 * 2.0 + (A['둥근'] + B['둥근']) + (A['납작'] + B['납작'])
                    - abs(A['y'] - B['y']) / (h * 0.035))
            if 점수 > 점수제일:
                제일, 점수제일 = (A, B), 점수
    if 제일 is None:
        return None
    return sorted([(제일[0]['x'], 제일[0]['y']), (제일[1]['x'], 제일[1]['y'])])


def 눈에서_옮김(씌운눈, 정본눈):
    """두 눈 → 크기 배율과 옮길 거리. 회전은 안 쓴다(정면 컷만 다룬다)."""
    s1 = abs(씌운눈[1][0] - 씌운눈[0][0])
    s2 = abs(정본눈[1][0] - 정본눈[0][0])
    if s1 < 1:
        return None
    배율 = s2 / s1
    c1 = ((씌운눈[0][0] + 씌운눈[1][0]) / 2, (씌운눈[0][1] + 씌운눈[1][1]) / 2)
    c2 = ((정본눈[0][0] + 정본눈[1][0]) / 2, (정본눈[0][1] + 정본눈[1][1]) / 2)
    return 배율, c1, c2


# ── 겹쳐 맞추기 ────────────────────────────────────────────────────────────

def 눈으로_옮긴판(씌운: Image.Image, 몸: Image.Image, 배율, c씌, c정):
    """씌워 구운 그림을 «정본 몸의 좌표계»로 옮긴다 — 두 눈이 겹치게."""
    큰 = 몸.width
    n = max(8, int(round(씌운.width * 배율)))
    작 = 씌운.resize((n, n), Image.LANCZOS)
    판 = Image.new('RGB', (큰, 큰), (255, 255, 255))
    좌 = (round(c정[0] - c씌[0] * 배율), round(c정[1] - c씌[1] * 배율))
    판.paste(작, 좌)
    return 판


def 옷상자(옮긴: Image.Image, 몸: Image.Image, 문턱=46):
    """정본 몸과 «충분히 다른» 자리 = 옷이 있는 자리. 그 상자를 낸다.

    🔑 몸 색을 골라내지 않는다(09-06 첫 판이 그렇게 하다 실패했다 — 결이 있어 코랄 픽셀이
      제각각이라, 「코랄이 아닌 것」이 몸 전체로 번졌다). 대신 «정본과 견준다» —
      두 눈을 겹쳐 놓았으니 몸은 거의 같은 자리에 있고, 다른 곳이 곧 옷이다.
    ⚠ 몸도 조금 다시 그려지므로 잔 얼룩이 남는다 → 큰 덩어리만 남겨 상자를 문다.
    """
    a = np.asarray(옮긴.convert('RGB')).astype(np.int16)
    b채 = 몸.convert('RGBA')
    바탕 = Image.new('RGB', b채.size, (255, 255, 255))
    바탕.paste(b채, (0, 0), b채)
    b = np.asarray(바탕).astype(np.int16)
    다름 = np.abs(a - b).sum(axis=2) > 문턱 * 3
    다름 = ndimage.binary_opening(다름, np.ones((9, 9), bool))
    표, 수 = ndimage.label(다름)
    if 수 == 0:
        return None
    크기 = ndimage.sum(다름, 표, range(1, 수 + 1))
    남길 = 크기 >= 크기.max() * 0.05                 # 본 덩어리와 그에 붙은 큰 조각만
    골 = np.isin(표, np.where(남길)[0] + 1)
    ys, xs = np.where(골)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def 몸이앞인곳(옮긴: Image.Image, 몸: Image.Image, 문턱=46):
    """씌워 구운 그림에서 «몸이 옷보다 앞에 서 있는» 자리.

    정본과 거의 같은 색이고 정본 몸 안쪽인 곳이 그렇다. 그 자리의 옷 픽셀을 지우면
    고리의 뒤쪽 안벽이 머리 앞으로 나오는 일이 없어진다.
    가장자리는 조금 안쪽으로 깎아(erosion) 윤곽에 실금이 생기지 않게 한다.
    """
    b채 = 몸.convert('RGBA')
    바탕 = Image.new('RGB', b채.size, (255, 255, 255))
    바탕.paste(b채, (0, 0), b채)
    a = np.asarray(옮긴.convert('RGB')).astype(np.int16)
    b = np.asarray(바탕).astype(np.int16)
    몸안 = np.asarray(b채)[:, :, 3] > 128
    같음 = (np.abs(a - b).sum(axis=2) <= 문턱 * 3) & 몸안
    # 🔴 «점점이» 자르면 옷 위에 코랄 알갱이가 뿌려진다(09-06 실측 · 첫 판의 얼룩).
    #   ⇒ 덩어리로 만든 뒤(닫기 → 구멍 메우기) 큰 덩어리만 남기고, 가장자리만 살짝 깎는다.
    같음 = ndimage.binary_opening(같음, np.ones((5, 5), bool))
    같음 = ndimage.binary_closing(같음, np.ones((41, 41), bool))
    같음 = ndimage.binary_fill_holes(같음)
    표, 수 = ndimage.label(같음)
    if 수 == 0:
        return None
    크기 = ndimage.sum(같음, 표, range(1, 수 + 1))
    같음 = np.isin(표, np.where(크기 >= max(크기.max() * 0.08, 몸안.sum() * 0.005))[0] + 1)
    같음 = ndimage.binary_erosion(같음, np.ones((7, 7), bool))
    return 같음 if 같음.any() else None


# ── 본 일 ─────────────────────────────────────────────────────────────────

def 앉힌다(옷경로, 씌운경로, 몸경로, 눈결='검정', 가리기=False):
    몸 = Image.open(몸경로).convert('RGBA')
    씌운 = Image.open(씌운경로).convert('RGB')
    옷 = Image.open(옷경로).convert('RGBA')
    if 옷.size != 씌운.size:
        옷 = 옷.resize(씌운.size, Image.LANCZOS)

    # ⓑ 먼저 — 두 눈으로 씌운 그림을 정본 좌표계로 옮긴다
    씌운눈 = 눈들(씌운, 눈결)
    정본눈 = 눈들(몸, 눈결)
    if 씌운눈 is None or 정본눈 is None:
        raise SystemExit(f'🔴 눈을 못 찾았다(씌운 {bool(씌운눈)} · 정본 {bool(정본눈)}) — 사람이 본다')
    눈맞춤 = 눈에서_옮김(씌운눈, 정본눈)
    if 눈맞춤 is None:
        raise SystemExit('🔴 두 눈 사이를 못 쟀다 — 사람이 본다')
    배율b, c씌, c정 = 눈맞춤
    옮긴 = 눈으로_옮긴판(씌운, 몸, 배율b, c씌, c정)

    # ⓐ 다음 — 「옷이 몸의 어디에 앉나」를 옮긴 그림에서 읽고, 뜬 옷을 그 상자에 맞춘다
    과녁 = 옷상자(옮긴, 몸)
    if 과녁 is None:
        raise SystemExit('🔴 씌운 그림에서 옷 자리를 못 물었다 — 사람이 본다')
    옷칸 = 옷.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    if 옷칸 is None:
        raise SystemExit('🔴 뜬 옷이 비어 있다 — 사람이 본다')

    나비, 높이 = max(1, 과녁[2] - 과녁[0]), max(1, 과녁[3] - 과녁[1])
    잘린 = 옷.crop(옷칸).resize((나비, 높이), Image.LANCZOS)
    층 = Image.new('RGBA', 몸.size, (0, 0, 0, 0))
    층.paste(잘린, (과녁[0], 과녁[1]), 잘린)

    # 🔴 «몸이 앞인 자리»를 옷에서 덜어내는 길 — **기본값은 끔**(09-06 실측).
    #   왜 껐나: 색으로 가르면 «옷이 몸과 같은 색일 때» 옷을 지운다. 코랄·크림 줄무늬
    #   목도리가 통째로 사라졌다(몽글 몸도 코랄이라 「몸이 앞」으로 읽혔다).
    #   ⇒ 대신 굽는 쪽에서 막는다 — 「본보기에서 몸에 가려 안 보이는 부분은 아예 그리지 마라」.
    #   이 손잡이는 그래도 안벽이 남는 장에 «사람이 보고» 쓰는 예비다.
    앞선몸 = 몸이앞인곳(옮긴, 몸) if 가리기 else None
    if 앞선몸 is not None:
        a = np.asarray(층).copy()
        a[:, :, 3] = np.where(앞선몸, 0, a[:, :, 3])
        층 = Image.fromarray(a, 'RGBA')

    판 = 몸.copy()
    판.alpha_composite(층)
    잰것 = {'눈 배율': round(배율b, 3),
            '씌운 눈': [(round(x), round(y)) for x, y in 씌운눈],
            '정본 눈': [(round(x), round(y)) for x, y in 정본눈],
            '옷 과녁': 과녁, '뜬 옷 상자': 옷칸}
    return 판, 층, 잰것


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('옷'); ap.add_argument('씌운'); ap.add_argument('낼곳')
    ap.add_argument('--몸', default='docs/캐릭터/정본_4K/몽글_본체.png')
    ap.add_argument('--눈', default='검정', choices=['검정', '버터'])
    ap.add_argument('--층', help='자리를 맞춘 «옷만» 층도 따로 낸다(앱이 쓸 조각)')
    ap.add_argument('--가리기', action='store_true',
                    help='몸이 앞인 자리를 옷에서 덜어낸다 — 옷과 몸의 색이 다를 때만 쓴다(같으면 옷이 지워진다)')
    a = ap.parse_args()
    판, 층, 잰것 = 앉힌다(a.옷, a.씌운, a.몸, a.눈, a.가리기)
    판.save(a.낼곳)
    if a.층:
        층.save(a.층)
    for k, v in 잰것.items():
        print(f'   {k}: {v}')
    print(f'✅ {a.낼곳}')


if __name__ == '__main__':
    sys.exit(main())
