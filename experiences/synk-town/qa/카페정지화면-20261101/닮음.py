"""
카운터 손님 얼굴이 드라마 승인 얼굴과 같은 사람인지 잰다 (2026-11-01) — OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음).
SFace 같은 사람 기준선 0.363(안내값). 모델은 %USERPROFILE%/.rembg/models/yunet/(영문 경로 사본 — 한글 경로 ONNX를 못 읽음,
PULSE 「닮음.py」와 같은 모델). 그림 하나에 가장 확실한 얼굴 하나만 잰다.

    python -I -X utf8 닮음.py <기준 그림> <그림 …>
"""
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def 특징(p):
    img = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    if faces is None or not len(faces):
        return None, None
    # 가장 큰 상자가 아니라 가장 확실한 얼굴 — 카운터 판은 앞쪽 학생 손 · 펜을 큰 얼굴로 잡았다(11-01)
    f = max(faces, key=lambda r: r[14])
    return FR.feature(FR.alignCrop(img, f)), [int(v) for v in f[:4]]


기준, _ = 특징(sys.argv[1])
if 기준 is None:
    raise SystemExit("기준 그림에서 얼굴을 못 찾음")
for p in sys.argv[2:]:
    f, 상자 = 특징(p)
    닮음 = None if f is None else round(float(FR.match(기준, f, cv2.FaceRecognizerSF_FR_COSINE)), 3)
    print(json.dumps({"그림": os.path.basename(p), "닮음": 닮음, "얼굴상자": 상자}, ensure_ascii=False))
