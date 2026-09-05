"""펠트 글자 오리기 — 브랜드 글씨체로 모양을 뜨고 그 모양대로 «구운 펠트 천»을 자른다 (2026-09-05).

왜 있나 (유호 확정 09-05):
  한글은 «굽는 길»과 «오리는 길»을 갈라 쓴다. 짧은 낱말·제목은 제미나이로 굽고(명품),
  긴 글·자유로운 글자는 이 도구가 천을 오려 만든다(돈 0 · 글자 수 무한).
  🔴 다 굽지 못하는 까닭: 조합형으로 최소만 잡아도 초성 8×19 + 중성 4×21 + 종성 4×27 = 344자이고,
     제미나이는 같은 결로 다시 못 내므로 자모끼리 굵기·질감이 갈려 글자가 어색해진다.

무엇을 하나 — 오려 «붙인» 것처럼 보이게 네 층을 쌓는다:
  ① 그림자   천 두께가 만드는 그늘(아래로 조금)
  ② 보풀     자른 자리에서 삐져나온 섬유(모양을 여러 방향으로 조금씩 밀어 겹친다)
  ③ 몸       글자 모양대로 자른 천
  ④ 잘린 단  가장자리가 밝게 서는 결(위쪽만 살짝)

⚠ 천 그림에는 «결의 방향»이 있다. 글자마다 천의 다른 자리를 쓰면 한 줄 안에서 결이 갈려
  「오려 붙인 한 벌」로 안 읽힌다. 그래서 한 줄은 «천 한 장»에서 통째로 잘라 낸다.

쓰기:
  python tools/펠트글자오리기.py "정원은 16명" --천 코랄 --낸곳 docs/공방/글자시험.png
  python tools/펠트글자오리기.py "선생님은 17명입니다" --천 먹색 --크기 300 --바탕 크림
"""
import argparse
import io
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

뿌리 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
천방 = os.path.join(뿌리, 'docs/Loom_자산/구움')
글씨체 = os.path.join(뿌리, 'docs/브랜드_폰트/SUIT/SUIT-Heavy.otf')

바탕색 = {
    '크림': (251, 247, 240),
    '종이': (251, 247, 240),
    '먹': (43, 35, 32),
    '없음': None,
}


