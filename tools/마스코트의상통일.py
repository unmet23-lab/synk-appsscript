# -*- coding: utf-8 -*-
"""마스코트 의상 통일 — 몸·의상·투구는 «본체 한 벌»을 그대로 쓰고 «눈 자리»만 갈아 끼운다.

  왜 있나 (유호 지시 2026-09-08):
    「의상 말한 거야. 꽃이랑 투구도 그렇고. 전부 다 똑같도록. 어느 표정을 하든 마찬가지로.」
    실측으로 확인된 것 — 표정 컷마다 **꽃 자리·꽃 크기·가방끈 방향·주머니가 다르다.**

  🔴 왜 «다시 굽기»로는 못 푸나
    표정 컷은 한 장씩 따로 굽고, 그때마다 모델이 캐릭터를 처음부터 다시 그린다.
    지시문에 수치를 적어도 모델이 안 듣는다(기억 felt-parts-bake-as-one-sheet · 09-07 에
    돈 두 번 태우고 나온 원리). 그래서 몇 번을 구워도 꽃과 끈은 매번 조금씩 달라진다.
    **같게 만드는 유일한 길은 «다시 그리지 않고 같은 화소를 쓰는 것»이다.**

  어떻게
    ① 본체를 «옷 한 벌»로 삼는다.
    ② 표정 컷을 투구 크기·자리에 맞춰 포갠다(크기 맞춤 + 옮김).
    ③ 눈 창 «안»만 표정 컷에서, 나머지는 전부 본체에서 가져온다(가장자리는 부드럽게).
    ④ 눈 창 밖이 본체와 «화소 단위로 같은지» 세서 100%가 아니면 그 컷을 떨군다.

  쓰는 법
    python tools/마스코트의상통일.py --누구 마린            → 후보 폴더에 낸다
    python tools/마스코트의상통일.py --누구 마린 --검사만    → 굽지 않고 숫자만
    python tools/마스코트의상통일.py                        → 셋 다

  🔴 낸 곳은 `docs/캐릭터/정본_4K_후보/의상통일/` 이다. 정본 교체는 유호님이 보시고 «뒤에» 한다.
"""
import importlib.util, io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# 🔴 눈은 «가장 큰 덩어리 둘»로 잡는다. 상자만 쓰면 초록 도는 털·그늘이 통째로 눈이 된다
#    (09-08 에 치수재기·컷대조·여기까지 세 곳에서 같은 함정을 밟았다). 자는 한 곳에서만 빌린다.
_spec = importlib.util.spec_from_file_location(
    '치수재기', os.path.join(os.path.dirname(os.path.abspath(__file__)), '마스코트치수재기.py'))
_치수재기 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_치수재기)
_blobs = _치수재기._blobs

SRC = os.path.join('docs', '캐릭터', '정본_4K')
OUT = os.path.join('docs', '캐릭터', '정본_4K_후보', '의상통일')
비스듬 = {'좌34', '우34'}          # 옆으로 돈 컷은 포갤 수 없다 — 따로 둔다

# 캐릭터마다 «머리(닻)»와 «눈(창)»을 찾는 자가 다르다
자 = {
    '마린': dict(
        닻=lambda m, r, g, b, l: m & (b - r > 25) & (b > 45) & (b < 190),      # 남색 투구
        눈=lambda m, r, g, b, l: m & (r > 150) & (g > 120) & ((r - b) > 70)),  # 노란 렌즈
    '몽글': dict(
        닻=lambda m, r, g, b, l: m,                                            # 몸 전체가 머리다
        눈=lambda m, r, g, b, l: m & (l < 70) & ((r - g) < 40)),               # 검은 구슬
    '까몽': dict(
        닻=lambda m, r, g, b, l: m,
        눈=lambda m, r, g, b, l: m & (g > r) & (g > b) & (l > 30)),            # 초록 홍채
}


def 읽기(name, cut):
    a = np.asarray(Image.open(os.path.join(SRC, f'{name}_{cut}.png')).convert('RGBA'))
    m = a[..., 3] > 128
    r, g, b = (a[..., i].astype(int) for i in range(3))
    l = .2126 * r + .7152 * g + .0722 * b
    z = 자[name]
    닻, 눈 = z['닻'](m, r, g, b, l), z['눈'](m, r, g, b, l)
    눈[np.where(m)[0].min() + int((np.where(m)[0].max() - np.where(m)[0].min()) * .7):] = False
    def 상자(k):
        ys, xs = np.where(k)
        if len(xs) == 0:
            return None
        return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))

    def 눈상자(k):
        cs = _blobs(k[::8, ::8], 30)[:2]
        if len(cs) < 2:
            return None
        for c in cs:
            for q in ('x0', 'x1', 'y0', 'y1'):
                c[q] *= 8
        return (min(c['x0'] for c in cs), min(c['y0'] for c in cs),
                max(c['x1'] for c in cs), max(c['y1'] for c in cs))
    return a, 상자(닻), 눈상자(눈)


def 컷목록(name):
    cs = [f[:-4].split('_', 1)[1] for f in sorted(os.listdir(SRC)) if f.startswith(name + '_')]
    return [c for c in cs if c not in 비스듬]


