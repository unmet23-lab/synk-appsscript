"""B18 「후」를 같은 벽 사진에 앉힌다 — ChatGPT가 만든 메뉴판(그림/후_결과.png)을 옛 종이 자리(색으로 찾은 네 귀퉁이)에
원근만 맞춰 얹는다. 글자는 결과 그대로이고(새로 그리지 않음), 빛 · 결 · 테이프 · 그림자만 사진에 맞춘다. 옛 「카드 가능」 쪽지는
메뉴판 안으로 들어갔으니 벽에서 지운다. 화면에는 「인쇄해 붙인 모습(합성)」으로 밝힌다.

  python 자료/벽에앉히기.py   → 그림/후_벽.png (941×1672, 전_메뉴판.png와 같은 틀)
"""
import cv2
import numpy as np
from PIL import Image

rng = np.random.default_rng(1030)
wall = np.array(Image.open('그림/전_메뉴판.png').convert('RGB')).astype(np.float32)
menu = np.array(Image.open('그림/후_결과.png').convert('RGB')).astype(np.float32)
H, W = wall.shape[:2]

# 옛 종이: 노란 기 (R−B > 55)로 찾은 외곽(볼록 껍질 → 네 점, 테이프까지 덮는다)
a = wall.astype(int)
mask = ((a[:, :, 0] - a[:, :, 2]) > 55).astype(np.uint8) * 255
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8))
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hull = cv2.convexHull(max(cs, key=cv2.contourArea))
quad = cv2.approxPolyDP(hull, 0.03 * cv2.arcLength(hull, True), True).reshape(-1, 2).astype(np.float32)
assert len(quad) == 4, quad
quad = quad[np.argsort(np.arctan2(quad[:, 1] - quad[:, 1].mean(), quad[:, 0] - quad[:, 0].mean()))]  # 왼위 · 오위 · 오아래 · 왼아래
quad = np.roll(quad, -int(np.argmin(quad.sum(1))), axis=0)

# 옛 종이 · 옛 테이프 · 옛 쪽지 자리를 벽으로 메운다(새 종이가 덮지 못하는 가장자리 · 들린 귀퉁이까지). 작게 줄여 메운 뒤 키워 번짐을 고르게 하고,
# 벽 결(잔 무늬)은 메운 자리에만 다시 얹는다.
fill = cv2.dilate(mask, np.ones((41, 41), np.uint8))
for x0, y0, x1, y1 in ((0, 140, 150, 300), (700, 170, 900, 320), (0, 1320, 140, 1490), (700, 1320, 900, 1480), (690, 1370, 925, 1545)):
    fill[y0:y1, x0:x1] = 255
small = cv2.resize(np.clip(wall, 0, 255).astype(np.uint8), (W // 4, H // 4), interpolation=cv2.INTER_AREA)
small_fill = cv2.resize(fill, (W // 4, H // 4), interpolation=cv2.INTER_NEAREST)
base = cv2.resize(cv2.inpaint(small, small_fill, 15, cv2.INPAINT_TELEA), (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
base = cv2.GaussianBlur(base, (0, 0), 6)
# 벽 결: 종이가 없던 오른쪽 벽(x 860~935)의 잔 무늬 세기에 맞춘 새 잔 무늬(사진 결을 옮기면 옛 글씨 그림자가 따라온다)
pure = wall[300:1300, 860:935]
target = float((pure - cv2.GaussianBlur(pure, (0, 0), 4)).std())
noise = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 1.3)
grain = (noise / noise.std() * target)[:, :, None].repeat(3, 2)
soft = cv2.GaussianBlur(fill.astype(np.float32) / 255, (0, 0), 6)[:, :, None]
wall_u8 = wall * (1 - soft) + (base + grain) * soft

# 인쇄한 종이: 결과 둘레에 흰 여백 18px
m = 18
sheet = np.full((menu.shape[0] + 2 * m, menu.shape[1] + 2 * m, 3), 244, np.float32)
sheet[m:-m, m:-m] = 18 + menu * 0.9  # 무광 인쇄라 검정이 조금 뜬다
sh, sw = sheet.shape[:2]
src = np.float32([[0, 0], [sw, 0], [sw, sh], [0, sh]])
M = cv2.getPerspectiveTransform(src, quad)
warped = cv2.warpPerspective(sheet, M, (W, H), flags=cv2.INTER_CUBIC)
alpha = cv2.warpPerspective(np.ones((sh, sw), np.float32), M, (W, H), flags=cv2.INTER_LINEAR)

# 빛: 사진의 큰 밝기 흐름(형광등 · 왼쪽 위 번짐 · 가장자리 어둠)을 종이에도 · 따뜻한 빛 조금
lum = cv2.GaussianBlur(cv2.cvtColor(np.clip(wall, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32), (0, 0), 70)
light = lum / np.median(lum[alpha > 0.5])
warped = warped * (0.7 + 0.3 * light[:, :, None]) * np.float32([1.0, 0.97, 0.9])
warped = cv2.GaussianBlur(warped, (0, 0), 0.7) + rng.normal(0, 3.0, warped.shape).astype(np.float32)

# 그림자(종이 아래로 살짝)
shadow = cv2.GaussianBlur(cv2.warpAffine(alpha, np.float32([[1, 0, 5], [0, 1, 7]]), (W, H)), (0, 0), 9)
out = wall_u8 * (1 - 0.28 * shadow[:, :, None])
out = out * (1 - alpha[:, :, None]) + warped * alpha[:, :, None]

# 새 테이프(귀퉁이마다 비스듬히, 반투명)
for (x, y), ang in zip(quad, (-40, 40, -40, 40)):
    tape = np.zeros((H, W), np.uint8)
    box = cv2.boxPoints(((float(x), float(y)), (110, 34), ang)).astype(np.int32)
    cv2.fillConvexPoly(tape, box, 255)
    t = cv2.GaussianBlur(tape.astype(np.float32) / 255, (0, 0), 1.2)[:, :, None]
    out = out * (1 - 0.3 * t) + (np.float32([236, 234, 226]) + rng.normal(0, 4, (H, W, 3)).astype(np.float32)) * 0.3 * t

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save('그림/후_벽.png')
print('quad', quad.round().tolist())
