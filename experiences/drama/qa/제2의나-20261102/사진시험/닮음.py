"""
「제2의 나」 사진 기반 아바타 시험 — 기준 사진 · 셀카가 올린 사람과 얼마나 같은지 잰다 (2026-11-03).
T-C `닮음.py`와 같은 모델(YuNet + SFace). 큰 원본은 긴 변 1200으로 줄여 찾는다(현장노트 gemini 「YuNet이 1792×2400 원본에서는…」).
기준선: 유호님은 승인 시안 B(10-01 「확실히 내 얼굴」 — 실제 사진 다섯으로 만든 「더 나은 나」)가 실제 사진들과 얼마인지,
대역은 다른 사람(같은 지역 · 성별 조각)이 올린 사진과 얼마인지(우리 조각끼리 다른 사람 최고 0.47).

    python -I -X utf8 닮음.py 기준 <올린 사진> <기준 사진…> [--자 <실제 사진…>] [--승인 <승인 판>] [--미끼 <다른 사람…>]
    python -I -X utf8 닮음.py 셀카 <고른 기준> <셀카…> --태오 <태오 웃는 기준> <F1> <C1>
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
    if max(h, w) > 1200:
        s = 1200 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    faces = [] if faces is None else [f for f in faces if f[14] >= 0.7 and f[2] >= 0.06 * w]
    return [(FR.feature(FR.alignCrop(img, f)), float(f[0]), float(f[2])) for f in faces]


def 하나(p):
    fs = 얼굴들(p)
    if not fs:
        raise SystemExit(f"얼굴을 못 찾음: {p}")
    return max(fs, key=lambda x: x[2])[0]  # 가장 큰 얼굴(한 사람 사진)


def 닮(a, b):
    return round(float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE)), 3)


def 뒤값(이름):
    if 이름 not in sys.argv:
        return []
    i = sys.argv.index(이름) + 1
    out = []
    while i < len(sys.argv) and not sys.argv[i].startswith("--"):
        out.append(sys.argv[i]); i += 1
    return out


이 = os.path.basename
if sys.argv[1] == "기준":
    올림 = sys.argv[2]
    판들 = []
    for a in sys.argv[3:]:
        if a.startswith("--"):
            break
        판들.append(a)
    자, 승인, 미끼 = 뒤값("--자"), 뒤값("--승인"), 뒤값("--미끼")
    f올림 = 하나(올림)
    f자 = [하나(p) for p in 자]
    결과 = {"올림": 이(올림)}
    if 승인:
        fs = 하나(승인[0])
        결과["기준선_승인판"] = {"판": 이(승인[0]), "올린사진": 닮(fs, f올림), "실제사진평균": round(float(np.mean([닮(fs, x) for x in f자])), 3) if f자 else None}
    if 자:
        결과["기준선_실제사진끼리"] = round(float(np.mean([닮(f올림, x) for x in f자])), 3)
    if 미끼:
        결과["기준선_다른사람"] = {이(p): 닮(하나(p), f올림) for p in 미끼}
    결과["판"] = []
    fs판 = {}
    for p in 판들:
        f = 하나(p); fs판[이(p)] = f
        줄 = {"판": 이(p), "올린사진": 닮(f, f올림)}
        if f자:
            줄["실제사진평균"] = round(float(np.mean([닮(f, x) for x in f자])), 3)
        if 승인:
            줄["승인판"] = 닮(f, 하나(승인[0]))
        결과["판"].append(줄)
    키 = list(fs판)
    결과["판끼리"] = {f"{a}~{b}": 닮(fs판[a], fs판[b]) for i, a in enumerate(키) for b in 키[i + 1:]}
    print(json.dumps(결과, ensure_ascii=False, indent=1))
elif sys.argv[1] == "셀카":
    기준 = 하나(sys.argv[2])
    태오 = [하나(p) for p in 뒤값("--태오")]
    for p in [a for a in sys.argv[3:] if not a.startswith("--") and a not in 뒤값("--태오")]:
        fs = 얼굴들(p)
        줄 = [{"x": round(x), "학생": 닮(기준, f), "태오": [닮(t, f) for t in 태오]} for f, x, _ in fs]
        학생 = max(줄, key=lambda r: r["학생"]) if 줄 else None
        태 = max(줄, key=lambda r: min(r["태오"]) if r["태오"] else 0) if 줄 else None
        print(json.dumps({"셀카": 이(p), "얼굴수": len(줄), "학생": 학생["학생"] if 학생 else None,
                          "학생관문(0.84)": bool(학생 and 학생["학생"] >= 0.84),
                          "태오(웃는 기준·F1·C1)": 태["태오"] if 태 else None,
                          "태오관문(둘 다 0.55)": bool(태 and 태["태오"] and 태["태오"][0] >= 0.55 and np.mean(태["태오"][1:]) >= 0.55),
                          "같은얼굴": 학생 is 태}, ensure_ascii=False))
else:
    raise SystemExit(__doc__)
