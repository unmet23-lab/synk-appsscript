# 8번 이미지 콘티 합성(2026-10-25) — Gemini가 구운 크로마 초록 대역 자리에 실제 것을 입힌다(제품 · 앱 화면은 AI로 그리지 않는다 — 제작 규칙 원칙).
#  · 폰 화면: 캐스팅북 녹화 프레임(녹화/<R>/frames — 393×852pt를 3배로 찍은 1179×2556)을 평면 원근(네 귀퉁이)으로 붙인다.
#    화면 앞 손가락(초록이 아닌 것)은 위에 그대로 남고, 초록 위 흰 십자 표시(추적용)는 구멍 메우기로 화면에 덮인다.
#  · 인쇄물(쇼핑백 · 포스터 · 스티커 · 배너 · 우리 가게 포스터): 캐스팅북 하린 사진을 초록 자리 비율로 자르고, 초록 면의 밝기 결(주름 · 그늘)과
#    장면 빛의 세기 · 색을 곱해 얹는다(초록 대역을 그 자리 물건으로 바꾸는 합성 — 색 맞춤 후보정과는 다르다).
#   python -X utf8 이미지콘티_합성.py [C03 C05 …]  → 콘티/p8/컷/<컷>.jpg(1920×1080) · 컷/_합성기록.json
import sys, json, glob, os
from pathlib import Path
import numpy as np, cv2
from PIL import Image

P8 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8")
IMG = Path(r"C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/img/F02")
OUT = P8 / "컷"
W, H = 1920, 1080
PT = (393, 852)   # 녹화 화면(pt)

# 폰 컷: 녹화 · 프레임(컷 첫 프레임 = 0), 화면 귀퉁이를 자동으로 잡을지(auto) 손으로 줄지(quad: 화면 pt 점 넷 ↔ 그림 점 넷, 1920×1080 기준)
SCREEN = {
    "C03": {"rec": "R3", "f": 0},
    "C06": {"rec": "R6", "f": 0, "crop": [0, 55, 393]},      # 극접사: 초록 자리 = 화면 가로 전체 · 위 55pt부터(머리 줄 아래 대표 사진) — 세로는 초록 비율로
    "C10": {"rec": "R10", "f": 0, "crop": [0, 100, 393]},    # 극접사: 장면 격자 첫 줄부터
    "C12": {"rec": "R12", "f": 0, "crop": [0, 100, 393]},   # 폰이 화면보다 길어 위 · 아래가 잘린다 — 머리 줄 아래부터 보이는 만큼
    "C15": {"rec": "R15", "f": 0},
    "C17": {"rec": "R17", "f": 0, "zoom": True, "crop": [0, 567.2, 260]},   # 극접사판(9배)이 찍은 자리 그대로: x 0~260 · y 520.2+47pt부터
}
# 인쇄물 컷: 캐스팅북 하린 사진 · 얼굴 쪽 자르기 중심(fx, fy: 0~1) · 테두리(흰 여백 비율)
PRINT = {
    "C02": [{"photo": "scene-b14", "fx": 0.52, "fy": 0.40, "border": 0.0, "glass": True}],         # 창밖 가로등 배너(작게) — 13번 복선, 13번과 같은 사진
    "C05": [{"photo": "scene-b16", "fx": 0.5, "fy": 0.42, "border": 0.0}],          # 쇼핑백 앞면 — 풀밭 · 누워서 웃음
    "C08": [{"photo": "scene-b11", "fx": 0.5, "fy": 0.35, "border": 0.04}],         # 옆 가게 포스터 — 스킨케어
    "C11": [{"photo": "exp-smile", "fx": 0.5, "fy": 0.40, "border": 0.05}],         # 냉장고 스티커 — 웃음
    "C13": [{"photo": "scene-b14", "fx": 0.52, "fy": 0.40, "border": 0.0},          # 가로등 배너 — 소파 · 폰 보며 웃음
            {"photo": "scene-b14", "fx": 0.52, "fy": 0.40, "border": 0.0}],         # 먼 배너(같은 것)
    "C19": [{"photo": "context", "fx": 0.45, "fy": 0.40, "border": 0.06}],          # 우리 가게 포스터 — 15번에서 연 카페 · 딸기 라떼
}


def read(p):
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def write(p, img, q=92):
    ok, buf = cv2.imencode(Path(p).suffix, img, [cv2.IMWRITE_JPEG_QUALITY, q]); buf.tofile(str(p))


