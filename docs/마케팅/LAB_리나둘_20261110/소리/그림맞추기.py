# 같은 무대로 다시 구운 판(반대로 기운 줄다리기)을 바탕 판의 구도에 맞춘다 — 벽 · 선반 · 등(위 45%)을 기준으로 닮음 변환을 찾아 옮긴다.
# GPT 이미지는 「같은 카메라」로 고쳐 달라고 해도 조금 당겨 굽는다. 그대로 번갈아 바꾸면 카메라가 튀어 보여서 맞춘 판을 쓴다.
#   python -I -X utf8 docs/마케팅/LAB_리나둘_20261110/소리/그림맞추기.py <바탕.jpg> <맞출.png> <낼.jpg>
import sys
import cv2
import numpy as np

바탕, 맞출, 낼 = sys.argv[1:4]
rd = lambda f: cv2.imdecode(np.fromfile(f, np.uint8), cv2.IMREAD_COLOR)  # cv2.imread는 한글 경로를 못 읽는다(현장 노트 윈도우 셸)
a = rd(바탕)
b = rd(맞출)
H, W = a.shape[:2]
b = cv2.resize(b, (W, H), interpolation=cv2.INTER_LANCZOS4)
ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
mask = np.zeros_like(ga)
mask[: int(H * 0.45), :] = 255
orb = cv2.ORB_create(6000)
ka, da = orb.detectAndCompute(ga, mask)
kb, db = orb.detectAndCompute(gb, mask)
m = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(db, da)
m = sorted(m, key=lambda x: x.distance)[:800]
src = np.float32([kb[x.queryIdx].pt for x in m])
dst = np.float32([ka[x.trainIdx].pt for x in m])
M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4)
s = float(np.hypot(M[0, 0], M[0, 1]))
print(f'짝 {len(m)} · 맞은 {int(inl.sum())} · 배율 {s:.3f} · 옮김 {M[0,2]:.1f},{M[1,2]:.1f}')
out = cv2.warpAffine(b, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tofile(낼)
d = cv2.absdiff(cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)[: int(H * 0.45)], ga[: int(H * 0.45)])
print(f'위 45% 차이 평균 {d.mean():.1f}')
