# 11번 첨벙댕 끝 합성(2026-11-04) — 유호님 「밑에 첨벙댕 이거 써있는게 너무 슬롭같은데 … 모션그래픽이나 cg 트렌디한느낌으로」.
# 레몬 판을 버리고, 고글 쓴 개가 앉은 방에 물이 차오른 판(p11-11w) 위로 블렌더 튜브 글자(튜브글자.py)가 물속에서 「첨 · 벙 · 댕」 하나씩 솟아 둥둥 뜬다. ㅇ은 구명 튜브(고글 테와 같은 주황).
#   python -X utf8 끝합성.py <글자 폴더(l0.png · l1.png · l2.png)> <나갈 mp4> [--물 받음/p11-11w.mp4] [--미리 프레임,프레임…]
# 물 판은 내용 판(AI)이고 글자 · 물방울 · 물결은 여기서 얹는다 — 글자를 AI에 맡기지 않는다(제작 규칙). 화면 크기로 프레임을 내 최종편집.py가 컷으로 잇는다.
import argparse
import os
import subprocess

import cv2
import numpy as np

W, H, FPS = 1080, 1920, 24
ap = argparse.ArgumentParser()
ap.add_argument("letters")
ap.add_argument("out")
ap.add_argument("--물", default="C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음/p11-11w.mp4")
ap.add_argument("--미리", default="")
ap.add_argument("--장수", type=int, default=0)     # 잘라 쓸 장 수(0이면 판 끝까지)
ap.add_argument("--착지", default="0.56,0.74,0.92")   # 물 판 시작에서 글자가 솟는 초(내레이션 「첨벙댕」 — 물 판 0.5초가 20.39초)
ap.add_argument("--줄", type=int, default=1692)      # 글자가 뜨는 물 높이(글자 아래쪽, 물 판 끝 기준)
ap.add_argument("--줄처음", type=int, default=1740)   # 처음엔 물이 덜 차 줄이 이만큼 아래 — 판 끝까지 천천히 오른다
ap.add_argument("--가라앉음", type=float, default=0.045)   # 글자 높이의 이만큼이 물 아래
ap.add_argument("--배율", type=float, default=0.87)    # 렌더 낱장을 줄이는 값 — 렌더 자리 그대로면 「벙」 · 「댕」이 붙어 「첨비ㅓ대」로 읽혔다(11-04 휴대폰 폭 확인)
ap.add_argument("--틈", type=int, default=58)         # 글자 사이 틈 — 글자 안 틈(ㅂ과 ㅓ 약 40)보다 넓어야 세 덩이로 읽힌다
a = ap.parse_args()
LAND = [float(x) for x in a.착지.split(",")]
rng = np.random.default_rng(16)


def read(path, n=0):
    # 색 왕복은 zscale로 — 앞 컷(C.cut_video)과 이어 붙이는 자리에서 색이 튀지 않게(폰다시얹기.py와 같은 까닭)
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=lanczos,zscale=matrixin=709:rangein=limited:range=full,format=gbrp", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True)
    f = np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W, 3)
    return f[:n] if n else f


def imread(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_UNCHANGED)


# 글자 낱장: 곱한 알파로 바꾸고 알맞게 자른다
sprites = []
for i in range(3):
    im = imread(os.path.join(a.letters, f"l{i}.png")).astype(np.float32) / 255
    al = im[..., 3:]
    ys, xs = np.nonzero(al[..., 0] > 0.01)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # 곱한 알파 상태에서 줄인다(테두리 번짐 방지)
    bgr = cv2.resize((im[..., :3] * al)[y0:y1, x0:x1], None, fx=a.배율, fy=a.배율, interpolation=cv2.INTER_AREA)
    alpha = cv2.resize(al[y0:y1, x0:x1], None, fx=a.배율, fy=a.배율, interpolation=cv2.INTER_AREA)
    alpha = alpha if alpha.ndim == 3 else alpha[..., None]
    sprites.append({"bgr": bgr, "a": alpha, "x": 0, "w": bgr.shape[1], "h": bgr.shape[0]})
