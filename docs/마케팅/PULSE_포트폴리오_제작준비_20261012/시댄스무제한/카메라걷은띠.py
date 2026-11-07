# 컷 안 장마다 카메라 움직임을 배경 상자로 걷어 내고(ECC 아핀 — 첫 장에 맞춤) 사람 상자만 잘라 2장(1/12초) 간격 띠로 + 사람 상자 안 남는 흐름을 잰다
# (2026-11-08, Claude · 10번 도담중공업). 검수자(아르곤 1초 간격 · Fable 1/6초 띠)가 「굳었다」 · 「살아 있다」로 갈릴 때 장마다 눈으로 가른다:
#   배경(작업대 · 기둥 · 굴뚝)이 띠 안에서 제자리에 서 있으면 맞춤이 된 것이고, 그 위에서 사람 윤곽 · 고개 · 팔이 바뀌면 살아 있다.
#   11-08 이 띠로 아르곤 「굳음」 셋(8 고개 돌림 · 23 손 · 24 22px 걸음)이 틀렸고, Fable 「굳음」 둘(10 뻗은 팔 · 31 고정 얼굴)이 맞았다.
#   남는 흐름 숫자는 사람이 배경과 깊이가 다르면 시차로도 곧게 커진다(카메라가 다가가거나 기울 때) — 곧게만 커지면 띠를 보고, 오르내리면 동작이다.
#   python -X utf8 카메라걷은띠.py <mp4> <시작초> <끝초> <출력.jpg> 사람 x0 y0 x1 y1 배경 x0 y0 x1 y1 [배경2 x0 y0 x1 y1]
#   상자는 그림(위아래 60px 띠를 뺀 1920×960) 비율. 위아래 띠가 없는 영상은 BAR = 0으로.
import subprocess
import sys

import cv2
import numpy as np

BAR = 60
src, a, b, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
v = [float(x) for x in sys.argv[6:10]]
bgs = [[float(x) for x in sys.argv[11:15]]]
if len(sys.argv) >= 20:
    bgs.append([float(x) for x in sys.argv[16:20]])
W, H = 640, 320
crop = f"crop=iw:ih-{2 * BAR}:0:{BAR}," if BAR else ""
raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-i", src, "-t", f"{b - a:.3f}", "-vf", f"{crop}scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                     capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
g = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in fr]
box = lambda r: (int(r[0] * W), int(r[1] * H), int(r[2] * W), int(r[3] * H))
mask = np.zeros((H, W), np.uint8)
for r in bgs:
    x0, y0, x1, y1 = box(r)
    mask[y0:y1, x0:x1] = 255
px0, py0, px1, py1 = box(v)
ref = g[0].astype(np.float32)
tiles, rows = [], []
M = np.eye(2, 3, dtype=np.float32)
for i, cur in enumerate(g):
    if i:
        try:
            _, M = cv2.findTransformECC(ref, cur.astype(np.float32), M, cv2.MOTION_AFFINE,
                                        (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), mask, 5)
        except cv2.error:
            pass
    al = cv2.warpAffine(cur, M, (W, H), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP)
    alc = cv2.warpAffine(fr[i], M, (W, H), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP)
    fl = cv2.calcOpticalFlowFarneback(g[0], al, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    mag = np.linalg.norm(fl, axis=2)
    rows.append((i, float(np.percentile(mag[py0:py1, px0:px1], 90)), float(np.percentile(mag[mask > 0], 90)), float(M[0, 2]), float(M[1, 2])))
    if i % 2 == 0:
        t = alc[py0:py1, px0:px1].copy()
        t = cv2.resize(t, (280, int(280 * t.shape[0] / max(1, t.shape[1]))))
        cv2.putText(t, f"{i}", (5, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
        tiles.append(t)
cols = 6
blank = np.zeros_like(tiles[0])
grid = [np.hstack(tiles[r:r + cols] + [blank] * (cols - len(tiles[r:r + cols]))) for r in range(0, len(tiles), cols)]
open(out, "wb").write(cv2.imencode(".jpg", np.vstack(grid), [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tobytes())   # 한글 경로 — cv2.imwrite는 조용히 실패
print(f"{a:.2f}–{b:.2f}초 {len(g)}장 · 카메라 끝 이동 x {rows[-1][3]:+.1f} y {rows[-1][4]:+.1f}px(640폭)")
print("장 · 사람 남는 흐름 90% · 배경 90%:", " ".join(f"{i}:{p:.1f}/{q:.1f}" for i, p, q, _, _ in rows[::2]))
print(f"사람 최대 {max(r[1] for r in rows):.1f} · 배경 최대 {max(r[2] for r in rows):.1f}")
