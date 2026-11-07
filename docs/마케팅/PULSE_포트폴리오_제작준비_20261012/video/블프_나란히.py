# 블프 두 편 검수 재료(2026-11-07) — 원본 광고와 우리 판을 같은 초에 나란히 놓은 장면 판, 끝 3초 촘촘한 판.
#   python -X utf8 블프_나란히.py <s3|s3-6|s4> <우리 판.mp4> <밖 폴더>   → 나란히_<k>.jpg · 끝3초.jpg
import os
import subprocess
import sys

import cv2
import numpy as np

ORIG = {
    "s3": ("C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/레퍼런스/bf-sale/원본영상/hq_ok2oKFiu-fs/hq_ok2oKFiu-fs_h264.mp4", 0.0),
    "s3-6": (None, 0.0),
    "s4": ("C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/레퍼런스/bf-sniper/원본영상/vm_74699350/vm_74699350_h264.mp4", 0.0),
}


def grab(path, t, h):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, t):.3f}", "-i", path, "-frames:v", "1", "-vf", f"scale=-2:{h}", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    img = cv2.imdecode(np.frombuffer(r.stdout, np.uint8), cv2.IMREAD_COLOR)
    return img


def label(img, s):
    img = img.copy()
    cv2.putText(img, s, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (0, 0, 0), 4)
    cv2.putText(img, s, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 1)
    return img


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout.strip())


def main():
    kind, ours, out = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    orig, off = ORIG[kind]
    D = dur(ours)
    portrait = kind.startswith("s3")
    h = 360 if portrait else 240
    step = 0.5 if kind == "s3" else (0.4 if kind == "s3-6" else 1.0)
    ts = list(np.arange(0.2, D - 0.05, step))
    per = 8 if portrait else 4
    Do0 = dur(orig) if orig else 0
    pages = []
    for k in range(0, len(ts), per):
        cols = []
        for t in ts[k:k + per]:
            a = label(grab(ours, t, h), f"ours {t:.1f}")
            if orig:
                # 우리 판이 원본보다 길면(11-07 스나이퍼 33.46 ↔ 32.15초) 원본이 끝난 뒤 칸은 검게 비운다
                b = label(grab(orig, t + off, h), f"orig {t:.1f}") if t + off < Do0 - 0.05 else label(np.zeros_like(a), "orig (끝남)")
                if b.shape[1] != a.shape[1]:
                    b = cv2.resize(b, (a.shape[1], a.shape[0]))
                cols.append(np.vstack([b, a]) if portrait else np.hstack([b, a]))
            else:
                cols.append(a)
        pages.append(np.hstack(cols) if portrait else np.vstack(cols))
    for i, p in enumerate(pages, 1):
        cv2.imencode(".jpg", p, [cv2.IMWRITE_JPEG_QUALITY, 86])[1].tofile(os.path.join(out, f"나란히_{i}.jpg"))
    # 끝 3초 — 0.25초마다
    te = list(np.arange(D - 3.0, D - 0.02, 0.25))
    row_o = [label(grab(ours, t, h), f"ours {t:.2f}") for t in te]
    rows = [np.hstack(row_o[:6]), np.hstack(row_o[6:12])] if portrait else [np.hstack(row_o[:4]), np.hstack(row_o[4:8]), np.hstack(row_o[8:12])]
    if orig:
        Do = dur(orig)
        row_g = [label(grab(orig, Do - (D - t), h), f"orig {Do - (D - t):.2f}") for t in te]
        if row_g[0].shape != row_o[0].shape:
            row_g = [cv2.resize(g, (row_o[0].shape[1], row_o[0].shape[0])) for g in row_g]
        rows = ([np.hstack(row_g[:6]), np.hstack(row_o[:6]), np.hstack(row_g[6:12]), np.hstack(row_o[6:12])] if portrait else
                [np.hstack(row_g[:4]), np.hstack(row_o[:4]), np.hstack(row_g[4:8]), np.hstack(row_o[4:8]), np.hstack(row_g[8:12]), np.hstack(row_o[8:12])])
    w = max(r.shape[1] for r in rows)
    rows = [np.hstack([r, np.zeros((r.shape[0], w - r.shape[1], 3), np.uint8)]) if r.shape[1] < w else r for r in rows]
    cv2.imencode(".jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 86])[1].tofile(os.path.join(out, "끝3초.jpg"))
    print(out, len(pages), "장 + 끝3초")


if __name__ == "__main__":
    main()
