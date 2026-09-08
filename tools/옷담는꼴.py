# -*- coding: utf-8 -*-
"""옷 자산을 앱이 쓸 «담는 꼴»로 바꾼다 — 4096 PNG 를 AVIF 로 (2026-09-08).

  왜 있나
    최종 자산이 한 장에 8.3MB 라 294장이면 2.6기가다. 그대로는 앱에 못 넣는다.
    저장소가 이미 4K 배경을 AVIF 로 730KB 에 담고 있어 통로는 서 있다.

  실측 (까몽_목도리 한 장 · 09-08)
    PNG  4096   8.3 MB        AVIF 4096   334 KB   (25배 작다 · 크기 그대로)
                              AVIF 2048   160 KB
                              AVIF 1024    63 KB

  🔴 크기를 줄이는 것과 담는 꼴을 바꾸는 것은 다른 결정이다
    담는 꼴만 바꾸면 화소가 그대로라 «되돌릴 수» 있다. 크기를 줄이면 잃는다.
    그래서 기본은 4096 그대로 두고, 작은 판은 --크기 로 따로 낸다.

  🔴 알파(투명)를 지키는지 매번 센다 — 담는 꼴이 알파를 흘리면 배경이 흰 사각형으로 돌아온다.

  쓰는 법
    python tools/옷담는꼴.py --들 GPT_표정_누끼_틀              # 4096 그대로 AVIF
    python tools/옷담는꼴.py --들 GPT_표정_누끼_틀 --크기 1024  # 1024 로 줄여서
    python tools/옷담는꼴.py --들 GPT_누끼_틀 --품질 70
"""
import os
import sys

import numpy as np
from PIL import Image

저장소 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
옷방뿌리 = os.path.join(저장소, 'docs', 'Loom_자산', '옷')


def 담기(경로, 낼곳, 크기=None, 품질=62):
    im = Image.open(경로).convert('RGBA')
    원래알파 = float((np.asarray(im)[..., 3] > 128).mean())
    if 크기 and max(im.size) != 크기:
        im = im.resize((크기, round(im.height * 크기 / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(낼곳), exist_ok=True)
    im.save(낼곳, 'AVIF', quality=품질)

    # 🔴 되읽어 «투명이 살아 있나»를 센다 — 담는 꼴이 알파를 흘리면 흰 사각형이 된다
    되 = Image.open(낼곳).convert('RGBA')
    센알파 = float((np.asarray(되)[..., 3] > 128).mean())
    return dict(
        낸크기=os.path.getsize(낼곳),
        원크기=os.path.getsize(경로),
        알파차=round(abs(센알파 - 원래알파) * 100, 2),
        치수=되.size,
    )


if __name__ == '__main__':
    들 = 'GPT_표정_누끼_틀'
    if '--들' in sys.argv:
        들 = sys.argv[sys.argv.index('--들') + 1]
    크기 = int(sys.argv[sys.argv.index('--크기') + 1]) if '--크기' in sys.argv else None
    품질 = int(sys.argv[sys.argv.index('--품질') + 1]) if '--품질' in sys.argv else 62

    방 = os.path.join(옷방뿌리, 들)
    꼬리 = f'_avif{크기}' if 크기 else '_avif'
    낼방 = os.path.join(옷방뿌리, 들 + 꼬리)
    파일 = [f for f in sorted(os.listdir(방)) if f.endswith('.png') and not f.startswith('_')]
    if not 파일:
        raise SystemExit(f'담을 것이 없다 — {방}')

    print(f'■ {들} · {len(파일)}장 · {"크기 그대로" if not 크기 else f"긴 변 {크기}"} · 품질 {품질}')
    원합 = 낸합 = 0
    샌것 = []
    for i, f in enumerate(파일, 1):
        r = 담기(os.path.join(방, f), os.path.join(낼방, f[:-4] + '.avif'), 크기, 품질)
        원합 += r['원크기']
        낸합 += r['낸크기']
        if r['알파차'] > 0.5:
            샌것.append((f, r['알파차']))
        if i % 50 == 0 or i == len(파일):
            print(f'   {i}/{len(파일)}')
    print()
    print(f'■ {len(파일)}장 → {낼방}')
    print(f'   {원합/1048576:.0f} MB  →  {낸합/1048576:.0f} MB   ({원합/max(낸합,1):.0f}배 작다)')
    print(f'   한 장 평균 {낸합/len(파일)/1024:.0f} KB')
    if 샌것:
        print(f'   🔴 투명이 샌 것 {len(샌것)}장:')
        for f, v in 샌것[:8]:
            print(f'      {f} — 알파가 {v}%p 달라졌다')
        sys.exit(1)
    print('   ✅ 투명이 전부 그대로다 (알파 차이 0.5%p 안)')
