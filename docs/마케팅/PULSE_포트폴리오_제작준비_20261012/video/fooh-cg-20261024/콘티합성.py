"""PULSE 3번 이미지 콘티 — 박마다 바탕 + 블렌더 문 렌더를 얹고, 원본 실측 카메라를 2D로 건 정지 그림과 움직임 시험 (2026-10-25 · 10-27).

바탕(Gemini 한 판)은 원본 2.0초 프레임(줌 전) 자리에 맞춰 만들었으므로, 원본에서 잰 「2.0초 틀 → t초」 닮음 변환을
바탕에 그대로 걸면 그 시각의 화면이 된다. 10-27부터 그 변환은 14_카메라곡선.py의 프레임 곡선(`기준곡선` — 2.0초 프레임에
세 프레임마다 바로 맞춘 닮음 변환이 큰 흐름, 이웃 프레임 사슬이 잔떨림)을 쓴다(01_샷표_원본 2-1절).
첫 1.5초 팬은 2.0초 틀 왼쪽 밖 33% · 아래 8%를 보여 주는데 지금 바탕(F1)은 틀과 같은 크기라, 그 자리는 거울 반사로 채운다
(영상 단계 바탕은 틀의 1.40배로 넓혀 뽑는다 — 02_콘티 1절). 결과는 git 밖 <밖>/바탕/프레임.
  python 콘티합성.py              → 박 정지 그림 b1 … b6(FOOH_VER 판의 문 렌더)
  python 콘티합성.py --움직임      → 14.13초 카메라 움직임 시험(540×960 · 30fps, 박마다 문 상태) 움직임_<판>.mp4
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageFilter

밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/바탕"
곡선파일 = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/원본실측/p3_슈웹스/카메라/곡선.json"
곡선 = json.load(open(곡선파일, encoding="utf-8"))
OW, OH = 곡선["크기"]  # 원본 720×1280
ROWS = 곡선["컷"][0]["기준곡선"]
RT = np.array([r["t"] for r in ROWS])

# 박마다 대표 시각 · 바탕 · 문 상태
BEATS = [
    ("b1", 0.0, "F2", "closed"),   # 0.0초: 검은 세단이 지나가는 첫 프레임(폭 24% 왼쪽 · 8% 아래를 보고 6.5° 기욺), 손잡이는 제자리
    ("b1b", 1.5, "F1", "pull"),    # 1.5초: 손잡이가 왼쪽 · 바깥으로 젖혀짐(원본 1.0–2.0초 꼭대기 공 장식 자리)
    ("b2", 2.5, "F1", "seam"),     # 2.5초: 이음매 루비빛, 줌 1.06배
    ("b3", 4.0, "F1", "half"),     # 4.0초: 반쯤 열림, 줌 1.25배
    ("b4", 8.0, "F1", "open"),     # 8.0초: 활짝, 줌 1.85배
    ("b5", 11.5, "F1", "closing"), # 11.5초: 오른쪽 닫힘 · 왼쪽 닫히는 중
    ("b6", 13.5, "F1", "closed"),  # 13.5초: 닫힌 빌딩(손잡이 제자리)
]
# 움직임 시험의 문 상태(원본 박 — 01_샷표_원본 1절)
STATES = [(0.0, "closed"), (1.0, "pull"), (2.0, "closed"), (2.4, "seam"), (3.0, "half"), (5.5, "open"), (11.0, "closing"),
          (12.0, "seam"), (13.0, "closed")]
판 = os.environ.get("FOOH_VER", "v6")


def plate(name):
    cands = sorted(f for f in os.listdir(os.path.join(밖, "받음")) if f.startswith(name + "_"))
    if not cands:
        return None
    return Image.open(os.path.join(밖, "받음", cands[-1])).convert("RGBA")


def affine(t, W, H, w_out=None, h_out=None):
    """바탕(W×H, 2.0초 틀) → 그 시각 화면(w_out×h_out) 2×3 변환 — 곡선의 원본 px 행렬을 양쪽 크기에 맞춰."""
    i = int(np.argmin(np.abs(RT - t)))
    M = np.vstack([np.array(ROWS[i]["행렬"]), [0, 0, 1]])
    w_out, h_out = w_out or W, h_out or H
    S_in = np.diag([OW / W, OH / H, 1.0])
    S_out = np.diag([w_out / OW, h_out / OH, 1.0])
    return (S_out @ M @ S_in)[:2].astype(np.float32), ROWS[i]


def glow(layer, radius=26, gain=1.6):
    """문 렌더에서 밝은 루비빛(이음매 · 안쪽 빛)만 뽑아 번지게(빛 번짐) — 화면 위에 더한다."""
    arr = np.asarray(layer).astype(np.float32) / 255.0
    rgb, a = arr[..., :3], arr[..., 3:4]
    lum = rgb.max(axis=2, keepdims=True)
    mask = np.clip((lum - 0.75) / 0.25, 0, 1) * a
    g = Image.fromarray((np.clip(rgb * mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(g).astype(np.float32) / 255.0 * gain


def compose(pl, state, W, H):
    img = pl
    extra = None
    if state:
        lay = Image.open(os.path.join(밖, "렌더", f"문_{state}_{판}.png")).convert("RGBA")
        if lay.size != (W, H):
            lay = lay.resize((W, H), Image.LANCZOS)
        img = Image.alpha_composite(pl, lay)
        if state in ("seam", "closing"):
            extra = glow(lay)
    arr = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    if extra is not None:
        arr = 1 - (1 - arr) * (1 - np.clip(extra, 0, 1))  # 스크린 더하기
    return (np.clip(arr, 0, 1) * 255).astype(np.uint8)


def stills():
    os.makedirs(os.path.join(밖, "프레임"), exist_ok=True)
    base = plate("F1")
    W, H = base.size
    for name, t, pname, state in BEATS:
        pl = plate(pname) or base
        if pl.size != (W, H):
            pl = pl.resize((W, H), Image.LANCZOS)
        out = compose(pl, state, W, H)
        M, row = affine(t, W, H)
        warped = cv2.warpAffine(out, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        fr = Image.fromarray(warped).resize((1080, 1920), Image.LANCZOS)
        p = os.path.join(밖, "프레임", f"{name}_t{t:05.2f}_{판}c.jpg")
        fr.save(p, quality=92)
        print(p, "배율", row["배율"], "돎", row["돎"], "옆", row["옆%"], "위아래", row["위아래%"])


def motion(fps=30, w_out=540, h_out=960):
    base = plate("F1")
    W, H = base.size
    cache = {}
    n = int(round(곡선["컷"][0]["길이"] * fps))
    path = os.path.join(밖, "프레임", f"움직임_{판}.mp4")
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w_out}x{h_out}", "-r", str(fps), "-i", "-",
                           "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", path], stdin=subprocess.PIPE)
    for i in range(n):
        t = i / fps
        state = [s for t0, s in STATES if t0 <= t][-1]
        if state not in cache:
            cache[state] = compose(base, state, W, H)
        M, _ = affine(t, W, H, w_out, h_out)
        ff.stdin.write(cv2.warpAffine(cache[state], M, (w_out, h_out), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REFLECT).tobytes())
    ff.stdin.close()
    ff.wait()
    print(path, n, "프레임")


if __name__ == "__main__":
    motion() if "--움직임" in sys.argv else stills()
