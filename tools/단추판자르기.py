"""단추판 자르기 — «한 장에 열둘» 로 구운 절번호 단추 판을 열두 낱장으로 가른다 (2026-09-07 · 유호 픽 「한 장에 열둘 시험」).

왜 있나:
  열둘을 따로 굽으면 숫자 높이가 지름의 45~87% 로 널뛰고 테 폭·숫자 자리도 제각각이다(09-07 실측 두 번).
  지시문의 수치(40%)를 모델이 안 듣는다. 한 장에 함께 그리면 «같은 손»이라 크기·테·자리가 맞는다 —
  첫 시험 판(09-07 19:54)이 정확히 그랬다: 열둘이 같은 크기·같은 테·숫자 정중앙.

어떻게 가르나 — 🔴 «덩어리 세기»로는 못 가른다 (첫 판 실측):
  지시문에 「사이를 넉넉히 띄워라」를 적어도 모델은 열둘을 **서로 닿게** 그렸다. 그래서 AI 누끼의 알파는
  덩어리 «하나»다. 대신 숫자를 쓴다 — 숫자는 잉크색 실이라 늘 또렷하고, 단추 «정중앙»에 있다.
    ① AI 누끼로 배경을 걷는다(알파).
    ② 알파 덩어리의 상자를 4×3 으로 나눠 칸마다 잉크색 픽셀의 무게중심을 잰다 = 단추 중심 열둘.
    ③ 알파 픽셀마다 «가장 가까운 중심»을 찾아 그 단추의 몫으로 준다(닿은 원들은 이 규칙으로 정확히 갈린다).
    ④ 몫마다 상자를 잘라 단추숫자_01~12.avif 로 «덮어쓴다». 읽는 순서는 위→아래, 왼→오.
  🔑 칸에 잉크가 없거나(숫자 못 찾음) 중심이 열둘이 아니면 안 쓰고 수와 함께 멈춘다.
  🔑 크기를 안 바꾼다 — 한 장에서 나온 열둘은 이미 같은 자다. 자르기·정사각은 룸자산화.py 몫.

사용:
  python tools/단추판자르기.py                      # 기본 경로 · 열둘을 덮어쓴다
  python tools/단추판자르기.py --안냄               # 가르기만 하고 한눈에 판만 낸다(눈으로 먼저)
  python tools/단추판자르기.py --판 <png> --열 4 --행 3
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

for 흐름 in (sys.stdout, sys.stderr):
    try:
        흐름.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
방 = os.path.join(ROOT, 'docs', 'Loom_자산', '구움')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import AI누끼  # noqa: E402


def 중심찾기(rgb, a, 열, 행):
    """알파 상자를 열×행 칸으로 나누고, 칸마다 잉크색 픽셀의 무게중심을 낸다. 못 찾은 칸은 이름째 알린다."""
    ys, xs = np.where(a)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    잉크 = a & (rgb.max(2) < 110)
    중심, 빈칸 = [], []
    for r in range(행):
        for c in range(열):
            cx0 = x0 + (x1 - x0) * c // 열; cx1 = x0 + (x1 - x0) * (c + 1) // 열
            cy0 = y0 + (y1 - y0) * r // 행; cy1 = y0 + (y1 - y0) * (r + 1) // 행
            칸 = 잉크[cy0:cy1, cx0:cx1]
            if 칸.sum() < 200:
                빈칸.append(f'{r + 1}행 {c + 1}열'); continue
            py, px = np.where(칸)
            중심.append((cx0 + px.mean(), cy0 + py.mean()))
    if 빈칸:
        raise SystemExit(f'🔴 잉크(숫자)가 없는 칸 {len(빈칸)}: {", ".join(빈칸)} — 안 썼다. 판을 눈으로 본다.')
    return 중심


def 가르기(판경로, 열=4, 행=3):
    im = Image.open(판경로)
    누끼 = AI누끼.걷기(im, AI누끼.세션()).convert('RGBA')
    arr = np.asarray(누끼)
    a = arr[:, :, 3] > 128
    if not a.any():
        raise SystemExit('오린 것이 없다(알파 0)')
    중심 = 중심찾기(arr[:, :, :3].astype(int), a, 열, 행)
    # 🔴 «가장 가까운 중심» 으로 나누면 이웃 단추의 조각이 딸려 온다(첫 판 실측 — 숫자가 정중앙에서 조금
    #   벗어나 있어 경계가 비뚤어진다). 단추는 같은 크기의 «원»이고 격자로 놓였으니, 숫자 중심들로
    #   격자(열 x · 행 y 의 평균)를 맞추고 그 격자점에서 «반지름 = 간격의 절반» 원 안만 그 단추로 친다.
    # 🔴 숫자 중심은 단추 중심보다 조금 «위»에 있다(둘째 판 실측 — 아래 줄이 100px 짧게 잘렸다).
    #   그래서 격자는 숫자가 아니라 알파 상자로 잡는다: 같은 크기의 원이 닿아 놓인 격자라
    #   상자 폭 = 열 × 지름, 높이 = 행 × 지름이다. 숫자는 「칸마다 하나 있나」의 검사에만 쓴다.
    ys, xs = np.where(a)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    지름 = min((x1 - x0) / 열, (y1 - y0) / 행)
    반지름 = 지름 / 2 * 1.03           # 보풀 몫 3%
    열x = [x0 + (x1 - x0) * (c + 0.5) / 열 for c in range(열)]
    행y = [y0 + (y1 - y0) * (r + 0.5) / 행 for r in range(행)]
    격자중심 = [(열x[c], 행y[r]) for r in range(행) for c in range(열)]
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    낱장 = []
    for k, (cx, cy) in enumerate(격자중심):
        마스크 = a & (((xx - cx) ** 2 + (yy - cy) ** 2) <= 반지름 ** 2)
        ys, xs = np.where(마스크)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        조각 = arr[y0:y1, x0:x1].copy()
        조각[:, :, 3] = np.where(마스크[y0:y1, x0:x1], 조각[:, :, 3], 0)
        낱장.append(Image.fromarray(조각, 'RGBA'))
    return 낱장


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--판', default=os.path.join(방, '단추판_열둘.png'))
    ap.add_argument('--열', type=int, default=4)
    ap.add_argument('--행', type=int, default=3)
    ap.add_argument('--안냄', action='store_true', help='avif 는 안 쓰고 한눈에 판만 낸다')
    ap.add_argument('--한눈에', default='', help='한눈에 판을 낼 경로(기본 = 바탕화면 SYNK 자산/밤굽기_0907)')
    a = ap.parse_args()

    낱장 = 가르기(a.판, a.열, a.행)
    print(f'■ 단추 {len(낱장)}장 ({a.행}행 × {a.열}열)')
    for i, 조각 in enumerate(낱장, 1):
        if not a.안냄:
            조각.save(os.path.join(방, f'단추숫자_{i:02d}.avif'), 'AVIF', quality=70)
        print(f'   {i:02d}  {조각.size[0]}x{조각.size[1]}' + ('' if a.안냄 else '  → 단추숫자_%02d.avif' % i))

    칸 = 220
    장 = Image.new('RGB', (칸 * 6, (칸 + 18) * 2), (58, 50, 44)); d = ImageDraw.Draw(장)
    for i, 조각 in enumerate(낱장):
        t = 조각.copy(); t.thumbnail((칸 - 12, 칸 - 12), Image.LANCZOS)
        바탕 = Image.new('RGBA', (칸 - 12, 칸 - 12), (58, 50, 44, 255)); 바탕.alpha_composite(t, ((칸 - 12 - t.width) // 2, (칸 - 12 - t.height) // 2))
        x, y = (i % 6) * 칸, (i // 6) * (칸 + 18)
        장.paste(바탕.convert('RGB'), (x + 6, y + 6)); d.text((x + 6, y + 칸), f'{i + 1:02d}', fill=(215, 205, 190))
    낼곳 = a.한눈에 or os.path.join(os.path.expanduser('~'), 'OneDrive', 'Desktop', 'SYNK 자산', '밤굽기_0907')
    os.makedirs(낼곳, exist_ok=True)
    경로 = os.path.join(낼곳, '한눈에_단추_한장에서_열둘.png')
    장.save(경로)
    print('✅ 한눈에:', 경로, '' if a.안냄 else '· avif 열둘을 덮어썼다 — 다음: python tools/룸자산화.py')


if __name__ == '__main__':
    main()
