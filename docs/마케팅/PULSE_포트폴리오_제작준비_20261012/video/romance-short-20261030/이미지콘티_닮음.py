# 로맨스 단편 「다 비침」 이미지 콘티 — 얼굴 닮음(2026-10-30, 7번 이미지콘티_닮음.py와 같은 길). OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음).
# 같은 사람 기준선 0.363(SFace 안내값). 기준은 고정 얼굴 세트(C:/SYNK-LoRA/validation/<id>/refs)의 정면 · 옆 · 3/4 셋 평균.
# 그림에 얼굴이 여럿이면 얼굴마다 세 사람 모두와 재어 가장 닮은 사람을 붙인다.
#   python -X utf8 이미지콘티_닮음.py <그림…>   → 그림마다 얼굴별 [사람 닮음]
import glob, os, sys
import cv2, numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
SETS = {"유나": "F01_yuna", "태준": "M02_taejun", "민재": "M04_minjae"}
CODE = {"Y": "유나", "T": "태준", "M": "민재"}
LINE = 0.363


def read(p):
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def faces(img, width=1200):
    s = width / max(img.shape[:2])
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None:
        return []
    return [(f, FR.feature(FR.alignCrop(sm, f))) for f in sorted(r, key=lambda b: -b[2] * b[3]) if f[2] >= 24]


REF = {}
for who, d in SETS.items():
    feats = []
    for p in sorted(glob.glob(f"C:/SYNK-LoRA/validation/{d}/refs/0[123]_*.jpg")):
        fs = faces(read(p))
        if fs:
            feats.append(fs[0][1])
    REF[who] = feats


def sim(feat, who):
    return float(np.mean([FR.match(feat, r, cv2.FaceRecognizerSF_FR_COSINE) for r in REF[who]]))


def score(p):   # 얼굴마다 (가장 닮은 사람, 닮음, 얼굴 높이 비)
    img = read(p)
    out = []
    for f, feat in faces(img):
        sc = {who: sim(feat, who) for who in REF if REF[who]}
        best = max(sc, key=sc.get)
        out.append((best, round(sc[best], 3), round(float(f[3]) / (1200 / max(img.shape[:2])) / img.shape[0], 3)))
    return out


if __name__ == "__main__":
    for p in sys.argv[1:]:
        r = score(p)
        print(os.path.basename(p), " · ".join(f"{w} {s:.3f}{'' if s >= LINE else '(다름)'} 높이 {h}" for w, s, h in r) or "얼굴 못 찾음")
