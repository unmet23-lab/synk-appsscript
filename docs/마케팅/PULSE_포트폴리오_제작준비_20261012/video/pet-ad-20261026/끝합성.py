# 11번 첨벙댕 끝 합성(2026-11-04) — 유호님 「밑에 첨벙댕 이거 써있는게 너무 슬롭같은데 … 모션그래픽이나 cg 트렌디한느낌으로」.
# 레몬 판을 버렸다. 물 판(p11-11x)은 방에 물이 차오르고 조끼 덕에 개가 뜨며 화면이 물 위 · 물속으로 갈린다 — 이 그림이 끝의 힘이다. 브랜드는 물속 아래에 흰 글자로 작게 둔다(모두의코스 · 매진 임박 끝과 같은 결).
# 물에서 솟는 입체(튜브) · 큰 평면 글자는 맹검에서 「처버대 · 싸구려 CG」 · 「기본 자막」으로, 수건에 찍은 남색 글자는 발끝에 가려 「첨멍댕」으로 읽혀 버렸다(판은 git 밖 _튜브글자 · _큰글자). 글자를 AI에 맡기지 않는다(제작 규칙).
#   python -X utf8 끝합성.py <나갈 mp4> --물 <물 판 mp4> [--미리 프레임,프레임…]
# 화면 크기 프레임을 내 최종편집.py가 컷으로 잇는다.
import argparse
import os
import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 24
ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("--물", required=True)
ap.add_argument("--미리", default="")
ap.add_argument("--나타남", type=float, default=1.875)   # 물 판 시작에서 글자가 뜨는 초 — 물이 가라앉아 수건이 보이기 시작할 때, 딩과 같은 자리(시안소리.py)
a = ap.parse_args()

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "..", "..", "..", "브랜드_폰트", "SUIT")
WHITE = np.float32([234, 243, 246]) / 255   # BGR — PAPER
SHADE = np.float32([32, 19, 14]) / 255      # BGR — 아래쪽을 어둡게 까는 색(판이 아니라 그늘)
TOP = 1690      # 글자 위쪽 y. Remotion이 판을 1.8% 당겨 화면에서는 약 1711
K = 3           # 크게 그려 줄인다


def lockup():
    """「첨벙댕」 — 화면 크기 알파. 옆 설명(반려견 구명조끼)은 뺐다: 말과 그림이 이미 하고, 두 줄을 붙이니 쇼핑 썸네일 짜임이었다(11-04 Fable)"""
    big = ImageFont.truetype(os.path.join(FONTS, "SUIT-Heavy.otf"), 150 * K)
    im = Image.new("L", (W * K, 300 * K), 0)
    d = ImageDraw.Draw(im)
    x = 0
    for ch in "첨벙댕":
        d.text((x, 40 * K), ch, font=big, fill=255)
        x += d.textlength(ch, font=big) - 0.02 * 150 * K
    arr = np.array(im.crop(im.getbbox())).astype(np.float32) / 255
    arr = cv2.resize(arr, (arr.shape[1] // K, arr.shape[0] // K), interpolation=cv2.INTER_AREA)
    print("글자 덩이", arr.shape[1], "×", arr.shape[0])
    return arr


LOCK = lockup()
LX = (W - LOCK.shape[1]) // 2
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def read(path):
    # 색 왕복은 zscale로 — 앞 컷(C.cut_video)과 이어 붙이는 자리에서 색이 튀지 않게(폰다시얹기.py와 같은 까닭)
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=lanczos,zscale=matrixin=709:rangein=limited:range=full,format=gbrp", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W, 3)


def frame_at(f, base):
    t = f / FPS
    tau = t - a.나타남
    if tau <= 0:
        return base
    frame = base.astype(np.float32) / 255
    q = 1 - np.exp(-7.0 * tau)   # 흐림이 풀리며 올라온다(결정 10-29 영상 글자 방법)
    g = (np.clip((yy - 1560) / 360, 0, 1) * 0.62 * q)[..., None]
    frame = frame * (1 - g) + SHADE * g
    lay = np.zeros((H, W), np.float32)
    y0 = TOP + int(round((1 - q) * 16))
    h, w = LOCK.shape
    lay[y0:y0 + h, LX:LX + w] = LOCK
    # 물속 일렁임 — 아주 조금
    mx = xx + 2.0 * np.sin(yy / 30.0 + t * 3.1) + 0.9 * np.sin(yy / 11.0 - t * 4.3)
    my = yy + 1.5 * np.sin(xx / 54.0 + t * 2.3)
    lay = cv2.remap(lay, mx, my, cv2.INTER_LINEAR)
    lay = cv2.GaussianBlur(lay, (0, 0), 0.6 + (1 - q) * 5)
    al = (lay * q)[..., None]
    out = frame * (1 - al) + WHITE * al
    return (np.clip(out, 0, 1) * 255).astype(np.uint8)


plate = read(a.물)
print("물 판", len(plate), "장")
if a.미리:
    for f in [int(x) for x in a.미리.split(",")]:
        ok, buf = cv2.imencode(".jpg", frame_at(f, plate[f]), [cv2.IMWRITE_JPEG_QUALITY, 92])
        buf.tofile(a.out.replace(".mp4", f"_{f:03d}.jpg"))
    raise SystemExit
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-vf", "zscale=matrix=709:range=limited:rangein=full,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", a.out], stdin=subprocess.PIPE)
for f in range(len(plate)):
    p.stdin.write(frame_at(f, plate[f]).tobytes())
p.stdin.close()
if p.wait():
    raise SystemExit("ffmpeg 실패")
print("->", a.out)
