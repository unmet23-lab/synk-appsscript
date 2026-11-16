"""
꿈 무대 콘티(2026-11-17) — 드리미나 웹에서 받은 그림의 왼쪽 위 「AI」 표시를 지운다(unmet23 계정은 받은 그림에 표시가 찍힌다).
틀을 GPT 얼굴 넣기의 참고로 넣기 전에, 그리고 검수용 판에 올리기 전에 돌린다. 웹일감.py의 참고()와 같은 방법이다.

    python -I -X utf8 표시지움.py <받은 그림> <밖 그림>
"""
import os
import sys

import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
im = cv2.imdecode(np.fromfile(src, np.uint8), 1)
s = im.shape[1] / 1920
m = np.zeros(im.shape[:2], np.uint8)
m[int(10 * s):int(70 * s), int(10 * s):int(90 * s)] = 255
im = cv2.inpaint(im, m, 7, cv2.INPAINT_TELEA)
cv2.imencode(os.path.splitext(dst)[1] or ".png", im)[1].tofile(dst)
print("표시 지움", os.path.basename(dst))
