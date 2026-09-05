"""Loom L2b — 펠트 패치 라이브러리. 원료 패치를 «잘라» 두고, 재염색으로 임의 색을 0원에 파생한다.

왜 있나(설계 정본 `docs/펠트엔진_설계.md` §2 L2b · §3-3 「신규 파일이라 자유」):
  지금 펠트를 입는 것은 마스코트뿐이다 — 결이 필요한 새 오브젝트(녹음 오브·3D 타이포·캠페인 오브)는
  매번 사진에서 손으로 잘라 쓰거나, 생성 모델을 다시 굴려야 했다. 후자는 헌법 1·4 가 이미 기각했다.
  그래서 «타일 한 장 + 재염색»으로 접는다: 결은 정본 사진에서 한 번 오고, 색은 연산이 낸다.

세 다리(정본 · 통로 · 자) 중 이 파일은 «통로»다:
  정본 = `docs/디자인_토큰.json` 재질.펠트 (좌표·크기를 여기서 읽는다 — 하드코딩 0)
  통로 = 절단(이 파일) → 재염색(`tools/펠트색갈이.py` 를 **그대로 호출**한다 · 재구현 0)
  자   = `--자`(코어 ΔE · 결 보존 · 이음매) — 남이 같은 숫자를 다시 낼 수 있게 정의를 박아 둔다.

⚠F472 — 토큰 라벨을 그대로 믿으면 눈알이 섞인다:
  `울패치.원점` 은 이름과 달리 «중심»이다(집행 코드 `tools/보류_3D/마스코트인형리깅.py:167` 이 `cx - s//2` 로 읽는다
  · 그 파일은 09-05 에 보류 폴더로 갔다 — VR 때 연다).
  왼위 원점으로 읽으면 검은 구슬 눈이 타일에 들어온다(저채도 13.93% 실측 · 중심으로 읽으면 0.00%).
  그래서 이 도구는 ①중심으로 읽고 ②자른 뒤 «깨끗한 양모인지 스스로 검사»해 더러우면 거부한다.
  라벨이 또 어긋나도 오염된 타일이 라이브러리 정본이 되지는 않는다(맹점 ④ — 안 도는 쪽보다 이쪽으로 샌다).

역할 층(유호 확정 08-15 「가·나 한벌로」 — 색 겹침 수리 ㉮):
  구 이름 「중립」은 거짓말이었다 — 마스코트 평상복에서 잘랐으니 코어가 코랄이고(킷 Coral 과
  ΔE2000 3.85 · 킷 내부 한 단 7.4 보다 좁다), 팔레트의 한 색처럼 나란히 놓이면 분홍 셋이 겹친다.
  그래서 패치마다 «역할»을 장부(`라이브러리.json`)에 박는다:
    원료       파생의 출발점 — 산출물에 그대로 노출 금지(파일명 `원료_` 접두 강제)
    공용       UI 오브젝트·비마스코트 지면에 쓴다
    마스코트전용  체리 계열 — 마스코트 몸·마스코트가 직접 내는 것에만(실행규칙 ① 승계:
               체리는 UI 색이 아니라 마스코트가 데리고 오는 것 · memory mascot-cherry-jelly-kit)
  염색이 목표색을 마스코트 체리 코어와 대조해(ΔE ≤ 6) 자동으로 마스코트전용을 박고,
  `역할` 명령이 장부↔실물 정합(미등록·접두·체리 근접)을 검증한다.

사용법:
  python tools/펠트패치.py 절단                              원료 패치를 잘라 라이브러리에 둔다
  python tools/펠트패치.py 염색 "#FF6B5C" --이름 코랄         목표색 패치를 파생한다(0원)
  python tools/펠트패치.py 자 <패치.png>                      한 장을 잰다
  python tools/펠트패치.py 도달                              원료 base 에서 «어디까지 갈 수 있나» 실측
  python tools/펠트패치.py 역할                              역할 장부 표 + 정합 검증
"""
import argparse
import io
import json
import os
import subprocess
import sys

# 콘솔이 cp949 면 «»·ΔE 가 print 에서 죽는다 — 재는 층이 값을 깨뜨리면 원본이 멀쩡해도 오진이 된다.
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    import numpy as np
    from PIL import Image
except ImportError as e:
    sys.exit(f'의존성이 없다 — python -m pip install pillow numpy ({e})')

뿌리 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(뿌리, 'tools'))
# 색 판정은 «한 곳에서만» 산다 — 같은 판정을 두 곳에 적으면 갈라진다(CLAUDE.md 맹점 ④).
import 펠트색갈이 as 색갈이  # noqa: E402

# 회귀는 «픽스처 위에서» 탐지력을 못박아야 한다 — 실저장소만 검사하면 버그가 아직 있기를
# 요구하게 되고(맹점 ②), 정본 사진이 바뀌는 날 탐지기까지 같이 죽는다. friction.js 와 같은 문법.
사진뿌리 = os.environ.get('SYNK_FELT_ROOT', 뿌리)
토큰경로 = os.environ.get('SYNK_FELT_TOKEN', os.path.join(뿌리, 'docs', '디자인_토큰.json'))
라이브러리 = os.environ.get('SYNK_FELT_LIB', os.path.join(뿌리, 'docs', '캐릭터', '펠트패치_0815'))
기본패치 = os.path.join(라이브러리, '원료_평상복.png')
중립패치 = os.path.join(라이브러리, '원료_중립.png')
장부파일 = '라이브러리.json'          # 역할 장부 — 라이브러리 폴더 안에 산다
체리문턱 = 6.0   # 마스코트 체리 코어와 이보다 가까우면 마스코트전용(코랄↔체리 실측 10.2 · Coral2↔체리 9.1 밖)
# base 자동 선택의 갈림값 — 게인은 곱이라 유채 base 의 채도를 못 낮춘다(도달 실측: 코랄 base 는
# C* 53↑ 만 도달·15~21 전멸 / 중립 base 는 Slate 0.09·CoralSoft 1.01). C_충만(30) 아래 과녁 = 중립 몫.
저채도갈림 = 30.0

