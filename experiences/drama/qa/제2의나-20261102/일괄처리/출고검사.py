"""
「제2의 나」 사진 아바타 일괄 처리 — 받기 · 출고 검사의 기준을 한곳에 둔 본보기 (2026-11-03, 설계 docs/제2의나_사진아바타_일괄처리_설계_20261103.md 3절).
서버로 옮길 때 이 숫자와 판정을 그대로 쓴다. 모델은 사진시험 · T-C와 같은 YuNet + SFace(얼굴 찾기는 긴 변 1200으로 줄여서).
학생 얼굴은 숫자로만 본다 — AI 시험관 · 사람 운영자에게 보내지 않고, 얼굴 특징(SFace 벡터)은 저장하지 않는다(점수만 남김).

    python -I -X utf8 출고검사.py 받기 <사진…>
    python -I -X utf8 출고검사.py 기준 <올린 사진> <강> <약> [<강+>]
    python -I -X utf8 출고검사.py 셀카 <기준> <판> <셀카…>        판 = 태오 · 장면이 확정된 장면 판(학생 자리는 대역)
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

# 기준 — 숫자의 근거는 사진시험 README · 일괄처리 README(11-03 실측)
받기기준 = {"얼굴비": 0.20, "흐림": 100, "밝기": (60, 210)}  # 올린 사진 여섯: 얼굴비 0.33~0.71 · 흐림 175~503 · 밝기 112~167
기준관문 = {"통과": 0.60, "살핌": 0.50}   # 강 ↔ 올림: 유호님 0.618 · 대역 0.78~0.82 · 45세 강+ 0.53 / 다른 사람 최고 0.47
셀카관문 = {"통과": 0.70, "다시": 0.60, "태오": 0.85}  # 학생 ↔ 기준: GPT 셀카 0.746~0.887 · 판 편집 0.776~0.891 / 태오 ↔ 판 태오 0.914~0.939
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


def 한얼굴(p):
    작, fs = 열기(p)
    if not fs:
        raise SystemExit(f"얼굴을 못 찾음: {p}")
    return 특징(작, fs[0])


def 받기(p):
    작, fs = 열기(p)
    줄 = {"사진": os.path.basename(p), "얼굴수": len(fs)}
    if len(fs) != 1:
        return {**줄, "판정": "다시 찍기", "까닭": "얼굴이 없음" if not fs else "얼굴이 둘 이상 — 혼자 찍은 사진만"}
    x, y, w, h = [int(v) for v in fs[0][:4]]
    얼굴 = cv2.cvtColor(작[max(0, y):y + h, max(0, x):x + w], cv2.COLOR_BGR2GRAY)
    얼굴256 = cv2.resize(얼굴, (256, max(1, int(256 * h / max(w, 1)))), interpolation=cv2.INTER_AREA)
    비, 흐림, 밝기 = w / 작.shape[1], float(cv2.Laplacian(얼굴256, cv2.CV_64F).var()), float(얼굴.mean())
    줄.update({"얼굴비": round(비, 2), "흐림": round(흐림), "밝기": round(밝기)})
    까닭 = [m for m, 나쁨 in (("얼굴이 너무 작음 — 조금 더 가까이", 비 < 받기기준["얼굴비"]),
                             ("흔들렸거나 흐림", 흐림 < 받기기준["흐림"]),
                             ("너무 어둡거나 밝음", not 받기기준["밝기"][0] <= 밝기 <= 받기기준["밝기"][1])) if 나쁨]
    return {**줄, "판정": "다시 찍기" if 까닭 else "받음", "까닭": " · ".join(까닭)}


def 기준등급(값):
    return "통과" if 값 >= 기준관문["통과"] else "살핌" if 값 >= 기준관문["살핌"] else "탈락"


def 기준(올림, 판들):
    if not 1 <= len(판들) <= 3:
        raise SystemExit("기준 판은 강 · 약 · (강+) 순서로 한 장씩, 셋까지")
    f올림 = 한얼굴(올림)
    이름 = ["강", "약", "강+"]
    줄 = [{"판": 이름[i], "그림": os.path.basename(p), "올린 사진과": (v := 닮(한얼굴(p), f올림)), "등급": 기준등급(v)} for i, p in enumerate(판들)]
    강, 약, 강플 = 줄[0], (줄[1] if len(줄) > 1 else None), (줄[2] if len(줄) > 2 else None)
    산 = lambda x: x is not None and x["등급"] != "탈락"
    if 강["등급"] == "통과":
        기본, 보임 = "강", "강(「더 자연스럽게」로 약 · 「아직 나이 들어 보여요」로 강+)"
    elif 강["등급"] == "살핌":
        기본, 보임 = "강", "강과 약을 나란히 — 「이게 나?」에서 고름"
    elif 산(약):
        기본, 보임 = "약", "강은 나 같지 않아 숨김 — 약을 기본으로"
    elif 산(강플):
        기본, 보임 = "강+", "강 · 약은 나 같지 않아 숨김 — 강+를 기본으로"
    else:
        기본, 보임 = None, "모두 나 같지 않음 — 사진을 한 번 더 찍어 달라고 함(원본으로 다시 굽지 않음)"
    return {"판들": 줄, "기본": 기본, "보임": 보임}


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
            out.append({"셀카": os.path.basename(p), "판정": "다시 굽기", "까닭": f"큰 얼굴 {len(둘)}개"})
            continue
        학, 태 = 닮(f기준, 특징(작, 둘[0])), 닮(f판태오, 특징(작, 둘[1]))
        까닭 = []
        if 학 < 셀카관문["다시"]:
            까닭.append("학생이 기준과 멀다")
        if 태 < 셀카관문["태오"]:
            까닭.append("태오가 판에서 바뀜")
        판정 = "다시 굽기" if 까닭 else ("통과" if 학 >= 셀카관문["통과"] else "한 번 더 굽고 높은 쪽")
        out.append({"셀카": os.path.basename(p), "학생↔기준": 학, "태오↔판 태오": 태, "판정": 판정, "까닭": " · ".join(까닭)})
    return out


def 룩(기준p, 종류, 룩들):
    f기준, 문턱 = 한얼굴(기준p), 룩관문[종류]
    return [{"룩": os.path.basename(p), "기준과": (v := 닮(한얼굴(p), f기준)), "판정": "통과" if v >= 문턱 else "다시 입어 보기(무료 다시 굽기)"} for p in 룩들]


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    a = sys.argv[1:]
    if a[0] == "받기":
        r = [받기(p) for p in a[1:]]
    elif a[0] == "기준":
        r = 기준(a[1], a[2:])
    elif a[0] == "셀카":
        r = 셀카(a[1], a[2], a[3:])
    elif a[0] == "룩":
        r = 룩(a[1], a[2], a[3:])
    else:
        raise SystemExit(__doc__)
    print(json.dumps(r, ensure_ascii=False))
