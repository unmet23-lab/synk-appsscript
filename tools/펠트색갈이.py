"""펠트 양모의 «염료»를 갈아입힌다 — 생성 모델을 다시 굴리지 않고, 결정론적으로 (2026-08-15).

왜 있나(실측 08-15):
  `펠트코랄_0815/재염색_본체.png` 는 프롬프트에 "coral-red wool" 이라 적고 구웠는데
  코어가 `#C55143` 로 착지했다 — 킷 Coral `#FF6B5C` 과 **ΔE2000 13.4**,
  그리고 유호님이 08-02 에 「강렬하나 칙칙」으로 **기각한 V9 레드 `#C74A3A` 와 ΔE 1.9**.
  즉 라벨은 코랄인데 픽셀은 벽돌이다. 양모 섬유의 미세 그림자가 밝기를 먹은 결과라
  프롬프트에 hex 를 적는 것으로는 안 고쳐진다(`펠트_색_체리핑크` 가 목표 `#FB7A87` 에서
  ΔE 7.9 벗어난 것이 같은 원인 — 색 낱말은 참조 이미지와 싸운다 · `파생굽기.js` 머리말).

무엇을 하나 — «염료 교체»는 색조 회전이 아니라 **선형광에서의 채널 게인**이다:
  염료가 밝아지면 하이라이트와 그림자가 «함께» 밝아진다(반사율이 배로 곱해진다).
  그래서 L* 에 더하지 않고 linear RGB 에 곱한다. 여기에 하이라이트 무릎(soft knee)을 걸어
  섬유 결이 흰색으로 뭉개지는 것을 막는다 — 클립률을 출력에 찍는다(안 찍으면 뭉갠 걸 모른다).

무엇을 안 건드리나 — 마스크는 **채도**로 가른다(`마스코트누끼.js` 와 같은 축):
  크림 손스티치·검은 구슬 눈·회색 배경은 전부 저채도라 마스크 밖이다.
  실측(펠트_본체 · 4px 격자 65,536 표본): 양모 = C* 45+ 18.9% · C* 30~45 3.1% ·
  무채(배경+눈+크림실) 76.4%. 경계는 채도로 페더링해 후광(halo)을 막는다.

무채 base 모드(08-15 · ㉯ 연회색 원료 — 유호 확정 「가·나 한벌로」):
  게인은 «곱»이라 유채 base 의 채도를 못 낮춘다 — 회색·파스텔 계열(C* 15~21)은 저채도 base 에서만
  나온다. 그런데 이 도구의 마스크(채도 C* 14 미만 = 안 칠함)는 회색 천을 통째로 마스크 밖에 둔다.
  그래서 `--무채base` 를 명시하면 마스크를 끄고 전면을 칠한다(코어는 채도 대신 **L\* 40~70 백분위**).
  ⚠자격 검사가 지킨다: 유채 픽셀이 2% 를 넘는 그림(마스코트 사진 류 — 눈·배경·스티치를 마스크가
  지켜야 하는 그림)에 이 플래그를 쓰면 죽는다 — 두 모드는 서로의 오용을 서로 잡는다.

사용법:
  python tools/펠트색갈이.py <입력.png> <출력.png> --목표 "#FF6B5C"
  python tools/펠트색갈이.py <입력.png> <출력.png> --목표 "#FF6B5C" --견본 견본.png
  python tools/펠트색갈이.py <회색천.png> <출력.png> --목표 "#8A8A8A" --무채base
"""
import argparse
import math
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')


# ── 색공간 ────────────────────────────────────────────────────────────────
def _to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _to_srgb(c):
    c = max(0.0, min(1.0, c))
    v = c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return v * 255.0


def lin_rgb(rgb):
    return tuple(_to_lin(c) for c in rgb)


def lab(rgb):
    r, g, b = lin_rgb(rgb)
    X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29

    fx, fy, fz = f(X / 0.95047), f(Y / 1.0), f(Z / 1.08883)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def chroma(rgb):
    _, a, b = lab(rgb)
    return math.hypot(a, b)


def de2000(lab1, lab2):
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else 0
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    elif h2p - h1p > 180:
        dhp = h2p - h1p - 360
    else:
        dhp = h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Rt = -math.sin(math.radians(2 * (30 * math.exp(-(((hbp - 275) / 25) ** 2))))) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ── 마스크 ────────────────────────────────────────────────────────────────
