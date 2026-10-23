# 「매진 임박」 콘티 v3.1 영상 클립 후반(2026-10-23): Flow에서 받은 Omni 720p 클립(synk-vendor/…/영상/omni/<클립>_<판>.mp4)에
# 정지컷과 같은 손질을 프레임마다 입힌다 — 공포 클립은 색감 「붉은밤」(정지컷_준비_v3와 같은 grade), 거실 와이드(C01a)는 택배 상자 글자 흐리기 + TV에 홈쇼핑 화면,
# 쇼호스트 클립(H1a · H2c · H3d · E2)은 방송 색 그대로. C06은 칼이 들리는 클립이라 거꾸로 돌린 판(C10)도 만든다. 소리는 버린다(가편집 소리를 쓴다).
#   python -X utf8 영상_색감.py [클립id_판 …] [--일꾼 N]   (없으면 omni 폴더 전부) → synk-vendor/…/영상/색감/<클립>_<판>.mp4 (1920×1080 · 24fps · 소리 없음)
#   한 판(96프레임)에 2분쯤 걸려 여러 판은 --일꾼으로 나눠 돌린다(판 하나에 메모리 약 1GB)
import glob
import os
import subprocess
import sys

import numpy as np
from PIL import Image

import 정지컷_준비_v3 as 준비

V = 준비.V
SRC = os.path.join(V, "영상", "omni")
OUT = os.path.join(V, "영상", "색감")
W, H = 1920, 1080
HOST = {"H1a", "H2c", "H3d", "E2"}


def frames(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    a = np.frombuffer(p.stdout, np.uint8)
    return a.reshape(-1, H, W, 3)


def write(path, arr):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "24", "-i", "-",
                          "-c:v", "libx264", "-crf", "15", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", path], stdin=subprocess.PIPE)
    for fr in arr:
        p.stdin.write(fr.tobytes())
    p.stdin.close()
    p.wait()


def one(name):
    clip = name.rsplit("_", 1)[0]
    src = os.path.join(SRC, f"{name}.mp4")
    fs = frames(src)
    out = []
    quad = None
    for fr in fs:
        im = Image.fromarray(fr)
        if clip == "C01a":   # 고정 카메라라 TV 모서리는 첫 프레임에서 한 번 찾아 끝까지 쓴다(프레임마다 찾으면 흔들린다)
            im = 준비.blur_boxes(im)
            quad = quad or 준비.tv_quad(im)
            im = 준비.put_tv(im, q=quad, quiet=True)
        if clip not in HOST:
            im = 준비.색감.grade(im, "붉은밤")
        out.append(np.asarray(im))
    os.makedirs(OUT, exist_ok=True)
    write(os.path.join(OUT, f"{name}.mp4"), out)
    made = [name]
    if clip == "C06":   # 칼이 들리는 클립을 거꾸로 돌려 C10(칼이 내려간다)
        write(os.path.join(OUT, f"C10_{name.rsplit('_', 1)[1]}.mp4"), out[::-1])
        made.append(f"C10_{name.rsplit('_', 1)[1]}")
    print("색감", made, len(out), "프레임")


def main():
    args = sys.argv[1:]
    workers = 1
    if "--일꾼" in args:
        i = args.index("--일꾼")
        workers = int(args[i + 1])
        del args[i:i + 2]
    names = args or sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(SRC, "*.mp4")))
    if workers > 1 and len(names) > 1:
        from concurrent.futures import ProcessPoolExecutor
        with ProcessPoolExecutor(max_workers=workers) as ex:
            list(ex.map(one, names))
    else:
        for n in names:
            one(n)


if __name__ == "__main__":
    main()
