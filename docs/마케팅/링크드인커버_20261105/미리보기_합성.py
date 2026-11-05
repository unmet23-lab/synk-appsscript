"""미리보기 합성 (2026-11-05) — ego 화면 찍기가 시간 초과일 때 쓰는 길.

11-05 16:3x에 실제 링크드인 프로필 쪽에 서로 다른 커버를 끼워 찍어 둔 미리보기(같은 자리·같은 크기)끼리
픽셀이 다른 곳을 모으면 「커버가 보이는 자리」(프로필 사진 · 흰 테두리 · 둥근 모서리를 뺀 곳)가 나온다.
그 자리에만 새 커버를 넣어 데스크톱·휴대폰 미리보기를 만든다.

  python -I -X utf8 미리보기_합성.py <커버.png> <이름>   → 미리보기/데스크톱_<이름>.png · 휴대폰_<이름>.png
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

여기 = Path(__file__).resolve().parent
미 = 여기 / '미리보기'
커버, 이름 = sys.argv[1], sys.argv[2]
# 찍을 때의 자리(CSS px): 데스크톱 clip (80,60) 안에서 커버 (88,76) 632×158, 휴대폰 clip (0,50) 안에서 (0,76.67) 390×97.5
자리 = {'데스크톱': (8, 16, 632, 158), '휴대폰': (0, 26.67, 390, 97.5)}
견본 = ['지금', 'A1', 'A2', 'B1']
for 모드, (x, y, w, h) in 자리.items():
    판들 = [np.asarray(Image.open(미 / f'{모드}_{n}.png').convert('RGB')).astype(np.int16) for n in 견본]
    바탕 = 판들[0]
    다름 = np.zeros(바탕.shape[:2], bool)
    for a in 판들[1:]:
        다름 |= np.abs(a - 바탕).sum(axis=2) > 12
        for b in 판들[1:]:
            다름 |= np.abs(a - b).sum(axis=2) > 12
    # 커버 사각형 밖은 버린다
    H, W = 바탕.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    안 = (xx >= int(x)) & (xx < int(x + w + .5)) & (yy >= int(y)) & (yy < int(y + h + .5))
    가림 = 다름 & 안
    c = Image.open(커버).convert('RGB').resize((round(w * 2), round(h * 2)), Image.LANCZOS)
    c = c.resize((round(w), round(h)), Image.LANCZOS)
    판 = Image.fromarray(바탕.astype(np.uint8))
    깔 = 판.copy()
    깔.paste(c, (round(x), round(y)))
    out = np.where(가림[..., None], np.asarray(깔), np.asarray(판))
    Image.fromarray(out.astype(np.uint8)).save(미 / f'{모드}_{이름}.png')
    print(모드, 이름, '커버 자리 픽셀', int(가림.sum()))
