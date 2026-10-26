# 콘티 v5 카메라 재기(2026-10-26) — 원본 컷마다 손에 든 카메라가 실제로 얼마나 · 어떻게 움직이는지 재고, 우리 클립도 같은 자로 잰다.
# 유호님 10-26 「원본이랑 비교해보면 카메라 엥글 구도 기법이 너무 다른데? 지금 우리거는 너무 정적이라 재미가 없는것같아」.
#   python -X utf8 카메라재기_v5.py [우리 클립 폴더]   → 원본 27컷(광고 카드 넷 빼고) 표 · <폴더>의 S??_*.mp4 표, synk-vendor/…/영상/_카메라.json
# 재는 법(v4_흔들림.py와 같은 자): 이웃 프레임끼리 특징점(LK 흐름 + RANSAC 닮음 변환)으로 화면 가운데의 이동 · 기울기 · 배율을 재 누적하고,
#   가우스(σ 6프레임)로 느린 흐름(팬 · 틸트 · 밀기)과 떨림을 가른다. 이동은 화면 폭의 %(1920 기준 1% = 19px).
#   떨림 = 빠른 흔들림의 RMS, 흐름 = 느린 이동의 처음 → 끝 거리와 방향, 밀기 = 배율 처음 → 끝(1.10이면 10% 다가감), 속도 = 이웃 프레임 이동의 중앙값.
# 사람 · 물건이 크게 움직이는 컷은 그 움직임이 섞인다(카메라만 따로 못 뗀다) — 숫자는 프레임으로 다시 본다.
import glob
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
REEL = os.path.join(V, "원본", "DeucDo_SVU5.mp4")
SH = json.load(open(os.path.join(V, "원본", "원본_샷.json"), encoding="utf-8"))
CARDS = {11, 21, 27, 29}
SIG = 6.0
W, H = 480, 270


def gray(path, vf):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", vf + f",scale={W}:{H},format=gray", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W)


def steps(frames):
    """이웃 프레임마다 화면 가운데의 이동(화면 폭 비율) · 기울기(도) · 배율."""
    c = np.array([W / 2, H / 2, 1.0])
    out = [(0.0, 0.0, 0.0, 1.0)]
    for a, b in zip(frames[:-1], frames[1:]):
        mv = (0.0, 0.0, 0.0, 1.0)
        p0 = cv2.goodFeaturesToTrack(a, maxCorners=400, qualityLevel=0.01, minDistance=6, blockSize=7)
        if p0 is not None and len(p0) >= 12:
            p1, st, _ = cv2.calcOpticalFlowPyrLK(a, b, p0, None, winSize=(21, 21), maxLevel=3)
            ok = st.ravel() == 1
            if ok.sum() >= 12:
                M, _ = cv2.estimateAffinePartial2D(p0[ok], p1[ok], method=cv2.RANSAC, ransacReprojThreshold=1.5)
                if M is not None:
                    cx, cy = M @ c
                    mv = ((cx - c[0]) / W, (cy - c[1]) / W, float(np.degrees(np.arctan2(M[1, 0], M[0, 0]))), float(np.hypot(M[0, 0], M[1, 0])))
        out.append(mv)
    return np.array(out)


def measure(frames, fps=24.0):
    st = steps(frames)
    tr = np.cumsum(st[:, :3], axis=0)
    zoom = np.cumprod(st[:, 3])
    n = len(tr)
    if n < 4:
        return None
    p = min(n - 1, int(3 * SIG))
    pad = np.vstack([2 * tr[0] - tr[p:0:-1], tr, 2 * tr[-1] - tr[-2:-p - 2:-1]])
    slow = gaussian_filter1d(pad, SIG, axis=0, mode="nearest")[p:p + n]
    fast = tr - slow
    drift = slow[-1, :2] - slow[0, :2]
    ang = float(np.degrees(np.arctan2(drift[1], drift[0])))
    way = "오른쪽" if -45 <= ang < 45 else "아래" if 45 <= ang < 135 else "위" if -135 <= ang < -45 else "왼쪽"
    return {"프레임": n, "떨림%": round(float(np.sqrt((fast[:, :2] ** 2).sum(1).mean())) * 100, 2),
            "흐름%": round(float(np.hypot(*drift)) * 100, 1), "흐름 쪽(화면이 가는 쪽)": way,
            "밀기": round(float(zoom[-1]), 3), "기울기 폭°": round(float(tr[:, 2].max() - tr[:, 2].min()), 1),
            "속도%/프레임": round(float(np.median(np.hypot(st[1:, 0], st[1:, 1]))) * 100, 2)}


def main():
    out = {"원본": {}, "우리": {}}
    reel = gray(REEL, "crop=720:404:0:438")
    print("원본 컷 · 떨림%(빠른 흔들림 RMS) · 흐름%(느린 이동 거리) · 쪽 · 밀기 · 기울기 폭° · 속도%/프레임")
    for i, s in enumerate(SH, 1):
        if i in CARDS:
            continue
        m = measure(reel[s["f0"]:s["f1"]])
        out["원본"][i] = m
        print(f"#{i:<3} {s['dur']:.2f}초", m)
    if len(sys.argv) > 1:
        for p in sorted(glob.glob(os.path.join(sys.argv[1], "S*_*.mp4"))):
            m = measure(gray(p, "null"))
            out["우리"][os.path.basename(p)] = m
            print(os.path.basename(p), m)
    json.dump(out, open(os.path.join(V, "영상", "_카메라.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
