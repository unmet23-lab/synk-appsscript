# 옆집의 크리스마스 후반 글자(2026-11-07, Claude) — 그림에 그리지 않은 글자를 장면에 붙인다(02_콘티 5절 글자 정책 · 11-3, 결정 10-29).
#   간판 「늘켬」: 고정 와이드 1 · 12 · 20 · 26 · 35(멀고 작은 간판) · 14(창 너머 흐린 간판, 카메라가 옆으로 감) · 36(끝 거리의 비스듬한 상자 간판, 물러남)
#   1+1: 33 상자 스티커(15는 스티커가 지름 15px라 글자가 안 읽혀 넣지 않는다), 17 폰 화면의 빨간 배터리, 33 봉투 동그라미의 워드마크(제품 자리)
# 글자는 라벨/늘켬_워드마크.py가 도형으로 그린다(글꼴로 치지 않음). 장면 화질에 맞춰 흐리게 · 빛 번짐을 주고, 간판은 그 자리의 호박빛만 남긴
# 가림판으로 곱해 난간 · 비 · 눈 · 기둥이 글자 앞을 지나가게 한다. 움직이는 컷은 그 자리의 특징점을 광학 흐름으로 따라간다(색 · 밝기는 손대지 않음).
import importlib.util
import os

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("wm", os.path.join(HERE, "라벨", "늘켬_워드마크.py"))
WM = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(WM)
LIT = (255, 247, 230)    # 불 켜진 흰 아크릴 글자(RGB)


def rgba(img):
    a = np.asarray(img).astype(np.float32) / 255.0   # PIL RGBA → float (RGB, A)
    return a[..., :3][..., ::-1].copy(), a[..., 3].copy()   # BGR, alpha


def graphic(kind, height):
    if kind == "늘켬":
        return rgba(WM.raster(WM.wordmark(), height, pad=0.0, color=LIT))
    if kind == "1+1":
        return rgba(WM.raster(WM.one_plus_one(), height, pad=0.0, color=(255, 250, 244)))
    if kind == "배터리":
        bat, fill = WM.battery()
        return rgba(WM.raster(bat, height, pad=0.0, color=(244, 244, 244), extra=[(fill, (238, 52, 46))]))
    raise ValueError(kind)


