"""무대 그림에서 «움직일 만한 빛»의 자리를 잰다 (2026-09-08 · 0원).

■ 왜 있나
  무대 층(bots/오버레이/무대.html)의 `무대빛` 표는 손으로 적는 값이다 — 가로등이 어디 있고,
  창문 불이 어디 있고, 물이 어디서 시작하는지. 눈대중으로 적으면 빛이 엉뚱한 데서 깜빡인다.
  09-08 에 무대 셋을 이 방식으로 재서 얹었고, 나머지 여섯도 같은 자로 재려고 도구로 세운다.

■ 무엇을 재나
  ① 등    — 따뜻하고(붉은기) 아주 밝은 덩이. 가로등·등불.
  ② 창    — 밝고 «색이 진한»(채도 높은) 작은 덩이. 건물 창문 불빛.
  ③ 달    — 크고 둥글고 흰 덩이(하늘 쪽).
  ④ 물선  — 행마다 «세로로 길게 번지는 밝은 자국»이 시작되는 높이. 물이 없으면 안 낸다.
  ⑤ 네온  — 물 자리에서 세로로 길게 뻗은 색 기둥.

■ 화면 자리로 바꾼다
  무대 그림은 정사각인데 방송은 16:9 다. 가운데를 잘라 채우므로(cover) 위아래 21.875%씩 잘린다.
  그래서 y_화면 = (y_그림 − 0.21875) ÷ 0.5625 · 잘려 나가는 자리는 안 낸다.
  ⚠ `맞춤`(그림을 위아래로 옮겨 자르기)을 준 무대는 `--맞춤 44` 처럼 같이 줘야 자리가 맞는다.

쓰기: python tools/무대빛재기.py [무대이름 …]   (안 주면 전부)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

루트 = Path(__file__).resolve().parent.parent
무대방 = 루트 / 'docs/Loom_자산/무대'


def 화면y(y몫, 맞춤=0.5):
    """정사각 그림의 세로 몫 → 16:9 화면의 세로 몫. 맞춤 0.5 가 가운데."""
    남 = 0.5625                      # 16:9 가 정사각에서 차지하는 세로 몫
    위 = (1 - 남) * 맞춤              # 위로 잘려 나가는 몫
    return (y몫 - 위) / 남


def 덩이들(마스크, 최소=40):
    lab, n = ndimage.label(마스크)
    나온다 = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) < 최소:
            continue
        나온다.append({'n': len(ys), 'x': xs.mean(), 'y': ys.mean(),
                     'w': xs.max() - xs.min() + 1, 'h': ys.max() - ys.min() + 1})
    return 나온다


def 재기(이름, 맞춤=0.5):
    길 = 무대방 / f'{이름}.webp'
    if not 길.exists():
        print(f'🔴 {이름} — 그림이 없다: {길}')
        return
    im = Image.open(길).convert('RGB')
    W, H = im.size
    A = np.array(im).astype(int)
    R, G, B = A[:, :, 0], A[:, :, 1], A[:, :, 2]
    lum = A.mean(axis=2)
    sat = A.max(axis=2) - A.min(axis=2)
    보임 = lambda y: 0.0 <= 화면y(y / H, 맞춤) <= 1.0

    print(f'\n■ {이름} ({W}×{H} · 맞춤 {맞춤:.2f})')
    행밝기 = lum.mean(axis=1)
    칸 = [f'{화면y(y / H, 맞춤):.2f}:{행밝기[y]:.0f}' for y in range(0, H, H // 12) if 보임(y)]
    print('  화면 세로별 밝기 —', ' '.join(칸))

    # ① 등 — 따뜻하고 아주 밝다
    등 = 덩이들((lum > 205) & (R > G) & (G > B + 15), 최소=60)
    등 = [d for d in 등 if 보임(d['y']) and d['n'] < W * H * 0.01]
    등.sort(key=lambda d: -d['n'])
    for d in 등[:8]:
        print(f"  등   x{d['x'] / W * 100:5.1f}% y{화면y(d['y'] / H, 맞춤) * 100:5.1f}% (칸 {d['n']:5d} · 지름 {max(d['w'], d['h']) / W * 100:.1f}%)")

    # ② 창 — 밝고 색이 진한 작은 덩이
    창 = 덩이들((lum > 150) & (sat > 110), 최소=25)
    창 = [d for d in 창 if 보임(d['y']) and 25 <= d['n'] <= 3000]
    창.sort(key=lambda d: (d['x']))
    if 창:
        print(f'  창   {len(창)}개')
        for d in 창[:40]:
            ys, xs = int(d['y']), int(d['x'])
            rgb = A[max(0, ys - 2):ys + 3, max(0, xs - 2):xs + 3].reshape(-1, 3).mean(axis=0).round().astype(int)
            print(f"       [{d['x'] / W * 100:.1f}, {화면y(d['y'] / H, 맞춤) * 100:.1f}, '#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}'],")

    # ③ 달 — 크고 둥글고 희다(하늘 쪽 = 위 절반)
    달마스크 = (lum > 195) & (sat < 45)
    달마스크[int(H * 0.6):] = False
    for d in sorted(덩이들(달마스크, 최소=400), key=lambda d: -d['n'])[:3]:
        둥글 = d['n'] / (np.pi * d['w'] / 2 * d['h'] / 2)
        if 0.6 < d['w'] / d['h'] < 1.7 and 둥글 > 0.55 and 보임(d['y']):
            print(f"  달   x{d['x'] / W * 100:5.1f}% y{화면y(d['y'] / H, 맞춤) * 100:5.1f}% 지름 {max(d['w'], d['h']) / W * 100:.1f}%")

    # ④⑤ 물 — 세로로 긴 밝은 색 자국이 있는 자리
    아래 = A[int(H * 0.45):]
    al, asat = 아래.mean(axis=2), 아래.max(axis=2) - 아래.min(axis=2)
    비침 = (al > 120) & (asat > 90)
    열 = ndimage.uniform_filter1d(비침.sum(axis=0).astype(float), 9)
    if 열.max() > 아래.shape[0] * 0.06:
        ys = np.where(비침.any(axis=1))[0]
        물선 = 화면y((int(H * 0.45) + ys.min()) / H, 맞춤)
        print(f'  물   있다 · 물선 화면 {물선 * 100:.0f}%')
        봉 = [x for x in range(4, W - 4) if 열[x] == 열[max(0, x - 4):x + 5].max() and 열[x] > 열.max() * 0.25]
        묶 = []
        for x in 봉:
            if 묶 and x - 묶[-1][-1] < W * 0.02:
                묶[-1].append(x)
            else:
                묶.append([x])
        for m in 묶[:16]:
            x = int(np.mean(m))
            seg = 아래[:, max(0, x - 6):x + 7]
            sl, ss = seg.mean(axis=2), seg.max(axis=2) - seg.min(axis=2)
            msk = (sl > 120) & (ss > 90)
            if not msk.any():
                continue
            rgb = seg[msk].mean(axis=0).round().astype(int)
            print(f"       네온 [{x / W * 100:.1f}, '#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}'],")
    else:
        print('  물   없다(세로로 번지는 자국이 모자라다)')


if __name__ == '__main__':
    것들 = sys.argv[1:] or sorted(p.stem for p in 무대방.glob('*.webp'))
    for 이름 in 것들:
        맞춤 = 0.5
        if '=' in 이름:
            이름, 맞춤 = 이름.split('=')[0], float(이름.split('=')[1]) / 100
        재기(이름, 맞춤)
