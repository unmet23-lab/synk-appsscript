# -*- coding: utf-8 -*-
"""옷 입은 그림에 표정을 얹는다 — 옷은 그대로 두고 «눈 창»만 정본 표정 컷에서 가져온다.

  왜 있나 (유호 지시 2026-09-08)
    「눈 높이 맞추는 거 해결한 것 같거든? 이거 기반으로 적용해서 진행해줘」
    ⇒ 마스코트의상통일.py(세션 「VR 시대 대비 제품 전략」)가 세운 원리를 옷 쪽으로 돌린다.

  🔴 왜 이게 값을 바꾸나
    옷 조합마다 표정을 곱하면 그림이 터진다(까몽 129조합 × 표정 14 = 1,806장 · 11만원).
    표정을 «굽지 말고 얹으면» 129장으로 끝난다(8,097원). 열세 배 차이다.

  어떻게 (의상통일과 같은 뼈대 · 닻만 다르다)
    ① 닻을 «두 눈»으로 잡는다. 옷을 입으면 실루엣이 커져서 몸 상자를 닻으로 못 쓴다.
       두 눈의 중심과 사이 거리로 크기맞춤 k 와 옮김 (dx,dy) 를 낸다.
    ② 그 한 벌의 맞춤을 표정 «전부»에 똑같이 쓴다. 정본 표정 컷끼리는 몸이 정렬돼 있다
       (같은 세션에서 흔들림 0.0% 로 맞춰 놨다). 그래서 컷마다 다시 재면 오히려 흔들린다.
    ③ 🔴 창은 «표정 열넷의 눈을 전부» 덮는다. 한 표정만 보고 잡으면 안 된다 —
       09-08 첫 판이 본체 하나로 창을 잡아 응원·뾰로통의 눈이 창 밖에 남았다(눈 반쪽이 잘렸다).
       표정이 다르면 눈이 아래로 내려가고 옆으로 벌어진다. 그게 표정이니 당연한 것이었다.
    ④ 🔴 창을 그만큼 키우면 목도리·후드까지 덮어 옷이 정본 것으로 바뀐다. 그래서 창 «안»에서
       한 겹을 더 가른다 — «털이거나 눈»인 자리만 표정에서, «옷»인 자리는 옷 그림을 남긴다.
       가르는 자 = 까몽 털은 어둡고(밝기<150) 붉은 쪽이다(r>=b). 옷은 밝거나 파랑 쪽이다.
    ⑤ 창 밖이 옷 그림과 «화소 단위로 같은지» 세서 100% 가 아니면 그 컷을 떨군다.

  쓰는 법
    python tools/옷표정얹기.py --옷 목도리                    # 그 옷에 표정 전부
    python tools/옷표정얹기.py --옷 목도리 --표정 윙크,졸림
    python tools/옷표정얹기.py --전부                          # 옷 21벌 x 표정 전부
    python tools/옷표정얹기.py --옷 목도리 --검사만            # 내지 않고 숫자만
    python tools/옷표정얹기.py --옷 목도리 --보고 <파일.json>  # 병렬 작업은 보고서를 갈라 쓴다
    python tools/옷표정얹기.py --옷 목도리 --출력 <검수폴더> # 기존 승인 표정을 덮지 않는 후보
"""
import importlib.util
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

저장소 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 🔴 옷 그림이 나는 방이 «둘»이다 (09-08) — 열쇠(종량제)로 구운 것과 정액제 ChatGPT 창으로 구운 것.
#    한 방만 보면 정액제로 구운 조합에 표정이 안 얹힌다. 앞의 방부터 찾고, 없으면 다음 방을 본다.
옷방들 = [os.path.join(저장소, 'docs', 'Loom_자산', '옷', 방)
        for 방 in ('GPT', 'GPT정액시험')]
옷방 = 옷방들[0]                                   # 목록을 낼 때 쓰는 기본 방
정본방 = os.path.join(저장소, 'docs', '캐릭터', '정본_4K')
낼방 = os.path.join(저장소, 'docs', 'Loom_자산', '옷', 'GPT_표정')


