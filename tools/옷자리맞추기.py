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
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.signal import fftconvolve


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


def 겹쳐맞춘다(옷: Image.Image, 옮긴: Image.Image, 판=384):
    """뜬 옷을 «옮긴 그림» 위에서 가장 잘 겹치는 크기·자리로 찾는다. (배율, dx, dy) 또는 None.

    🔴 왜 필요한가 (09-06 실측 · 이 자리를 세 번 갈았다)
      ② 단계(옷만 다시 굽기)는 「같은 자리 같은 크기」를 시켜도 «항상» 지키지 않는다.
      겨울 델은 지켰고 목도리는 물체를 프레임 가득 키워 그렸다. 그래서 프레임을 믿으면
      어떤 옷은 맞고 어떤 옷은 몸을 통째로 감싼다.
      상자로 맞추는 길도 실패했다 — 작은 악세는 «몸이 다시 그려진 차이»에 묻혀 상자가
      몸 전체가 되고 모자가 몸만 해졌다.
      ⇒ 남은 길은 하나, **그림끼리 실제로 겹쳐 보는 것**이다. 같은 옷이 두 그림에 다 있다.

    어떻게: 크기 후보마다 «가린 상관»(masked normalized cross-correlation)을 FFT 로 한 번에 구한다.
      옷이 있는 자리(알파)만 세고, 밝기의 평균·세기로 나눠 크기가 다른 후보끼리 견줄 수 있게 한다.
      (그냥 상관을 쓰면 «큰 조각»이 언제나 이긴다 — 첫 판이 늘 배율 1.0 을 낸 까닭이다.)
    """
    # 🔴 찾는 범위를 «작은 흔들림» 안으로 묶는다 (09-06 실측 · 셋째 갈이).
    #   묶지 않으면 흰 바닥 위 아무 데나 높은 점수가 나서 모자가 몸 아래로 떨어졌다.
    #   ② 단계는 대체로 프레임을 지키므로 어긋남은 «조금»이다. 크게 튀면 그건 맞춘 게 아니라
    #   잘못 구운 것이고, 그때는 점수가 낮게 나와 다시 굽게 한다.
    W = 판
    I = np.asarray(옮긴.convert('L').resize((W, W), Image.LANCZOS)).astype(np.float32)
    I2 = I * I
    한계 = int(W * 0.08)
    제일 = None
    for s in np.arange(0.90, 1.115, 0.025):
        n = max(8, int(W * s))
        if n > W:                                   # 판보다 큰 조각은 못 놓는다
            continue
        작 = 옷.resize((n, n), Image.LANCZOS)
        G = np.asarray(작.convert('L')).astype(np.float32)
        M = (np.asarray(작)[:, :, 3] > 128).astype(np.float32)
        칸수 = M.sum()
        if 칸수 < W * W * 0.004:                    # 너무 작으면 아무 데나 잘 맞는다
            continue
        Gz = (G - (G * M).sum() / 칸수) * M
        Gn = float(np.sqrt((Gz * Gz).sum()))
        if Gn < 1e-3:
            continue
        Mr, Gr = M[::-1, ::-1], Gz[::-1, ::-1]
        합 = fftconvolve(I, Mr, mode='same')
        합2 = fftconvolve(I2, Mr, mode='same')
        분자 = fftconvolve(I, Gr, mode='same')
        분모 = np.sqrt(np.maximum(합2 - 합 * 합 / 칸수, 1e-6)) * Gn
        점수판 = 분자 / 분모
        가운데 = W // 2
        창 = 점수판[가운데 - 한계:가운데 + 한계, 가운데 - 한계:가운데 + 한계]
        칸안 = np.unravel_index(np.argmax(창), 창.shape)
        칸 = (칸안[0] + 가운데 - 한계, 칸안[1] + 가운데 - 한계)
        점수 = float(점수판[칸])
        if 제일 is None or 점수 > 제일[0]:
            제일 = (점수, float(s), (칸[1] - W / 2.0) / W, (칸[0] - W / 2.0) / W)
    return 제일


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


