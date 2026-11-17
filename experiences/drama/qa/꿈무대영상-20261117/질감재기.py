"""
꿈 무대 콘티(2026-11-17) — 얼굴 컷이 다른 컷과 화면 결이 맞는지 잰다.
유호님 「근데 너무 그 화면 질감이랑 안맞는데 왜 그러지? 내 얼굴있는 화면만 좀 이상해」에서 나왔다. 얼굴을 넣는 엔진이 화면 전체를 다시 그리면서
필름 잡음을 지우고 색을 바꾸는지를 숫자로 본다. 그림마다 한 줄을 낸다.

    python -I -X utf8 질감재기.py [--얼굴 <기준 얼굴 사진>] <그림…>

- 하늘잡음: 위 18% 띠에서 결이 고른 칸들의 높은 주파수 표준편차(중앙값). 필름 잡음의 양이다. 같은 편의 다른 컷과 견준다.
- 전체 b* · 채도: 화면 전체의 노란 기와 채도(HSV S 평균). 컷끼리 빛과 색이 맞는지 본다.
- 선명: 화면 전체 라플라시안 표준편차. 다시 그리면서 날카롭게 만든 판은 값이 오른다.
- 얼굴 L*: 가장 또렷이 잡힌 얼굴의 볼 자리 밝기. 닮음: --얼굴을 주면 그 사진과의 SFace 닮음.
폭이 1672보다 큰 그림은 1672로 줄여서 잰다(엔진마다 크기가 달라서다).
"""
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def 읽기(p, w=1672):
    # 폭 1672보다 큰 그림만 줄인다. 작은 기준 얼굴 사진을 키우면 닮음이 0.15쯤으로 엉뚱하게 낮게 나온다(11-17에 겪음).
    im = cv2.imdecode(np.fromfile(p, np.uint8), 1)
    if im.shape[1] <= w:
        return im
    return cv2.resize(im, (w, int(w * im.shape[0] / im.shape[1])), interpolation=cv2.INTER_AREA)


def 얼굴(im):
    h, w = im.shape[:2]
    f = min(1.0, 1200 / max(h, w))
    sm = cv2.resize(im, (int(w * f), int(h * f))) if f < 1 else im
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    _, fs = FD.detect(sm)
    if fs is None:
        return None, None
    b = max(fs, key=lambda r: r[-1])
    return FR.feature(FR.alignCrop(sm, b)), (b[:4] / f).astype(int)


def 재기(im, 기준=None):
    h, w = im.shape[:2]
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hp = g - cv2.GaussianBlur(g, (0, 0), 1.5)
    칸 = []
    for y in range(0, int(h * 0.18) - 60, 30):
        for x in range(0, w - 200, 100):
            c = g[y:y + 60, x:x + 200]
            if cv2.Laplacian(cv2.GaussianBlur(c, (0, 0), 3), cv2.CV_32F).std() < 0.6:
                칸.append(hp[y:y + 60, x:x + 200].std())
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    전체 = lab.reshape(-1, 3).mean(0)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
    d = {
        "하늘잡음": round(float(np.median(칸)), 2) if 칸 else None,
        "전체 b*": round(float(전체[2] - 128), 1),
        "채도": round(float(hsv[..., 1].mean()), 1),
        "선명": round(float(cv2.Laplacian(g, cv2.CV_32F).std()), 1),
    }
    v, box = 얼굴(im)
    if v is not None:
        x, y, bw, bh = box
        볼 = lab[y + int(bh * 0.35):y + int(bh * 0.75), x + int(bw * 0.25):x + int(bw * 0.75)].reshape(-1, 3).mean(0)
        d["얼굴 L*"] = round(float(볼[0] * 100 / 255), 1)
        d["얼굴 b*"] = round(float(볼[2] - 128), 1)
        if 기준 is not None:
            d["닮음"] = round(float(FR.match(기준, v, cv2.FaceRecognizerSF_FR_COSINE)), 2)
    return d


def main():
    a = sys.argv[1:]
    기준 = None
    if a and a[0] == "--얼굴":
        기준 = 얼굴(읽기(a[1]))[0]
        a = a[2:]
    for p in a:
        print(f"{os.path.basename(p):34s}", 재기(읽기(p), 기준))


if __name__ == "__main__":
    main()
