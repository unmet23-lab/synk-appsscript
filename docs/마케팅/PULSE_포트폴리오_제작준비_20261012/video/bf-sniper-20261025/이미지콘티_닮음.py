# 블프 스나이퍼 이미지 콘티의 얼굴 닮음(2026-10-26) — 「매진 임박」 v4 닮음 도구를 준호 한 사람용으로 줄였다.
# OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음). 기준은 준호 고정 얼굴 세트(ego/refs의 얼굴 사진) 평균.
# 장부 S33: 좋다고 하신 판 0.51~0.53, 다르다고 하신 판 0.35~0.48, 같은 사람 기준선 0.363.
#   python -X utf8 이미지콘티_닮음.py S03 S07 …   → 컷마다 받음/<컷>_*.jpg 모든 판의 가장 큰 얼굴 점수(높은 순), 콘티/bf-sniper/받음/_닮음.json
import glob
import json
import os
import sys

import cv2
import numpy as np

V = r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper"
M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")   # 영문 경로 사본 — OpenCV가 한글 경로의 ONNX를 못 읽는다
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
REFS = ["M05_hero", "M05_angle-front", "M05_angle-left", "M05_angle-right", "M05_exp-smile", "M05_context"]


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def biggest_face(img, width=1600):
    s = width / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None:
        return None
    f = max(r, key=lambda b: b[2] * b[3])
    if f[2] < 28:   # 너무 작은 얼굴은 못 잰다
        return None
    return FR.feature(FR.alignCrop(sm, f)), int(f[2] / s)


ref = [x[0] for x in (biggest_face(read(os.path.join(V, "ego", "refs", n + ".jpg")), 900) for n in REFS) if x]

if __name__ == "__main__":
    out_p = os.path.join(V, "받음", "_닮음.json")
    log = json.load(open(out_p, encoding="utf-8")) if os.path.exists(out_p) else {}
    for cid in sys.argv[1:]:
        rows = []
        for p in glob.glob(os.path.join(V, "받음", f"{cid}_*.jpg")):
            got = biggest_face(read(p))
            sc = round(float(np.mean([FR.match(got[0], g, cv2.FaceRecognizerSF_FR_COSINE) for g in ref])), 3) if got else None
            rows.append({"판": os.path.basename(p), "닮음": sc, "얼굴폭": got[1] if got else None})
        rows.sort(key=lambda r: -(r["닮음"] or 0))
        log[cid] = rows
        for r in rows:
            print(cid, r["판"], r["닮음"], f"얼굴폭 {r['얼굴폭']}px" if r["얼굴폭"] else "얼굴 못 찾음")
    json.dump(log, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
