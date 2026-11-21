"""
꿈 무대 학생용 길(GPT 이미지로 얼굴을 넣는 길)의 화면 결 맞추기(2026-11-22, 유호님 「응, 내」).

GPT 이미지는 머리를 흐린 틀에 얼굴을 넣으면서 화면 전체를 다시 그린다. 그래서 11-17 · 11-18 시험에서 얼굴만 스튜디오처럼 밝고
(L* 48~52, 같은 틀에 Seedream으로 넣은 얼굴은 34~39) 필름 잡음이 장면의 두 배 가까이 됐다(하늘잡음 1.36~1.41, 틀 0.6~0.7).
학생 판은 고르는 사람 없이 한 번에 나와야 해서, 그림 엔진에 다시 맡기지 않고 셈으로 맞춘다.

1. GPT 판을 틀에 맞춘다(머리를 흐린 자리 밖의 특징점으로 닮음 변환).
2. 틀에서 머리를 흐린 자리(대역 원본과 머리흐림 판의 차이)만 GPT 판에서 가져오고, 나머지는 틀 그대로 둔다.
3. 가져온 자리의 잡음과 선명함을 틀의 필름 잡음에 맞춘다(높은 주파수 성분을 하늘 잡음의 비로 줄인다).
4. 얼굴의 빛을 같은 빛을 받던 대역 얼굴에서 옮긴다. 두 얼굴을 눈 · 코 · 입 다섯 점으로 겹친 뒤, 대역 얼굴의 낮은 주파수 명암과 색
   (빛의 방향과 세기)만 가져오고 이목구비 같은 높은 주파수는 GPT 얼굴 그대로 둔다. 11-22 첫 판은 볼 평균만 맞췄더니 컷 4 얼굴이
   정면으로 고르게 밝아 「노을의 옆빛과 따로 논다」(다른 눈, 색보정 감독 역할)고 했다. 주인공이라 L*만 「--밝기더함」만큼 밝게 둔다.

    python -I -X utf8 결맞춤.py <대역 원본 틀> <머리흐림 틀> <GPT 판> <밖.png> [--밝기더함 3] [--평균만]

기준은 모두 그 틀 안에서 잡는다(대역 얼굴 · 틀의 하늘). 학생 사진은 이 도구에 들어오지 않는다.
"""
import os
import sys

import cv2
import numpy as np

YUNET = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet", "face_detection_yunet_2023mar.onnx")


