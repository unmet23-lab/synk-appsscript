# -*- coding: utf-8 -*-
"""NPC 형상 대조 — 「네 역이 서로 다르게 생겼나」를 **반려 근거였던 그 잣대로** 잰다.

■ 왜 있나 (08-24)
  유호님 반려문은 「모든 npc가 다 똑같이 생겼고」였다. 그 말을 자로 옮긴 것이 트랙 §2-G 의 두 줄이다:
    · 역끼리 다른 화소(32/255 초과) 0.6~1.5% → 네 역이 98.5~99.4% 같은 그림
    · 몸 평균 채도 0.066~0.076            → 거의 무채(함정 7: 무채 + 털 = 흰 솜)
  형상을 고칠 때마다 **같은 자로** 재지 않으면 「나아진 것 같다」로 끝난다 — 08-23 색 오보가 그 병이었다.

■ 🔑 이 도구가 실제로 잡아낸 것 (08-24)
  「다른 화소 %」만 보면 2판이 1판의 5.8배라 충분해 보였는데, **실루엣만 떼어 재니** lead 와 insp 가
  화소 수 33561 대 33449 = **1.003배**, 즉 크기가 사실상 같았다. 정원과 둥근사각은 크기배를 달리 줘도
  **모서리가 면적을 되돌려주기** 때문이다. ⇒ 배경이 섞인 「다른 화소 %」로는 이걸 못 본다.
  **실루엣은 따로 잰다.**

쓰기:
  python tools/NPC형상대조.py --방 <폴더>                       (한 판을 잰다)
  python tools/NPC형상대조.py --방 <새폴더> --옛방 <옛폴더>       (두 판을 나란히 + 지면 PNG)
  python tools/NPC형상대조.py --방 … --뒤 -calm                  (파일명이 boss-calm.png 식일 때)
"""
import os
import sys
import itertools

sys.stdout.reconfigure(encoding='utf-8')
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print('PIL 이 없다 — pip install pillow')
    raise SystemExit(2)

역들 = ['boss', 'prof', 'lead', 'insp']
인자 = {}
_v = sys.argv[1:]
_i = 0
while _i < len(_v):
    if _v[_i].startswith('--'):
        k = _v[_i][2:]
        if _i + 1 < len(_v) and not _v[_i + 1].startswith('--'):
            인자[k] = _v[_i + 1]; _i += 2; continue
        인자[k] = True
    _i += 1


def 글꼴(크기, 굵게=False):
    """⚠PIL 기본 글꼴엔 한글 글리프가 없다 — 라벨이 통째로 두부(□)가 된다(굽기대조.py 의 그 교훈)."""
    for 길 in ([r'C:\Windows\Fonts\malgunbd.ttf'] if 굵게 else []) + [
            r'C:\Windows\Fonts\malgun.ttf', r'C:\Windows\Fonts\gulim.ttc']:
        try:
            return ImageFont.truetype(길, 크기)
        except OSError:
            pass
    return ImageFont.load_default()


def 찾기(방, 역, 뒤):
    """`boss.png` · `boss-calm.png` 어느 이름이든 집는다 — 검증 판과 정본 판의 이름이 다르다."""
    for 이름 in (f'{역}{뒤}.png', f'{역}.png', f'{역}-calm.png'):
        p = os.path.join(방, 이름)
        if os.path.exists(p):
            return p
    raise SystemExit(f'🔴 {방} 에 {역} 이 없다')


def 다른화소(a, b, 문턱=32, 성김=2):
    if a.size != b.size:
        b = b.resize(a.size, Image.LANCZOS)
    pa, pb = a.load(), b.load()
    w, h = a.size
    다름 = 수 = 0
    for y in range(0, h, 성김):
        for x in range(0, w, 성김):
            r1, g1, b1 = pa[x, y]
            r2, g2, b2 = pb[x, y]
            수 += 1
            if max(abs(r1 - r2), abs(g1 - g2), abs(b1 - b2)) > 문턱:
                다름 += 1
    return 100.0 * 다름 / 수


def 실루엣(im, 문턱=60, 성김=2):
    """주인공 화소 — 무대(어두운 밤천)보다 밝은 것. 좌표 집합으로 둬야 겹침(IoU)을 잴 수 있다."""
    g = im.convert('L')
    px = g.load()
    w, h = g.size
    return {(x, y) for y in range(0, h, 성김) for x in range(0, w, 성김) if px[x, y] > 문턱}


def 몸채도(im, 성김=2):
    px = im.load()
    w, h = im.size
    합 = 수 = 0
    for y in range(0, h, 성김):
        for x in range(0, w, 성김):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx < 40:
                continue
            합 += (mx - mn) / mx
            수 += 1
    return (합 / 수) if 수 else 0.0