# 세 글자를 틈을 두고 화면 가운데로
x = (W - sum(sp["w"] for sp in sprites) - a.틈 * 2) // 2
for i, sp in enumerate(sprites):
    sp["x"] = x
    x += sp["w"] + a.틈
    print("글자", i, "자리 x", sp["x"], sp["x"] + sp["w"], "높이", sp["h"])


def spring(tau, amp, w=9.0, d=4.2):
    return amp * np.exp(-d * tau) * np.cos(w * tau)


def line_at(t):
    """물 줄 높이 — 물이 판 끝까지 천천히 차오른다(개 배의 물 줄을 재서 맞춤). 처음 1초는 빠르게, 그다음 느리게"""
    k = np.clip((t - 0.5) / 3.5, 0, 1)
    return a.줄처음 + (a.줄 - a.줄처음) * (1 - (1 - k) ** 1.6)


def state(i, t):
    """t초에 글자 i의 (위쪽 y, 가로 배율, 세로 배율, 돌림°, 솟았는가)"""
    tl = LAND[i]
    h = sprites[i]["h"]
    rest = line_at(t) - h * (1 - a.가라앉음)   # 글자 위쪽 y
    tau = t - tl
    if tau < 0:
        return None
    # 물속에서 튀어 올라 넘쳤다 내려앉는다(부력)
    y = rest + h * 1.05 * np.exp(-5.0 * tau) * np.cos(9.5 * tau) + 6 * np.sin(2 * np.pi * (tau / 1.7) + i * 1.9) * min(1, tau * 2)
    v = np.exp(-6.0 * tau)
    sq = spring(tau - 0.33, 0.10, w=15, d=6) if tau > 0.33 else 0.0   # 내려앉을 때 살짝 눌림
    sx, sy = 1 + sq - 0.05 * v, 1 - sq + 0.09 * v                       # 솟는 동안 세로로 늘어남
    rot = spring(tau, (-9 + 9 * i), w=8, d=3.0) + 1.2 * np.sin(2 * np.pi * (tau / 2.1) + i * 1.3) * min(1, tau * 2)
    return y, sx, sy, rot


def place(sp, y, sx, sy, rot):
    """낱장을 화면 크기 층으로(곱한 알파)"""
    h, w = sp["h"], sp["w"]
    cx, cy = w / 2, h * 0.9
    M = cv2.getRotationMatrix2D((cx, cy), rot, 1.0)
    M[0] *= sx
    M[1] *= sy
    px, py = sp["x"] + cx, y + h * 0.9
    M[0, 2] += px - (M[0, 0] * cx + M[0, 1] * cy)
    M[1, 2] += py - (M[1, 0] * cx + M[1, 1] * cy)
    b = cv2.warpAffine(sp["bgr"], M, (W, H), flags=cv2.INTER_LINEAR)
    al = cv2.warpAffine(sp["a"], M, (W, H), flags=cv2.INTER_LINEAR)
    return b, al if al.ndim == 3 else al[..., None]


def over(dst, b, al):
    return dst * (1 - al) + b


def wave_x(layer, t, amp=5.0, lam=44.0, y0=0):
    """줄마다 가로로 흔든다(물 아래 · 비침)"""
    ys = np.arange(H, dtype=np.float32)
    dx = amp * np.sin(2 * np.pi * (ys / lam - t * 1.3))
    mapx = np.tile(np.arange(W, dtype=np.float32), (H, 1)) + dx[:, None]
    mapy = np.tile(ys[:, None], (1, W))
    r = cv2.remap(layer, mapx, mapy, cv2.INTER_LINEAR)
    return r if r.ndim == 3 else r[..., None]


