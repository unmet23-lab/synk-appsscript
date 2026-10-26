# 11번 이미지 콘티 — 민재 얼굴 닮음(2026-10-26, 8번 이미지콘티_닮음.py와 같은 길).
# OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음). 같은 사람 기준선 0.363(SFace 안내값). 기준은 캐스팅북 민재 세트(M04) 정면 · 좌우 · 웃음 넷의 평균.
#   python -X utf8 이미지콘티_닮음.py <그림…>   (경로를 주지 않으면 받음/ 아래 민재가 나오는 판 — M1 · S04 · S05 · S07 · S10 — 가장 최근 것)
import glob, os, sys
import cv2, numpy as np

HOME = os.environ["USERPROFILE"]
V = os.path.join(HOME, "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p11")
M = os.path.join(HOME, ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
REF = "C:/SYNK-LoRA/casting/wave1_20261019/세트"
REFS = ["M04_angle-front.jpg", "M04_angle-left.jpg", "M04_angle-right.jpg", "M04_exp-smile.jpg"]


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def faces(img, width=1600):
    s = width / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None:
        return []
    return [(f, FR.feature(FR.alignCrop(sm, f))) for f in sorted(r, key=lambda b: -b[2] * b[3]) if f[2] >= 28]


ref = [faces(read(os.path.join(REF, n)))[0][1] for n in REFS]


def score(p):
    fs = faces(read(p))
    if not fs:
        return None
    feat = fs[0][1]
    return round(float(np.mean([FR.match(feat, r, cv2.FaceRecognizerSF_FR_COSINE) for r in ref])), 3)


if __name__ == "__main__":
    paths = sys.argv[1:] or [max(glob.glob(os.path.join(V, "받음", f"{k}_*.jpg")), key=os.path.getmtime)
                              for k in ("M1", "S04", "S05", "S07", "S10") if glob.glob(os.path.join(V, "받음", f"{k}_*.jpg"))]
    for p in paths:
        s = score(p)
        print(os.path.basename(p), "얼굴 못 찾음" if s is None else f"{s:.3f}", "" if s is None else ("같은 사람" if s >= 0.363 else "다른 사람으로 보임"))