def place(col, alpha, size, M):
    """그림(col, alpha)을 2×3 아핀 M으로 화면(size=(w,h))에 옮긴다."""
    w, h = size
    c = cv2.warpAffine(col, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
    a = cv2.warpAffine(alpha, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)
    return c, a


def affine_for(gw, gh, cx, cy, height, angle_deg=0.0, shear=0.0, squeeze=1.0):
    """그림 가운데를 (cx, cy)에, 높이를 height로 — 돎(도, 시계 +) · y 기울임(shear: x 1px마다 y) · 가로 줄임(squeeze)."""
    s = height / gh
    T0 = np.array([[1, 0, -gw / 2], [0, 1, -gh / 2], [0, 0, 1]], np.float64)
    S = np.array([[s * squeeze, 0, 0], [0, s, 0], [0, 0, 1]], np.float64)
    Sh = np.array([[1, 0, 0], [shear, 1, 0], [0, 0, 1]], np.float64)
    r = np.radians(angle_deg)
    R = np.array([[np.cos(r), -np.sin(r), 0], [np.sin(r), np.cos(r), 0], [0, 0, 1]], np.float64)
    T1 = np.array([[1, 0, cx], [0, 1, cy], [0, 0, 1]], np.float64)
    return (T1 @ R @ Sh @ S @ T0)[:2]


def amber_matte(frame, box, soft=1.2):
    """간판의 호박빛만 1 — 난간 · 비 · 눈 · 기둥은 0(글자를 그 뒤로)."""
    x0, y0, x1, y1 = box
    hsv = cv2.cvtColor(frame[y0:y1, x0:x1], cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    hue = np.clip(1 - np.maximum(0, np.abs(h - 17) - 9) / 5, 0, 1)
    m = hue * np.clip((s - 70) / 40, 0, 1) * np.clip((v - 120) / 40, 0, 1)
    m = cv2.GaussianBlur(m, (0, 0), soft)
    out = np.zeros(frame.shape[:2], np.float32)
    out[y0:y1, x0:x1] = m
    return out


def lit(frame, col, a, blur, glow=0.35, glow_sigma=5.0, mod=None):
    """빛나는 글자를 얹는다 — 장면만큼 흐리게, 둘레에 빛 번짐, mod(그 자리 밝기 비)로 간판의 밝기 결을 따라간다."""
    pre = col * a[..., None]   # 미리 곱한 색 — 색과 알파를 따로 흐리면 가장자리에 검은 테가 생긴다
    if blur > 0:
        pre = cv2.GaussianBlur(pre, (0, 0), blur)
        a = cv2.GaussianBlur(a, (0, 0), blur)
    if mod is not None:
        pre = pre * mod[..., None]
    f = frame.astype(np.float32) / 255.0
    out = f * (1 - a[..., None]) + pre
    if glow > 0:
        g = cv2.GaussianBlur(pre, (0, 0), glow_sigma)
        out = 1 - (1 - out) * (1 - glow * g)   # 화면(screen) 더하기 — 빛은 어둡게 만들지 않는다
    return np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)


def band_box(frame, near=None, min_area=1500):
    """가장 큰 호박빛 덩어리(간판 면)의 상자 — near=(x0,y0,x1,y1)이면 그 안에서만."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 0] >= 8) & (hsv[..., 0] <= 28) & (hsv[..., 1] >= 90) & (hsv[..., 2] >= 160)).astype(np.uint8)
    if near is not None:
        x0, y0, x1, y1 = near
        keep = np.zeros_like(m)
        keep[y0:y1, x0:x1] = 1
        m = m * keep
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return None
    k = 1 + int(np.argmax(st[1:, 4]))
    if st[k, 4] < min_area:
        return None
    x, y, w, h, _ = st[k]
    return int(x), int(y), int(x + w), int(y + h)


def track(frames, box, mode="shift"):
    """frames[0]의 box 안 특징점을 장마다 따라가 장마다 2×3 변환(첫 장 → 그 장)을 돌려준다. mode: shift(이동) · sim(이동 + 배율 + 돎)."""
    g0 = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
    x0, y0, x1, y1 = box
    mask = np.zeros_like(g0)
    mask[y0:y1, x0:x1] = 255
    pts = cv2.goodFeaturesToTrack(g0, 400, 0.01, 6, mask=mask)
    Ms = [np.array([[1, 0, 0], [0, 1, 0]], np.float64)]
    if pts is None or len(pts) < 6:
        return Ms * len(frames)
    prev, p0, acc = g0, pts, np.eye(3)
    for f in frames[1:]:
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, p0, None, winSize=(21, 21), maxLevel=3)
        ok = st.reshape(-1) == 1
        a, b = p0[ok].reshape(-1, 2), p1[ok].reshape(-1, 2)
        if len(a) >= 6:
            if mode == "sim":
                M, _ = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=1.5)
                M = M if M is not None else np.array([[1, 0, 0], [0, 1, 0]], np.float64)
            else:
                d = np.median(b - a, axis=0)
                M = np.array([[1, 0, d[0]], [0, 1, d[1]]], np.float64)
            acc = np.vstack([M, [0, 0, 1]]) @ acc
        Ms.append(acc[:2].copy())
        prev, p0 = g, (b.reshape(-1, 1, 2) if len(b) >= 6 else p0)
        if len(p0) < 40:   # 점이 줄면 그 장에서 다시 뽑는다(같은 상자를 지금 변환으로 옮겨서)
            q = cv2.transform(np.array([[[x0, y0]], [[x1, y1]]], np.float32), acc[:2]).reshape(-1, 2)
            mk = np.zeros_like(g)
            mk[int(max(0, q[0, 1])):int(q[1, 1]), int(max(0, q[0, 0])):int(q[1, 0])] = 255
            more = cv2.goodFeaturesToTrack(g, 400, 0.01, 6, mask=mk)
            if more is not None:
                p0 = more
    return Ms


def compose(M_track, M_place):
    """장면 따라가기(첫 장 → 이 장) 뒤에 첫 장 자리 놓기."""
    A = np.vstack([M_track, [0, 0, 1]])
    B = np.vstack([M_place, [0, 0, 1]])
    return (A @ B)[:2]


# ---------- 컷마다 ----------

def sign_fixed(frames, height_frac=0.66):
    """고정 와이드 — 간판 면은 판마다 같은 자리(삼각대). 첫 장에서 재고 모든 장에 같은 자리로, 가림판은 장마다."""
    box = None
    for f in frames[:6]:
        box = band_box(f, near=(1100, 470, 1700, 680))
        if box:
            break
    if box is None:
        raise SystemExit("고정 와이드 간판을 못 찾음")
    x0, y0, x1, y1 = box
    bh = y1 - y0
    col, a = graphic("늘켬", 200)
    gh, gw = a.shape
    M = affine_for(gw, gh, (x0 + x1) / 2, (y0 + y1) / 2 + 0.5, bh * height_frac)
    out = []
    for f in frames:
        c, al = place(col, a, (f.shape[1], f.shape[0]), M)
        mt = amber_matte(f, (x0 - 4, y0 - 4, x1 + 4, y1 + 4))
        mod = np.clip(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) / max(1.0, float(np.percentile(cv2.cvtColor(f[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY), 70))), 0.6, 1.1)
        out.append(lit(f, c, al * mt, blur=0.9, glow=0.30, glow_sigma=3.0, mod=mod))
    return out, {"간판": box}


def sign_moving(frames, near, height_frac=0.55, blur=3.2, glow_sigma=8.0, mode="shift", shear=0.0, center=None, height=None, glow=0.32):
    """움직이는 컷의 간판 — 첫 장에서 간판 면을 재고(또는 center · height를 받아) 특징점으로 따라간다."""
    box = band_box(frames[0], near=near)
    if box is None:
        raise SystemExit("간판을 못 찾음")
    x0, y0, x1, y1 = box
    cx, cy = center if center else ((x0 + x1) / 2, (y0 + y1) / 2)
    hh = height if height else (y1 - y0) * height_frac
    col, a = graphic("늘켬", 260)
    gh, gw = a.shape
    M0 = affine_for(gw, gh, cx, cy, hh, shear=shear)
    pad = 60
    Ms = track(frames, (max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad), mode=mode)
    out, placed = [], []
    for f, Mt in zip(frames, Ms):
        M = compose(Mt, M0)
        placed.append(M)
        c, al = place(col, a, (f.shape[1], f.shape[0]), M)
        q = cv2.transform(np.array([[[x0, y0]], [[x1, y1]]], np.float32), Mt).reshape(-1, 2)
        bx = (int(max(0, q[0, 0] - 8)), int(max(0, q[0, 1] - 8)), int(min(f.shape[1], q[1, 0] + 8)), int(min(f.shape[0], q[1, 1] + 8)))
        mt = amber_matte(f, bx, soft=1.5)
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
        ref = max(1.0, float(np.percentile(g[bx[1]:bx[3], bx[0]:bx[2]], 70)))
        out.append(lit(f, c, al * mt, blur=blur, glow=glow, glow_sigma=glow_sigma, mod=np.clip(g / ref, 0.6, 1.1)))
    return out, {"간판": box, "M": placed, "g": (gw, gh)}


def red_blob(frame, cx, cy, r):
    x0, y0 = int(max(0, cx - r)), int(max(0, cy - r))
    sub = frame[y0:int(cy + r), x0:int(cx + r)]
    hsv = cv2.cvtColor(sub, cv2.COLOR_BGR2HSV)
    m = (((hsv[..., 0] <= 9) | (hsv[..., 0] >= 168)) & (hsv[..., 1] >= 110) & (hsv[..., 2] >= 70)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        return None
    k = 1 + int(np.argmax(st[1:, 4]))
    x, y, w, h, area = st[k]
    mask = np.zeros(frame.shape[:2], np.float32)
    mask[y0:y0 + sub.shape[0], x0:x0 + sub.shape[1]] = (lab == k).astype(np.float32)
    return x0 + cen[k][0], y0 + cen[k][1], int(w), int(h), mask


def sticker(frames, guess, r=60, fill=0.62):
    """빨간 동그라미 스티커에 「1+1」 — 장마다 동그라미를 둘레에서 다시 찾아(움직임 · 손 가림을 따라) 그 안에만 얹는다."""
    col, a = graphic("1+1", 200)
    gh, gw = a.shape
    out, cx, cy = [], guess[0], guess[1]
    for f in frames:
        b = red_blob(f, cx, cy, r)
        if b is None:
            out.append(f)
            continue
        cx, cy, w, h, mask = b
        hh = h * 0.40
        sq = min(1.0, (w * fill) / (gw * hh / gh))
        M = affine_for(gw, gh, cx, cy, hh, squeeze=sq)
        c, al = place(col, a, (f.shape[1], f.shape[0]), M)
        mt = cv2.GaussianBlur(cv2.erode(mask, np.ones((3, 3), np.uint8)), (0, 0), 1.0)
        out.append(lit(f, c, al * mt, blur=0.8, glow=0.0))
    return out


def battery(frames, center, angle, width):
    """17 폰 화면 가운데 빨간 배터리 — 폰의 특징점을 따라 옮긴다(흐린 화면빛 없이 아이콘만)."""
    col, a = graphic("배터리", 160)
    gh, gw = a.shape
    M0 = affine_for(gw, gh, center[0], center[1], width * gh / gw, angle_deg=angle)
    x, y = center
    Ms = track(frames, (int(x - width * 1.4), int(y - width * 2.0), int(x + width * 1.4), int(y + width * 2.0)))
    out = []
    for f, Mt in zip(frames, Ms):
        c, al = place(col, a, (f.shape[1], f.shape[0]), compose(Mt, M0))
        out.append(lit(f, c, al * 0.92, blur=1.1, glow=0.18, glow_sigma=6.0))
    return out


def orange_disc(frame, box, s_min=150, v_min=55, min_area=300):
    """봉투에 찍힌 호박빛 동그라미 후보들 — 벽의 따뜻한 빛(채도 130 안팎)과 갈리게 채도 150 위만. 화면 가장자리에 걸린 점은 빼고 타원을 맞춘다."""
    x0, y0, x1, y1 = [int(v) for v in box]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(frame.shape[1], x1), min(frame.shape[0], y1)
    if x1 - x0 < 8 or y1 - y0 < 8:
        return []
    hsv = cv2.cvtColor(frame[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 0] >= 6) & (hsv[..., 0] <= 24) & (hsv[..., 1] >= s_min) & (hsv[..., 2] >= v_min)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = []
    H, W = frame.shape[:2]
    for c in cs:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        p = c.reshape(-1, 2) + [x0, y0]
        inner = p[(p[:, 0] > 2) & (p[:, 0] < W - 3) & (p[:, 1] > 2) & (p[:, 1] < H - 3)]   # 화면 밖으로 잘린 변은 타원 맞춤에서 뺀다
        if len(inner) < 12:
            continue
        (ex, ey), (ew, eh), ang = cv2.fitEllipse(inner.astype(np.float32))
        _, _, bw, bh = cv2.boundingRect(c)
        if min(ew, eh) / max(1.0, max(ew, eh)) < 0.35 or max(ew, eh) > 2.5 * max(bw, bh):   # 잘린 호에 맞춘 타원이 터무니없이 커지면 버린다
            continue
        hull = cv2.convexHull(c)
        solid = area / max(1.0, cv2.contourArea(hull))
        out.append({"c": (ex, ey), "ax": (ew, eh), "ang": ang, "area": area, "solid": solid})
    return out


def bag_tracked(frames, guess, search=300, frac=0.50, s_min=150, v_min=55, min_r=9, spin=False):
    """움직이는 봉투(5 · 16 · 21 · 23 · 28)의 호박빛 동그라미에 33과 같은 흰 워드마크 — 장마다 동그라미를 찾아 타원을 맞추고(자리 · 가로 · 세로 폭)
    앞뒤 장으로 고르게 편 뒤 인쇄처럼 얹는다(주름 밝기를 곱함, 손잡이 · 손이 지나가면 호박빛 가림판으로 가려짐).
    spin=True면 봉투 둘레 특징점으로 봉투가 도는 각을 따라 글자도 돌린다(흔들리는 23)."""
    col, a = graphic("늘켬", 200)
    gh, gw = a.shape
    n = len(frames)
    det = [None] * n
    gx, gy = guess
    last = None
    for i, f in enumerate(frames):
        cx, cy = last["c"] if last else (gx, gy)
        cx, cy = float(np.clip(cx, 0, f.shape[1] - 1)), float(np.clip(cy, 0, f.shape[0] - 1))   # 화면 밖으로 잘린 판은 타원 가운데가 밖에 있다
        cands = orange_disc(f, (cx - search, cy - search, cx + search, cy + search), s_min=s_min, v_min=v_min)
        cands = [d for d in cands if d["solid"] > 0.75 and min(d["ax"]) / 2 >= min_r]
        if not cands:
            continue
        d = max(cands, key=lambda d: d["area"] * d["solid"] / (1 + np.hypot(d["c"][0] - cx, d["c"][1] - cy) / (search * 0.6)))
        det[i] = d
        last = d
    idx = [i for i in range(n) if det[i] is not None]
    if not idx:
        print("  봉투 동그라미를 못 찾음 — 그대로 둠")
        return frames

    def extents(d):   # 기운 타원의 가로 · 세로 폭(화면 축)
        (ew, eh), t = d["ax"], np.radians(d["ang"])
        A, B = ew / 2, eh / 2
        return 2 * np.sqrt((A * np.cos(t)) ** 2 + (B * np.sin(t)) ** 2), 2 * np.sqrt((A * np.sin(t)) ** 2 + (B * np.cos(t)) ** 2)
    arr = np.full((n, 4), np.nan)
    for i in idx:
        hx, vy = extents(det[i])
        arr[i] = [det[i]["c"][0], det[i]["c"][1], hx, vy]
    for j in range(4):
        v = arr[:, j]
        ok = ~np.isnan(v)
        v[~ok] = np.interp(np.flatnonzero(~ok), np.flatnonzero(ok), v[ok])
        arr[:, j] = [np.median(v[max(0, i - 2):i + 3]) for i in range(n)]
    rots = np.zeros(n)
    if spin:
        i0 = idx[0]
        cx0, cy0, hx0, vy0 = arr[i0]
        R0 = max(hx0, vy0)
        Ms = track(frames[i0:], (int(cx0 - R0 * 1.3), int(cy0 - R0 * 1.3), int(cx0 + R0 * 1.3), int(cy0 + R0 * 1.3)), mode="sim")
        ang = np.array([np.degrees(np.arctan2(M[1, 0], M[0, 0])) for M in Ms])
        rots[i0:] = np.clip([np.median(ang[max(0, k - 2):k + 3]) for k in range(len(ang))], -25, 25)
    out = []
    for i, f in enumerate(frames):
        cx, cy, hx, vy = arr[i]
        s = frac * hx / gw
        sy = frac * vy / gw
        T0 = np.array([[1, 0, -gw / 2], [0, 1, -gh / 2], [0, 0, 1]], np.float64)
        S = np.array([[s, 0, 0], [0, sy, 0], [0, 0, 1]], np.float64)
        r = np.radians(rots[i])
        Rm = np.array([[np.cos(r), -np.sin(r), 0], [np.sin(r), np.cos(r), 0], [0, 0, 1]], np.float64)
        T1 = np.array([[1, 0, cx], [0, 1, cy + vy * 0.01], [0, 0, 1]], np.float64)
        M = (T1 @ Rm @ S @ T0)[:2]
        c, al = place(col, a, (f.shape[1], f.shape[0]), M)
        rr = max(hx, vy) * 0.62
        bx = (max(0, int(cx - rr)), max(0, int(cy - rr)), min(f.shape[1], int(cx + rr)), min(f.shape[0], int(cy + rr)))
        if bx[2] - bx[0] < 4 or bx[3] - bx[1] < 4:
            out.append(f)
            continue
        hsv = cv2.cvtColor(f[bx[1]:bx[3], bx[0]:bx[2]], cv2.COLOR_BGR2HSV).astype(np.float32)
        hh, ss, vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        mt_s = np.clip(1 - np.maximum(0, np.abs(hh - 15) - 9) / 4, 0, 1) * np.clip((ss - (s_min - 40)) / 35, 0, 1) * np.clip((vv - (v_min - 25)) / 30, 0, 1)
        mt = np.zeros(f.shape[:2], np.float32)
        mt[bx[1]:bx[3], bx[0]:bx[2]] = cv2.GaussianBlur(mt_s, (0, 0), 1.0)
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
        sub = g[bx[1]:bx[3], bx[0]:bx[2]]
        ref = max(1.0, float(np.percentile(sub[mt_s > 0.5], 60))) if (mt_s > 0.5).any() else max(1.0, float(np.percentile(sub, 60)))
        mod = np.clip(g / ref, 0.55, 1.08)
        f2 = f.astype(np.float32) / 255.0
        aa = al * mt
        bl = 0.6 + 0.004 * max(hx, vy)   # 가까운 큰 봉투일수록 조금 더 부드럽게 — 장면 화질에 맞춤
        pre = cv2.GaussianBlur(c * aa[..., None], (0, 0), bl) * mod[..., None] * 0.93
        aa = cv2.GaussianBlur(aa, (0, 0), bl)
        o = f2 * (1 - aa[..., None]) + pre
        out.append(np.clip(o * 255 + 0.5, 0, 255).astype(np.uint8))
    print(f"  봉투 동그라미 {len(idx)}/{n}장에서 찾음 · 가로 {np.min(arr[:, 2]):.0f}~{np.max(arr[:, 2]):.0f}px" + (f" · 돎 {rots.min():.0f}~{rots.max():.0f}도" if spin else ""))
    return out


def bag_mark(frames, center, radius, frac=0.52):
    """33 봉투 호박빛 동그라미 안에 흰 워드마크(로고 D 결) — 봉투 주름을 따라 밝기를 곱해 인쇄처럼."""
    col, a = graphic("늘켬", 200)
    gh, gw = a.shape
    Ms = track(frames, (int(center[0] - radius * 1.6), int(center[1] - radius * 1.6), int(center[0] + radius * 1.6), int(center[1] + radius * 1.6)))
    out = []
    for f, Mt in zip(frames, Ms):
        M0 = affine_for(gw, gh, center[0], center[1] + radius * 0.02, radius * 2 * frac * gh / gw, angle_deg=-2.0)
        c, al = place(col, a, (f.shape[1], f.shape[0]), compose(Mt, M0))
        q = cv2.transform(np.array([[center]], np.float32), Mt).reshape(2)
        x0, y0, x1, y1 = int(q[0] - radius * 1.2), int(q[1] - radius * 1.2), int(q[0] + radius * 1.2), int(q[1] + radius * 1.2)
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
        ref = max(1.0, float(np.percentile(g[y0:y1, x0:x1], 60)))
        mod = np.clip(g / ref, 0.55, 1.08)   # 주름 그늘 · 비침을 따라 인쇄 잉크가 어두워지고 밝아진다
        mt = amber_matte(f, (x0, y0, x1, y1), soft=1.0)
        f2 = f.astype(np.float32) / 255.0
        aa = al * mt
        pre = cv2.GaussianBlur(c * aa[..., None], (0, 0), 0.9) * mod[..., None] * 0.93
        aa = cv2.GaussianBlur(aa, (0, 0), 0.9)
        o = f2 * (1 - aa[..., None]) + pre
        out.append(np.clip(o * 255 + 0.5, 0, 255).astype(np.uint8))
    return out
