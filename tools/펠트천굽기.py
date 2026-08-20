#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Loom L4 — 펠트 «지면»용 천 굽기 (문서·웹 지면이 입는 타일)

  펠트패치 라이브러리(L2b)의 공용 패치를 지면용으로 줄이고 압축해
  `docs/tools/펠트천.json` 에 data URI 로 굽는다. 소비자 = tools/펠트문서.js.

왜 따로 있나
  L2b 패치는 «원료 해상도»(288²·PNG 150KB)라 문서에 그대로 인라인하면 한 장에 200KB 를 먹는다.
  지면은 결만 읽히면 되므로 줄여도 되는데, **얼마나 줄여도 되는지는 재야 안다** —
  이 도구는 줄인 뒤 결(L*std)을 다시 재서 기준 미달이면 굽기를 거부한다.
  헌법 ①(결은 사진 픽셀에서만)이 압축으로 조용히 무너지는 자리가 정확히 여기다.

안 굽는 것
  · 역할이 「원료」·「정본사진」인 패치 — 산출물 노출 금지(라이브러리.json 실행규칙).
  · 역할이 「마스코트전용」인 패치 — 체리는 UI 가 아니라 마스코트가 데리고 온다(유호 확정 08-13 B안).
  둘 다 이름이 아니라 **장부**로 판정한다(손 목록은 안 잰 것을 조용히 통과시킨다).
