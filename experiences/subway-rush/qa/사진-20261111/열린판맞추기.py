"""문 열린 편집 판을 닫힌 원판에 맞춘다(11-11): 카본 편집이 화면을 몇 % 물려 다시 그려서, 문이 다 열린 끝(셰이더가 화면 전체를 열린 판으로 바꿈)에 사람이 미끄러졌다.
천장 · 기둥 · 바닥처럼 움직이지 않는 것의 SIFT 특징점으로 닮음 변환(배율 · 회전 · 이동)을 RANSAC으로 잡아 열린 판을 원판 좌표로 옮기고,
문 칸(+창 칸)만 옮긴 열린 판에서 가져오고 나머지는 원판 화소 그대로 둔다(가장자리 흐림) — 사람은 바이트까지 같다.
  python -I -X utf8 열린판맞추기.py <원판.png> <열린판.png> <내보낼.png> <left|right> [--창 x0,y0,x1,y1 …]
"""
import sys
import cv2
import numpy as np

base_p, open_p, out_p, side = sys.argv[1:5]
wins = []
args = sys.argv[5:]
while args:
    if args[0] == '--창':
        wins.append([float(v) for v in args[1].split(',')]); args = args[2:]
    else:
        raise SystemExit('모르는 인자 ' + args[0])
rd = lambda p: cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)   # cv2.imread · imwrite는 한글 경로를 조용히 못 읽고 못 쓴다
base = rd(base_p); opn = rd(open_p)
h, w = base.shape[:2]
opn = cv2.resize(opn, (w, h), interpolation=cv2.INTER_AREA) if opn.shape[:2] != (h, w) else opn
g1 = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY); g2 = cv2.cvtColor(opn, cv2.COLOR_BGR2GRAY)
# 특징점은 위 35%(천장 · 손잡이 · 짐칸)와 아래 15%(바닥)에서만 — 사람과 문 쪽은 바뀌었을 수 있다
mask = np.zeros_like(g1); mask[: int(h * 0.35)] = 255; mask[int(h * 0.85):] = 255
sift = cv2.SIFT_create(6000)
k1, d1 = sift.detectAndCompute(g1, mask); k2, d2 = sift.detectAndCompute(g2, mask)
m = cv2.BFMatcher().knnMatch(d2, d1, k=2)
good = [a for a, b in m if a.distance < 0.72 * b.distance]
src = np.float32([k2[g.queryIdx].pt for g in good]); dst = np.float32([k1[g.trainIdx].pt for g in good])
M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0, maxIters=5000)
s = float(np.hypot(M[0, 0], M[0, 1])); ang = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
print(f'맞춤: 짝 {len(good)} · 안쪽 {int(inl.sum())} · 배율 {s:.4f} · 회전 {ang:.3f}° · 이동 ({M[0,2]:.1f}, {M[1,2]:.1f})px')
warped = cv2.warpAffine(opn, M, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
# 옮긴 뒤 남은 차이(천장 칸) — 크면 맞춤 실패
roi = (slice(int(h * 0.05), int(h * 0.3)), slice(int(w * 0.2), int(w * 0.8)))
print('천장 칸 평균 차이(0~255):', round(float(np.abs(warped[roi].astype(int) - base[roi].astype(int)).mean()), 2))
# 가져올 칸: 문(그 쪽 끝 0~13% 폭, 높이 28~84%) + 창
sel = np.zeros((h, w), np.float32)
x0, x1 = (0, int(w * 0.13)) if side == 'left' else (int(w * 0.87), w)
sel[int(h * 0.28): int(h * 0.84), x0:x1] = 1
for a, b, c, d in wins:
    sel[int(h * b): int(h * d), int(w * a): int(w * c)] = 1
sel = cv2.GaussianBlur(sel, (0, 0), 9)[..., None]
out = (warped.astype(np.float32) * sel + base.astype(np.float32) * (1 - sel)).astype(np.uint8)
cv2.imencode('.png', out)[1].tofile(out_p)
print('냄', out_p)
