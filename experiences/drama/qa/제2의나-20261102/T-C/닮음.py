"""
「제2의 나」 T-C — 셀카 속 두 얼굴이 학생증 얼굴 · 승인 태오와 같은 사람인지 잰다 (2026-11-02).
OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음), 같은 사람 기준선 0.363(안내값) — 카페정지화면 `닮음.py`와 같은 모델
(%USERPROFILE%/.rembg/models/yunet/, 한글 경로 ONNX를 못 읽어 영문 경로 사본). 셀카에는 얼굴이 둘 이상이라
얼굴마다 학생증 · 태오 기준과 견주어, 학생 자리는 학생증과 가장 닮은 얼굴, 태오 자리는 태오 기준과 가장 닮은 얼굴로 고른다.
뒤 학생처럼 작은 얼굴은 셀카 너비의 8% 밑이면 뺀다.

    python -I -X utf8 닮음.py <학생증> <셀카> <태오 기준…>
    python -I -X utf8 닮음.py --서로 <그림…>      그림끼리(학생증 넷이 서로 다른 사람인지) 가장 확실한 얼굴로 표를 낸다
"""
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def 얼굴들(p):
    img = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    if faces is None:
        return [], w
    return [(FR.feature(FR.alignCrop(img, f)), [int(v) for v in f[:4]], float(f[14])) for f in faces], w


def 하나(p):
    fs, _ = 얼굴들(p)
    if not fs:
        raise SystemExit(f"얼굴을 못 찾음: {p}")
    return max(fs, key=lambda x: x[2])[0]


def 닮음(a, b):
    return round(float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE)), 3)


if sys.argv[1] == "--서로":
    ps = sys.argv[2:]
    fs = [하나(p) for p in ps]
    for i, p in enumerate(ps):
        print(json.dumps({"그림": os.path.basename(p), "닮음": {os.path.basename(q): 닮음(fs[i], fs[j]) for j, q in enumerate(ps) if j != i}}, ensure_ascii=False))
    raise SystemExit(0)

학생증, 셀카, *태오들 = sys.argv[1:]
기준학생 = 하나(학생증)
기준태오 = [하나(p) for p in 태오들]
fs, w = 얼굴들(셀카)
fs = [f for f in fs if f[1][2] >= 0.08 * w]
줄 = []
for feat, 상자, 점수 in fs:
    줄.append({"상자": 상자, "확실": round(점수, 2), "학생증": 닮음(기준학생, feat), "태오": [닮음(t, feat) for t in 기준태오]})
학생 = max(줄, key=lambda r: r["학생증"]) if 줄 else None
태오 = max(줄, key=lambda r: max(r["태오"])) if 줄 else None
print(json.dumps({"셀카": os.path.basename(셀카), "얼굴수": len(줄), "학생": 학생, "태오": 태오, "같은얼굴": 학생 is 태오}, ensure_ascii=False))
