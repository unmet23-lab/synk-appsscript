"""마스코트 정본 컷의 «틀»을 하나로 맞춘다 (2026-09-05).

왜 있나 (유호 지시 09-05 「정본으로 세우고 틀도 맞춰줘」):
  제미나이가 낸 컷은 장마다 «찍힌 거리»가 다르다. 배경을 걷고 나면 크기도 제각각이라
  (몽글 2,3천~2,9천 · 까몽 3,1천~3,9천), 앱에서 표정을 갈아 끼울 때 인형이 «튄다».
  눈감음으로 바뀌는 순간 몸이 커지거나 자리가 옮겨지면 그건 깜빡임이 아니라 사고로 보인다.

무엇을 맞추나 — 셋:
  ⓐ 판 크기: 전부 같은 정사각(기본 4096).
  ⓑ 몸 크기: «불투명한 점의 개수»로 잰다. 넓이는 길이의 제곱이므로 √(넓이)가 길이에 비례한다.
     🔑 테두리 상자(bounding box)로 재지 않는 까닭 = 까몽은 꼬리가 뻗은 방향이 장마다 달라서
        상자가 들쭉날쭉하다. 넓이는 꼬리 위치가 바뀌어도 거의 안 변한다.
  ⓒ 자리: 불투명한 점들의 «무게중심»을 판 한가운데에 둔다.

무엇을 안 하나 — 인물끼리는 안 맞춘다. 몽글과 까몽은 생김새가 달라 같은 자로 재면 둘 다 어긋난다.
  그래서 «같은 인물의 컷끼리»만 맞춘다.

사용:
  python tools/마스코트틀맞추기.py docs/캐릭터/정본_4K_후보 --낼곳 docs/캐릭터/정본_4K
  python tools/마스코트틀맞추기.py <폴더> --판 4096 --몸비율 0.72
"""
import argparse
import glob
import os
import re

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def 재기(경로):
    """그림 하나에서 «불투명 넓이»와 «무게중심»을 잰다."""
    im = Image.open(경로).convert('RGBA')
    a = np.array(im)[:, :, 3].astype(np.float32) / 255.0
    넓이 = float(a.sum())                      # 반투명은 그 값만큼만 센다
    if 넓이 <= 0:
        raise ValueError(f'전부 투명하다 — {경로}')
    ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    cx = float((xs * a).sum() / 넓이)
    cy = float((ys * a).sum() / 넓이)
    return im, 넓이, cx, cy


def 맞추다(파일들, 판, 몸비율):
    """같은 인물의 컷들을 한 틀에 맞춘다. 되돌려주는 것 = [(경로, 새그림)]."""
    잰것 = [재기(p) for p in 파일들]
    넓이들 = [x[1] for x in 잰것]
    기준넓이 = float(np.median(넓이들))        # 가운데 값에 맞춘다 — 한 장이 튀어도 안 끌려간다

    """몸이 판에서 차지할 «길이»를 정한다. √(기준넓이)가 그 인물의 대표 길이다.
    🔴 배율은 «컷마다 다르다» — 찍힌 거리가 장마다 달라서 원본 크기가 제각각이기 때문이다.
       한 무리에 같은 배율을 먹이면 그 차이가 그대로 남는다(09-05 에 한 번 그렇게 짰다가 고쳤다).
       각자 제 넓이로 나누어야 «결과»의 넓이가 다 같아진다 — 그것이 맞추는 일이다."""
    목표길이 = 판 * 몸비율
    결과 = []
    for (im, 넓이, cx, cy), 경로 in zip(잰것, 파일들):
        배 = 목표길이 / (넓이 ** 0.5)          # 제 넓이로 나눈다 ⇒ 결과 넓이가 전부 같아진다
        새w, 새h = max(1, round(im.width * 배)), max(1, round(im.height * 배))
        작은 = im.resize((새w, 새h), Image.LANCZOS)
        바탕 = Image.new('RGBA', (판, 판), (0, 0, 0, 0))
        바탕.alpha_composite(작은, (round(판 / 2 - cx * 배), round(판 / 2 - cy * 배)))
        결과.append((경로, 바탕, 배, 넓이))
    return 결과, 기준넓이


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('폴더', help='누끼 파일들이 있는 폴더')
    ap.add_argument('--낼곳', required=True, help='맞춘 판을 쓸 폴더')
    ap.add_argument('--판', type=int, default=4096, help='판 한 변(px)')
    ap.add_argument('--몸비율', type=float, default=0.72,
                    help='판 한 변 대비 몸의 대표 길이(√넓이). 클수록 꽉 찬다')
    a = ap.parse_args()

    파일들 = sorted(glob.glob(os.path.join(a.폴더, '*_누끼.png')))
    if not 파일들:
        raise SystemExit(f'누끼 파일이 없다 — {a.폴더}/*_누끼.png')

    """인물별로 가른다 — 파일 이름 맨 앞 덩어리가 인물이다(몽글_본체_누끼.png)."""
    무리 = {}
    for p in 파일들:
        누구 = re.split(r'[_]', os.path.basename(p))[0]
        무리.setdefault(누구, []).append(p)

    os.makedirs(a.낼곳, exist_ok=True)
    print(f'■ 틀 맞추기 — {len(파일들)}장 · 판 {a.판}×{a.판} · 몸비율 {a.몸비율}')
    for 누구, 목록 in sorted(무리.items()):
        결과, 기준 = 맞추다(목록, a.판, a.몸비율)
        print(f'  ▸ {누구} {len(목록)}장 · 기준 넓이 {기준:,.0f}점 (√ = {기준 ** 0.5:,.0f}px)')
        for 경로, 그림, 배, 넓이 in 결과:
            이름 = os.path.basename(경로).replace('_누끼', '')
            낼 = os.path.join(a.낼곳, 이름)
            그림.save(낼, optimize=True)
            튐 = (넓이 / 기준) ** 0.5
            표 = '✅' if abs(튐 - 1) < 0.25 else '⚠'
            print(f'     {표} {이름}  배율 {배:.3f} · 원래 크기가 기준의 {튐 * 100:.0f}%')
    print(f'■ 다 됐다 → {a.낼곳}')


if __name__ == '__main__':
    main()
