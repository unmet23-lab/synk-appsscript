# 시안 사람 사진의 주근깨·점을 사진 보정처럼 줄인다(2026-10-21, 영상 게이트 Fable 재확인 P2 — 채원 가슴 주근깨·점, 준호 뺨 점).
#   점 찾기는 주근깨_세기.py와 같다: 얼굴 폭 600px 잣대로 흐림 1.0 뒤 주변(흐림 9)보다 14 넘게 어두운 넓이 10~300px 점.
#   --얼굴 f · --몸 f: 그 점들을 주변 피부색 쪽으로 f만큼 옮긴다(0.5 = 진하기 절반). 점은 남고 옅어진다. 몸은 문턱 9(옅고 촘촘한 가슴 주근깨).
#   --점 N: 얼굴 피부에서 진한 점(주변보다 24 넘게 어두움)을 N개만 남기고 TELEA로 지운다(대표 사진의 점 수에 맞출 때).
#   --몸점 K: 몸 피부(턱 아래, 피부색)에서 가장 진한 점 K개를 지운다(채원 S1 가슴 가운데 점).
#   얼굴 칸은 MediaPipe 얼굴 표지(눈·눈썹·입술·콧구멍 뺌), 몸 칸은 턱 아래의 피부색(YCrCb) 화소다. 캔·옷·머리카락은 건드리지 않는다.
#   쓰기(MediaPipe가 있는 C:\SYNK-LoRA\tools\measure 가상환경):
#     python -X utf8 점_다듬기.py <사람.png> <출력.png> [--얼굴 0.5] [--몸 0.5] [--점 3] [--몸점 1]
#   출력: <출력.png> · <출력>_확인.jpg(얼굴·가슴 전후) · <출력>.json(지우고 옅게 한 점 수)
import argparse
import json
import os
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 주근깨_세기 import LBROW, LEYE, LIPS, MODEL, NOSTRIL, OVAL, RBROW, REYE  # noqa: E402


def face_mask(P, shape):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [P[OVAL]], 1)
    for grp, grow in ((LEYE, 0.03), (REYE, 0.03), (LBROW, 0.023), (RBROW, 0.023), (LIPS, 0.023), (NOSTRIL, 0.017)):
        k = np.zeros_like(m)
        cv2.fillPoly(k, [cv2.convexHull(P[grp])], 1)
        g = max(3, int(grow * (P[454, 0] - P[234, 0])))
        m[cv2.dilate(k, np.ones((g, g), np.uint8)) > 0] = 0
    return cv2.erode(m, np.ones((9, 9), np.uint8)).astype(bool)


def body_mask(img, P, face):
    ycc = cv2.cvtColor(img, cv2.COLOR_RGB2YCrCb)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)  # H 0~180
    skin = ((ycc[..., 1] >= 138) & (ycc[..., 1] <= 178) & (ycc[..., 2] >= 80) & (ycc[..., 2] <= 130) & (ycc[..., 0] > 50)
            & ((hsv[..., 0] <= 13) | (hsv[..., 0] >= 170)) & (hsv[..., 1] >= 45))
    # 칸: 턱 끝 조금 아래부터 얼굴 폭 1.3배 아래까지, 좌우는 턱 가운데에서 얼굴 폭 0.9배 안(가슴·어깨 둘레)
    fw = P[454, 0] - P[234, 0]
    band = np.zeros(img.shape[:2], bool)
    band[int(P[152, 1] + 0.02 * img.shape[0]):int(P[152, 1] + 1.3 * fw), max(int(P[152, 0] - 0.9 * fw), 0):int(P[152, 0] + 0.9 * fw)] = True
    m = skin & band & ~cv2.dilate(face.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)
    # 검은 점·주근깨 자리는 피부색이 아니라 칸에 구멍으로 빠진다(채원 S1 가슴 점) → 작은 구멍을 닫고 나서 잔티를 걷는다
    g = max(7, int(0.04 * fw)) | 1
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((g, g), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) & band.astype(np.uint8)
    # 베이지 텐트·재킷의 밝은 곳·나무 팔걸이도 피부색에 들어서(채원 캠핑 500점), 목에서 이어진 덩어리만 남긴다
    n, lab = cv2.connectedComponents(m, 8)
    y0, y1 = int(P[152, 1] + 0.04 * img.shape[0]), int(P[152, 1] + 0.10 * img.shape[0])
    x0, x1 = int(P[152, 0] - 0.2 * fw), int(P[152, 0] + 0.2 * fw)
    seeds = set(np.unique(lab[y0:y1, max(x0, 0):x1])) - {0}
    m = np.isin(lab, list(seeds)).astype(np.uint8)
    return cv2.erode(m, np.ones((7, 7), np.uint8)).astype(bool)


