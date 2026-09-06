"""제미나이 «두 그림» 판에서 옷만 떼어낸다 — 인계문 §⑱ 의 첫 걸음 (2026-09-07 · 0원).

■ 무엇을 받나
  `tools/옷두그림굽기.js` 가 구운 판 = 정본 몸 사진 + 우리 옷 그림을 «함께» 줘서 그린 것.
  몸 위에 직접 그려 빛이 애초에 맞고, 몸은 정본과 거의 같다(참조로 줬으니).
  ⇒ 거기서 옷만 떼어내면 «빛이 맞는 조각»이 되고, 그 조각을 표정 컷 열하나에 그대로 얹을 수 있다.

■ 어떻게 가르나 — 자 셋을 겹친다 (09-07 실측으로 잡은 문턱)
  ① 배경   : 네 귀퉁이 색에서 «테두리를 따라 번져» 잡는다(옅은 회색 바탕 + 부드러운 그림자까지).
             흰 바탕 길(`옷초록떼기.py`)과 같은 자 — 색이 거의 없고 · 바탕만큼 밝고 · 매끈한 곳만 번진다.
  ② 몸     : 정본 털은 «어두운 갈색»인데 밝은 올이 4분의 1이라 색 하나로는 못 가른다(1024판 실측 · 밝기>110 이 24%).
             그래서 «정본과 견준다» — 판을 정본 좌표계로 앉힌 뒤 국소 평균(σ8)의 차이가 작으면 몸이다.
             어두운 갈색이면 문턱을 느슨하게, 아니면 엄격하게. 코랄 발바닥·꼬리·눈은 정본에도 같은 자리에 있어
             «같다»로 걸리고, 코랄 안경테는 정본에 없어 «다르다»로 남는다.
  ③ 옷     : 배경도 몸도 아닌 곳. 몸에 닿은 큰 덩어리만 남기고, 작은 구멍은 메우고, 눈 자리는 판다.

■ §⑦-ⓓ 에서 한 번 접힌 길이다
  「정본과의 차이로 떼기 → 그늘진 크림이 코랄과 가까워 구멍」. 그때는 «몸이 서로 다른 그림»끼리 뺐다.
  지금은 몸이 정본을 참조해 그려져 훨씬 잘 맞고, 픽셀이 아니라 «국소 평균»으로 견주며, 색 자(어두운 갈색)를
  겹쳐 문턱을 두 단으로 둔다. 그래도 뚫리면 그 장은 사람이 본다.

쓰는 법:
  python tools/옷차이떼기.py <두그림판.png> <낼곳_층.png> [--몸 <정본.png>] [--얹음 <미리보기.png>]
                             [--옮긴 <정본좌표로_옮긴판.png>] [--그림자]
  python tools/옷차이떼기.py --판 <낼곳.webp> --조각 "이름=층.png" ["이름=층.png" ...]   # 표정 열하나에 얹은 판
"""
import argparse
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 옷자리맞추기 import 눈들, 눈에서_옮김, 몸으로_맞춘다  # noqa: E402
from 옷초록떼기 import 털결얹기  # noqa: E402

루트 = Path(__file__).resolve().parent.parent
정본방 = 루트 / 'docs/캐릭터/정본_4K'

# 🔑 몸이 그대로인 표정 열하나 (인계문 §⑯ · tools/표정몸재기.py 실측 · 실루엣 겹침 0.970~0.980)
몸같은표정 = ['감동', '궁금함', '놀람', '눈감음', '눈웃음', '민망', '안도', '윙크', '으쓱', '졸림', '집중']


# ── 자 ① 배경 ──────────────────────────────────────────────────────────────

