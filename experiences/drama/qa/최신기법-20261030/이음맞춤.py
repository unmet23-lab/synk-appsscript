# 드라마 말하기 영상 시험 — 같은 시작 그림에서 구운 클립들의 화면 위치 · 크기를 기준 첫 화면에 맞춘다(2026-10-30).
# Seedance가 시작 그림을 다시 그리며 화면을 몇 % 키우거나 옮겨, 컷을 이어 붙이면 그 자리에서 움찔한다
# (현장노트 higgsfield 「이어 그린 컷이 앞 컷보다 몇 px·몇 % 어긋나 붙이는 순간 움찔한다」 — 고정 컷은 클립 전체에 같은 변환).
# 첫 화면끼리 ECC 아핀으로 맞추고 그 변환을 클립 전체에 건다. 색 · 밝기는 건드리지 않는다(10-24 결정: 색 후보정 금지).
# 1판은 mp4v 중간 파일 + 선형 보간이라 얼굴 선명도(라플라시안 분산)가 177 → 122로 깎였다(10-30 Fable) →
# 맞춘 프레임을 날 픽셀로 ffmpeg에 바로 넘겨 한 번만 인코딩하고(crf 14), 보간은 Lanczos로 한다. 찍는 수치는 다 쓴 파일에서 다시 잰다.
#   python -X utf8 이음맞춤.py <기준.mp4> <클립.mp4> <나갈.mp4>
#   → 맞추기 전 · 뒤 첫 화면 차, 끝 화면 차, 얼굴 선명도(원본 · 결과)를 찍는다. 소리는 그대로 옮긴다.
import json
import os
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


def sharp(fs, box):
    x, y, w, h = box
    return float(np.mean([cv2.Laplacian(cv2.cvtColor(f[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() for f in fs]))


ref_path, clip_path, dst = sys.argv[1:4]
ref, _ = frames(ref_path)
clip0, fps = frames(clip_path)
r0 = ref[0]
h, w = r0.shape[:2]
# 2.0은 496×864, 2.5는 480×854로 나온다 — 기준 크기로 먼저 맞춘다
clip = [cv2.resize(f, (w, h), interpolation=cv2.INTER_LANCZOS4) for f in clip0] if clip0[0].shape[:2] != (h, w) else clip0
c0 = clip[0]
g1 = cv2.cvtColor(r0, cv2.COLOR_BGR2GRAY).astype(np.float32)
g2 = cv2.cvtColor(c0, cv2.COLOR_BGR2GRAY).astype(np.float32)
warp = np.eye(2, 3, dtype=np.float32)
crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
_, warp = cv2.findTransformECC(g1, g2, warp, cv2.MOTION_AFFINE, crit, None, 5)
fix = lambda f: cv2.warpAffine(f, warp, (w, h), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
enc = subprocess.Popen(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}', '-r', f'{fps:.6f}', '-i', '-',
                        '-i', clip_path, '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                        '-c:a', 'copy', '-movflags', '+faststart', '-shortest', dst], stdin=subprocess.PIPE)
for f in clip:
    enc.stdin.write(fix(f).tobytes())
enc.stdin.close()
if enc.wait() != 0:
    raise SystemExit('ffmpeg 인코딩 실패')
out, _ = frames(dst)
# 얼굴 상자(기준 첫 화면에서 YuNet)로 선명도를 잰다
M = os.path.join(os.environ['USERPROFILE'], '.rembg', 'models', 'yunet', 'face_detection_yunet_2023mar.onnx')
fd = cv2.FaceDetectorYN.create(M, '', (w, h), 0.55, 0.3, 50)
det = fd.detect(r0)[1]
box = [int(v) for v in max(det, key=lambda b: b[2])[:4]] if det is not None else [0, 0, w, h]
sx, sy = clip0[0].shape[1] / w, clip0[0].shape[0] / h
box0 = [int(box[0] * sx), int(box[1] * sy), int(box[2] * sx), int(box[3] * sy)]
print(json.dumps({'클립': clip_path, '변환': [[round(float(v), 4) for v in row] for row in warp],
                  '첫화면차_전': round(diff(r0, c0), 2), '첫화면차_결과파일': round(diff(r0, out[0]), 2),
                  '끝화면차_결과파일': round(diff(r0, out[-1]), 2), '프레임': [len(clip0), len(out)],
                  '얼굴선명도_원본': round(sharp(clip0, box0), 1), '얼굴선명도_결과': round(sharp(out, box), 1),
                  '기준얼굴선명도': round(sharp(ref, box), 1)}, ensure_ascii=False))
