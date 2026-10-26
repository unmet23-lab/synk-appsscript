# 9번 원본(피크민 4 「겨울방학 편」) 카메라를 컷마다 프레임 단위로 잰다(2026-10-26).
# 10-26 유호님 「원본이랑 카메라 기법이 너무 다른데? … 원본이랑 카메라 기법도 완전히 똑같게」 — 샷표의 「고정」이 거친 실측이었다.
# 잇단 두 프레임마다 SIFT 특징점을 맞춰 닮음 변환(배율 · 돎 · 옆 · 위아래)을 RANSAC으로 구하고 컷 첫 프레임 기준으로 쌓는다.
# 매끈한 움직임(9프레임 평균)과 남는 떨림(손으로 든 흔들림)을 나누고, 4×4 칸의 선명도로 초점 이동을 본다.
# 우리 판(Veo)도 같은 잣대로 잴 수 있다: --우리 <mp4> <원본 컷 번호>.
#   python -X utf8 원본카메라_실측.py            → 콘티/p9/영상/카메라실측/원본_카메라.json · 원본_카메라.md(git 밖)
#   python -X utf8 원본카메라_실측.py --우리 S11v2_a.mp4 11
import json
import os
import subprocess
import sys

import cv2
import numpy as np

VENDOR = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024")
SRC = os.path.join(VENDOR, "레퍼런스", "p9", "원본영상", "hq_hwipOMtwHoQ", "hq_hwipOMtwHoQ_h264.mp4")
OUT = os.path.join(VENDOR, "콘티", "p9", "영상", "카메라실측")
# 01_샷표_원본 2절 컷 경계(1 · 15 표지와 7 게임 화면은 빼지 않고 함께 잰다)
CUTS = [(1, 0.000, 1.668), (2, 1.668, 6.006), (3, 6.006, 8.342), (4, 8.342, 10.010), (5, 10.010, 11.845),
        (6, 11.845, 13.013), (7, 13.013, 15.349), (8, 15.349, 19.653), (9, 19.653, 21.154), (10, 21.154, 22.823),
        (11, 22.823, 26.159), (12, 26.159, 28.996), (13, 28.996, 31.665), (14, 31.665, 34.468), (15, 34.468, 36.036)]
W, H = 960, 540


def frames(path, t0=None, dur=None):
    args = ["ffmpeg", "-v", "error"]
    if t0 is not None:
        args += ["-ss", f"{t0:.3f}", "-t", f"{dur:.3f}"]
    args += ["-i", path, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W)


def step(a, b, sift, bf):
    ka, da = sift.detectAndCompute(a, None)
    kb, db = sift.detectAndCompute(b, None)
    if da is None or db is None or len(ka) < 12 or len(kb) < 12:
        return None, 0
    good = [m for m, n in bf.knnMatch(da, db, k=2) if m.distance < 0.75 * n.distance]
    if len(good) < 12:
        return None, len(good)
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=2.0, maxIters=4000)
    if M is None:
        return None, len(good)
    return M, int(inl.sum())