def 배경찾기(a):
    """네 귀퉁이 색을 바탕으로 보고, 테두리에서 «색이 거의 없고 밝고 매끈한» 곳으로 번진다."""
    귀 = np.concatenate([a[:60, :60].reshape(-1, 3), a[:60, -60:].reshape(-1, 3),
                         a[-60:, :60].reshape(-1, 3), a[-60:, -60:].reshape(-1, 3)])
    바탕색 = np.median(귀, axis=0).astype(np.int16)
    닮음 = np.abs(a - 바탕색).sum(axis=2) < 40
    표0, 수0 = ndimage.label(닮음)
    큼 = a.shape[0] * a.shape[1] * 0.03
    테두리 = set(표0[0, :]) | set(표0[-1, :]) | set(표0[:, 0]) | set(표0[:, -1])
    테두리.discard(0)
    테두리 = {i for i in 테두리 if (표0 == i).sum() > 큼}
    씨앗 = np.isin(표0, list(테두리)) if 테두리 else 닮음
    채 = a.max(axis=2) - a.min(axis=2)
    밝 = a.max(axis=2)
    회 = a.mean(axis=2).astype(np.float32)
    평 = ndimage.uniform_filter(회, 9)
    거칠 = np.sqrt(np.maximum(ndimage.uniform_filter(회 * 회, 9) - 평 * 평, 0))
    허용 = (채 < 11) & (밝 > int(바탕색.max()) - 70) & (거칠 < 1.1)
    배경 = ndimage.binary_propagation(씨앗, mask=(씨앗 | 허용))
    return 배경, 바탕색


# ── 자 ② 몸 ────────────────────────────────────────────────────────────────

def 어두운갈색(a):
    """까몽 털의 «어두운 쪽» — 밝기 110 미만 · 채도 60 미만 · 파랑이 붉음을 안 넘는다.
    파란 델(파랑이 세다)·코랄(채도 74 이상)·크림(밝다)·초록 홍채는 여기 안 걸린다."""
    r, b = a[:, :, 0], a[:, :, 2]
    밝 = a.max(axis=2)
    채 = 밝 - a.min(axis=2)
    return (밝 < 110) & (채 < 60) & (b <= r + 5)


def 흐린판(im: Image.Image, 반지름):
    return np.asarray(im.filter(ImageFilter.GaussianBlur(반지름)), dtype=np.int16)


def 코랄(a):
    """까몽의 발바닥·꼬리 판 색. 코랄 옷(안경테·목도리 줄)도 같은 색이라 «정본에 코랄이 있는 자리 근처»에서만 몸으로 본다."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    return (r > 150) & (r - g > 50) & (r - b > 50)


def 회색같음(a, 바탕색, 채문턱=14):
    """색이 거의 없고 바탕만큼 밝은 곳 — 바닥 그림자일 수도, 흰 천일 수도 있다. 어느 쪽인지는 «참조 옷»이 정한다."""
    채 = a.max(axis=2) - a.min(axis=2)
    밝 = a.max(axis=2)
    return (채 < 채문턱) & (밝 > int(바탕색.max()) - 120)


def 근처(마스크, 거리, 판=2048):
    """마스크에서 «거리» 칸 안 — 큰 팽창은 절반 판의 거리 변환으로(4096 팽창은 느리고 램을 문다)."""
    h, w = 마스크.shape
    작 = np.asarray(Image.fromarray((마스크 * 255).astype(np.uint8), 'L').resize((판, 판), Image.NEAREST)) > 127
    d = ndimage.distance_transform_edt(~작) * (h / 판)
    d = np.asarray(Image.fromarray(np.minimum(d, 65535).astype(np.float32), 'F').resize((w, h), Image.BILINEAR))
    return d < 거리


def 참조흰천몫(참조경로들):
    """우리가 제미나이에게 준 옷 그림(들)의 밝은 천 중 «흰·회색에 가까운» 것의 몫. 없으면 판의 회색은 전부 바닥 그림자다.

    🔴 왜 이 자인가 (09-07 실측) — 바닥 그림자와 흰 천은 색(둘 다 r-b 0~13)·결(거칠기 1.1 vs 1.3)·기울기
      (둘 다 배경으로 서서히 흐려진다) 어느 자로도 안 갈렸다. 갈리는 것은 하나 — 그림자는 우리가 준 참조에 없다.
    🔴 문턱은 채도 26 이다 (09-07 실측 · 첫 판은 14 로 잡아 후드 어깨를 잘랐다). 참조의 SYNK 후드는 «따뜻한 크림»
      (채 중앙값 25)인데 제미나이는 그것을 «중성 흰색»(채 14 미만)으로 그린다. 참조 21벌 실측:
      흰 천이 있는 넷 = 후드 55% · 1급 배지 코트 95% · 2급 89% · 첫 목소리 목도리 99% · 새싹(흰 원반) 91%,
      없는 것 = 겨울 델 5.7% · 몽골 모자 11% · 털모자 5.7% · 앞치마 1.1% · 나머지 0~3%. 25% 에서 갈린다.
    """
    합, 흰 = 0, 0
    for p in 참조경로들:
        im = Image.open(p).convert('RGBA')
        a = np.asarray(im).astype(np.int16)
        있다 = a[:, :, 3] > 128
        rgb = a[:, :, :3]
        채 = rgb.max(axis=2) - rgb.min(axis=2)
        밝 = rgb.max(axis=2)
        밝은 = 있다 & (밝 > 150)
        합 += int(밝은.sum())
        흰 += int((밝은 & (채 < 26)).sum())
    return (흰 / 합) if 합 else None


def 털같음넓게(a):
    """밝은 올까지 포함한 «털일 수 있는 색» — 갈색 기운(r ≥ g ≥ b 쪽) · 채도 70 미만 · 아주 밝지 않다.
    크림 천도 여기 걸리므로, 이 자는 «가늘게 늘어진 것»에만 쓴다(넓은 크림 천은 열림 연산이 살린다)."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    밝 = a.max(axis=2)
    채 = 밝 - a.min(axis=2)
    return (r >= g - 3) & (g >= b - 8) & (채 < 70) & (밝 < 215)


