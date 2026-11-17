# 셋째 편 얼굴 닮음(2026-11-17) — OpenCV YuNet + SFace 코사인으로, 그림 속 얼굴마다 배역 넷(캐스팅 사진 세트)과의 닮음을 잰다.
#   같은 사람 기준선 0.363(SFace 안내값), 캐스팅 사진끼리는 0.55~0.6 언저리. 숫자는 거르는 데만 쓰고 고르는 것은 눈과 얼굴판이다(현장 노트 gemini 11-07).
#   python -X utf8 닮음.py <그림…>   → 얼굴마다 (왼쪽부터) 배역별 점수
#   모델은 영문 경로 사본(%USERPROFILE%/.rembg/models/yunet/ — OpenCV가 한글 경로의 ONNX를 못 읽는다).
import os
import sys

import cv2
import numpy as np

HOME = os.environ["USERPROFILE"]
M = os.path.join(HOME, ".rembg", "models", "yunet")
CAST = os.path.join(HOME, "Documents", "SYNK-appsscript", "docs", "마케팅", "PULSE_AI모델_캐스팅_20260930", "site", "img")
WHO = {"서진": "F03", "은정": "F06", "준호": "M05", "민재": "M04"}
KINDS = ("angle-front", "exp-smile", "angle-left", "angle-right", "context", "cut")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def read(p):
    if p.lower().endswith(".webp"):
        from PIL import Image
        return cv2.cvtColor(np.array(Image.open(p).convert("RGB")), cv2.COLOR_RGB2BGR)
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def faces(img, width=1600):
    s = width / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None:
        return []
    return [(f[0] / s, f[2] / s, FR.feature(FR.alignCrop(sm, f))) for f in sorted(r, key=lambda b: b[0]) if f[2] >= 28]


REF = {}
for name, code in WHO.items():
    fs = []
    for k in KINDS:
        p = os.path.join(CAST, code, k + ".webp")
        if os.path.exists(p):
            f = faces(read(p), 900)
            if f:
                fs.append(max(f, key=lambda x: x[1])[2])
    REF[name] = fs


def score(f, fs):
    return float(np.mean([FR.match(f, g, cv2.FaceRecognizerSF_FR_COSINE) for g in fs]))


if __name__ == "__main__":
    for p in sys.argv[1:]:
        fs = faces(read(p))
        print(os.path.basename(p), f"얼굴 {len(fs)}")
        for x, w, f in fs:
            sc = {n: score(f, r) for n, r in REF.items()}
            best = max(sc, key=sc.get)
            print(f"   x={x:5.0f} 폭={w:4.0f}  " + "  ".join(f"{n} {v:.3f}" for n, v in sc.items()) + f"  → {best}")
