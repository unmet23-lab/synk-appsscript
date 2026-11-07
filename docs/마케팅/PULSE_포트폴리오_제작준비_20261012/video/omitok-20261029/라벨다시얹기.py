# 오미톡 15초 캔 라벨 다시 얹기(2026-11-07, Claude) — 라벨이 보이는 두 컷(3 · 7)에서 영상 모델이 다시 그린 작은 글자(355ml → 「353ml」, 오미톡 → 「오미특」)를
# 시작 그림의 라벨 화소(리허설 블렌더 캔 렌더를 시안_합성.py로 얹은 것 — AI가 그리지 않은 원본)로 프레임마다 덮는다. 12번 폰다시얹기.py와 같은 길.
#   최종편집.py가 부른다: overlay(판 mp4, 시작 그림 png, 캔 찾을 칸, 처음 장, 장수, 나갈 mp4)
# 찾는 법: 시작 그림의 캔 몸통(남색 · 빨강 칸의 볼록 껍질 — 뚜껑은 판 그대로)을 마스크로 삼고, 장마다 몸통 둘레의 SIFT 특징점을 시작 그림과 맞춰
#   닮음 변환(배율 · 이동 · 회전, RANSAC 2px)을 구한 뒤 시간축으로 고르게 펴서(한 장씩 튀지 않게) 시작 그림 몸통을 그 자리로 옮겨 얹는다.
#   얹는 화소는 판과 같은 720 크기로 줄여 같은 결(흐림)로 맞추고, 밝기는 판의 캔 몸통 평균에 장마다 맞춘다(±8% 안 — 판의 빛을 바꾸지 않고 얹은 조각만 맞춤).
# 색 왕복은 zscale(12번 폰다시얹기.py — 기본 swscale은 한 바퀴에 밝기가 1.5단계 내려간다).
import subprocess

import cv2
import numpy as np

FROM_YUV = "zscale=matrixin=709:rangein=limited:range=full,format=gbrp"
TO_YUV = "zscale=matrix=709:range=limited:rangein=full,format=yuv420p"
SIFT = cv2.SIFT_create(4000)
BF = cv2.BFMatcher()


def imread(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def read_frames(path, w, h):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-fps_mode", "passthrough", "-vf", f"scale={w}:{h}:flags=lanczos,{FROM_YUV}",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, h, w, 3).copy()


def write_frames(frames, path, fps=24):
    h, w = frames[0].shape[:2]
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                          "-vf", TO_YUV, "-c:v", "libx264", "-crf", "8", "-preset", "medium", "-r", str(fps),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", path], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(np.ascontiguousarray(f).tobytes())
    p.stdin.close()
    if p.wait():
        raise SystemExit("ffmpeg 실패")


def body_mask(im, box):
    """캔 몸통 — 남색 · 빨강 칸의 가장 큰 덩어리를 볼록 껍질로 채운다(뚜껑 · 바닥 둘레는 뺌)."""
    x0, y0, x1, y1 = box
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    navy = (h >= 100) & (h <= 135) & (s >= 70) & (v >= 20) & (v <= 200)
    red = ((h <= 8) | (h >= 168)) & (s >= 110) & (v >= 60)
    sub = (navy | red)[y0:y1, x0:x1].astype(np.uint8) * 255
    sub = cv2.morphologyEx(sub, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(sub, 8)
    if n < 2:
        raise SystemExit("캔 몸통을 못 찾음")
    k = 1 + int(np.argmax(st[1:, 4]))
    pts = cv2.findNonZero((lab == k).astype(np.uint8))
    m = np.zeros(h.shape, np.uint8)
    hull = cv2.convexHull(pts) + np.array([[x0, y0]])
    cv2.fillConvexPoly(m, hull.astype(np.int32), 255)
    return m


def transforms(frames, ref, mask, fixed=False, track=False):
    """장마다 시작 그림 → 장의 닮음 변환(2×3). 몸통 둘레(넓힌 마스크)의 특징점으로 맞추고 시간축으로 고르게 편다.
    fixed: 캔이 멈춘 컷 — 장마다 잰 값의 중앙값 한 자리로 고정한다(영상 모델이 라벨을 다시 그린 탓에 특징점이 ±4px 흔들려, 펴도 라벨이 떤다).
    track: 캔이 오가는 컷(손에 든 캔이 물러났다 돌아옴 · 볼에 닿음) — 이차식이 움직임을 못 따라가(11-07 사람판 건배 캔 83px) 장마다 잰 값을
    5장 중앙값 → 5장 평균으로만 편다."""
    grow = cv2.dilate(mask, np.ones((25, 25), np.uint8))
    k0, d0 = SIFT.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), grow)
    raw = []
    ys, xs = np.nonzero(mask)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
    for f in frames:
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        mm = np.zeros(g.shape, np.uint8)
        pad = 80
        mm[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad] = 255
        k1, d1 = SIFT.detectAndCompute(g, mm)
        ms = [a for a, b in BF.knnMatch(d0, d1, k=2) if a.distance < 0.75 * b.distance]
        if len(ms) < 12:
            raise SystemExit(f"맞춤이 {len(ms)}개뿐 — 라벨을 못 따라간다")
        p0 = np.float32([k0[a.queryIdx].pt for a in ms])
        p1 = np.float32([k1[a.trainIdx].pt for a in ms])
        M, inl = cv2.estimateAffinePartial2D(p0, p1, ransacReprojThreshold=2.0)
        s = float(np.hypot(M[0, 0], M[1, 0]))
        r = float(np.arctan2(M[1, 0], M[0, 0]))
        raw.append((s, r, float(M[0, 2]), float(M[1, 2]), int(inl.sum())))
    a = np.array(raw, np.float64)
    # 카메라는 고르게 다가가거나 멈춰 있다 — 장마다의 흔들림(±0.5px)을 이차식으로 펴서 얹은 라벨이 떨지 않게 한다
    t = np.arange(len(a))
    if fixed:
        sm = np.repeat(np.median(a[:, :4], axis=0)[None], len(a), 0)
    elif track:
        from scipy.ndimage import median_filter, uniform_filter1d
        sm = np.stack([uniform_filter1d(median_filter(a[:, j], size=5, mode="nearest"), size=5, mode="nearest") for j in range(4)], 1)
        # 볼에 닿거나 캔끼리 부딪는 장은 한 장에 19px까지 튀어 고른 값이 12px 늦는다 — 2.5px 넘게 벌어진 장은 잰 값 그대로
        jump = np.hypot(a[:, 2] - sm[:, 2], a[:, 3] - sm[:, 3]) > 2.5
        sm[jump] = a[jump, :4]
    else:
        sm = np.stack([np.polyval(np.polyfit(t, a[:, j], 2), t) if len(a) > 3 else a[:, j] for j in range(4)], 1)
    out = []
    for s, r, tx, ty in sm:
        out.append(np.float32([[s * np.cos(r), -s * np.sin(r), tx], [s * np.sin(r), s * np.cos(r), ty]]))
    err = float(np.max(np.abs(a[:, 2:4] - sm[:, 2:4])))
    return out, a, err


