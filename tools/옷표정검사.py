# -*- coding: utf-8 -*-
"""표정을 얹은 그림을 «전수»로 잰다 — 옷이 지워진 자리를 찾는다.

  왜 있나 (2026-09-08)
    옷표정얹기.py 는 «창 밖»이 옷 그림과 같은지만 센다. 그래서 창 «안»에서 옷이 지워져도
    100% 통과로 나온다. 안경이 그렇게 반쯤 지워졌는데 숫자로는 안 보였다.

  무엇을 재나
    ① 옷화소_지움 = 옷 그림에서 «옷»이던 화소 중 표정을 얹어 바뀐 것의 비율.
       안경처럼 눈 위에 앉는 옷은 이 값이 크다. 목도리·후드는 0 에 가까워야 한다.
    ② 눈갈림 = 창 안에서 실제로 바뀐 화소의 비율. 0 이면 표정이 안 얹힌 것이다.
    ③ 표정끼리 서로 다른가 — 열넷이 전부 같은 그림이면 얹기가 죽은 것이다.

  쓰는 법
    python tools/옷표정검사.py                 # 전수
    python tools/옷표정검사.py --옷 안경        # 한 벌만
"""
import importlib.util
import json
import os
import sys

import numpy as np
from PIL import Image

저장소 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 눈 찾는 자는 «한 곳»에서만 빌린다 — 두 곳이 각자 찾으면 판정이 갈린다
_spec = importlib.util.spec_from_file_location('옷표정얹기', os.path.join(저장소, 'tools', '옷표정얹기.py'))
_얹기 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_얹기)
옷방 = os.path.join(저장소, 'docs', 'Loom_자산', '옷', 'GPT')
결과방 = os.path.join(저장소, 'docs', 'Loom_자산', '옷', 'GPT_표정')


def 읽기(경로):
    return np.asarray(Image.open(경로).convert('RGB')).astype(int)


def 옷마스크(a, 눈상자=None):
    """옷 = 몸이면서 «털이 아닌» 곳. 털은 어둡고(밝기<150) 붉은 쪽이며 색이 안 쨍하다.

    🔴 눈 자리는 빼야 한다. 눈(초록 홍채·흰 점)도 털이 아니라서 옷으로 잡히는데,
       표정이 바뀌면 눈은 «당연히» 바뀐다. 안 빼면 어느 옷이든 2~3% 가 찍혀
       진짜로 지워진 옷과 안 갈린다(09-08 첫 판이 그래서 스무 벌을 다 짚었다).
    """
    몸 = (a[..., 0] < 240) | (a[..., 1] < 240) | (a[..., 2] < 240)
    밝 = a.mean(axis=2)
    쨍 = a.max(axis=2) - a.min(axis=2)
    털 = 몸 & (밝 < 150) & (a[..., 0] >= a[..., 2]) & (쨍 < 52)
    옷 = 몸 & ~털
    if 눈상자 is not None:
        # 🔴 눈은 «자리»가 아니라 «색»으로 뺀다. 네모로 빼면 그 안에 있는 안경 테까지
        #    빠져서, 안경이 통째로 지워져도 0.00% 로 나온다(09-08 둘째 판이 그랬다).
        #    까몽 눈 = 초록 홍채 + 흰 점. 안경 테는 빨강이라 이 조건에 안 걸린다.
        x0, y0, x1, y1 = (int(v) for v in 눈상자)
        여 = int(max(y1 - y0, 1) * 1.2)
        창 = np.zeros_like(옷)
        창[max(0, y0 - 여):y1 + 여, max(0, x0 - 여):x1 + 여] = True
        초록 = (a[..., 1] > a[..., 0]) & (a[..., 1] > a[..., 2])
        흰점 = 밝 > 200
        옷 = 옷 & ~(창 & (초록 | 흰점))
    return 몸, 옷