# 채도로 가른다. 두 임계 사이를 페더로 써서 양모/배경 경계의 후광을 막는다.
C_바닥, C_충만 = 14.0, 30.0


def 가중치(c):
    if c <= C_바닥:
        return 0.0
    if c >= C_충만:
        return 1.0
    t = (c - C_바닥) / (C_충만 - C_바닥)
    return t * t * (3 - 2 * t)  # smoothstep


# ── 코어색 = 마스크 안 채도 40~70 백분위 평균 ───────────────────────────
# 하이라이트·최암부를 뺀 «염료 그 자체»의 자리. 측정 정의를 굽기 검수와 같게 둔다.
def 코어(표본):
    표본 = sorted(표본, key=lambda t: t[0])
    lo, hi = int(len(표본) * 0.40), int(len(표본) * 0.70)
    band = [t[1] for t in 표본[lo:hi]] or [t[1] for t in 표본]
    n = len(band)
    return tuple(sum(p[i] for p in band) / n for i in range(3))


# ── 하이라이트 무릎 ──────────────────────────────────────────────────────
# 게인을 곱하면 밝은 섬유가 1.0 을 넘는다. 하드 클립하면 결이 흰 덩어리가 되므로
# 무릎 위를 부드럽게 압축한다(1.0 을 절대 안 넘고, 무릎 아래는 손대지 않는다).
#
# ⚠무릎은 «목표와 싸운다» — 실측 08-15: 무릎 0.80 에서 칠한 픽셀의 47.8% 가 걸려
#   코어가 목표에서 ΔE 10.5 로 주저앉았다. 킷 Coral `#FF6B5C` 은 R=255 = 색역 끝이라
#   코어가 목표에 닿으려면 R 이 코어 위쪽에서 반드시 포화된다(물리적으로 진한 염료가 그렇다).
#   그래서 무릎은 «높게» 두고, 결은 아직 여유가 큰 G·B 가 진다.


def 무릎압축(v, 무릎):
    if v <= 무릎:
        return v
    over = v - 무릎
    room = 1.0 - 무릎
    return 무릎 + room * (over / (over + room))


def hexs(rgb):
    return ''.join('%02X' % max(0, min(255, round(c))) for c in rgb)


def lab2rgb(L, a, b):
    """Lab → sRGB. `--색상만` 이 «원본의 결에 목표 색상만 얹은 색»을 지어내는 데 쓴다."""
    fy = (L + 16) / 116.0
    fx = fy + a / 500.0
    fz = fy - b / 200.0

    def g(t):
        return t ** 3 if t ** 3 > 0.008856 else (t - 16.0 / 116) / 7.787

    X, Y, Z = g(fx) * 0.95047, g(fy) * 1.0, g(fz) * 1.08883
    r = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314
    gg = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560
    bb = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252
    return tuple(_to_srgb(v) for v in (r, gg, bb))


