# 시즌 1 「옆집의 크리스마스」 원본(Woodie's) 36컷의 카메라 기법을 프레임마다 잰다(2026-10-26 밤).
# 유호님 10-26 23:2x(포트폴리오 세션 전달) 「원본이랑 카메라 기법이 너무 다른데? … 원본이랑 카메라 기법도 완전히 똑같게 하라」 —
# 샷표 1절(처음 · 끝 두 프레임 비교)보다 자세히: 움직임 종류 · 크기 · 방향 · 시작과 멈춤 초 · 빨라짐과 느려짐 · 손떨림 · 초점 이동.
#   python -X utf8 원본카메라재기.py            → git 밖 레퍼런스/원본실측/s1A_우디스/카메라_컷마다.json · 카메라_컷마다.jpg(컷마다 곡선)
# 재는 법: 컷마다 25fps 모든 프레임을 960×540 회색으로, 사람 자리(배치도 실루엣 · 크게 넓힘)를 뺀 바탕에서 특징점을 따라가
# (goodFeaturesToTrack → calcOpticalFlowPyrLK) 이웃 프레임 사이 닮은꼴 변환(estimateAffinePartial2D · RANSAC)을 잇는다.
# 누적값을 첫 프레임 기준 배율 · 가로 · 세로 이동(화면 %)과 기울기(°)로 두고, 9프레임 가운데값 + 이동평균으로 고른 곡선 = 의도한 움직임,
# 남는 떨림 = 손떨림(표준편차, 화면 %). 초점은 4×4 칸마다 라플라시안 분산 — 가장 또렷한 칸과 그 비가 컷 안에서 옮겨 가는지 본다.
# 바탕이 거의 다 흐린 얼굴 접사는 특징점이 적어 「약함」으로 적고 숫자를 믿지 않는다(눈으로 본 판정을 함께 적는다).
import json
from pathlib import Path

import cv2
import numpy as np

R = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/레퍼런스")
SRC = R / "원본영상" / "hq_3cAzAf6s3ic" / "hq_3cAzAf6s3ic_h264.mp4"
OUT = R / "원본실측" / "s1A_우디스"
MASKS = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors/배치")
STARTS = [0.00, 3.56, 4.52, 5.88, 7.04, 8.64, 10.08, 11.88, 13.28, 15.00, 15.96, 17.40, 18.80, 20.00, 21.44, 22.76, 24.12, 24.60,
          25.88, 28.44, 30.76, 32.00, 33.36, 34.48, 35.92, 37.48, 38.88, 40.12, 42.88, 44.04, 46.44, 47.60, 49.68, 50.84, 54.84, 57.08]
END = 60.04
FPS = 25.0
W, H = 960, 540


def frames(cap, a, b):
    f0, f1 = int(round(a * FPS)), int(round(b * FPS))
    cap.set(cv2.CAP_PROP_POS_FRAMES, f0)
    out = []
    for _ in range(f1 - f0):
        ok, fr = cap.read()
        if not ok:
            break
        out.append(cv2.cvtColor(cv2.resize(fr, (W, H), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY))
    return out


def bg_mask(n):
    """사람 자리를 뺀 바탕(255 = 쓸 곳). 실루엣이 없으면 전체"""
    p = MASKS / f"S{n:02d}_mask.png"
    m = np.full((H, W), 255, np.uint8)
    if p.exists():
        pm = cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_GRAYSCALE)
        if pm is not None and pm.any():
            pm = cv2.resize(pm, (W, H), interpolation=cv2.INTER_NEAREST)
            pm = cv2.dilate(pm, np.ones((61, 61), np.uint8))
            if (pm > 0).mean() < 0.75:   # 사람이 화면 거의 전부면 빼지 않는다(얼굴 접사 — 남은 바탕이 너무 적다)
                m[pm > 0] = 0
    return m


