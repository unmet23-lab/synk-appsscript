# 가까운 칸(k2) 몽글 층 — tools/층나누기.py의 AI 누끼가 오른쪽 눈 · 수건 오른쪽을 반투명으로 잘라(11-23 v2 준비) 빈 판 k2e와의 차이로 다시 오린다.
#   python -I -X utf8 판/_가까이층.py   → 판/층/k2_m.png(투명 층) · 판/층/k2_bg.jpg(= 빈 판 k2e)
import os
import cv2
import numpy as np
from PIL import Image
여기 = os.path.dirname(os.path.abspath(__file__))
원본 = np.asarray(Image.open(os.path.join(여기, 'k2_082128.png')).convert('RGB')).astype(np.float32)
빈판 = np.asarray(Image.open(os.path.join(여기, 'k2e_085158.png')).convert('RGB')).astype(np.float32)
# 빈 판을 원본에 맞춘다(몽글 상자 밖만 보고 아핀 ECC)
g1 = cv2.cvtColor(원본.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
g2 = cv2.cvtColor(빈판.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
밖 = np.ones(g1.shape, np.uint8); 밖[300:1360, 0:700] = 0
w = np.eye(2, 3, dtype=np.float32)
try:
    _, w = cv2.findTransformECC(g1, g2, w, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), 밖, 5)
    빈판 = cv2.warpAffine(빈판, w, (빈판.shape[1], 빈판.shape[0]), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
except cv2.error:
    pass
차 = np.sqrt(((원본 - 빈판) ** 2).sum(2))
hsv = cv2.cvtColor(원본.astype(np.uint8), cv2.COLOR_RGB2HSV)
갈색 = (hsv[:, :, 2] < 125)  # 계란 껍데기 · 그릇(어두운 밤색) — 몽글(밝은 코랄) · 수건(크림)은 밝다
# GrabCut 씨앗: 상자 밖 = 배경, 어두운 밤색 · 차이 작은 곳 = 배경 쪽, 차이 큰 곳 = 몽글 쪽, 몽글 몸 한가운데 = 몽글
씨 = np.full(차.shape, cv2.GC_BGD, np.uint8)
씨[330:1345, 0:670] = cv2.GC_PR_BGD
씨[(차 > 38) & (씨 == cv2.GC_PR_BGD)] = cv2.GC_PR_FGD
xs = np.arange(차.shape[1])[None, :]; ys = np.arange(차.shape[0])[:, None]
씨[갈색 & (씨 != cv2.GC_BGD) & ((xs > 540) | ((xs > 420) & (ys > 960)))] = cv2.GC_BGD  # 계란 · 그릇 — 오른쪽 구슬 눈(어둡다)은 빼고
씨[330:388, 200:430] = cv2.GC_BGD  # 수건 띠 위 벽(빈 판과 조금 달라 차이가 남는다)
씨[380:1250, 40:400] = cv2.GC_FGD
씨[815:950, 425:535] = cv2.GC_FGD  # 오른쪽 구슬 눈
bg_m = np.zeros((1, 65), np.float64); fg_m = np.zeros((1, 65), np.float64)
cv2.grabCut(원본.astype(np.uint8), 씨, None, bg_m, fg_m, 6, cv2.GC_INIT_WITH_MASK)
m = ((씨 == cv2.GC_FGD) | (씨 == cv2.GC_PR_FGD)).astype(np.uint8)
벽띠 = np.zeros_like(m); 벽띠[330:425, 180:445] = 1
m[(벽띠 > 0) & (hsv[:, :, 1] > 110) & (차 < 70)] = 0  # 수건 위 주황 벽 띠(크림 수건은 채도가 낮고 빈 판과 차이가 크다)
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
m = (lab == k).astype(np.uint8)
윤곽, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
채움 = np.zeros_like(m)
cv2.drawContours(채움, 윤곽, -1, 1, thickness=cv2.FILLED)
a = cv2.GaussianBlur(cv2.erode(채움, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1.6)
층 = np.dstack([원본.astype(np.uint8), (a * 255).clip(0, 255).astype(np.uint8)])
os.makedirs(os.path.join(여기, '층'), exist_ok=True)
Image.fromarray(층, 'RGBA').save(os.path.join(여기, '층', 'k2_m.png'))
Image.fromarray(빈판.astype(np.uint8)).save(os.path.join(여기, '층', 'k2_bg.jpg'), quality=93)
# 튐 층 — 닿는 자리의 흰 김 줄기는 몸 층에서 빼고 따로 둔다(닿은 뒤에만 보이게)
튐자리 = np.zeros(m.shape, bool); 튐자리[900:1070, 465:590] = True
흰 = 튐자리 & (hsv[:, :, 1] < 90) & (hsv[:, :, 2] > 170)
흰 = cv2.dilate(흰.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
튐a = (cv2.GaussianBlur(흰.astype(np.float32), (0, 0), 1.2) * 255).clip(0, 255).astype(np.uint8)
Image.fromarray(np.dstack([원본.astype(np.uint8), 튐a]), 'RGBA').save(os.path.join(여기, '층', 'k2_튐.png'))
몸a = np.asarray(Image.open(os.path.join(여기, '층', 'k2_m.png')))[:, :, 3].astype(np.float32)
몸a[흰] = 0
Image.fromarray(np.dstack([원본.astype(np.uint8), 몸a.astype(np.uint8)]), 'RGBA').save(os.path.join(여기, '층', 'k2_m.png'))
ys, xs = np.nonzero(채움)
print('k2 층 bbox', xs.min(), ys.min(), xs.max(), ys.max())
