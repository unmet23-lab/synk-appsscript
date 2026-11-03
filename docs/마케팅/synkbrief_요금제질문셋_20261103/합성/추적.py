# V1의 프레임마다 초록 화면 자리를 재어 합성/V1_모서리.json에 둔다(1080×1920 기준).
# 손가락이 위 변을 가리면 변 맞춤의 폭이 줄어 화면이 작게 잡히던 것(장면 심사 「폰 아래쪽 초록 띠」)을 고쳤다 — 틀(깨끗한 칸 6~7초의 네 모서리)을 프레임마다 초록의 상하좌우 끝에 맞춰 옮기고 키운다.
# 손은 초록을 가리기만 하므로 끝값은 늘 안쪽으로만 틀린다 → ±0.4초 안에서 가장 바깥 값을 쓴다. 손바닥이 왼쪽을 오래 가리면 왼쪽은 높이와 틀의 가로세로 비로 셈한다.
import cv2, json, sys, numpy as np
sys.path.insert(0, '합성')
import 키
cap = cv2.VideoCapture('장면/원천/V1.mp4')
fps = cap.get(5)
E = []; Q = []
while True:
    ok, f = cap.read()
    if not ok: break
    f = cv2.resize(f, (1080, 1920), interpolation=cv2.INTER_CUBIC)
    m = (키.알파(f) > 0.5).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    ys, xs = np.where(m > 0)
    E.append((ys.min(), ys.max(), xs.min(), xs.max()))
    Q.append(키.네모서리(m))
E = np.array(E, float); Q = np.array(Q, float)
a, b = int(6.0 * fps), int(7.0 * fps)
틀 = np.median(Q[a:b], axis=0); T위, T아래, T왼, T오 = np.median(E[a:b], axis=0)
N = int(0.4 * fps)
def 굴림(v, f):
    return np.array([f(v[max(0, k - N):k + N + 1]) for k in range(len(v))])
위 = 굴림(E[:, 0], np.min); 아래 = 굴림(E[:, 1], np.max); 왼 = 굴림(E[:, 2], np.min); 오 = 굴림(E[:, 3], np.max)
높이 = 아래 - 위
폭셈 = 높이 * (T오 - T왼) / (T아래 - T위)
왼2 = np.where(np.abs((오 - 왼) - 폭셈) > 8, 오 - 폭셈, 왼)
def 다듬기(v):
    p = np.pad(v, (3, 3), mode='edge')
    return np.convolve(p, np.array([1, 2, 3, 4, 3, 2, 1]) / 16, 'valid')
위, 아래, 왼2, 오 = 다듬기(위), 다듬기(아래), 다듬기(왼2), 다듬기(오)
out = []
for k in range(len(위)):
    sx = (오[k] - 왼2[k]) / (T오 - T왼); sy = (아래[k] - 위[k]) / (T아래 - T위)
    q = 틀.copy()
    q[:, 0] = 왼2[k] + (틀[:, 0] - T왼) * sx
    q[:, 1] = 위[k] + (틀[:, 1] - T위) * sy
    out.append(q)
out = np.array(out)
json.dump({'fps': fps, 'q': out.round(2).tolist()}, open('합성/V1_모서리.json', 'w'))
print('왼', 왼2.min().round(0), 왼2.max().round(0), '오', 오.min().round(0), 오.max().round(0), '위', 위.min().round(0), 위.max().round(0), '아래', 아래.min().round(0), 아래.max().round(0))
