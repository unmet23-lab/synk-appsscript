"""정본 한 장에서 «헬멧만» 떼어 기울인다 — 몸은 픽셀 그대로 둔다.

왜 이렇게 하나 (유호 지적 2026-09-06 밤 「인사할때 마스코트 의상이 변하는게 보여」):
  컷을 통째로 다시 구우면 모델이 몸까지 새로 그린다. 그래서 가방 끈 방향·가방 크기·꽃 자리가
  컷마다 갈렸다. 몸을 «그리지 않으면» 그 일이 원리상 일어날 수 없다.

무엇을 하나:
  ⓐ 어두운 남색 덩어리(헬멧)를 찾고, 그 안의 구멍(렌즈)을 채워 헬멧 층으로 삼는다.
  ⓑ 헬멧을 아래 가운데를 축으로 기울이고, 살짝 내리고, 세로로 조금 눌러 «앞으로 숙인» 결을 낸다.
  ⓒ 원본 위에 그 헬멧을 얹는다. 원본이 바닥이라 몸에 구멍이 날 자리가 없다.

쓰기: python 고개숙이기.py <정본.png> <낼곳> --각도 8 --내림 0.012 --누름 0.985
"""
import argparse, os
from PIL import Image
import numpy as np
from scipy.ndimage import binary_fill_holes, binary_closing, binary_dilation, label

ap = argparse.ArgumentParser()
ap.add_argument('원본'); ap.add_argument('낼곳')
ap.add_argument('--각도', type=float, default=8.0)
ap.add_argument('--내림', type=float, default=0.012)   # 판 높이 대비
ap.add_argument('--누름', type=float, default=0.985)   # 세로 눌림
ap.add_argument('--어둠', type=int, default=120)
ap.add_argument('--키움', type=float, default=1.012)
ap.add_argument('--넓힘', type=int, default=25)       # 이보다 어두우면 헬멧
인 = ap.parse_args()

원 = Image.open(인.원본).convert('RGBA')
A = np.array(원)
알파 = A[..., 3] > 32
밝기 = A[..., :3].astype(np.float32).mean(axis=2)

헬멧 = 알파 & (밝기 < 인.어둠)
헬멧 = binary_closing(헬멧, np.ones((9, 9)))
헬멧 = binary_fill_holes(헬멧)          # 렌즈(밝은 노랑)가 이 안에 있어 같이 들어온다
# 가장 큰 덩어리만 — 몸 그늘의 어두운 점들이 딸려오지 않게
표, 수 = label(헬멧)
if 수 > 1:
    큰 = 1 + np.argmax([(표 == i).sum() for i in range(1, 수 + 1)])
    헬멧 = 표 == 큰

ys, xs = np.nonzero(헬멧)
if len(ys) == 0:
    raise SystemExit('헬멧을 못 찾았다 — --어둠 을 올려 본다')
위 = ys.min(); 아래 = ys.max(); 가운데 = int((xs.min() + xs.max()) / 2)
# 🔴 축을 헬멧 «맨 아래»에 두면 13도만 돌려도 헬멧이 옆으로 크게 쓸린다.
#    사람으로 치면 목이 있는 자리 — 아래에서 헬멧 높이의 15% 위 — 를 축으로 잡는다.
축y = int(아래 - (아래 - 위) * 0.15)
print(f'헬멧 점 {헬멧.sum():,} · 위 {위} · 아래 {아래} · 축 y={축y} x={가운데}')

헬멧층 = np.zeros_like(A); 헬멧층[헬멧] = A[헬멧]
층 = Image.fromarray(헬멧층, 'RGBA')
# 🔴 원본을 바닥에 깔면 «옛 헬멧»이 회전본 밖으로 삐져나와 머리가 둘로 보인다(09-06 실측).
#    그래서 바닥은 «몸만» 남긴다. 헬멧이 덮고 있던 자리는 회전본이 덮는다.
# 헬멧 가장자리는 «반투명하게 번져» 있어서, 마스크 그대로 지우면 옛 윤곽이 유령처럼 남는다
# (09-06 실측 — 오른쪽 위에 헬멧 실루엣이 비쳤다). 그래서 지울 범위를 조금 넓힌다.
지울것 = binary_dilation(헬멧, np.ones((인.넓힘, 인.넓힘)))
몸판 = A.copy(); 몸판[지울것, 3] = 0
바닥 = Image.fromarray(몸판, 'RGBA')

# 아래 가운데를 축으로 돌린다 — 축을 판 한가운데에 옮겨 놓고 돌린 뒤 되돌린다
W, H = 층.size
축 = (가운데, 축y)
# 회전하면 옛 헬멧 자리 가장자리에 실낱 틈이 생긴다 — 아주 조금 키워 덮는다
if 인.키움 != 1.0:
    큰W, 큰H = int(W * 인.키움), int(H * 인.키움)
    층 = 층.resize((큰W, 큰H), Image.LANCZOS)
    판 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    판.paste(층, (-(큰W - W) // 2, -(큰H - H) // 2))
    층 = 판
옮김 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
옮김.paste(층, (W // 2 - 축[0], H // 2 - 축[1]))
돌림 = 옮김.rotate(인.각도, resample=Image.BICUBIC, center=(W // 2, H // 2))
if 인.누름 != 1.0:                       # 세로만 살짝 눌러 «앞으로 기울어 짧아 보이는» 결
    새H = max(1, int(H * 인.누름))
    돌림 = 돌림.resize((W, 새H), Image.LANCZOS)
    판 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    판.paste(돌림, (0, H // 2 - 새H // 2 + int(H * (1 - 인.누름) / 2)))
    돌림 = 판
되돌림 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
되돌림.paste(돌림, (축[0] - W // 2, 축[1] - H // 2 + int(H * 인.내림)))

낸것 = 바닥.copy()
낸것.alpha_composite(되돌림)
낸것.save(인.낼곳)
print(f'냈다 → {인.낼곳}')
