# 서리가 번지는 가면 — CSS 둥근 얼룩은 「만화 구름」으로 읽혔다(아르곤 맹검 v8b [K25] [C080]). 1/f 잡음으로 경계를 프랙탈로 깨서 41단 PNG(LA)와 반짝임 점 목록을 낸다.
# 만들기(저장소 뿌리에서): python -X utf8 docs/마케팅/LAB_수고하세요_mn_20261109/소리/서리가면.py
# 결과: remotion/public/mask/00.png ~ 40.png(p = k/40, 540×960 — 화면에서 1080×1920로 키워 쓴다) · remotion/src/film/glints.ts
import os

import numpy as np
from PIL import Image
from scipy import ndimage

여기 = os.path.dirname(os.path.abspath(__file__))
밖 = os.path.join(여기, '..', 'remotion', 'public', 'mask')
코드 = os.path.join(여기, '..', 'remotion', 'src', 'film', 'glints.ts')
os.makedirs(밖, exist_ok=True)

W, H = 540, 960
난수 = np.random.default_rng(20261109)


def fbm(beta):
    """진폭이 1/f^beta인 잡음(평균 0 · 표준편차 1)."""
    fx = np.fft.fftfreq(W)[None, :]
    fy = np.fft.fftfreq(H)[:, None]
    f = np.hypot(fx, fy)
    f[0, 0] = 1.0
    spec = (난수.normal(size=(H, W)) + 1j * 난수.normal(size=(H, W))) / f**beta
    spec[0, 0] = 0
    n = np.fft.ifft2(spec).real
    return (n - n.mean()) / n.std()


y, x = np.mgrid[0:H, 0:W]
# 책상(730, 1270)에서 먼 순서로 언다
dist = np.hypot(x * 2 - 730, y * 2 - 1270) / 1500
A = dist + 0.085 * fbm(1.7) + 0.022 * fbm(1.1)
A = (A - A.min()) / (A.max() - A.min())

for k in range(41):
    p = k / 40
    alpha = np.clip((p * 1.02 - A) / 0.008, 0, 1)
    # 앞쪽에 떨어져 생기는 외딴 서리 섬은 지운다 — 벽에 뜬 「정체불명의 푸른 얼룩 점」(아르곤 맹검 v10 [K25]). 책상에서 번지는 한 덩어리만 남긴다
    라벨, 수 = ndimage.label(alpha > 0.5)
    if 수 > 1:
        씨 = 라벨[635, 365] or (int(np.argmax(ndimage.sum(alpha > 0.5, 라벨, range(1, 수 + 1)))) + 1)
        alpha = alpha * ndimage.binary_dilation(라벨 == 씨, iterations=2)
    la = np.stack([np.full((H, W), 255, np.uint8), (alpha * 255 + 0.5).astype(np.uint8)], axis=-1)
    Image.fromarray(la, 'LA').save(os.path.join(밖, f'{k:02d}.png'), optimize=True)

# 반짝임 — 무작위 점 260개. 경계가 그 점을 지날 때만 켠다(|p - a| < 0.035)
xs = 난수.integers(0, W, 260)
ys = 난수.integers(0, H, 260)
줄들 = [f'  [{int(xx) * 2}, {int(yy) * 2}, {A[yy, xx]:.3f}],' for xx, yy in zip(xs, ys)]
with open(코드, 'w', encoding='utf8', newline='\n') as f:
    f.write('// 서리 경계의 반짝임 점 — 소리/서리가면.py가 낸다. [x, y, a] : 경계가 a(0~1)를 지날 때 그 자리에서 반짝인다.\n')
    f.write('export const GLINTS: [number, number, number][] = [\n')
    f.write('\n'.join(줄들))
    f.write('\n];\n')
크기 = sum(os.path.getsize(os.path.join(밖, n)) for n in os.listdir(밖))
print('가면 41단 끝 ·', round(크기 / 1e6, 2), 'MB · A 0~1 · 점', len(줄들))