def 판이름에서_옷들(판경로):
    """`까몽_겨울델_제미나이두그림.png` · `까몽_겹쳐_겨울델+털모자+목도리.png` · `까몽_겨울델+털모자.png` → 옷 이름들."""
    이름 = Path(판경로).stem
    for 꼬리 in ('_제미나이두그림', '_두그림'):
        if 이름.endswith(꼬리):
            이름 = 이름[: -len(꼬리)]
    부 = 이름.split('_')
    if len(부) >= 2:
        부 = 부[1:]
    if 부 and 부[0] == '겹쳐':
        부 = 부[1:]
    return [s for s in '_'.join(부).split('+') if s]


def 눈반지름(몸rgb, 중심, 최대=320):
    """정본 눈 = 검은 구슬 둘레의 초록 홍채 고리. 고리의 «바깥끝»이 눈의 반지름이다."""
    ex, ey = int(중심[0]), int(중심[1])
    h, w = 몸rgb.shape[:2]
    y0, y1 = max(0, ey - 최대), min(h, ey + 최대)
    x0, x1 = max(0, ex - 최대), min(w, ex + 최대)
    창 = 몸rgb[y0:y1, x0:x1]
    r, g, b = 창[:, :, 0], 창[:, :, 1], 창[:, :, 2]
    초록 = (g > 90) & (g - r > 15) & (g - b > 20)
    if not 초록.any():
        return 150
    ys, xs = np.nonzero(초록)
    d = np.sqrt((xs + x0 - ex) ** 2 + (ys + y0 - ey) ** 2)
    return int(np.percentile(d, 99) * 1.12 + 8)


# ── 본 일 ─────────────────────────────────────────────────────────────────