def spots(L, mask, s, thr):
    """얼굴 폭 600px 잣대(s = 600/얼굴 폭)의 점 찾기를 원래 크기로: 라벨 · 넓이 · 진하기."""
    Lb = cv2.GaussianBlur(L, (0, 0), 1.0 / s)
    bg = cv2.GaussianBlur(Lb, (0, 0), 9.0 / s)
    dark = ((bg - Lb) > thr) & mask
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark.astype(np.uint8), 8)
    amin, amax = 10 / (s * s), 300 / (s * s)
    keep = []
    for i in range(1, n):
        a = st[i, cv2.CC_STAT_AREA]
        if amin <= a <= amax:
            keep.append((i, a, float((bg - Lb)[lab == i].max())))
    return lab, keep, bg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    ap.add_argument("--얼굴", dest="face", type=float, default=0.0)
    ap.add_argument("--몸", dest="body", type=float, default=0.0)
    ap.add_argument("--점", dest="moles", type=int, default=-1)
    ap.add_argument("--몸점", dest="body_moles", type=int, default=0)
    a = ap.parse_args()

    img = np.asarray(Image.open(a.base).convert("RGB"))
    det = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(base_options=mp_python.BaseOptions(model_asset_path=MODEL), num_faces=1))
    lm = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=img)).face_landmarks[0]
    P = np.array([[l.x * img.shape[1], l.y * img.shape[0]] for l in lm]).astype(np.int32)
    s = 600.0 / (P[454, 0] - P[234, 0])
    face = face_mask(P, img.shape[:2])
    body = body_mask(img, P, face)
    L = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)[..., 0].astype(np.float32)
    out = img.astype(np.float32)
    bg_rgb = cv2.GaussianBlur(out, (0, 0), 9.0 / s)
    info = {"base": a.base, "faceWidthPx": int(P[454, 0] - P[234, 0])}
    erase = np.zeros(img.shape[:2], np.uint8)

    def lighten(mask, f, skip, thr=14.0):
        lab, keep, _ = spots(L, mask, s, thr)
        sel = np.isin(lab, [i for i, _, _ in keep if i not in skip])
        w = cv2.GaussianBlur(cv2.dilate(sel.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 0.8) * f
        return w, len(keep)

    if a.moles >= 0:  # 진한 점은 N개만 남기고 지운다
        lab, keep, _ = spots(L, face, s, 24.0)
        keep.sort(key=lambda t: -t[1] * t[2])
        for i, _, _ in keep[a.moles:]:
            erase |= (lab == i).astype(np.uint8)
        info["faceMoles"] = {"found": len(keep), "kept": min(a.moles, len(keep)), "erased": max(len(keep) - a.moles, 0)}
    if a.body_moles > 0:
        lab, keep, _ = spots(L, body, s, 24.0)
        keep.sort(key=lambda t: -t[2])
        for i, _, _ in keep[:a.body_moles]:
            erase |= (lab == i).astype(np.uint8)
        info["bodyMoles"] = {"found": len(keep), "erased": min(a.body_moles, len(keep))}
    wsum = np.zeros(img.shape[:2], np.float32)
    if a.face > 0:
        w, n = lighten(face, a.face, set())
        wsum = np.maximum(wsum, w)
        info["faceFreckles"] = {"found": n, "factor": a.face}
    if a.body > 0:
        w, n = lighten(body, a.body, set(), 9.0)  # 몸의 주근깨는 얼굴보다 옅고 촘촘해 문턱을 낮춘다
        wsum = np.maximum(wsum, w)
        info["bodyFreckles"] = {"found": n, "factor": a.body}
    out = out + (bg_rgb - out) * wsum[..., None]
    out8 = np.clip(out, 0, 255).astype(np.uint8)
    if erase.any():
        out8 = cv2.inpaint(out8, cv2.dilate(erase, np.ones((5, 5), np.uint8)), 4, cv2.INPAINT_TELEA)
    Image.fromarray(out8).save(a.out)

    # 확인판: 얼굴 · 가슴(턱 아래) 전후
    fx0, fx1 = P[234, 0], P[454, 0]
    fy0, fy1 = P[10, 1] - (fx1 - fx0) // 6, P[152, 1] + (fx1 - fx0) // 2
    box = (max(fx0 - 40, 0), max(fy0, 0), min(fx1 + 40, img.shape[1]), min(fy1 + (fx1 - fx0) // 2, img.shape[0]))
    pair = [Image.fromarray(x).crop(box) for x in (img, out8)]
    h = 900
    pair = [p.resize((int(p.width * h / p.height), h), Image.LANCZOS) for p in pair]
    sheet = Image.new("RGB", (pair[0].width * 2 + 10, h), "white")
    sheet.paste(pair[0], (0, 0))
    sheet.paste(pair[1], (pair[0].width + 10, 0))
    sheet.save(os.path.splitext(a.out)[0] + "_확인.jpg", quality=90)
    json.dump(info, open(os.path.splitext(a.out)[0] + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(info, ensure_ascii=False))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
