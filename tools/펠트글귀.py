"""펠트 글귀 — 낱말마다 «다른 천»으로 오려 한 줄로 붙인다 (2026-09-07 · 유호 지시).

왜 생겼나: `tools/펠트글자.py` 는 한 글귀를 «한 천»으로만 오린다. 그런데 카드의 「16 + 1」은
  숫자와 «+»의 천이 달라야 한다 — «+»가 브랜드 코랄이라 그 자리만 신호다.
  글자를 따로 오려 지면(HTML)에서 나란히 놓으면 조각마다 여백이 달라 정렬이 어긋난다.
  그래서 «붙이는 일»을 그림 쪽에서 끝내고, 지면은 한 장만 받는다.

무엇을 하나:
  ① 조각마다 펠트글자.py 를 불러 오린다(천·크기가 조각마다 다를 수 있다)
  ② 실제 그림이 있는 데까지 잘라낸다(오릴 때 붙는 여백을 걷는다)
  ③ 기준선을 맞춰 한 줄로 붙인다 — 큰 조각은 아래를 맞추고, 작은 조각(«+»·«·» 같은
     사이 기호)은 가운데를 맞춘다. 사람이 글자를 쓸 때와 같은 자리다.

🔑 «작은 조각»의 자는 높이다 — 가장 큰 조각의 0.75 배 아래면 가운데 맞춤으로 본다.
   그래야 «+»는 가운데, 숫자는 아래로 간다. 규칙을 조각 이름으로 잡으면 기호가 늘 때마다
   목록을 고쳐야 하고, 그 목록은 조용히 낡는다.

쓰기:
  python tools/펠트글귀.py --조각 "16:공방_모래펠트.png" "+:공방_코랄펠트.png:150" "1:공방_모래펠트.png" \\
                          --크기 220 --낼곳 out.png
  (조각은 «글:천» 또는 «글:천:크기». 크기를 안 주면 --크기 를 쓴다.)
"""
import argparse
import os
import subprocess
import sys
import tempfile

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
오리는자 = os.path.join(ROOT, 'tools', '펠트글자.py')


def 오리기(글, 천, 크기, 자간, 씨):
    """펠트글자.py 로 한 조각을 오리고, 그림이 실제로 있는 데까지 잘라 돌려준다."""
    fd, 임시 = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    환경 = dict(os.environ, PYTHONIOENCODING='utf-8')
    # 🔑 encoding 을 못 박는다 — 윈도에서 기본이 cp949 라, 오리는 자가 한글이나 ✅ 를
    #    찍는 순간 «읽다가» 죽는다. 그림은 이미 나왔는데 오류만 뜨는 모양이 된다(09-07 실측).
    r = subprocess.run([sys.executable, 오리는자, 글, '--천', 천, '--크기', str(크기),
                        '--자간', str(자간), '--씨', str(씨), '--낼곳', 임시],
                       capture_output=True, text=True, encoding='utf-8', errors='replace',
                       env=환경)
    if not os.path.exists(임시) or os.path.getsize(임시) == 0:
        sys.exit(f'🔴 «{글}» 를 못 오렸다: {(r.stderr or r.stdout or "").strip()[-300:]}')
    im = Image.open(임시).convert('RGBA')
    im = im.crop(im.getbbox())          # 여백을 걷는다 — 안 걷으면 조각마다 사이가 들쭉날쭉하다
    im.load()
    os.unlink(임시)
    return im


def 붙이기(조각들, 틈비율=0.12, 작은자=0.75):
    """조각들을 한 줄로. 큰 것은 아래를 맞추고 작은 것(사이 기호)은 가운데를 맞춘다."""
    최고 = max(im.height for im in 조각들)
    틈 = int(round(최고 * 틈비율))
    W = sum(im.width for im in 조각들) + 틈 * (len(조각들) - 1)
    판 = Image.new('RGBA', (W, 최고), (0, 0, 0, 0))
    x = 0
    for im in 조각들:
        가운데 = im.height < 최고 * 작은자
        y = (최고 - im.height) // 2 if 가운데 else (최고 - im.height)
        판.alpha_composite(im, (x, y))
        x += im.width + 틈
    return 판


def main():
    ap = argparse.ArgumentParser(description='낱말마다 다른 천으로 오려 한 줄로 붙인다')
    ap.add_argument('--조각', nargs='+', required=True,
                    help='«글:천» 또는 «글:천:크기». 예) "16:공방_모래펠트.png" "+:공방_코랄펠트.png:150"')
    ap.add_argument('--크기', type=int, default=220, help='조각이 제 크기를 안 주면 쓸 기본 크기')
    ap.add_argument('--자간', type=float, default=0.03, help='조각 «안»의 낱자 사이')
    ap.add_argument('--틈', type=float, default=0.12, help='조각 «사이»를 가장 큰 조각 높이의 몇 배로')
    ap.add_argument('--씨', type=int, default=0, help='보풀 난수 씨앗(같은 값이면 같은 보풀)')
    ap.add_argument('--낼곳', required=True)
    a = ap.parse_args()

    조각들 = []
    for i, 조각 in enumerate(a.조각):
        칸 = 조각.split(':')
        if len(칸) < 2:
            sys.exit(f'🔴 조각 꼴이 «글:천» 이어야 한다 — 받은 것: {조각}')
        글, 천 = 칸[0], 칸[1]
        크기 = int(칸[2]) if len(칸) > 2 else a.크기
        조각들.append(오리기(글, 천, 크기, a.자간, a.씨 + i))

    판 = 붙이기(조각들, 틈비율=a.틈)
    os.makedirs(os.path.dirname(os.path.abspath(a.낼곳)) or '.', exist_ok=True)
    판.save(a.낼곳)
    KB = os.path.getsize(a.낼곳) // 1024
    print(f'✅ {a.낼곳}  {판.width}x{판.height}  {KB}KB  · 조각 {len(조각들)}')


if __name__ == '__main__':
    main()