def pick(cut):
    p = P8 / "정지컷" / f"{cut}.png"
    if p.exists():
        return p
    c = sorted(glob.glob(str(P8 / "받음" / f"{cut}_*.jpg")), key=os.path.getmtime)
    return Path(c[-1]) if c else None


def green_mask(img):
    b, g, r = [img[..., i].astype(np.int16) for i in range(3)]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 0] >= 38) & (hsv[..., 0] <= 88) & (hsv[..., 1] >= 80) & (hsv[..., 2] >= 40) & (g > r + 25) & (g > b + 20)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return m


def regions(m, k):
    """초록 덩어리 큰 것부터 k개 — 구멍(십자 표시)은 메운다. 손가락처럼 바깥과 이어진 것은 메우지 않는다."""
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    order = sorted(range(1, n), key=lambda i: -st[i, cv2.CC_STAT_AREA])[:k]
    out = []
    for i in order:
        one = (lab == i).astype(np.uint8) * 255
        inv = cv2.bitwise_not(one)
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv)
        h, w = one.shape
        for j in range(1, n2):
            x, y, ww, hh, a = st2[j]
            if x > 0 and y > 0 and x + ww < w and y + hh < h and a < 0.02 * w * h:
                one[lab2 == j] = 255
        out.append(one)
    out.sort(key=lambda o: np.argwhere(o > 0)[:, 1].mean())   # 왼쪽부터
    return out


def order4(pts):
    s = pts.sum(1); d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], np.float32)   # 왼위 · 오위 · 오아래 · 왼아래


