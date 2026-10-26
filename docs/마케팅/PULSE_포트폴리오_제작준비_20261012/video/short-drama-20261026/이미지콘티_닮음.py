# 7번 이미지 콘티 — 얼굴 닮음(2026-10-26, 11번 이미지콘티_닮음.py와 같은 길). OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음).
# 같은 사람 기준선 0.363(SFace 안내값). 기준은 고정 얼굴 세트(C:/SYNK-LoRA/validation/<id>/refs)의 정면 · 옆 · 3/4 셋 평균.
# 그림에 얼굴이 여럿이면 얼굴마다 네 사람 모두와 재어 가장 닮은 사람을 붙인다(두 사람 컷 — 업힌 이안 · 아래 민재 등).
#   python -X utf8 이미지콘티_닮음.py <그림…>           → 그림마다 얼굴별 [사람 닮음]
#   python -X utf8 이미지콘티_닮음.py --받음 [접두…]     → 콘티/p7/받음/에서 접두(예 1-5)마다 받은 판 전부
import glob, json, os, sys
import cv2, numpy as np

HOME = os.environ["USERPROFILE"]
V = os.path.join(HOME, "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p7")
M = os.path.join(HOME, ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
SETS = {"서진": "F03_seojin", "이안": "M01_ian", "민재": "M04_minjae", "소연": "F05_soyeon"}
LINE = 0.363


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


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


def score(p):
    out = []
    for f, feat in faces(read(p)):
        sc = {who: float(np.mean([FR.match(feat, r, cv2.FaceRecognizerSF_FR_COSINE) for r in refs])) for who, refs in REF.items() if refs}
        best = max(sc, key=sc.get)
        out.append((best, round(sc[best], 3), round(f[2] / 1.0)))
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--받음":
        keys = args[1:]
        paths = []
        for k in keys:
            paths += sorted(glob.glob(os.path.join(V, "받음", f"{k}_*.*")), key=os.path.getmtime)
    else:
        paths = args
    rec = {}
    for p in paths:
        r = score(p)
        rec[os.path.basename(p)] = r
        txt = " · ".join(f"{w} {s:.3f}{'' if s >= LINE else '(다름)'}" for w, s, _ in r) or "얼굴 못 찾음"
        print(os.path.basename(p), txt)
    if rec:
        log = os.path.join(V, "받음", "_닮음.json")
        old = json.load(open(log, encoding="utf-8")) if os.path.exists(log) else {}
        old.update(rec)
        json.dump(old, open(log, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
