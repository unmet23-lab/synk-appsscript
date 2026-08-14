"""자립형 HTML 을 «가볍게» 만든다 — 박힌 data URI 만 줄인다 (2026-08-15).

왜 있나(실측 08-15): `tools/자립형굽기.js` 가 만든 `펠트코랄_0815_자립형.html` 이 4.7MB
(한 줄이 1.48MB)라 **유호님 화면에서 안 보였다** — 파일은 멀쩡했다(data URI 6개·doctype·
`</html>` 정상 · Chrome 렌더 요소 183). 즉 결함이 아니라 «전달 한계»다.
같은 자리가 이미 하나 더 있다 — `자개_캐러셀_예시_0814_자립형.html` 은 10MB 다.

무엇을 하나: 원본 HTML 을 다시 읽지 않는다. **이미 박힌 data URI 만** 꺼내 줄이고 다시 박는다.
  → 경로 해석·참조 탐색 로직을 `자립형굽기.js` 와 중복 구현하지 않는다(사본은 반드시 갈라진다).

🔑 **색을 흔들면 안 되는 산출물이 있다**(색 A/B 보드가 정확히 그것이다). 그래서 이 도구는
   줄인 뒤 각 그림의 **코어색을 원본과 대조해 ΔE2000 을 찍고**, 문턱을 넘으면 **거부한다**.
   JPEG 은 크로마 서브샘플링(4:2:0)이 색을 뭉개므로 항상 4:4:4 로 저장한다.
   ⚠틀릴 때의 모습: 조용히 색이 밀린 «가벼운» 보드가 나와, 유호님이 그걸 보고 색을 고른다.
     그래서 초록이 아니라 «수치»를 찍고, 문턱 초과는 exit 1 로 죽는다.
   닫을 것: 없다(신설 통로 · 손 압축을 대신한다).

사용법:
  python tools/자립형가볍게.py <자립형.html> <나갈곳.html> [--최대폭 900] [--품질 95] [--문턱 1.0]
종료 코드: 0=통과 · 1=색이 문턱 초과(안 쓴다) · 2=쓸 data URI 가 없다
"""
import argparse
import base64
import io
import math
import re
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

URI = re.compile(r'data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)')


# ── 색 측정 — `펠트색갈이.py` 와 «같은 정의»를 쓴다(정의가 갈리면 대조가 판정을 못 낸다) ──
def _lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lab(rgb):
    r, g, b = (_lin(c) for c in rgb)
    X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29

    fx, fy, fz = f(X / 0.95047), f(Y / 1.0), f(Z / 1.08883)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def de2000(l1, l2):
    L1, a1, b1 = l1
    L2, a2, b2 = l2
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


def 코어(im):
    """유채 픽셀의 채도 40~70 백분위 평균. 유채가 거의 없으면 None(색 판정 대상이 아니다)."""
    q = im.convert('RGB').copy()
    q.thumbnail((512, 512))
    표본 = []
    for r, g, b in q.getdata():
        mx, mn = max(r, g, b), min(r, g, b)
        s = 0 if mx == 0 else (mx - mn) / mx
        if s > 0.25 and mx > 60:
            표본.append((s, (r, g, b)))
    if len(표본) < 200:
        return None
    표본.sort(key=lambda t: t[0])
    lo, hi = int(len(표본) * 0.40), int(len(표본) * 0.70)
    band = [t[1] for t in 표본[lo:hi]] or [t[1] for t in 표본]
    n = len(band)
    return tuple(sum(p[i] for p in band) / n for i in range(3))


def hexs(rgb):
    return ''.join('%02X' % round(c) for c in rgb)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('입력')
    ap.add_argument('출력')
    ap.add_argument('--최대폭', type=int, default=900)
    ap.add_argument('--품질', type=int, default=95)
    ap.add_argument('--문턱', type=float, default=1.0,
                    help='허용 색 이동 ΔE2000. 넘으면 파일을 쓰지 않고 죽는다')
    a = ap.parse_args()

    s = open(a.입력, encoding='utf-8').read()
    조각 = list(URI.finditer(s))
    if not 조각:
        sys.exit(2)

    print(f'■ {a.입력}  {len(s)/1024/1024:.2f} MB · data URI {len(조각)}개'
          f'  → 최대폭 {a.최대폭} · JPEG 품질 {a.품질} (4:4:4)')

    새것, 최대이동 = [], 0.0
    for i, m in enumerate(조각, 1):
        raw = base64.b64decode(m.group(2))
        im = Image.open(io.BytesIO(raw))
        before = 코어(im)
        w, h = im.size
        if w > a.최대폭:
            im = im.convert('RGB').resize(
                (a.최대폭, round(h * a.최대폭 / w)), Image.LANCZOS)
        else:
            im = im.convert('RGB')
        buf = io.BytesIO()
        # subsampling=0 = 4:4:4 — 색을 뭉개지 않는다(색 판정 보드의 급소).
        im.save(buf, 'JPEG', quality=a.품질, subsampling=0, optimize=True)
        out = buf.getvalue()
        after = 코어(Image.open(io.BytesIO(out)))

        if before and after:
            d = de2000(lab(before), lab(after))
            최대이동 = max(최대이동, d)
            표 = f'코어 #{hexs(before)} → #{hexs(after)}  ΔE {d:.2f}'
        else:
            표 = '유채 거의 없음 — 색 대조 건너뜀(색표·무채 그림)'
        print(f'   {i}. {w}×{h} {len(raw)/1024:>7.0f}KB → {len(out)/1024:>6.0f}KB   {표}')
        새것.append('data:image/jpeg;base64,' + base64.b64encode(out).decode('ascii'))

    # 뒤에서부터 갈아 끼운다(앞에서 하면 뒤 조각의 오프셋이 밀린다)
    out_s = s
    for m, 새 in zip(reversed(조각), reversed(새것)):
        out_s = out_s[:m.start()] + 새 + out_s[m.end():]

    print(f'■ 색 최대 이동 ΔE {최대이동:.2f} (문턱 {a.문턱})')
    if 최대이동 > a.문턱:
        print('   🔴 문턱 초과 — **파일을 쓰지 않았다.** 색이 밀린 보드로 색을 고르게 두지 않는다.')
        print('      --품질 을 올리거나 --최대폭 을 키워 다시 돌린다.')
        sys.exit(1)

    open(a.출력, 'w', encoding='utf-8').write(out_s)
    남은 = len(re.findall(r'src="(?!data:)[^"]+"', out_s))
    print(f'■ {a.출력}  {len(out_s)/1024/1024:.2f} MB'
          f'  ({len(out_s)/len(s)*100:.0f}% · 잔존 외부 참조 {남은}건)')
    if 남은:
        print('   ⚠ 외부 참조가 남았다 — 자립형이 아니다(입력이 자립형이 아니었다).')


if __name__ == '__main__':
    main()