def 한벌(누구, 옷이름):
    옷경로 = os.path.join(옷방, f'{누구}_{옷이름}.png')
    if not os.path.exists(옷경로):
        return None
    옷a = 읽기(옷경로)
    # 정본 눈 비율을 기준으로 이 그림의 눈을 찾아, 그 자리를 «옷»에서 뺀다
    본a, 본몸 = _얹기.정본읽기(os.path.join(_얹기.정본방, f'{누구}_본체.png'))
    본눈 = _얹기.눈찾기(본a[..., :3], 본몸)
    bys, bxs = np.where(본몸)
    기대 = dict(사이비=본눈['사이'] / (bxs.max() - bxs.min() + 1),
               세로비=((본눈['왼'][1] + 본눈['오'][1]) / 2 - bys.min()) / (bys.max() - bys.min() + 1))
    몸0 = (옷a[..., 0] < 240) | (옷a[..., 1] < 240) | (옷a[..., 2] < 240)
    옷눈 = _얹기.눈찾기(옷a, 몸0, 기대=기대)
    몸, 옷화소 = 옷마스크(옷a, 옷눈['상자'] if 옷눈 else None)
    옷수 = int(옷화소.sum())

    앞 = f'{누구}_{옷이름}_'
    컷들 = sorted(f for f in os.listdir(결과방) if f.startswith(앞) and f.endswith('.png'))
    if not 컷들:
        return None

    보고 = dict(누구=누구, 옷=옷이름, 옷화소=옷수, 컷=[])
    지문들 = {}
    for f in 컷들:
        r = 읽기(os.path.join(결과방, f))
        # 🔴 문턱 12 는 «흐린 경계에서 색이 살짝 섞인 것»까지 세어, 멀쩡한 안경을 20% 로 찍었다
        #    (09-08 · 그림으로 보니 테는 온전하고 조금 옅어졌을 뿐이었다). 45 는 «사라졌다」만 잡는다.
        바뀜 = (np.abs(r - 옷a).max(axis=2) > 45)
        옷지움 = round(100.0 * int((바뀜 & 옷화소).sum()) / max(옷수, 1), 2)
        갈림 = round(100.0 * int(바뀜.sum()) / max(int(몸.sum()), 1), 2)
        컷 = f[len(앞):-4]
        보고['컷'].append(dict(컷=컷, 옷화소_지움=옷지움, 몸에서_갈린비율=갈림))
        # 표정끼리 정말 다른가 — 512 로 줄인 회색 그림의 지문
        g = np.asarray(Image.fromarray(r.astype(np.uint8)).convert('L').resize((64, 64))).astype(int)
        지문들[컷] = g

    이름들 = list(지문들)
    같은짝 = []
    for i in range(len(이름들)):
        for j in range(i + 1, len(이름들)):
            d = float(np.abs(지문들[이름들[i]] - 지문들[이름들[j]]).mean())
            if d < 0.5:
                같은짝.append(f'{이름들[i]}={이름들[j]}')
    보고['서로같은짝'] = 같은짝
    return 보고


if __name__ == '__main__':
    누구 = '까몽'
    if '--누구' in sys.argv:
        누구 = sys.argv[sys.argv.index('--누구') + 1]
    if '--옷' in sys.argv:
        옷들 = [s.strip() for s in sys.argv[sys.argv.index('--옷') + 1].split(',')]
    else:
        옷들 = sorted({f[len(누구) + 1:-4] for f in os.listdir(옷방)
                     if f.startswith(누구 + '_') and f.endswith('.png')})

    전체 = []
    print(f'{"옷":<16} {"옷 지움 최대":>12} {"그 컷":<10} {"몸 갈림 평균":>12}  같은 짝')
    print('─' * 78)
    for o in 옷들:
        b = 한벌(누구, o)
        if b is None:
            continue
        전체.append(b)
        최 = max(b['컷'], key=lambda c: c['옷화소_지움'])
        평 = sum(c['몸에서_갈린비율'] for c in b['컷']) / len(b['컷'])
        표 = '🔴' if 최['옷화소_지움'] > 3.0 else ('🟡' if 최['옷화소_지움'] > 1.0 else '  ')
        print(f'{표}{o:<15} {최["옷화소_지움"]:>11.2f}% {최["컷"]:<10} {평:>11.2f}%  '
              f'{", ".join(b["서로같은짝"]) if b["서로같은짝"] else ""}')
    with open(os.path.join(결과방, '_검사.json'), 'w', encoding='utf-8') as f:
        json.dump(전체, f, ensure_ascii=False, indent=1)
    나쁨 = [b['옷'] for b in 전체 if max(c['옷화소_지움'] for c in b['컷']) > 3.0]
    print()
    print(f'■ {len(전체)}벌 × {len(전체[0]["컷"]) if 전체 else 0}컷 을 쟀다.')
    print(f'   옷이 3% 넘게 지워진 벌: {", ".join(나쁨) if 나쁨 else "없다"}')