def step(a, b, mask):
    """a → b 닮은꼴 변환(배율 s, 회전 r, 이동 tx · ty px)과 쓴 점 수"""
    pts = cv2.goodFeaturesToTrack(a, maxCorners=600, qualityLevel=0.01, minDistance=7, mask=mask, blockSize=7)
    if pts is None or len(pts) < 12:
        return None, 0
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None, winSize=(21, 21), maxLevel=3)
    good = st.reshape(-1) == 1
    p0, p1 = pts[good], nxt[good]
    if len(p0) < 10:
        return None, len(p0)
    M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=1.5, maxIters=2000)
    if M is None:
        return None, 0
    return M, int(inl.sum()) if inl is not None else 0


def compose(A, B):
    """A 다음 B(2×3)"""
    A3 = np.vstack([A, [0, 0, 1]])
    B3 = np.vstack([B, [0, 0, 1]])
    return (B3 @ A3)[:2]


def sharp_grid(g):
    lap = cv2.Laplacian(g, cv2.CV_32F, ksize=3)
    hs, ws = H // 4, W // 4
    return np.array([[float(lap[i * hs:(i + 1) * hs, j * ws:(j + 1) * ws].var()) for j in range(4)] for i in range(4)])


def smooth(x, k=9):
    if len(x) < 3:
        return np.array(x, float)
    k = min(k, len(x) - (1 - len(x) % 2))
    k = max(3, k | 1)
    pad = k // 2
    xp = np.pad(np.array(x, float), pad, mode="edge")
    med = np.array([np.median(xp[i:i + k]) for i in range(len(x))])
    mp = np.pad(med, 2, mode="edge")
    return np.convolve(mp, np.ones(5) / 5, mode="valid")


def describe(n, t, s, tx, ty, rot, weak):
    """곡선 → 종류 · 크기 · 방향 · 시작 · 멈춤 · 빨라짐 · 손떨림(한국어 한 줄과 숫자)"""
    ss, sx, sy, sr = smooth(s), smooth(tx), smooth(ty), smooth(rot)
    shake = float(np.sqrt(np.mean((np.array(tx) - sx) ** 2 + (np.array(ty) - sy) ** 2)))   # 화면 % 떨림(가로세로 합)
    total = {"배율": round((ss[-1] - 1) * 100, 1), "가로": round(sx[-1], 1), "세로": round(sy[-1], 1), "기울기": round(sr[-1], 2)}
    # 움직임 크기 곡선(배율은 %로 바꿔 함께 본다) — 속도 봉우리의 15%를 넘는 첫 · 끝 프레임이 시작 · 멈춤
    mag = np.sqrt(((ss - 1) * 100) ** 2 + sx ** 2 + sy ** 2)
    v = np.abs(np.gradient(mag)) if len(mag) > 2 else np.zeros_like(mag)
    peak = float(v.max()) if len(v) else 0.0
    moving = bool(mag[-1] > 1.0) if len(mag) else False
    out = {"n": n, "약함": bool(weak), "합": total, "손떨림%": round(shake, 2), "움직임": moving}
    if moving and peak > 0:
        idx = np.where(v > peak * 0.15)[0]
        a, b = int(idx[0]), int(idx[-1])
        out["시작초"], out["멈춤초"] = round(float(t[a]), 2), round(float(t[b]), 2)
        thirds = np.array_split(v[a:b + 1], 3) if b > a + 3 else [v]
        m3 = [float(np.mean(x)) if len(x) else 0.0 for x in thirds]
        if len(m3) == 3 and m3[2] > m3[0] * 1.5:
            out["빠르기"] = "점점 빨라짐"
        elif len(m3) == 3 and m3[0] > m3[2] * 1.5:
            out["빠르기"] = "점점 느려짐"
        else:
            out["빠르기"] = "고른 속도"
    return out


