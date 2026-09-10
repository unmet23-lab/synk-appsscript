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
    여백을 맞추는 일이다. 크기 변경에는 리샘플링이 들어가므로 무손실 생성이나 새 4K 원본은 아니다.

  어떻게
    ① 정본 본체에서 «두 눈 사이 / 판 크기»와 «두 눈 중심의 판 안 자리»를 잰다.
    ② 옷 그림에서 눈을 찾아 그 두 값이 같아지도록 크기·자리를 옮긴다.
    ③ 정본과 같은 크기(기본 4096)의 투명 판에 앉힌다.

  쓰는 법
    python tools/옷틀맞추기.py --들 GPT_누끼
    python tools/옷틀맞추기.py --들 GPT_표정_누끼 --판 4096
    python tools/옷틀맞추기.py --들 GPT_표정_누끼 --옷 목도리,안경
    python tools/옷틀맞추기.py --들 GPT_표정_누끼 --옷 안경 --출력 <별도검수폴더>
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image

try:
    from mascot_originals import ensure_folder
except ModuleNotFoundError:
    from tools.mascot_originals import ensure_folder

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


def 맞춤값(경로, 자, 판):
    """이 그림을 정본 틀에 앉히려면 얼마로 줄이고 어디로 옮겨야 하나."""
    im = Image.open(경로).convert('RGBA')
    a = np.asarray(im)
    몸 = a[..., 3] > 128
    if not 몸.any():
        return None
    눈 = _얹기.눈찾기(a[..., :3], 몸, 기대=자['기대'])
    if 눈 is None:
        return None
    k = (자['눈사이비'] * 판) / max(눈['사이'], 1e-6)
    눈중심 = ((눈['왼'][0] + 눈['오'][0]) / 2 * k, (눈['왼'][1] + 눈['오'][1]) / 2 * k)
    목표중심 = (자['눈중심'][0] * 판, 자['눈중심'][1] * 판)
    return dict(k=k, dx=round(목표중심[0] - 눈중심[0]), dy=round(목표중심[1] - 눈중심[1]))


def 투명틀에앉히기(그림, 판, dx, dy):
    """빈 투명 캔버스로 RGBA를 그대로 복사한다. 마스크로 알파를 두 번 곱하지 않는다."""
    캔 = Image.new('RGBA', (판, 판), (0, 0, 0, 0))
    # RGBA 자신을 paste의 mask로 주면 반투명 털의 alpha가 제곱되고 RGB도 검게 섞인다.
    # 여기는 늘 비어 있는 캔버스이므로 마스크 없는 복사가 원래 색·투명을 보존한다.
    캔.paste(그림, (dx, dy))
    return 캔


def 출력방(입력, 기본, 지정=None):
    낼곳 = os.path.abspath(지정 or 기본)
    if os.path.normcase(낼곳) == os.path.normcase(os.path.abspath(입력)):
        raise ValueError('출력 폴더는 입력 폴더와 달라야 한다 — 원본을 덮어쓰지 않는다')
    정본 = os.path.abspath(정본방)
    try:
        정본안 = os.path.normcase(os.path.commonpath([낼곳, 정본])) == os.path.normcase(정본)
    except ValueError:                      # 별도 드라이브의 검수 폴더는 정본 아래가 아니다
        정본안 = False
    if 정본안:
        raise ValueError('의상 틀 결과를 마스코트 정본 폴더에 쓸 수 없다')
    return 낼곳