def 으뜸색(im: Image.Image, 알파쓰기=True):
    """그림에서 가장 흔한 색(16단계로 뭉쳐서). 결이 있어 픽셀마다 다르므로 뭉쳐야 잡힌다."""
    a = np.asarray(im.convert('RGBA'))
    쓸것 = a[a[:, :, 3] > 200][:, :3] if 알파쓰기 else a.reshape(-1, 4)[:, :3]
    if len(쓸것) == 0:
        return None
    q = (쓸것 // 16 * 16 + 8).astype(np.int32)
    키 = q[:, 0] * 65536 + q[:, 1] * 256 + q[:, 2]
    값, 수 = np.unique(키, return_counts=True)
    k = int(값[수.argmax()])
    return np.array([k // 65536, (k // 256) % 256, k % 256], dtype=np.int16)


def 가릴까(옷: Image.Image, 몸: Image.Image, 멀기=250):
    """«몸이 앞인 자리»를 오려낼지 스스로 정한다 (09-06 신설).

    🔴 왜 자동인가 — 오려내기는 옷과 몸의 색이 «다를 때만» 안전하다:
      · 겨울 델(짙은 남색) : 오려내야 한다. 안 하면 깃의 뒤쪽 안벽이 머리 앞으로 나와 그릇이 된다.
      · 목도리(코랄·크림)  : 오려내면 안 된다. 몽글 몸도 코랄이라 목도리가 통째로 지워졌다(실측).
    ⇒ 두 으뜸색이 충분히 멀 때만 켠다. 사람이 옷마다 손으로 켜면 예순 벌에 사람이 붙는다.
    🔴 문턱 250 은 실측으로 잡았다(09-06): 겨울 델 400(켜야 한다) · 목도리 144(끄야 한다).
    """
    c1, c2 = 으뜸색(옷), 으뜸색(몸)
    if c1 is None or c2 is None:
        return False, None
    거리 = int(np.abs(c1 - c2).sum())
    return 거리 >= 멀기, 거리


def 딸려온몸걷기(옷: Image.Image, 몸: Image.Image, 가깝기=110):
    """옷 조각에 «딸려 들어온 몸 조각»을 걷는다 (09-06 신설 · 0원).

    🔴 무엇이 문제였나: ② 단계가 옷만 그리라 해도 몽글의 «가리비 밑단»을 함께 그려 내는 장이
      있었다(털모자·펠트 헤드폰 아래의 분홍 띠). 그대로 얹으면 몸 아래에 코랄 띠가 겹쳐 뜬다.

    🔑 어떻게 안전하게 가르나 — 두 조건을 «동시에» 만족하는 덩어리만 걷는다:
      ① 옷의 본 덩어리와 «떨어져» 있다 (모자와 띠는 안 붙어 있다)
      ② 그 덩어리의 으뜸색이 «몸 색에 가깝다» (딸려온 몸이라 그렇다)
    하나만 보면 위험하다 — ①만 보면 폼폼·술처럼 원래 떨어진 부품이 죽고,
    ②만 보면 몸과 같은 코랄 목도리가 통째로 죽는다(09-06 실측 둘 다 밟았다).
    """
    a = np.asarray(옷.convert('RGBA'))
    있다 = a[:, :, 3] > 128
    표, 수 = ndimage.label(있다, structure=np.ones((3, 3), bool))
    if 수 <= 1:
        return 옷, 0
    크기 = ndimage.sum(있다, 표, range(1, 수 + 1))
    본덩어리 = int(np.argmax(크기)) + 1
    몸색 = 으뜸색(몸)
    걷은수 = 0
    새알파 = a[:, :, 3].copy()
    for i in range(1, 수 + 1):
        if i == 본덩어리:
            continue
        골 = 표 == i
        색 = np.median(a[골][:, :3], axis=0).astype(np.int16)
        if int(np.abs(색 - 몸색).sum()) <= 가깝기:
            새알파[골] = 0
            걷은수 += int(골.sum())
    if 걷은수 == 0:
        return 옷, 0
    b = a.copy()
    b[:, :, 3] = 새알파
    return Image.fromarray(b, 'RGBA'), 걷은수


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

def 앉힌다(옷경로, 씌운경로, 몸경로, 눈결='검정', 가리기='자동'):
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

    # ⓐ 다음 — 뜬 옷에 «그 변환을 그대로» 먹인다. 크기를 다시 잡지 않는다.
    #
    # 🔴 09-06 실측이 이 자리를 두 번 갈았다.
    #   첫 판: 「옷이 몸의 어디에 앉나」를 씌운 그림에서 상자로 읽고 뜬 옷을 그 상자에 맞췄다.
    #     → 작은 악세가 통째로 부풀었다(몽골 모자·털모자·안경·첫 목소리 목도리 넷).
    #     까닭: 상자를 「정본 몸과 다른 곳」으로 무는데, 씌워 구울 때 **몸도 조금 다시 그려진다.**
    #     큰 옷은 그 차이를 덮지만 작은 악세는 묻혀서, 상자가 «몸 전체»가 되고 모자가 몸만 해졌다.
    #   지금 판: 뜬 옷은 이미 씌운 그림과 «같은 네모·같은 자리»다(지시문이 그렇게 시킨다).
    #     그러니 씌운 그림에 먹인 변환을 옷에도 그대로 먹이면 끝이다. 늘리는 단계가 없으니
    #     작은 것이 부풀 자리도 없다.
    옷, 걷은수 = 딸려온몸걷기(옷, 몸)
    옷칸 = 옷.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    if 옷칸 is None:
        raise SystemExit('🔴 뜬 옷이 비어 있다 — 사람이 본다')
    # 🔴 순서가 급소다 (09-06 실측 · 넷째 갈이).
    #   옷 조각은 «씌운 그림의 좌표계»에 있다. 그런데 씌워 구울 때 마스코트가 크게 다시
    #   그려지는 장이 있다 — 털모자는 몽글이 훨씬 작고 낮게 나와 눈 배율이 1.31 이었다.
    #   그래서 ①눈 변환을 «먼저» 옷에도 먹여 정본 좌표계로 옮기고, ②그 뒤에 작은 흔들림만
    #   겹쳐 맞춘다. 순서를 바꾸면 필요한 배율이 찾는 범위 밖이라 영영 못 맞춘다.
    큰 = 몸.width
    n0 = max(8, int(round(옷.width * 배율b)))
    옮긴옷0 = 옷.resize((n0, n0), Image.LANCZOS)
    기본 = Image.new('RGBA', 몸.size, (0, 0, 0, 0))
    기본.paste(옮긴옷0, (round(c정[0] - c씌[0] * 배율b), round(c정[1] - c씌[1] * 배율b)), 옮긴옷0)

    겹침 = 겹쳐맞춘다(기본, 옮긴)
    if 겹침 is None:
        raise SystemExit('🔴 뜬 옷을 씌운 그림 위에 못 겹쳤다 — 사람이 본다')
    점수, 배율a, dx, dy = 겹침
    n = max(8, int(round(큰 * 배율a)))
    옮긴옷 = 기본.resize((n, n), Image.LANCZOS)
    좌 = (round(큰 / 2 + dx * 큰 - n / 2), round(큰 / 2 + dy * 큰 - n / 2))
    층 = Image.new('RGBA', 몸.size, (0, 0, 0, 0))
    층.paste(옮긴옷, 좌, 옮긴옷)

    # 🔴 «몸이 앞인 자리»를 옷에서 덜어내는 길 — **기본값은 끔**(09-06 실측).
    #   왜 껐나: 색으로 가르면 «옷이 몸과 같은 색일 때» 옷을 지운다. 코랄·크림 줄무늬
    #   목도리가 통째로 사라졌다(몽글 몸도 코랄이라 「몸이 앞」으로 읽혔다).
    #   ⇒ 대신 굽는 쪽에서 막는다 — 「본보기에서 몸에 가려 안 보이는 부분은 아예 그리지 마라」.
    #   이 손잡이는 그래도 안벽이 남는 장에 «사람이 보고» 쓰는 예비다.
    켤까, 색거리 = 가릴까(옷, 몸)
    켠다 = 켤까 if 가리기 == '자동' else (가리기 == '켬')
    앞선몸 = 몸이앞인곳(옮긴, 몸) if 켠다 else None
    if 앞선몸 is not None:
        # 🔑 가장자리를 흐린다 — 딱 잘라내면 깃 위에 계단 무늬가 남는다(09-06 실측).
        마스크 = Image.fromarray((앞선몸 * 255).astype(np.uint8), 'L')
        마스크 = 마스크.filter(ImageFilter.GaussianBlur(9))
        a = np.asarray(층).astype(np.float32).copy()
        a[:, :, 3] *= (1.0 - np.asarray(마스크).astype(np.float32) / 255.0)
        층 = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

    판 = 몸.copy()
    판.alpha_composite(층)
    잰것 = {'눈 배율': round(배율b, 3),
            '씌운 눈': [(round(x), round(y)) for x, y in 씌운눈],
            '정본 눈': [(round(x), round(y)) for x, y in 정본눈],
            '겹침': f'배율 {배율a:.2f} · 점수 {점수:.3f}', '확신': round(점수, 3),
            '딸려온 몸 걷음': f'{걷은수:,}점' if 걷은수 else '없다', '옮긴 자리': 좌,
            '가리기': f"{'켬' if 켠다 else '끔'}(색 거리 {색거리})"}
    return 판, 층, 잰것


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('옷'); ap.add_argument('씌운'); ap.add_argument('낼곳')
    ap.add_argument('--몸', default='docs/캐릭터/정본_4K/몽글_본체.png')
    ap.add_argument('--눈', default='검정', choices=['검정', '버터'])
    ap.add_argument('--층', help='자리를 맞춘 «옷만» 층도 따로 낸다(앱이 쓸 조각)')
    ap.add_argument('--확신문턱', type=float, default=0.55,
                    help='겹친 점수가 이보다 낮으면 3 으로 끝난다 — 그 장은 옷만 뜨기를 다시 한다')
    ap.add_argument('--가리기', default='자동', choices=['자동', '켬', '끔'],
                    help='몸이 앞인 자리를 옷에서 덜어낼지. 자동 = 옷과 몸의 으뜸색이 멀 때만 켠다')
    a = ap.parse_args()
    판, 층, 잰것 = 앉힌다(a.옷, a.씌운, a.몸, a.눈, a.가리기)
    판.save(a.낼곳)
    if a.층:
        층.save(a.층)
    for k, v in 잰것.items():
        print(f'   {k}: {v}')
    print(f'✅ {a.낼곳}')
    # 🔑 «확신»을 숫자로 내보낸다 — 낮으면 자리가 아니라 «옷만 뜨기»가 잘못된 것이다.
    #   부르는 쪽(tools/옷굽기.js)이 이 코드를 보고 그 장만 다시 굽는다. 조용히 넘어가지 않는다.
    if 잰것.get('확신', 1.0) < a.확신문턱:
        print(f'⚠ 확신이 낮다({잰것.get("확신"):.3f} < {a.확신문턱}) — 옷만 뜨기를 다시 해야 한다')
        return 3
    return 0


if __name__ == '__main__':
    sys.exit(main())
