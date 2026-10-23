# 「매진 임박」 Omni 클립 고르기 판(2026-10-23): 클립마다 두 판(a · b)을 0 · 1 · 2 · 3 · 3.8초 다섯 장씩 두 줄로 놓고,
# 프레임 차가 중앙값의 세 배를 넘는 자리(4초 안의 컷 바뀜 — 현장노트 「Omni가 4초 안에서 다른 구도로 컷을 바꿨다」)를 적는다.
#   python -X utf8 영상_고르기판.py [클립id …]   → synk-vendor/…/영상/고르기/<클립>.jpg + 표준 출력에 튐 자리
import glob
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
SRC = os.path.join(V, "영상", "omni")
OUT = os.path.join(V, "영상", "고르기")
TS = [0.0, 1.0, 2.0, 3.0, 3.8]
FB = "C:/Windows/Fonts/malgunbd.ttf"


def grab(path, t, w=384):
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1", "-vf", f"scale={w}:-2", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True)
    from io import BytesIO
    return Image.open(BytesIO(p.stdout)).convert("RGB")


def jumps(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=160:90,format=gray", "-f", "rawvideo", "-"], capture_output=True, check=True)
    a = np.frombuffer(p.stdout, np.uint8).reshape(-1, 90, 160).astype(np.float32)
    d = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
    med = float(np.median(d)) or 0.01
    return [(round((i + 1) / 24, 2), round(float(x), 1)) for i, x in enumerate(d) if x > med * 3 and x > 4], round(med, 2)


def sheet(clip):
    takes = sorted(glob.glob(os.path.join(SRC, f"{clip}_*.mp4")))
    if not takes:
        print(clip, "받은 판 없음")
        return
    rows = []
    for t in takes:
        ims = [grab(t, s) for s in TS]
        j, med = jumps(t)
        rows.append((os.path.basename(t), ims, j, med))
    w, h = rows[0][1][0].size
    board = Image.new("RGB", (w * len(TS), (h + 30) * len(rows)), (16, 16, 18))
    d = ImageDraw.Draw(board)
    font = ImageFont.truetype(FB, 18)
    for r, (name, ims, j, med) in enumerate(rows):
        y = r * (h + 30)
        d.text((6, y + 5), f"{name} · 튐 {j if j else '없음'} (중앙 {med})", font=font, fill=(240, 120, 120) if j else (220, 220, 220))
        for k, im in enumerate(ims):
            board.paste(im, (k * w, y + 30))
        print(name, "튐", j or "없음", "중앙", med)
    os.makedirs(OUT, exist_ok=True)
    board.save(os.path.join(OUT, f"{clip}.jpg"), quality=88)


def main():
    clips = sys.argv[1:] or sorted({os.path.basename(p).rsplit("_", 1)[0] for p in glob.glob(os.path.join(SRC, "*.mp4"))})
    for c in clips:
        sheet(c)


if __name__ == "__main__":
    main()
