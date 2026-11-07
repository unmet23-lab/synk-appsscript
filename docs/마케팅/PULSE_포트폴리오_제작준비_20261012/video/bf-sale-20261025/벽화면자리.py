# 세일 편 벽 화면(전광판 · 간판) 자리 따라가기(2026-11-07, Claude) — 이은 화면(최종/s3/화면_<판>.mp4)에서 컷마다 첫 장의 어두운 벽 화면 네모를 찾고,
# 장마다 첫 장 → 그 장 닮음 변환(SIFT · RANSAC, 사람은 RANSAC이 걸러냄)을 쌓아 S3.tsx가 글자를 화면에 붙여 움직이게 한다. 화면 자체는 손대지 않는다.
#   python -X utf8 벽화면자리.py   → 자막시안_20261103/remotion/src/s3/벽화면.json  {판: {컷: {"from": 장, "rect": [x0,y0,x1,y1], "m": [[a,b,tx,ty]…]}}}
import json
import math
import os
import subprocess

import cv2
import numpy as np

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s3"
JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103", "remotion", "src", "s3", "벽화면.json")
W, H = 1080, 1920
# 판 → 컷 → (첫 장, 끝 장 다음) — 화면을 따라 글자를 얹는 구간(⑬은 휙이 시작되기 전까지만 — 휙에서는 글자도 같이 밀려 나가도록 마지막 변환에 휙 이동을 더한다)
JOBS = {"15": {"c01": (0, 23), "c06": (90, 108), "c13": (301, 344)}, "6": {"c01": (0, 22), "c05": (110, 129)}}   # 끝 두 칸은 휙 시작(15초 340장 · 6초 126장) 뒤 몇 장까지 — 잠근 칸이라 첫 장 자리를 쓴다
SAME = {("6", "c05"): ("15", "c13")}   # 11-07 끝 판(s3-13__2)은 두 판이 같은 판의 고정 구간
LOCKED = {("15", "c13"), ("6", "c05")}   # 휙 전까지 카메라 고정(판 실측 배율 0.999) — 머리가 화면 아래를 가려 찾은 네모가 흔들리니 첫 장 자리 그대로
SIFT = cv2.SIFT_create(nfeatures=3000)
BF = cv2.BFMatcher()


def frames(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


def screen_rect(img):
    # 위 45% 안에서 가장 큰 어두운 네모(벽 화면 안쪽) — 머리가 아래를 가려도 둘레 네모로 잡는다
    top = img[: int(H * 0.45)]
    v = cv2.cvtColor(top, cv2.COLOR_BGR2HSV)[..., 2]
    dark = (v < 34).astype(np.uint8) * 255
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark)
    best = None
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if w < W * 0.25 or h < 80 or x <= 2 or x + w >= W - 2:
            continue   # 화면 가장자리에 붙은 어둠은 벽
        fill = a / (w * h)
        if fill < 0.6:
            continue
        if best is None or a > best[4]:
            best = (x, y, w, h, a)
    if best is None:
        raise SystemExit("벽 화면을 못 찾음")
    x, y, w, h, _ = best
    return [int(x), int(y), int(x + w), int(y + h)]


def sim(a, b, mask):
    ga, gb = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    ka, da = SIFT.detectAndCompute(ga, mask)
    kb, db = SIFT.detectAndCompute(gb, mask)
    good = [m for m, n2 in (x for x in BF.knnMatch(da, db, k=2) if len(x) == 2) if m.distance < 0.72 * n2.distance]
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    return M, int(inl.sum()) if inl is not None else 0


def main():
    data = {}
    for name, cuts in JOBS.items():
        F = frames(os.path.join(OUT, f"화면_{name}.mp4"))
        data[name] = {}
        for cut, (a, b) in cuts.items():
            # 장마다 어두운 화면 네모를 다시 찾는다 — SIFT 맞춤은 화면 앞 얼굴을 따라가 ⑥ 돌리 줌을 1.03배로 읽었다(벽은 줄어야 맞다).
            # 아래 가장자리는 머리가 가리니 위 · 왼 · 오른 가장자리로 배율(폭)과 이동(위 가운데)을 잡고, 세 장 이동 평균으로 떨림을 누른다
            # 잠근 칸은 첫 장 자리만 찾는다 — 11-07 끝 판은 일어선 채원의 머리 · 주먹이 화면을 덮고 휙 장은 화면이 흐려 장마다 찾으면 멈춘다
            if (name, cut) in SAME:   # 같은 판 · 고정 카메라 — 6초 판 끝 컷은 첫 장부터 채원이 화면을 가려 15초 판 끝 컷의 자리를 그대로 쓴다
                rects = [data[SAME[(name, cut)][0]][SAME[(name, cut)][1]]["rect"]] * (b - a)
            else:
                rects = [screen_rect(F[a])] * (b - a) if (name, cut) in LOCKED else [screen_rect(F[i]) for i in range(a, b)]
            rect = rects[0]
            w0 = rect[2] - rect[0]
            raw = []
            for r in rects:
                s_ = (r[2] - r[0]) / w0
                cx0, cy0 = (rect[0] + rect[2]) / 2, rect[1]
                cx, cy = (r[0] + r[2]) / 2, r[1]
                raw.append([s_, cx - s_ * cx0, cy - s_ * cy0])
            raw = np.array(raw)
            sm = np.array([raw[max(0, k - 1):k + 2].mean(axis=0) for k in range(len(raw))])
            ms = [[round(float(x[0]), 5), 0.0, round(float(x[1]), 2), round(float(x[2]), 2)] for x in sm]
            low = [(a + k, rects[k]) for k in range(len(rects)) if abs((rects[k][3] - rects[k][1]) / (rect[3] - rect[1]) - sm[k][0]) > 0.06]
            if (name, cut) in LOCKED:
                ms = [[1.0, 0.0, 0.0, 0.0] for _ in ms]
                low = []
            s_end = ms[-1][0]
            data[name][cut] = {"from": a, "rect": rect, "m": ms}
            print(f"{name} {cut}: 화면 {rect} · {len(ms)}장 · 끝 배율 {s_end:.3f} 이동 {ms[-1][2]:+.1f},{ms[-1][3]:+.1f}" + (f" · 높이가 폭과 다르게 변한 장 {low[:4]}" if low else ""))
            chk = []
            for k in (0, len(ms) // 2, len(ms) - 1):
                img = F[a + k].copy()
                sc, tx, ty = ms[k][0], ms[k][2], ms[k][3]
                q = [int(sc * rect[0] + tx), int(sc * rect[1] + ty), int(sc * rect[2] + tx), int(sc * rect[3] + ty)]
                cv2.rectangle(img, (q[0], q[1]), (q[2], q[3]), (0, 255, 0), 3)
                chk.append(cv2.resize(img[: int(H * 0.5)], (360, 320)))
            cv2.imencode(".jpg", np.hstack(chk))[1].tofile(os.path.join(OUT, f"_벽화면확인_{name}_{cut}.jpg"))
    os.makedirs(os.path.dirname(JS), exist_ok=True)
    json.dump(data, open(JS, "w", encoding="utf-8"))
    print(JS)


if __name__ == "__main__":
    main()
