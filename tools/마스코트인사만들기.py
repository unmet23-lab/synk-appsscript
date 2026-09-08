# -*- coding: utf-8 -*-
"""마스코트 인사 컷 — 본체를 «앞으로 숙인 것처럼» 기울여 만든다 (유호 지시 2026-09-08).

🔴🔴 **이 자로 만든 판은 정본에 안 섰다 — 유호님이 09-08 에 물리셨다.**
   유호 판정 원문: 「인사하는 티가 안 나는데? 이 직전에 1,2번 사진은 괜찮았어.
   그냥 인사하는건 이 두개로 확정해」 ⇒ 인사는 **09-07 판**(숙인 컷에서 투구만 떼어
   본체 몸에 얹은 것 · `tools/마스코트헬멧얹기.py`)으로 확정됐다(결정 원장 09-08).
   🔑 **왜 안 통했나 — 마린은 키의 60%가 투구다.** 몸통·다리가 짧아서 몸을 12% 눌러도
   머리가 4096 중 151화소밖에 안 내려간다. 화면에서는 안 보인다.
   그리고 통째로 기울이면 투구까지 눌려(1955→1879 · 폭 2009→2045) 「숙였다」가 아니라
   **「작아졌다」로 읽힌다.** 2차원 변형으로는 «정수리가 더 보이는 것»을 못 만들기 때문이다.
   ⇒ **머리가 큰 캐릭터의 «숙임»은 눌러서 못 만든다. 숙인 머리를 «구워서» 얹어야 한다.**
   이 파일은 다른 캐릭터(머리가 작은 쪽)나 다른 동작에 쓸 수 있어 남긴다.


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


def 머리지킴(a, 누름=0.90, 겹침=90):
    """머리 크기는 그대로 두고 «몸만» 눌러 머리를 내린다 (유호 지적 2026-09-08).

    🔴 왜 이 자가 따로 있나 — 통째로 기울이면(기울이기) 머리까지 같이 눌려서
       「숙였다」가 아니라 **「작아졌다」로 읽힌다**(유호 「4,5번이 크기가 점점 작아지네」).
       실제 인사는 머리 크기가 그대로인 채 머리가 «내려온다».
    어떻게 — 투구 아래 끝을 선으로 삼아 둘로 가른다.
       ① 투구 = 크기 그대로, 내려온 만큼 아래로 옮긴다.
       ② 몸·다리 = 발선을 고정하고 세로만 `누름` 배로 누른다.
       ③ 이음매는 투구가 어깨를 덮는 자리라 겹쳐 두면 안 보인다.
    """
    m = a[..., 3] > 128
    r, g, b = (a[..., i].astype(int) for i in range(3))
    navy = m & (b - r > 25) & (b > 45) & (b < 190)     # 마린 투구
    ny, _ = np.where(navy)
    투끝 = int(ny.max())
    ys, _ = np.where(m)
    발 = int(ys.max())
    몸높 = 발 - 투끝
    내림 = int(round(몸높 * (1 - 누름)))

    H, W = a.shape[0], a.shape[1]
    낼 = np.zeros_like(a)

    # ② 몸·다리 — 발선 고정으로 세로만 누른다
    몸 = Image.fromarray(a[투끝 - 겹침:발 + 1])
    새높 = max(1, int(round(몸.height * 누름)))
    몸 = 몸.resize((W, 새높), Image.BICUBIC)
    윗 = 발 + 1 - 새높
    낼[윗:발 + 1] = np.asarray(몸)

    # ① 투구 — 크기 그대로 내림만큼 내려 얹는다
    투 = Image.fromarray(a[:투끝 + 1])
    캔 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    캔.paste(투, (0, 내림))
    낼 = np.asarray(Image.alpha_composite(Image.fromarray(낼), 캔))
    return 낼, dict(투구아래끝=투끝, 내림=내림, 누름=round(누름, 3))


if __name__ == '__main__':
    q = argparse.ArgumentParser()
    q.add_argument('--누구', default='마린')
    q.add_argument('--각', default='18')
    q.add_argument('--출력')
    q.add_argument('--출력틀')
    q.add_argument('--위넓힘', type=float)
    q.add_argument('--누름', help='머리 크기를 지키고 몸만 누른다(0.90 = 몸을 10%% 누름)')
    n = q.parse_args()
    a = np.asarray(Image.open(os.path.join(SRC, f'{n.누구}_본체.png')).convert('RGBA'))
    if n.누름:
        for i, k in enumerate([float(x) for x in str(n.누름).split(',')], 1):
            b, 잰것 = 머리지킴(a, k)
            길 = (n.출력 if n.출력 else (n.출력틀 or 'docs/캐릭터/정본_4K_후보/{누구}_머리지킴{n}.png')).format(n=i, 누구=n.누구)
            os.makedirs(os.path.dirname(길), exist_ok=True)
            Image.fromarray(b).save(길)
            m = b[..., 3] > 128
            ys, xs = np.where(m)
            print(f'  ✅ 누름 {k} → {길}  내림 {잰것["내림"]}px · 몸 {int(xs.max()-xs.min()+1)}x{int(ys.max()-ys.min()+1)}')
        raise SystemExit
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
