"""옷 조각을 «화면에 쓸 크기»로 줄인다 (2026-09-06 · 0원).

■ 왜 있나
  떼어 낸 옷 조각은 4096² PNG 라 한 장이 20MB 다. 라디오 송출 오버레이는 브라우저가 열고
  OBS 가 매 프레임 합성하므로, 그 크기를 그대로 얹으면 방송이 무거워진다(셋을 겹치면 60MB).
  화면에 서는 마스코트는 길어야 400px 이라 1024 면 넉넉하다.

■ 어디에 내나
  `docs/Loom_자산/옷층/<쇠>.webp` — 이 폴더는 **git 에 들어간다**(작아서 들어갈 수 있고,
  송출 기계가 저장소만 받아도 화면이 서야 한다). 4096 원본은 git 밖이다(.gitignore).

■ 지키는 것
  네모를 «안 자른다». 몸과 같은 네모 안에서 같은 자리에 있어야 겹쳐 입힐 수 있다
  (자르는 순간 그 자리가 사라진다 — tools/흰배경걷기.py 의 `--그대로` 와 같은 까닭).

쓰는 법: python tools/옷층작게.py [--크기 1024]
"""
import argparse
from pathlib import Path

from PIL import Image

루트 = Path(__file__).resolve().parent.parent
든곳 = 루트 / 'docs/Loom_자산/옷/층'
낼곳 = 루트 / 'docs/Loom_자산/옷층'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--크기', type=int, default=1024)
    a = ap.parse_args()
    낼곳.mkdir(parents=True, exist_ok=True)
    했다 = 0
    잰바이트 = 0
    for p in sorted(든곳.glob('*.png')):
        im = Image.open(p).convert('RGBA')
        작 = im.resize((a.크기, a.크기), Image.LANCZOS)
        낼 = 낼곳 / (p.stem + '.webp')
        작.save(낼, quality=88, method=6)
        했다 += 1
        잰바이트 += 낼.stat().st_size
    print(f'✅ {했다}장 · {a.크기}² · 합계 {잰바이트/1024/1024:.1f}MB · {낼곳}')


if __name__ == '__main__':
    main()
