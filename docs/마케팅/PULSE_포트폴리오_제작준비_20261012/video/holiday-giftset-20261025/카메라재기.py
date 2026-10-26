# 시즌 2 · 홀리데이 기프트 세트 — 원본과 우리 판의 카메라를 같은 자로 잰다 (2026-10-26)
#   python 카메라재기.py <영상.mp4> --덩이 0,2.0,3.2,12.0,15.48,17.4 [--가림 0.43-0.53@0-2.0,0.43-0.53@14.6-17.4] [--이름 원본]
#       → <영상 옆>/카메라재기_<이름>.json · .png
# 연속 두 프레임에서 특징점을 따라가(LK 광류 · 앞뒤 대조) 닮음 변환(이동 · 확대 · 돎)을 RANSAC으로 구한다. 값은 화면 속
# 내용이 움직인 양이다 — 내용이 오른쪽으로 가면 카메라는 왼쪽으로 간 것, 확대가 1보다 크면 다가간 것(또는 당겨 찍기).
# 덩이마다 누적(가로 · 세로 이동 % · 배율 · 돎 °)과 움직임이 시작 · 멈춘 초, 빠르기 곡선, 손떨림(이동에서 5프레임 이동평균을
# 뺀 나머지의 RMS, 반 해상도 px), 초점(위 · 가운데 · 아래 세 띠의 라플라시안 분산 — 어느 띠가 가장 또렷한지 바뀌면 초점 이동)을 낸다.
# 원본 프레임은 저장소에 올리지 않는다 — 이 도구는 숫자만 낸다.
import json
import math
import os
import sys

import cv2
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")


def opt(args, name, default):
    return args[args.index(name) + 1] if name in args else default


def masks_for(spec, t, w, h):
    """가림: 「y0-y1@t0-t1」(화면 높이 비율 · 초) — 그 시각에는 그 띠의 특징점을 쓰지 않는다(고정 글자 오버레이)."""
    m = np.full((h, w), 255, np.uint8)
    if not spec:
        return m
    for part in spec.split(","):
        band, span = part.split("@")
        y0, y1 = (float(v) for v in band.split("-"))
        t0, t1 = (float(v) for v in span.split("-"))
        if t0 <= t <= t1:
            m[int(y0 * h):int(y1 * h), :] = 0
    return m


def pair_motion(a, b, mask):
    """두 회색 프레임 사이 닮음 변환 → (가운데 점 이동 dx, dy px, 배율, 돎 °, 맞은 수, 특징점 수)."""
    pts = cv2.goodFeaturesToTrack(a, maxCorners=900, qualityLevel=0.005, minDistance=6, mask=mask)
    if pts is None or len(pts) < 12:
        return None
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None, winSize=(21, 21), maxLevel=4)
    back, st2, _ = cv2.calcOpticalFlowPyrLK(b, a, nxt, None, winSize=(21, 21), maxLevel=4)
    fb = np.linalg.norm((pts - back).reshape(-1, 2), axis=1)
    ok = (st.ravel() == 1) & (st2.ravel() == 1) & (fb < 1.0)
    p0, p1 = pts[ok].reshape(-1, 2), nxt[ok].reshape(-1, 2)
    if len(p0) < 10:
        return None
    M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=1.5, maxIters=4000, confidence=0.995)
    if M is None:
        return None
    s = math.hypot(M[0, 0], M[1, 0])
    rot = math.degrees(math.atan2(M[1, 0], M[0, 0]))
    h, w = a.shape
    c = np.array([w / 2, h / 2, 1.0])
    mc = M @ c
    return mc[0] - w / 2, mc[1] - h / 2, s, rot, int(inl.sum()), len(p0)


def sharp_bands(g):
    h = g.shape[0]
    lap = cv2.Laplacian(g, cv2.CV_32F)
    return [float(lap[int(h * k / 3):int(h * (k + 1) / 3)].var()) for k in range(3)]


def read_gray(path, scale=0.5):
    """ffmpeg로 회색 반 해상도 프레임을 읽는다(OpenCV는 한글 경로를 못 연다)."""
    import subprocess
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                         "-of", "csv=p=0", path], capture_output=True, text=True)
    W, H, rate = pr.stdout.strip().split(",")[:3]
    num, den = rate.split("/")
    fps = float(num) / float(den)
    w, h = int(int(W) * scale) // 2 * 2, int(int(H) * scale) // 2 * 2
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    n = len(raw) // (w * h)
    return fps, [np.frombuffer(raw, np.uint8, w * h, i * w * h).reshape(h, w) for i in range(n)]