def 옷그림찾기(누구, 옷이름):
    """두 방을 앞에서부터 뒤져 그 옷 그림의 경로를 낸다. 없으면 None."""
    for 방 in 옷방들:
        p = os.path.join(방, f'{누구}_{옷이름}.png')
        if os.path.exists(p):
            return p
    return None

_spec = importlib.util.spec_from_file_location(
    '치수재기', os.path.join(저장소, 'tools', '마스코트치수재기.py'))
_치수재기 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_치수재기)
_blobs = _치수재기._blobs

# 옆으로 돈 컷은 포갤 수 없다 — 정면 옷 그림에 옆얼굴을 얹으면 어긋난다
못포갬 = {'좌34', '우34', '인사'}

# 🔴 «눈을 덮는» 악세 — 이것을 입은 컷에서만 눈 창을 색으로 좁힌다.
#    안 좁히면 그 옷이 눈과 함께 지워지고, 좁히면 원래 눈이 덜 지워져 얼룩이 남는다.
#    이름 조각으로 본다(겹쳐 입으면 파일 이름이 「목도리+안경」처럼 이어지기 때문).
눈덮는옷 = ('안경',)


def 눈찾기(a, 몸, 위쪽=0.55, 기대=None):
    """초록 홍채 둘. 🔴 상자만 쓰면 초록 도는 옷을 눈으로 문다(09-08 실측 · 세 번 밟았다).
       ⓐ 위쪽 55% 안 ⓑ 두 덩어리 크기가 2.2배 안 ⓒ 가로로 나란함 — 셋을 다 만족하는 짝만 후보다.
       그중 고르는 자로 «크기»를 쓰면 잎망토(눈보다 큰 초록)가 뽑히고, «위쪽»을 쓰면
       화관(눈보다 위인 초록 잎)이 뽑힌다. 그래서 «정본의 눈 비율»을 기준으로 고른다.
       기대 = dict(사이비=두 눈 사이/몸 폭, 세로비=눈 세로 자리/몸 높이) — 정본에서 잰 값."""
    H, W = 몸.shape
    r, g, b = (a[..., i].astype(int) for i in range(3))
    l = a[..., :3].mean(axis=2)
    눈 = 몸 & (g > r) & (g > b) & (l > 30)
    눈[int(H * 위쪽):] = False
    덩 = _blobs(눈[::4, ::4], 6)
    for d in 덩:
        for q in ('x0', 'x1', 'y0', 'y1', 'cx', 'cy'):
            d[q] *= 4
    ys0, xs0 = np.where(몸)
    몸폭 = float(xs0.max() - xs0.min() + 1)
    몸위, 몸높 = float(ys0.min()), float(ys0.max() - ys0.min() + 1)
    최고 = None
    for i in range(len(덩)):
        for j in range(i + 1, len(덩)):
            A, B = 덩[i], 덩[j]
            if max(A['n'], B['n']) > 2.2 * min(A['n'], B['n']):
                continue
            dx, dy = abs(A['cx'] - B['cx']), abs(A['cy'] - B['cy'])
            if dx < W * 0.05 or dy > dx * 0.45:
                continue
            if 기대 is None:
                점 = A['n'] + B['n']                       # 정본을 잴 때는 큰 짝이 곧 눈이다
            else:
                사이비 = float(np.hypot(A['cx'] - B['cx'], A['cy'] - B['cy'])) / 몸폭
                세로비 = ((A['cy'] + B['cy']) / 2 - 몸위) / 몸높
                점 = -(abs(사이비 - 기대['사이비']) / max(기대['사이비'], 1e-6)
                       + abs(세로비 - 기대['세로비']) / max(기대['세로비'], 1e-6))
            if 최고 is None or 점 > 최고[0]:
                왼, 오 = sorted([A, B], key=lambda d: d['cx'])
                최고 = (점, (왼, 오))
    if 최고 is None:
        return None
    왼, 오 = 최고[1]
    return dict(
        왼=(왼['cx'], 왼['cy']), 오=(오['cx'], 오['cy']),
        사이=float(np.hypot(오['cx'] - 왼['cx'], 오['cy'] - 왼['cy'])),
        높이=float(max(왼['y1'] - 왼['y0'], 오['y1'] - 오['y0']) + 1),
        상자=(min(왼['x0'], 오['x0']), min(왼['y0'], 오['y0']),
             max(왼['x1'], 오['x1']), max(왼['y1'], 오['y1'])))


