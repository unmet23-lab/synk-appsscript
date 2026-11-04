"""
「제2의 나」 사진 아바타 일괄 처리 — 받기 · 출고 검사의 기준을 한곳에 둔 본보기 (2026-11-03, 설계 docs/제2의나_사진아바타_일괄처리_설계_20261103.md 3절).
서버로 옮길 때 이 숫자와 판정을 그대로 쓴다. 모델은 사진시험 · T-C와 같은 YuNet + SFace(얼굴 찾기는 긴 변 1200으로 줄여서).
학생 얼굴은 숫자로만 본다 — AI 시험관 · 사람 운영자에게 보내지 않고, 얼굴 특징(SFace 벡터)은 저장하지 않는다(점수만 남김).
관문은 학생을 돌려보내지 않는다(11-03 유호님 「사진을 고르는건 자유 … 엄격하게 해놓으면 스트레스」) — 받기는 손보거나 물어보고,
문턱 아래 판은 뒤에서 저절로 다시 굽는 데만 쓴다. 학생은 만든 판 가운데 마음에 드는 것을 늘 고를 수 있다.

    python -I -X utf8 출고검사.py 받기 <사진…>
    python -I -X utf8 출고검사.py 기준 <올린 사진> <강> <약> [<강+>] [--얼굴 x,y,w,h]   「누가 나예요?」로 고른 얼굴(올린 사진 원본 좌표)
    python -I -X utf8 출고검사.py 셀카 <기준> <판> <셀카…>        판 = 태오 · 장면이 확정된 장면 판(학생 자리는 대역) — 학생 자리는 태오 점수로 정한다
    python -I -X utf8 출고검사.py 룩 <기준> <옷|머리> <룩…>        옷 = 옷 · 목걸이 · 귀걸이, 머리 = 머리 모양 · 염색 · 안경 · 모자
"""
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")

# 문턱 — 숫자의 근거는 사진시험 README · 일괄처리 README(11-03 실측). 넘지 못해도 막지 않고 손보거나 다시 굽는다.
받기기준 = {"얼굴비": 0.20, "흐림": 100, "밝기": (60, 210)}  # 손봄 문턱 — 올린 사진 여섯: 얼굴비 0.33~0.71 · 흐림 166~368 · 밝기 112~167
기준관문 = {"통과": 0.60, "살핌": 0.50, "세판": 0.60}   # 강 ↔ 올림: 유호님 0.618 · 대역 0.78~0.82 · 45세 강+ 0.53 / 다른 사람 최고 0.47 / 세판: 셋 다 아래인데 세 판끼리 이 값 이상이면 자를 믿지 않음(11-04 어두운 피부 대역 -0.02~0.13 · 세 판끼리 0.73~0.87)
셀카관문 = {"통과": 0.70, "다시": 0.60, "태오": 0.90}  # 학생 ↔ 기준: GPT 셀카 0.746~0.887 · 판 편집 0.776~0.891 / 태오 ↔ 판 태오 0.914~0.939(Fable 11-03 밤 0.90)
룩관문 = {"옷": 0.90, "머리": 0.70}       # 옷 · 액세서리 0.94~0.96, 머리 모양 · 안경 · 모자 0.73~0.95(u2 다운펌 다시 판 0.73은 Fable 통과)


def 열기(p):
    원 = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    if 원 is None:
        raise SystemExit(f"그림을 못 읽음: {p}")
    h, w = 원.shape[:2]
    s = min(1.0, 1200 / max(h, w))
    작 = cv2.resize(원, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA) if s < 1 else 원
    FD.setInputSize((작.shape[1], 작.shape[0]))
    _, fs = FD.detect(작)
    fs = [] if fs is None else [f for f in fs if f[14] >= 0.7 and f[2] >= 0.06 * 작.shape[1]]
    return 작, sorted(fs, key=lambda f: -f[2])


def 특징(작, f):
    return FR.feature(FR.alignCrop(작, f))


def 닮(a, b):
    return round(float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE)), 3)


