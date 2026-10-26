# 2번 이미지 콘티 — 태준 얼굴 닮음(2026-10-26, 11번 이미지콘티_닮음.py와 같은 길).
# OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음). 같은 사람 기준선 0.363(SFace 안내값). 기준은 캐스팅북 태준 사진(M02) 정면 · 왼쪽 90° · 오른쪽 45° 셋의 평균
# (전신 사진은 얼굴이 작아 뺀다 — 고개를 젖힌 5번 · 옆으로 돌린 16번 끝은 낮게 나올 수 있다).
#   python -X utf8 이미지콘티_닮음.py <그림…>   (경로를 주지 않으면 받음/ 아래 태준 얼굴 컷 P05 · P12 · P16 가운데 가장 최근 것)
import glob, os, sys
import cv2, numpy as np

HOME = os.environ["USERPROFILE"]
V = os.path.join(HOME, "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p2")
M = os.path.join(HOME, ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
REF = "C:/SYNK-LoRA/validation/M02_taejun/refs"
REFS = ["01_hero.jpg", "02_left90.jpg", "03_right45.jpg"]


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


ref = [f[0][1] for f in (faces(read(os.path.join(REF, n))) for n in REFS) if f]


def score(p):
    fs = faces(read(p))
    if not fs:
        return None
    feat = fs[0][1]
    return round(float(np.mean([FR.match(feat, r, cv2.FaceRecognizerSF_FR_COSINE) for r in ref])), 3)


if __name__ == "__main__":
    paths = sys.argv[1:] or [max(g, key=os.path.getmtime) for k in ("P05", "P12", "P16")
                              for g in [glob.glob(os.path.join(V, "받음", f"{k}_*.png")) + glob.glob(os.path.join(V, "받음", f"{k}_*.jpg"))] if g]
    print("기준 사진", len(ref), "장")
    for p in paths:
        s = score(p)
        print(os.path.basename(p), "얼굴 못 찾음" if s is None else f"{s:.3f}", "" if s is None else ("같은 사람" if s >= 0.363 else "다른 사람으로 보임"))
