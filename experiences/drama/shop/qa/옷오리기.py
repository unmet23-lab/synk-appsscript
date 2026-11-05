"""옷 상점 옷 사진 오리기 · 줄 맞추기 (2026-11-05).

흰 바탕에서 구운 옷걸이 사진(GPT 이미지 2.5, `옷굽기조립.mjs`) → 봉에 거는 투명 webp.

  1. rembg isnet-general-use로 오린다(tools/AI누끼.py와 같은 모델). 흰 셔츠 · 크림 니트가 바탕과 같이 깎이지 않는다.
  2. 은색 고리는 가늘어 모델이 자주 놓친다 — 옷걸이 위쪽 띠에서만 「흰 바탕보다 어두운 화소」로 고리를 되살린다.
  3. 모든 장을 같은 판(가로 W · 세로 H)에 같은 배율로 얹고, 고리 끝은 같은 높이, 옷의 좌우 대칭축은 가운데로 맞춘다.
     배율을 장마다 바꾸지 않는다 — 같은 지시문 · 같은 화면 비율로 구웠으므로 원래 크기 차이가 곧 옷 길이 차이다.
  4. 앞 · 뒤 판은 같은 옷이 같은 자리에 있어야 돌릴 때 튀지 않는다 — 뒤는 앞의 고리 끝 · 축을 그대로 쓰지 않고
     제 고리 끝 · 축으로 맞춘다(같은 기준점에 오므로 결과가 겹친다).

사용:
  python -I -X utf8 experiences/drama/shop/qa/옷오리기.py <판폴더> <출력폴더> [--보기]
  판폴더의 shop-outfit-<id>-front_*.png · shop-outfit-<id>-back_*.png(같은 id면 가장 늦은 판)를 읽어
  출력폴더/<id>-front.webp · <id>-back.webp 와 정리표 옷판.json 을 쓴다.
"""
import argparse
import glob
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

뿌리 = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(뿌리, 'tools'))
from AI누끼 import 세션, 걷기  # noqa: E402

판W, 판H = 760, 1040       # 봉에 거는 판(투명). 옷걸이 폭이 판의 절반쯤
고리Y = 26                 # 고리 끝이 닿는 높이(px)
배율 = 0.70                # 원본(1086×1448) → 판. 트렌치(가장 긴 옷)가 판 안에 들어오게


def 판고르기(폴더):
    판 = {}
    for f in sorted(glob.glob(os.path.join(폴더, 'shop-outfit-*.png'))):
        m = re.match(r'shop-outfit-([a-z]+)(?:-(front|back))?_(\d+)', os.path.basename(f))
        if not m:
            continue
        id_, 쪽 = m.group(1), m.group(2) or 'front'
        때 = os.path.getmtime(f)  # 판 이름의 시각은 시분초뿐이라 날을 넘기면 어제 판을 고른다(현장노트 그림 굽기) — 파일 시각으로
        if (id_, 쪽) not in 판 or 판[(id_, 쪽)][0] < 때:
            판[(id_, 쪽)] = (때, f)
    return {k: v[1] for k, v in 판.items()}


def 고리살리기(원본, 알파):
    """옷 윗변보다 위쪽 띠에서 바탕보다 어두운 화소를 고리로 더한다."""
    회 = np.asarray(원본.convert('L'), dtype=np.float32)
    a = 알파.astype(np.float32)
    줄폭 = (a > 128).sum(axis=1)
    넓은줄 = np.where(줄폭 > 원본.width * 0.12)[0]
    if not len(넓은줄):
        return 알파
    옷위 = int(넓은줄[0])            # 옷걸이 나무 막대 · 어깨가 시작하는 줄
    띠 = slice(0, 옷위 + 6)
    어둠 = np.clip((246 - 회[띠]) / 40, 0, 1) * 255   # 흰 바탕 246 위로는 0, 206 아래로는 꽉
    더함 = a.copy()
    더함[띠] = np.maximum(a[띠], 어둠)
    # 띠 안에서도 옷걸이 가운데 근처만 — 구석의 먼지 · 그늘은 빼고
    가운데 = 원본.width // 2
    가림 = np.zeros_like(더함)
    가림[:, 가운데 - int(원본.width * 0.16): 가운데 + int(원본.width * 0.16)] = 1
    가림[옷위 + 6:, :] = 1
    return (더함 * 가림).clip(0, 255).astype(np.uint8)


def 기준점(알파):
    """고리 끝 높이와 돌림축.

    축은 고리 기둥(고리가 나무 막대로 들어가는 곧은 부분)의 가운데다 — 옷걸이는 고리 기둥에서 좌우 대칭이고,
    앞/뒤를 돌릴 때도 이 줄을 축으로 돈다. 옷 윤곽의 좌우 가운데는 셔츠 자락 · 소매가 한쪽으로 처지면 30~50px 어긋났다
    (니트 조끼 앞 판 486 대 뒤 540, 11-05).
    """
    보임 = 알파 > 128
    줄 = np.where(보임.any(axis=1))[0]
    끝 = int(줄[0])
    아래 = int(줄[-1])
    폭 = 보임.sum(axis=1)
    넓음 = np.where(폭 > 알파.shape[1] * 0.12)[0]
    막대 = int(넓음[0]) if len(넓음) else 끝 + 80   # 옷걸이 나무 막대 · 어깨가 시작하는 줄
    기둥 = range(끝 + int((막대 - 끝) * 0.62), max(막대 - 4, 끝 + 1))
    가운데들 = []
    for y in 기둥:
        xs = np.where(보임[y])[0]
        if len(xs) and xs[-1] - xs[0] < 40:   # 곧은 기둥만(굽은 고리 · 막대는 빼고)
            가운데들.append((xs[0] + xs[-1]) / 2)
    if 가운데들:
        축 = float(np.median(가운데들))
    else:
        넓은 = [((np.where(보임[y])[0][0] + np.where(보임[y])[0][-1]) / 2) for y in np.where(폭 > 알파.shape[1] * 0.25)[0]]
        축 = float(np.median(넓은)) if 넓은 else 알파.shape[1] / 2
    return 끝, 축, 아래


