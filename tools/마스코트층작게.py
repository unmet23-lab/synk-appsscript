"""마스코트 컷을 «화면에 쓸 크기»로 줄인다 (2026-09-07 · 0원).

■ 왜 있나
  정본 컷은 4096² PNG 라 한 장이 11~16MB 다. 그런데 브라우저가 그림을 «펼쳐 놓는» 크기는
  파일 크기가 아니라 픽셀 수로 정해진다 — 4096×4096×4바이트 = **한 장에 67MB**.
  라디오 송출 층이 지금 싣는 13장만으로 이미 871MB 이고, 표정을 넷씩 더하면 1.6GB 가 된다.
  서버 램이 3.9GB 라 그대로 두면 층이 통째로 죽는다(그러면 방송 화면이 빈다).
  화면에 서는 마스코트는 길어야 400px 이라 1024 면 넉넉하다 — 한 장 4MB 로 16분의 1이 된다.

■ 어디에 내나
  `docs/캐릭터/화면_1024/<이름>.webp` — 옷 조각(`docs/Loom_자산/옷층/`)과 같은 규약이다.

■ 지키는 것
  네모를 «안 자른다». 몸과 옷이 같은 네모 안 같은 자리에 있어야 겹쳐 입힐 수 있고,
  액자 보정(마스코트.html `액자재기`)이 «몫»으로 재기 때문에 줄여도 자리가 안 흔들린다.

쓰는 법: python tools/마스코트층작게.py [--크기 1024]
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

루트 = Path(__file__).resolve().parent.parent
든곳 = 루트 / 'docs/캐릭터/정본_4K'
낼곳 = 루트 / 'docs/캐릭터/화면_1024'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--크기', type=int, default=1024)
    a = ap.parse_args()
    낼곳.mkdir(parents=True, exist_ok=True)
    했다 = 0
    든바이트 = 0
    난바이트 = 0
    판 = {}
    for p in sorted(든곳.glob('*.png')):
        im = Image.open(p).convert('RGBA')
        if im.width != im.height:
            print(f'⚠ {p.name} — 네모가 아니다 ({im.size}) · 그래도 같은 비율로 줄인다')
        작은 = im.resize((a.크기, round(a.크기 * im.height / im.width)), Image.LANCZOS)
        낼것 = 낼곳 / (p.stem + '.webp')
        작은.save(낼것, 'WEBP', quality=92, method=6)
        든바이트 += p.stat().st_size
        난바이트 += 낼것.stat().st_size
        판[p.stem] = {'원본': p.name, '크기': a.크기}
        했다 += 1
    (낼곳 / '판.json').write_text(json.dumps({
        '언제': datetime.now(timezone.utc).isoformat(),
        '크기': a.크기,
        '몇벌': 했다,
        '컷': 판,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'✅ {했다}벌 · {든바이트/1048576:.0f}MB → {난바이트/1048576:.0f}MB → {낼곳}')
    print(f'   브라우저가 펼쳐 놓는 몫: 한 장 {4096*4096*4/1048576:.0f}MB → {a.크기*a.크기*4/1048576:.0f}MB')


if __name__ == '__main__':
    main()
