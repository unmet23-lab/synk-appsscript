"""
「제2의 나」 인물 참고 결 시안 (2026-11-02) — 얼굴 피부의 잔결(모공 · 노이즈 같은 고주파)을 숫자 하나로 잰다.
YuNet 얼굴 점(눈 · 코 · 입 끝)으로 양 볼 가운데 조각을 잡고, 얼굴을 너비 256px로 맞춘 뒤
「회색 조각 − 가우스 흐림(σ 1.5)」의 표준편차를 낸다. 매끈한 도자기 피부일수록 작다.
같은 그림 안 두 얼굴(셀카의 학생 · 태오)을 견주거나 승인 원천과 새 판을 견줄 때 쓴다 — 절대 기준이 아니라 견줌용.

    python -I -X utf8 결재기.py <그림…>          판마다 얼굴(너비 8% 넘는 것) 왼쪽부터 값
"""
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)


def 잔결(img, f):
    x, y, w, h = f[:4]
    s = 256.0 / w
    작 = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    회 = cv2.cvtColor(작, cv2.COLOR_BGR2GRAY).astype(np.float32)
    고 = 회 - cv2.GaussianBlur(회, (0, 0), 1.5)
    값 = []
    for 눈, 입 in (((f[4], f[5]), (f[10], f[11])), ((f[6], f[7]), (f[12], f[13]))):
        cx, cy = (눈[0] * 0.45 + 입[0] * 0.55) * s, (눈[1] * 0.45 + 입[1] * 0.55) * s
        반 = 18
        조각 = 고[int(cy - 반):int(cy + 반), int(cx - 반):int(cx + 반)]
        if 조각.size:
            값.append(float(조각.std()))
    return round(sum(값) / len(값), 2) if 값 else None


for p in sys.argv[1:]:
    img = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    hh, ww = img.shape[:2]
    FD.setInputSize((ww, hh))
    _, faces = FD.detect(img)
    fs = sorted([f for f in (faces if faces is not None else []) if f[14] >= 0.8 and f[2] >= 0.08 * ww], key=lambda f: f[0])
    print(json.dumps({"판": os.path.basename(p), "얼굴": [{"x": int(f[0]), "너비": int(f[2]), "잔결": 잔결(img, f)} for f in fs]}, ensure_ascii=False))