if __name__ == "__main__":
    cap = cv2.VideoCapture(str(SRC))
    res = []
    curves = {}
    for i, a in enumerate(STARTS):
        n = i + 1
        b = STARTS[i + 1] if i + 1 < len(STARTS) else END
        fr = frames(cap, a, b)
        mask = bg_mask(n)
        acc = np.array([[1, 0, 0], [0, 1, 0]], float)
        t, s, tx, ty, rot, inl = [a], [1.0], [0.0], [0.0], [0.0], []
        sharp = [sharp_grid(fr[0])] if fr else []
        for k in range(1, len(fr)):
            M, ni = step(fr[k - 1], fr[k], mask)
            inl.append(ni)
            if M is not None:
                acc = compose(acc, M)
            sc = float(np.sqrt(acc[0, 0] ** 2 + acc[1, 0] ** 2))
            # 화면 가운데가 옮겨 간 양(배율 때문에 생기는 이동을 빼고 본다) — 내용이 왼쪽으로 가면 음수(= 카메라가 오른쪽으로)
            cx, cy = W / 2, H / 2
            mx = acc[0, 0] * cx + acc[0, 1] * cy + acc[0, 2]
            my = acc[1, 0] * cx + acc[1, 1] * cy + acc[1, 2]
            t.append(a + k / FPS)
            s.append(sc)
            tx.append((mx - cx) / W * 100)
            ty.append((my - cy) / H * 100)
            rot.append(float(np.degrees(np.arctan2(acc[1, 0], acc[0, 0]))))
            if k % 3 == 0:
                sharp.append(sharp_grid(fr[k]))
        weak = bool(inl) and float(np.median(inl)) < 40
        d = describe(n, t, s, tx, ty, rot, weak)
        d["점 수(가운데값)"] = int(np.median(inl)) if inl else 0
        if len(sharp) >= 2:
            g0, g1 = sharp[0], sharp[-1]
            i0, i1 = np.unravel_index(np.argmax(g0), g0.shape), np.unravel_index(np.argmax(g1), g1.shape)
            ratio = float(g1.max() / max(g0.max(), 1e-6))
            d["초점"] = {"처음 또렷한 칸": [int(i0[0]), int(i0[1])], "끝 또렷한 칸": [int(i1[0]), int(i1[1])], "또렷함 비": round(ratio, 2),
                       "옮겨 감": bool(i0 != i1 and (g1[i1] / max(g1[i0], 1e-6) > 2.0) and (g0[i0] / max(g0[i1], 1e-6) > 2.0))}
        res.append(d)
        curves[n] = {"t": t, "s": s, "tx": tx, "ty": ty}
        print(n, json.dumps({k: v for k, v in d.items() if k != "n"}, ensure_ascii=False))
    (OUT / "카메라_컷마다.json").write_text(json.dumps({"src": SRC.name, "fps": FPS, "cuts": res, "curves": curves}, ensure_ascii=False), encoding="utf-8")
    # 곡선 한 판(컷마다 배율 % · 가로 % · 세로 %)
    CW, CH, C = 300, 150, 6
    img = np.full((((36 + C - 1) // C) * (CH + 30), C * (CW + 10), 3), 24, np.uint8)
    for i in range(36):
        n = i + 1
        x0, y0 = (i % C) * (CW + 10), (i // C) * (CH + 30) + 22
        cv2.putText(img, f"#{n}", (x0 + 4, y0 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
        cv2.rectangle(img, (x0, y0), (x0 + CW, y0 + CH), (70, 70, 70), 1)
        c = curves[n]
        L = len(c["t"])
        if L < 2:
            continue
        for key, col, f in (("s", (80, 200, 255), lambda v: (v - 1) * 100), ("tx", (120, 255, 120), lambda v: v), ("ty", (255, 140, 140), lambda v: v)):
            ys = [f(v) for v in c[key]]
            sc = 50.0
            pts = [(x0 + int(k / (L - 1) * CW), y0 + CH // 2 - int(max(-1, min(1, yv / sc)) * (CH // 2 - 4))) for k, yv in enumerate(ys)]
            for p, q in zip(pts, pts[1:]):
                cv2.line(img, p, q, col, 1)
    ok, buf = cv2.imencode(".jpg", img)
    buf.tofile(str(OUT / "카메라_컷마다.jpg"))
    print("끝")
