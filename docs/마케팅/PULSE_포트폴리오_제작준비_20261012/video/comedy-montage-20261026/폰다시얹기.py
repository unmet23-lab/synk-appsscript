# 12번 16컷 폰 화면 다시 얹기 · 잔 상표 지우기(2026-11-04) — 앱 화면을 시작 그림에 구워 넣었더니 영상 모델이 글자를 다시 그려 「모두의코스」가 「므두의쿄스」, 19:42가 「TP:42」로 뭉개졌다
# (크몽 세션 Fable 맹검 P1 · 상세 글 「제품 · 로고 · 글자는 AI로 그리지 않고 원본 파일 그대로 얹습니다」와 부딪힘). 잘린 16컷 위에 앱화면.py 그림을 프레임마다 원근대로 다시 얹는다.
#   python -X utf8 폰다시얹기.py  → git 밖 최종/p12/_컷/16_합성.mp4 · 16끝.png(끝 멈춤 그림), 자막시안 remotion/src/p12/폰자리.json(고리가 쓰는 네 꼭짓점)
# 찾는 법: 앱의 민트 판에서 바깥으로 나가 크림이 끝나는 자리를 재고 직선으로 맞춰 꼭짓점을 구한다(둥근 모서리 · 손가락에 안 끌려간다). 그 사람 폰 아래 변은 손에 가려 위 변 + 화면비로, 앞 폰은 아래가 화면 밖이라 위 변 + 양옆 변 방향으로.
# 앞쪽 큰 폰은 휙 돌기 전 7번 프레임까지만 — 8번부터는 번짐이 글자를 가려 판 그대로 둔다.
# 잔 상표는 판이 그린 CASS 비슷한 글자(오른쪽 잔은 「ass」로 읽힘) — 글자 픽셀만 지운다. 넓은 샷(12~43)의 잔은 작고 흐려 안 읽혀 그대로 둔다. 색 · 얼굴 후보정은 없음(결정 10-24).
import json
import os
import subprocess
import sys

import cv2
import numpy as np

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
CUTDIR = os.path.join(ROOT, "최종", "p12", "_컷")
SRC = os.path.join(CUTDIR, "16.mp4")
OUT = os.path.join(CUTDIR, "16_합성.mp4")
HOLD = os.path.join(CUTDIR, "16끝.png")
APP = os.path.join(ROOT, "콘티", "p12", "합성", "앱화면.png")
QUADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103", "remotion", "src", "p12", "폰자리.json")
W, H, FPS = 1080, 1920, 24
ZOOM_AT = 44   # 1.83초 — 폰 디지털 줌으로 그 사람 쪽 판이 시작되는 프레임
BIG_LAST = 7   # 큰 폰을 얹는 마지막 프레임
GAIN = np.float32([0.84, 0.88, 0.925])   # 판의 크림(B201 G215 R230) · 민트(B130 G160 R27)에 맞춘 이득 — 저녁 장면에서 화면만 튀지 않게


# 색 왕복은 zscale로 — 기본 swscale은 YUV → RGB → YUV 한 바퀴에 밝기가 1.5단계 내려가 손대지 않은 자리까지 어두워졌다(평균 차 −1.54 → +0.02, 11-04 실측)
FROM_YUV = "zscale=matrixin=709:rangein=limited:range=full,format=gbrp"
TO_YUV = "zscale=matrix=709:range=limited:rangein=full,format=yuv420p"


def read_all(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", FROM_YUV, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True)
    return list(np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W, 3).copy())


def write_all(frames, path):
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-vf", TO_YUV, "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", path], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.tobytes())
    p.stdin.close()
    if p.wait():
        raise SystemExit("ffmpeg 실패")


