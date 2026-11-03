"""
「제2의 나」 사진 기반 아바타 — 셀카 속 태오 줄세우기 시트 (2026-11-03).
셀카마다 오른쪽 얼굴(태오)을 머리째 잘라 미끼(F2 · 옛 태오처럼 한 사람만 나온 그림)와 정해진 씨앗으로 섞고, 맨 앞에 기준(F1)을 붙인다.
Fable은 순서표를 보지 않고 「F1과 같은 사람인 칸」을 고른다(결정 11-03 「같은 사람인지는 줄세우기 눈 검사」 — 숫자는 다른 사람만 막는다).
순서표는 시트 옆 `<시트>_순서표.json`에 따로 둔다(Fable에게 주지 않는다).

    python -I -X utf8 줄세우기.py <밖 시트.jpg> <씨앗> --기준 <F1> --셀카 <이름=셀카…> --미끼 <이름=그림…>
"""
import json
import os
import random
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
칸 = 300


def 뒤값(이름):
    i = sys.argv.index(이름) + 1
    out = []
    while i < len(sys.argv) and not sys.argv[i].startswith("--"):
        out.append(sys.argv[i]); i += 1
    return out


def 머리(p, 쪽):
    im = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    s = min(1.0, 1200 / max(h, w))
    작 = cv2.resize(im, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else im
    FD.setInputSize((작.shape[1], 작.shape[0]))
    _, fs = FD.detect(작)
    fs = [f for f in (fs if fs is not None else []) if f[14] >= 0.7 and f[2] >= 0.06 * 작.shape[1]]
    if 쪽 == "오른":  # 셀카 = 가장 큰 두 얼굴 가운데 오른쪽(태오)
        f = max(sorted(fs, key=lambda f: -f[2])[:2], key=lambda f: f[0])
    else:
        f = max(fs, key=lambda f: f[2])
    x, y, fw, fh = (f[:4] / s)
    cx, cy, 변 = x + fw / 2, y + fh * 0.42, fw * 2.0  # 앞머리 · 정수리까지 들어오게 조금 위로
    x0, y0 = int(max(0, cx - 변 / 2)), int(max(0, cy - 변 / 2))
    x1, y1 = int(min(w, cx + 변 / 2)), int(min(h, cy + 변 / 2))
    return cv2.resize(im[y0:y1, x0:x1], (칸, 칸), interpolation=cv2.INTER_AREA)


def 이름표(im, 글):
    im = im.copy()
    cv2.rectangle(im, (0, 0), (30 + 22 * len(글), 44), (0, 0, 0), -1)
    cv2.putText(im, 글, (8, 34), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 3)
    return im


밖, 씨앗 = sys.argv[1], sys.argv[2]
후보 = [(a.split("=", 1)[0], a.split("=", 1)[1], "오른") for a in 뒤값("--셀카")]
후보 += [(a.split("=", 1)[0], a.split("=", 1)[1], "하나") for a in 뒤값("--미끼")]
random.Random(씨앗).shuffle(후보)
판 = [이름표(머리(뒤값("--기준")[0], "하나"), "F1")] + [이름표(머리(p, 쪽), str(i + 1)) for i, (_, p, 쪽) in enumerate(후보)]
cv2.imencode(".jpg", np.hstack(판), [cv2.IMWRITE_JPEG_QUALITY, 90])[1].tofile(밖)
표 = {str(i + 1): 이름 for i, (이름, _, _) in enumerate(후보)}
json.dump(표, open(os.path.splitext(밖)[0] + "_순서표.json", "w", encoding="utf-8"), ensure_ascii=False)
print(json.dumps({"시트": 밖, "칸": len(판)}, ensure_ascii=False))
