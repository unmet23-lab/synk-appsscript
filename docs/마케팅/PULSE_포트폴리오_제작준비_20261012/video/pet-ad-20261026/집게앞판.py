# 11번 첨벙댕 B급 — 뽑기 집게 컷(번쩍)의 앞판(2026-11-04). 빛줄기가 개 몸 위로 지나가 「몸이 반투명」으로 읽혔다(Fable 맹검).
# 하늘이 아닌 곳(개 · 조끼 · 집게 · 줄 · 물줄기 · 바다)을 알파 PNG로 따서 Remotion이 빛줄기 위에 얹는다 — 빛은 하늘에만 간다.
# 색으로 하늘을 가리면 하늘을 비춘 쇠 집게가 뚫려 유령처럼 보였다 → 카메라가 고정된 판이라 집게가 들어오기 전 첫 장(빈 하늘)과의 차이로 딴다.
#   python -X utf8 집게앞판.py <화면_B급.mp4> <화면 첫 장> <화면 끝 장(안 듦)> <판 mp4> <판 첫 장>  → git 밖 public/p11/claw_fg/000.png …
import os
import shutil
import subprocess
import sys

import cv2
import numpy as np

PUB = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/p11/claw_fg"
W, H = 1080, 1920
HORIZON = 1352   # 수평선 — 이 아래(바다)는 모두 앞판
DIFF = 40        # 빈 하늘과 이만큼 다르면 물건이다(세 채널 차이 합)
CLAW_BOTTOM = 760   # 빛줄기가 켜진 뒤(번쩍 뒤) 집게는 이 위에 있다


def read(path, a, b, conv):
    vf = f"select='between(n,{a},{b - 1})',setpts=N/24/TB,scale={W}:{H}:flags=lanczos,{conv}"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


src, a, b, plate, p0 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5])
shutil.rmtree(PUB, ignore_errors=True)
os.makedirs(PUB)
FULL = "zscale=matrixin=709:rangein=limited:range=full,format=gbrp"
frames = read(src, a, b, FULL)                 # 앞판의 색 — 화면과 같은 판에서
bg = read(plate, 0, 2, "format=gbrp").mean(axis=0)                 # 집게가 들어오기 전 빈 하늘
masks = read(plate, p0, p0 + (b - a), "format=gbrp")              # 차이는 같은 경로로 읽은 판끼리 잰다
print("장", len(frames), "빈 하늘", bg.shape)
ramp = np.clip((np.arange(H, dtype=np.float32) - HORIZON) / 8, 0, 1)[:, None]
for i, im in enumerate(frames):
    d = np.abs(masks[i].astype(np.float32) - bg).sum(axis=2)
    d = cv2.GaussianBlur(d, (0, 0), 1.5)
    fg = (d > DIFF).astype(np.uint8)
    # 집게 아래쪽은 구름이 살짝 흔들려 차이로 잡히면 빛줄기가 네모로 찢긴다 — 개 살 · 조끼(따뜻한 색)와 끈(어두운 색)만 앞판으로 둔다. 쇠 집게는 차이만으로
    hsv = cv2.cvtColor(masks[i], cv2.COLOR_BGR2HSV)
    warm_or_dark = ((hsv[..., 0] < 40) | (hsv[..., 0] > 160) | (hsv[..., 2] < 110)).astype(np.uint8)
    fg[CLAW_BOTTOM:] &= warm_or_dark[CLAW_BOTTOM:]
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    # 큰 덩이만 — 하늘의 잔떨림을 뺀다. 줄 · 집게 · 개는 서로 이어져 큰 덩이다
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
    keep = np.zeros_like(fg)
    for c in range(1, n):
        if st[c, cv2.CC_STAT_AREA] >= 2500:
            keep[lab == c] = 1
    alpha = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.3)
    alpha = np.maximum(alpha, ramp)
    out = np.dstack([im, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    ok, buf = cv2.imencode(".png", out, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    buf.tofile(os.path.join(PUB, f"{i:03d}.png"))
    if i in (10, 16, 24, 40):
        cv2.imencode(".jpg", cv2.resize((alpha * 255).astype(np.uint8), (W // 4, H // 4)))[1].tofile(os.path.join(os.path.dirname(PUB), f"_앞판확인_{i}.jpg"))
print("->", PUB)
