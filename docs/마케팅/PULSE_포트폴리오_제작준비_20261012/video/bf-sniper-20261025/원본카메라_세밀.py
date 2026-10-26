# 블프 스나이퍼 원본 카메라 세밀 실측(2026-10-26) — 유호님(10-26 23:2x, 9번 세션 전달) 「원본이랑 카메라 기법도 완전히 똑같게」.
# 컷마다 매 프레임: 사람을 가린 배경 특징점을 다음 프레임으로 따라가(Lucas-Kanade) 닮음 변환(이동 · 배율 · 돌림)을 쌓는다.
# 결과는 카메라 기준으로 적는다 — 장면이 왼쪽으로 흐르면 카메라는 오른쪽으로 간 것(팬 · 옆 이동 구분은 눈으로).
#   - 움직임 구간: 프레임마다 빠르기(화면 폭 %/초)가 문턱을 넘는 시작 · 멈춤 초, 구간의 처음 · 가운데 · 끝 빠르기(빨라짐 · 느려짐)
#   - 흔들림: 0.5초로 고르게 한 곡선과 날 곡선의 차이(RMS, 화면 폭 %) — 손으로 든 카메라인지
#   - 초점: 사람 자리 · 배경의 선명도(라플라시안 분산) 비율이 컷 안에서 어떻게 바뀌는지
#   python -X utf8 원본카메라_세밀.py   → 원본실측/A_타깃2011/카메라_세밀.json · 카메라_세밀_그래프.png
import json
import sys
from pathlib import Path

import cv2
import numpy as np

R = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/레퍼런스/bf-sniper")
SRC = R / "원본영상/vm_74699350/vm_74699350.mp4"
OUT = R / "원본실측/A_타깃2011"
W, H = 640, 360
_ses = None


