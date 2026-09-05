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

try:                                    # 떨어진 조각 걷기에만 쓴다 — 없으면 그 단계만 건너뛴다
    import numpy as np
    from scipy import ndimage
except ImportError:
    np = ndimage = None

표식 = (255, 0, 255)   # 배경으로 번진 자리를 찍는 색(원본에 있을 리 없는 자홍)


def 남은조각걷기(알파, 몫문):
    """배경을 걷고도 «본체와 떨어져» 남은 흰 조각을 지운다 (09-05 실물).

    왜 남나: 이 도구는 «가장자리에서 번져 들어간 곳»만 배경으로 본다. 그래서 물건과
      떨어져 있으면서 번짐이 닿지 못한 조각은 살아남는다. 흰 지면에서는 안 보이다가
      마스코트 위나 색 있는 배경에 얹으면 드러난다 — 그때는 이미 쓰인 뒤다.
      09-05 실측: 오늘 구운 32장 중 10장에 남았고, 비니가 본체의 2.65%(18조각)로 가장 컸다.
    🔑 «두 번째로 큰 덩어리»를 지우지 않는다 — 이어폰의 폼폼 둘처럼 원래 여러 덩어리인
      물건이 있다. 그래서 «개수»가 아니라 «본체 대비 몫»으로 가른다.
    """
    if ndimage is None:
        print('   ⚠ scipy 가 없어 떨어진 조각 걷기를 건너뛴다 — python -m pip install scipy')
        return 0, 알파
    a = np.array(알파)
    있다 = a > 8
    표, 수 = ndimage.label(있다, structure=np.ones((3, 3), dtype=bool))
    if 수 <= 1:
        return 0, 알파
    크기 = ndimage.sum(있다, 표, range(1, 수 + 1))
    문턱 = 크기.max() * 몫문 / 100.0
    지울것 = [i + 1 for i, c in enumerate(크기) if c < 문턱]
    if not 지울것:
        return 0, 알파
    지움 = np.isin(표, 지울것)
    a[지움] = 0
    return int(지움.sum()), Image.fromarray(a, 'L')


def 흰그림자다듬기(원px, ap, w, h, 바닥, 채도문):
    """배경으로 «번지지 못한» 흰 자리를 밝기에 비례해 투명하게 만든다.

    왜(09-05 실물): 흰 바닥에서 찍으면 그림자도 흰색 계열이라, 배경만 걷으면 물체 옆에
      «흰 덩어리»가 불투명하게 남는다. 크림 종이(#FBF7F0) 위에 얹으면 그 자리가 하얗게 뜬다
      — 골무·실패 아래가 그랬다.
    어떻게: 채도가 거의 없고(물체가 아니고) 아주 밝은 픽셀만 골라, 흰색에 가까울수록
      알파를 낮춘다. 그림자의 «어두운 쪽»은 남으므로 물건의 무게는 안 사라진다.
    """
    민수 = 0
    for y in range(h):
        for x in range(w):
            if ap[x, y] == 0:
                continue
            r, g, b = 원px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx - mn > 채도문:      # 색이 있으면 물체다 — 안 건드린다
                continue
            if mx < 바닥:             # 짙은 그림자는 남긴다
                continue
            t = (mx - 바닥) / max(255 - 바닥, 1)
            새 = int(ap[x, y] * (1.0 - min(1.0, t)))
            if 새 != ap[x, y]:
                민수 += 1
            ap[x, y] = 새
    return 민수


def 구멍걷기(원px, ap, w, h, 문):
    """물체에 «둘러싸인» 배경을 걷는다 — 가위 손잡이 안, 실 고리 안.

    왜(09-05 실물): floodfill 은 테두리에서 번지므로 물체가 감싼 구멍에는 못 들어간다.
      그래서 손 도구 여섯 중 바늘과실·가위의 구멍 안쪽이 흰 조각으로 남았다.
    어떻게: 배경이 순백(255)이라, 아직 살아 있는 픽셀 중 «거의 순백이고 색이 없는» 것을
      지운다. 물체 쪽 흰 하이라이트는 이 문턱(기본 238)보다 어둡거나 색을 띤다.
    ⚠ 흰 물건은 못 찍는 규격이라 성립하는 방법이다 — 배경이 흰색이 아니면 이 함수를 끈다.
    """
    센다 = 0
    for y in range(h):
        for x in range(w):
            if ap[x, y] == 0:
                continue
            r, g, b = 원px[x, y]
            if min(r, g, b) >= 문 and max(r, g, b) - min(r, g, b) <= 8:
                ap[x, y] = 0
                센다 += 1
    return 센다


def 걷는다(경로, 출력, 임계, 여백, 정사각, 부드럼, 흰바닥=218, 채도문=22, 구멍문=238, 조각몫=2.0):
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

    민수 = 흰그림자다듬기(원.load(), ap, w, h, 흰바닥, 채도문) if 흰바닥 > 0 else 0
    구멍수 = 구멍걷기(원.load(), ap, w, h, 구멍문) if 구멍문 > 0 else 0
    # 🔑 흐리기 «전»에 지운다 — 흐린 뒤에는 조각의 테두리가 번져 덩어리 경계가 뭉갠다
    조각수, 알파 = 남은조각걷기(알파, 조각몫) if 조각몫 > 0 else (0, 알파)
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
    print(f'   ✅ {os.path.basename(출력)}  배경 {지운수 * 100 // (w * h)}% · 구멍 {구멍수:,}점'
          f'{f" · 흰그림자 {민수:,}점" if 민수 else ""}'
          f'{f" · 떨어진 조각 {조각수:,}점" if 조각수 else ""} · {out.size[0]}×{out.size[1]}')
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
    ap.add_argument('--흰바닥', type=int, default=218,
                    help='이 밝기(0~255)를 넘는 «저채도» 픽셀은 흰색에 가까울수록 투명하게 만든다 — '
                         '흰 바닥에서 찍으면 그림자도 흰색이라 배경만 걷으면 흰 덩어리가 남는다. 0 이면 안 한다')
    ap.add_argument('--채도문', type=int, default=22,
                    help='RGB 최대-최소가 이 값을 넘으면 «색이 있는 것»이라 흰그림자 다듬기에서 뺀다(물체 보호)')
    ap.add_argument('--조각몫', type=float, default=2.0,
                    help='본체의 이 %% 미만인 «떨어진 덩어리»를 지운다. 0 이면 안 한다. '
                         '09-05 실측 2.0 에서 비니의 흰 실선 18조각이 걷히고 이어폰의 폼폼 둘은 남았다')
    ap.add_argument('--구멍문', type=int, default=238,
                    help='물체에 둘러싸인 «거의 순백» 자리를 걷는 문턱(0~255). 가위 손잡이 안·실 고리 안이 '
                         '이걸로 걷힌다. 0 이면 안 한다(배경이 흰색이 아닌 그림)')
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
        if 걷는다(p, out, a.임계, a.여백, a.정사각, a.부드럼, a.흰바닥, a.채도문, a.구멍문, a.조각몫):
            산것 += 1
    print(f'■ 합계 {len(파일들)}장 = 걷힘 {산것} + 못 걷음 {len(파일들) - 산것}')


if __name__ == '__main__':
    main()
