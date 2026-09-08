# -*- coding: utf-8 -*-
"""옷 입은 그림을 «정본과 같은 틀»에 앉힌다 — 두 눈을 기준으로 (2026-09-08).

  왜 새로 있나
    tools/마스코트틀맞춤.py 는 «몸 폭»을 기준으로 앉힌다. 옷이 없을 때는 그게 맞지만,
    옷을 입으면 폭이 옷만큼 커진다 — 겨울 델을 입은 컷만 몸이 작게 앉는다.
    옷 그림에서 변하지 않는 것은 «두 눈»이라 그것을 자로 쓴다.

  🔴 왜 필요한가 (09-08 실측)
    정본  4096 판 · 몸 폭 3236화소 → 판의 79% (여백 21%)
    GPT   2560 판 · 몸 폭 2520화소 → 판의 98% (여백 2%)
    그대로 앱에 넣으면 옷을 입는 순간 인형이 «커진다». 몸을 늘이고 줄일 일이 아니라
    여백을 맞추는 일이다 — 그래서 화질 손실이 없다.

  어떻게
    ① 정본 본체에서 «두 눈 사이 / 판 크기»와 «두 눈 중심의 판 안 자리»를 잰다.
    ② 옷 그림에서 눈을 찾아 그 두 값이 같아지도록 크기·자리를 옮긴다.
    ③ 정본과 같은 크기(기본 4096)의 투명 판에 앉힌다.

  쓰는 법
    python tools/옷틀맞추기.py --들 GPT_누끼
    python tools/옷틀맞추기.py --들 GPT_표정_누끼 --판 4096
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image

저장소 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
정본방 = os.path.join(저장소, 'docs', '캐릭터', '정본_4K')

_spec = importlib.util.spec_from_file_location('옷표정얹기', os.path.join(저장소, 'tools', '옷표정얹기.py'))
_얹기 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_얹기)


def 정본자(누구):
    a = np.asarray(Image.open(os.path.join(정본방, f'{누구}_본체.png')).convert('RGBA'))
    몸 = a[..., 3] > 128
    눈 = _얹기.눈찾기(a[..., :3], 몸)
    if 눈 is None:
        raise SystemExit(f'정본 {누구} 에서 눈을 못 찾았다')
    판 = a.shape[0]
    ys, xs = np.where(몸)
    return dict(
        판=판,
        눈사이비=눈['사이'] / 판,
        눈중심=((눈['왼'][0] + 눈['오'][0]) / 2 / 판, (눈['왼'][1] + 눈['오'][1]) / 2 / 판),
        몸폭비=(xs.max() - xs.min() + 1) / 판,
        기대=dict(사이비=눈['사이'] / (xs.max() - xs.min() + 1),
                세로비=((눈['왼'][1] + 눈['오'][1]) / 2 - ys.min()) / (ys.max() - ys.min() + 1)))


def 앉히기(경로, 낼곳, 자, 판=None):
    판 = 판 or 자['판']
    im = Image.open(경로).convert('RGBA')
    a = np.asarray(im)
    몸 = a[..., 3] > 128
    if not 몸.any():
        return None
    눈 = _얹기.눈찾기(a[..., :3], 몸, 기대=자['기대'])
    if 눈 is None:
        return dict(파일=os.path.basename(경로), 결과='🔴 눈을 못 찾았다')

    # 눈 사이가 «판의 몇 배»여야 하는지로 크기를 정한다
    목표사이 = 자['눈사이비'] * 판
    k = 목표사이 / max(눈['사이'], 1e-6)
    새폭, 새높 = max(1, round(im.width * k)), max(1, round(im.height * k))
    작 = im.resize((새폭, 새높), Image.LANCZOS)

    눈중심 = ((눈['왼'][0] + 눈['오'][0]) / 2 * k, (눈['왼'][1] + 눈['오'][1]) / 2 * k)
    목표중심 = (자['눈중심'][0] * 판, 자['눈중심'][1] * 판)
    dx, dy = round(목표중심[0] - 눈중심[0]), round(목표중심[1] - 눈중심[1])

    캔 = Image.new('RGBA', (판, 판), (0, 0, 0, 0))
    캔.paste(작, (dx, dy), 작)
    os.makedirs(os.path.dirname(낼곳), exist_ok=True)
    캔.save(낼곳)

    b = np.asarray(캔)[..., 3] > 128
    ys, xs = np.where(b) if b.any() else (np.array([0]), np.array([0]))
    # 🔴 «잘렸나»는 크기를 바꾼 뒤의 점 수 차이로 재면 안 된다 — 늘리면 알파 경계가 부드러워져
    #    문턱 128 을 넘는 점 수 자체가 달라진다(09-08 에 21장 전부 「잘렸다」로 찍혔다).
    #    판 «가장자리 한 줄»에 몸이 닿았는지로 잰다.
    닿음 = int(b[0, :].sum() + b[-1, :].sum() + b[:, 0].sum() + b[:, -1].sum())
    return dict(파일=os.path.basename(낼곳), 크기맞춤=round(k, 4),
                몸폭비=round((xs.max() - xs.min() + 1) / 판, 4), 가장자리에_닿은점=닿음)


if __name__ == '__main__':
    누구 = '까몽'
    if '--누구' in sys.argv:
        누구 = sys.argv[sys.argv.index('--누구') + 1]
    들 = 'GPT_누끼'
    if '--들' in sys.argv:
        들 = sys.argv[sys.argv.index('--들') + 1]
    판 = int(sys.argv[sys.argv.index('--판') + 1]) if '--판' in sys.argv else None

    방 = os.path.join(저장소, 'docs', 'Loom_자산', '옷', 들)
    낼방 = os.path.join(저장소, 'docs', 'Loom_자산', '옷', f'{들}_틀')
    자 = 정본자(누구)
    print(f'■ 정본 {누구} — 판 {자["판"]} · 몸 폭 {자["몸폭비"]*100:.1f}% · '
          f'눈 사이 {자["눈사이비"]*100:.2f}% · 눈 중심 ({자["눈중심"][0]*100:.1f}%, {자["눈중심"][1]*100:.1f}%)')

    파일 = [f for f in sorted(os.listdir(방)) if f.startswith(누구 + '_') and f.endswith('.png')]
    폭들, 나쁨 = [], []
    for i, f in enumerate(파일, 1):
        r = 앉히기(os.path.join(방, f), os.path.join(낼방, f), 자, 판)
        if r is None:
            continue
        if r.get('결과') or r.get('가장자리에_닿은점', 0) > 0:
            나쁨.append((f, r.get('결과') or f'{r["가장자리에_닿은점"]}점이 판 가장자리에 닿았다'))
        else:
            폭들.append(r['몸폭비'])
        if i % 40 == 0 or i == len(파일):
            print(f'   {i}/{len(파일)}')
    if 폭들:
        v = np.array(폭들)
        print(f'\n■ {len(폭들)}장을 앉혔다 → {낼방}')
        print(f'   몸 폭 = 판의 {v.mean()*100:.1f}% ± {v.std()*100:.1f}%  '
              f'(가장 좁은 {v.min()*100:.1f}% · 가장 넓은 {v.max()*100:.1f}%)')
        print(f'   정본은 {자["몸폭비"]*100:.1f}% 다.')
    if 나쁨:
        print(f'   🔴 {len(나쁨)}장이 걸렸다:')
        for f, why in 나쁨[:10]:
            print(f'      {f} — {why}')
