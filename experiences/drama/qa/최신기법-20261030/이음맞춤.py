# 드라마 말하기 영상 시험 — 같은 시작 그림에서 구운 클립들의 화면 위치 · 크기를 기준 첫 화면에 맞춘다(2026-10-30).
# Seedance가 시작 그림을 다시 그리며 화면을 몇 % 키우거나 옮겨, 컷을 이어 붙이면 그 자리에서 움찔한다
# (현장노트 higgsfield 「이어 그린 컷이 앞 컷보다 몇 px·몇 % 어긋나 붙이는 순간 움찔한다」 — 고정 컷은 클립 전체에 같은 변환).
# 첫 화면끼리 ECC 아핀으로 맞추고 그 변환을 클립 전체에 건다. 색 · 밝기는 건드리지 않는다(10-24 결정: 색 후보정 금지).
#   python -X utf8 이음맞춤.py <기준.mp4> <클립.mp4> <나갈.mp4>
#   → 맞추기 전 · 뒤 첫 화면 차, 끝 화면 차를 찍는다. 소리는 그대로 옮긴다.
import json
import subprocess
import sys

import cv2
import numpy as np


def frames(path):
    cap = cv2.VideoCapture(path)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    cap.release()
    return out, fps


def diff(a, b):
    return float(np.abs(a.astype(np.float32) - b.astype(np.float32)).mean())


ref_path, clip_path, dst = sys.argv[1:4]
ref, _ = frames(ref_path)
clip, fps = frames(clip_path)
r0 = ref[0]
h, w = r0.shape[:2]
# 2.0은 496×864, 2.5는 480×854로 나온다 — 기준 크기로 먼저 맞춘다
if clip[0].shape[:2] != (h, w):
    clip = [cv2.resize(f, (w, h), interpolation=cv2.INTER_LANCZOS4) for f in clip]
c0 = clip[0]
g1 = cv2.cvtColor(r0, cv2.COLOR_BGR2GRAY).astype(np.float32)
g2 = cv2.cvtColor(c0, cv2.COLOR_BGR2GRAY).astype(np.float32)
warp = np.eye(2, 3, dtype=np.float32)
crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
_, warp = cv2.findTransformECC(g1, g2, warp, cv2.MOTION_AFFINE, crit, None, 5)
fix = lambda f: cv2.warpAffine(f, warp, (w, h), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
tmp = dst + '.영상만.mp4'
vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))
for f in clip:
    vw.write(fix(f))
vw.release()
# 화질을 지키려고 다시 x264로 굽고, 원래 소리를 그대로 붙인다
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-i', clip_path, '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-crf', '18',
                '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', dst], check=True)
import os
os.remove(tmp)
print(json.dumps({'클립': clip_path, '변환': [[round(float(v), 4) for v in row] for row in warp],
                  '첫화면차_전': round(diff(r0, c0), 2), '첫화면차_후': round(diff(r0, fix(c0)), 2),
                  '끝화면차_후(기준 첫 화면)': round(diff(r0, fix(clip[-1])), 2)}, ensure_ascii=False))