def 적용(px, W, H, 게인, 무릎, 전면=False):
    """게인을 선형광에서 곱한다. 같은 RGB 는 같은 답이라 캐시로 접는다(보정 회차의 비용).
    전면=True(무채 base): 마스크를 끈다 — 전면이 천이라 지킬 것이 없다(자격 검사가 선행)."""
    out = Image.new('RGB', (W, H))
    o = out.load()
    캐시 = {}
    clipped = 칠한수 = 0
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            got = 캐시.get(p)
            if got is None:
                w = 1.0 if 전면 else 가중치(chroma(p))
                if w <= 0.0:
                    got = (p, 0, 0)
                else:
                    lr, lg, lb = lin_rgb(p)
                    gr, gg, gb = lr * 게인[0], lg * 게인[1], lb * 게인[2]
                    nr, ng, nb = 무릎압축(gr, 무릎), 무릎압축(gg, 무릎), 무릎압축(gb, 무릎)
                    # 페더 구간은 «선형광에서» 섞는다(sRGB 에서 섞으면 경계가 탁해진다)
                    if w < 1.0:
                        nr = lr + (nr - lr) * w
                        ng = lg + (ng - lg) * w
                        nb = lb + (nb - lb) * w
                    got = ((round(_to_srgb(nr)), round(_to_srgb(ng)), round(_to_srgb(nb))),
                           1, 1 if max(gr, gg, gb) > 1.0 else 0)
                캐시[p] = got
            o[x, y] = got[0]
            칠한수 += got[1]
            clipped += got[2]
    return out, 칠한수, clipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('입력')
    ap.add_argument('출력')
    ap.add_argument('--목표', required=True, help='염료 목표 hex — 예 "#FF6B5C"')
    ap.add_argument('--견본', help='이 경로에 램프 견본 카드도 굽는다(굽기 참조용)')
    ap.add_argument('--램프', default='#FFCFC6,#FF8877,#FF6B5C,#E8543F',
                    help='견본 카드에 실을 램프(밝은→어두운)')
    ap.add_argument('--무릎', type=float, default=0.94,
                    help='하이라이트 압축 시작점(선형광 0~1). 낮추면 결이 살고 코어가 목표에서 멀어진다')
    ap.add_argument('--보정', type=int, default=3,
                    help='조준 보정 회차(닫힌 루프). 1 이면 한 번만 곱하고 끝낸다')
    ap.add_argument('--색상만', action='store_true',
                    help='목표 색에서 «색상»만 가져오고 채도·밝기는 원본 그대로 둔다 — 「색만 바꾸고 결은 그대로」. '
                         '왜(유호 지적 09-05 「라피스랑 메도우 버전은 너무 쨍한데? 잘 안보일정도야」): '
                         '킷 색을 그대로 목표로 주면 원본보다 채도가 확 오른다. 양모는 킷 색을 채도 62%% 로 '
                         '앉히기 때문이다(블렌더 부품 실측). 이 손잡이는 그 비율을 «그림마다» 알아서 지킨다. '
                         '밝기도 원본 평균에 자동으로 못 박는다')
    ap.add_argument('--밝기', type=float,
                    help='보이는 평균 L*(밝기)를 이 값에 못 박는다. 안 주면 색만 맞추고 밝기는 흐르는 대로 둔다. '
                         '왜 필요한가(09-05 실측): 코어를 목표색에 맞추면 «어두운 그림일수록 게인이 크게 걸려» '
                         '더 많이 밝아진다 — 같은 메도우로 칠했는데 별은 +4.8, 폼폼은 +21.0 이었다. '
                         '그러면 부품끼리의 명암 관계가 뭉개져 한 판에 늘어놓았을 때 몇몇만 튄다')
    ap.add_argument('--무채base', action='store_true',
                    help='전면이 무채 천(회색 원료 base)일 때 — 마스크를 끄고 코어를 L* 백분위로 잰다. '
                         '유채 픽셀 2%% 초과 그림엔 못 쓴다(마스크가 지킬 것이 있는 그림)')
    a = ap.parse_args()

    _원 = Image.open(a.입력)
    # 🔑 투명을 들고 온다(2026-09-05) — 블렌더 부품(`요소_*_몸.png`)은 RGBA 라서
    #   그냥 convert('RGB') 하면 투명 자리가 «검정»으로 굳어 지면에 검은 네모가 뜬다.
    #   알파는 염색 대상이 아니므로 떼어 두었다가 출력에 그대로 되붙인다.
    _알파 = _원.getchannel('A') if _원.mode in ('RGBA', 'LA') or 'transparency' in _원.info else None
    im = _원.convert('RGB')
    W, H = im.size
    px = im.load()

    # 1 — 코어 «좌표»를 못박는다.
    # ⚠왜 좌표냐(실측 08-15 · 이 도구가 처음 낸 오답의 원인): 코어를 「채도 40~70 백분위」로만
    #   정의하면 게인이 채도 분포를 움직여 **전후로 다른 픽셀을 재게 된다**. 첫 판은 그래서
    #   변환식이 거의 맞았는데도 ΔE 9.2 로 읽혔다 — 움직이는 과녁을 쟀다.
    #   그래서 백분위는 «입력에서 한 번만» 쓰고, 그 좌표를 들고 출력에서 같은 자리를 재비교한다.
    표본 = []
    전체 = 0
    for y in range(0, H, 3):
        for x in range(0, W, 3):
            p = px[x, y]
            c = chroma(p)
            전체 += 1
            if c > C_충만:
                표본.append((c, p, (x, y)))

    if a.무채base:
        # 자격 검사 — 유채가 2% 를 넘으면 이건 「전면 천」이 아니라 마스크가 지킬 것이 있는 그림이다.
        유채율 = len(표본) / max(전체, 1)
        if 유채율 > 0.02:
            sys.exit(f'🔴 유채 픽셀 {유채율*100:.1f}% — 무채 base 가 아니다(마스크가 눈·배경·스티치를 '
                     f'지켜야 하는 그림). --무채base 를 빼고 돌린다.')
        # 코어를 «L* 40~70 백분위»로 잰다 — 채도축이 죽은 그림에서 «천 그 자체»의 자리.
        L표본 = []
        for y in range(0, H, 3):
            for x in range(0, W, 3):
                p = px[x, y]
                L표본.append((lab(p)[0], p, (x, y)))
        L표본.sort(key=lambda t: t[0])
        lo, hi = int(len(L표본) * 0.40), int(len(L표본) * 0.70)
        코어밴드 = L표본[lo:hi] or L표본
        코어좌표 = [t[2] for t in 코어밴드]
    else:
        if len(표본) < 200:
            sys.exit(f'유채 표본이 {len(표본)}개뿐 — 이 그림엔 갈아입힐 양모가 없다.\n'
                     f'   전면이 무채 천(회색 원료 base)이면 --무채base 로 돌린다(F103).')
        표본.sort(key=lambda t: t[0])
        lo, hi = int(len(표본) * 0.40), int(len(표본) * 0.70)
        코어밴드 = 표본[lo:hi] or 표본
        코어좌표 = [t[2] for t in 코어밴드]

    def 좌표평균(image_px):
        n = len(코어좌표)
        s = [0.0, 0.0, 0.0]
        for (x, y) in 코어좌표:
            q = image_px[x, y]
            for i in range(3):
                s[i] += q[i]
        return tuple(v / n for v in s)

    def 자유측정(image_px):
        """입력과 «같은 정의»를 출력에 새로 적용한 값 — 외부 검토자가 계산할 숫자.
        무채 base 모드에선 축도 같이 간다: 출력은 유채가 됐어도 «천 전체»가 과녁이므로 L* 백분위."""
        t = []
        for y in range(0, H, 3):
            for x in range(0, W, 3):
                q = image_px[x, y][:3]   # 출력이 RGBA 일 수 있다(알파 복원 뒤) — 색 함수는 3채널만 받는다
                if a.무채base:
                    t.append((lab(q)[0], q))
                else:
                    c = chroma(q)
                    if c > C_충만:
                        t.append((c, q))
        if len(t) < 200:
            return None
        return 코어([(c, q) for c, q in t])

    원본코어 = 좌표평균(px)
    목표 = hex2rgb(a.목표)

    if a.색상만:
        # 원본의 «결»(밝기·채도)을 그대로 두고 목표의 «색상»만 얹는다.
        oL, oa, ob = lab(원본코어)
        oC = math.hypot(oa, ob)
        _, ta, tb = lab(목표)
        th = math.atan2(tb, ta)
        목표 = tuple(round(v) for v in lab2rgb(oL, oC * math.cos(th), oC * math.sin(th)))
        print(f'   색상만 — 원본 결(L*{oL:.1f} 채도 {oC:.1f})에 {a.목표.upper()} 의 색상만 얹는다 → #{hexs(목표)}')

    print(f'■ 입력  {a.입력}')
    print(f'   코어 #{hexs(원본코어)}  (좌표 {len(코어좌표):,}점으로 못박음)  → 목표 {a.목표.upper()}')

    # 2~4 — 게인 적용 → 같은 좌표로 재측정 → 어긋난 만큼 조준을 밀어 다시(닫힌 루프).
    #   한 번에 안 맞는 이유는 비선형이다: 무릎 압축 + sRGB 인코딩 + 8bit 반올림.
    조준 = list(lin_rgb(목표))
    s_lin = lin_rgb(원본코어)
    out = None
    for 회차 in range(1, a.보정 + 1):
        # ⚠순서 주의 — zip(원본, 조준) 다. 뒤집으면 게인이 역수가 되어 «어두워지는데»
        #   그림은 그럴싸하게 나온다(실측 08-15: 첫 판이 R×0.622 로 더 칙칙해졌다).
        게인 = tuple(t / max(s, 1e-6) for s, t in zip(s_lin, 조준))
        out, 칠한수, clipped = 적용(px, W, H, 게인, a.무릎, 전면=a.무채base)
        o = out.load()
        anchored = 좌표평균(o)
        d = de2000(lab(anchored), lab(목표))
        print(f'   {회차}회차 게인 R×{게인[0]:.3f} G×{게인[1]:.3f} B×{게인[2]:.3f}'
              f' → 같은 좌표 #{hexs(anchored)}  ΔE {d:.2f}')
        if d <= 1.5 or 회차 == a.보정:
            break
        # 부족한 만큼 선형광에서 조준을 밀어준다(채널별 비율 보정)
        cur = lin_rgb(anchored)
        want = lin_rgb(목표)
        조준 = [min(1.0, 조준[i] * (want[i] / max(cur[i], 1e-6))) for i in range(3)]

    # 4.5 — 밝기 못박기(선택). 색조는 그대로 두고 «보이는 평균 밝기»만 목표로 민다.
    #   게인 전체에 스칼라를 곱하면 선형광이 배로 움직여 색조가 안 흔들린다.
    #   L* 와 선형광은 세제곱 관계라 비율을 그대로 세제곱해 밀고, 비선형(무릎·8bit)이 남기는
    #   오차는 닫힌 루프로 줄인다 — 색 보정과 같은 방식이다.
    _알파px = _알파.load() if _알파 is not None else None

    def 보이는평균L(image_px):
        s = 0.0; n = 0
        for y in range(0, H, 4):
            for x in range(0, W, 4):
                if _알파px is not None and _알파px[x, y] < 200:
                    continue
                s += lab(image_px[x, y][:3])[0]; n += 1
        return s / max(n, 1)

    if a.색상만 and a.밝기 is None:
        a.밝기 = 보이는평균L(px)      # 원본의 «보이는 밝기»를 그대로 지킨다

    if a.밝기 is not None:
        전 = 보이는평균L(out.load())
        for _ in range(8):
            현재 = 보이는평균L(out.load())
            if abs(현재 - a.밝기) < 0.3:
                break
            s = ((a.밝기 + 16) / max(현재 + 16, 1e-6)) ** 3
            게인 = tuple(g * max(0.25, min(4.0, s)) for g in 게인)
            out, 칠한수, clipped = 적용(px, W, H, 게인, a.무릎, 전면=a.무채base)
        print(f'   밝기 못박음  보이는 평균 L* {전:.1f} → {보이는평균L(out.load()):.1f}  (목표 {a.밝기:.1f})')

    if _알파 is not None:
        out = out.convert('RGBA')
        out.putalpha(_알파)
    out.save(a.출력)
    o = out.load()
    앵커 = 좌표평균(o)
    자유 = 자유측정(o)
    d앵커 = de2000(lab(앵커), lab(목표))
    print(f'■ 출력  {a.출력}')
    print(f'   ㉠같은 좌표(전후 동일 픽셀)  #{hexs(앵커)}  목표와 ΔE2000 **{d앵커:.2f}**  ← 변환 정확도')
    if 자유:
        d자유 = de2000(lab(자유), lab(목표))
        print(f'   ㉡새로 측정(외부 검토자 값)  #{hexs(자유)}  목표와 ΔE2000 **{d자유:.2f}**  ← 남이 잴 값')
        print(f'   ⚠ 둘은 «다른 질문»이다 — ㉠은 「내가 옮기려던 픽셀이 목표에 갔나」,'
              f' ㉡은 「그림 전체의 대표색이 목표인가」. ㉡이 큰 것은 오차가 아니라'
              f' 밝힌 뒤 눈으로 판정할 자리다(양모는 섬유 그림자를 품는다).')
    print(f'   칠한 픽셀 {칠한수:,} / {W*H:,} ({칠한수/(W*H)*100:.1f}%)'
          f' · 무릎에 걸린 픽셀 {clipped:,} ({clipped/max(칠한수,1)*100:.1f}%)')
    if d앵커 > 3.0:
        print('   🔴 ㉠이 ΔE 3 초과 — 목표가 sRGB 색역 밖이거나 무릎이 낮다. 보정 회차를 늘려도 안 닿는다.')

    # 5 — 견본 카드(굽기 참조용). 큰 코어 블록이 지배 신호, 아래 램프가 명암 지시.
    if a.견본:
        램프 = [hex2rgb(h.strip()) for h in a.램프.split(',')]
        S = 1024
        card = Image.new('RGB', (S, S), (230, 228, 226))  # 스튜디오 배경과 같은 회색
        c = card.load()
        for y in range(120, 700):
            for x in range(120, S - 120):
                c[x, y] = 목표
        w = (S - 240) // len(램프)
        for i, col in enumerate(램프):
            for y in range(740, 900):
                for x in range(120 + i * w, 120 + (i + 1) * w):
                    c[x, y] = col
        card.save(a.견본)
        print(f'■ 견본  {a.견본}  (코어 {a.목표.upper()} + 램프 {len(램프)}단 · 글자 0)')


if __name__ == '__main__':
    main()