def quad_of(one):
    """초록 덩어리의 네 귀퉁이. 후보 둘 — ① 볼록 껍질을 네 점으로 근사한 뒤 변마다 직선을 다시 맞춘 것 ② 껍질을 덮는 가장 작은 기운 사각형 —
    가운데 볼록 껍질과 더 잘 겹치는 쪽을 쓴다. 손가락이 귀퉁이를 가리면 ①이 비스듬히 안쪽으로 접혀(3번 화면 오른쪽 · 아래 초록 띠) ②가 낫고,
    원근이 센 화면(10 · 15번)은 ①이 낫다."""
    cs, _ = cv2.findContours(one, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    hull = cv2.convexHull(c)
    for eps in (0.01, 0.02, 0.03, 0.05, 0.08):
        ap = cv2.approxPolyDP(hull, eps * cv2.arcLength(hull, True), True)
        if len(ap) == 4:
            a = refine_quad(hull.reshape(-1, 2).astype(np.float32), order4(ap.reshape(4, 2).astype(np.float32))); break
    else:
        a = None
    b = order4(cv2.boxPoints(cv2.minAreaRect(hull)).astype(np.float32))
    hm = np.zeros(one.shape, np.uint8); cv2.fillConvexPoly(hm, hull.reshape(-1, 2), 1)

    def iou(q):
        qm = np.zeros(one.shape, np.uint8); cv2.fillConvexPoly(qm, np.round(q).astype(np.int32), 1)
        return (qm & hm).sum() / max(1, (qm | hm).sum())
    return a if a is not None and iou(a) >= iou(b) else b


def quad_lines(one):
    """프레임에 잘린 초록 화면의 네 귀퉁이(왼위 · 오위 · 오아래 · 왼아래) — 변마다 경계 점에 직선을 맞추고 이웃 직선의 교점을 쓴다.
    줄마다 가장 왼쪽 · 오른쪽, 칸마다 가장 위 · 아래 초록 화소 가운데 프레임 가장자리에서 3px 넘게 떨어진 것만 그 변의 점으로 쓰고,
    한 번 맞춘 직선에서 8px 넘게 벗어난 점(손가락 · 십자)은 빼고 다시 맞춘다. 점이 화면 크기의 1할보다 적은 변은 프레임 가장자리를 쓴다."""
    h, w = one.shape
    m = one > 0
    rows = np.where(m.any(1))[0]; cols = np.where(m.any(0))[0]
    L = [(np.argmax(m[y]), y) for y in rows]; R = [(w - 1 - np.argmax(m[y][::-1]), y) for y in rows]
    T = [(x, np.argmax(m[:, x])) for x in cols]; B = [(x, h - 1 - np.argmax(m[:, x][::-1])) for x in cols]
    L = [(x, y) for x, y in L if x > 3]; R = [(x, y) for x, y in R if x < w - 4]
    T = [(x, y) for x, y in T if y > 3]; B = [(x, y) for x, y in B if y < h - 4]

    def fit(pts, vertical):
        if len(pts) < 0.1 * (h if vertical else w):
            return None
        a = np.array(pts, np.float32)
        for _ in range(2):
            vx, vy, x0, y0 = cv2.fitLine(a.reshape(-1, 1, 2), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            d = np.abs((a[:, 0] - x0) * vy - (a[:, 1] - y0) * vx)
            keep = d < 8
            if keep.sum() < 10:
                break
            a = a[keep]
        return np.array([x0, y0], np.float32), np.array([vx, vy], np.float32)
    frame = {"L": (np.array([0, 0], np.float32), np.array([0, 1], np.float32)), "R": (np.array([w - 1, 0], np.float32), np.array([0, 1], np.float32)),
             "T": (np.array([0, 0], np.float32), np.array([1, 0], np.float32)), "B": (np.array([0, h - 1], np.float32), np.array([1, 0], np.float32))}
    # 프레임 가장자리에 넓게(그 변 길이의 2할 넘게) 닿은 변은 화면이 거기서 잘린 것 — 프레임 선을 쓴다(기운 띠 화면은 칸마다 맨 위 점이 옆 테두리에서 잡힌다)
    span_x = max(1, cols.max() - cols.min()); span_y = max(1, rows.max() - rows.min())
    touch = {"T": m[0].sum() > 0.2 * span_x, "B": m[-1].sum() > 0.2 * span_x, "L": m[:, 0].sum() > 0.2 * span_y, "R": m[:, -1].sum() > 0.2 * span_y}
    ln = {k: (frame[k] if touch[k] else (fit(v, k in "LR") or frame[k])) for k, v in (("L", L), ("R", R), ("T", T), ("B", B))}

    def cross(a, b):
        (p1, d1), (p2, d2) = ln[a], ln[b]
        A = np.array([d1, -d2], np.float32).T
        k = np.linalg.solve(A, p2 - p1)
        return p1 + k[0] * d1
    return np.array([cross("T", "L"), cross("T", "R"), cross("B", "R"), cross("B", "L")], np.float32)


def refine_quad(cpts, q):
    """둥근 귀퉁이 탓에 근사 꼭짓점이 안쪽으로 들어온다 — 변마다 가운데 구간의 껍질 점에 직선을 맞추고 이웃 직선의 교점을 꼭짓점으로 쓴다
    (두 번: 처음엔 넓게 고르고, 맞춘 직선으로 다시 좁게). 점이 모자란 변은 근사 변 그대로."""
    lines = []
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]
        v = b - a; L = float(np.hypot(*v)) or 1.0; u = v / L
        p0, d0 = a.astype(np.float32), u.astype(np.float32)
        for tol in (0.05 * L, 6.0):
            nrm = np.array([-d0[1], d0[0]], np.float32)
            rel = cpts - p0; t = (cpts - a) @ u / L; dist = np.abs(rel @ nrm)
            sel = cpts[(t > 0.1) & (t < 0.9) & (dist < tol)]
            if len(sel) < 2:
                break
            vx, vy, x0, y0 = cv2.fitLine(sel.reshape(-1, 1, 2), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            p0, d0 = np.array([x0, y0], np.float32), np.array([vx, vy], np.float32)
        lines.append((p0, d0))
    out = q.copy()
    for i in range(4):
        (p1, d1), (p2, d2) = lines[(i - 1) % 4], lines[i]
        A = np.array([d1, -d2], np.float32).T
        if abs(np.linalg.det(A)) < 1e-6:
            continue
        k = np.linalg.solve(A, p2 - p1)
        cand = p1 + k[0] * d1
        if np.hypot(*(cand - q[i])) < 0.15 * max(np.ptp(q[:, 0]), np.ptp(q[:, 1])):   # 멀리 튄 교점은 버림
            out[i] = cand
    return out


def feather(one, px=1.5):
    return cv2.GaussianBlur(one.astype(np.float32) / 255, (0, 0), px)


def despill(img, one):
    """초록 덩어리 가장자리 띠(안쪽 5px ~ 바깥 10px)의 초록 기운을 뺀다. 흐린 손가락은 생성 단계에서 초록과 섞인 폭이 넓어
    7px 고리로는 테가 남았다(6번 엄지 — Fable 2차 P2 12)."""
    ring = (cv2.dilate(one, np.ones((21, 21), np.uint8)) > 0) & ~(cv2.erode(one, np.ones((11, 11), np.uint8)) > 0)
    b, g, r = [img[..., i].astype(np.int16) for i in range(3)]
    lim = np.maximum(r, b) + 6
    g2 = np.where(ring & (g > lim), lim, g)
    out = img.copy(); out[..., 1] = np.clip(g2, 0, 255).astype(np.uint8)
    return out


def matte(img, one, quad, px=4):
    """덮을 알파 — 초록 덩어리(구멍 메움)와 손가락에 붙어 메우기에서 빠진 흰 십자를 px만큼 넓혀 덮고 가장자리를 1.2px 흐린다.
    사각형(조금 키운 것) 밖은 0. 흐린 손가락 가장자리의 초록 테(6번 엄지 — Fable 2차 P2 12)는 넓혀 덮기(화면 4px)와 despill(21px)로 없앤다.
    10-26에 시험한 「초록 정도로 부드럽게 섞기」 · 「초록 몫만 바꿔 넣기」는 손가락 둘레에 분홍 테 · 얼룩, 배너 가장자리에 초록 테가 생겨 버렸다."""
    b, g, r = [img[..., i].astype(np.float32) for i in range(3)]
    green = (g - np.maximum(r, b) - 20) > 20
    qm = cv2.dilate(cv2.fillConvexPoly(np.zeros(one.shape, np.uint8), np.round(quad).astype(np.int32), 1), np.ones((5, 5), np.uint8))
    lo, hi = np.minimum(np.minimum(r, g), b), np.maximum(np.maximum(r, g), b)
    white = ((lo > 150) & (hi - lo < 60) & (qm > 0)).astype(np.uint8)
    cross = np.zeros(one.shape, np.uint8)   # 흰 십자 — 작고 가늘며 둘레가 초록인 흰 덩어리(손가락의 밝은 곳 · 쇠붙이는 뭉툭하고 둘레가 초록이 아니다)
    n, lab, st, _ = cv2.connectedComponentsWithStats(white)
    for i in range(1, n):
        x, y, ww, hh, area = st[i]
        if area > 0.002 * one.size:
            continue
        x0, y0, x1, y1 = max(0, x - 6), max(0, y - 6), min(one.shape[1], x + ww + 6), min(one.shape[0], y + hh + 6)
        comp = (lab[y0:y1, x0:x1] == i).astype(np.uint8)
        ring = (cv2.dilate(comp, np.ones((7, 7), np.uint8)) > 0) & (comp == 0)
        gfrac = green[y0:y1, x0:x1][ring].mean() if ring.sum() else 0.0
        thin = area / max(1, ww * hh) < 0.5 and max(ww, hh) < 60
        if gfrac > 0.6 or (thin and gfrac > 0.35):
            cross[y0:y1, x0:x1] |= comp
    k = 2 * px + 1
    m = cv2.dilate(((one > 0) | (cross > 0)).astype(np.uint8), np.ones((k, k), np.uint8)) & qm
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)


def last_despill(out, a, quad, inner=3):
    """합성 뒤 마지막 한 번 — 사각형 가장자리 띠(바깥 15px ~ 안쪽 inner px)의 초록 기운을 뺀다(g ≤ max(r, b) + 6).
    가장자리선 바로 위에 남던 「반쯤 초록」 — 15번 폰 왼쪽 테두리의 가는 초록 실선, 11번 스티커 변의 유리 기운(Fable 3차 P3 5).
    알파로 고르면 안 된다(그 자리는 덮개 알파가 0.5를 넘는데 펴 붙인 판의 가장자리라 반쯤만 덮인다). 인쇄물은 사진 속 초록(풀밭)을 지키려고 안쪽 3px만,
    폰 화면(앱 화면에 초록이 없다)은 안쪽 15px까지."""
    qm = cv2.fillConvexPoly(np.zeros(out.shape[:2], np.uint8), np.round(quad).astype(np.int32), 1)
    band = (cv2.dilate(qm, np.ones((31, 31), np.uint8)) > 0) & ~(cv2.erode(qm, np.ones((2 * inner + 1, 2 * inner + 1), np.uint8)) > 0)
    b, g, r = [out[..., i].astype(np.int16) for i in range(3)]
    lim = np.maximum(r, b) + 6
    o = out.copy(); o[..., 1] = np.where(band & (g > lim), lim, g).clip(0, 255).astype(np.uint8)
    return o


def grow(q):
    """사각형을 가운데에서 키운다 — 변마다 max(2px, 짧은 변의 2%)(작은 화면 둘레 초록 찌꺼기 — 15번)."""
    short = max(8.0, min(np.ptp(q[:, 0]), np.ptp(q[:, 1])))
    c = q.mean(0)
    return (c + (q - c) * (1 + 2 * max(2.0, 0.02 * short) / short)).astype(np.float32)


def scene_light(img, mask):
    """초록 대역에 비친 빛의 세기와 장면 빛 색(밝고 덜 칠해진 곳의 평균)."""
    g = img[..., 1][mask > 0].astype(np.float32)
    level = float(np.clip(np.median(g) / 225.0, 0.35, 1.05))
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    neutral = (hsv[..., 1] < 40) & (hsv[..., 2] > 90) & (mask == 0)
    if neutral.sum() > 2000:
        c = img[neutral].astype(np.float32).mean(0)
        tint = c / c.mean()
    else:
        tint = np.ones(3, np.float32)
    return level, np.clip(tint, 0.85, 1.15)


def photo_crop(name, aspect, fx, fy, border):
    im = cv2.cvtColor(np.asarray(Image.open(IMG / f"{name}.webp").convert("RGB")), cv2.COLOR_RGB2BGR)
    h, w = im.shape[:2]
    if w / h > aspect:
        cw, ch = int(h * aspect), h
    else:
        cw, ch = w, int(w / aspect)
    x0 = int(np.clip(fx * w - cw / 2, 0, w - cw)); y0 = int(np.clip(fy * h - ch / 2, 0, h - ch))
    crop = im[y0:y0 + ch, x0:x0 + cw]
    if border > 0:   # 흰 여백(인쇄 테두리)
        bw = int(round(border * min(cw, ch)))
        canvas = np.full((ch + 2 * bw, cw + 2 * bw, 3), 246, np.uint8)
        canvas[bw:bw + ch, bw:bw + cw] = crop
        crop = cv2.resize(canvas, (cw, ch), interpolation=cv2.INTER_AREA)
    return crop


def side_aspect(q):
    wt = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2
    ht = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2
    return wt / ht


def put(img, src, H_, one, shade=None, gain=1.0, blur=0.0, alpha=None):
    """src를 H_로 펴서 덮을 알파(matte, 없으면 one을 흐린 것)로 얹는다."""
    warped = cv2.warpPerspective(src, H_, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    valid = cv2.warpPerspective(np.full(src.shape[:2], 255, np.uint8), H_, (img.shape[1], img.shape[0])).astype(np.float32) / 255
    if blur > 0:
        warped = cv2.GaussianBlur(warped, (0, 0), blur)
    w = warped.astype(np.float32) * gain
    if shade is not None:
        w *= shade[..., None]
    w = np.clip(w, 0, 255)
    a = (alpha if alpha is not None else feather(one)) * valid
    out = img.astype(np.float32) * (1 - a[..., None]) + w * a[..., None]
    return out.astype(np.uint8)


def screen_frame(rec, f, zoom=False):
    if zoom:
        z = json.load(open(P8 / "녹화" / rec / "zoom" / "clip.json", encoding="utf-8"))
        im = read(P8 / "녹화" / rec / "zoom" / ("after.png" if f >= 25 else "before.png"))
        s = z["dpr"]; cx, cy = z["clip"]["x"], z["clip"]["y"] + 47   # 상태 표시줄 47pt 아래가 페이지
        T = np.array([[1 / s, 0, cx], [0, 1 / s, cy], [0, 0, 1]], np.float64)   # 극접사 화소 → 화면 pt
        return im, T
    im = read(P8 / "녹화" / rec / "frames" / f"{f:04d}.png")
    T = np.array([[1 / 3, 0, 0], [0, 1 / 3, 0], [0, 0, 1]], np.float64)
    return im, T


def do_screen(cut, img, cfg, rec):
    m = green_mask(img)
    one = regions(m, 1)[0]
    src, T = screen_frame(cfg["rec"], cfg["f"], cfg.get("zoom", False))
    if cfg.get("mblur", 0) > 1:   # 가편집: 빠른 넘김 프레임은 셔터 반만큼 스크롤 방향(세로)으로 번지게(원본 프레임에도 번짐이 있다)
        L = int(cfg["mblur"]) | 1
        src = cv2.filter2D(src, -1, np.full((L, 1), 1.0 / L, np.float32))
    if cfg.get("quad"):
        sp = np.array(cfg["quad"]["pt"], np.float32); dp = np.array(cfg["quad"]["img"], np.float32)
    elif cfg.get("crop") and (one > 0).mean() > 0.35:   # 극접사(초록이 화면의 35% 넘게): 초록 자리에는 화면의 일부(crop pt)만 보인다 — 가로는 crop, 세로는 초록 자리 비율로
        dp = quad_lines(one)   # 프레임에 잘린 화면 — 변마다 직선을 맞춰 기운 화면을 따라간다(10b)
        x0, y0, x1 = cfg["crop"]; h = (x1 - x0) / side_aspect(dp)
        sp = np.array([[x0, y0], [x1, y0], [x1, y0 + h], [x0, y0 + h]], np.float32)
        dp = grow(dp)
    else:
        # 둥근 화면 귀퉁이 · 가장자리에 초록 띠가 남았다(3번) — 화면 자리를 조금 키우고, 덮는 알파는 matte가 초록 정도로 정한다
        sp = np.array([[0, 0], [PT[0], 0], [PT[0], PT[1]], [0, PT[1]]], np.float32); dp = grow(quad_of(one))
    Hs = cv2.getPerspectiveTransform(sp, dp).astype(np.float64)
    a = matte(img, one, dp, px=4)
    img = despill(img, one)
    out = last_despill(put(img, src, Hs @ T, one, gain=0.93, blur=0.5, alpha=a), a, dp, inner=15)
    rec[cut] = {"화면": cfg["rec"], "프레임": cfg["f"], "귀퉁이": dp.round(1).tolist(), "초록%": round(float((one > 0).mean() * 100), 1)}
    return out


def do_print(cut, img, items, rec):
    m = green_mask(img)
    ones = regions(m, len(items))
    level, tint = scene_light(img, m)
    alphas = [matte(img, one, grow(quad_of(one)), px=2) for one in ones]   # despill 전 원래 그림으로
    img = despill(img, m)
    info = []
    for one, it, a in zip(ones, items, alphas):
        # 초록 가장자리 한두 화소가 남아 테두리가 초록으로 비쳤다(2번 배너) — 사진 자리를 조금 키우고, 덮는 알파는 matte가 초록 정도로 정한다
        q = grow(quad_of(one))
        ph = photo_crop(it["photo"], side_aspect(q), it["fx"], it["fy"], it["border"])
        h, w = ph.shape[:2]
        Hp = cv2.getPerspectiveTransform(np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32), q)
        gch = img[..., 1].astype(np.float32)
        med = np.median(gch[one > 0]) or 1
        shade = np.clip(gch / med, 0.55, 1.2)
        shade = cv2.GaussianBlur(shade, (0, 0), 2)
        ph = (ph.astype(np.float32) * tint).clip(0, 255).astype(np.uint8)
        gain, blur = level, 0.6
        if it.get("glass"):   # 유리 너머 먼 인쇄물(2번 창밖 배너): 채도 ×0.8 · 흐림 1.0 · 밝기 ×0.85(Fable 2차 P3 14 — 생성 판은 그대로)
            hsv = cv2.cvtColor(ph, cv2.COLOR_BGR2HSV).astype(np.float32); hsv[..., 1] *= 0.8
            ph = cv2.cvtColor(hsv.clip(0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
            gain, blur = level * 0.85, 1.0
        img = last_despill(put(img, ph, Hp, one, shade=shade, gain=gain, blur=blur, alpha=a), a, q)
        info.append({"사진": it["photo"], "귀퉁이": q.round(1).tolist()})
    rec[cut] = {"인쇄물": info, "빛세기": round(level, 2), "빛색": tint.round(3).tolist()}
    return img


def main(cuts):
    OUT.mkdir(parents=True, exist_ok=True)
    log_p = OUT / "_합성기록.json"
    rec = json.load(open(log_p, encoding="utf-8")) if log_p.exists() else {}
    for cut in cuts:
        p = pick(cut)
        if not p:
            print(cut, "그림 없음"); continue
        img = cv2.resize(read(p), (W, H), interpolation=cv2.INTER_AREA)
        if cut in SCREEN:
            img = do_screen(cut, img, SCREEN[cut], rec)
        elif cut in PRINT:
            img = do_print(cut, img, PRINT[cut], rec)
        rec.setdefault(cut, {})["원판"] = p.name
        write(OUT / f"{cut}.jpg", img)
        print(cut, p.name, json.dumps(rec[cut], ensure_ascii=False)[:160])
    json.dump(rec, open(log_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1:] or list(SCREEN) + list(PRINT))
