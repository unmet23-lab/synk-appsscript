# -*- coding: utf-8 -*-
"""갓 구운 마스코트 컷을 «정본 규격»에 맞춰 앉힌다 (2026-09-05 신설).

■ 왜 있나
  제미나이가 낸 판은 물체가 캔버스를 꽉 채운다(09-05 실측 99.4%). 정본은 그렇지 않다
  (몽글 본체 = 폭 76.8% · 중심 50.1%, 47.5%). 그대로 정본에 넣으면 같은 캐릭터의 컷들이
  «크기가 튀는» 세트가 된다 — 앱이 컷을 갈아끼울 때 몸이 벌렁거린다.

■ 무엇을 하나
  ① 불투명 픽셀의 bbox 를 재서 몸만 오려낸다
  ② 그 몸을 «기준 컷»과 같은 폭 비율로 줄인다(가로세로 비는 그대로)
  ③ 기준 컷과 같은 중심에 놓아 같은 크기의 투명 캔버스에 앉힌다

  🔑 폭을 기준으로 삼는다 — 몽글은 종 모양이라 폭이 정체성에 가깝고, 높이는 표정마다
    술이 조금씩 달라진다. 높이에 맞추면 폭이 표정마다 흔들린다.

■ 무엇을 안 하나
  원본을 안 지운다(`_틀.png` 로 따로 낸다). 임계나 기준을 바꿔 다시 앉힐 수 있어야 한다.

쓰기:
  python tools/마스코트틀맞춤.py --기준 docs/캐릭터/정본_4K/몽글_본체.png <맞출 파일...>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

알파문턱 = 40


def 몸상자(im):
    a = np.array(im)
    ys, xs = np.where(a[..., 3] > 알파문턱)
    if len(xs) == 0:
        raise SystemExit('불투명 픽셀이 없다 — 누끼를 먼저 걷었나?')
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def 규격(경로):
    im = Image.open(경로).convert('RGBA')
    x0, y0, x1, y1 = 몸상자(im)
    W, H = im.size
    return {
        '캔버스': (W, H),
        '폭비': (x1 - x0) / W,
        '중심': ((x0 + x1) / 2 / W, (y0 + y1) / 2 / H),
    }


def 앉히기(경로, 기준):
    im = Image.open(경로).convert('RGBA')
    x0, y0, x1, y1 = 몸상자(im)
    몸 = im.crop((x0, y0, x1, y1))
    W, H = 기준['캔버스']
    새폭 = max(1, int(round(W * 기준['폭비'])))
    s = 새폭 / 몸.width
    몸 = 몸.resize((새폭, max(1, int(round(몸.height * s)))), Image.LANCZOS)
    cx, cy = 기준['중심']
    판 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    판.alpha_composite(몸, (int(round(cx * W - 몸.width / 2)), int(round(cy * H - 몸.height / 2))))
    낼것 = 경로.with_name(경로.stem + '_틀.png')
    판.save(낼것)
    nx0, ny0, nx1, ny1 = 몸상자(판)
    print(f'  · {경로.name}  →  {낼것.name}   폭 {(nx1-nx0)/W*100:.1f}% ·'
          f' 중심 {(nx0+nx1)/2/W*100:.1f},{(ny0+ny1)/2/H*100:.1f}%')
    return 낼것


def main():
    argv = sys.argv[1:]
    if '--기준' not in argv:
        raise SystemExit('--기준 <정본 파일> 이 있어야 한다')
    i = argv.index('--기준')
    기준경로 = Path(argv[i + 1])
    대상 = [Path(p) for j, p in enumerate(argv) if j not in (i, i + 1) and not p.startswith('--')]
    if not 대상:
        raise SystemExit('맞출 파일을 하나 이상 준다')
    g = 규격(기준경로)
    print(f'■ 기준 {기준경로.name} — 캔버스 {g["캔버스"][0]}x{g["캔버스"][1]} ·'
          f' 폭 {g["폭비"]*100:.1f}% · 중심 {g["중심"][0]*100:.1f},{g["중심"][1]*100:.1f}%')
    for p in 대상:
        앉히기(p, g)


if __name__ == '__main__':
    main()