# 절단 자기검사 문턱 — 「깨끗한 양모」의 정의. 정본 사진이 바뀌면 여기서 먼저 빨개진다(대가 §7).
저채도상한 = 0.02   # 재염색이 원리적으로 안 닿는 픽셀(C*≤C_바닥) 비율. 눈알 1개면 13.9% 로 튄다.
암부상한 = 0.01     # L*<20 비율. 구슬 눈·깊은 그림자 탐지(저채도와 «다른 축»이라 따로 센다).


def 토큰읽기():
    with open(토큰경로, encoding='utf-8') as f:
        펠트 = json.load(f)['재질']['펠트']
    울 = 펠트['울패치']
    # 옛 라벨을 «조용히 받아주지» 않는다 — 받아주면 F472 가 그대로 되살아나고, 그때는
    # 이 도구가 오염된 타일을 「통과」의 얼굴로 낸다. 원인을 쓸 수 없게 만드는 쪽이 처방이다.
    if '중심' not in 울:
        if '원점' in 울:
            sys.exit('🔴 토큰이 옛 키 「원점」을 쓴다 — 그 값은 실제로 «중심»이라 이름을 바꿔야 한다.\n'
                     '   docs/디자인_토큰.json 재질.펠트.울패치 에서 "원점" → "중심" (숫자는 그대로 · F472)')
        sys.exit('🔴 토큰 재질.펠트.울패치 에 「중심」이 없다')
    return 펠트


def 사진경로(펠트, 슬롯):
    return os.path.join(사진뿌리, 펠트['정본사진'][슬롯].replace('/', os.sep))


def 마스코트체리():
    """토큰 색.마스코트.램프 의 Cherry Core — 「마스코트 IP 색」 판정은 램프(체리)만 본다(토큰 _쓰임 ②).
    픽스처 토큰엔 없을 수 있다 — 그때는 체리 근접 검사만 조용히 빠진다(역할 층 자체는 그대로 돈다)."""
    try:
        with open(토큰경로, encoding='utf-8') as f:
            램프 = json.load(f)['색']['마스코트']['램프']
        for 단 in 램프:
            if 단.get('이름') == 'Cherry Core':
                return 색갈이.hex2rgb(단['hex'])
    except (KeyError, OSError, ValueError):
        return None
    return None


# ── 역할 장부 ─────────────────────────────────────────────────────────────────
def 장부읽기():
    p = os.path.join(라이브러리, 장부파일)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return {'_주': '역할 장부 — 절단·염색이 쓰고, 「역할」 명령과 tests/펠트패치.test.js 가 읽는다. '
                   '원료=파생 출발점(산출물 노출 금지) · 공용=UI 오브 · 마스코트전용=체리 계열(실행규칙 ①).',
            '패치': {}}


def 장부등록(이름, 역할, 왜=None, 목표=None):
    장 = 장부읽기()
    항 = {'역할': 역할}
    if 왜:
        항['왜'] = 왜
    if 목표:
        항['목표'] = 목표.upper()
    장['패치'][이름] = 항
    with open(os.path.join(라이브러리, 장부파일), 'w', encoding='utf-8') as f:
        json.dump(장, f, ensure_ascii=False, indent=1)
        f.write('\n')


def 기본패치확인():
    if os.path.exists(기본패치):
        return
    옛 = os.path.join(라이브러리, '중립_평상복.png')
    if os.path.exists(옛):
        sys.exit('🔴 옛 이름 「중립_평상복.png」 이 남아 있다 — 이 패치는 중립이 아니라 «코랄 원료»다'
                 '(코어↔킷 Coral ΔE 3.85 · 08-15 역할 층).\n'
                 '   git mv 로 「원료_평상복.png」 으로 바꾸고 라이브러리.json 에 역할=원료 로 올린다.')
    sys.exit('🔴 원료 패치가 없다 — 먼저 `python tools/펠트패치.py 절단`')


def base고르기(선택, 목표hex):
    """어느 원료에서 물들일까. 자동 = 과녁 채도가 가른다(색상이 아니라 «채도»가 도달을 정한다 — 실측).
    반환 = (경로, 무채여부)."""
    if 선택 == '코랄':
        기본패치확인()
        return 기본패치, False
    if 선택 == '중립':
        if not os.path.exists(중립패치):
            sys.exit('🔴 중립 원료가 없다 — 먼저 `python tools/펠트패치.py 절단 --슬롯 중립`')
        return 중립패치, True
    C = 색갈이.chroma(색갈이.hex2rgb(목표hex))
    if C < 저채도갈림:
        if os.path.exists(중립패치):
            print(f'   base = 원료_중립 (과녁 C* {C:.1f} < {저채도갈림:.0f} — 코랄 base 는 채도를 못 낮춘다)')
            return 중립패치, True
        print(f'   ⚠ 과녁 C* {C:.1f} 는 중립 base 몫인데 원료_중립 이 없다 — 코랄 base 로 가면 도달 밖이 된다'
              f'(`절단 --슬롯 중립` 이 먼저다)')
    기본패치확인()
    return 기본패치, False


