# 시즌 1 「옆집의 크리스마스」 30 · 34 얼굴 표정 시험의 닮음(2026-10-26) — 「매진 임박」 이미지콘티_v4_닮음.py와 같은 자.
# OpenCV YuNet(얼굴 찾기) + SFace(얼굴 특징, 코사인 닮음). 같은 사람 기준선 0.363(SFace 안내값), 캐스팅북 사진끼리는 0.55~0.6쯤.
#   python -X utf8 이미지콘티_닮음.py C30a C30b C30c C34a …   (받음/의 그 이름 가장 최근 판)
#   → 판마다 배역(민재 M04 · 하린 F02) 고정 얼굴 세트 평균 닮음, git 밖 정지컷/_닮음.json(보드가 읽음)
# 모델은 영문 경로 사본(%USERPROFILE%/.rembg/models/yunet/ — OpenCV가 한글 경로의 ONNX를 못 읽는다).
import glob
import json
import os
import sys

import cv2
import numpy as np

HOME = os.environ["USERPROFILE"]
V = os.path.join(HOME, "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "xmas-neighbors")
M = os.path.join(HOME, ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
REFS = {"민재": "M04", "하린": "F02"}
WHO = {"C30": "민재", "C34": "하린"}


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def faces(img, width=1600):
    s = width / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None:
        return []
    return [FR.feature(FR.alignCrop(sm, f)) for f in sorted(r, key=lambda b: -b[2]) if f[2] >= 28]


def ref_feats():
    out = {}
    for who, code in REFS.items():
        fs = []
        for n in ("hero", "angle-left", "angle-right", "hair-3"):
            f = faces(read(os.path.join(V, "ego", "refs", f"{code}_{n}.jpg")), 900)
            if f:
                fs.append(f[0])
        out[who] = fs
    return out


if __name__ == "__main__":
    RF = ref_feats()
    print({k: len(v) for k, v in RF.items()}, "기준 사진 얼굴")
    out_p = os.path.join(V, "정지컷", "_닮음.json")
    os.makedirs(os.path.dirname(out_p), exist_ok=True)
    log = json.load(open(out_p, encoding="utf-8")) if os.path.exists(out_p) else {}
    for cid in sys.argv[1:]:
        c = sorted(glob.glob(os.path.join(V, "받음", f"{cid}_*.jpg")), key=os.path.getmtime)
        if not c:
            print(cid, "그림 없음")
            continue
        fl = faces(read(c[-1]))
        who = WHO.get(cid[:3])
        if not fl or not who:
            print(cid, os.path.basename(c[-1]), "얼굴 없음")
            continue
        s = float(np.mean([FR.match(fl[0], g, cv2.FaceRecognizerSF_FR_COSINE) for g in RF[who]]))
        log[cid] = round(s, 3)
        print(cid, os.path.basename(c[-1]), who, round(s, 3))
    json.dump(log, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
