# -*- coding: utf-8 -*-
"""v14 재료 손질.
  python prep_v14.py kling <kling.mp4> <원래 입력 길이 초> <결과 폴더> <남길 프레임 수>
      Kling 결과(24fps 720p)를 원래 길이에 맞춰 늘이고 30fps(움직임 보간)·480x854 프레임으로 뽑는다.
  python prep_v14.py deglow <걷는컷.mp4> <결과.mp4> [남길 비율=0.2]
      켜진 안경 테두리의 강한 파란 빛을 줄여 은은한 빛만 남긴다(얼굴 위쪽 띠에서만).
"""
import os, subprocess, sys
import cv2, numpy as np

mode = sys.argv[1]
if mode == "kling":
    src, in_dur, out, keep = sys.argv[2], float(sys.argv[3]), sys.argv[4], int(sys.argv[5])
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                               capture_output=True, text=True).stdout.strip())
    k = in_dur / dur
    vf = "setpts=PTS*%.5f,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=480:854:flags=lanczos" % k
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-frames:v", str(keep), out + "/f_%04d.png"], check=True)
    print(src, "dur", round(dur, 3), "-> stretch", round(k, 4), "frames", len(os.listdir(out)))
elif mode == "deglow":
    src, dst = sys.argv[2], sys.argv[3]
    keep = float(sys.argv[4]) if len(sys.argv) > 4 else 0.2
    tmp = dst + "_frames"
    os.makedirs(tmp, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "fps=30", tmp + "/f_%04d.png"], check=True)
    fs = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
    changed = 0
    for f in fs:
        p = os.path.join(tmp, f)
        im = cv2.imread(p).astype(np.float32)
        H, W = im.shape[:2]
        hsv = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        m = ((hsv[..., 0] > 92) & (hsv[..., 0] < 132) & (hsv[..., 1] > 70) & (hsv[..., 2] > 90)).astype(np.float32)
        band = np.zeros_like(m)
        band[int(H * 0.04):int(H * 0.30), int(W * 0.15):int(W * 0.85)] = 1
        m = cv2.GaussianBlur(cv2.dilate(m * band, np.ones((3, 3), np.uint8)), (0, 0), 1.2)
        if m.max() < 0.05:
            continue
        lum = (0.114 * im[..., 0] + 0.587 * im[..., 1] + 0.299 * im[..., 2])[..., None]
        dark = np.concatenate([lum * 0.22 + 18, lum * 0.20 + 14, lum * 0.18 + 12], axis=2)   # 검은 테 색(BGR)
        tgt = dark * (1 - keep) + im * keep
        out = im * (1 - m[..., None]) + tgt * m[..., None]
        cv2.imwrite(p, out.clip(0, 255).astype(np.uint8))
        changed += 1
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", tmp + "/f_%04d.png", "-i", src, "-map", "0:v", "-map", "1:a?",
                    "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", dst], check=True)
    print("deglow frames changed", changed, "of", len(fs))
