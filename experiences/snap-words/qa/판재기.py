# 찰칵 낱말 — 구운 장소 사진에서 남색 판을 색으로 찾아 모서리를 잰다(places.mjs의 좌표 출처). 흰 판 · 원근 판은 격자 그림을 눈으로 보고 잰다.
#   python -X utf8 experiences/snap-words/qa/판재기.py <그림.png> <x0> <y0> <x1> <y1> [최소넓이]
import sys
import cv2
import numpy as np
path, *box = sys.argv[1:6]
x0, y0, x1, y1 = map(int, box)
min_area = int(sys.argv[6]) if len(sys.argv) > 6 else 800
img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
mask = cv2.inRange(hsv, np.array((100, 60, 30)), np.array((125, 255, 170)))
area = np.zeros_like(mask)
area[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
area = cv2.morphologyEx(area, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
contours, _ = cv2.findContours(area, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
for c in sorted(contours, key=lambda c: cv2.boundingRect(c)[1::-1]):
    if cv2.contourArea(c) >= min_area:
        print(cv2.boundingRect(c))
