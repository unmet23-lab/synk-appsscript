"""
카운터 손님 표정 묶음을 「얼굴 부분만 바꾼 짝」으로 만든다 (2026-11-01, 결정 11-01 · 기획 7절).

0단계 T2에서 「표정만 바꿔」 편집 판을 통째로 바꿔 끼우니 앞머리 · 턱선이 조금 달라 「톡 튄다」(시험관 셋),
태오 짝은 몸 윤곽이 1px 밀리고 왼손 손가락이 달라졌다(Fable P2). 편집 굽기는 그림 전체를 다시 그리기 때문이다
(현장노트 그림 굽기 「장면째 구운 마스코트의 깜빡임 … 통째로 바꿔 끼우면」). 그래서 바탕(말할 때 판)은 그대로 두고
표정 판에서 얼굴 안쪽(눈썹 · 눈 · 코 · 입 · 볼 · 턱)만 떼어 붙인다 — 머리카락 윤곽 · 귀걸이 · 몸 · 손 · 배경은 바탕 픽셀 그대로다.

1) 표정 판을 바탕 크기로 맞추고, 얼굴 둘레(머리 · 어깨 · 배경 고리)만 보는 ECC 맞춤으로 바탕에 겹친다(편집 판은 몇 px 옮겨지고 배율이 0.995~1.005로 달랐다).
2) 얼굴 타원 경계 띠에서 두 판의 밝기 · 색 평균과 퍼짐을 재어 표정 판의 얼굴만 바탕에 맞춘다(빛이 조금 다르게 다시 그려져도 이음매가 안 보이게).
3) 페더 타원으로 붙이고, 타원 밖에서 바뀐 픽셀 수를 센다(0이어야 한다).

    python -I -X utf8 얼굴합성.py <바탕.png> <표정.png> <낼.png> --얼굴 cx,cy,rx,ry[,각도] [--페더 16]

--얼굴은 바탕 판 좌표의 얼굴 안쪽 타원(가운데 · 반지름 둘 · 기울기 도 — 고개가 기울면 눈 선을 따라 음수가 왼쪽 위로 돈다).
눈썹 위 ~ 턱 끝, 볼 안쪽까지만 — 머리카락 윤곽 · 귀 · 귀걸이는 넣지 않는다.
낸 것: <낼.png>, <낼>_비교.jpg(바탕 · 표정 원판 · 합성 얼굴을 2배로 나란히), 맞춤 행렬 · 상관 · 타원 밖 바뀐 픽셀 수(표준 출력, JSON).
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("바탕")
ap.add_argument("표정")
ap.add_argument("낼")
ap.add_argument("--얼굴", required=True, help="cx,cy,rx,ry[,각도] (바탕 판 좌표) 또는 「자동」(YuNet 얼굴 점)")
ap.add_argument("--페더", type=float, default=16)
a = ap.parse_args()

def 읽기(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)

B = 읽기(a.바탕)
V = 읽기(a.표정)
H, W = B.shape[:2]
if V.shape[:2] != (H, W):
    V = cv2.resize(V, (W, H), interpolation=cv2.INTER_LANCZOS4)

def 자동타원(img):
    """YuNet 얼굴 점(두 눈 · 입 두 끝)으로 눈썹 위 ~ 턱 끝, 볼 안쪽 타원을 잡는다 — 손 · 펜을 얼굴로 잡지 않게 가장 확실한 얼굴 하나."""
    import os
    m = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet", "face_detection_yunet_2023mar.onnx")
    fd = cv2.FaceDetectorYN.create(m, "", (W, H), 0.6, 0.3, 5000)
    _, faces = fd.detect(cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2BGR))
    if faces is None or not len(faces):
        raise SystemExit("바탕에서 얼굴을 못 찾음 — --얼굴에 타원을 손으로 준다")
    f = max(faces, key=lambda r: r[14])
    눈r, 눈l, 입r, 입l = np.array(f[4:6]), np.array(f[6:8]), np.array(f[10:12]), np.array(f[12:14])
    눈, 입 = (눈r + 눈l) / 2, (입r + 입l) / 2
    v = 입 - 눈
    c = 눈 + 0.6 * v  # 위 끝 = 눈 − 0.5v(눈썹 위), 아래 끝 = 입 + 0.7v(턱 끝)
    각도 = float(np.degrees(np.arctan2(눈l[1] - 눈r[1], 눈l[0] - 눈r[0])))
    return float(c[0]), float(c[1]), 0.86 * float(np.linalg.norm(눈l - 눈r)), 1.1 * float(np.linalg.norm(v)), 각도


값 = list(자동타원(B)) if a.얼굴 == "자동" else [float(v) for v in a.얼굴.split(",")]
cx, cy, rx, ry = 값[:4]
각 = 값[4] if len(값) > 4 else 0.0
타원 = lambda 판, 배, 색: cv2.ellipse(판, (int(cx), int(cy)), (int(rx * 배[0]), int(ry * 배[1])), 각, 0, 360, 색, -1)

# 1) 맞춤 — 얼굴 타원을 뺀 머리 둘레 고리(얼굴 상자의 2.2배)만 본다
고리 = np.zeros((H, W), np.uint8)
타원(고리, (2.2, 1.9), 255)
타원(고리, (1.05, 1.05), 0)
회B = cv2.cvtColor(B.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
회V = cv2.cvtColor(V.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
M = np.eye(2, 3, dtype=np.float32)
try:
    상관, M = cv2.findTransformECC(회B, 회V, M, cv2.MOTION_AFFINE,
                                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), 고리, 5)
except cv2.error as e:
    raise SystemExit(f"ECC 맞춤 실패 — 얼굴 상자 · 판을 확인: {e}")
V맞춤 = cv2.warpAffine(V, M, (W, H), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)

# 2) 색 맞춤 — 타원 경계 띠(안쪽 0.85 ~ 바깥 1.15)에서 채널마다 평균 · 퍼짐
띠 = np.zeros((H, W), np.uint8)
타원(띠, (1.15, 1.15), 255)
타원(띠, (0.85, 0.85), 0)
k = 띠 > 0
얼굴V = V맞춤.copy()
for c in range(3):
    mb, sb = B[..., c][k].mean(), B[..., c][k].std() + 1e-3
    mv, sv = V맞춤[..., c][k].mean(), V맞춤[..., c][k].std() + 1e-3
    g = float(np.clip(sb / sv, 0.9, 1.1))  # 퍼짐은 ±10%까지만 — 표정 판의 결을 지우지 않게
    얼굴V[..., c] = (V맞춤[..., c] - mv) * g + mb

# 3) 붙이기 — 페더 타원(얼굴 상자 그대로), 타원 밖은 바탕 픽셀 그대로
m = np.zeros((H, W), np.float32)
타원(m, (1.0, 1.0), 1.0)
m = cv2.GaussianBlur(m, (0, 0), a.페더)
m[m < 1e-3] = 0.0
out = 얼굴V * m[..., None] + B * (1 - m[..., None])
out = np.clip(out + 0.5, 0, 255).astype(np.uint8)
Image.fromarray(out).save(a.낼)

밖 = m == 0
바뀜 = int((np.abs(out.astype(np.int16) - B.astype(np.int16)).max(axis=2) > 2)[밖].sum())

# 비교 그림 — 얼굴 둘레를 2배로: 바탕 | 표정 원판(맞춤 뒤) | 합성
pad = int(max(rx, ry) * 1.2)
bx0, by0 = max(0, int(cx - pad)), max(0, int(cy - pad))
bx1, by1 = min(W, int(cx + pad)), min(H, int(cy + pad))
조각 = [arr[by0:by1, bx0:bx1] for arr in (B, V맞춤, out.astype(np.float32))]
조각 = [cv2.resize(np.clip(c, 0, 255).astype(np.uint8), None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC) for c in 조각]
틈 = np.full((조각[0].shape[0], 12, 3), 255, np.uint8)
Image.fromarray(np.hstack([조각[0], 틈, 조각[1], 틈, 조각[2]])).save(str(Path(a.낼).with_suffix("")) + "_비교.jpg", quality=90)

print(json.dumps({"낼": a.낼, "타원": [round(v, 1) for v in (cx, cy, rx, ry, 각)], "ECC상관": round(float(상관), 4),
                  "맞춤": [[round(float(v), 4) for v in r] for r in M], "타원밖바뀐픽셀": 바뀜}, ensure_ascii=False))
