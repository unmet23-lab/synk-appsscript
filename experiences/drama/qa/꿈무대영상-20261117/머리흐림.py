"""
꿈 무대 콘티(2026-11-17) — 틀 그림에서 대역의 머리만 흐리게 지운 참고본을 만든다.
유호님 얼굴 작업에서 효과가 있던 방법(원하는 구도 그림에서 머리만 흐린 판을 참고로 넣어 굽기 — 메모 「유호님 얼굴을 만드는 방법」 10-25)을
학생 얼굴 바꾸기에 그대로 쓴다. 대역 얼굴이 남아 있으면 Seedream이 대역 얼굴을 지켜 아바타 닮음이 0.53~0.58에 그쳤다(11-17 첫 시도).

    python -I -X utf8 머리흐림.py <틀 그림> <밖 그림>

얼굴이 둘 넘게 잡히면 검출 점수가 가장 높은 얼굴(카메라를 보는 사람)을 흐린다. 찍힌 「고른 얼굴」 자리를 틀과 대조한다.
"""
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)

src, dst = sys.argv[1], sys.argv[2]
img = cv2.imdecode(np.fromfile(src, np.uint8), 1)
h, w = img.shape[:2]
s = 1600 / max(h, w)
small = cv2.resize(img, (int(w * s), int(h * s)))
FD.setInputSize((small.shape[1], small.shape[0]))
_, faces = FD.detect(small)
if faces is None:
    raise SystemExit("얼굴을 못 찾음")
# 주연은 카메라를 보는 사람이다. 가장 큰 얼굴이 아니라 검출 점수가 가장 높은 얼굴을 고른다.
# (11-17 옥상 여학생용 컷 2: 앞에 선 상대역의 옆얼굴이 더 크게 잡혀 상대역 머리를 흐렸다)
고른 = max(faces, key=lambda f: (round(float(f[14]), 2), f[2]))
x, y, fw, fh = [v / s for v in 고른[:4]]
print("얼굴", [(int(f[0] / s), int(f[1] / s), int(f[2] / s), round(float(f[14]), 2)) for f in faces], "→ 고른 얼굴 왼쪽 위", (int(x), int(y)))
# 머리 전체(머리카락 · 귀 · 턱 아래 조금)를 덮는 타원
cx, cy = x + fw / 2, y + fh * 0.42
ax, ay = fw * 0.95, fh * 1.05
mask = np.zeros((h, w), np.uint8)
cv2.ellipse(mask, (int(cx), int(cy)), (int(ax), int(ay)), 0, 0, 360, 255, -1)
mask = cv2.GaussianBlur(mask, (0, 0), fw * 0.12)
k = int(fw * 0.6) | 1
blur = cv2.GaussianBlur(img, (k, k), 0)
blur = cv2.GaussianBlur(blur, (k, k), 0)
a = (mask.astype(np.float32) / 255)[..., None]
out = (img * (1 - a) + blur * a).astype(np.uint8)
cv2.imencode(os.path.splitext(dst)[1] or ".jpg", out)[1].tofile(dst)
print(f"머리 흐림 {os.path.basename(dst)} · 얼굴 폭 {fw:.0f}px")