def person_mask(bgr):
    global _ses
    from PIL import Image
    from rembg import new_session, remove
    _ses = _ses or new_session("u2net_human_seg")
    small = cv2.resize(bgr, (320, 180))
    m = np.asarray(remove(Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)), session=_ses, only_mask=True))
    m = cv2.resize(m, (W, H)) > 127
    return cv2.dilate(m.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0


def step(g0, g1, bg):
    pts = cv2.goodFeaturesToTrack(g0, 400, 0.01, 8, mask=bg.astype(np.uint8) * 255)
    if pts is None or len(pts) < 12:
        return None
    p1, st, _ = cv2.calcOpticalFlowPyrLK(g0, g1, pts, None, winSize=(21, 21), maxLevel=3)
    ok = st.ravel() == 1
    if ok.sum() < 12:
        return None
    M, inl = cv2.estimateAffinePartial2D(pts[ok], p1[ok], method=cv2.RANSAC, ransacReprojThreshold=1.5)
    if M is None or inl.sum() < 10:
        return None
    s = float(np.hypot(M[0, 0], M[1, 0]))
    rot = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
    # 가운데를 기준으로 한 이동(배율 때문에 생기는 이동을 뺀다)
    c = np.array([W / 2, H / 2])
    mc = M[:, :2] @ c + M[:, 2]
    return dict(dx=float(mc[0] - c[0]) / W * 100, dy=float(mc[1] - c[1]) / H * 100, s=s, rot=rot, n=int(inl.sum()))


def sharp(g, m):
    lap = cv2.Laplacian(g, cv2.CV_64F)
    a = lap[m].var() if m.sum() > 500 else None
    b = lap[~m].var() if (~m).sum() > 500 else None
    return a, b


def smooth(x, k):
    if len(x) < 3:
        return np.array(x)
    k = max(3, k | 1)
    pad = np.pad(np.array(x, float), (k // 2, k // 2), mode="edge")
    return np.convolve(pad, np.ones(k) / k, mode="valid")


def main():
    shots = json.load(open(OUT / "원본_샷.json", encoding="utf-8"))
    shots = shots["shots"] if isinstance(shots, dict) else shots
    cap = cv2.VideoCapture(str(SRC))
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(cv2.resize(f, (W, H)))
    print("프레임", len(frames), "fps", round(fps, 3), file=sys.stderr)
    res = []
    for sh in shots:
        n, a, b = sh.get("n") or sh.get("번호"), sh.get("start", sh.get("시작")), sh.get("end", sh.get("끝"))
        f0, f1 = int(round(a * fps)) + 1, int(round(b * fps)) - 1
        if f1 - f0 < 4 or frames[f0].mean() < 8:   # 검은 화면
            res.append(dict(n=n, start=a, end=b, black=True))
            continue
        cum = dict(dx=[0.0], dy=[0.0], s=[1.0], rot=[0.0])
        fail, shp, shb, ninl = 0, [], [], []
        mask = None
        for i in range(f0, f1):
            if mask is None or (i - f0) % 3 == 0:
                mask = person_mask(frames[i])
            g0 = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
            g1 = cv2.cvtColor(frames[i + 1], cv2.COLOR_BGR2GRAY)
            st = step(g0, g1, ~mask)
            if st is None:
                fail += 1
                st = dict(dx=0.0, dy=0.0, s=1.0, rot=0.0, n=0)
            # 장면 움직임 → 카메라 움직임(부호를 뒤집는다)
            cum["dx"].append(cum["dx"][-1] - st["dx"])
            cum["dy"].append(cum["dy"][-1] - st["dy"])
            cum["s"].append(cum["s"][-1] * st["s"])
            cum["rot"].append(cum["rot"][-1] - st["rot"])
            ninl.append(st["n"])
            p, q = sharp(g0, mask)
            shp.append(p)
            shb.append(q)
        t = [a + (k + 1) / fps for k in range(len(cum["dx"]))]
        dx, dy = np.array(cum["dx"]), np.array(cum["dy"])
        zoom = (np.array(cum["s"]) - 1) * 100
        k = int(round(fps * 0.5))
        sx, sy, sz = smooth(dx, k), smooth(dy, k), smooth(zoom, k)
        jitter = float(np.sqrt(np.mean((dx - sx) ** 2 + (dy - sy) ** 2)))
        v = np.hypot(np.gradient(sx), np.gradient(sy)) * fps + np.abs(np.gradient(sz)) * fps   # %/초
        thr = 1.0
        act = v > thr
        segs = []
        i = 0
        while i < len(act):
            if act[i]:
                j = i
                while j < len(act) and act[j]:
                    j += 1
                if j - i >= max(3, int(fps * 0.15)):
                    seg = v[i:j]
                    th = max(1, (j - i) // 3)
                    segs.append(dict(start=round(t[i], 2), end=round(t[min(j, len(t) - 1)], 2),
                                     dx=round(float(sx[min(j, len(sx) - 1)] - sx[i]), 1), dy=round(float(sy[min(j, len(sy) - 1)] - sy[i]), 1),
                                     zoom=round(float(sz[min(j, len(sz) - 1)] - sz[i]), 1),
                                     v_first=round(float(seg[:th].mean()), 1), v_mid=round(float(seg[th:-th].mean() if j - i > 2 * th else seg.mean()), 1),
                                     v_last=round(float(seg[-th:].mean()), 1), v_peak=round(float(seg.max()), 1)))
                i = j
            else:
                i += 1
        ratio = [p / q if (p and q) else None for p, q in zip(shp, shb)]
        rr = [r for r in ratio if r]
        third = max(1, len(rr) // 3)
        focus = dict(first=round(float(np.median(rr[:third])), 2), last=round(float(np.median(rr[-third:])), 2)) if len(rr) > 6 else None
        res.append(dict(n=n, start=a, end=b, frames=len(t), fail=fail, inliers_med=int(np.median(ninl)) if ninl else 0,
                        total=dict(dx=round(float(dx[-1]), 2), dy=round(float(dy[-1]), 2), zoom=round(float(zoom[-1]), 2), rot=round(float(cum["rot"][-1]), 2)),
                        jitter=round(jitter, 3), v_max=round(float(v.max()), 1), segments=segs, focus_ratio=focus,
                        curve=dict(t=[round(x, 3) for x in t], dx=[round(x, 3) for x in dx], dy=[round(x, 3) for x in dy], zoom=[round(x, 3) for x in zoom])))
        r = res[-1]
        print(n, f"{a:.2f}-{b:.2f}", "합", r["total"], "흔들림", r["jitter"], "구간", [(s["start"], s["end"], s["dx"], s["dy"], s["zoom"]) for s in segs],
              "초점", focus, "실패", fail, "inl", r["inliers_med"])
    json.dump(dict(src=str(SRC), fps=fps, note="카메라 기준 · 화면 % · 사람 가림(rembg u2net_human_seg) · LK 특징점 + RANSAC 닮음 변환", shots=res),
              open(OUT / "카메라_세밀.json", "w", encoding="utf-8"), ensure_ascii=False)
    graph(res)


def graph(res):
    # matplotlib이 없어 PIL로 — 줄마다 컷 하나, 파랑 dx(카메라 →) · 주황 dy(카메라 ↓) · 초록 zoom(%), 회색 0선
    from PIL import Image, ImageDraw, ImageFont
    rows = [r for r in res if not r.get("black")]
    RW, RH = 1200, 110
    img = Image.new("RGB", (RW, RH * len(rows)), "white")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 14)
    for k, r in enumerate(rows):
        c = r["curve"]
        y0 = k * RH
        ys = [v for key in ("dx", "dy", "zoom") for v in c[key]]
        lo, hi = min(ys + [-0.5]), max(ys + [0.5])
        t0, t1 = c["t"][0], c["t"][-1]
        X = lambda t: 90 + (t - t0) / max(t1 - t0, 1e-6) * (RW - 110)
        Y = lambda v: y0 + 8 + (hi - v) / (hi - lo) * (RH - 16)
        d.line((90, Y(0), RW - 20, Y(0)), fill=(190, 190, 190))
        for key, col in (("dx", (40, 90, 220)), ("dy", (230, 130, 30)), ("zoom", (40, 160, 70))):
            d.line([(X(t), Y(v)) for t, v in zip(c["t"], c[key])], fill=col, width=2)
        d.text((6, y0 + 8), f"{r['n']}  {r['start']:.2f}-{r['end']:.2f}", font=f, fill="black")
        d.text((6, y0 + 30), f"{lo:.1f}~{hi:.1f}%", font=f, fill=(120, 120, 120))
        d.line((0, y0 + RH - 1, RW, y0 + RH - 1), fill=(220, 220, 220))
    img.save(OUT / "카메라_세밀_그래프.png")


if __name__ == "__main__":
    main()
