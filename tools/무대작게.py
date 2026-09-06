"""라디오 무대 배경을 «방송이 쓸 크기»로 줄인다 (2026-09-06 · 0원).

■ 왜 있나
  구운 무대는 4096² PNG 라 한 장이 20MB 다. 무대 층은 브라우저가 일곱 장을 들고 있다가
  결(곡 장르)이 바뀔 때 겹쳐 넘기므로, 원본을 그대로 쓰면 방송 기계가 140MB 를 물고 있게 된다.
  화면은 1920×1080 이고 천천히 1.09 배까지 당기므로 2048 이면 넉넉하다.

■ 어디에 내나
  `docs/Loom_자산/무대/<결>.webp` — 이 폴더는 **git 에 들어간다**(작아서 들어갈 수 있고,
  송출 기계가 저장소만 받아도 화면이 서야 한다). 4096 원본은 git 밖이다(.gitignore).

■ 지키는 것
  네모를 «안 자른다». 정사각 그대로 내고, 16:9 로 자르는 일은 화면이 한다(`object-fit: cover`).
  여기서 자르면 무대마다 다른 곳이 잘려 나가 화면이 못 고른다.

쓰는 법: python tools/무대작게.py [--크기 2048]
"""
import argparse
from pathlib import Path

from PIL import Image

루트 = Path(__file__).resolve().parent.parent
든곳 = 루트 / 'docs/Loom_자산/구움'
낼곳 = 루트 / 'docs/Loom_자산/무대'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--크기', type=int, default=2048)
    a = ap.parse_args()
    낼곳.mkdir(parents=True, exist_ok=True)
    했다, 잰바이트 = 0, 0
    for p in sorted(든곳.glob('라디오무대_*.png')):
        결 = p.stem.replace('라디오무대_', '')
        im = Image.open(p).convert('RGB')
        작 = im.resize((a.크기, a.크기), Image.LANCZOS)
        낼 = 낼곳 / (결 + '.webp')
        작.save(낼, quality=86, method=6)
        했다 += 1
        잰바이트 += 낼.stat().st_size
        print(f'  {결} — {낼.stat().st_size/1024:.0f}KB')
    print(f'✅ {했다}장 · {a.크기}² · 합계 {잰바이트/1024/1024:.1f}MB · {낼곳}')


if __name__ == '__main__':
    main()