"""
import argparse
import base64
import io
import json
import os
import sys

import numpy as np
from PIL import Image

여기 = os.path.dirname(os.path.abspath(__file__))
루트 = os.path.dirname(여기)
패치방 = os.path.join(루트, 'docs', '캐릭터', '펠트패치_0815')
장부길 = os.path.join(패치방, '라이브러리.json')
출력길 = os.path.join(루트, 'docs', 'tools', '펠트천.json')

# 지면 기본값 — 실측으로 고른 값(2026-08-15):
#   288→240 · WebP q80 에서 결 93~99% 유지 · 장당 12~13KB(base64 17KB).
#   q90 은 결을 1~2%p 더 지키지만 용량이 1.6배 — 자립형 1파일 문서에서 그 값은 비싸다.
한변 = 240
품질 = 80
결하한 = 90.0  # % — 원본 패치 대비. 이 밑이면 「펠트를 깔았다」가 거짓이 된다.


def L별(im):
    """CIE L* 배열 — 결(섬유 명암 편차)을 재는 자."""
    a = np.asarray(im.convert('RGB'), dtype=np.float64) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = lin @ [0.2126, 0.7152, 0.0722]
    return np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)


def 대표색(im):
    a = np.asarray(im.convert('RGB'), dtype=np.float64)
    r, g, b = a[..., 0].mean(), a[..., 1].mean(), a[..., 2].mean()
    return '#%02X%02X%02X' % (round(r), round(g), round(b))


def 굽는다(이름, 역할표):
    역할 = 역할표.get(이름, {}).get('역할')
    if 역할 != '공용':
        return None, '역할=%s — 공용만 지면에 나간다' % (역할 or '장부에 없음')
    원본길 = os.path.join(패치방, 이름 + '.png')
    if not os.path.exists(원본길):
        return None, '실물 없음 (%s)' % 원본길
    src = Image.open(원본길).convert('RGB')
    기준결 = L별(src).std()

    # ── 적응형 압축 (2026-08-20) ─────────────────────────────────────────────
    # 🔴 왜: 2027 실을 굽자 **6벌이 통째로 탈락했다**(Lapis 85.2 · LapisDeep 80.3 · Meadow 88.1 ·
    #   MeadowDeep 82.3 · Pop 87.9 · PopDeep 77.2 — 전부 하한 90 미달). 탈락은 조용하다:
    #   지면은 그 천을 «못 입은 채» 멀쩡히 서고, 2027 실의 핵심 색만 빠진다.
    # 🔑 원인은 염색이 아니라 **압축**이다. 진한 색일수록 명도 게인이 결의 절대 진폭을 깎아
    #   놓아서, 같은 q80 이 밝은 천에서는 안 보이고 어두운 천에서만 섬유를 먹는다.
    # ⇒ 한 벌 한 벌에 «필요한 만큼만» 준다. 실측(08-20)이 정한 사다리:
    #      240/q80 → 240/q92 → 288/q92   (마지막 칸에서 6벌 전부 90.7~95.5% 로 통과)
    #   전량을 288/q92 로 올리면 용량이 2배가 된다 — 자립형 1파일 문서에 그대로 실리는 값이라
    #   밝은 천까지 같이 무겁게 만들 이유가 없다. 「명품과 속도를 맞바꾸지 않는다」의 집행은
    #   **품질을 낮추는 것도, 전부 무겁게 하는 것도 아니고, 드는 곳에만 쓰는 것**이다.
    사다리 = [(한변, 품질), (한변, 92), (288, 92)]
    통 = None
    for 변, q in 사다리:
        후보 = io.BytesIO()
        (src if src.size[0] == 변 else src.resize((변, 변), Image.LANCZOS)) \
            .save(후보, 'WEBP', quality=q, method=6)
        후보.seek(0)
        재본결 = 100.0 * L별(Image.open(후보)).std() / 기준결 if 기준결 else 0.0
        통, 쓴변, 쓴품질, 남은결 = 후보, 변, q, 재본결
        if 남은결 >= 결하한:
            break

    if 남은결 < 결하한:
        return None, ('결 %.1f%% < 하한 %.1f%% — 사다리 끝(288/q92)에서도 압축이 섬유를 먹었다'
                      % (남은결, 결하한))
    통.seek(0)
    구운것 = Image.open(통)

    # 대비 계산용 상대휘도 분포 — «평균색»으로 대비를 재면 실물보다 후하게 나온다.
    #   펠트는 면이 아니라 결이라, 같은 천 안에서 밝은 섬유와 그늘진 골이 함께 있다.
    #   그렇다고 «최악의 한 픽셀»로 재면 반대로 너무 가혹하다 — 글자는 점이 아니라 획이라
    #   섬유 하나가 아니라 **획이 덮는 넓이의 평균**이 읽힘을 정한다(실측: 픽셀 자로는
    #   킷이 승인한 Ink-on-Coral 조차 3.15 로 떨어졌다).
    #   그래서 획 크기 창으로 흐린 뒤 분위를 잰다 = 「글자가 앉을 수 있는 가장 불리한 자리」.
    #   창 크기: 지면에서 타일은 240px 를 150px 로 눕혀 깔리고(0.625배) 본문 획은 약 2px 이므로
    #   타일 좌표로 약 3.2px — 홀수로 올려 5px 창을 쓴다. 타일은 이어 붙으니 wrap 으로 감는다.
    a = np.asarray(구운것.convert('RGB'), dtype=np.float64) / 255.0
    lin = np.where(a <= 0.03928, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y2 = lin @ [0.2126, 0.7152, 0.0722]
    창 = 5
    누 = np.pad(Y2, 창 // 2, mode='wrap')
    적 = np.cumsum(np.cumsum(누, axis=0), axis=1)
    적 = np.pad(적, ((1, 0), (1, 0)))
    h, w = Y2.shape
    획 = (적[창:창 + h, 창:창 + w] - 적[0:h, 창:창 + w]
          - 적[창:창 + h, 0:w] + 적[0:h, 0:w]) / (창 * 창)
    Y = 획.ravel()

    바이트 = 통.getbuffer().nbytes
    return {
        '이름': 이름,
        'uri': 'data:image/webp;base64,' + base64.b64encode(통.getvalue()).decode('ascii'),
        '한변': 쓴변,          # 사다리를 올라갔으면 288 이다 — 「어떤 규격으로 구웠나」를 천이 안다
        '품질': 쓴품질,
        '대표색': 대표색(구운것),
        '목표': 역할표.get(이름, {}).get('목표'),
        '결퍼센트': round(남은결, 1),
        '바이트': 바이트,
        '휘도': {
            '_주': '획 %dpx 창으로 흐린 뒤 잰 상대휘도 — 글자가 앉을 수 있는 자리의 분포' % 창,
            '최소': round(float(Y.min()), 5),
            'p1': round(float(np.percentile(Y, 1)), 5),
            '중앙': round(float(np.percentile(Y, 50)), 5),
            'p99': round(float(np.percentile(Y, 99)), 5),
            '최대': round(float(Y.max()), 5),
            '생픽셀최소': round(float(Y2.min()), 5),
            '생픽셀최대': round(float(Y2.max()), 5),
        },
    }, None


def main():
    ap = argparse.ArgumentParser(description='펠트 지면 천 굽기 — 공용 패치 → data URI 타일')
    ap.add_argument('--검사', action='store_true',
                    help='굽지 않고 현재 산출물이 최신인지만 본다(exit 1 = 낡음)')
    a = ap.parse_args()

    장부 = json.load(open(장부길, encoding='utf-8'))['패치']
    이름들 = sorted(n for n, v in 장부.items() if v.get('역할') == '공용')

    천 = {}
    거절 = []
    for n in 이름들:
        결과, 사유 = 굽는다(n, 장부)
        if 결과:
            천[n] = 결과
        else:
            거절.append((n, 사유))

    if not 천:
        print('🔴 구운 천 0장 — 공용 패치가 없거나 전부 거절됐다', file=sys.stderr)
        return 1

    산출 = {
        '_주': '펠트 지면 타일(자동 생성 — 손 편집 금지). 원천=docs/캐릭터/펠트패치_0815 공용 패치 · '
               '통로=tools/펠트천굽기.py · 소비자=tools/펠트문서.js. 값이 바뀌면 이 도구를 다시 돌린다.',
        # 규격은 «천마다» 다를 수 있다(적응형 사다리) — 여기 적는 것은 출발 칸이고,
        # 실제로 쓴 값은 각 천의 `한변`·`품질` 이 안다. 하나로 뭉치면 거짓이 된다.
        '_규격': {'출발': {'한변': 한변, '형식': 'WEBP q%d' % 품질},
                '사다리': ['%d/q%d' % (한변, 품질), '%d/q92' % 한변, '288/q92'],
                '결하한': 결하한},
        '천': 천,
    }
    새것 = json.dumps(산출, ensure_ascii=False, indent=1)

    if a.검사:
        옛것 = open(출력길, encoding='utf-8').read() if os.path.exists(출력길) else ''
        if 옛것 == 새것:
            print('✅ 펠트천.json 최신 — %d장' % len(천))
            return 0
        print('🔴 펠트천.json 이 낡았다 — `python tools/펠트천굽기.py` 를 다시 돌린다', file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(출력길), exist_ok=True)
    with open(출력길, 'w', encoding='utf-8') as f:
        f.write(새것)

    합 = sum(v['바이트'] for v in 천.values())
    print('■ 펠트 지면 천  %d장  → %s' % (len(천), os.path.relpath(출력길, 루트)))
    for n in 이름들:
        if n in 천:
            v = 천[n]
            print('   %-11s %-8s 결 %5.1f%%  %5.1fKB  (목표 %s)'
                  % (n, v['대표색'], v['결퍼센트'], v['바이트'] / 1024, v['목표'] or '—'))
    print('   합계 %.1fKB (base64 약 %.1fKB) · 한변 %dpx · WebP q%d · 결 하한 %.0f%%'
          % (합 / 1024, 합 * 4 / 3 / 1024, 한변, 품질, 결하한))
    if 거절:
        print('   ▫ 안 구운 것 %d장 — 지면에 나갈 자격이 없다:' % len(거절))
        for n, 사유 in 거절:
            print('      %-11s %s' % (n, 사유))
    return 0


if __name__ == '__main__':
    sys.exit(main())
