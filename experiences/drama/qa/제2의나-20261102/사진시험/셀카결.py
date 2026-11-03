"""
「제2의 나」 사진 기반 아바타 — 셀카 한 장 안의 두 얼굴을 함께 잰다 (2026-11-03, GPT 셀카 결 확인).
셀카마다 가장 큰 두 얼굴을 왼쪽(학생) · 오른쪽(태오)으로 잡아
  ① 학생 ↔ 고른 기준 사진, ② 태오 ↔ 웃는 기준 · F1 · C1 (SFace — 닮음.py와 같은 모델 · 같은 줄임)
  ③ 두 얼굴의 볼 잔결(결/결재기.py와 같은 셈 — 원본에서 얼굴 너비 256px, 회색 − 가우스 σ1.5의 표준편차)과 태오 ÷ 학생 「결 비」.
결 비는 한 사진 안의 견줌이라 엔진 · 해상도가 달라도 나란히 볼 수 있다 — 옛 태오 GPT 셀카가 0.69~0.70일 때 「태오만 매끈」(설계 8절).
얼굴 찾기는 긴 변 1200으로 줄인 판에서 하고(YuNet은 큰 원본에서 점수가 떨어진다), 잔결은 그 자리를 원본에서 잰다.

    python -I -X utf8 셀카결.py <고른 기준> <셀카…> --태오 <웃는 기준> <F1> <C1>
"""
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def 읽기(p):
    원 = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = 원.shape[:2]
    s = min(1.0, 1200 / max(h, w))
    작 = cv2.resize(원, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else 원
    FD.setInputSize((작.shape[1], 작.shape[0]))
    _, fs = FD.detect(작)
    fs = [] if fs is None else [f for f in fs if f[14] >= 0.7 and f[2] >= 0.06 * 작.shape[1]]
    return 원, 작, s, fs


def 특징(작, f):
    return FR.feature(FR.alignCrop(작, f))


def 잔결(원, f, s):
    f = f[:14] / s  # 줄인 판의 얼굴 자리를 원본 자리로
    배 = 256.0 / f[2]
    작 = cv2.resize(원, None, fx=배, fy=배, interpolation=cv2.INTER_AREA)
    회 = cv2.cvtColor(작, cv2.COLOR_BGR2GRAY).astype(np.float32)
    고 = 회 - cv2.GaussianBlur(회, (0, 0), 1.5)
    값 = []
    for 눈, 입 in (((f[4], f[5]), (f[10], f[11])), ((f[6], f[7]), (f[12], f[13]))):
        cx, cy = (눈[0] * 0.45 + 입[0] * 0.55) * 배, (눈[1] * 0.45 + 입[1] * 0.55) * 배
        조각 = 고[int(cy - 18):int(cy + 18), int(cx - 18):int(cx + 18)]
        if 조각.size:
            값.append(float(조각.std()))
    return round(sum(값) / len(값), 2) if 값 else None


def 닮(a, b):
    return round(float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE)), 3)


if len(sys.argv) < 3 or "--태오" not in sys.argv:
    raise SystemExit(__doc__)
i = sys.argv.index("--태오")
태오참고 = sys.argv[i + 1:i + 4]
_, 작, _, fs = 읽기(sys.argv[1])
기준 = 특징(작, max(fs, key=lambda f: f[2]))
태오 = []
for p in 태오참고:
    _, 작, _, fs = 읽기(p)
    태오.append(특징(작, max(fs, key=lambda f: f[2])))
for p in sys.argv[2:i]:
    원, 작, s, fs = 읽기(p)
    둘 = sorted(sorted(fs, key=lambda f: -f[2])[:2], key=lambda f: f[0])
    줄 = {"셀카": os.path.basename(p), "얼굴수": len(fs)}
    if len(둘) == 2:
        학, 태 = 둘
        줄["학생"] = 닮(기준, 특징(작, 학))
        줄["태오(웃는 기준·F1·C1)"] = [닮(t, 특징(작, 태)) for t in 태오]
        줄["태오관문(둘 다 0.55)"] = bool(줄["태오(웃는 기준·F1·C1)"][0] >= 0.55 and np.mean(줄["태오(웃는 기준·F1·C1)"][1:]) >= 0.55)
        a, b = 잔결(원, 학, s), 잔결(원, 태, s)
        줄["잔결(학생·태오)"] = [a, b]
        줄["결 비(태오÷학생)"] = round(b / a, 2) if a and b else None
        줄["얼굴 너비(학생·태오, 원본 px)"] = [int(학[2] / s), int(태[2] / s)]
    print(json.dumps(줄, ensure_ascii=False))
