# -*- coding: utf-8 -*-
"""GPT 로 구운 옷 그림의 «흰 배경»을 오려 투명 PNG 로 만든다 (2026-09-08).

  왜 새로 있나
    기존 tools/마스코트누끼.js 는 «채도»로 가른다 — 무채 배경 × 유채 몸이 전제다.
    GPT 판은 배경이 흰색이고 몸은 어두운 «갈색»이라 둘 다 채도가 낮아 그 자로 안 갈린다.

  🔴 밝기만으로 가르면 안 된다
    크림색 목도리·오트밀 후드·버터옐로 왕관이 배경과 같은 밝기 대역에 있다.
    그래서 «바깥과 이어진 흰색»만 지운다 — 그림 네 귀에서 채우기(flood fill)를 시작하면
    옷 «안»의 밝은 색은 바깥과 안 이어져 있어 살아남는다.

  쓰는 법
    python tools/옷누끼.py                        # docs/Loom_자산/옷/GPT 전체
    python tools/옷누끼.py --들 GPT_표정          # 표정 얹은 것까지
    python tools/옷누끼.py --옷 목도리
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

try:
    from mascot_originals import ensure_folder
except ModuleNotFoundError:
    from tools.mascot_originals import ensure_folder

저장소 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def 오리기(경로, 낼곳, 문턱=232, 부드럽게=1.2):
    im = Image.open(경로).convert('RGB')
    W, H = im.size
    a = np.asarray(im).astype(int)
    밝 = a.mean(axis=2)
    쨍 = a.max(axis=2) - a.min(axis=2)
    흰후보 = (밝 > 문턱) & (쨍 < 22)

    # 🔴 «바깥과 이어진» 흰색만 배경이다. PIL 의 floodfill 은 2560 짜리에서 0.0% 를 채웠다(09-08).
    #    그래서 연결 덩어리를 한 번에 세는 scipy 로 간다 — 그림 테두리에 닿은 덩어리가 배경이다.
    덩, n = ndimage.label(흰후보)
    테두리표 = set(덩[0, :].tolist()) | set(덩[-1, :].tolist()) | set(덩[:, 0].tolist()) | set(덩[:, -1].tolist())
    테두리표.discard(0)
    배경 = np.isin(덩, list(테두리표)) if 테두리표 else np.zeros_like(흰후보)

    알파 = np.where(배경, 0, 255).astype(np.uint8)
    알파im = Image.fromarray(알파, 'L')
    if 부드럽게:
        알파im = 알파im.filter(ImageFilter.GaussianBlur(부드럽게))
    낸 = Image.merge('RGBA', (*im.split(), 알파im))
    os.makedirs(os.path.dirname(낼곳), exist_ok=True)
    낸.save(낼곳)
    남 = 100.0 * float((알파 > 128).sum()) / (W * H)
    return dict(파일=os.path.basename(낼곳), 남은비율=round(남, 2))


if __name__ == '__main__':
    들 = 'GPT'
    if '--들' in sys.argv:
        들 = sys.argv[sys.argv.index('--들') + 1]
    방 = os.path.join(저장소, 'docs', 'Loom_자산', '옷', 들)
    낼방 = os.path.join(저장소, 'docs', 'Loom_자산', '옷', f'{들}_누끼')

    if '--옷' in sys.argv:
        고른 = [s.strip() for s in sys.argv[sys.argv.index('--옷') + 1].split(',')]
        ensure_folder(방, lambda name: any(item in name for item in 고른))
    else:
        ensure_folder(방)
    파일 = [f for f in sorted(os.listdir(방)) if f.endswith('.png') and not f.startswith('_')]
    if '--옷' in sys.argv:
        파일 = [f for f in 파일 if any(g in f for g in 고른)]

    낮은것 = []
    for i, f in enumerate(파일, 1):
        r = 오리기(os.path.join(방, f), os.path.join(낼방, f))
        if r['남은비율'] < 8 or r['남은비율'] > 75:
            낮은것.append((f, r['남은비율']))
        if i % 20 == 0 or i == len(파일):
            print(f'  {i}/{len(파일)}')
    print(f'\n■ {len(파일)}장을 오렸다 → {낼방}')
    if 낮은것:
        print('   🔴 남은 비율이 이상한 것(8% 미만 또는 60% 초과):')
        for f, v in 낮은것:
            print(f'      {f} — {v}%')
    else:
        print('   남은 비율이 전부 8~60% 안이다.')
