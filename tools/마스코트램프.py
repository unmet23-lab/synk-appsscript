# -*- coding: utf-8 -*-
"""마스코트 램프 «자» — 확정 렌더 PNG 에서 5단 램프를 뽑는다.

왜 도구인가(F456): 같은 그림의 「코어색」이 도구마다 다른 값으로 나왔다(자 넷, 자간 ΔE 3.62).
숫자를 문서에 적는 것만으로는 다음 세션이 그 숫자를 **재현할 수 없다** — 그래서 자를 파일로 못박는다.

레시피(고정 · 바꾸면 정본 램프가 흔들린다):
  ① 유채색만 본다 — HSV 채도 S >= 0.20. 크림실·검은 눈·무채 배경이 여기서 빠진다.
  ② 밴드는 **L\*** (지각 명도) 백분위로 가른다. ⚠V(최대채널)로 가르면 «틀린 얼굴로» 나온다 —
     체리 하이라이트 #F2B0B1 은 저채도 밝은 분홍이라 V 로는 순빨강(V=1.0)에 밀려
     상위 밴드가 #FF5C69 로 잡혔다(실측 ΔE76 44.9). L\* 로 바꾸니 0.6 이 됐다.
  ③ 각 단 = 백분위 중심 ±2.0 구간 픽셀의 sRGB 평균.

검증(--검증): 이 자로 체리 정본(마스코트_렌더/본체.png)을 다시 재면 토큰에 적힌 5단이
  ΔE76 0.88~2.84(평균 1.8)로 재현된다. 재현이 깨지면 **자가 아니라 그림이 바뀐 것**이니
  둘 중 무엇이 움직였는지부터 가른다.

  사용:  python tools/마스코트램프.py <png>          — 램프 5단 출력
         python tools/마스코트램프.py --검증          — 체리 정본 재현 검사
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

S문턱 = 0.20
중심들 = [98.0, 91.0, 52.5, 18.0, 7.0]   # Highlight · Top · Core · Deep · Rim
폭 = 4.0
단이름 = ['Highlight', 'Top', 'Core', 'Deep', 'Rim']


def 로드(경로):
    a = np.array(Image.open(경로).convert('RGB')).reshape(-1, 3).astype(np.float64) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722])
    L = np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)
    mx, mn = a.max(1), a.min(1)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-9), 0.0)
    return a, S, L


def 램프(경로):
    a, S, L = 로드(경로)
    m = S >= S문턱
    if not m.any():
        raise SystemExit(f'유채색 픽셀이 0이다 — 마스코트 그림이 맞나: {경로}')
    유채, LL = a[m], L[m]
    단 = []
    for 중심 in 중심들:
        lo, hi = max(0.0, 중심 - 폭 / 2), min(100.0, 중심 + 폭 / 2)
        p1, p2 = np.percentile(LL, [lo, hi])
        b = 유채[(LL >= p1) & (LL <= p2)]
        단.append('#%02X%02X%02X' % tuple(int(round(c * 255)) for c in b.mean(0)))
    return 단, int(m.sum()), len(a)


def _lab(h):
    r, g, b = [int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = f(r), f(g), f(b)
    X = (r * .4124 + g * .3576 + b * .1805) / .95047
    Y = r * .2126 + g * .7152 + b * .0722
    Z = (r * .0193 + g * .1192 + b * .9505) / 1.08883
    g_ = lambda t: t ** (1 / 3) if t > .008856 else (7.787 * t + 16 / 116)
    fx, fy, fz = g_(X), g_(Y), g_(Z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def dE76(h1, h2):
    return sum((x - y) ** 2 for x, y in zip(_lab(h1), _lab(h2))) ** .5


def 검증():
    """자가 토큰의 체리 정본을 재현하는가 — 탐지력은 여기서 산다."""
    토큰 = json.load(open(os.path.join(ROOT, 'docs', '디자인_토큰.json'), encoding='utf-8'))
    정본 = [c['hex'] for c in 토큰['색']['마스코트']['램프']]
    잰것, n, 전체 = 램프(os.path.join(ROOT, 'docs', '캐릭터', '마스코트_렌더', '본체.png'))
    차 = [dE76(a, b) for a, b in zip(잰것, 정본)]
    print(f'체리 정본 재현 — 유채 {n:,}/{전체:,}')
    for 이름, 목표, 값, d in zip(단이름, 정본, 잰것, 차):
        print(f'  {이름:10} 정본 {목표} ← 잰 값 {값}  ΔE76 {d:5.2f}')
    print(f'  평균 ΔE76 {sum(차)/len(차):.2f} · 최대 {max(차):.2f}')
    if max(차) > 4.0:
        print('🔴 재현 실패 — 자가 아니라 «그림»이 바뀌었는지부터 가른다(둘 다 움직였을 수 있다).')
        return 1
    print('✅ 재현 통과(최대 4.0 이내)')
    return 0


if __name__ == '__main__':
    인자 = sys.argv[1:]
    if not 인자 or 인자[0] == '--검증':
        sys.exit(검증())
    단, n, 전체 = 램프(인자[0])
    print(f'유채 {n:,}/{전체:,} ({n/전체*100:.1f}%)')
    for 이름, 값 in zip(단이름, 단):
        print(f'  {이름:10} {값}')
    print(' '.join(단))