def 한얼굴(p, 상자=None):
    """가장 큰 얼굴, 또는 상자(원본 좌표 x,y,w,h — 「누가 나예요?」로 고른 얼굴)에 가운데가 가장 가까운 얼굴(Fable 설계 검토 8)."""
    작, fs = 열기(p)
    if not fs:
        raise SystemExit(f"얼굴을 못 찾음: {p}")
    if 상자 is None:
        return 특징(작, fs[0])
    원 = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    s = 작.shape[1] / 원.shape[1]
    cx, cy = (상자[0] + 상자[2] / 2) * s, (상자[1] + 상자[3] / 2) * s
    f = min(fs, key=lambda f: (f[0] + f[2] / 2 - cx) ** 2 + (f[1] + f[3] / 2 - cy) ** 2)
    return 특징(작, f)


def 받기(p):
    """받기는 막지 않는다 — 받음(그대로) · 받음(손봄: 얼굴 둘레를 잘라 키워 굽고 빛 · 결은 모델이 다시 그림) · 물어봄(얼굴 여럿 · 못 찾음)."""
    작, fs = 열기(p)
    줄 = {"사진": os.path.basename(p), "얼굴수": len(fs)}
    if not fs:
        return {**줄, "판정": "물어봄", "까닭": "얼굴이 잘 안 보여요 — 「그래도 이 사진으로」(숫자 없이 굽고 「이게 나?」로만) · 「다른 사진 고르기」"}
    if len(fs) > 1:
        return {**줄, "판정": "물어봄", "까닭": "얼굴이 여럿 — 「누가 나예요?」 한 번 눌러 고른 얼굴 둘레만 잘라 쓴다",
                "얼굴들": [[int(v) for v in f[:4]] for f in fs]}
    x, y, w, h = [int(v) for v in fs[0][:4]]
    얼굴 = cv2.cvtColor(작[max(0, y):y + h, max(0, x):x + w], cv2.COLOR_BGR2GRAY)
    얼굴256 = cv2.resize(얼굴, (256, max(1, int(256 * h / max(w, 1)))), interpolation=cv2.INTER_AREA)
    비, 흐림, 밝기 = w / 작.shape[1], float(cv2.Laplacian(얼굴256, cv2.CV_64F).var()), float(얼굴.mean())
    줄.update({"얼굴비": round(비, 2), "흐림": round(흐림), "밝기": round(밝기)})
    손봄 = [m for m, 걸림 in (("얼굴이 작아 둘레를 잘라 키움", 비 < 받기기준["얼굴비"]),
                             ("흐림 — 그대로 굽고 닮음은 「이게 나?」로 봄", 흐림 < 받기기준["흐림"]),
                             ("어둡거나 밝음 — 빛은 모델이 다시 그림", not 받기기준["밝기"][0] <= 밝기 <= 받기기준["밝기"][1])) if 걸림]
    return {**줄, "판정": "받음(손봄)" if 손봄 else "받음", "까닭": " · ".join(손봄)}


def 기준등급(값):
    return "통과" if 값 >= 기준관문["통과"] else "살핌" if 값 >= 기준관문["살핌"] else "탈락"


def 기준(올림, 판들, 상자=None):
    if not 1 <= len(판들) <= 3:
        raise SystemExit("기준 판은 강 · 약 · (강+) 순서로 한 장씩, 셋까지")
    f올림 = 한얼굴(올림, 상자)
    이름 = ["강", "약", "강+"]
    줄 = [{"판": 이름[i], "그림": os.path.basename(p), "올린 사진과": (v := 닮(한얼굴(p), f올림)), "등급": 기준등급(v)} for i, p in enumerate(판들)]
    강, 약, 강플 = 줄[0], (줄[1] if len(줄) > 1 else None), (줄[2] if len(줄) > 2 else None)
    산 = lambda x: x is not None and x["등급"] != "탈락"
    다시 = False
    if 강["등급"] == "통과":
        기본, 보임 = "강", "강이 기본 — 「더 자연스럽게」(약) · 「더 어리게」(강+)도 고를 수 있음"
    elif 강["등급"] == "살핌":
        기본, 보임 = "강", "강과 약을 나란히 — 「이게 나?」에서 고름"
    elif 산(약):
        기본, 보임 = "약", "약이 기본 — 강 · 강+도 고를 수 있음"
    elif 산(강플):
        기본, 보임 = "강+", "강+가 기본 — 강 · 약도 고를 수 있음"
    else:
        특징들 = [한얼굴(p) for p in 판들]
        세판 = min(닮(특징들[i], 특징들[j]) for i in range(len(특징들)) for j in range(i + 1, len(특징들))) if len(특징들) > 1 and all(x is not None for x in 특징들) else None
        if 세판 is not None and 세판 >= 기준관문["세판"]:
            # 어두운 피부 · 어두운 빛에서는 올린 사진과의 숫자가 0 언저리로 떨어진다 — 세 판이 서로 같은 사람이면 자가 틀린 쪽이라 기본 강 그대로 「이게 나?」로 본다(다시 구워도 같다)
            기본, 보임 = 줄[0]["판"], f"셋 다 문턱 아래지만 세 판끼리 {세판} — 숫자를 믿지 않고 강을 기본으로 「이게 나?」"
        else:
            기본 = max(줄, key=lambda x: x["올린 사진과"])["판"]
            보임 = "셋 다 문턱 아래 — 가장 닮은 판을 기본으로 「다른 사진으로」와 함께 보인다(새 사진을 먼저 요구하지 않음)"
    return {"판들": 줄, "기본": 기본, "고를수있음": [x["판"] for x in 줄], "다시굽기": 다시, "보임": 보임}


