# 1번 오미톡 캔 — 넓은 사진 한 장에서 시댄스 첫 · 끝 프레임을 잘라 낸다(2026-11-05, Claude).
# 끝 그림 없이 낸 판은 카메라가 지시와 반대로 가거나(6번) 몇 배 움직였다(2번). 같은 사진에서 원본 카메라 곡선대로 자르면 두 그림이 카메라만 다르고 물방울 · 글자가 같다.
#   python -X utf8 첫끝자르기.py   → git 밖 콘티/p1p3/시작그림_20261105/c6_첫.jpg · c6_끝.jpg · c2_첫.jpg · c2_끝.jpg
import os

import cv2
import numpy as np

D = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/시작그림_20261105/"
W, H = 1080, 1920


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def write(p, im):
    ok, b = cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 95])
    assert ok
    b.tofile(p)


def crop(im, cx, cy, width, deg):
    # (cx, cy)가 화면 가운데, 폭 width(사진 px), 그림을 시계 방향으로 deg 돌려 W×H로 뺀다
    s = W / width
    M = cv2.getRotationMatrix2D((cx, cy), -deg, s)
    M[0, 2] += W / 2 - cx
    M[1, 2] += H / 2 - cy
    # 화면 네 모서리가 사진 안인지 본다
    inv = cv2.invertAffineTransform(M)
    for x, y in ((0, 0), (W, 0), (0, H), (W, H)):
        px, py = inv @ np.array([x, y, 1.0])
        assert 0 <= px <= im.shape[1] and 0 <= py <= im.shape[0], ("사진 밖", x, y, px, py)
    return cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_LANCZOS4)


# 6번 — 원본: 그림이 폭의 16% 왼쪽 · 3.7% 아래로, 반시계 3.6°, 다가감 1%. 끝에 낱말표 전체가 들어온다(원본도 끝에 이름 전체)
# 넓은판B: 심사 둘 다 「끝이 밋밋하다」 — A의 옅은 하늘색 바탕을 짙은 전기 파랑 + 네온 테두리로 다시 구운 판(글자는 같다)
im = read(D + "c6_넓은판B.png")
wEnd = 610.0
cxEnd, cyEnd = 262 + wEnd / 2, 410 + wEnd * 16 / 9 / 2
write(D + "c6_끝.jpg", crop(im, cxEnd, cyEnd, wEnd, 0.0))
wStart = wEnd * 1.01
write(D + "c6_첫.jpg", crop(im, cxEnd - 0.16 * wEnd, cyEnd + 0.037 * wEnd * 16 / 9, wStart, 3.6))

# 2번 — 원본: 3.3초에 그림이 폭의 12.5% 오른쪽 · 2.4% 아래로, 6.6% 다가감. 판이 4초라 같은 빠르기로 4초까지 늘려 끝 그림을 만든다(앞 3.3초를 쓴다)
im = read(D + "c2_A.png")
k = 4.0 / 3.3
wStart = 830.0
zoom = 1 + 0.066 * k
wEnd = wStart / zoom
cxS, cyS = im.shape[1] - wStart / 2 - 1, wStart * 16 / 9 / 2 + 40
cxE = cxS - 0.125 * k * wEnd
cyE = cyS - 0.024 * k * wEnd * 16 / 9
write(D + "c2_첫.jpg", crop(im, cxS, cyS, wStart, 0.0))
write(D + "c2_끝.jpg", crop(im, cxE, cyE, wEnd, 0.0))
print("잘랐다", os.listdir(D)[:0])