def measure(path, cuts, mask_spec, scale=0.5):
    fps, frames = read_gray(path, scale)
    h, w = frames[0].shape
    per = []
    for i in range(1, len(frames)):
        t = i / fps
        cut = sum(1 for c in cuts[1:-1] if t >= c - 1e-6)
        prev_cut = sum(1 for c in cuts[1:-1] if (i - 1) / fps >= c - 1e-6)
        if cut != prev_cut:   # 컷 경계는 잇지 않는다
            per.append(dict(f=i, t=round(t, 3), cut=cut, edge=True))
            continue
        r = pair_motion(frames[i - 1], frames[i], masks_for(mask_spec, t, w, h))
        sb = sharp_bands(frames[i])
        if r is None:
            per.append(dict(f=i, t=round(t, 3), cut=cut, fail=True, sharp=sb))
            continue
        dx, dy, s, rot, inl, n = r
        per.append(dict(f=i, t=round(t, 3), cut=cut, dx=dx / w * 100, dy=dy / h * 100, s=s, rot=rot, inl=inl, n=n,
                        sharp=sb, px=(dx, dy)))
    summary = []
    for k in range(len(cuts) - 1):
        rows = [p for p in per if p.get("cut") == k and "dx" in p]
        if not rows:
            summary.append(dict(cut=k, t0=cuts[k], t1=cuts[k + 1], frames=0))
            continue
        dx = np.array([p["dx"] for p in rows])
        dy = np.array([p["dy"] for p in rows])
        sc = np.array([p["s"] for p in rows])
        ro = np.array([p["rot"] for p in rows])
        speed = np.hypot(dx, dy) + np.abs(np.log(sc)) * 100 + np.abs(ro) * 0.5
        moving = speed > 0.08
        tt = np.array([p["t"] for p in rows])
        pxy = np.array([p["px"] for p in rows])
        jit = 0.0
        if len(pxy) >= 7:
            ker = np.ones(5) / 5
            sm = np.stack([np.convolve(pxy[:, j], ker, mode="same") for j in range(2)], axis=1)
            jit = float(np.sqrt(((pxy[2:-2] - sm[2:-2]) ** 2).sum(axis=1).mean()))
        sharp = np.array([p["sharp"] for p in rows])
        best = [int(np.argmax(r)) for r in sharp]
        fails = sum(1 for p in per if p.get("cut") == k and p.get("fail"))
        summary.append(dict(
            cut=k, t0=cuts[k], t1=cuts[k + 1], frames=len(rows), fails=fails,
            dx=round(float(dx.sum()), 2), dy=round(float(dy.sum()), 2), scale=round(float(np.prod(sc)), 4),
            rot=round(float(ro.sum()), 2), move_start=round(float(tt[moving][0]), 2) if moving.any() else None,
            move_end=round(float(tt[moving][-1]), 2) if moving.any() else None,
            peak_speed=round(float(speed.max()), 3), peak_t=round(float(tt[int(np.argmax(speed))]), 2),
            jitter_px=round(jit, 3), inlier_med=int(np.median([p["inl"] for p in rows])),
            sharp_band_first=best[0], sharp_band_last=best[-1],
        ))
    return dict(path=path, fps=fps, size=[w, h], cuts=cuts, per=per, summary=summary)


def plot(res, png):
    """덩이 경계와 함께 가로 · 세로 이동 · 배율 · 돎 · 맞은 수를 한 장에(검수용)."""
    W, H = 1600, 900
    img = np.full((H, W, 3), 22, np.uint8)
    per = [p for p in res["per"] if "dx" in p]
    if not per:
        return
    T = res["per"][-1]["t"]
    rows = [("dx %", [p["dx"] for p in per], 2.0, (90, 200, 255)), ("dy %", [p["dy"] for p in per], 2.0, (120, 255, 140)),
            ("scale-1 %", [(p["s"] - 1) * 100 for p in per], 1.0, (255, 180, 90)), ("rot deg", [p["rot"] for p in per], 1.0, (220, 120, 255))]
    lane = (H - 40) // len(rows)
    for k, (name, vals, lim, col) in enumerate(rows):
        y0 = 20 + k * lane + lane // 2
        cv2.line(img, (60, y0), (W - 20, y0), (60, 60, 60), 1)
        cv2.putText(img, name, (6, y0 - lane // 2 + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 1)
        for p, v in zip(per, vals):
            x = int(60 + (W - 80) * p["t"] / T)
            y = int(y0 - max(-1, min(1, v / lim)) * (lane // 2 - 6))
            cv2.line(img, (x, y0), (x, y), col, 2)
    for c in res["cuts"]:
        x = int(60 + (W - 80) * c / T)
        cv2.line(img, (x, 10), (x, H - 10), (200, 200, 200), 1)
        cv2.putText(img, f"{c:g}", (x + 3, H - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)
    with open(png, "wb") as f:   # cv2.imwrite는 한글 경로에 조용히 실패한다
        f.write(cv2.imencode(".png", img)[1].tobytes())


def main():
    a = sys.argv[1:]
    path = a[0]
    cuts = [float(v) for v in opt(a, "--덩이", "0").split(",")]
    name = opt(a, "--이름", "판")
    out = opt(a, "--밖", os.path.dirname(os.path.abspath(path)))
    res = measure(path, cuts, opt(a, "--가림", ""))
    os.makedirs(out, exist_ok=True)
    js = os.path.join(out, f"카메라재기_{name}.json")
    for p in res["per"]:
        p.pop("px", None)
    with open(js, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    plot(res, os.path.join(out, f"카메라재기_{name}.png"))
    for s in res["summary"]:
        print(json.dumps(s, ensure_ascii=False))
    print("잼", js)


if __name__ == "__main__":
    main()
