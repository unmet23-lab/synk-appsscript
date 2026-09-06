"""«씌움»(제미나이가 통째로 그린 그림)과 «얹음»(조각을 얹은 것)을 벌마다 나란히 놓는다 (2026-09-07 · 0원).

■ 왜 있나 (유호 09-07 「전보다 훨씬 좋아졌는데 아직 좀 끊기거나 살짝 어색한 부분들이 많네」)
  얹음만 보면 «어디가 끊겼는지» 기준이 없다. 씌움은 제미나이가 옷·털·그늘을 한 장에 그린 것이라
  「입은 옷이 자연스러울 때 어떻게 보이나」의 본보기다. 둘을 나란히 두면 끊긴 자리·어색한 자리가 바로 짚힌다.
  ⚠ 씌움과 얹음의 옷은 «다른 판»에서 그려져 주름·자리가 조금 다르다 — 같은 옷인지가 아니라 «자연스러움»을 견준다.

쓰는 법:
  python tools/옷견줌판.py --마스코트 까몽 --낼곳 docs/Loom_자산/옷/까몽_견줌판_0907.webp
  python tools/옷견줌판.py --마스코트 까몽 --것 "겨울 델,안경" --낼곳 <파일> --높이 900   # 몇 벌만 크게
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

루트 = Path(__file__).resolve().parent.parent
옷방 = 루트 / 'docs/Loom_자산/옷'


def 흰바탕(im):
    bg = Image.new('RGB', im.size, (255, 255, 255))
    bg.paste(im, (0, 0), im if im.mode == 'RGBA' else None)
    return bg


def 잘라(im, 여백=40):
    """흰 바탕에서 물체 상자만 남긴다 — 씌움은 회색 스튜디오 바닥이라 «흰이 아님»으로 자른다."""
    a = np.asarray(im)
    m = (a < 245).any(axis=2)
    ys, xs = np.where(m)
    if len(xs) == 0:
        return im
    return im.crop((max(0, xs.min() - 여백), max(0, ys.min() - 여백),
                    min(im.width, xs.max() + 여백), min(im.height, ys.max() + 여백)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--마스코트', default='까몽')
    ap.add_argument('--것', help='쉼표로 나눈 옷 이름(부분 일치) · 없으면 전부')
    ap.add_argument('--낼곳', required=True)
    ap.add_argument('--높이', type=int, default=520)
    a = ap.parse_args()

    씌움들 = sorted((옷방 / '씌움').glob(f'옷_{a.마스코트}_*.png'))
    if a.것:
        고른 = [s.replace(' ', '') for s in a.것.split(',')]
        씌움들 = [p for p in 씌움들 if any(g in p.stem for g in 고른)]
    if not 씌움들:
        sys.exit(f'🔴 {a.마스코트} 의 씌움 그림이 없다 — docs/Loom_자산/옷/씌움/')

    꼴 = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 22)
    줄들 = []
    for 씌 in 씌움들:
        이름 = 씌.stem.split('_', 2)[2]
        얹 = 옷방 / '얹음' / 씌.name
        왼 = 잘라(흰바탕(Image.open(씌).convert('RGB')))
        오 = 잘라(흰바탕(Image.open(얹).convert('RGBA'))) if 얹.exists() else None
        칸 = []
        for 라벨, im in ((f'{이름} · 씌움(제미나이 통그림)', 왼), (f'{이름} · 얹음(조각)', 오)):
            if im is None:
                칸.append((라벨 + ' — 없다', Image.new('RGB', (a.높이, a.높이), (240, 240, 240))))
                continue
            im = im.copy()
            im.thumbnail((a.높이, a.높이), Image.LANCZOS)
            칸.append((라벨, im))
        줄들.append(칸)

    여백, 글높 = 14, 30
    폭 = max(sum(i.width for _, i in 줄) + 여백 * 3 for 줄 in 줄들)
    높 = sum(max(i.height for _, i in 줄) + 글높 + 여백 for 줄 in 줄들) + 여백
    판 = Image.new('RGB', (폭, 높), (250, 249, 246))
    그림 = ImageDraw.Draw(판)
    y = 여백
    for 줄 in 줄들:
        x = 여백
        줄높 = max(i.height for _, i in 줄)
        for 라벨, im in 줄:
            그림.text((x, y), 라벨, font=꼴, fill=(60, 58, 55))
            판.paste(im, (x, y + 글높))
            x += im.width + 여백
        y += 줄높 + 글높 + 여백
    Path(a.낼곳).parent.mkdir(parents=True, exist_ok=True)
    판.save(a.낼곳, quality=88, method=6)
    print(f'✅ {a.낼곳} — {len(줄들)}벌 · {판.width}×{판.height}')


if __name__ == '__main__':
    main()