def 옷읽기(경로):
    im = Image.open(경로).convert('RGB')
    a = np.asarray(im).astype(int)
    몸 = (a[..., 0] < 240) | (a[..., 1] < 240) | (a[..., 2] < 240)
    return np.asarray(im), 몸


def 정본읽기(경로):
    a = np.asarray(Image.open(경로).convert('RGBA'))
    return a, a[..., 3] > 128


def 표정목록(누구):
    앞 = 누구 + '_'
    out = []
    for f in sorted(os.listdir(정본방)):
        if not (f.startswith(앞) and f.endswith('.png')):
            continue
        컷 = f[len(앞):-4]
        if 컷 in 못포갬:
            continue
        out.append(컷)
    return out


def 색옷씨앗(옷a, 옷몸, 눈상자):
    """초록은 실제 눈 주변에서만 홍채다. 아래의 새싹까지 눈으로 열지 않는다."""
    rgb = 옷a[..., :3].astype(int)
    쨍 = rgb.max(axis=2) - rgb.min(axis=2)
    초록 = (rgb[..., 1] > rgb[..., 0]) & (rgb[..., 1] > rgb[..., 2])
    눈근처 = np.zeros_like(옷몸)
    x0, y0, x1, y1 = 눈상자
    # 눈찾기는 4칸 간격으로 잰다. 그 표본 오차만 여유로 두며 눈높이만큼 넓히지 않는다.
    여 = 4
    눈근처[max(0, int(y0)-여):min(옷몸.shape[0], int(y1)+여+1),
             max(0, int(x0)-여):min(옷몸.shape[1], int(x1)+여+1)] = True
    초록눈 = 초록 & 눈근처
    # 기존의 채도 기준은 유지한다. 낮은 채도의 털 그림자까지 옷으로 잠그지 않는다.
    return 옷몸 & (쨍 >= 52) & ~초록눈


def 출력방(지정=None):
    낼곳 = os.path.abspath(지정 or 낼방)
    for 보호방 in [정본방, *옷방들]:
        보호방 = os.path.abspath(보호방)
        try:
            안 = os.path.normcase(os.path.commonpath([낼곳, 보호방])) == os.path.normcase(보호방)
        except ValueError:
            안 = False
        if 안:
            raise ValueError('표정 출력은 정본·원본 폴더 밖이어야 한다')
    return 낼곳