def 재기(방, 뒤, 이름):
    그림 = {r: Image.open(찾기(방, r, 뒤)).convert('RGB') for r in 역들}
    실 = {r: 실루엣(그림[r]) for r in 역들}
    채 = {r: 몸채도(그림[r]) for r in 역들}
    쌍 = list(itertools.combinations(역들, 2))
    화소 = {p: 다른화소(그림[p[0]], 그림[p[1]]) for p in 쌍}
    겹침 = {}
    for a, b in 쌍:
        교, 합 = len(실[a] & 실[b]), len(실[a] | 실[b])
        겹침[(a, b)] = 100.0 * 교 / 합 if 합 else 0.0
    큰, 작 = max(len(실[r]) for r in 역들), min(len(실[r]) for r in 역들)

    print(f'\n■ {이름}   ({방})')
    print('  역끼리 — 다른 화소 % / 실루엣 겹침 %   (겹침이 낮을수록 실루엣이 갈렸다)')
    for a, b in sorted(쌍, key=lambda p: -겹침[p]):
        표 = '  ← 가장 약한 자리' if 겹침[(a, b)] == max(겹침.values()) else ''
        print(f'    {a:<5}↔{b:<5}  다름 {화소[(a, b)]:5.2f}%   겹침 {겹침[(a, b)]:5.1f}%{표}')
    print(f'    → 가장 많이 겹치는 쌍 {max(겹침.values()):.1f}%  ·  평균 겹침 {sum(겹침.values()) / 6:.1f}%')
    print(f'    → 실루엣 크기: 가장 큰 역이 가장 작은 역의 **{큰 / 작:.2f}배**'
          f'   (' + ' · '.join(f'{r} {len(실[r])}' for r in 역들) + ')')
    print('    → 몸 평균 채도: ' + '  '.join(f'{r} {채[r]:.3f}' for r in 역들)
          + f'   (평균 {sum(채.values()) / 4:.3f})')
    return {'그림': 그림, '겹침': 겹침, '화소': 화소, '채': 채, '크기비': 큰 / 작}


방 = 인자.get('방')
if not 방:
    print(__doc__)
    raise SystemExit(2)
뒤 = 인자.get('뒤', '')
새 = 재기(방, 뒤 if isinstance(뒤, str) else '', '지금 판')
옛방 = 인자.get('옛방')
옛 = 재기(옛방, 인자.get('옛뒤', '-calm'), '옛 판') if isinstance(옛방, str) else None

if 옛:
    print('\n■ 판정 — 낮아져야 이긴다(겹침)')
    print(f'  가장 많이 겹치는 쌍  {max(옛["겹침"].values()):.1f}% → {max(새["겹침"].values()):.1f}%')
    print(f'  평균 겹침            {sum(옛["겹침"].values()) / 6:.1f}% → {sum(새["겹침"].values()) / 6:.1f}%')
    print(f'  실루엣 크기비        {옛["크기비"]:.2f}배 → {새["크기비"]:.2f}배')
    print(f'  몸 채도 평균         {sum(옛["채"].values()) / 4:.3f} → {sum(새["채"].values()) / 4:.3f}')

# ── 지면 — 숫자만으로는 무엇이 이상해졌는지 못 본다(굽기대조.py 의 규율) ──
낼곳 = 인자.get('낼곳')
if isinstance(낼곳, str):
    줄들 = ([(옛, '옛 판', (232, 120, 105))] if 옛 else []) + [(새, '지금 판', (140, 205, 150))]
    칸, 여백, 머리 = 420, 28, 132
    W = 여백 * 2 + 칸 * 4 + 24 * 3
    H = 머리 + (칸 + 74) * len(줄들) + 여백
    장 = Image.new('RGB', (W, H), (18, 18, 20))
    d = ImageDraw.Draw(장)
    d.text((여백, 26), 'NPC 형상 대조 — 실루엣이 갈리나', font=글꼴(34, True), fill=(246, 246, 248))
    d.text((여백, 72), f'가장 많이 겹치는 쌍 {max(새["겹침"].values()):.1f}%'
                      + (f'  (옛 {max(옛["겹침"].values()):.1f}%)' if 옛 else '')
                      + f'   ·   실루엣 크기비 {새["크기비"]:.2f}배'
                      + (f'  (옛 {옛["크기비"]:.2f}배)' if 옛 else ''),
           font=글꼴(22), fill=(170, 175, 185))
    d.text((여백, 102), '자세는 calm 하나로 고정했다 — 움직이는 것은 형상뿐이다.',
           font=글꼴(20), fill=(140, 145, 155))
    for 줄, (판, 딱지, 색깔) in enumerate(줄들):
        y = 머리 + 줄 * (칸 + 74)
        d.text((여백, y - 26), 딱지, font=글꼴(24, True), fill=색깔)
        for i, r in enumerate(역들):
            x = 여백 + i * (칸 + 24)
            im = 판['그림'][r].copy()
            im.thumbnail((칸, 칸), Image.LANCZOS)
            장.paste(im, (x + (칸 - im.width) // 2, y + (칸 - im.height) // 2))
            d.text((x, y + 칸 + 6), f'{r}   채도 {판["채"][r]:.3f}', font=글꼴(21), fill=(200, 204, 212))
    os.makedirs(os.path.dirname(os.path.abspath(낼곳)), exist_ok=True)
    장.save(낼곳)
    print(f'\n■ 지면 → {낼곳}  ({os.path.getsize(낼곳) // 1024}KB · {W}x{H})')
