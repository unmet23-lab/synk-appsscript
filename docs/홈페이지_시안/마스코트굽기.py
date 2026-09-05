# -*- coding: utf-8 -*-
"""홈페이지 시안의 마스코트 두 판을 «정본에서» 굽는다.

왜 도구가 됐나 (08-28):
  이 폴더에는 08-07 에 손으로 복사해 둔 webp 세 장이 살고 있었다 — 퇴역한 레진 마스코트다.
  정본은 펠트 세트(당시 `docs/캐릭터/펠트코랄_0815` · 09-05 부터 `docs/캐릭터/정본_4K`)인데
  홈페이지만 옛 몸을 싣고 있었고, 시안 머리말의
  「마스코트 교체 전 재작업 금지」 동결이 **3주간** 그 자리에 걸려 있었다.
  손으로 다시 복사하면 그 동결이 다음 마스코트 때 또 선다 — 그래서 «복사»를 «굽기»로 바꾼다.

  🔑 경로는 여기 안 적는다. `tools/lib/마스코트자산.js` 가 주인이고 그 모듈에 «묻는다»
     (주인이 둘이 되면 마스코트 10벌 사고가 재현된다 · `가이드아바타굽기.py` 와 같은 문법).

무엇을 내나
  · `마스코트_점눈.webp` / `마스코트_웃음.webp` — 같은 상자로 자른 두 판(포개면 정확히 겹친다)
  · `마스코트좌표.json` — 눈(구슬) 중심 백분율. 다크 모드 «눈빔»이 이 좌표에서 나간다.
    ⚠ 이 수를 CSS 에 손으로 적지 않는다 — 마스코트가 바뀌면 눈도 옮겨 가는데, 손으로 적은
      좌표는 안 따라와서 빔이 뺨에서 나가게 된다. `빌드.js` 가 이 파일을 읽어 틀에 넣는다.

쓰기: python docs/홈페이지_시안/마스코트굽기.py       (보통은 빌드.js 가 알아서 부른다)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

여기 = Path(__file__).resolve().parent
루트 = 여기.parent.parent
노드 = r'C:\Program Files\nodejs\node.exe'

# 몸이 «틀에서 차지하는 가로 비율». 퇴역 레진판 실측값(450/740 = 0.608)을 그대로 물려받는다 —
# 마스코트만 갈아 끼우는 일이라 히어로의 «보이는 크기»가 흔들리면 안 된다(그건 다른 판정이다).
몸비율 = 0.608
변 = 840          # 표시 최대 420px 의 2배 — 고밀도 화면까지 덮는다
품질 = 82
판 = [('본체', '마스코트_점눈.webp'), ('눈웃음', '마스코트_웃음.webp')]


def 정본경로(표현: str) -> Path:
    """마스코트자산 모듈에 «어느 파일인가»를 묻는다 — 경로를 여기 적지 않는다."""
    js = ("const a=require('./tools/lib/마스코트자산.js');"
          f"process.stdout.write(a.경로({표현!r},{{누끼:true}}));")
    r = subprocess.run([노드, '-e', js], cwd=str(루트),
                       capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise SystemExit('마스코트자산 모듈이 경로를 안 준다: ' + (r.stderr or '').strip())
    p = 루트 / r.stdout.strip()
    if not p.exists():
        raise SystemExit(f'모듈이 준 경로에 파일이 없다: {p}')
    return p


def 몸상자(a):
    """알파로 몸을 찾는다. 조용한 폴백을 안 만든다 — 못 찾으면 그 자리에서 깨진다."""
    ys, xs = np.nonzero(a[:, :, 3] > 24)
    if not len(xs):
        raise SystemExit('알파가 통째로 비었다 — 누끼 판이 아닌 것을 받았다')
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def 눈중심(a, 상자):
    """검은 구슬 둘의 중심.

    ⚠ 첫 판은 「밝기 < 70」으로 골랐다가 **몸통 그늘을 눈으로 셌다**(오른쪽 그늘 10,893점이
      한 덩어리로 잡혀 눈이 뺨으로 밀렸다). 눈은 «몸에서 가장 어두운 소수»라, 절대 문턱이
      아니라 **몸 밝기의 하위 0.4%** 로 좁힌다(실측: 컷 밝기 2.0 · 1,185점 · 두 덩이로 깨끗이 갈렸다).
    """
    알 = a[:, :, 3] > 128
    밝 = a[:, :, :3].astype(np.float64).mean(axis=2)
    컷 = np.percentile(밝[알], 0.4)
    ys, xs = np.nonzero(알 & (밝 <= 컷))
    가운데 = (xs.min() + xs.max()) / 2
    눈 = []
    for 골 in (xs < 가운데, xs >= 가운데):
        if 골.sum() < 50:
            raise SystemExit('눈 한쪽이 %d점뿐이다 — 하위 0.4%% 자가 이 판에 안 맞는다' % 골.sum())
        눈.append((float(xs[골].mean()), float(ys[골].mean())))
    return 눈


def main():
    원본 = {표현: 정본경로(표현) for 표현, _ in 판}
    그림 = {표현: np.array(Image.open(p).convert('RGBA')) for 표현, p in 원본.items()}

    # 두 판을 «같은 상자»로 자른다 — 상자가 갈리면 깜빡일 때 몸이 한 픽셀씩 튄다.
    상자들 = [몸상자(a) for a in 그림.values()]
    x0 = min(b[0] for b in 상자들); y0 = min(b[1] for b in 상자들)
    x1 = max(b[2] for b in 상자들); y1 = max(b[3] for b in 상자들)
    폭, 높 = x1 - x0, y1 - y0
    틀 = round(max(폭, 높) / 몸비율)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    잘 = (round(cx - 틀 / 2), round(cy - 틀 / 2))
    상자 = (잘[0], 잘[1], 잘[0] + 틀, 잘[1] + 틀)

    보고 = []
    for 표현, 나갈 in 판:
        im = Image.open(원본[표현]).convert('RGBA').crop(상자)   # 틀 밖은 투명으로 온다
        im = im.resize((변, 변), Image.LANCZOS)
        경로 = 여기 / 나갈
        im.save(경로, 'WEBP', quality=품질, method=6)
        보고.append({'표현': 표현, '파일': 나갈,
                    '원본': str(원본[표현].relative_to(루트)).replace('\\', '/'),
                    'KB': round(경로.stat().st_size / 1024, 1)})

    (lx, ly), (rx, ry) = 눈중심(그림['본체'], 상자)
    좌표 = {
        '_왜': ('빌드.js 가 읽어 틀에 넣는다. 손으로 CSS 에 적지 않는다 — 마스코트가 바뀌면 '
               '눈도 옮겨 가는데 손으로 적은 좌표는 안 따라와 다크 모드 빔이 뺨에서 나간다.'),
        '_언제': '마스코트굽기.py 가 굽는 자리에서 같이 쓴다',
        '눈왼': {'x': round((lx - 상자[0]) / 틀 * 100, 2), 'y': round((ly - 상자[1]) / 틀 * 100, 2)},
        '눈오': {'x': round((rx - 상자[0]) / 틀 * 100, 2), 'y': round((ry - 상자[1]) / 틀 * 100, 2)},
        '잘린상자': list(상자), '몸상자': [x0, y0, x1, y1], '틀': 틀, '변': 변,
        '몸비율': round(폭 / 틀, 4), '판': 보고,
    }
    (여기 / '마스코트좌표.json').write_text(
        json.dumps(좌표, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('마스코트 굽기 · 몸 %dx%d → 틀 %d · 상자 %s' % (폭, 높, 틀, 상자))
    for b in 보고:
        print('  %-16s %-22s %5.1fKB  ← %s' % (b['표현'], b['파일'], b['KB'], b['원본']))
    print('  눈 왼 %.2f%%,%.2f%% · 오 %.2f%%,%.2f%%'
          % (좌표['눈왼']['x'], 좌표['눈왼']['y'], 좌표['눈오']['x'], 좌표['눈오']['y']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