def screen_mask(roi, seed, opening=3):
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    m = (((s < 62) & (v > 150)) | ((h >= 62) & (h <= 98) & (s > 70) & (v > 70))).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((opening, opening), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, _, _ = cv2.connectedComponentsWithStats(m, 8)
    k = lab[seed[1], seed[0]]
    out = (lab == k).astype(np.uint8) * 255 if k else m * 0
    cs, _ = cv2.findContours(out, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out[:] = 0
    cv2.drawContours(out, cs, -1, 255, -1)
    return out


def fit(pts):
    return cv2.fitLine(np.float32(pts), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()


def cross(a, b):
    t = np.linalg.solve(np.array([[a[0], -b[0]], [a[1], -b[1]]]), np.array([b[2] - a[2], b[3] - a[3]]))[0]
    return np.float32([a[2] + t * a[0], a[3] + t * a[1]])


def edges(m, cols, rows, bottom=False):
    top = [(c, np.argmax(m[:, c] > 0)) for c in cols if m[:, c].any()]
    left = [(np.argmax(m[r] > 0), r) for r in rows if m[r].any()]
    right = [(m.shape[1] - 1 - np.argmax(m[r, ::-1] > 0), r) for r in rows if m[r].any()]
    e = {"T": fit(top), "L": fit(left), "R": fit(right)}
    if bottom:
        e["B"] = fit([(c, m.shape[0] - 1 - np.argmax(m[::-1, c] > 0)) for c in cols if m[:, c].any()])
    return e


def span(a, b, x, y):
    return np.arange(int(x + a), int(x + b))


def mint_card(roi):
    # 앱의 민트 판(가운데 섬까지 메움) — 시작 자리이자 글자 없는 쪽을 고르는 기준
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mint = ((hsv[..., 0] >= 62) & (hsv[..., 0] <= 98) & (hsv[..., 1] > 100) & (hsv[..., 2] > 90)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(mint, 8)
    k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    m = (lab == k).astype(np.uint8) * 255
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(m, cs, -1, 255, -1)
    return m, hsv[..., 2], st[k, cv2.CC_STAT_LEFT], st[k, cv2.CC_STAT_TOP], st[k, cv2.CC_STAT_WIDTH], st[k, cv2.CC_STAT_HEIGHT]


def steady(pts):
    # 튄 점(글자 · 손가락에 걸린 줄)을 버리고 직선으로 — 점이 수십 개뿐이라 허버만으로는 몇 점에 끌려갔다. 두 점을 뽑아 가장 많은 점이 지나는 직선을 고른다
    a = np.float32(pts)
    rng = np.random.default_rng(16)
    best = None
    for _ in range(200):
        i, j = rng.choice(len(a), 2, replace=False)
        d = a[j] - a[i]
        n = np.linalg.norm(d)
        if n < 8:
            continue
        dist = np.abs((a[:, 0] - a[i, 0]) * d[1] - (a[:, 1] - a[i, 1]) * d[0]) / n
        hit = dist < 1.6
        if best is None or hit.sum() > best.sum():
            best = hit
    return fit(a[best])


def scan_edges(roi, rows):
    # 민트 판에서 바깥으로 나가다 크림이 끝나는(어두워지는) 자리 — 덩어리 윤곽으로 재면 베젤의 밝은 띠 · 뒤 탁자까지 묻어 위 변이 12~19px 높아졌다
    # 민트 경계의 어두운 번짐에 바로 걸리지 않게 판 여백(앱에서 민트 판 폭의 4%)의 반만큼 건너뛰고 잰다. 위 변은 글자 없는 오른쪽 열로만(왼쪽엔 시각 · 앱 이름). rows: 양옆 변을 잴 민트 판 높이 구간(비율)
    m, v, mx, my, mw, mh = mint_card(roi)
    dark, skip = 170, max(1, int(round(mw * 0.02)))
    top = []
    for c in range(int(mx + mw * 0.62), int(mx + mw * 0.95)):
        y = int(np.argmax(m[:, c] > 0)) - max(skip, 3)
        while y > 0 and v[y, c] >= dark:
            y -= 1
        top.append((c, y + 1))
    left, right = [], []
    for r in range(int(my + mh * rows[0]), min(int(my + mh * rows[1]), m.shape[0])):
        if (m[r] > 0).sum() < mw * 0.8:   # 손가락이 민트 판을 가린 줄은 건너뛴다
            continue
        x = int(np.argmax(m[r] > 0)) - skip
        while x > 0 and v[r, x] >= dark:
            x -= 1
        left.append((x + 1, r))
        x = m.shape[1] - 1 - int(np.argmax(m[r, ::-1] > 0)) + skip
        while x < m.shape[1] - 1 and v[r, x] >= dark:
            x += 1
        right.append((x - 1, r))
    return {"T": steady(top), "L": steady(left), "R": steady(right)}, (mx, my, mw, mh)


def big_phone(f):
    # 큰 폰: 네 변이 다 보인다. 아래 변만 크림 덩어리 윤곽으로(민트 판 밑에 글 · 알약이 있어 안에서 못 나간다)
    x0, y0, x1, y1 = 0, 760, 760, 1620
    roi = f[y0:y1, x0:x1]
    e, (mx, my, mw, mh) = scan_edges(roi, (0.1, 0.9))
    m = screen_mask(roi, (mx + mw // 2, my + mh // 2))
    ys, xs = np.nonzero(m)
    bx, bw = xs.min(), xs.max() - xs.min()
    e["B"] = fit([(c, m.shape[0] - 1 - np.argmax(m[::-1, c] > 0)) for c in span(bw * 0.35, bw * 0.65, bx, 0) if m[:, c].any()])
    return np.float32([cross(e["T"], e["L"]), cross(e["T"], e["R"]), cross(e["B"], e["R"]), cross(e["B"], e["L"])]) + [x0, y0]


def man_phone(f):
    # 그 사람 폰: 손이 아래 변을 비스듬히 가려 위 변 · 양옆 변으로 위 두 꼭짓점을 구하고, 아래는 화면비(2340/1080)로 — 판의 검은 알약 자리와 맞췄다
    # 화면이 작아 민트 여백이 3px뿐이라 안에서 나가는 재기는 번짐에 걸린다 — 이 폰만 크림 덩어리 윤곽으로(뒤가 어두운 니트라 묻을 것이 없다)
    x0, y0, x1, y1 = 420, 870, 580, 1120
    m = screen_mask(f[y0:y1, x0:x1], (78, 110))
    ys, xs = np.nonzero(m)
    bx, by, bw, bh = xs.min(), ys.min(), xs.max() - xs.min(), ys.max() - ys.min()
    e = edges(m, span(bw * 0.25, bw * 0.75, bx, by), span(bh * 0.08, bh * 0.45, by, bx))
    tl, tr = cross(e["T"], e["L"]), cross(e["T"], e["R"])
    down = np.float32([-(tr - tl)[1], (tr - tl)[0]]) * 2340 / 1080
    return np.float32([tl, tr, tr + down, tl + down]) + [x0, y0]


def front_phone(f):
    # 앞 폰: 위 변 · 양옆 변만 보인다. 아래 꼭짓점은 화면 밖 — 양옆 변을 따라 화면비만큼 내려간 자리. 민트 판도 잘리므로 양옆 변은 손가락이 닿기 전(위쪽 90px)만
    x0, y0, x1, y1 = 290, 1645, 620, 1920
    roi = f[y0:y1, x0:x1]
    _, _, _, _, _, mh = mint_card(roi)
    e, _ = scan_edges(roi, (6 / mh, 90 / mh))
    tl, tr = cross(e["T"], e["L"]), cross(e["T"], e["R"])
    w = np.linalg.norm(tr - tl)
    def along(line, frm):
        d = np.float32(line[:2])
        d = d if d[1] > 0 else -d
        return frm + d / d[1] * (w * 2340 / 1080)
    return np.float32([tl, tr, along(e["R"], tr), along(e["L"], tl)]) + [x0, y0]


def smooth(qs, sigma=2.0):
    # 꼭짓점 흔들림을 시간으로 고른다(판은 카메라가 천천히 흐를 뿐이다)
    a = np.stack(qs)
    r = int(sigma * 3)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = np.zeros_like(a)
    for i in range(a.shape[1]):
        for j in range(2):
            out[:, i, j] = np.convolve(np.pad(a[:, i, j], r, mode="edge"), k, mode="valid")
    return list(out)


def app_layer(app):
    # 둥근 모서리 판(앱 좌표) — 판의 화면 모서리와 맞춘 반지름
    h, w = app.shape[:2]
    a = np.zeros((h, w), np.uint8)
    r = 64
    cv2.rectangle(a, (r, 0), (w - r, h), 255, -1)
    cv2.rectangle(a, (0, r), (w, h - r), 255, -1)
    for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)):
        cv2.circle(a, (cx, cy), r, 255, -1)
    return a


def skin(roi):
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    m = (((h <= 22) | (h >= 170)) & (s >= 52) & (v > 90)).astype(np.uint8) * 255
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))


def paste(f, quad, app, alpha, sigma, motion=None, keep_skin=False):
    h, w = app.shape[:2]
    c = quad[:2].mean(0) * 0.5 + quad[2:].mean(0) * 0.5
    q = np.float32(c + (quad - c) * 1.004)   # 판의 옛 화면 가장자리가 비치지 않게 아주 조금 넓힌다
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), q)
    # 작게 줄일 때 글자가 앨리어싱되지 않게 먼저 알맞게 줄인 그림에서 원근을 건다
    k = max(np.linalg.norm(q[1] - q[0]) / w, 1e-3)
    if k < 0.5:
        s = max(k * 2, 0.1)
        small = cv2.resize(app, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        sa = cv2.resize(alpha, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        M = cv2.getPerspectiveTransform(np.float32([[0, 0], [small.shape[1], 0], [small.shape[1], small.shape[0]], [0, small.shape[0]]]), q)
    else:
        small, sa = app, alpha
    lay = cv2.warpPerspective(small, M, (W, H), flags=cv2.INTER_LINEAR)
    mat = cv2.warpPerspective(sa, M, (W, H), flags=cv2.INTER_LINEAR)
    lay = np.clip(lay.astype(np.float32) * GAIN, 0, 255)
    if sigma:
        lay = cv2.GaussianBlur(lay, (0, 0), sigma)
    mat = cv2.GaussianBlur(mat, (0, 0), 0.8).astype(np.float32) / 255
    if motion is not None and np.linalg.norm(motion) > 3:
        # 판처럼 움직이는 방향으로 번지게 — 셔터 반 바퀴만큼
        L = int(round(np.linalg.norm(motion) * 0.5)) | 1
        ker = np.zeros((L, L), np.float32)
        d = motion / np.linalg.norm(motion)
        cv2.line(ker, (int(L / 2 - d[0] * L / 2), int(L / 2 - d[1] * L / 2)), (int(L / 2 + d[0] * L / 2), int(L / 2 + d[1] * L / 2)), 1.0, 1)
        ker /= ker.sum()
        lay = cv2.filter2D(lay, -1, ker)
        mat = cv2.filter2D(mat, -1, ker)
    if keep_skin:
        # 손가락만 앞에 남긴다 — 화면 바깥에서 이어 들어온 큰 살갗 덩어리만. 판의 옛 글자(갈색 기운)까지 잡으면 얹은 화면에 구멍이 났다
        ys, xs = np.nonzero(mat > 0)
        y0, y1, x0, x1 = max(ys.min() - 8, 0), min(ys.max() + 9, H), max(xs.min() - 8, 0), min(xs.max() + 9, W)
        sm = skin(f[y0:y1, x0:x1])
        inside = cv2.erode((mat[y0:y1, x0:x1] > 0.99).astype(np.uint8), np.ones((5, 5), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(sm, 8)
        keep = np.zeros_like(sm)
        for k in range(1, n):
            if st[k, cv2.CC_STAT_AREA] >= 40 and ((lab == k) & (inside == 0)).any():
                keep[lab == k] = 255
        sk = np.zeros((H, W), np.float32)
        sk[y0:y1, x0:x1] = cv2.GaussianBlur(cv2.dilate(keep, np.ones((3, 3), np.uint8)), (0, 0), 0.9).astype(np.float32) / 255
        mat = mat * (1 - sk)
    mat = mat[..., None]
    return (f.astype(np.float32) * (1 - mat) + lay * mat).astype(np.uint8)


# ── 잔 상표 — 80번 프레임 기준 글자 상자(x0, y0, x1, y1)와 글자 찾는 쪽
LABELS = {
    "왼쪽 잔": ((163, 1232, 212, 1270), "blue"),
    "오른쪽 잔": ((914, 1346, 958, 1382), "dark"),
    "소주잔": ((506, 1554, 546, 1602), "green"),
}
REF = 80


def track_labels(frames):
    # 80번 프레임의 잔 둘레를 양쪽으로 따라간다 — 판이 천천히 흐르므로 앞 프레임 자리 둘레에서만 찾는다
    tracks = {}
    for name, (box, _) in LABELS.items():
        x0, y0, x1, y1 = box
        m = 26
        ref = cv2.cvtColor(frames[REF][y0 - m:y1 + m, x0 - m:x1 + m], cv2.COLOR_BGR2GRAY)
        off = {REF: np.float32([0, 0])}
        for order in (range(REF + 1, len(frames)), range(REF - 1, ZOOM_AT - 1, -1)):
            prev = np.float32([0, 0])
            for i in order:
                g = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
                r = 14
                ax, ay = int(x0 - m + prev[0]) - r, int(y0 - m + prev[1]) - r
                win = g[ay:ay + ref.shape[0] + 2 * r, ax:ax + ref.shape[1] + 2 * r]
                res = cv2.matchTemplate(win, ref, cv2.TM_CCOEFF_NORMED)
                _, _, _, loc = cv2.minMaxLoc(res)
                prev = np.float32([ax + loc[0] - (x0 - m), ay + loc[1] - (y0 - m)])
                off[i] = prev
        tracks[name] = [o[0] for o in smooth([off[i][None] for i in range(ZOOM_AT, len(frames))], sigma=2.5)]
    return tracks


def wipe_label(f, box, kind, off):
    x0, y0, x1, y1 = [int(round(v)) for v in (box[0] + off[0], box[1] + off[1], box[2] + off[0], box[3] + off[1])]
    pad = 18
    roi = f[y0 - pad:y1 + pad, x0 - pad:x1 + pad].copy()
    bg = cv2.medianBlur(roi, 21)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    d = bg.astype(np.int16) - roi.astype(np.int16)   # 바탕보다 어두운 쪽
    if kind == "blue":
        t = (d.max(2) > 16) | ((hsv[..., 0] > 95) & (hsv[..., 0] < 135) & (hsv[..., 1] > 42))
    elif kind == "green":
        t = (d.max(2) > 14) | ((hsv[..., 0] > 30) & (hsv[..., 0] < 90) & (hsv[..., 1] > 36))
    else:
        t = d.max(2) > 24
    box_m = np.zeros(roi.shape[:2], np.uint8)
    box_m[pad:-pad, pad:-pad] = 255
    t = (t.astype(np.uint8) * 255) & box_m
    t = cv2.dilate(t, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    fixed = cv2.inpaint(roi, t, 5, cv2.INPAINT_TELEA)
    # 지운 자국이 도드라지지 않게 그 자리만 살짝 뭉갠다
    soft = cv2.GaussianBlur(fixed, (0, 0), 1.6)
    a = cv2.GaussianBlur(t, (0, 0), 2.0).astype(np.float32)[..., None] / 255
    out = roi.astype(np.float32) * 0 + (fixed.astype(np.float32) * (1 - a) + soft.astype(np.float32) * a)
    f = f.copy()
    f[y0 - pad:y1 + pad, x0 - pad:x1 + pad] = np.clip(out, 0, 255).astype(np.uint8)
    return f


def main():
    frames = read_all(SRC)
    print("프레임", len(frames))
    app = cv2.imdecode(np.fromfile(APP, np.uint8), cv2.IMREAD_COLOR)
    alpha = app_layer(app)
    big = smooth([big_phone(frames[i]) for i in range(BIG_LAST + 1)], sigma=0.6)
    man = smooth([man_phone(frames[i]) for i in range(ZOOM_AT, len(frames))])
    front = [front_phone(frames[i]) for i in range(ZOOM_AT, len(frames))]
    # 아래 꼭짓점은 보이는 90줄에서 늘인 값이라 프레임마다 흔들린다 — 위 꼭짓점에서 내려가는 길이를 한 값으로 고정
    down = np.median([q[[2, 3]] - q[[1, 0]] for q in front], axis=0)
    front = smooth([np.float32([q[0], q[1], q[1] + down[0], q[0] + down[1]]) for q in front])
    tracks = track_labels(frames)
    out = []
    for i, f in enumerate(frames):
        if i <= BIG_LAST:
            mv = big[i].mean(0) - big[i - 1].mean(0) if i >= 1 else None
            f = paste(f, big[i], app, alpha, 0.55, motion=mv)
        elif i >= ZOOM_AT:
            j = i - ZOOM_AT
            for name, (box, kind) in LABELS.items():
                f = wipe_label(f, box, kind, tracks[name][j])
            f = paste(f, front[j], app, alpha, 0.7, keep_skin=True)
            f = paste(f, man[j], app, alpha, 0.85, keep_skin=True)
        out.append(f)
    write_all(out, OUT)
    cv2.imencode(".png", out[-1])[1].tofile(HOLD)
    with open(QUADS, "w", encoding="utf-8") as fp:
        json.dump({"from": ZOOM_AT, "man": [np.round(q, 1).tolist() for q in man], "front": [np.round(q, 1).tolist() for q in front]}, fp, ensure_ascii=False)
        fp.write("\n")
    print("->", OUT, HOLD, QUADS)
    return out


if __name__ == "__main__":
    res = main()
    if len(sys.argv) > 1:   # 살펴볼 프레임을 그림으로: 폰다시얹기.py <폴더>
        d = sys.argv[1]
        for i in (0, 2, 5, 7, 8, 44, 60, 70, 92):
            cv2.imencode(".png", res[i])[1].tofile(os.path.join(d, f"out{i:03d}.png"))