def 속채우기(원본, 알파):
    """rembg가 옷 속에 낸 반투명 구멍 · 놓친 옅은 색 소매를 메운다(11-05 실측).

    - 럭비 셔츠 줄무늬 한 줄이 통째로 반투명(알파 40~120)이 되어 바탕이 비쳤다 — 원본에는 없는 얼룩.
    - 니트 조끼 밑 하늘색 셔츠의 한쪽 소매가 반쯤 지워졌다(옅은 하늘색 ↔ 흰 바탕).
    그래서 ① 채도가 있는 화소(그늘은 무채색이라 빠진다)를 옷으로 더하고 ② 윤곽 안의 구멍을 채운다.
    구멍 가운데 원본이 흰 바탕 그대로인 곳(소매와 몸판 사이 틈)은 채우지 않는다.
    """
    from scipy import ndimage
    rgb = np.asarray(원본, dtype=np.int16)
    채도 = rgb.max(axis=2) - rgb.min(axis=2)
    밝기 = rgb.mean(axis=2)
    흰바탕 = (밝기 > 243) & (채도 < 6)
    a = 알파 > 128
    색 = (채도 > 14) & (밝기 < 248)
    색 = ndimage.binary_opening(색, iterations=2)
    # 색 덩어리는 이미 잡힌 옷과 닿은 것만(구석 얼룩 · 반사 빼기)
    lab, n = ndimage.label(a | 색)
    큰 = np.bincount(lab.ravel())
    큰[0] = 0
    옷 = lab == 큰.argmax() if n else a
    찬 = ndimage.binary_fill_holes(옷)
    채움 = (찬 & ~흰바탕) | 옷
    return np.maximum(알파, (채움 * 255).astype(np.uint8))


def 오리기(파일, s):
    원본 = Image.open(파일).convert('RGB')
    rgba = 걷기(원본, s)
    알파 = np.asarray(rgba.getchannel('A'))
    알파 = 속채우기(원본, 알파)
    알파 = 고리살리기(원본, 알파)
    # 테두리 1px 흰 테 줄이기: 알파를 조금 깎고 부드럽게
    a = Image.fromarray(알파).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    알파 = np.asarray(a)
    끝, 축, 아래 = 기준점(알파)
    out = 원본.copy()
    out.putalpha(Image.fromarray(알파))
    return out, 끝, 축, 아래


def 얹기(im, 끝, 축):
    w, h = int(im.width * 배율), int(im.height * 배율)
    작게 = im.resize((w, h), Image.LANCZOS)
    판 = Image.new('RGBA', (판W, 판H), (0, 0, 0, 0))
    x = round(판W / 2 - 축 * 배율)
    y = round(고리Y - 끝 * 배율)
    판.alpha_composite(작게, (max(x, 0), max(y, 0)), (max(-x, 0), max(-y, 0)))
    return 판, (x, y)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('판폴더')
    ap.add_argument('출력폴더')
    ap.add_argument('--보기', action='store_true', help='회색 바탕에 얹은 확인 판도 쓴다')
    a = ap.parse_args()
    os.makedirs(a.출력폴더, exist_ok=True)
    s = 세션()
    표 = {}
    for (id_, 쪽), f in sorted(판고르기(a.판폴더).items()):
        im, 끝, 축, 아래 = 오리기(f, s)
        판, (x, y) = 얹기(im, 끝, 축)
        아래판 = round(y + 아래 * 배율)
        if 아래판 > 판H - 4:
            print(f'! {id_}-{쪽}: 옷 끝이 판 밖({아래판} > {판H}) — 배율을 줄일 것')
        이름 = f'{id_}-{쪽}'
        판.save(os.path.join(a.출력폴더, 이름 + '.webp'), 'WEBP', quality=86, method=6)
        if a.보기:
            회 = Image.new('RGBA', 판.size, (214, 211, 204, 255))
            회.alpha_composite(판)
            회.convert('RGB').save(os.path.join(a.출력폴더, '_보기_' + 이름 + '.jpg'), quality=86)
        크기 = os.path.getsize(os.path.join(a.출력폴더, 이름 + '.webp'))
        표.setdefault(id_, {})[쪽] = {'원본': os.path.basename(f), '옷아래': 아래판, 'kb': round(크기 / 1024)}
        print(f'{이름}: 고리끝 {끝} · 축 {축:.0f} → 옷 아래 {아래판}px · {크기 // 1024}KB')
    with open(os.path.join(a.출력폴더, '옷판.json'), 'w', encoding='utf-8') as fp:
        json.dump({'판': [판W, 판H], '고리Y': 고리Y, '배율': 배율, '옷': 표}, fp, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
