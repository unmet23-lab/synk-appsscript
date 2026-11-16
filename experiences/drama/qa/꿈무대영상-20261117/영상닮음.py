"""
꿈 무대 영상 시험(2026-11-17) — 받은 영상이 등록된 아바타와 같은 사람인지 0.33초마다 잰다.
사진 시험 `닮음.py`와 같은 모델(YuNet + SFace). 장마다 가장 큰 얼굴을 재고, 얼굴 띠(0.33초 간격 얼굴 크롭)와 8장 띠를 함께 남긴다.

    python -I -X utf8 영상닮음.py <아바타 기준 사진> <영상…> [--밖 <폴더>]

출력: 영상마다 한 줄(중앙 · 가장 낮음 · 얼굴 못 찾은 장 수)과 <밖>/<영상이름>_얼굴띠.jpg · _8장.jpg, 숫자는 <밖>/영상닮음.json.
"""
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def 줄임(img, 긴=1200):
    h, w = img.shape[:2]
    if max(h, w) > 긴:
        s = 긴 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    return img


def 가장큰얼굴(img):
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    if faces is None:
        return None
    faces = [f for f in faces if f[14] >= 0.6]
    return max(faces, key=lambda f: f[2]) if faces else None


def 특징(img, f):
    return FR.feature(FR.alignCrop(img, f))


def 닮(a, b):
    return round(float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE)), 3)


def main():
    args = sys.argv[1:]
    밖 = None
    if "--밖" in args:
        i = args.index("--밖")
        밖 = args[i + 1]
        del args[i:i + 2]
    기준, 영상들 = args[0], args[1:]
    img = 줄임(cv2.imdecode(np.fromfile(기준, np.uint8), cv2.IMREAD_COLOR))
    f = 가장큰얼굴(img)
    if f is None:
        raise SystemExit(f"기준 사진에서 얼굴을 못 찾음: {기준}")
    ref = 특징(img, f)
    밖 = 밖 or os.path.dirname(os.path.abspath(영상들[0]))
    os.makedirs(밖, exist_ok=True)
    결과 = {}
    for v in 영상들:
        cap = cv2.VideoCapture(v)
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 24
        if fps > 30:  # 드리미나 파일 머리는 60으로 적히지만 실제는 24장(현장 노트)
            fps = 24
        장들 = []
        k = 0
        while True:
            ok, fr = cap.read()
            if not ok:
                break
            장들.append(fr)
            k += 1
        cap.release()
        n = len(장들)
        간격 = max(1, round(fps * 0.33))
        값, 띠, 못 = [], [], 0
        for i in range(0, n, 간격):
            fr = 줄임(장들[i])
            face = 가장큰얼굴(fr)
            if face is None:
                못 += 1
                continue
            값.append((round(i / fps, 2), 닮(ref, 특징(fr, face))))
            x, y, w, h = [int(t) for t in face[:4]]
            pad = int(0.35 * max(w, h))
            crop = fr[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad]
            if crop.size:
                crop = cv2.resize(crop, (160, 160))
                cv2.putText(crop, f"{i / fps:.1f}s {값[-1][1]:.2f}", (4, 154), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
                띠.append(crop)
        이름 = os.path.splitext(os.path.basename(v))[0]
        if 띠:
            줄 = [np.hstack(띠[j:j + 10] + [np.zeros_like(띠[0])] * (10 - len(띠[j:j + 10]))) for j in range(0, len(띠), 10)]
            cv2.imencode(".jpg", np.vstack(줄))[1].tofile(os.path.join(밖, f"{이름}_얼굴띠.jpg"))
        if n:
            고른 = [장들[min(n - 1, round(t * (n - 1) / 7))] for t in range(8)]
            작게 = [cv2.resize(g, (480, int(480 * g.shape[0] / g.shape[1]))) for g in 고른]
            cv2.imencode(".jpg", np.vstack([np.hstack(작게[:4]), np.hstack(작게[4:])]))[1].tofile(os.path.join(밖, f"{이름}_8장.jpg"))
        수 = [s for _, s in 값]
        한줄 = {"장수": n, "잰 장": len(수), "얼굴 못 찾음": 못,
               "중앙": round(float(np.median(수)), 3) if 수 else None, "가장 낮음": min(수) if 수 else None, "가장 높음": max(수) if 수 else None, "값": 값}
        결과[이름] = 한줄
        print(f"{이름}: 중앙 {한줄['중앙']} · 가장 낮음 {한줄['가장 낮음']} · 가장 높음 {한줄['가장 높음']} · 잰 {len(수)}장 · 못 찾음 {못}")
    with open(os.path.join(밖, "영상닮음.json"), "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"기준": 기준, "결과": 결과}, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