def 통일(name, 검사만=False):
    cuts = 컷목록(name)
    a본, 닻본, 눈본 = 읽기(name, '본체')
    W본 = 닻본[2] - 닻본[0] + 1
    H본 = 닻본[3] - 닻본[1] + 1

    # 눈 창 = 모든 컷의 눈을 덮되, 머리 «안»에 머문다
    lo = [10 ** 9, 10 ** 9, -1, -1]
    눈폭들 = []
    튄컷 = []
    맞춤 = {}
    for c in cuts:
        a, 닻, 눈 = 읽기(name, c)
        if 닻 is None:
            맞춤[c] = None
            continue
        k = W본 / (닻[2] - 닻[0] + 1)
        dx, dy = 닻본[0] - 닻[0] * k, 닻본[1] - 닻[1] * k
        맞춤[c] = (a, k, dx, dy)
        if 눈 is None:                      # 눈을 못 찾은 컷도 «공통 창»으로 얹는다(별눈 같은 것)
            continue
        box = (눈[0] * k + dx, 눈[1] * k + dy, 눈[2] * k + dx, 눈[3] * k + dy)
        # 🔴 한 컷에서 자가 엉뚱한 것을 물면(초록 도는 털 · 별빛) 그 한 벌이 창을 몸 전체로 벌린다.
        #    본체 눈 상자보다 «두 배 넘게» 큰 상자는 잘못 문 것으로 보고 합집합에서 뺀다(09-08).
        if (box[2] - box[0]) > (눈본[2] - 눈본[0] + 1) * 2 or            (box[3] - box[1]) > (눈본[3] - 눈본[1] + 1) * 2:
            튄컷.append(c)
            continue
        눈폭들.append(box[2] - box[0])
        lo = [min(lo[0], box[0]), min(lo[1], box[1]), max(lo[2], box[2]), max(lo[3], box[3])]
    # 창 = 성한 컷들의 눈을 다 덮는 상자 + 눈 높이만큼의 여백
    눈높 = 눈본[3] - 눈본[1] + 1
    창 = [int(lo[0] - 눈높 * .30), int(lo[1] - 눈높 * .45),
         int(lo[2] + 눈높 * .30), int(lo[3] + 눈높 * .45)]
    눈폭 = max(1.0, (lo[2] - lo[0]))
    # 창을 머리 «안»으로 눌러 테두리·몸·의상이 본체 것으로 남게 한다
    창[3] = min(창[3], 닻본[3] - int(H본 * .06))
    창[1] = max(창[1], 닻본[1] + int(H본 * .04))

    마스크 = Image.new('L', (a본.shape[1], a본.shape[0]), 0)
    ImageDraw.Draw(마스크).rounded_rectangle(tuple(창), radius=int(눈폭 * .45), fill=255)
    마스크 = 마스크.filter(ImageFilter.GaussianBlur(max(6, int(눈높 * .12))))
    밖 = np.asarray(마스크) == 0          # 🔴 «0» 이라야 본체 화소가 그대로 남는다(1~7 도 섞인다)
    전 = int(밖.sum())
    몸본 = a본[..., 3] > 128
    # 🔴 «창이 덮는 몸»은 흐린 가장자리가 아니라 «절반 넘게 표정 컷에서 온 자리»로 센다.
    #    가장자리 값 1 만 있어도 «덮었다»로 세면 흐림 반경이 그대로 수치가 된다(09-08).
    창덮음 = round(100.0 * int(((np.asarray(마스크) >= 128) & 몸본).sum()) / int(몸본.sum()), 1)
    기준 = a본

    os.makedirs(OUT, exist_ok=True)
    보고 = dict(누구=name, 창=창, 창이덮는몸=f'{창덮음}%', 자가튄컷=튄컷, 컷=[])
    for c in cuts:
        v = 맞춤[c]
        if v is None:
            보고['컷'].append(dict(컷=c, 결과='눈이나 머리를 못 찾았다'))
            continue
        a, k, dx, dy = v
        im = Image.fromarray(a).resize((int(a.shape[1] * k), int(a.shape[0] * k)), Image.LANCZOS)
        캔 = Image.new('RGBA', (a본.shape[1], a본.shape[0]), (0, 0, 0, 0))
        캔.paste(im, (int(round(dx)), int(round(dy))))
        합 = Image.composite(캔, Image.fromarray(기준), 마스크)
        arr = np.asarray(합)
        같 = int(((arr == 기준).all(axis=2) & 밖).sum())
        비율 = 100.0 * 같 / 전
        r = dict(컷=c, 창밖_같음=round(비율, 4), 크기맞춤=round(k, 4),
                 옮김=[int(round(dx)), int(round(dy))])
        if 비율 < 99.999:
            r['결과'] = '🔴 창 밖이 안 같다'
        else:
            r['결과'] = '✅ 의상 같음'
            if not 검사만:
                합.save(os.path.join(OUT, f'{name}_{c}.png'))
        보고['컷'].append(r)
    return 보고


if __name__ == '__main__':
    검사만 = '--검사만' in sys.argv
    누구 = None
    if '--누구' in sys.argv:
        누구 = sys.argv[sys.argv.index('--누구') + 1]
    분 = [누구] if 누구 else ['마린', '몽글', '까몽']
    전체 = []
    for n in 분:
        b = 통일(n, 검사만)
        전체.append(b)
        ok = sum(1 for x in b['컷'] if x.get('결과', '').startswith('✅'))
        print(f"\n■ {n} — 컷 {len(b['컷'])}벌 · 의상 같음 {ok}벌 · "
              f"눈 창이 몸의 {b['창이덮는몸']} 만 덮는다(나머지는 전부 본체 화소)")
        for x in b['컷']:
            print(f"   {x['컷']:<8} {x.get('결과','')}  창밖 {x.get('창밖_같음','-')}%  크기맞춤 {x.get('크기맞춤','-')}")
    if '--json' in sys.argv:
        io.open('의상통일_보고.json', 'w', encoding='utf-8').write(
            json.dumps(전체, ensure_ascii=False, indent=1))