def 떼어낸다(판경로, 몸경로, 그림자=False, 엄격=45, 느슨=110, 흐림=8, 참조경로들=None):
    몸 = Image.open(몸경로).convert('RGBA')
    흰천몫 = 참조흰천몫(참조경로들) if 참조경로들 else None
    판 = Image.open(판경로).convert('RGB')
    if 판.size != 몸.size:
        판 = 판.resize(몸.size, Image.LANCZOS)
    a = np.asarray(판).astype(np.int16)
    배경, 바탕색 = 배경찾기(a)
    앞 = ~배경
    털m = 앞 & 어두운갈색(a)

    # 눈으로 «어디쯤»을 잡고 몸으로 «얼마나 큰가»를 잡는다 (옷자리맞추기.몸으로_맞춘다 · 옷 자리는 안 센다)
    정본눈 = 눈들(몸, '초록')
    if 정본눈 is None:
        raise SystemExit('🔴 정본에서 눈을 못 찾았다 — 사람이 본다')
    판눈 = 눈들(판, '초록')
    눈출처 = '판'
    if 판눈 is not None:
        정본사이 = abs(정본눈[1][0] - 정본눈[0][0])
        판사이 = abs(판눈[1][0] - 판눈[0][0])
        if not (0.6 <= 판사이 / max(1, 정본사이) <= 1.4) or any(not 앞[int(y), int(x)] for x, y in 판눈):
            판눈 = None
    if 판눈 is None:
        판눈 = [(float(x), float(y)) for x, y in 정본눈]      # 지시문이 프레임을 지키라 했으니 정본 자리로 시작
        눈출처 = '정본(판에서 못 찾음)'
    맞춤 = 눈에서_옮김(판눈, 정본눈)
    if 맞춤 is None:
        raise SystemExit('🔴 두 눈 사이를 못 쟀다 — 사람이 본다')
    몸알파 = np.asarray(몸)[:, :, 3] > 128
    맞음 = 몸으로_맞춘다(털m, 배경, 몸알파, 맞춤)
    if 맞음 is None:
        raise SystemExit('🔴 몸으로 자리를 못 잡았다 — 사람이 본다')
    sx, sy, dx, dy = 맞음['sx'], 맞음['sy'], 맞음['dx'], 맞음['dy']

    # 판을 정본 좌표계로 옮긴다 — 바깥은 바탕색으로 채워 배경으로 걸리게
    w, h = 판.size
    작 = 판.resize((max(8, round(w * sx)), max(8, round(h * sy))), Image.LANCZOS)
    옮긴 = Image.new('RGB', 몸.size, tuple(int(v) for v in 바탕색))
    옮긴.paste(작, (round(dx), round(dy)))
    a2 = np.asarray(옮긴).astype(np.int16)
    배경2, _ = 배경찾기(a2)
    앞2 = ~배경2
    털2 = 앞2 & 어두운갈색(a2)

    # 정본을 같은 바탕색 위에 얹어 «같은 조건»으로 견준다 (가장자리의 반투명 털도 같은 회색과 섞인다)
    바탕판 = Image.new('RGBA', 몸.size, tuple(int(v) for v in 바탕색) + (255,))
    바탕판.alpha_composite(몸)
    정본rgb = 바탕판.convert('RGB')
    D = np.abs(흐린판(옮긴, 흐림) - 흐린판(정본rgb, 흐림)).sum(axis=2)
    몸이다 = (D < 엄격) | (털2 & (D < 느슨))
    옷 = 앞2 & ~몸이다

    # 🔴 «어긋난 테두리»를 걷는다 (09-07 첫 판 실측 · 귀·발 둘레에 어두운 털 테가 붙고 꼬리 판의 코랄 테가 남았다).
    #   판의 몸은 정본과 «거의» 같지만 귀 자리·꼬리 판이 몇 십 칸씩 어긋나서, 그 자리의 털·코랄이 정본과
    #   «다르다»로 걸려 옷이 됐다. 🔑 정본 몸 근처(60칸)의 어두운 갈색은 털이고, 정본 코랄 근처(60칸)의 코랄은 발바닥이다.
    #   옷 21벌에 어두운 갈색 천은 없고(팻말은 귀리색), 코랄 옷이 발바닥 «바로 위»에 오는 일도 없다.
    근처몸 = 근처(몸알파, 120)
    옷 &= ~(털2 & 근처몸)
    # ⚠ «밝은 털올»까지 걷는 자는 세웠다가 걷었다 (09-07 셋째 판). 갈색 기운·채도 70 미만·밝기 215 미만을 «가늘면»
    #   털로 봤는데, 니트 털모자와 후드는 결 때문에 그 자에 통째로 «가늘게» 걸려 구멍투성이가 됐다.
    #   밝은 털 테두리는 남는다 — 정본 털 위에 얹히면 털로 읽히니 흠이 아니다.
    몸rgb0 = np.asarray(몸.convert('RGB')).astype(np.int16)
    정본코랄 = 코랄(몸rgb0) & 몸알파
    if 정본코랄.any():
        옷 &= ~(코랄(a2) & 근처(정본코랄, 60))
    # 🔴 바닥 그림자 — 참조 옷에 흰 천이 없을 때만 «회색 = 그림자»로 걷는다(위 참조흰천몫 의 까닭).
    #   배경이 순백(250 이상)인 판은 걷지 않는다 — 지시문이 순백을 시킨 판에는 바닥 그림자가 거의 없고(09-07 실측
    #   겹쳐 입기 둘 0.4%·3.3%), 거기서 회색을 걷으면 흰 천만 다친다.
    #   몸 안팎을 가리지 않는다 — 꼬리 «둘레»의 그림자는 정본 몸 근처라 첫 판에서 안 걷혔다. 안경 알의 번쩍임 같은
    #   몸 안 회색도 같이 걷히는데, 그것은 표정 컷에 얹을 때 오히려 없어야 한다.
    #   🔑 «바탕보다 어두운» 회색만 걷는다(바탕 최대값 −15 미만). 그림자는 바탕보다 어둡고(실측 135~215 · 바탕 229),
    #   크림 깃의 제일 밝은 자리(채도 14 미만으로 떨어지는 하이라이트)는 바탕만큼 밝아 안 걸린다 — 셋째 판에서 깃 윗단이 뜯긴 자리.
    회색은그림자 = 흰천몫 is not None and 흰천몫 < 0.25 and int(바탕색.max()) < 250
    if 회색은그림자:
        옷 &= ~(회색같음(a2, 바탕색) & (a2.max(axis=2) < int(바탕색.max()) - 15))

    # 정리 — 자잘한 것 걷고 · 몸에 닿은 덩어리만 · 작은 구멍 메우기 · 눈 파기
    옷 = ndimage.binary_opening(옷, np.ones((7, 7), bool))
    표, 수 = ndimage.label(옷, structure=np.ones((3, 3), bool))
    if 수 == 0:
        raise SystemExit('🔴 옷으로 잡힌 곳이 없다 — 몸과 다른 곳이 없는 그림이다')
    크기 = ndimage.sum(옷, 표, range(1, 수 + 1))
    남길 = np.where(크기 >= max(크기.max() * 0.02, a.shape[0] * a.shape[1] * 1e-4))[0] + 1
    옷 = np.isin(표, 남길)
    몸닿음 = ndimage.binary_dilation(몸알파, np.ones((41, 41), bool))
    표2, 수2 = ndimage.label(옷, structure=np.ones((3, 3), bool))
    if 수2:
        닿는가 = ndimage.sum(몸닿음, 표2, range(1, 수2 + 1)) > 0
        # 🔴 회색이 그림자인 판에서는 «따로 떨어진 회색빛 덩어리»도 그림자다 (09-07 넷째 판 · 꼬리 옆에 옅은 얼룩 둘이 남았다 —
        #   몸 가까운 그림자는 몸의 갈색이 번져 채도가 14 를 넘어 «회색» 자를 빠져나갔다). 제일 큰 덩어리(옷 본체)는 면제한다.
        if 회색은그림자:
            칸수 = ndimage.sum(옷, 표2, range(1, 수2 + 1))
            채2 = a2.max(axis=2) - a2.min(axis=2)
            평균채 = ndimage.mean(채2, 표2, range(1, 수2 + 1))
            평균밝 = ndimage.mean(a2.max(axis=2), 표2, range(1, 수2 + 1))
            회색덩어리 = (평균채 < 24) & (평균밝 > 100)
            회색덩어리[int(np.argmax(칸수))] = False
            닿는가 &= ~회색덩어리
        옷 = np.isin(표2, np.where(닿는가)[0] + 1)
        if not 옷.any():
            raise SystemExit('🔴 몸에 닿은 옷 덩어리가 없다 — 사람이 본다')
    옷 = ndimage.binary_closing(옷, np.ones((9, 9), bool))
    메움 = ndimage.binary_fill_holes(옷) & ~옷
    표3, 수3 = ndimage.label(메움)
    if 수3:
        구멍크기 = ndimage.sum(메움, 표3, range(1, 수3 + 1))
        옷 |= np.isin(표3, np.where(구멍크기 < 옷.sum() * 0.18)[0] + 1)
    # 🔴 눈은 «마지막»에 판다 — 안경 알 안쪽·후드 얼굴 구멍이 메워졌더라도 눈만은 반드시 비워야
    #   표정 컷(윙크·눈감음)에 얹었을 때 본체의 눈이 따라오지 않는다.
    몸rgb = 몸rgb0
    yy, xx = np.ogrid[:옷.shape[0], :옷.shape[1]]
    눈반들 = []
    for ex, ey in 정본눈:
        반 = 눈반지름(몸rgb, (ex, ey))
        눈반들.append(반)
        옷 &= ~(((xx - ex) ** 2 + (yy - ey) ** 2) <= 반 ** 2)

    알파 = Image.fromarray((옷 * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1.6))
    층 = 옮긴.convert('RGBA')
    층.putalpha(알파)
    if 그림자:
        층 = 털결얹기(층, 몸, 세기=0.0)        # 털끝 넘기기는 판에 이미 있으니 접촉 그림자만

    # 잰 것 — 몸이 정본과 얼마나 맞나 (§⑱ 의 첫 물음)
    털겹침 = float((털2 & 몸알파).sum()) / float(max(1, 털2.sum()))
    바깥털 = float((앞2 & ~옷 & ~몸알파).sum()) / float(max(1, (앞2 & ~옷).sum()))
    잰것 = {
        '눈 출처': 눈출처, '눈 배율': round(맞춤[0], 3),
        '몸 크기': f'{sx:.3f}×{sy:.3f}', '옮김': (round(dx), round(dy)),
        '확신': round(맞음['확신'], 3), '몸맞음': round(맞음['몸맞음'], 3), '안겹침': round(맞음['안겹침'], 3),
        '옷 칸수': int(옷.sum()), '눈 반지름': 눈반들,
        '참조의 흰 천 몫': ('안 봤다' if 흰천몫 is None else
                       f'{흰천몫:.1%} · 배경 {int(바탕색.max())} → 회색은 {"그림자(걷는다)" if 회색은그림자 else "천(살린다)"}'),
        '어두운 털이 정본 몸 안에 든 몫': round(털겹침, 3),
        '옷 아닌 앞 중 정본 몸 밖 몫': round(바깥털, 3),
    }
    return 층, 옮긴, 몸, 잰것