def overlay(src_mp4, ref_png, box, a, k, out_mp4, w=720, h=1280, erode=2, feather=1.6, fixed=False, log=print, track=False):
    frames = read_frames(src_mp4, w, h)[a:a + k]
    if len(frames) != k:
        raise SystemExit(f"{src_mp4}: {a}장부터 {k}장이 필요한데 {len(frames)}장")
    big = imread(ref_png)
    ref = cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA)   # 판과 같은 크기 · 같은 결
    bx = tuple(int(round(v * w / big.shape[1])) for v in box)
    mask = body_mask(ref, bx)
    if erode:
        mask = cv2.erode(mask, np.ones((2 * erode + 1, 2 * erode + 1), np.uint8))
    soft = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), feather)
    Ms, raw, err = transforms(frames, ref, mask, fixed=fixed, track=track)
    pieces, gains = [], []
    for f, M in zip(frames, Ms):
        warped = cv2.warpAffine(ref, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        alpha = cv2.warpAffine(soft, M, (w, h), flags=cv2.INTER_LINEAR)[..., None]
        sel = (alpha[..., 0] > 0.95) & (warped.max(axis=2) < 235)   # 빛 반사(하이라이트)는 빼고 잰다
        gains.append(f[sel].astype(np.float32).mean(0) / (warped[sel].astype(np.float32).mean(0) + 1e-3))
        pieces.append((warped, alpha))
    # 밝기 맞춤도 장마다 튀지 않게 9장 이동 평균 — 판 전체 빛이 변하지 않는 컷이라 거의 한 값이다
    gains = np.clip(np.array(gains), 0.92, 1.08)
    ker = np.ones(9) / 9
    gains = np.stack([np.convolve(np.pad(gains[:, c], 4, mode="edge"), ker, mode="valid") for c in range(3)], 1)
    out = []
    for f, (warped, alpha), g in zip(frames, pieces, gains):
        piece = np.clip(warped.astype(np.float32) * g.astype(np.float32), 0, 255)
        out.append((f.astype(np.float32) * (1 - alpha) + piece * alpha).astype(np.uint8))
    write_frames(out, out_mp4)
    log(f"  라벨 다시 얹음 {k}장 · 배율 {raw[0, 0]:.3f} → {raw[-1, 0]:.3f} · 맞춤 점 최소 {int(raw[:, 4].min())} · 편 곡선과 잰 값 차이 최대 {err:.2f}px · 밝기 맞춤 {gains.min():.3f}~{gains.max():.3f}")
    return out_mp4
