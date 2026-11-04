"""
말 랠리 캠퍼스 판(2026-11-04) — 구운 판의 태오가 승인 얼굴과 같은 사람인지 숫자로 본다(제2의 나 셀카 시험 닮음.py와 같은 모델 YuNet + SFace).
관문(결정 11-03 「태오 기준 사진도 웃는 자연 사진」): 웃는 기준 · F1/C1 평균 둘 다 0.55 이상이면 다른 사람은 아니다(다른 사람 최고 0.47).
그 위는 눈으로 본다(F1 · 웃는 기준 · 후보를 나란히 — 눈꼬리 · 눈썹 · 코끝 · 앞머리 결).

    python -I -X utf8 닮음재기.py <판…>
"""
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
REF = r"C:\Users\q1212\Documents\SYNK-appsscript\.tmp\talk-rally-world-20261104\nb\refs"


def 얼굴(p):
    img = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    if max(h, w) > 1200:
        s = 1200 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    faces = [] if faces is None else [f for f in faces if f[14] >= 0.6]
    if not faces:
        return None, 0
    f = max(faces, key=lambda x: x[2])   # 가장 큰 얼굴(앞의 태오 — 뒤의 동아리 사람은 작다)
    return FR.feature(FR.alignCrop(img, f)), float(f[2]) / w


def 같음(a, b):
    return float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


if __name__ == "__main__":
    f1, _ = 얼굴(os.path.join(REF, "taeo2-f1.jpg"))
    c1, _ = 얼굴(os.path.join(REF, "taeo2-c1.jpg"))
    sm, _ = 얼굴(os.path.join(REF, "taeo2-smile.jpg"))
    for p in sys.argv[1:]:
        v, fw = 얼굴(p)
        if v is None:
            print(f"{os.path.basename(p)}: 얼굴을 못 찾음")
            continue
        웃음, 평균 = 같음(v, sm), (같음(v, f1) + 같음(v, c1)) / 2
        print(f"{os.path.basename(p)}: 웃는 기준 {웃음:.3f} · F1/C1 평균 {평균:.3f} · 얼굴 폭 {fw:.1%} → {'통과' if 웃음 >= 0.55 and 평균 >= 0.55 else '걸림'}")
