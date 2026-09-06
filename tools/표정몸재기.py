"""까몽 표정 컷 열여섯의 «몸»이 서로 같은가 — 0원 실측.

■ 왜 이것이 열쇠인가
  같다면: 옷 조각 한 벌을 어느 표정에나 그대로 얹을 수 있다. 표정 문제가 사라진다.
  다르다면: 표정마다 옷을 따로 맞춰야 한다. 그러면 값이 표정 수만큼 곱해진다.

  표정워프.js 는 09-02 에 「본체와 눈감음은 몸 전체가 다르다(차이 픽셀 70,905)」고 적었다.
  그런데 그것은 옛 판이고 09-05 에 4K 정본으로 갈아 끼웠다. 지금 다시 잰다.
"""
from pathlib import Path

import numpy as np
from PIL import Image

정본방 = Path(r'C:\Users\q1212\Documents\SYNK-appsscript\docs\캐릭터\정본_4K')
기준이름 = '까몽_본체.png'


def 읽기(p, 크기=1024):
    im = Image.open(p).convert('RGBA')
    return np.asarray(im.resize((크기, 크기), Image.LANCZOS), dtype=np.float32)


기준 = 읽기(정본방 / 기준이름)
기준알파 = 기준[..., 3] > 128
칸수 = 기준알파.size

print(f'기준 = {기준이름} · 몸 넓이 {int(기준알파.sum()):,} / {칸수:,}칸 (1024×1024 로 맞춰 잼)')
print()
print(f'{"표정":<14} {"실루엣 겹침":>11} {"몸 색 차이":>11} {"눈 뺀 몸 차이":>13}')
print('-' * 56)

# 눈 자리 = 기준에서 초록 홍채가 있는 곳을 넉넉히 둘러싼 네모
r, g, b, a = 기준[..., 0], 기준[..., 1], 기준[..., 2], 기준[..., 3]
초록 = (g > 90) & (g > r * 1.15) & (g > b * 1.15) & (a > 128)
ys, xs = np.nonzero(초록)
눈네모 = None
if len(xs) > 20:
    여백 = 60
    눈네모 = (max(0, xs.min() - 여백), max(0, ys.min() - 여백),
              min(1023, xs.max() + 여백), min(1023, ys.max() + 여백))
    print(f'(눈 네모 = x {눈네모[0]}~{눈네모[2]} · y {눈네모[1]}~{눈네모[3]})')
    print()

것들 = sorted(p for p in 정본방.glob('까몽_*.png') if p.name != 기준이름)
표 = []
for p in 것들:
    d = 읽기(p)
    알파 = d[..., 3] > 128
    iou = float((알파 & 기준알파).sum()) / float((알파 | 기준알파).sum() or 1)
    둘다 = 알파 & 기준알파
    차 = np.abs(d[..., :3] - 기준[..., :3]).mean(axis=2)
    몸차 = float(차[둘다].mean()) if 둘다.any() else 0.0
    if 눈네모:
        가림 = np.ones_like(둘다)
        x0, y0, x1, y1 = 눈네모
        가림[y0:y1 + 1, x0:x1 + 1] = False
        눈뺀 = 둘다 & 가림
        눈뺀차 = float(차[눈뺀].mean()) if 눈뺀.any() else 0.0
    else:
        눈뺀차 = float('nan')
    이름 = p.stem.replace('까몽_', '')
    표.append((이름, iou, 몸차, 눈뺀차))
    print(f'{이름:<14} {iou:>11.4f} {몸차:>11.2f} {눈뺀차:>13.2f}')

if 표:
    ious = [t[1] for t in 표]
    눈뺀들 = [t[3] for t in 표 if t[3] == t[3]]
    print()
    print(f'실루엣 겹침   중앙값 {np.median(ious):.4f} · 가장 낮은 것 {min(ious):.4f}')
    print(f'눈 뺀 몸 차이 중앙값 {np.median(눈뺀들):.2f} · 가장 큰 것 {max(눈뺀들):.2f}  (0~255 밝기 눈금)')
    print()
    print('읽는 법: 실루엣 겹침 1.0 에 가깝고 «눈 뺀 몸 차이»가 작을수록,')
    print('         표정이 바뀌어도 몸은 그대로라는 뜻이다.')
