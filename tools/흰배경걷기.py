"""제미나이가 낸 그림에서 «흰 배경 네모»를 걷는다 (2026-09-05).

왜 있나(09-05 실물):
  `gemini-3-pro-image` 로 구운 부품은 흰 바닥 위에 찍힌 사진이라 배경이 통째로 붙어 나온다.
  크림 지면(#FBF7F0)에 그대로 얹으면 «흰 사각형»이 뜬다 — 09-05 판정판에서 눈으로 봤고,
  같은 무늬를 마스코트에서 한 번 밟은 적이 있다(`경로('눈웃음')` 이 배경 붙은 판을 줬다).
  구울 것이 28장이라 손으로 걷을 일이 아니다.

무엇을 하나 — «가장자리에서 번져 들어간 곳»만 배경으로 본다:
  네 코너와 네 변 가운데에서 `ImageDraw.floodfill` 로 번지게 하고, 번진 자리만 알파 0 으로.
  🔑 밝기 임계로 자르지 않는 이유: 버터색 별·크림색 실처럼 «밝은 물건»이 통째로 사라진다.
     연결성으로 가르면 물건 안쪽 밝은 곳은 살아남는다.
  그림자는 배경보다 어두워 남는다 — 펠트의 무게가 거기서 나오므로 일부러 남긴다.
  임계(--임계)가 높을수록 옅은 후광까지 먹는다. 09-05 실측 62 에서 후광이 거의 걷혔고
  물건 가장자리는 안 먹혔다(배경 몫 55~82%).

무엇을 안 하나 — 원본을 안 지운다. 다른 임계로 다시 걷을 수 있어야 한다.
  출력은 기본이 `<이름>_누끼.png` 다.

사용:
  python tools/흰배경걷기.py docs/Loom_자산/구움/공방_가위.png
  python tools/흰배경걷기.py "docs/Loom_자산/구움/공방_*.png" --임계 70
  python tools/흰배경걷기.py <입력> --출력 <경로> --여백 12 --정사각
"""
import argparse
import glob
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    sys.exit('Pillow 가 없다 — python -m pip install pillow')

표식 = (255, 0, 255)   # 배경으로 번진 자리를 찍는 색(원본에 있을 리 없는 자홍)


def 걷는다(경로, 출력, 임계, 여백, 정사각, 부드럼):
    원 = Image.open(경로).convert('RGB')
    w, h = 원.size
    tmp = 원.copy()
    씨앗 = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
            (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in 씨앗:
        ImageDraw.floodfill(tmp, s, 표식, thresh=임계)

    px = tmp.load()
    알파 = Image.new('L', (w, h), 255)
    ap = 알파.load()
    지운수 = 0
    for y in range(h):
        for x in range(w):
            if px[x, y] == 표식:
                ap[x, y] = 0
                지운수 += 1

    if 지운수 == 0:
        print(f'   ⚠ {os.path.basename(경로)} — 배경을 한 점도 못 찾았다(임계 {임계}). '
              f'배경이 흰색이 아니거나 물건이 테두리에 닿아 있다.')
    알파 = 알파.filter(ImageFilter.GaussianBlur(부드럼))
    out = 원.convert('RGBA')
    out.putalpha(알파)

    bb = 알파.point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:
        out = out.crop(bb)
        if 정사각:
            s = max(out.size) + 여백 * 2
            판 = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            판.paste(out, ((s - out.width) // 2, (s - out.height) // 2), out)
            out = 판
        elif 여백:
            판 = Image.new('RGBA', (out.width + 여백 * 2, out.height + 여백 * 2), (0, 0, 0, 0))
            판.paste(out, (여백, 여백), out)
            out = 판

    out.save(출력)
    print(f'   ✅ {os.path.basename(출력)}  배경 {지운수 * 100 // (w * h)}% · {out.size[0]}×{out.size[1]}')
    return 지운수 > 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('입력', help='파일 하나 또는 별표 무늬(예 "구움/공방_*.png")')
    ap.add_argument('--출력', help='입력이 하나일 때만. 없으면 <이름>_누끼.png')
    ap.add_argument('--임계', type=int, default=62,
                    help='배경으로 번지는 관대함(0~255). 높을수록 옅은 후광까지 먹는다. 09-05 실측 기본 62')
    ap.add_argument('--여백', type=int, default=8, help='잘라낸 뒤 사방에 남길 빈 자리(px)')
    ap.add_argument('--정사각', action='store_true',
                    help='정사각 판에 가운데로 앉힌다 — UI 칸이 가로로 길 때 contain 이 점으로 줄이는 것을 막는다')
    ap.add_argument('--부드럼', type=float, default=0.8, help='가장자리 계단 다듬기(가우시안 반지름)')
    a = ap.parse_args()

    파일들 = sorted(glob.glob(a.입력)) if any(c in a.입력 for c in '*?[') else [a.입력]
    파일들 = [p for p in 파일들 if not p.endswith('_누끼.png')]
    if not 파일들:
        sys.exit(f'🔴 입력에 걸린 파일이 0개 — {a.입력}')
    if a.출력 and len(파일들) > 1:
        sys.exit('🔴 --출력 은 입력이 하나일 때만 쓴다.')

    print(f'■ 흰 배경 걷기 {len(파일들)}장 · 임계 {a.임계}')
    산것 = 0
    for p in 파일들:
        out = a.출력 or (os.path.splitext(p)[0] + '_누끼.png')
        if 걷는다(p, out, a.임계, a.여백, a.정사각, a.부드럼):
            산것 += 1
    print(f'■ 합계 {len(파일들)}장 = 걷힘 {산것} + 못 걷음 {len(파일들) - 산것}')


if __name__ == '__main__':
    main()
