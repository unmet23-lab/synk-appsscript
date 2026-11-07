# 8번 최종본 검수 재료(2026-11-07, Claude) — 원본(네이버 탐색 30초)과 우리 판을 같은 초에 나란히 찍어 맹검 · 끝 3초 대조에 쓴다(git 밖).
#   python -X utf8 나란히.py <우리 판.mp4> [밖 폴더]   → 나란히_1..N.jpg(0.5초마다 원본 | 우리, 한 장에 여섯 줄) · 끝3초.jpg(27.0~30.0초 0.25초마다) · 우리만_반초.jpg
import os
import subprocess
import sys

import cv2
import numpy as np

ORG = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/원본영상/4Kn4fT3z15s/4Kn4fT3z15s.mp4"


def frames(path, w):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps=4,scale={w}:-2", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True)
    h = int(round(w * 9 / 16 / 2) * 2)
    n = len(r.stdout) // (w * h * 3)
    return np.frombuffer(r.stdout, np.uint8)[:n * w * h * 3].reshape(n, h, w, 3)


def lab(im, s, c=(0, 255, 255)):
    im = im.copy()
    cv2.putText(im, s, (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 4)
    cv2.putText(im, s, (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.75, c, 2)
    return im


def main():
    ours, out = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(sys.argv[1]), "_검수"))
    os.makedirs(out, exist_ok=True)
    W = 640
    o, u = frames(ORG, W), frames(ours, W)
    rows = []
    for k in range(0, min(len(o), len(u)), 2):   # 0.5초마다
        t = k / 4
        rows.append(np.hstack([lab(o[k], f"ORG {t:.1f}s"), np.zeros((o.shape[1], 10, 3), np.uint8), lab(u[k], f"OURS {t:.1f}s", (255, 220, 0))]))
    for i in range(0, len(rows), 6):
        cv2.imencode(".jpg", np.vstack(rows[i:i + 6]), [cv2.IMWRITE_JPEG_QUALITY, 82])[1].tofile(os.path.join(out, f"나란히_{i // 6 + 1}.jpg"))
    end = []
    for k in range(108, min(len(o), len(u))):     # 27.0초부터 0.25초마다
        t = k / 4
        end.append(np.hstack([lab(o[k], f"ORG {t:.2f}"), np.zeros((o.shape[1], 10, 3), np.uint8), lab(u[k], f"OURS {t:.2f}", (255, 220, 0))]))
    cv2.imencode(".jpg", np.vstack(end), [cv2.IMWRITE_JPEG_QUALITY, 82])[1].tofile(os.path.join(out, "끝3초.jpg"))
    small = [cv2.resize(lab(u[k], f"{k / 4:.1f}", (255, 220, 0)), (320, 180)) for k in range(0, len(u), 2)]
    while len(small) % 10:
        small.append(np.zeros_like(small[0]))
    cv2.imencode(".jpg", np.vstack([np.hstack(small[i:i + 10]) for i in range(0, len(small), 10)]), [cv2.IMWRITE_JPEG_QUALITY, 82])[1].tofile(os.path.join(out, "우리만_반초.jpg"))
    print(out, len(rows), "줄")


if __name__ == "__main__":
    main()