def 두얼굴(p):
    작, fs = 열기(p)
    둘 = sorted(fs[:2], key=lambda f: f[0])
    return 작, 둘


def 셀카(기준p, 판p, 셀카들):
    f기준 = 한얼굴(기준p)
    판작, 판둘 = 두얼굴(판p)
    if len(판둘) != 2:
        raise SystemExit(f"장면 판에서 두 얼굴을 못 찾음: {판p}")
    f판태오 = 특징(판작, 판둘[1])
    out = []
    for p in 셀카들:
        작, 둘 = 두얼굴(p)
        if len(둘) != 2:
            out.append({"셀카": os.path.basename(p), "판정": "저절로 다시 굽기", "까닭": f"큰 얼굴 {len(둘)}개"})
            continue
        # 학생 자리를 왼쪽으로 못 박지 않는다 — 두 얼굴을 바꿔 맞춰 태오 점수가 높은 쪽(태오가 왼쪽인 판도 있음, Fable 설계 검토 8)
        f0, f1 = 특징(작, 둘[0]), 특징(작, 둘[1])
        태1, 태0 = 닮(f판태오, f1), 닮(f판태오, f0)
        학, 태, 자리 = (닮(f기준, f0), 태1, "왼") if 태1 >= 태0 else (닮(f기준, f1), 태0, "오른")
        까닭 = []
        if 학 < 셀카관문["다시"]:
            까닭.append("학생이 기준과 멀다")
        if 태 < 셀카관문["태오"]:
            까닭.append("태오가 판에서 바뀜")
        판정 = "저절로 다시 굽기(두 번까지, 가장 나은 판을 보냄)" if 까닭 else ("통과" if 학 >= 셀카관문["통과"] else "한 번 더 굽고 높은 쪽")
        out.append({"셀카": os.path.basename(p), "학생 자리": 자리, "학생↔기준": 학, "태오↔판 태오": 태, "판정": 판정, "까닭": " · ".join(까닭)})
    return out


def 룩(기준p, 종류, 룩들):
    f기준, 문턱 = 한얼굴(기준p), 룩관문[종류]
    return [{"룩": os.path.basename(p), "기준과": (v := 닮(한얼굴(p), f기준)), "판정": "통과" if v >= 문턱 else "저절로 다시 굽기 한 번 — 그다음 가장 나은 판 + 「다시 입어 보기」"} for p in 룩들]


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    a = sys.argv[1:]
    if a[0] == "받기":
        r = [받기(p) for p in a[1:]]
    elif a[0] == "기준":
        상자 = None
        if "--얼굴" in a:
            i = a.index("--얼굴")
            상자 = [float(v) for v in a[i + 1].split(",")]
            a = a[:i] + a[i + 2:]
        r = 기준(a[1], a[2:], 상자)
    elif a[0] == "셀카":
        r = 셀카(a[1], a[2], a[3:])
    elif a[0] == "룩":
        r = 룩(a[1], a[2], a[3:])
    else:
        raise SystemExit(__doc__)
    print(json.dumps(r, ensure_ascii=False))
