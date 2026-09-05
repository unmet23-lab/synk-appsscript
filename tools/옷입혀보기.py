"""옷 조각을 마스코트에 실제로 «겹쳐 입혀» 본다 — 유호님이 아침에 보실 판 (2026-09-06 · 0원).

■ 무엇을 재나 (유호 09-06 「3개를 입어도 움직임이 자연스러워야하고 표정도 자연스러워야해」)
  ① 한 벌씩 — 스무 벌이 저마다 몸에 맞게 앉나
  ② 겹쳐 입기 — 의상 1 + 악세 2 를 동시에 걸쳐도 서로 안 부딪히나
  ③ 표정 — 같은 옷을 «다른 표정 컷» 위에 얹어도 자리가 맞나(옷은 몸을 따라간다)

■ 왜 이게 되나
  옷이 몸에 박혀 있지 않고 «따로 노는 조각»이라, 몸을 바꿔도 옷은 그대로 얹힌다.
  자리는 두 눈으로 잡으므로 표정 컷마다 눈이 있는 한 따라간다.

쓰는 법:
  python tools/옷입혀보기.py --마스코트 몽글 --낼곳 <파일.webp>            # 한 벌씩 전량
  python tools/옷입혀보기.py --마스코트 몽글 --겹쳐 --낼곳 <파일.webp>      # 겹쳐 입기 넷
  python tools/옷입혀보기.py --마스코트 몽글 --표정 --낼곳 <파일.webp>      # 표정 넷 × 같은 옷
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

루트 = Path(__file__).resolve().parent.parent
층방 = 루트 / 'docs/Loom_자산/옷/층'
정본방 = 루트 / 'docs/캐릭터/정본_4K'

몸그림 = {'몽글': '몽글_본체.png', '까몽': '까몽_본체.png', '마린': '마린_본체.png'}
표정컷 = {
    '몽글': ['몽글_본체.png', '몽글_눈웃음.png', '몽글_놀람.png', '몽글_눈감음.png'],
    '까몽': ['까몽_본체.png', '까몽_눈웃음.png', '까몽_놀람.png', '까몽_윙크.png'],
    '마린': ['마린_본체.png', '마린_눈웃음.png', '마린_놀람.png', '마린_집중.png'],
}


def 흰바탕(im, 색=(255, 255, 255)):
    바탕 = Image.new('RGB', im.size, 색)
    바탕.paste(im, (0, 0), im if im.mode == 'RGBA' else None)
    return 바탕


def 맞춰(im, 높이):
    w = max(1, int(im.width * 높이 / max(1, im.height)))
    return im.resize((w, 높이), Image.LANCZOS)


def 입힌다(몸경로: Path, 층들):
    """몸 위에 옷 층을 차례로 얹는다. 층은 이미 몸과 같은 네모·같은 자리다."""
    판 = Image.open(몸경로).convert('RGBA')
    for p in 층들:
        층 = Image.open(p).convert('RGBA')
        if 층.size != 판.size:
            층 = 층.resize(판.size, Image.LANCZOS)
        판.alpha_composite(층)
    return 판


def 잘라(판):
    b = 판.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    return 흰바탕(판.crop(b) if b else 판)


def 판만들기(칸들, 칸높=430, 여백=14, 글높=30, 줄당=5):
    꼴 = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 20)
    줄들 = [칸들[i:i + 줄당] for i in range(0, len(칸들), 줄당)]
    그린것 = [[(라벨, 맞춰(im, 칸높)) for 라벨, im in 줄] for 줄 in 줄들]
    폭 = max(sum(i.width for _, i in 줄) + 여백 * (len(줄) + 1) for 줄 in 그린것)
    높 = sum(칸높 + 글높 + 여백 for _ in 그린것) + 여백
    판 = Image.new('RGB', (폭, 높), (250, 249, 246))
    그림 = ImageDraw.Draw(판)
    y = 여백
    for 줄 in 그린것:
        x = 여백
        for 라벨, im in 줄:
            그림.text((x, y), 라벨, font=꼴, fill=(60, 58, 55))
            판.paste(im, (x, y + 글높))
            x += im.width + 여백
        y += 글높 + 칸높 + 여백
    return 판


def 층찾기(마스코트, 이름=None):
    것들 = sorted(층방.glob(f'옷_{마스코트}_*.png'))
    if 이름:
        것들 = [p for p in 것들 if 이름.replace(' ', '') in p.stem]
    return 것들


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--마스코트', default='몽글')
    ap.add_argument('--낼곳', required=True)
    ap.add_argument('--겹쳐', action='store_true')
    ap.add_argument('--표정', action='store_true')
    a = ap.parse_args()

    몸 = 정본방 / 몸그림[a.마스코트]
    층들 = 층찾기(a.마스코트)
    if not 층들:
        sys.exit(f'🔴 {a.마스코트} 의 옷 조각이 없다 — 먼저 node tools/옷굽기.js')

    칸 = []
    if a.겹쳐:
        # 의상 하나 + 악세 둘 — 갈래는 파일 이름으로 못 가르니 목록을 읽는다
        import json
        import subprocess
        r = subprocess.run(['node', '-e',
                            "const{목록}=require('./tools/lib/옷목록.js');"
                            f"console.log(JSON.stringify(목록('{a.마스코트}')"
                            ".map(x=>({이름:x.이름,갈래:x.갈래}))))"],
                           cwd=str(루트), capture_output=True, text=True, encoding='utf-8')
        표 = {x['이름'].replace(' ', ''): x['갈래'] for x in json.loads(r.stdout)}
        의상 = [p for p in 층들 if 표.get(p.stem.split('_', 2)[2]) == '의상']
        악세 = [p for p in 층들 if 표.get(p.stem.split('_', 2)[2]) == '악세']
        칸.append(('맨몸', 잘라(입힌다(몸, []))))
        for i in range(min(4, len(의상))):
            고른 = [의상[i]] + 악세[i * 2: i * 2 + 2]
            이름 = ' + '.join(p.stem.split('_', 2)[2] for p in 고른)
            칸.append((이름, 잘라(입힌다(몸, 고른))))
    elif a.표정:
        옷 = 층들[:2]
        for 컷 in 표정컷[a.마스코트]:
            p = 정본방 / 컷
            if not p.exists():
                continue
            칸.append((컷.replace('.png', ''), 잘라(입힌다(p, 옷))))
    else:
        칸.append(('맨몸', 잘라(입힌다(몸, []))))
        for p in 층들:
            칸.append((p.stem.split('_', 2)[2], 잘라(입힌다(몸, [p]))))

    판 = 판만들기(칸)
    판.save(a.낼곳, quality=90, method=6)
    print(f'✅ {a.낼곳} — {len(칸)}칸 · {판.width}×{판.height}')


if __name__ == '__main__':
    main()