def 앉히기(경로, 낼곳, 자, 판=None, 값=None):
    판 = 판 or 자['판']
    im = Image.open(경로).convert('RGBA')
    a = np.asarray(im)
    몸 = a[..., 3] > 128
    if not 몸.any():
        return None
    if 값 is not None:                       # 🔴 옷 한 벌의 열네 컷은 «같은» 값으로 앉힌다
        k, dx, dy = 값['k'], 값['dx'], 값['dy']
        새폭, 새높 = max(1, round(im.width * k)), max(1, round(im.height * k))
        작 = im.resize((새폭, 새높), Image.LANCZOS)
        캔 = 투명틀에앉히기(작, 판, dx, dy)
        os.makedirs(os.path.dirname(낼곳), exist_ok=True)
        캔.save(낼곳)
        b = np.asarray(캔)[..., 3] > 128
        ys, xs = np.where(b) if b.any() else (np.array([0]), np.array([0]))
        닿음 = int(b[0, :].sum() + b[-1, :].sum() + b[:, 0].sum() + b[:, -1].sum())
        return dict(파일=os.path.basename(낼곳), 크기맞춤=round(k, 4),
                    몸폭비=round((xs.max() - xs.min() + 1) / 판, 4), 가장자리에_닿은점=닿음)

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

    캔 = 투명틀에앉히기(작, 판, dx, dy)
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
    지정출력 = None
    if '--출력' in sys.argv:
        순서 = sys.argv.index('--출력') + 1
        if 순서 >= len(sys.argv) or sys.argv[순서].startswith('--'):
            raise SystemExit('--출력 뒤에 별도 결과 폴더 경로가 있어야 한다')
        지정출력 = sys.argv[순서]
    낼방 = 출력방(방, os.path.join(저장소, 'docs', 'Loom_자산', '옷', f'{들}_틀'), 지정출력)
    if '--옷' in sys.argv:
        고른옷 = {s.strip() for s in sys.argv[sys.argv.index('--옷') + 1].split(',') if s.strip()}
        ensure_folder(방, lambda name: name.startswith(누구 + '_')
                      and len(name[:-4].split('_')) >= 3
                      and name[:-4].split('_')[1] in 고른옷)
    else:
        ensure_folder(방, lambda name: name.startswith(누구 + '_'))
    자 = 정본자(누구)
    print(f'■ 정본 {누구} — 판 {자["판"]} · 몸 폭 {자["몸폭비"]*100:.1f}% · '
          f'눈 사이 {자["눈사이비"]*100:.2f}% · 눈 중심 ({자["눈중심"][0]*100:.1f}%, {자["눈중심"][1]*100:.1f}%)')

    파일 = [f for f in sorted(os.listdir(방)) if f.startswith(누구 + '_') and f.endswith('.png')]
    if '--옷' in sys.argv:
        파일 = [f for f in 파일 if len(f[:-4].split('_')) >= 3 and f[:-4].split('_')[1] in 고른옷]

    # 🔴 표정 컷은 «옷 한 벌마다 한 번» 재서 열넷에 같은 값을 쓴다 (09-08).
    #    장마다 따로 재면 ⓐ 눈감은 표정에서 홍채를 못 찾아 여섯 장이 아예 안 나오고
    #    ⓑ 몸 폭이 82.9% ± 6.4% 로 흩어져 앱에서 표정을 갈아 끼울 때 인형이 벌렁거린다.
    #    기준은 표정을 얹기 «전»의 옷 그림이다 — 눈이 가장 또렷하다.
    기준이름 = 들.replace('_표정', '').replace('표정_', '') or 'GPT_누끼'
    기준방들 = [os.path.join(저장소, 'docs', 'Loom_자산', '옷', 기준이름)]
    # GPT 표정 원본은 종량제 GPT와 정액제 GPT 두 방에서 왔다. 새 조합의 기준 그림까지
    # 찾아야 눈감은 컷도 같은 크기·자리에 앉고, 표정을 바꿀 때 몸이 벌렁거리지 않는다.
    if 기준이름 == 'GPT_누끼':
        기준방들.append(os.path.join(저장소, 'docs', 'Loom_자산', '옷', 'GPT정액시험_누끼'))
    고른기준 = 고른옷 if '--옷' in sys.argv else None
    for 기준방 in 기준방들:
        ensure_folder(기준방, lambda name: name.startswith(누구 + '_')
                      and (고른기준 is None
                           or any(item.replace(' ', '') in name for item in 고른기준)))
    값모음, 기준못찾음 = {}, []
    묶음 = {}
    for f in 파일:
        조각 = f[:-4].split('_')
        옷 = 조각[1] if len(조각) >= 3 else None      # <누구>_<옷>_<표정>.png
        묶음.setdefault(옷, []).append(f)
    if any(옷 for 옷 in 묶음 if 옷):
        for 옷 in 묶음:
            if not 옷:
                continue
            기 = next((os.path.join(방, f'{누구}_{옷}.png') for 방 in 기준방들
                      if os.path.exists(os.path.join(방, f'{누구}_{옷}.png'))), None)
            if 기 is None:
                기준못찾음.append(옷)
                continue
            v = 맞춤값(기, 자, 판 or 자['판'])
            if v is None:
                기준못찾음.append(옷)
            else:
                값모음[옷] = v
        if 기준못찾음:
            print(f'   ⚠ 기준을 못 잡은 옷: {", ".join(sorted(set(기준못찾음)))} (그 컷은 장마다 따로 잰다)')

    폭들, 나쁨 = [], []
    for i, f in enumerate(파일, 1):
        조각 = f[:-4].split('_')
        옷 = 조각[1] if len(조각) >= 3 else None
        r = 앉히기(os.path.join(방, f), os.path.join(낼방, f), 자, 판, 값모음.get(옷))
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
