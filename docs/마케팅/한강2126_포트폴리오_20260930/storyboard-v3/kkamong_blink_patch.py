# -*- coding: utf-8 -*-
"""영상 속 실물 까몽 인형에 양눈 깜빡임(약 0.17초)을 그려 넣는다.

    python kkamong_blink_patch.py <영상.mp4> <시작 프레임> <결과 폴더>

시작 프레임부터 6장: 반쯤 감음 → 감음 ×3 → 반쯤 감음 → 원본.
눈은 초록 홍채 덩어리 두 개로 찾고, 눈 바로 위 털을 떠서 눈꺼풀처럼 덮은 뒤 감은 눈 주름선을 옅게 긋는다.
"""
import os, subprocess, sys
import cv2
import numpy as np

src, start, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
os.makedirs(out, exist_ok=True)
STEPS = [0.55, 1.0, 1.0, 1.0, 0.5, 0.0]   # 눈꺼풀이 내려온 정도


def frame(n):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'select=eq(n\\,{n})', '-fps_mode', 'passthrough',
                          '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)


def eyes(im):
    b, g, r = [im[..., k].astype(int) for k in range(3)]
    m = ((g > r + 20) & (g > b + 10) & (g > 80)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    blobs = sorted(range(1, n), key=lambda k: -st[k, cv2.CC_STAT_AREA])[:2]
    return [(int(cen[k][0]), int(cen[k][1]), max(st[k, 2], st[k, 3])) for k in blobs]


def lid(im, cx, cy, d, amount):
    if amount <= 0:
        return im
    rad = int(d * 0.85)                      # 홍채 + 검은 테두리
    h, w = im.shape[:2]
    x0, y0, x1, y1 = cx - rad, cy - rad, cx + rad, cy + rad
    dy = int(rad * 2.3)                      # 눈 위쪽 털에서 떠 온다
    if y0 - dy < 0 or x0 < 0 or x1 > w or y1 > h:
        return im
    patch = im[y0 - dy:y1 - dy, x0:x1].astype(np.float32)
    roi = im[y0:y1, x0:x1].astype(np.float32)
    # 덮을 털의 밝기·색을 눈 둘레 털에 맞춘다(이마 털이 더 밝아 자국이 보였다)
    yy, xx = np.mgrid[0:2 * rad, 0:2 * rad]
    rr = np.hypot(xx - rad, (yy - rad) / 0.95)
    ring = (rr > rad * 0.95) & (rr < rad * 1.0 + 1e-6) | ((rr > rad * 0.9) & (rr <= rad))
    for c in range(3):
        p, q = patch[..., c], roi[..., c][ring]
        patch[..., c] = (p - p.mean()) / (p.std() + 1e-6) * (q.std() + 1e-6) + q.mean()
    mask = np.zeros((2 * rad, 2 * rad), np.float32)
    cv2.ellipse(mask, (rad, rad), (int(rad * 0.92), int(rad * 0.88)), 0, 0, 360, 1.0, -1)
    edge = int(2 * rad * amount)             # 위에서부터 덮는 높이
    cover = np.zeros_like(mask)
    cover[:edge, :] = 1.0
    cover = cv2.GaussianBlur(cover, (0, 0), rad * 0.08)
    mask = cv2.GaussianBlur(mask, (0, 0), rad * 0.18) * cover
    res = roi * (1 - mask[..., None]) + patch.astype(np.float32) * mask[..., None]
    if amount >= 1.0:                        # 감은 눈 주름
        crease = np.zeros_like(mask)
        cv2.ellipse(crease, (rad, int(rad * 0.95)), (int(rad * 0.7), int(rad * 0.28)), 0, 20, 160, 1.0, max(2, rad // 9))
        crease = cv2.GaussianBlur(crease, (0, 0), 1.2)
        res = res * (1 - 0.45 * crease[..., None])
    im[y0:y1, x0:x1] = np.clip(res, 0, 255).astype(np.uint8)
    return im


for i, amount in enumerate(STEPS):
    n = start + i
    im = frame(n)
    for cx, cy, d in eyes(im):
        im = lid(im, cx, cy, d, amount)
    cv2.imwrite(os.path.join(out, f'p_{i:02d}.png'), im)
    print(n, amount)
