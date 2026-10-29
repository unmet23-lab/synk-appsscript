"""B18 장면 2판 재료 — 「전」 사진에서 옛 종이(+옛 테이프)와 「카드 가능」 쪽지를 따로 오려 뜯기는 층으로 쓰고,
「후」 벽(그림/후_벽.png) 위 체크 자리를 메뉴 그림 좌표에서 원근 변환으로 구한다(Remotion 1080×1920 좌표).

  python 자료/뜯기층.py   → remotion/public/img/전_종이.png · 전_쪽지.png · 후_벽.png · 전.png, 표준출력에 자리 JSON
"""
import json
import cv2
import numpy as np
from PIL import Image

wall = np.array(Image.open('그림/전_메뉴판.png').convert('RGB'))
H, W = wall.shape[:2]
a = wall.astype(int)
mask = ((a[:, :, 0] - a[:, :, 2]) > 55).astype(np.uint8) * 255
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8))
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hull = cv2.convexHull(max(cs, key=cv2.contourArea))
quad = cv2.approxPolyDP(hull, 0.03 * cv2.arcLength(hull, True), True).reshape(-1, 2).astype(np.float32)
quad = quad[np.argsort(np.arctan2(quad[:, 1] - quad[:, 1].mean(), quad[:, 0] - quad[:, 0].mean()))]
quad = np.roll(quad, -int(np.argmin(quad.sum(1))), axis=0)

paper = np.zeros((H, W), np.uint8)
cv2.fillConvexPoly(paper, hull.reshape(-1, 2), 255)  # 가장 큰 노란 덩이의 볼록 껍질 — 흰 스티커 구멍까지 메운다
paper = cv2.dilate(paper, np.ones((15, 15), np.uint8))
for x0, y0, x1, y1 in ((0, 140, 150, 300), (700, 170, 900, 320), (0, 1320, 140, 1490), (700, 1320, 900, 1480)):
    paper[y0:y1, x0:x1] = np.maximum(paper[y0:y1, x0:x1], (np.abs(a[y0:y1, x0:x1].mean(2) - a[y0:y1, x0:x1].mean()) > 6).astype(np.uint8) * 255)
paper = cv2.GaussianBlur(paper, (0, 0), 1.5)
note = np.zeros((H, W), np.uint8)
note[1385:1535, 700:915] = 255
note = cv2.GaussianBlur(note, (0, 0), 1.5)
paper = np.minimum(paper, 255 - note)  # 쪽지는 쪽지 층만(종이 층 테이프 칸이 쪽지 윗부분을 함께 오려 뜯을 때 둘로 보였다)

S = 1080 / W
def save(rgba, name, size=(1080, 1920)):
    Image.fromarray(rgba).resize(size, Image.LANCZOS).save(f'remotion/public/img/{name}')
save(np.dstack([wall, paper]), '전_종이.png')
save(np.dstack([wall, note]), '전_쪽지.png')
save(np.array(Image.open('그림/후_벽.png').convert('RGB')), '후_벽.png')
save(wall, '전.png')

# 체크 자리: 메뉴 그림(1024×1536)에서 잰 값 → 여백 18px 종이 → 벽 원근 → 1080 폭
m = 18
src = np.float32([[0, 0], [1024 + 2 * m, 0], [1024 + 2 * m, 1536 + 2 * m], [0, 1536 + 2 * m]])
M = cv2.getPerspectiveTransform(src, quad)
def on_wall(x, y):
    p = cv2.perspectiveTransform(np.float32([[[x + m, y + m]]]), M)[0, 0]
    return [round(float(p[0] * S)), round(float(p[1] * S))]
spots = {
    '후_4000': on_wall(830, 385), '후_6500': on_wall(835, 812), '후_카드': on_wall(865, 1395), '후_줄': on_wall(520, 600),
    '전_4000': [round(600 * S), round(445 * S)], '전_품절': [round(435 * S), round(672 * S)], '전_쪽지': [round(800 * S), round(1460 * S)],
    '전_6500': [round(585 * S), round(895 * S)],
}
print(json.dumps(spots, ensure_ascii=False))