# ── 판 — 표정 열하나에 얹어 본다 ────────────────────────────────────────────

def 판만들기(조각들, 낼곳, 칸높=300, 줄당=7):
    import importlib.util
    spec = importlib.util.spec_from_file_location('옷입혀보기', 루트 / 'tools/옷입혀보기.py')
    M = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(M)
    칸 = []
    본체 = 정본방 / '까몽_본체.png'
    for 이름, 층경로, 옮긴경로, 옛경로 in 조각들:
        if 옮긴경로 and Path(옮긴경로).exists():
            im = Image.open(옮긴경로).convert('RGB')
            칸.append((f'{이름} · 제미나이 판', im))
        칸.append((f'{이름} · 새 조각 → 본체', M.잘라(M.입힌다(본체, [층경로]))))
        if 옛경로 and Path(옛경로).exists():
            칸.append((f'{이름} · 옛 조각 → 본체', M.잘라(M.입힌다(본체, [옛경로]))))
        else:
            칸.append((f'{이름} · (옛 조각 없음 · 맨몸)', M.잘라(M.입힌다(본체, []))))   # 칸 수를 맞춰 줄이 안 밀리게
        for 표정 in 몸같은표정:
            p = 정본방 / f'까몽_{표정}.png'
            if not p.exists():
                raise SystemExit(f'🔴 표정 컷이 없다 — {p}(빠진 채 완료를 찍지 않는다)')
            칸.append((f'{이름} · {표정}', M.잘라(M.입힌다(p, [층경로]))))
    판 = M.판만들기(칸, 칸높=칸높, 줄당=줄당)
    판.save(낼곳, quality=88, method=6)
    print(f'✅ {낼곳} — {len(칸)}칸 · {판.width}×{판.height}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('판', nargs='?')
    ap.add_argument('낼곳', nargs='?')
    ap.add_argument('--몸', default=str(정본방 / '까몽_본체.png'))
    ap.add_argument('--얹음', help='정본 몸 위에 얹은 미리보기')
    ap.add_argument('--옮긴', help='정본 좌표계로 옮긴 판(견줌용)')
    ap.add_argument('--그림자', action='store_true', help='접촉 그림자를 넣는다(옷초록떼기.털결얹기 · 털끝은 안 넘긴다)')
    ap.add_argument('--엄격', type=int, default=45)
    ap.add_argument('--느슨', type=int, default=110)
    ap.add_argument('--마스코트', default='까몽')
    ap.add_argument('--참조', nargs='*',
                    help='제미나이에게 준 옷 그림(들). 안 주면 판 이름에서 옷 이름을 읽어 docs/Loom_자산/옷/층/ 에서 찾는다')
    ap.add_argument('--판', dest='판낼곳', help='표정 판을 낸다 — --조각 과 함께')
    ap.add_argument('--조각', nargs='*', help='"이름=층.png[=옮긴.png[=옛층.png]]"')
    ap.add_argument('--칸높', type=int, default=300)
    a = ap.parse_args()

    if a.판낼곳:
        조각들 = []
        for s in a.조각 or []:
            부 = s.split('=')
            조각들.append((부[0], 부[1], 부[2] if len(부) > 2 else None, 부[3] if len(부) > 3 else None))
        if not 조각들:
            raise SystemExit('🔴 --조각 이 비었다')
        판만들기(조각들, a.판낼곳, 칸높=a.칸높)
        return
    if not a.판 or not a.낼곳:
        raise SystemExit('🔴 <두그림판.png> <낼곳_층.png> 이 있어야 한다')
    참조들 = a.참조
    if not 참조들:
        참조들 = []
        for 이름 in 판이름에서_옷들(a.판):
            p = 루트 / 'docs/Loom_자산/옷/층' / f'옷_{a.마스코트}_{이름}.png'
            if not p.exists():
                raise SystemExit(f'🔴 참조 옷 그림이 없다 — {p} (--참조 로 직접 준다)')
            참조들.append(str(p))
    층, 옮긴, 몸, 잰것 = 떼어낸다(a.판, a.몸, a.그림자, a.엄격, a.느슨, 참조경로들=참조들)
    Path(a.낼곳).parent.mkdir(parents=True, exist_ok=True)
    층.save(a.낼곳)
    if a.옮긴:
        옮긴.save(a.옮긴)
    if a.얹음:
        미리 = 몸.copy()
        미리.alpha_composite(층)
        미리.save(a.얹음)
    for k, v in 잰것.items():
        print(f'   {k}: {v}')
    표 = '✅' if 잰것['확신'] >= 0.80 else '🟡'
    print(f'{표} {a.낼곳} — 옷 {잰것["옷 칸수"]:,}점 · 확신 {잰것["확신"]:.2f}')


if __name__ == '__main__':
    main()
