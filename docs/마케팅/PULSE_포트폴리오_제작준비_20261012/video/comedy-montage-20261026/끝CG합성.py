# 12번 끝 CG 합성(2026-11-04) — 끝CG.py가 구운 낱장(탁자 층 · 간판 층)을 화면 판에 얹어 화면_CG.mp4를 만든다. 자막과 소리는 remotion p12-cg가 그대로 잇는다.
#   python -X utf8 끝CG합성.py <탁자 폴더> <간판 폴더> [--미리 프레임,프레임…]  → git 밖 최종/p12/화면_CG.mp4(미리 보기는 _CG미리/)
# 앞사람 어깨가 탁자 층을, 돌담 윗선이 간판을 가린다(그림에서 재서 손으로 그은 윤곽). 폭로 뒤 판이 천천히 움직이는 구간은 판을 재서 CG를 따라 옮긴다.
import argparse
import os
import subprocess

import cv2
import numpy as np

W, H, FPS = 1080, 1920, 24
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p12"
SRC = os.path.join(ROOT, "화면.mp4")
OUT = os.path.join(ROOT, "화면_CG.mp4")
FROM_YUV = "zscale=matrixin=709:rangein=limited:range=full,format=gbrp"
TO_YUV = "zscale=matrix=709:range=limited:rangein=full,format=yuv420p"
FIRST, LAST = 806, 911   # 끝CG.py 탁자 층 범위
HOLD_AT = 843            # 여기부터 판이 멈춘다

ap = argparse.ArgumentParser()
ap.add_argument("table")
ap.add_argument("sign")
ap.add_argument("--미리", default="")
a = ap.parse_args()

# 돌담 윗선 — 이 선 아래(담)가 간판 앞에 있다
WALL = [(0, 305), (40, 303), (80, 300), (115, 305), (130, 312), (165, 306), (200, 292), (235, 288), (270, 296), (300, 290), (340, 284), (365, 287), (400, 300), (440, 310),
        (470, 300), (510, 292), (560, 293), (600, 290), (640, 293), (670, 290), (700, 282), (745, 285), (800, 286), (840, 296), (865, 278), (895, 272), (925, 280), (950, 290), (990, 283), (1010, 290), (1080, 300)]
# 왼쪽 앞사람 어깨 — 탁자보다 앞이다
WOMAN = [(0, 780), (30, 800), (55, 850), (75, 930), (85, 1050), (88, 1190), (84, 1290), (100, 1330), (150, 1350), (200, 1400), (222, 1430), (236, 1470), (252, 1520), (262, 1570), (272, 1620), (282, 1680), (300, 1740), (312, 1830), (312, 1920), (0, 1920)]


def poly_mask(pts, sigma):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255, cv2.LINE_AA)
    return cv2.GaussianBlur(m, (0, 0), sigma).astype(np.float32)[..., None] / 255


WALL_M = poly_mask(WALL + [(W, H), (0, H)], 1.6)
WOMAN_M = poly_mask(WOMAN, 1.4)


def imread_rgba(path):
    c = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
    al = c[..., 3:]
    return c[..., :3] * al, al


def soften(pm, al, sigma=0.7):
    """판이 부드러워 CG만 칼같이 튀지 않게 살짝 풀고, 빛이 번지게 한다"""
    pm = cv2.GaussianBlur(pm, (0, 0), sigma)
    al2 = cv2.GaussianBlur(al, (0, 0), sigma)
    return pm, al2[..., None] if al2.ndim == 2 else al2


def layer(path, cut):
    if not os.path.exists(path):
        return None
    pm, al = imread_rgba(path)
    pm, al = soften(pm, al)
    keep = 1 - cut
    return pm * keep, al * keep


def bloom(frame, pm, al, gain=0.10):
    """밝은 쪽 번짐 — 가벼운 빛 번짐으로 판의 저녁 공기에 묻힌다"""
    g = cv2.GaussianBlur(pm, (0, 0), 16)
    return np.clip(frame + g * gain, 0, 1)


def shift(img, dx, dy):
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    r = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR)
    return r[..., None] if r.ndim == 2 else r


def over(frame, pm, al):
    return frame * (1 - al) + pm


def decode():
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-vf", FROM_YUV, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    p.wait()


def track():
    """폭로 뒤 살아 있는 구간의 판 움직임 — 멈춘 그림 대비 (dx, dy). 탁자 쪽을 재고 조금 다듬는다"""
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(FIRST / FPS), "-i", SRC, "-frames:v", str(HOLD_AT - FIRST + 1), "-vf", "scale=540:960", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True)
    fr = np.frombuffer(p.stdout, np.uint8).reshape(-1, 960, 540)
    ref = np.float32(fr[-1][600:840, 100:480])
    off = []
    for g in fr:
        (dx, dy), _ = cv2.phaseCorrelate(np.float32(g[600:840, 100:480]), ref)
        off.append((dx * 2, dy * 2))
    off = np.array(off)
    k = np.ones(5) / 5
    pad = np.pad(off, ((2, 2), (0, 0)), mode="edge")
    smooth = np.stack([np.convolve(pad[:, 0], k, "valid"), np.convolve(pad[:, 1], k, "valid")], 1)
    smooth[-1] = (0, 0)
    return {FIRST + i: tuple(smooth[i]) for i in range(len(smooth))}


OFF = track()
print("판 움직임 처음", [round(float(x), 1) for x in OFF[FIRST]])


def compose(f, base):
    frame = base.astype(np.float32) / 255
    dx, dy = OFF.get(f, (0.0, 0.0))
    # 판이 (dx, dy)만큼 더 가야 멈춘 그림과 같아지므로 CG는 그만큼 덜 간 자리에
    cut = shift(WOMAN_M, -dx, -dy) if (dx or dy) else WOMAN_M
    t = layer(os.path.join(a.table, f"{f:04d}.png"), WOMAN_M)
    if t is not None:
        pm, al = t
        if dx or dy:
            pm, al = shift(pm, -dx, -dy), shift(al, -dx, -dy)
        frame = bloom(frame, pm, al)
        frame = over(frame, pm, al)
    s = layer(os.path.join(a.sign, f"{f:04d}.png"), WALL_M)
    if s is not None:
        pm, al = s
        frame = bloom(frame, pm, al, gain=0.12)
        frame = over(frame, pm, al)
    return (np.clip(frame, 0, 1) * 255).astype(np.uint8)


if a.미리:
    d = os.path.join(ROOT, "_CG미리")
    os.makedirs(d, exist_ok=True)
    want = {int(x) for x in a.미리.split(",")}
    for f, base in enumerate(decode()):
        if f in want:
            ok, b = cv2.imencode(".jpg", compose(f, base), [cv2.IMWRITE_JPEG_QUALITY, 92])
            b.tofile(os.path.join(d, f"{f:04d}.jpg"))
        if f >= max(want):
            break
    raise SystemExit

enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-vf", TO_YUV, "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", OUT], stdin=subprocess.PIPE)
n = 0
for f, base in enumerate(decode()):
    enc.stdin.write((compose(f, base) if f >= FIRST else base).tobytes())
    n += 1
enc.stdin.close()
if enc.wait():
    raise SystemExit("ffmpeg 실패")
print(n, "장 ->", OUT)
