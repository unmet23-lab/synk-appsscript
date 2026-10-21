# 얼굴 피부의 주근깨 점 수를 센다(2026-10-21, 채원 시안 「주근깨 과잉」 고침 — 영상 게이트 Fable 판정 P1).
#   얼굴 폭을 600px로 맞추고(MediaPipe 얼굴 표지), 눈·눈썹·입술·콧구멍과 얼굴 테두리를 뺀 피부에서
#   모공 결을 흐림 1.0으로 누른 뒤 주변(흐림 9)보다 14 넘게 어두운 점 가운데 넓이 10~300px(지름 2~4mm 안팎)만 센다.
#   잣대 맞추기: 대표 사진 51 · 세트 웃음 44, 게이트에서 「과잉」 판정을 받은 옛 시안 S1 172 · S3 129(같은 1.5배 키움 단계).
#   해상도가 다르면 숫자가 달라지므로 같은 단계(원본 896×1184끼리, 키운 1344×1776끼리)에서만 견준다.
#   쓰기(MediaPipe가 있는 C:\SYNK-LoRA\tools\measure 가상환경):
#     python -X utf8 주근깨_세기.py <이름=경로>...   → 이름 · 점 수 · 피부 1만px당 · 이마/볼코/턱 칸별
import os
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from PIL import Image

MODEL = r"C:\SYNK-LoRA\tools\measure\models\face_landmarker.task"
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
LEYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
REYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
LBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RBROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
NOSTRIL = [98, 97, 2, 326, 327, 294, 278, 219, 48, 64]
BLUR, THR, AMIN, AMAX = 1.0, 14.0, 10, 300


def count(det, path):
    im = np.asarray(Image.open(path).convert("RGB"))
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=im))
    if not r.face_landmarks:
        return None
    lm = r.face_landmarks[0]
    pts = np.array([[l.x * im.shape[1], l.y * im.shape[0]] for l in lm])
    s = 600.0 / (pts[454, 0] - pts[234, 0])
    small = cv2.resize(im, (int(im.shape[1] * s), int(im.shape[0] * s)), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    P = (pts * s).astype(np.int32)
    mask = np.zeros(small.shape[:2], np.uint8)
    cv2.fillPoly(mask, [P[OVAL]], 1)
    for grp, grow in ((LEYE, 18), (REYE, 18), (LBROW, 14), (RBROW, 14), (LIPS, 14), (NOSTRIL, 10)):
        m = np.zeros_like(mask)
        cv2.fillPoly(m, [cv2.convexHull(P[grp])], 1)
        mask[cv2.dilate(m, np.ones((grow, grow), np.uint8)) > 0] = 0
    mask = cv2.erode(mask, np.ones((15, 15), np.uint8))  # 얼굴 테두리 · 머리카락 경계 뺌
    L = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_RGB2LAB)[..., 0].astype(np.float32), (0, 0), BLUR)
    dark = ((cv2.GaussianBlur(L, (0, 0), 9) - L) > THR).astype(np.uint8) & mask
    n, _, st, cen = cv2.connectedComponentsWithStats(dark, 8)
    keep = [i for i in range(1, n) if AMIN <= st[i, cv2.CC_STAT_AREA] <= AMAX]
    brow_y, nose_y = P[LBROW + RBROW, 1].min(), P[2, 1]
    reg = {"이마": 0, "볼코": 0, "턱": 0}
    for i in keep:
        y = cen[i][1]
        reg["이마" if y < brow_y else ("볼코" if y < nose_y else "턱")] += 1
    return len(keep), len(keep) / int(mask.sum()) * 1e4, reg


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    det = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(base_options=mp_python.BaseOptions(model_asset_path=MODEL), num_faces=1))
    for arg in sys.argv[1:]:
        name, path = arg.split("=", 1) if "=" in arg else (os.path.basename(arg), arg)
        r = count(det, path)
        if r is None:
            print(f"{name}\t얼굴 없음")
            continue
        n, per, reg = r
        print(f"{name}\t{n}\t{per:.1f}/1만px\t" + " ".join(f"{k}{v}" for k, v in reg.items()), flush=True)