def 읽기(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def 얼굴(im, 점까지=False):
    fd = cv2.FaceDetectorYN.create(YUNET, "", (im.shape[1], im.shape[0]), 0.6)
    _, f = fd.detect(im)
    if f is None:
        return None
    f = sorted(f, key=lambda r: -r[2] * r[3])[0]
    상자 = [int(v) for v in f[:4]]
    return (상자, np.float32(f[4:14]).reshape(5, 2)) if 점까지 else 상자


def 볼(im, box):
    x, y, w, h = box
    return im[y + h // 4:y + 3 * h // 4, x + w // 5:x + 4 * w // 5]


def 랩(im):
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float64)
    return lab[:, 0].mean() * 100 / 255, lab[:, 1].mean() - 128, lab[:, 2].mean() - 128


def 잡음(im, 가림=None):
    """위 18% 띠에서 결이 고른 칸의 높은 주파수 표준편차(질감재기.py의 하늘잡음과 같은 셈). 가림이 1인 칸은 뺀다."""
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hp = g - cv2.GaussianBlur(g, (0, 0), 2.0)
    h, w = g.shape
    band = int(h * 0.18)
    값 = []
    for y in range(0, band - 32, 32):
        for x in range(0, w - 32, 32):
            if 가림 is not None and 가림[y:y + 32, x:x + 32].max() > 0:
                continue
            c = g[y:y + 32, x:x + 32]
            if c.std() < 6:
                값.append(hp[y:y + 32, x:x + 32].std())
    return float(np.median(값)) if 값 else None


def 맞춤변환(gpt, 틀, 가림):
    """머리를 흐린 자리 밖의 특징점으로 GPT 판 → 틀 닮음 변환을 구한다."""
    s = 틀.shape[1] / gpt.shape[1]
    g = cv2.resize(gpt, (틀.shape[1], 틀.shape[0]), interpolation=cv2.INTER_CUBIC)
    orb = cv2.ORB_create(6000)
    밖 = (1 - 가림).astype(np.uint8) * 255
    k1, d1 = orb.detectAndCompute(cv2.cvtColor(g, cv2.COLOR_BGR2GRAY), 밖)
    k2, d2 = orb.detectAndCompute(cv2.cvtColor(틀, cv2.COLOR_BGR2GRAY), 밖)
    짝 = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(d1, d2), key=lambda m: m.distance)[:800]
    if len(짝) < 30:
        return g, None
    p1 = np.float32([k1[m.queryIdx].pt for m in 짝])
    p2 = np.float32([k2[m.trainIdx].pt for m in 짝])
    M, inl = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    # 맞은 점이 적거나 배율이 3% 넘게 다르면 믿지 않는다(11-22 컷 4 틀은 흐린 자리가 화면 대부분이라 11/67점으로 1.14배가 나왔다).
    # 그때는 그대로 늘린 판에서 밝기 상관(ECC)으로 옮김만 다듬는다.
    if M is None or inl.sum() < 25 or abs(np.hypot(*M[0, :2]) - 1) > 0.03:
        sc = 640 / 틀.shape[1]
        a = cv2.resize(cv2.cvtColor(g, cv2.COLOR_BGR2GRAY), None, fx=sc, fy=sc).astype(np.float32)
        b = cv2.resize(cv2.cvtColor(틀, cv2.COLOR_BGR2GRAY), None, fx=sc, fy=sc).astype(np.float32)
        mk = cv2.resize(밖, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_NEAREST)
        W = np.eye(2, 3, dtype=np.float32)
        try:
            _, W = cv2.findTransformECC(b, a, W, cv2.MOTION_TRANSLATION, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), mk, 5)
        except cv2.error:
            W = np.eye(2, 3, dtype=np.float32)
        W[:, 2] /= sc
        M = np.float32([[1, 0, -W[0, 2]], [0, 1, -W[1, 2]]])
        return cv2.warpAffine(g, M, (틀.shape[1], 틀.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT), (M, int(inl.sum()) if inl is not None else 0, len(짝), s)
    return cv2.warpAffine(g, M, (틀.shape[1], 틀.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT), (M, int(inl.sum()), len(짝), s)


def 맞추기(원본, 흐림, gpt, 밝기더함=3.0, 빛옮김=True):
    가림 = (np.abs(원본.astype(np.int16) - 흐림.astype(np.int16)).max(2) > 6).astype(np.uint8)
    가림 = cv2.morphologyEx(가림, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    넓힘 = cv2.dilate(가림, np.ones((61, 61), np.uint8))
    g, 변환 = 맞춤변환(gpt, 흐림, 넓힘)
    보고 = {"맞춤": None if 변환 is None else {"배율": round(float(np.hypot(*변환[0][0, :2])), 4), "옮김": [round(float(v), 1) for v in 변환[0][:, 2]],
                                                "맞은점": f"{변환[1]}/{변환[2]}"}}
    # 잡음: 틀과 GPT 판의 하늘 잡음 비로 GPT 자리의 높은 주파수를 줄인다(잡음과 다시 그리며 날카로워진 결을 함께)
    n틀, nG = 잡음(흐림, 넓힘), 잡음(g, 넓힘)
    k = min(1.0, n틀 / nG) if n틀 and nG else 1.0
    gf = g.astype(np.float32)
    저 = cv2.GaussianBlur(gf, (0, 0), 1.2)
    gf = 저 + (gf - 저) * k
    보고["잡음"] = {"틀": n틀, "GPT": nG, "곱": round(k, 3)}
    # 밝기와 색: 대역 얼굴의 볼에 맞춘다(얼굴 자리에만, 둘레는 부드럽게)
    b대역, bG = 얼굴(원본), 얼굴(np.clip(gf, 0, 255).astype(np.uint8))
    if b대역 and bG:
        L0, a0, bb0 = 랩(볼(원본, b대역))
        L1, a1, bb1 = 랩(볼(np.clip(gf, 0, 255).astype(np.uint8), bG))
        lab = cv2.cvtColor(np.clip(gf, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        x, y, w, h = bG
        얼 = np.zeros(가림.shape, np.float32)
        cx, cy = x + w / 2, y + h * 0.55
        cv2.ellipse(얼, (int(cx), int(cy)), (int(w * 0.95), int(h * 1.05)), 0, 0, 360, 1.0, -1)
        얼 = cv2.GaussianBlur(얼, (0, 0), w * 0.18)[..., None]
        목표L = L0 + 밝기더함
        대역점, G점 = 얼굴(원본, True), 얼굴(np.clip(gf, 0, 255).astype(np.uint8), True)
        if 빛옮김 and 대역점 and G점:
            # 대역 얼굴을 GPT 얼굴 자리로 옮겨 겹치고, 둘의 낮은 주파수(얼굴 폭의 12%로 흐린 판) 차이를 더한다
            M, _ = cv2.estimateAffinePartial2D(대역점[1], G점[1])
            옮긴 = cv2.warpAffine(원본, M, (원본.shape[1], 원본.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            labD = cv2.cvtColor(옮긴, cv2.COLOR_BGR2LAB).astype(np.float32)
            σ = max(3.0, w * 0.12)
            낮D, 낮G = cv2.GaussianBlur(labD, (0, 0), σ), cv2.GaussianBlur(lab, (0, 0), σ)
            d = (낮D - 낮G) * np.float32([1.0, 0.5, 0.5])
            d[..., 0] += 밝기더함 * 255 / 100
            lab = lab + 얼 * d
            보고["빛옮김"] = {"배율": round(float(np.hypot(*M[0, :2])), 3), "흐림σ": round(σ, 1)}
        else:
            # L*은 볼 평균을 목표로 옮기되 명암 폭은 그대로(곱으로 줄이면 얼굴이 납작해진다), a* · b*는 반만 옮긴다
            d = np.float32([(목표L - L1) * 255 / 100, (a0 - a1) * 0.5, (bb0 - bb1) * 0.5])
            lab = lab + 얼 * d
        gf = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
        보고["얼굴"] = {"대역 볼 L*a*b*": [round(L0, 1), round(a0, 1), round(bb0, 1)], "GPT 볼": [round(L1, 1), round(a1, 1), round(bb1, 1)], "목표 L*": round(목표L, 1)}
    # 붙이기: 머리를 흐린 자리(넓혀서 흐림의 가장자리까지)만 GPT 판에서
    m = cv2.GaussianBlur(넓힘.astype(np.float32), (0, 0), 18)[..., None]
    out = 흐림.astype(np.float32) * (1 - m) + gf * m
    return np.clip(out, 0, 255).astype(np.uint8), 보고


if __name__ == "__main__":
    a = sys.argv[1:]
    더함 = float(a[a.index("--밝기더함") + 1]) if "--밝기더함" in a else 3.0
    out, r = 맞추기(읽기(a[0]), 읽기(a[1]), 읽기(a[2]), 더함, "--평균만" not in a)
    cv2.imencode(".png", out)[1].tofile(a[3])
    print(r)
