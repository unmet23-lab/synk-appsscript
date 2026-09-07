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

import numpy as np
from PIL import Image

루트 = Path(__file__).resolve().parent.parent
든곳 = 루트 / 'docs/캐릭터/정본_4K'
낼곳 = 루트 / 'docs/캐릭터/화면_1024'



# ── 🆕 2026-09-08 머리 정렬 ────────────────────────────────────────────────────
# 🔴 유호 지적 09-08 「마린이 눈 깜빡일때 좀 옷이 흐려지거나 변하거든」 — 실측해 보니 깜빡임(눈감음)은
#    멀쩡했고, **표정 살이 컷 셋(궁금함·안도·응원)이 다른 판**이었다. 마린 기준 폭이 4.2% 크고
#    좌우로 8.5칸, 위아래로 45~73칸 밀려 있다. 까몽은 응원 하나가 22% 크고 73칸 밀렸다.
#    옷 조각은 늘 «같은 자리·같은 크기»로 얹히므로, 몸만 커지면 옷이 덜 나와 «변한 것»처럼 보인다.
# 🔑 정본 컷을 안 건드린다. 화면용으로 줄이는 이 자리에서 «머리»를 맞춘다 —
#    기준은 그 마스코트의 «본체» 컷이고, 자는 **헬멧(머리)의 가장 넓은 가로줄**이다.
#    그 줄은 컷마다 흔들리지 않는다(알파 네모 전체는 팔·발 자세에 흔들려 자로 못 쓴다 · 09-08 실측).
# ⚠ 배율은 ±8% 로 묶는다. 그보다 크게 어긋나면 그건 «크기 문제»가 아니라 다른 그림이라,
#    조용히 늘렸다가는 더 이상해진다 — 그때는 건드리지 않고 경고만 낸다.
def 머리자(im):
    """머리의 «가장 넓은 가로줄»을 찾아 그 폭·자리를 낸다. 못 재면 None."""
    a = np.array(im)[:, :, 3] > 16
    ys, xs = np.where(a)
    if not len(ys):
        return None
    위, 아래 = int(ys.min()), int(ys.max())
    반 = 위 + int((아래 - 위) * 0.55)          # 위쪽 55% 안 = 머리
    폭들 = a[:반].sum(axis=1)
    if not 폭들.max():
        return None
    y = int(np.argmax(폭들))
    행 = np.where(a[y])[0]
    return {'y': y, '폭': int(폭들[y]), 'cx': float((행.min() + 행.max()) / 2)}


def 머리맞추기(im, 기준, 이름):
    """기준(본체)의 머리와 같은 폭·자리가 되게 크기·자리를 고친다. 캔버스는 그대로."""
    내 = 머리자(im)
    if not 기준 or not 내 or not 내['폭']:
        return im, None
    배 = 기준['폭'] / 내['폭']
    if not (0.92 <= 배 <= 1.08):
        print(f'   ⚠ {이름} — 머리 폭이 {배:.3f} 배나 달라 손대지 않는다(다른 그림일 수 있다)')
        return im, None
    w, h = im.size
    큰 = im.resize((max(1, round(w * 배)), max(1, round(h * 배))), Image.LANCZOS)
    # 크기를 바꾸면 머리 자리도 그만큼 옮겨진다 — 그 뒤에 기준과의 차이만큼 민다.
    dx = round(기준['cx'] - 내['cx'] * 배)
    dy = round(기준['y'] - 내['y'] * 배)
    판 = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    판.alpha_composite(큰, (dx, dy)) if (dx >= 0 and dy >= 0) else 판.paste(큰, (dx, dy))
    return 판, {'배': round(배, 4), 'dx': dx, 'dy': dy}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--크기', type=int, default=1024)
    a = ap.parse_args()
    낼곳.mkdir(parents=True, exist_ok=True)
    했다 = 0
    든바이트 = 0
    난바이트 = 0
    판 = {}
    # 🆕 09-08 — «본체» 컷을 먼저 줄여 그 머리를 기준으로 삼고, 나머지를 거기에 맞춘다.
    #   그래서 마스코트별로 본체가 앞에 오도록 정렬한다(파일 이름의 `_본체` 를 앞으로).
    것들 = sorted(든곳.glob('*.png'), key=lambda q: (q.stem.split('_')[0], 0 if q.stem.endswith('_본체') else 1, q.stem))
    기준들 = {}
    맞춘수 = 0
    for p in 것들:
        im = Image.open(p).convert('RGBA')
        if im.width != im.height:
            print(f'⚠ {p.name} — 네모가 아니다 ({im.size}) · 그래도 같은 비율로 줄인다')
        작은 = im.resize((a.크기, round(a.크기 * im.height / im.width)), Image.LANCZOS)
        누구 = p.stem.split('_')[0]
        고침 = None
        if p.stem.endswith('_본체'):
            기준들[누구] = 머리자(작은)          # 이 마스코트의 기준
        elif 누구 in 기준들:
            작은, 고침 = 머리맞추기(작은, 기준들[누구], p.stem)
            if 고침 and (abs(고침['dx']) > 1 or abs(고침['dy']) > 1 or abs(고침['배'] - 1) > 0.002):
                print(f"   ↳ {p.stem} 머리 맞춤 — 배 {고침['배']} · dx {고침['dx']:+d} · dy {고침['dy']:+d}")
                맞춘수 += 1
        낼것 = 낼곳 / (p.stem + '.webp')
        작은.save(낼것, 'WEBP', quality=92, method=6)
        든바이트 += p.stat().st_size
        난바이트 += 낼것.stat().st_size
        판[p.stem] = {'원본': p.name, '크기': a.크기, '머리맞춤': 고침}
        했다 += 1
    (낼곳 / '판.json').write_text(json.dumps({
        '언제': datetime.now(timezone.utc).isoformat(),
        '크기': a.크기,
        '몇벌': 했다,
        '컷': 판,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'   머리를 맞춘 컷 {맞춘수}벌 (기준 = 마스코트별 «본체» 컷의 머리 가장 넓은 줄)')
    print(f'✅ {했다}벌 · {든바이트/1048576:.0f}MB → {난바이트/1048576:.0f}MB → {낼곳}')
    print(f'   브라우저가 펼쳐 놓는 몫: 한 장 {4096*4096*4/1048576:.0f}MB → {a.크기*a.크기*4/1048576:.0f}MB')


if __name__ == '__main__':
    main()