def 천열기(이름):
    for 꼴 in ('.png', '.webp', '.avif'):
        p = os.path.join(천방, '공방_%s%s' % (이름, 꼴))
        if os.path.exists(p):
            return Image.open(p).convert('RGB')
    sys.exit('그 천이 없다: 공방_%s.png — 먼저 구워야 한다' % 이름)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('글')
    ap.add_argument('--천', default='코랄')
    ap.add_argument('--크기', type=int, default=320, help='글자 크기(px)')
    ap.add_argument('--바탕', default='크림', choices=list(바탕색))
    ap.add_argument('--여백', type=int, default=90)
    # ✅ 결 900 = 유호 확정 09-05(성글게 1400 · 촘촘하게 520 과 나란히 보시고 가운데를 고르셨다).
    #   1400 은 색면처럼 납작하고, 520 은 획 안이 얼룩져 작은 글자에서 지저분해진다.
    ap.add_argument('--결', type=int, default=900,
                    help='천을 이 폭으로 줄여 쓴다 — 작을수록 섬유가 잘고 촘촘하다(0=원래 배율)')
    ap.add_argument('--낸곳', default='docs/공방/글자_오림.png')
    args = ap.parse_args()

    천 = 천열기(args.천)
    font = ImageFont.truetype(글씨체, args.크기)

    # ── 글자 모양(마스크)을 먼저 뜬다 ──────────────────────────
    임시 = Image.new('L', (10, 10))
    상자 = ImageDraw.Draw(임시).textbbox((0, 0), args.글, font=font)
    글폭, 글높 = 상자[2] - 상자[0], 상자[3] - 상자[1]
    W = 글폭 + args.여백 * 2
    H = 글높 + args.여백 * 2

    모양 = Image.new('L', (W, H), 0)
    ImageDraw.Draw(모양).text((args.여백 - 상자[0], args.여백 - 상자[1]),
                              args.글, font=font, fill=255)

    # ── 천을 한 장에서 통째로 — 결이 한 줄 안에서 안 갈리게 ────
    # 🔴 늘리지 않는다(09-05 실물): 4096² 천을 2914×381 로 «맞추면» 섬유가 가로로 늘어나
    #   결이 통째로 사라지고 글자가 색면처럼 납작해진다. 원래 배율에서 «잘라» 쓴다.
    #   천이 모자라면 그때만 이어 붙인다(가로로 뒤집어 이어 이음매를 안 보이게).
    # 🔴 결의 «배율»이 이 도구의 급소다(09-05 실물 둘을 태워 알았다).
    #   천 사진은 아주 가까이 찍은 것이라(4096px 이 손바닥만 한 천), 원래 배율로 자르면
    #   글자 한 자에 섬유가 몇 올만 들어가 색면처럼 납작해진다. 그래서 천을 «줄여» 촘촘하게 만든다.
    #   --결 이 그 배율이다: 작을수록 섬유가 잘고 촘촘하다. 200px 글자에 900 이 눈으로 맞았다.
    if args.결 and args.결 < 천.width:
        천 = 천.resize((args.결, round(천.height * args.결 / 천.width)), Image.LANCZOS)
    천s = Image.new('RGB', (W, H))
    tw, th = 천.size
    for y in range(0, H, th):
        for x in range(0, W, tw):
            조각 = 천 if (x // tw) % 2 == 0 else 천.transpose(Image.FLIP_LEFT_RIGHT)
            if (y // th) % 2 == 1:
                조각 = 조각.transpose(Image.FLIP_TOP_BOTTOM)
            천s.paste(조각, (x, y))

    # ── 자른 자리를 섬유 따라 흔든다 ─────────────────────────────
    # 🔴 자로 그은 듯 매끈한 가장자리는 «천에 인쇄한 글자»로 읽힌다(09-05 실물).
    #   진짜 가위질은 섬유를 따라가며 미세하게 어긋난다. 그래서 흔드는 재료를 «그 천 자신»에서 뽑는다
    #   — 결이 굵은 자리는 더 어긋나고 고운 자리는 덜 어긋나, 흔들림이 천과 한 몸이 된다.
    # 방법: 글자 모양을 «흐리게» 만들어 가장자리에 폭 몇 px 의 기울기를 만든 뒤,
    #   그 기울기를 «천의 결»로 만든 문턱에 대고 자른다. 결이 밝은 자리는 조금 더 남고
    #   어두운 자리는 조금 더 깎여, 자른 선이 섬유를 따라 어긋난다.
    # ⚠ 앞선 판은 더하기·빼기를 겹쳐 서로 상쇄돼 «아무 일도 안 일어났다»(09-05 실물).
    #   자르는 자리는 하나여야 한다 — 문턱 하나로 끝낸다.
    폭 = max(1.4, args.크기 / 90)                     # 글자가 클수록 가위질도 크게 어긋난다
    번짐 = 모양.filter(ImageFilter.GaussianBlur(폭))
    결 = 천s.convert('L')
    결 = ImageChops.subtract(결, 결.filter(ImageFilter.GaussianBlur(6)), scale=1, offset=128)
    문턱 = 결.point(lambda v: max(60, min(196, 128 + (v - 128) * 2)))
    모양 = Image.eval(ImageChops.subtract(번짐, 문턱, scale=1, offset=128),
                      lambda v: 0 if v < 128 else 255)
    모양 = 모양.filter(ImageFilter.GaussianBlur(0.6))

    바 = 바탕색[args.바탕]
    판 = Image.new('RGBA', (W, H), (바[0], 바[1], 바[2], 255) if 바 else (0, 0, 0, 0))

    # ① 그림자 — 천 «두께»가 만드는 그늘. 두 겹으로 나눈다.
    # 🔴 한 겹으로 넓게 깔면 획 사이에 그늘이 «고인다»(09-05 실물 — 글자가 얼룩져 보였다).
    #   붙인 천의 그늘은 실제로 둘이다: 맞닿은 자리의 좁고 진한 그늘 + 멀리 옅게 퍼지는 그늘.
    #   그리고 글자 «밖»에만 남긴다 — 안쪽에 남으면 획이 탁해진다.
    def 그늘층(흐림, 아래, 짙기):
        g = 모양.filter(ImageFilter.GaussianBlur(흐림))
        g = ImageChops.offset(g, 0, 아래)
        g = ImageChops.subtract(g, 모양)          # 글자 안쪽은 걷는다
        층 = Image.new('RGBA', (W, H), (43, 35, 32, 0))
        층.putalpha(g.point(lambda v: int(v * 짙기)))
        return 층
    판.alpha_composite(그늘층(2.2, 3, 0.30))      # 맞닿은 자리 — 좁고 진하게
    판.alpha_composite(그늘층(11, 9, 0.13))       # 멀리 — 넓고 아주 옅게

    # ② 보풀 — 자른 자리에서 삐져나온 섬유
    # ⚠ 넓게·짙게 깔면 «후광»이 된다(09-05 실물 — 글자가 빛나 보였다). 좁게·옅게.
    보풀 = Image.new('L', (W, H), 0)
    for dx, dy in [(2, 0), (-2, 0), (0, 2), (0, -2), (1, 1), (-1, -1), (1, -1), (-1, 1)]:
        보풀 = ImageChops.lighter(보풀, ImageChops.offset(모양, dx, dy))
    보풀 = ImageChops.subtract(보풀, 모양)          # 글자 «밖»에만 남긴다
    보풀 = 보풀.filter(ImageFilter.GaussianBlur(0.7)).point(lambda v: int(v * 0.5))
    털 = 천s.copy().convert('RGBA')
    털.putalpha(보풀)
    판.alpha_composite(털)

    # ③ 몸 — 글자 모양대로 자른 천
    몸 = 천s.copy().convert('RGBA')
    몸.putalpha(모양)
    판.alpha_composite(몸)

    # ④ 잘린 단 — 자른 자리가 아주 살짝 선다.
    # ⚠ 흰빛을 위쪽에 넓게 얹으면 «플라스틱 볼록»으로 읽힌다(09-05 실물). 얇게·옅게만.
    안쪽 = 모양.filter(ImageFilter.MinFilter(3))
    테 = ImageChops.subtract(모양, ImageChops.offset(안쪽, 0, 2))
    단 = Image.new('RGBA', (W, H), (255, 252, 246, 0))
    단.putalpha(테.point(lambda v: int(v * 0.12)))
    판.alpha_composite(단)

    낸곳 = os.path.join(뿌리, args.낸곳)
    os.makedirs(os.path.dirname(낸곳), exist_ok=True)
    (판.convert('RGB') if 바 else 판).save(낸곳)
    print('%s · %d×%d · 천 %s · 글자 %dpx' % (args.낸곳, W, H, args.천, args.크기))


if __name__ == '__main__':
    main()