def 한벌(옷이름, 표정들=None, 검사만=False, 누구='까몽', 출력=None):
    낼곳 = 출력방(출력)
    옷경로 = 옷그림찾기(누구, 옷이름)
    if 옷경로 is None:
        raise SystemExit(f'옷 그림이 없다 — {누구}_{옷이름}.png 를 두 방에서 못 찾았다\n'
                         + '\n'.join(f'   {방}' for 방 in 옷방들))
    # 🔴 정본을 «먼저» 재서 눈 비율을 얻고, 그 비율로 옷 그림의 눈 짝을 고른다.
    본a, 본몸 = 정본읽기(os.path.join(정본방, f'{누구}_본체.png'))
    본눈 = 눈찾기(본a[..., :3], 본몸)
    if 본눈 is None:
        raise SystemExit('정본 본체에서 눈을 못 찾았다 — 자를 고쳐야 한다')
    bys, bxs = np.where(본몸)
    기대 = dict(사이비=본눈['사이'] / (bxs.max() - bxs.min() + 1),
               세로비=((본눈['왼'][1] + 본눈['오'][1]) / 2 - bys.min()) / (bys.max() - bys.min() + 1))

    옷a, 옷몸 = 옷읽기(옷경로)
    옷눈 = 눈찾기(옷a, 옷몸, 기대=기대)
    if 옷눈 is None:
        return dict(옷=옷이름, 결과='🔴 옷 그림에서 눈을 못 찾았다')

    # ① 두 눈으로 크기맞춤 · 옮김. 표정 컷 전부에 같은 값을 쓴다.
    k = 옷눈['사이'] / 본눈['사이']
    dx = (옷눈['왼'][0] + 옷눈['오'][0]) / 2 - ((본눈['왼'][0] + 본눈['오'][0]) / 2) * k
    dy = (옷눈['왼'][1] + 옷눈['오'][1]) / 2 - ((본눈['왼'][1] + 본눈['오'][1]) / 2) * k

    # ② 눈 창 — 🔴 표정 «전부»의 눈을 옷 좌표계로 옮겨 합집합을 잡는다.
    컷들 = 표정들 or 표정목록(누구)
    눈높 = 옷눈['높이']
    합 = list(옷눈['상자'])
    튄컷 = []
    for c in 컷들:
        p = os.path.join(정본방, f'{누구}_{c}.png')
        if not os.path.exists(p):
            continue
        ca, cm = 정본읽기(p)
        ce = 눈찾기(ca[..., :3], cm)
        if ce is None:                       # 눈을 못 찾은 컷은 공통 창으로 얹는다
            continue
        상 = [ce['상자'][0] * k + dx, ce['상자'][1] * k + dy,
              ce['상자'][2] * k + dx, ce['상자'][3] * k + dy]
        # 🔴 한 컷에서 자가 엉뚱한 것을 물면 창이 몸 전체로 벌어진다. 옷 눈 상자의 두 배가 넘으면 뺀다.
        if (상[2] - 상[0]) > (옷눈['상자'][2] - 옷눈['상자'][0] + 1) * 2:
            튄컷.append(c)
            continue
        합 = [min(합[0], 상[0]), min(합[1], 상[1]), max(합[2], 상[2]), max(합[3], 상[3])]
    창 = [int(합[0] - 눈높 * .35), int(합[1] - 눈높 * .45),
          int(합[2] + 눈높 * .35), int(합[3] + 눈높 * .45)]
    # 창을 몸 «안»으로 눌러 실루엣이 옷 그림 것으로 남게 한다(옷 침범은 아래 ④가 막는다).
    ys, xs = np.where(옷몸)
    몸상 = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    W몸, H몸 = 몸상[2] - 몸상[0] + 1, 몸상[3] - 몸상[1] + 1
    창[0] = max(창[0], 몸상[0] + int(W몸 * .05))
    창[1] = max(창[1], 몸상[1] + int(H몸 * .04))
    창[2] = min(창[2], 몸상[2] - int(W몸 * .05))
    창[3] = min(창[3], 몸상[3] - int(H몸 * .05))

    H, W = 옷몸.shape
    네모 = Image.new('L', (W, H), 0)
    ImageDraw.Draw(네모).rounded_rectangle(tuple(창), radius=int(눈높 * .5), fill=255)
    네모 = 네모.filter(ImageFilter.GaussianBlur(max(4, int(눈높 * .14))))

    # ④ 창 «안»에서 옷을 지킨다 — 털이거나 눈인 자리만 표정에서 가져온다.
    r0, g0, b0 = (옷a[..., i].astype(int) for i in range(3))
    밝 = (r0 + g0 + b0) / 3
    쨍 = np.maximum(np.maximum(r0, g0), b0) - np.minimum(np.minimum(r0, g0), b0)
    # 까몽 털 = 어둡고(밝기<150) 붉은 쪽이며 «색이 안 쨍하다»(쨍<52).
    # 🔴 쨍 조건이 없으면 목도리의 «그늘진 산호색»이 털로 잡혀 얼굴 털이 목도리 위를 덮는다(09-08 실측).
    털 = 옷몸 & (밝 < 150) & (r0 >= b0) & (쨍 < 52)
    # 🔴 눈 자리를 «네모»로 열면 그 네모 안에 있는 옷까지 열려 지워진다 — 안경 테는 통째로,
    #    3급 왕관은 머리에 닿는 띠가 사라졌다(09-08 실측 21.4% · 12.0%). 네모 «안»에서도
    #    실제 눈 색(초록 홍채 · 흰 점)만 연다. 안경 테(빨강)·왕관 띠(노랑)는 그래서 남는다.
    눈네모 = np.zeros_like(옷몸)          # 🔴 이름을 «네모»로 지으면 위의 창 그림을 덮는다
    e = 옷눈['상자']
    여 = int(눈높 * .6)
    눈네모[max(0, int(e[1] - 여)):int(e[3] + 여), max(0, int(e[0] - 여)):int(e[2] + 여)] = True
    # 🔴 눈 네모 «안»을 어디까지 여느냐 (09-08 · 두 번 밟았다)
    #   ⓐ 다 열면 안경 테·왕관 띠가 지워진다 → 눈 색만 열도록 좁혔다.
    #   ⓑ 그랬더니 원래 눈이 «깨끗이» 안 지워져, 표정이 바뀌며 눈이 옮겨간 자리에
    #      옛 눈의 초록 테가 남아 각진 얼룩이 됐다(정액제 판 윙크에서 드러났다).
    #   ⇒ 기본은 «다 연다»(원래 눈이 통째로 지워진다). 눈을 «덮는» 악세를 입은 컷만 좁힌다.
    눈덮음 = any(k in 옷이름 for k in 눈덮는옷)
    if 눈덮음:
        눈색 = ((옷a[..., 1].astype(int) > 옷a[..., 0]) & (옷a[..., 1].astype(int) > 옷a[..., 2])) | (밝 > 200)
        눈자리 = 눈네모 & 눈색
    else:
        눈자리 = 눈네모
    # 🔴 옷 «윗선» 아래는 털로 안 친다. 크림색 목도리의 그늘이 위 조건을 통과해 목도리 위에
    #    네모 자국을 남겼다(09-08 실측). 창 안에서 옷 화소가 그 행의 40% 를 넘는 첫 행이 윗선이다.
    # 🔴 윗선은 «눈 아래»에서만 찾는다. 안경·왕관처럼 눈 높이나 그 위에 앉는 옷에서
    #    눈 위부터 훑으면 옷 자체가 윗선이 되어 얼굴이 통째로 닫힌다 — 09-08 에 그렇게 되어
    #    안경·왕관 열네 컷이 서로 똑같아졌다(표정이 아예 안 얹혔다).
    눈아래 = int(min(H - 1, e[3] + 눈높 * .8))
    창세로 = slice(max(0, 눈아래), min(H, 창[3] + 1))
    창가로 = slice(max(0, 창[0]), min(W, 창[2] + 1))
    행몸 = 옷몸[창세로, 창가로].sum(axis=1)
    행옷 = (옷몸 & ~털)[창세로, 창가로].sum(axis=1)
    비 = np.divide(행옷, np.maximum(행몸, 1))
    아래 = np.where(비 > 0.40)[0]
    윗선 = int(창세로.start + 아래[0]) if len(아래) else H
    털 = 털.copy()
    털[윗선:] = False
    갈수있는곳 = 털 | 눈자리                          # 나머지(=옷)는 옷 그림을 남긴다
    마스크 = Image.fromarray((np.asarray(네모) * 갈수있는곳).astype(np.uint8))
    마스크 = 마스크.filter(ImageFilter.GaussianBlur(max(2, int(눈높 * .06))))
    # 🔴 흐린 마스크의 가장자리가 빨강 안경 테·노랑 왕관 띠 안으로 번지면, 형태는 남아도
    #    옷 화소가 표정 털과 섞인다. 실제 눈 상자의 초록만 열어 두고 옷감 씨앗을 조금 넓혀
    #    그 자리를 원본으로 다시 잠근다. 그래서 눈동자는 바뀌고 옷 경계는 화소 그대로 남는다.
    색옷씨 = 색옷씨앗(옷a, 옷몸, e)
    보호폭 = max(3, int(눈높 * .12))
    if 보호폭 % 2 == 0:
        보호폭 += 1
    색옷보호 = np.asarray(Image.fromarray((색옷씨 * 255).astype(np.uint8))
                     .filter(ImageFilter.MaxFilter(보호폭))) > 0
    마스크a = np.asarray(마스크).copy()
    마스크a[색옷보호] = 0
    마스크 = Image.fromarray(마스크a)

    밖 = np.asarray(마스크) == 0
    전 = int(밖.sum())
    창덮음 = round(100.0 * int(((np.asarray(마스크) >= 128) & 옷몸).sum()) / int(옷몸.sum()), 1)

    바탕 = Image.fromarray(옷a)
    보고 = dict(옷=옷이름, 크기맞춤=round(k, 4), 옮김=[int(round(dx)), int(round(dy))],
               창=창, 창이덮는몸=f'{창덮음}%', 자가튄컷=튄컷, 컷=[])
    if not 검사만:
        os.makedirs(낼곳, exist_ok=True)
    for c in 컷들:
        p = os.path.join(정본방, f'{누구}_{c}.png')
        if not os.path.exists(p):
            보고['컷'].append(dict(컷=c, 결과='정본 컷이 없다'))
            continue
        a = np.asarray(Image.open(p).convert('RGBA'))
        im = Image.fromarray(a).resize((max(1, int(a.shape[1] * k)), max(1, int(a.shape[0] * k))), Image.LANCZOS)
        캔 = Image.new('RGBA', (W, H), (255, 255, 255, 0))
        캔.paste(im, (int(round(dx)), int(round(dy))))
        # 표정 컷은 투명 바탕이라 흰 종이에 먼저 앉힌다(창 안이 비면 구멍이 난다)
        흰 = Image.new('RGB', (W, H), (255, 255, 255))
        흰.paste(캔, (0, 0), 캔)
        합 = Image.composite(흰, 바탕, 마스크)
        arr = np.asarray(합)
        같 = int(((arr == 옷a).all(axis=2) & 밖).sum())
        비율 = 100.0 * 같 / 전
        r = dict(컷=c, 창밖_같음=round(비율, 4))
        if 비율 < 99.999:
            r['결과'] = '🔴 창 밖이 안 같다'
        else:
            r['결과'] = '✅ 옷 같음'
            if not 검사만:
                합.save(os.path.join(낼곳, f'{누구}_{옷이름}_{c}.png'))
        보고['컷'].append(r)
    return 보고