# 물방울 — 솟을 때 글자 폭으로 왕관처럼(물 판의 큰 물보라가 이미 있어 적게)
drops = []
for i, tl in enumerate(LAND):
    sp = sprites[i]
    for k in range(42):
        x = sp["x"] + rng.uniform(0.02, 0.98) * sp["w"]
        side = (x - (sp["x"] + sp["w"] / 2)) / (sp["w"] / 2)
        vx = side * rng.uniform(80, 360) + rng.normal(0, 60)
        vy = -rng.uniform(320, 1050) * (0.55 + 0.45 * rng.random())
        drops.append((tl + rng.uniform(0.0, 0.07), x, vx, vy, rng.uniform(2.0, 7.5) * rng.uniform(0.6, 1), rng.uniform(0.5, 0.95)))
G = 2700


def splash_layer(t):
    lay = np.zeros((H, W, 3), np.float32)
    al = np.zeros((H, W), np.float32)
    for t0, x, vx, vy, r, op in drops:
        tau = t - t0
        if tau < 0 or tau > 1.0:
            continue
        px = x + vx * tau
        py = line_at(t) + vy * tau + 0.5 * G * tau * tau
        if py > line_at(t) + 30:
            continue
        # 한 프레임 동안 지나간 만큼 늘인 줄(셔터 반 바퀴)
        ex = px - vx * 0.5 / FPS
        ey = py - (vy + G * tau) * 0.5 / FPS
        th = max(1, int(round(r)))
        cv2.line(al, (int(ex), int(ey)), (int(px), int(py)), float(op), th, cv2.LINE_AA)
    al = cv2.GaussianBlur(al, (0, 0), 0.7)[..., None]
    col = np.float32([1.0, 0.985, 0.95])   # BGR — 살짝 물빛
    return col * al, al


def ripple_layer(t, base):
    """닿은 자리에서 퍼지는 물결 — 밝은 줄과 그 안쪽의 어두운 줄"""
    lay = np.zeros((H, W), np.float32)
    dark = np.zeros((H, W), np.float32)
    for i, tl in enumerate(LAND):
        sp = sprites[i]
        cx, cy = int(sp["x"] + sp["w"] / 2), int(line_at(t)) - 6
        for k, lag in enumerate((0.30, 0.52, 0.8)):   # 물 판 거품이 가라앉은 뒤에 보이는 물결
            tau = t - tl - lag
            if tau <= 0 or tau > 1.5:
                continue
            rx = int(sp["w"] * 0.34 + 300 * tau)
            ry = int(rx * 0.145)
            op = 0.22 * (1 - tau / 1.5) * (1 - 0.25 * k)   # 진하면 선으로 그린 동그라미처럼 보였다
            th = max(1, int(round(4 - 2 * tau)))
            cv2.ellipse(lay, (cx, cy), (rx, ry), 0, 0, 360, float(op), th, cv2.LINE_AA)
            cv2.ellipse(dark, (cx, cy), (max(1, rx - 7), max(1, ry - 2)), 0, 0, 360, float(op * 0.55), th + 1, cv2.LINE_AA)
    lay = cv2.GaussianBlur(lay, (0, 0), 2.2)[..., None]
    dark = cv2.GaussianBlur(dark, (0, 0), 3.0)[..., None]
    return np.clip(base * (1 - dark * 0.65) + lay * 255 * 0.9, 0, 255)


def water_tint(frame):
    """물 줄 둘레 평균색 — 글자 아랫부분 · 비침에 섞는다"""
    r = frame[a.줄 - 30:a.줄 + 120, 60:1020].reshape(-1, 3)
    return np.median(r, axis=0).astype(np.float32) / 255


def foam_mask(frame, line):
    """물 줄 둘레의 흰 거품 — 글자보다 앞에 남긴다(글자가 거품 속에서 솟는다)"""
    lum = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    m = np.clip((lum - 0.62) / 0.2, 0, 1)
    band = np.clip(1 - np.abs(np.arange(H, dtype=np.float32) - (line + 8)) / 70, 0, 1)[:, None]
    return cv2.GaussianBlur(m * band, (0, 0), 1.5)[..., None]