def sharp_grid(f):
    g = cv2.Laplacian(f, cv2.CV_32F)
    out = np.zeros((4, 4))
    for i in range(4):
        for j in range(4):
            out[i, j] = g[i * H // 4:(i + 1) * H // 4, j * W // 4:(j + 1) * W // 4].var()
    return out


def measure(fr, fps):
    sift = cv2.SIFT_create(1500)
    bf = cv2.BFMatcher()
    acc = np.eye(3)
    rows = [dict(t=0.0, zoom=0.0, x=0.0, y=0.0, rot=0.0, inl=None)]
    lost = 0
    for k in range(1, len(fr)):
        M, inl = step(fr[k - 1], fr[k], sift, bf)
        if M is None:
            lost += 1
            M = np.float32([[1, 0, 0], [0, 1, 0]])
        acc = np.vstack([M, [0, 0, 1]]) @ acc
        s = float(np.hypot(acc[0, 0], acc[1, 0]))
        rot = float(np.degrees(np.arctan2(acc[1, 0], acc[0, 0])))
        # 가운데 점이 어디로 갔나 → 화면이 흐른 양(폭 · 높이의 %)
        cx, cy = W / 2, H / 2
        nx = acc[0, 0] * cx + acc[0, 1] * cy + acc[0, 2]
        ny = acc[1, 0] * cx + acc[1, 1] * cy + acc[1, 2]
        rows.append(dict(t=round(k / fps, 3), zoom=round((s - 1) * 100, 2), x=round((nx - cx) / W * 100, 2),
                         y=round((ny - cy) / H * 100, 2), rot=round(rot, 2), inl=inl))
    z = np.array([r["zoom"] for r in rows]); x = np.array([r["x"] for r in rows]); y = np.array([r["y"] for r in rows])
    k = 9 if len(rows) >= 15 else 3
    ker = np.ones(k) / k
    sm = lambda a: np.convolve(np.pad(a, k // 2, mode="edge"), ker, mode="valid")
    jit = float(np.sqrt(np.mean((x - sm(x)) ** 2 + (y - sm(y)) ** 2)) * W / 100)   # 떨림(px, 960 폭 기준)
    g0, g1 = sharp_grid(fr[0]), sharp_grid(fr[-1])
    ratio = (g1 + 1) / (g0 + 1)
    focus = {"sharper": [[int(i), int(j)] for i, j in zip(*np.where(ratio > 2.0))],
             "softer": [[int(i), int(j)] for i, j in zip(*np.where(ratio < 0.5))]}
    # 움직임이 있는 구간(매끈한 곡선의 프레임당 변화가 의미 있게 큰 곳)
    vz, vx, vy = np.abs(np.diff(sm(z))), np.abs(np.diff(sm(x))), np.abs(np.diff(sm(y)))
    moving = (vz > 0.08) | (vx > 0.08) | (vy > 0.08)
    spans, on = [], None
    for i, m in enumerate(moving):
        if m and on is None:
            on = i
        if not m and on is not None:
            spans.append([round(on / fps, 2), round(i / fps, 2)]); on = None
    if on is not None:
        spans.append([round(on / fps, 2), round(len(moving) / fps, 2)])
    return dict(n=len(fr), lost=lost, end=rows[-1], max_abs=dict(zoom=float(np.abs(z).max()), x=float(np.abs(x).max()), y=float(np.abs(y).max())),
                jitter_px=round(jit, 2), moving=spans, focus=focus, rows=rows[::3])


def fmt(cid, t0, t1, m):
    e = m["end"]
    mv = ", ".join(f"{a + t0:.2f}–{b + t0:.2f}" for a, b in m["moving"]) or "없음"
    f = m["focus"]
    fo = (f"또렷해진 칸 {f['sharper']} · 흐려진 칸 {f['softer']}" if (f["sharper"] or f["softer"]) else "변화 작음")
    return (f"| {cid} | {t0:.3f}–{t1:.3f} | {e['zoom']:+.1f}% | {e['x']:+.1f}% | {e['y']:+.1f}% | {e['rot']:+.1f}° | "
            f"{m['jitter_px']:.2f}px | {mv} | {fo} | {m['lost']}/{m['n']} |")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    if len(sys.argv) > 1 and sys.argv[1] == "--우리":
        path = sys.argv[2] if os.path.isabs(sys.argv[2]) else os.path.join(VENDOR, "콘티", "p9", "영상", "veo시험", sys.argv[2])
        fr = frames(path)
        m = measure(fr, 24.0)
        print(json.dumps({k: v for k, v in m.items() if k != "rows"}, ensure_ascii=False))
        json.dump(m, open(os.path.join(OUT, "우리_" + os.path.basename(path) + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        sys.exit(0)
    res, lines = {}, []
    for cid, t0, t1 in CUTS:
        fr = frames(SRC, t0 + 0.02, t1 - t0 - 0.04)
        m = measure(fr, 30000 / 1001)
        res[cid] = m
        lines.append(fmt(cid, t0, t1, m))
        print(lines[-1])
    json.dump(res, open(os.path.join(OUT, "원본_카메라.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    head = ("| 컷 | 초 | 배율(끝) | 옆(끝, 폭 %) | 위아래(끝, 높이 %) | 돎(끝) | 떨림 | 움직이는 구간(초) | 초점(4×4 칸 선명도 첫→끝) | 놓친 프레임 |\n"
            "|---|---|---|---|---|---|---|---|---|---|")
    open(os.path.join(OUT, "원본_카메라.md"), "w", encoding="utf-8").write(head + "\n" + "\n".join(lines) + "\n")