if __name__ == '__main__':
    검사만 = '--검사만' in sys.argv
    출력 = None
    if '--출력' in sys.argv:
        i = sys.argv.index('--출력') + 1
        if i >= len(sys.argv) or sys.argv[i].startswith('--'):
            raise SystemExit('--출력 뒤에 별도 폴더가 있어야 한다')
        출력 = 출력방(sys.argv[i])
    보고경로 = os.path.join(출력방(출력), '_보고.json')
    if '--보고' in sys.argv:
        보고경로 = os.path.abspath(sys.argv[sys.argv.index('--보고') + 1])
    누구 = '까몽'
    if '--누구' in sys.argv:
        누구 = sys.argv[sys.argv.index('--누구') + 1]
    표정들 = None
    if '--표정' in sys.argv:
        표정들 = [s.strip() for s in sys.argv[sys.argv.index('--표정') + 1].split(',') if s.strip()]

    if '--전부' in sys.argv:
        # 두 방을 다 훑는다. 같은 옷이 양쪽에 있으면 한 번만 센다.
        옷들 = sorted({f[len(누구) + 1:-4]
                     for 방 in 옷방들 if os.path.isdir(방)
                     for f in os.listdir(방)
                     if f.startswith(누구 + '_') and f.endswith('.png')})
    elif '--옷' in sys.argv:
        옷들 = [s.strip() for s in sys.argv[sys.argv.index('--옷') + 1].split(',') if s.strip()]
    else:
        raise SystemExit('--옷 "이름" 또는 --전부 가 있어야 한다.')

    전체 = []
    for o in 옷들:
        b = 한벌(o, 표정들, 검사만, 누구, 출력=출력)
        전체.append(b)
        성 = sum(1 for c in b.get('컷', []) if c.get('결과', '').startswith('✅'))
        print(f"■ {o} · 크기맞춤 {b.get('크기맞춤')} · 창이 덮는 몸 {b.get('창이덮는몸')} · "
              f"{성}/{len(b.get('컷', []))}컷 성공")
        for c in b.get('컷', []):
            if not c.get('결과', '').startswith('✅'):
                print(f"    {c.get('컷')}: {c.get('결과')} ({c.get('창밖_같음')}%)")
    os.makedirs(os.path.dirname(보고경로), exist_ok=True)
    with open(보고경로, 'w', encoding='utf-8') as f:
        json.dump(전체, f, ensure_ascii=False, indent=1)
    print(f'\n낸 곳: {출력방(출력)}')
    print(f'보고서: {보고경로}')