# ── 색 측정 (전부 색갈이의 정의를 벡터로 옮긴 것 — 상수·식은 저기서 온다) ──────────
def lab배열(arr):
    """arr = uint8 (H,W,3) → (L,a,b) 각각 (H,W). 색갈이.lab 과 같은 식·같은 백색점."""
    c = arr.astype(np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    X = r * .4124564 + g * .3575761 + b * .1804375
    Y = r * .2126729 + g * .7151522 + b * .0721750
    Z = r * .0193339 + g * .1191920 + b * .9503041

    def f(t):
        return np.where(t > 216 / 24389, np.cbrt(t), (841 / 108) * t + 4 / 29)
    fx, fy, fz = f(X / .95047), f(Y), f(Z / 1.08883)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def 채도배열(arr):
    _, a, b = lab배열(arr)
    return np.hypot(a, b)


def 박스흐림(a, r):
    """분리형 박스 블러(누적합) — scipy 없이. 결(고주파)을 뽑기 위한 저주파 추정."""
    def 한축(x):
        n = x.shape[1]
        pad = np.pad(x, ((0, 0), (r + 1, r)), mode='reflect')
        cs = np.cumsum(pad, axis=1)
        cs = np.pad(cs, ((0, 0), (1, 0)))
        return (cs[:, 2 * r + 1:2 * r + 1 + n] - cs[:, :n]) / (2 * r + 1)
    return 한축(한축(a).T).T


def 결에너지(arr, r=4):
    """결 = «선형광 로그»의 고주파 잔차 표준편차. 재염색·블렌딩이 섬유를 뭉개면 내려간다.

    ⚠자를 세 판 굴려서 여기로 돌아왔다(실측 08-15) — 기록해 두는 이유는 «채널 상대대비»가
      더 정밀해 보이는 함정이라 다음 사람이 같은 길을 또 파기 때문이다:
      ①L*(이 판) → ②로그 휘도 → ③캐리어 채널 상대대비 → ①로 복귀.
      ③이 무너진 자리가 진단의 핵심이다: base 는 진한 코랄이라 **R 이 8bit 평균 250.8 로 천장에
      붙어 «납작»하고**(상대σ 0.065), 결의 실제 변조는 G(0.320)·B(0.363)가 진다. 그래서 캐리어를
      「밝은 채널」로 고르면 코랄계 과녁에선 R, 파랑계 과녁에선 G·B 가 뽑혀 **서로 다른 물리량을
      비교**하게 된다 — Navy 563%·CoolBlue 495% 는 노이즈가 아니라 자가 채널을 갈아탄 값이었다.
      ②는 휘도가 세 채널 가중합이라 게인이 섞는 비율을 바꿔 같은 병을 다른 얼굴로 냈다(Navy 194%).

    그래서 «보이는가»를 직접 잰다 — L* 고주파 잔차의 σ. L* 는 지각 균등이라 σ 가 곧 「결이 눈에
      띄는 정도」다. 채널을 안 갈아타므로 과녁이 달라도 같은 물리량이다.
    ⚠이 자는 게인 불변이 **아니다**(그게 대가다): 밝은 과녁으로 물들이면 같은 반사율 변조가 더 큰
      ΔL* 로 펴져 100% 를 넘는다. 넘는 것은 «결이 더 잘 보인다»는 참말이지 오차가 아니다.
      그래서 판정은 «떨어질 때»만 문제 삼는다 — 뭉갠 몫은 염색 통로가 찍는 무릎% 가 따로 증언한다."""
    L, _, _ = lab배열(arr)
    return float(np.std(L - 박스흐림(L, r)))


def 이음매비(arr):
    """타일을 «반복 배치»했을 때 경계가 티나는 정도.
    감싸기 경계(마지막↔첫) 밝기차 ÷ 내부 이웃 밝기차. 1.0 이면 내부와 구별 안 됨 = 이음매 없음."""
    L, _, _ = lab배열(arr)
    내부 = (np.mean(np.abs(np.diff(L, axis=1))) + np.mean(np.abs(np.diff(L, axis=0)))) / 2
    감싸기 = (np.mean(np.abs(L[:, 0] - L[:, -1])) + np.mean(np.abs(L[0, :] - L[-1, :]))) / 2
    return float(감싸기 / max(내부, 1e-9))


def 코어색(arr, 무채폴백=False):
    """색갈이.코어 와 «같은 정의» — 채도 충만 표본의 40~70 백분위 평균(하이라이트·최암부 제외).

    🔴 **무채 천은 이 자로 못 잰다** — 유채 픽셀이 «원리상» 0 이라 표본이 안 모인다.
      2026-08-20 실측: 양모 밤 축(Stitch C*14.8 · Oat 6.1 · Stone 7.6 · Ink 4.7 · Ink Deep 0.7)과
      기존 Paper·Chalk·Chalk3·Ash 가 전부 여기 걸린다(`역할` 표의 `#──────` 가 그 증거였고,
      `도달` 은 아예 None 을 그대로 lab() 에 넘겨 **크래시**했다).
    🔑 그래서 «없는 축»을 억지로 쓰지 않고 **축을 바꾼다**: 코어의 뜻은 「극단(하이라이트·최암부)을
      뺀 가운데 띠」이고, 유채 천에서는 그것을 채도가 가르지만 무채 천에서는 **명도**가 가른다.
      같은 40~70 백분위·같은 평균이라 정의는 하나로 유지된다.
    ⚠ 기본값은 False 다 — 폴백을 기본으로 켜면 「유채 표본이 없다」는 사실이 조용히 사라진다.
      부르는 쪽이 「무채도 재고 싶다」를 명시할 때만 연다.
    """
    C = 채도배열(arr)
    m = C > 색갈이.C_충만
    if m.sum() >= 200:
        표본 = [(float(c), tuple(int(v) for v in p)) for c, p in zip(C[m], arr[m])]
        return 색갈이.코어(표본)
    if not 무채폴백:
        return None
    L, _, _ = lab배열(arr)
    평면, Lf = arr.reshape(-1, 3), L.reshape(-1)
    차례 = np.argsort(Lf)
    lo, hi = int(차례.size * 0.40), int(차례.size * 0.70)
    띠 = 평면[차례[lo:hi]] if hi > lo else 평면
    return tuple(float(x) for x in 띠.mean(axis=0))


# ── 절단 ────────────────────────────────────────────────────────────────────
def 자기검사(arr, 어디):
    """자른 것이 «진짜 깨끗한 양모»인지 스스로 본다 — F472 가 이 문을 세운 이유다."""
    C = 채도배열(arr)
    L, _, _ = lab배열(arr)
    n = C.size
    저채도 = float((C <= 색갈이.C_바닥).sum()) / n
    암부 = float((L < 20).sum()) / n
    print(f'   자기검사 — 저채도(재염색 안 닿음) {저채도*100:.2f}% (상한 {저채도상한*100:.0f}%)'
          f' · 암부 L*<20 {암부*100:.2f}% (상한 {암부상한*100:.0f}%)')
    문제 = []
    if 저채도 > 저채도상한:
        문제.append(f'저채도 {저채도*100:.2f}% > {저채도상한*100:.0f}%')
    if 암부 > 암부상한:
        문제.append(f'암부 {암부*100:.2f}% > {암부상한*100:.0f}%')
    if 문제:
        sys.exit(f'🔴 {어디} 는 양모가 아니다 — {" · ".join(문제)}\n'
                 f'   좌표를 «중심»으로 읽고 있는지, 그 사진에 맞는 좌표인지 본다(F472).')
    return 저채도, 암부


def 평탄화(arr, r=24):
    """사진에 구워진 «저주파 조명 경사»만 걷어낸다 — 결(고주파)은 그대로 둔다.

    왜 필요한가(실측 08-15): 정본 크롭은 돔의 조명 경사를 품고 있어 저주파 L* 폭이 21.4 였다.
      결 자체의 σ 가 5.21 이니 **경사가 결보다 1.7배 큰 구조**다 — 한 장으로 볼 땐 자연스럽지만
      타일로 깔면 그 경사가 주기마다 반복돼 「얼룩이 규칙적으로 찍힌 천」이 된다.
      마스코트 한 장을 렌더할 때와 «임의 오브젝트를 덮을 때»의 요구가 갈리는 첫 자리다.

    ⚠헌법 5(사진에 구워진 조명 보존)와 부딪치지 않는다: 걷어내는 것은 «위치에 따른 밝기 기울기»뿐이고
      평균 밝기·색은 그대로 둔다(채널 공통 스칼라 게인이라 색상·채도 비율 불변). 그래도 이건 재질의
      «모양»을 바꾸는 선택이라 기본값이 아니라 옵션으로 둔다 — 기본값 전환은 유호님 픽."""
    c = arr.astype(np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    Y = lin[..., 0] * .2126729 + lin[..., 1] * .7151522 + lin[..., 2] * .0721750
    저주파 = 박스흐림(Y, r)
    게인 = (저주파.mean() / np.maximum(저주파, 1e-6))[..., None]
    평 = lin * 게인
    # 밝은 쪽이 1.0 을 넘으면 결이 흰 덩어리가 된다 — 색갈이와 같은 무릎을 쓴다(판정 1벌).
    무릎 = 0.94
    넘음 = 평 > 무릎
    평[넘음] = 무릎 + (1 - 무릎) * ((평[넘음] - 무릎) / ((평[넘음] - 무릎) + (1 - 무릎)))
    평 = np.clip(평, 0, 1)
    srgb = np.where(평 <= 0.0031308, 평 * 12.92, 1.055 * np.power(평, 1 / 2.4) - 0.055)
    return np.clip(np.round(srgb * 255), 0, 255).astype(np.uint8)


def 저주파폭(arr, r=24):
    """타일을 깔았을 때 «얼룩»으로 보일 저주파 구조의 크기(L* 단위)."""
    L, _, _ = lab배열(arr)
    low = 박스흐림(L, r)
    return float(low.max() - low.min())


def 타일_거울(arr):
    """거울 확장 — 이음매가 «구조적으로» 0(가장자리가 서로의 거울상이라 이어붙어도 안 끊긴다).
    대가: 타일이 2배가 되고 좌우·상하 대칭이 생긴다(집행 코드가 회전·배율 두 벌로 깨는 그 주기)."""
    좌우 = np.concatenate([arr, arr[:, ::-1]], axis=1)
    return np.concatenate([좌우, 좌우[::-1, :]], axis=0)


def 타일_엇갈림(arr):
    """반칸 굴리기 + 가장자리 0 인 가중치로 섞기 — 크기 그대로 «진짜 주기» 타일.
    대가: 섞는 자리에서 섬유가 두 벌 겹쳐 결이 깎인다(얼마나 깎이는지는 --자 가 잰다)."""
    S = arr.shape[0]
    굴림 = np.roll(np.roll(arr, S // 2, axis=0), S // 2, axis=1)
    d = np.minimum(np.arange(S), S - 1 - np.arange(S)) / (S / 2.0)   # 가장자리 0 · 중앙 1
    w1 = d * d * (3 - 2 * d)                                          # smoothstep
    w = (w1[:, None] * w1[None, :])[..., None]
    return np.clip(arr * w + 굴림 * (1 - w), 0, 255).astype(np.uint8)


def 무채검사(arr, 어디):
    """중립(무채) base 의 «깨끗한 회색 양모» 검사 — 유채 자기검사와 축이 뒤집힌다:
    저채도가 100% 인 게 정상이고, 잡아야 할 오염은 «유채 얼룩»(색 스티커·염색 자국)과 암부다."""
    C = 채도배열(arr)
    L, _, _ = lab배열(arr)
    n = C.size
    유채 = float((C > 색갈이.C_충만).sum()) / n
    암부 = float((L < 20).sum()) / n
    print(f'   무채검사 — 유채(색 오염) {유채*100:.2f}% (상한 2%) · 암부 L*<20 {암부*100:.2f}% (상한 {암부상한*100:.0f}%)')
    문제 = []
    if 유채 > 0.02:
        문제.append(f'유채 {유채*100:.2f}% > 2%')
    if 암부 > 암부상한:
        문제.append(f'암부 {암부*100:.2f}% > {암부상한*100:.0f}%')
    if 문제:
        sys.exit(f'🔴 {어디} 는 무채 양모가 아니다 — {" · ".join(문제)}\n'
                 f'   유채 천이면 --슬롯 평상복 계열이 맞고, 중립 정본 사진이 오염됐으면 사진부터 본다.')


def 절단(a):
    펠트 = 토큰읽기()
    블록키 = '울패치중립' if a.슬롯 == '중립' else '울패치'
    if 블록키 not in 펠트:
        sys.exit(f'🔴 토큰 재질.펠트.{블록키} 가 없다 — 정본사진.{a.슬롯} 좌표 블록부터 등재한다')
    cx, cy = 펠트[블록키]['중심']      # «중심»이다 — 옛 이름 「원점」이 F472 를 냈다
    s = 펠트[블록키]['한변px']
    경로 = 사진경로(펠트, a.슬롯)
    im = Image.open(경로).convert('RGB')
    W, H = im.size
    x0, y0 = cx - s // 2, cy - s // 2
    print(f'■ 절단  {os.path.relpath(경로, 뿌리)}  {W}x{H}')
    print(f'   토큰 {블록키} «중심»({cx},{cy}) 한변 {s}px → 크롭 x{x0}~{x0+s} y{y0}~{y0+s}')
    if x0 < 0 or y0 < 0 or x0 + s > W or y0 + s > H:
        sys.exit(f'🔴 크롭이 사진 밖이다 — 이 좌표는 {W}x{H} 사진용이 아니다(F472 갈래 ㉡)')
    원 = np.asarray(im.crop((x0, y0, x0 + s, y0 + s)), dtype=np.uint8)
    if a.슬롯 == '중립':
        무채검사(원, f'{a.슬롯} 중심({cx},{cy})')
    else:
        자기검사(원, f'{a.슬롯} 중심({cx},{cy})')
    if a.평탄화:
        전 = 저주파폭(원)
        원 = 평탄화(원)
        print(f'   평탄화 — 저주파 조명 경사 L* {전:.1f} → {저주파폭(원):.1f}'
              f' (결 {결에너지(원):.3f} L*σ · 색·평균밝기 불변)')

    표 = {'원본': 원, '거울': 타일_거울(원), '엇갈림': 타일_엇갈림(원)}
    기준결 = 결에너지(원)
    print(f'\n   {"타일 방식":<8} {"한변":>5} {"결(L*σ)":>9} {"결 보존":>7} {"이음매비":>8} {"얼룩(저주파)":>11}   판정')
    for 이름, t in 표.items():
        e, r = 결에너지(t), 이음매비(t)
        print(f'   {이름:<8} {t.shape[0]:>5} {e:>9.3f} {e/기준결*100:>6.1f}% {r:>8.3f} {저주파폭(t):>11.1f}'
              f'   {"← 이어붙이면 티난다" if r > 1.3 else "이음매 없음"}')

    os.makedirs(라이브러리, exist_ok=True)
    선택 = 표[a.타일]
    이름 = a.이름
    if a.슬롯 == '중립' and 이름 == '원료_평상복':
        이름 = '원료_중립'                      # 슬롯이 갈리면 기본 이름도 갈린다 — 평상복 base 를 덮으면 사고다
    if not 이름.startswith('원료_'):
        이름 = f'원료_{이름}'
        print(f'   이름에 「원료_」 접두를 붙였다 — base 는 팔레트 색이 아니라서 이름부터 갈라 둔다(역할 층)')
    낼곳 = os.path.join(라이브러리, f'{이름}.png')
    Image.fromarray(선택).save(낼곳)
    왜 = ('무채 파생 출발점 — 산출물 노출 금지 · 출처 ambientCG Fabric034 (CC0 · 유호 확정 08-15)'
          if a.슬롯 == '중립' else
          f'{a.슬롯} 정본 사진에서 자른 파생 출발점 — 산출물 노출 금지(코어가 코랄이라 «중립» 아님)')
    장부등록(이름, '원료', 왜=왜)
    print(f'\n■ 라이브러리  {os.path.relpath(낼곳, 뿌리)}  ({a.타일} · {선택.shape[1]}x{선택.shape[0]} · 역할=원료)')
    코어 = 코어색(선택)
    if 코어 is not None:
        print(f'   원료 base 코어 #{색갈이.hexs(코어)} — 이 색에서 재염색이 출발한다(산출물 노출 금지)')
    else:
        L, _, _ = lab배열(선택)
        print(f'   원료 base 무채 — 평균 L* {float(L.mean()):.1f} · 재염색은 --무채base 통로가 진다(산출물 노출 금지)')


# ── 염색 (통로 재사용: 펠트색갈이.py 를 그대로 부른다) ──────────────────────────
def 염색하기(입력, 출력, 목표, 조용히=False, 무채=False):
    cmd = [sys.executable, os.path.join(뿌리, 'tools', '펠트색갈이.py'), 입력, 출력, '--목표', 목표]
    if 무채:
        cmd.append('--무채base')
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', env=env)
    if p.returncode != 0:
        sys.exit(f'🔴 재염색 실패 — {p.stderr.strip() or p.stdout.strip()}')
    if not 조용히:
        print(p.stdout.rstrip())
    return p.stdout


def 염색(a):
    os.makedirs(라이브러리, exist_ok=True)
    base경로, 무채 = base고르기(a.base, a.목표)
    이름 = a.이름 or a.목표.lstrip('#')
    # 역할 판정 — 체리 근접이면 공용으로 «못» 낸다(실행규칙 ①을 프로즈가 아니라 통로가 지킨다)
    역할값 = a.역할
    체리 = 마스코트체리()
    if 체리 is not None:
        d체리 = 색갈이.de2000(색갈이.lab(색갈이.hex2rgb(a.목표)), 색갈이.lab(체리))
        if d체리 <= 체리문턱:
            if a.역할 == '공용':
                sys.exit(f'🔴 이 색은 마스코트 체리 코어와 ΔE {d체리:.1f} (≤{체리문턱:.0f}) — 공용으로 못 낸다.\n'
                         f'   체리는 UI 색이 아니라 마스코트가 데리고 오는 것이다(실행규칙 ① · 유호 확정 08-13).\n'
                         f'   `--역할 마스코트전용` 으로 내거나, 공용 천이 필요하면 킷 색으로 물들인다.')
            역할값 = '마스코트전용'
            print(f'   역할 = 마스코트전용 (마스코트 체리 코어와 ΔE {d체리:.1f} ≤ {체리문턱:.0f} — 실행규칙 ① 승계)')
    역할값 = 역할값 or '공용'
    출력 = os.path.join(라이브러리, f'{이름}.png')
    print(f'■ 염색  {os.path.relpath(base경로, 뿌리)} → {a.목표.upper()}  (역할={역할값})')
    염색하기(base경로, 출력, a.목표, 무채=무채)
    장부등록(이름, 역할값, 목표=a.목표)
    base = np.asarray(Image.open(base경로).convert('RGB'), dtype=np.uint8)
    out = np.asarray(Image.open(출력).convert('RGB'), dtype=np.uint8)
    재기(out, 출력, 목표=a.목표, 기준결=결에너지(base))


# ── 자 ──────────────────────────────────────────────────────────────────────
def 재기(arr, 이름, 목표=None, 기준결=None):
    코어 = 코어색(arr)
    # 무채 천(양모 밤 축·Paper·Stone…)은 «유채 코어»가 원리상 없다 — 명도축으로 잰다(코어색 주석).
    # 🔴 옛 판은 여기서 「잴 양모가 없다」로 **판정을 포기**했다: 그래서 무채 천 4벌은 구워도
    #   ΔE 를 한 번도 못 재고 있었다(`역할` 표의 `#──────` 가 그 흔적). 못 재는 것과 없는 것은 다르다.
    무채축 = 코어 is None
    if 무채축:
        코어 = 코어색(arr, 무채폴백=True)
    e, r = 결에너지(arr), 이음매비(arr)
    print(f'■ 자  {os.path.relpath(이름, 뿌리) if os.path.isabs(str(이름)) else 이름}'
          f'  ({arr.shape[1]}x{arr.shape[0]})')
    if 코어 is None:
        print('   🔴 잴 픽셀이 없다')
        return None
    줄 = f'   코어 #{색갈이.hexs(코어)}' + ('  ※명도축(유채 표본 없음 — 무채 천)' if 무채축 else '')
    d = None
    if 목표:
        d = 색갈이.de2000(색갈이.lab(코어), 색갈이.lab(색갈이.hex2rgb(목표)))
        줄 += f'  목표 {목표.upper()} 와 ΔE2000 **{d:.2f}**'
    print(줄)
    보존 = f'  (base 대비 {e/기준결*100:.1f}%)' if 기준결 else ''
    print(f'   결 {e:.3f} L*σ{보존} · 이음매비 {r:.3f}')
    if d is not None and d > 3.0:
        print('   🔴 코어가 목표에서 ΔE 3 초과 — 이 색은 이 base 에서 안 나온다(도달 밖)')
    return {'코어': 코어, 'ΔE': d, '결': e, '이음매': r}


def 자(a):
    arr = np.asarray(Image.open(a.패치).convert('RGB'), dtype=np.uint8)
    재기(arr, a.패치, 목표=a.목표)


# ── 도달 한계 ───────────────────────────────────────────────────────────────
def 도달(a):
    """코랄 base 에서 «어디까지» 갈 수 있나. 재염색은 선형광 채널 게인이라
    출발색에서 멀어질수록 한 채널을 크게 밀어야 하고, 그때 결이 먼저 죽는다.
    이 표가 라이브러리의 «사용 설명서»다 — 빨간 칸은 base 를 하나 더 떠야 하는 자리."""
    base경로, 무채 = base고르기(a.base, '#808080' if a.base == '중립' else '#FF6B5C')
    과녁 = list(a.과녁)
    base = np.asarray(Image.open(base경로).convert('RGB'), dtype=np.uint8)
    기준결 = 결에너지(base)
    base코어 = 코어색(base)
    코어표기 = f'#{색갈이.hexs(base코어)}' if base코어 is not None else '무채'
    print(f'■ 도달 한계  base {os.path.basename(base경로)} 코어 {코어표기} · 결 {기준결:.3f} L*σ · 과녁 {len(과녁)}색\n')
    print(f'   {"이름":<10} {"목표":<9} {"목표C*":>6} {"코어ΔE":>7} {"결비":>7} {"무릎":>7}   판정')
    임시 = os.path.join(라이브러리, '_도달_임시.png')
    결과 = []
    for 이름, hexv in 과녁:
        로그 = 염색하기(base경로, 임시, hexv, 조용히=True, 무채=무채)
        out = np.asarray(Image.open(임시).convert('RGB'), dtype=np.uint8)
        # 무채 과녁은 «명도축» 코어로 잰다(코어색 주석) — 안 그러면 None 이 lab() 에서 죽는다.
        유채코어 = 코어색(out)
        코어 = 유채코어 if 유채코어 is not None else 코어색(out, 무채폴백=True)
        축 = '' if 유채코어 is not None else '※'      # ※ = 명도축으로 쟀다
        d = 색갈이.de2000(색갈이.lab(코어), 색갈이.lab(색갈이.hex2rgb(hexv)))
        보존 = 결에너지(out) / 기준결
        # 무릎에 걸린 비율은 «염색 통로가 스스로 찍는 숫자»를 그대로 읽는다 — 두 번 세지 않는다.
        무릎 = 로그.rsplit('무릎에 걸린 픽셀', 1)[-1].rsplit('(', 1)[-1].split(')')[0] \
            if '무릎에 걸린 픽셀' in 로그 else '?'
        C = 색갈이.chroma(색갈이.hex2rgb(hexv))
        판정 = '✅' if (d <= 3.0 and 보존 >= 0.75) else ('🟡' if d <= 3.0 or 보존 >= 0.75 else '🔴')
        print(f'   {이름:<10} {hexv.upper():<9} {C:>6.1f} {d:>6.2f}{축:<1} {보존*100:>6.1f}%'
              f' {무릎:>7}   {판정}')
        결과.append((이름, hexv, C, d, 보존, 판정))
    if os.path.exists(임시):
        os.remove(임시)
    ok = [r for r in 결과 if r[5] == '✅']
    print(f'\n   합계 {len(결과)}색 = ✅{len(ok)} + 🟡{sum(1 for r in 결과 if r[5]=="🟡")}'
          f' + 🔴{sum(1 for r in 결과 if r[5]=="🔴")}')
    print('   ✅ = 코어 ΔE≤3 이고 결 75% 이상 남음(그 색은 0원에 나온다)')
    # 도달 실패는 «색상»이 아니라 «채도»로 갈린다 — 게인은 채도를 못 낮춘다(진한 염료를 묽게 못 만든다).
    못간 = [r for r in 결과 if r[3] > 3.0]
    if 못간:
        print(f'\n   🔑 도달 밖 {len(못간)}색의 공통점 = **낮은 채도**'
              f'(C* {min(r[2] for r in 못간):.0f}~{max(r[2] for r in 못간):.0f})'
              f' · 도달한 색은 C* {min(r[2] for r in 결과 if r[3] <= 3.0):.0f} 이상')
        print('      게인은 «곱»이라 채도를 못 낮춘다 — 묽은·회색 펠트는 이 base 에서 안 나온다.')
        print(f'      → 그 계열이 필요하면 **낮은 채도 base 를 한 장 더 뜬다**(연회색 양모 사진).')
        print(f'      못 간 색: {" · ".join(f"{r[0]}(C* {r[2]:.0f})" for r in 못간)}')


# ── 역할 검증 ───────────────────────────────────────────────────────────────
def 역할(a):
    """장부↔실물 정합. 새는 방향은 언제나 «통과»다 — 그래서 미등록·이름·체리 근접을 전부 fail 로 낸다.
    ⚠대가: 이 검증은 «불릴 때만» 돈다(도구 명령+회귀) — L4 소비자(재질굽기.js 슬롯)가 서면
    그쪽에 장부 읽기를 배선해야 한다. 안 하면 장부는 초록인데 원료가 노출된다(설계 정본 §7)."""
    장 = 장부읽기()['패치']
    체리 = 마스코트체리()
    실물 = sorted(f[:-4] for f in os.listdir(라이브러리)
                if f.endswith('.png') and not f.startswith('_')) if os.path.isdir(라이브러리) else []
    문제 = []
    print(f'■ 역할 장부  {os.path.join(os.path.relpath(라이브러리, 뿌리), 장부파일)}')
    print(f'   {"이름":<18} {"역할":<8} {"코어":<9} 비고')
    for 이름 in 실물:
        항 = 장.get(이름)
        if 항 is None:
            문제.append(f'{이름}.png 가 장부에 없다 — 절단/염색 통로 밖에서 들어온 패치다(통로로 다시 내거나 장부에 올린다)')
            continue
        경로 = os.path.join(라이브러리, f'{이름}.png')
        arr = np.asarray(Image.open(경로).convert('RGB'), dtype=np.uint8)
        코어 = 코어색(arr)
        역 = 항.get('역할')
        비고 = 항.get('왜', 항.get('목표', ''))
        print(f'   {이름:<18} {역:<8} #{색갈이.hexs(코어) if 코어 else "──────":<8} {비고[:52]}')
        if 역 not in ('원료', '공용', '마스코트전용', '정본사진'):
            문제.append(f'{이름}: 역할 「{역}」 은 없는 값 — 원료/공용/마스코트전용/정본사진 중 하나')
        if 역 == '원료' and not 이름.startswith('원료_'):
            문제.append(f'{이름}: 역할=원료인데 이름에 「원료_」 접두가 없다 — 팔레트 색으로 오독된다(이 겹침이 이 층을 세웠다)')
        if 이름.startswith('원료_') and 역 != '원료':
            문제.append(f'{이름}: 이름은 원료인데 역할이 「{역}」 — 한쪽이 거짓말이다(F472 문법)')
        if 체리 is not None and 역 == '공용' and 코어 is not None:
            d = 색갈이.de2000(색갈이.lab(코어), 색갈이.lab(체리))
            if d <= 체리문턱:
                문제.append(f'{이름}: 공용인데 실측 코어가 마스코트 체리와 ΔE {d:.1f} (≤{체리문턱:.0f}) — '
                            f'마스코트전용이어야 한다(실행규칙 ①)')
    for 이름 in 장:
        if 이름 not in 실물:
            문제.append(f'장부의 {이름} 실물({이름}.png)이 없다 — 지웠으면 장부에서도 뺀다')
    역할수 = {}
    for 이름 in 실물:
        r = (장.get(이름) or {}).get('역할', '미등록')
        역할수[r] = 역할수.get(r, 0) + 1
    print(f'\n   합계 {len(실물)}장 = ' + ' + '.join(f'{k} {v}' for k, v in sorted(역할수.items())))
    if 문제:
        sys.exit('🔴 역할 정합 실패 ' + str(len(문제)) + '건\n   ' + '\n   '.join(문제))
    print('   ✅ 정합 — 미등록 0 · 이름↔역할 어긋남 0 · 체리 근접 공용 0')


def 색쌍(s):
    if '=' not in s:
        raise argparse.ArgumentTypeError('이름=#RRGGBB 모양이어야 한다')
    n, v = s.split('=', 1)
    return (n, v)


def main():
    ap = argparse.ArgumentParser(description='Loom L2b — 펠트 패치 라이브러리')
    sub = ap.add_subparsers(dest='명령', required=True)

    p1 = sub.add_parser('절단', help='정본 사진에서 원료 패치를 잘라 라이브러리에 둔다')
    p1.add_argument('--슬롯', default='평상복', choices=['평상복', '특별', '중립'])
    p1.add_argument('--타일', default='거울', choices=['원본', '거울', '엇갈림'])
    p1.add_argument('--평탄화', action='store_true',
                    help='구워진 조명 경사만 걷어낸다(결·색 유지) — 타일 반복 시 얼룩을 없앤다')
    p1.add_argument('--이름', default='원료_평상복', help='라이브러리에 낼 파일 이름(원료_ 접두 강제)')
    p1.set_defaults(fn=절단)

    p2 = sub.add_parser('염색', help='원료 패치에서 목표색 패치를 파생한다(0원)')
    p2.add_argument('목표', help='예 "#FF6B5C"')
    p2.add_argument('--이름', help='라이브러리 파일 이름(생략하면 hex)')
    p2.add_argument('--역할', choices=['공용', '마스코트전용'],
                    help='생략하면 자동 — 체리 근접(ΔE≤6)은 마스코트전용, 나머지 공용')
    p2.add_argument('--base', default='자동', choices=['자동', '코랄', '중립'],
                    help='자동 = 과녁 C*<30 이면 중립(회색) base, 아니면 코랄 base')
    p2.set_defaults(fn=염색)

    p3 = sub.add_parser('자', help='패치 한 장을 잰다')
    p3.add_argument('패치')
    p3.add_argument('--목표', help='이 색을 노렸다면 ΔE 도 같이 잰다')
    p3.set_defaults(fn=자)

    p4 = sub.add_parser('도달', help='base 에서 어디까지 갈 수 있나 실측')
    p4.add_argument('--과녁', type=색쌍, nargs='+', required=True, metavar='이름=#RRGGBB')
    p4.add_argument('--base', default='코랄', choices=['코랄', '중립'], help='어느 원료에서 실측할까')
    p4.set_defaults(fn=도달)

    p5 = sub.add_parser('역할', help='역할 장부 표 + 장부↔실물 정합 검증')
    p5.set_defaults(fn=역할)

    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
