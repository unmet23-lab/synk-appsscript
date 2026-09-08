# -*- coding: utf-8 -*-
"""마스코트 인사 컷 — 본체를 «앞으로 숙인 것처럼» 기울여 만든다 (유호 지시 2026-09-08).

  왜 굽지 않고 기울이나
    인사 컷을 따로 구우면 꽃·가방끈·다리가 매번 달라진다(09-08 실측 · 34도 둘의 꽃 줄기가
    본체의 절반이었다). 본체를 그대로 변형하면 **의상이 본체에서 온 화소 그대로**다.

  어떻게 «앞으로 숙임»을 2차원에서 흉내내나
    앞으로 숙이면 정면 카메라에서는 셋이 함께 일어난다 —
      ① 발을 축으로 **세로가 짧아 보인다**(cos θ 만큼).
      ② 머리가 카메라 쪽으로 와서 **위쪽이 조금 넓어 보인다**(원근).
      ③ 눈이 화면에서 **아래로 내려온다**(①의 결과).
    그래서 발선을 고정하고 «위는 넓히고 전체는 세로로 누르는» 사다리꼴 변형을 건다.

  🔴 한계 — 2차원이라 «정수리가 더 보이는 것»은 못 만든다. 그래서 깊게 숙일수록
    «숙였다»보다 «눌렸다»로 읽힌다. 15~20도가 자연스러운 상한이다(실측 09-08).

  쓰는 법
    python tools/마스코트인사만들기.py --각 18 --출력 <파일>
    python tools/마스코트인사만들기.py --누구 마린 --각 12,22 --출력틀 "docs/캐릭터/정본_4K_후보/마린_인사{n}.png"
"""
import argparse, math, os
import numpy as np
from PIL import Image

SRC = os.path.join('docs', '캐릭터', '정본_4K')


def 기울이기(a, 각도, 위넓힘=None):
    """a = RGBA 배열. 발선을 고정하고 앞으로 숙인 꼴로 변형한다."""
    th = math.radians(각도)
    k = math.cos(th)                       # 세로가 짧아지는 비
    p = 위넓힘 if 위넓힘 is not None else 1 + (1 - k) * 0.55   # 위쪽이 넓어지는 비(원근)
    m = a[..., 3] > 128
    ys, xs = np.where(m)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    H, W = a.shape[0], a.shape[1]
    cx = (x0 + x1) / 2.0
    발 = y1                                 # 발선 = 고정점
    높 = 발 - y0

    # 원본 네 귀 → 갈 곳 네 귀 (왼위·왼아래·오른아래·오른위 순으로 PIL 이 받는다)
    나가는곳 = [
        (cx - (cx - x0) * p, 발 - 높 * k),   # 왼위 — 넓히고 내린다
        (x0, 발),                            # 왼아래 — 발은 그대로
        (x1, 발),                            # 오른아래
        (cx + (x1 - cx) * p, 발 - 높 * k),   # 오른위
    ]
    들어온곳 = [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]

    # PIL 의 QUAD 는 «낼 그림의 네 귀에 원본의 어느 자리를 놓을까»를 받는다 ⇒ 거꾸로 푼다
    A = []
    B = []
    for (X, Y), (u, v) in zip(나가는곳, 들어온곳):
        A.append([X, Y, 1, 0, 0, 0, -u * X, -u * Y])
        A.append([0, 0, 0, X, Y, 1, -v * X, -v * Y])
        B += [u, v]
    coef = np.linalg.solve(np.asarray(A, float), np.asarray(B, float))
    out = Image.fromarray(a).transform((W, H), Image.PERSPECTIVE, tuple(coef), Image.BICUBIC)
    return np.asarray(out), dict(세로비=round(k, 4), 위넓힘=round(p, 4))


if __name__ == '__main__':
    q = argparse.ArgumentParser()
    q.add_argument('--누구', default='마린')
    q.add_argument('--각', default='18')
    q.add_argument('--출력')
    q.add_argument('--출력틀')
    q.add_argument('--위넓힘', type=float)
    n = q.parse_args()
    a = np.asarray(Image.open(os.path.join(SRC, f'{n.누구}_본체.png')).convert('RGBA'))
    각들 = [float(x) for x in str(n.각).split(',')]
    for i, 각 in enumerate(각들, 1):
        b, 잰것 = 기울이기(a, 각, n.위넓힘)
        길 = n.출력 if (n.출력 and len(각들) == 1) else (n.출력틀 or 'docs/캐릭터/정본_4K_후보/{누구}_인사{n}.png').format(n=i, 누구=n.누구)
        os.makedirs(os.path.dirname(길), exist_ok=True)
        Image.fromarray(b).save(길)
        m = b[..., 3] > 128
        ys, xs = np.where(m)
        print(f'  ✅ {각:.0f}도 → {길}  세로비 {잰것["세로비"]} · 위넓힘 {잰것["위넓힘"]} · '
              f'몸 {int(xs.max()-xs.min()+1)}x{int(ys.max()-ys.min()+1)}')
