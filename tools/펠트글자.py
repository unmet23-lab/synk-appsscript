"""펠트 글자 — 굽지 않고 «오려서» 만든다 (2026-09-05 · 유호 확정).

왜 안 굽나: 한글은 글자 수가 사실상 무한이다(11,172자). 조합형으로 최소한만 잡아도
  초성 8벌×19 + 중성 4벌×21 + 종성 4벌×27 = 344자인데, 제미나이는 같은 결로 다시 못 내므로
  자모끼리 굵기·질감이 갈려 붙여 놓으면 글자가 어색해진다. 돈도 344장이면 11만 원이다.

무엇을 하나:
  ① 브랜드 폰트(SUIT)로 글자 모양을 낸다
  ② 그 모양대로 «이미 구운 펠트 천»을 오린다 — 천이 정본이라 결이 브랜드 것이다
  ③ 가장자리를 잡음으로 흔들어 «손으로 뜯은» 선으로 만든다
  ④ 위 왼쪽에서 빛이 든 것처럼 밝은 테와 아래 그늘을 줘 도톰해 보이게 한다

🔑 **땀(블랭킷 스티치)은 기본으로 안 넣는다**(09-05 실측). 숫자처럼 획이 굵으면 살지만
   한글은 획이 가늘어 땀이 글자를 덮어 «빗금»처럼 읽힌다. 큰 글자에만 `--땀` 으로 켠다.

🔑 **천을 «줄여» 쓴다.** 4096px 천을 그대로 잘라 쓰면 결이 하나도 안 보인다(첫 판의 병).
   `--천배율` 이 그 손잡이고, 0.22 면 4096px 천이 900px 로 줄어 결이 촘촘해진다.

⚠ 짧은 낱말·제목처럼 «명품이어야 하는 자리»는 이 도구 말고 제미나이로 굽는다
   (`node tools/공방굽기.js`). 이 도구는 «어떤 글자든 되는» 쪽을 맡는다.

쓰기:
  python tools/펠트글자.py "함께 자라요" --천 공방_라피스펠트.webp --낼곳 out.png
  python tools/펠트글자.py "한국어" --크기 300 --땀
  python tools/펠트글자.py --천목록
"""
import argparse
import glob
import math
import os
import random
import sys

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
방 = os.path.join(ROOT, 'docs', 'Loom_자산', '구움')
폰트기본 = os.path.join(ROOT, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Heavy.otf')


def 보풀(마스크, 세기=1.6, 성김=2, 힘=0.75):
    """칼로 자른 선을 손으로 뜯은 선으로. 성김이 작을수록 보풀이 곱다."""
    w, h = 마스크.size
    잡음 = Image.new('L', (max(w // 성김, 1), max(h // 성김, 1)))
    잡음.putdata([random.randint(0, 255) for _ in range(잡음.width * 잡음.height)])
    잡음 = 잡음.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.8))
    흐린 = 마스크.filter(ImageFilter.GaussianBlur(세기))
    fp, np_ = 흐린.load(), 잡음.load()
    새 = Image.new('L', (w, h))
    sp = 새.load()
    for y in range(h):
        for x in range(w):
            v = fp[x, y]
            if v < 4 or v > 251:
                sp[x, y] = 255 if v > 251 else 0
                continue
            sp[x, y] = 255 if v + (np_[x, y] - 128) * 힘 > 128 else 0
    return 새.filter(ImageFilter.GaussianBlur(0.5))


def _윤곽점들(마스크, 간격):
    안쪽 = 마스크.filter(ImageFilter.MinFilter(5))
    테 = ImageChops.difference(마스크, 안쪽)
    tp = 테.load()
    w, h = 테.size
    점, 쓴자리 = [], set()
    for y in range(h):
        for x in range(w):
            if tp[x, y] < 100:
                continue
            키 = (x // 간격, y // 간격)
            if 키 in 쓴자리:
                continue
            쓴자리.add(키)
            점.append((x, y))
    return 점


def 땀박기(글자, 마스크, 간격, 길이, 굵기, 실=(244, 232, 208)):
    """블랭킷 스티치 근사 — 테두리 점마다 «안쪽을 향한» 짧은 선.
    안쪽 방향은 마스크를 흐려 만든 거리장의 기울기로 잡는다(밝은 쪽이 안쪽)."""
    장 = 마스크.filter(ImageFilter.GaussianBlur(9))
    lp = 장.load()
    d = ImageDraw.Draw(글자)
    w, h = 마스크.size
    for (x, y) in _윤곽점들(마스크, 간격):
        if x < 2 or y < 2 or x > w - 3 or y > h - 3:
            continue
        gx = lp[x + 2, y] - lp[x - 2, y]
        gy = lp[x, y + 2] - lp[x, y - 2]
        n = math.hypot(gx, gy)
        if n < 1:
            continue
        ux, uy = gx / n, gy / n
        d.line([(x - ux * 2, y - uy * 2), (x + ux * 길이, y + uy * 길이)],
               fill=실 + (255,), width=굵기)
    return 글자


def 펠트글자(글, 천경로, 크기=200, 여백=44, 천배율=0.22, 땀=False, 폰트=폰트기본):
    f = ImageFont.truetype(폰트, 크기)
    bb = ImageDraw.Draw(Image.new('L', (8, 8))).textbbox((0, 0), 글, font=f)
    W, H = bb[2] - bb[0] + 여백 * 2, bb[3] - bb[1] + 여백 * 2
    깔끔 = Image.new('L', (W, H), 0)
    ImageDraw.Draw(깔끔).text((여백 - bb[0], 여백 - bb[1]), 글, font=f, fill=255)
    마스크 = 보풀(깔끔)

    천 = Image.open(천경로).convert('RGB')
    작게 = (max(int(천.width * 천배율), W), max(int(천.height * 천배율), H))
    천 = 천.resize(작게, Image.LANCZOS)
    ox = random.randint(0, max(천.width - W, 0))
    oy = random.randint(0, max(천.height - H, 0))
    천 = 천.crop((ox, oy, ox + W, oy + H))

    검정 = Image.new('RGB', (W, H), (0, 0, 0))
    글자 = Image.composite(천, 검정, 마스크).convert('RGBA')
    글자.putalpha(마스크)

    밝은테 = ImageChops.subtract(마스크, 마스크.transform(
        (W, H), Image.AFFINE, (1, 0, 3, 0, 1, 3), Image.BILINEAR))
    그늘테 = ImageChops.subtract(마스크, 마스크.transform(
        (W, H), Image.AFFINE, (1, 0, -3, 0, 1, -4), Image.BILINEAR))
    빛 = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    빛.putalpha(밝은테.filter(ImageFilter.GaussianBlur(2)).point(lambda v: int(v * 0.30)))
    어둠 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    어둠.putalpha(그늘테.filter(ImageFilter.GaussianBlur(2)).point(lambda v: int(v * 0.34)))
    글자.alpha_composite(빛)
    글자.alpha_composite(어둠)

    if 땀:
        글자 = 땀박기(글자, 마스크, max(int(크기 * 0.20), 18),
                     max(int(크기 * 0.028), 4), max(int(크기 * 0.011), 2))
        글자.putalpha(ImageChops.lighter(글자.getchannel('A'), 마스크))

    그늘 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    그늘.putalpha(마스크.filter(ImageFilter.GaussianBlur(7)).point(lambda v: int(v * 0.40)))
    바닥 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    바닥.paste(그늘, (3, 6), 그늘)
    바닥.alpha_composite(글자)
    return 바닥


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('글', nargs='?', help='만들 글자·낱말')
    ap.add_argument('--천', default='공방_라피스펠트.webp', help=f'{방} 안의 천 파일 이름')
    ap.add_argument('--낼곳', help='낼 파일 경로(기본 = 글자.png)')
    ap.add_argument('--크기', type=int, default=200, help='글자 크기(px). 기본 200')
    ap.add_argument('--천배율', type=float, default=0.22,
                    help='천을 이 배율로 줄여 쓴다. 작을수록 결이 촘촘하다. 기본 0.22')
    ap.add_argument('--땀', action='store_true',
                    help='테두리에 블랭킷 스티치를 박는다. ⚠ 한글은 획이 가늘어 글자를 덮는다 — 큰 글자에만')
    ap.add_argument('--폰트', default=폰트기본)
    ap.add_argument('--씨', type=int, default=0, help='보풀 난수 씨앗(같은 값이면 같은 보풀)')
    ap.add_argument('--천목록', action='store_true', help='쓸 수 있는 천을 보여준다(0원)')
    a = ap.parse_args()

    if a.천목록:
        천들 = sorted(glob.glob(os.path.join(방, '*펠트*')) +
                     glob.glob(os.path.join(방, '공방_*천*')) +
                     glob.glob(os.path.join(방, '공방_코듀로이*')) +
                     glob.glob(os.path.join(방, '공방_데님*')) +
                     glob.glob(os.path.join(방, '공방_리넨*')))
        print(f'■ 쓸 수 있는 천 {len(천들)}장')
        for p in 천들:
            print('   ' + os.path.basename(p))
        return

    if not a.글:
        sys.exit('🔴 만들 글자를 달라 — python tools/펠트글자.py "함께 자라요"')

    random.seed(a.씨)
    천경로 = a.천 if os.path.isabs(a.천) else os.path.join(방, a.천)
    if not os.path.exists(천경로):
        sys.exit(f'🔴 천이 없다 — {천경로}\n   있는 것을 보려면 --천목록')

    im = 펠트글자(a.글, 천경로, 크기=a.크기, 천배율=a.천배율, 땀=a.땀, 폰트=a.폰트)
    낼곳 = a.낼곳 or (a.글.replace(' ', '_') + '.png')
    im.save(낼곳)
    print(f'✅ {낼곳}  {im.size[0]}x{im.size[1]}  {os.path.getsize(낼곳) // 1024}KB'
          f'  · 천 {os.path.basename(천경로)}' + (' · 땀 있음' if a.땀 else ''))


if __name__ == '__main__':
    main()
