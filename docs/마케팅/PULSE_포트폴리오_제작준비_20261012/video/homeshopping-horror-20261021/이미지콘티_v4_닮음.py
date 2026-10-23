# 콘티 v4 이미지 콘티의 얼굴 닮음(2026-10-23) — 04 5절 「얼굴마다 참조와 닮음을 잰다」를 숫자로.
# OpenCV YuNet(얼굴 찾기) + SFace(얼굴 특징, 코사인 닮음). 같은 사람 기준선은 0.363(SFace 안내값) — 참조 사진끼리는 0.55~0.6쯤 나온다.
#   python -X utf8 이미지콘티_v4_닮음.py S07 S10 O_A1 …   (정지컷/v4/<컷>.png 고른 판, 없으면 받음/v4/의 가장 최근 판)
#   → 얼굴마다 가장 닮은 배역과 점수 · 기대한 배역의 점수, synk-vendor/…/콘티/v4/컷/_닮음.json
# 모델은 영문 경로 사본(%USERPROFILE%/.rembg/models/yunet/ — OpenCV가 한글 경로의 ONNX를 못 읽는다). 원본은 opencv_zoo.
import glob
import json
import os
import sys

import cv2
import numpy as np

HOME = os.environ["USERPROFILE"]
V = os.path.join(HOME, "Documents", "synk-vendor", "homeshopping-horror-20261021")
M = os.path.join(HOME, ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
REFS = {"A 지유": "C:/SYNK-LoRA/validation/F04_jiyu/refs", "B 리4": os.path.join(V, "배역", "참조", "리4"), "C 통2": os.path.join(V, "배역", "참조", "통2")}
# 컷마다 기대한 배역(왼쪽부터). 셋이 함께인 컷은 화면 왼쪽부터 C · B · A
WANT = {"S07": ["A 지유"], "S12": ["A 지유"], "S14": ["A 지유"], "S18": ["A 지유"], "O_A1": ["A 지유"], "O_A2": ["A 지유"],
        "S08": ["B 리4"], "S17": ["B 리4"], "S20": ["B 리4"], "S22": ["B 리4"], "O_B1": ["B 리4"], "O_B2": ["B 리4"],
        "S16": ["C 통2"], "S28": ["C 통2"], "S30": ["C 통2"], "S26": ["C 통2"], "O_C1": ["C 통2"], "O_C2": ["C 통2"],
        "S01": ["C 통2", "B 리4", "A 지유"], "S03": ["C 통2", "B 리4", "A 지유"], "S10": ["C 통2", "B 리4", "A 지유"]}


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def faces(img, width=1600):
    s = width / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None:
        return []
    out = []
    for f in sorted(r, key=lambda b: b[0]):
        if f[2] < 28:   # 너무 작은 얼굴(넓은 컷 뒤쪽)은 닮음을 못 잰다
            continue
        out.append((f[0] / s, FR.feature(FR.alignCrop(sm, f))))
    return out


def ref_feats():
    feats = {}
    for who, d in REFS.items():
        fs = []
        for n in ("01_hero", "02_left90", "03_right45"):
            img = read(os.path.join(d, f"{n}.jpg"))
            f = faces(img, 900)
            if f:
                fs.append(f[0][1])
        feats[who] = fs
    return feats


def score(f, fs):
    return float(np.mean([FR.match(f, g, cv2.FaceRecognizerSF_FR_COSINE) for g in fs]))


if __name__ == "__main__":
    RF = ref_feats()
    out_p = os.path.join(V, "콘티", "v4", "컷", "_닮음.json")
    log = json.load(open(out_p, encoding="utf-8")) if os.path.exists(out_p) else {}
    for cid in sys.argv[1:]:
        p = os.path.join(V, "정지컷", "v4", f"{cid}.png")
        if not os.path.exists(p):
            c = sorted(glob.glob(os.path.join(V, "받음", "v4", f"{cid}_*.jpg")), key=os.path.getmtime)
            p = c[-1] if c else None
        if not p:
            print(cid, "그림 없음")
            continue
        fl = faces(read(p))
        want = WANT.get(cid, [])
        rows = []
        for i, (x, f) in enumerate(fl):
            sc = {w: round(score(f, RF[w]), 3) for w in RF}
            best = max(sc, key=sc.get)
            exp = want[i] if len(fl) == len(want) and i < len(want) else (want[0] if len(want) == 1 else None)
            rows.append({"x": int(x), "가장닮음": best, "점수": sc[best], "기대": exp, "기대점수": sc.get(exp) if exp else None})
        log[cid] = {"src": os.path.basename(p), "얼굴": rows}
        print(cid, os.path.basename(p), " | ".join(f"{r['기대'] or '?'}={r['기대점수']} (최고 {r['가장닮음']} {r['점수']})" for r in rows) or "얼굴 없음")
    json.dump(log, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