def frame_at(f, base):
    t = f / FPS
    out = base.astype(np.float32)
    tint = water_tint(base)
    out = ripple_layer(t, out)
    out = out / 255
    line = float(line_at(t))
    foam = foam_mask(base, line)
    above = []
    for i, sp in enumerate(sprites):
        st = state(i, t)
        if st is None:
            continue
        y, sx, sy, rot = st
        b, al = place(sp, y, sx, sy, rot)
        xs = np.arange(W, dtype=np.float32)
        wl = line + 4.5 * np.sin(2 * np.pi * (xs / 260 + t * 0.9) + i)
        yy = np.arange(H, dtype=np.float32)[None, :].T
        m_up = np.clip((wl[None, :] - yy) / 3.0 + 0.5, 0, 1)[..., None].astype(np.float32)   # 물 위 1 · 물 아래 0
        # 어둠받이 — 글자 밑 물이 살짝 어두워진다
        shade = cv2.GaussianBlur((al * (1 - m_up))[..., 0], (0, 0), 22)[..., None]
        out = out * (1 - np.clip(shade * 0.9, 0, 0.5))
        # 비침 — 물 줄을 기준으로 뒤집어 번지게(거품이 있을 땐 안 보인다)
        flip_y = (2 * line - np.arange(H, dtype=np.float32))
        mapx = np.tile(np.arange(W, dtype=np.float32), (H, 1))
        mapy = np.tile(flip_y[:, None], (1, W)).astype(np.float32)
        rb = cv2.GaussianBlur(cv2.remap(b, mapx, mapy, cv2.INTER_LINEAR), (0, 0), 4)
        ra = cv2.GaussianBlur(cv2.remap(al, mapx, mapy, cv2.INTER_LINEAR), (0, 0), 4)
        ra = ra if ra.ndim == 3 else ra[..., None]
        fade = np.clip(1 - (np.arange(H, dtype=np.float32) - line) / 190, 0, 1)[:, None, None] * (np.arange(H)[:, None, None] > line)
        rb = wave_x(rb, t, amp=9, lam=52)
        ra = wave_x(ra, t, amp=9, lam=52)
        op = 0.55 * fade * (1 - foam)
        out = out * (1 - ra * op) + (rb * 0.8 + tint * ra * 0.2) * op
        # 물 아래 부분 — 물색이 섞이고 흔들린다
        ub = wave_x(b, t, amp=4, lam=30)
        ua = wave_x(al, t, amp=4, lam=30)
        keep = (1 - m_up) * (1 - foam)
        out = out * (1 - ua * keep * 0.62) + (ub * 0.5 + tint * ua * 0.5) * keep * 0.62
        above.append((b * m_up, al * m_up))
    for b, al in above:
        keep = 1 - foam * 0.9
        out = over(out, b * keep, al * keep)
    sb, sa = splash_layer(t)
    out = over(out, sb, sa)
    return np.clip(out * 255, 0, 255).astype(np.uint8)


plate = read(a.물, a.장수)
print("물 판", len(plate), "장")
if a.미리:
    for f in [int(x) for x in a.미리.split(",")]:
        ok, buf = cv2.imencode(".jpg", frame_at(f, plate[f]), [cv2.IMWRITE_JPEG_QUALITY, 92])
        buf.tofile(a.out.replace(".mp4", f"_{f:03d}.jpg"))
    raise SystemExit
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-vf", "zscale=matrix=709:range=limited:rangein=full,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", a.out], stdin=subprocess.PIPE)
for f in range(len(plate)):
    p.stdin.write(frame_at(f, plate[f]).tobytes())
p.stdin.close()
if p.wait():
    raise SystemExit("ffmpeg 실패")
print("->", a.out)
