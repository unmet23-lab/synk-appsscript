"""
「제2의 나」 인물 참고 결 시안 (2026-11-02) — 새로 구운 참고 판이 승인 원천과 같은 사람인지 잰다.
T-C `닮음.py`와 같은 모델(OpenCV YuNet + SFace, 같은 사람 기준선 0.363 — 다만 이 묶음의 판정은 T-C에서 잰
「다른 사람끼리 최고값 0.47」보다 충분히 높은가로 본다). 판마다 가장 큰 얼굴 하나를 승인 원천 둘과 견준다.
얼굴 점수가 0.8 아래인 거짓 얼굴(컵 · 소품)은 뺀다(현장노트 gemini 「결 있는 대표…」 함께 항목).

    python -I -X utf8 닮음표.py <인물: taeo|prof> <승인 원천…> -- <새 판…>
"""
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def 얼굴(p):
    img = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    if faces is None:
        return None
    faces = [f for f in faces if f[14] >= 0.8] or list(faces)
    f = max(faces, key=lambda f: f[2] * f[3])  # 가장 큰 얼굴(참고 판은 한 사람)
    return FR.feature(FR.alignCrop(img, f)), round(float(f[2]) / w, 3), round(float(f[14]), 2)


인물 = sys.argv[1]
나눔 = sys.argv.index("--")
원천들, 판들 = sys.argv[2:나눔], sys.argv[나눔 + 1:]
기준 = [(os.path.basename(p), 얼굴(p)[0]) for p in 원천들]
for p in 판들:
    r = 얼굴(p)
    if r is None:
        print(json.dumps({"인물": 인물, "판": os.path.basename(p), "얼굴": "못 찾음"}, ensure_ascii=False))
        continue
    feat, 너비, 확실 = r
    점수 = {n: round(float(FR.match(b, feat, cv2.FaceRecognizerSF_FR_COSINE)), 3) for n, b in 기준}
    print(json.dumps({"인물": 인물, "판": os.path.basename(p), "얼굴너비": 너비, "확실": 확실, "닮음": 점수, "평균": round(sum(점수.values()) / len(점수), 3)}, ensure_ascii=False))
