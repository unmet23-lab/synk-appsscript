"""PULSE 3번 이미지 콘티 — 박마다 바탕 + 블렌더 문 렌더를 얹고, 원본 실측 카메라(롤 · 줌)를 2D로 건 정지 그림 (2026-10-25).

바탕(Gemini 한 판)은 원본 2.0초 프레임(줌 전) 자리에 맞춰 만들었으므로, 원본에서 잰 「2.0초 → t초」 변환을
바탕에 그대로 걸면 그 시각의 화면이 된다. 결과는 git 밖 <밖>/바탕/프레임.
  python 콘티합성.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image, ImageFilter

밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/바탕"
곡선 = json.load(open(os.path.join(밖, "원본_카메라곡선_p3.json"), encoding="utf-8"))
OW, OH = 곡선["size"]  # 원본 720×1280
rows = {r["t"]: r for r in 곡선["rows"] if "scale" in r}

# 박마다 대표 시각 · 바탕 · 문 상태
BEATS = [
    ("b1", 0.0, "F2", "closed"),   # 0.0초: 검은 세단이 지나가는 첫 프레임(롤 −5.6°), 손잡이는 제자리
    ("b1b", 1.5, "F1", "pull"),    # 1.5초: 손잡이가 왼쪽 · 바깥으로 젖혀짐(원본 1.0–2.0초 꼭대기 공 장식 자리)
    ("b2", 2.5, "F1", "seam"),     # 2.5초: 이음매 루비빛
    ("b3", 4.0, "F1", "half"),     # 4.0초: 반쯤 열림, 줌 1.25배
    ("b4", 8.0, "F1", "open"),     # 8.0초: 활짝, 줌 1.87배
    ("b5", 11.5, "F1", "closing"), # 11.5초: 오른쪽 닫힘 · 왼쪽 닫히는 중
    ("b6", 13.5, "F1", "closed"),  # 13.5초: 닫힌 빌딩(손잡이 제자리)
]
판 = os.environ.get("FOOH_VER", "v6")


def plate(name):
    cands = sorted(f for f in os.listdir(os.path.join(밖, "받음")) if f.startswith(name + "_"))
    if not cands:
        return None
    return Image.open(os.path.join(밖, "받음", cands[-1])).convert("RGBA")


def affine(t, W, H):
    r = rows[t]
    s, th = r["scale"], np.radians(r["rot_deg"])
    k = (W / OW + H / OH) / 2
    a, b = s * np.cos(th), s * np.sin(th)
    return np.float32([[a, -b, r["tx"] * k], [b, a, r["ty"] * k]])


def glow(layer, radius=26, gain=1.6):
    """문 렌더에서 밝은 루비빛(이음매 · 안쪽 빛)만 뽑아 번지게(빛 번짐) — 화면 위에 더한다."""
    arr = np.asarray(layer).astype(np.float32) / 255.0
    rgb, a = arr[..., :3], arr[..., 3:4]
    lum = rgb.max(axis=2, keepdims=True)
    mask = np.clip((lum - 0.75) / 0.25, 0, 1) * a
    g = Image.fromarray((np.clip(rgb * mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(g).astype(np.float32) / 255.0 * gain


def main():
    os.makedirs(os.path.join(밖, "프레임"), exist_ok=True)
    base = plate("F1")
    W, H = base.size
    for name, t, pname, state in BEATS:
        pl = plate(pname) or base
        if pl.size != (W, H):
            pl = pl.resize((W, H), Image.LANCZOS)
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
        out = (np.clip(arr, 0, 1) * 255).astype(np.uint8)
        M = affine(t, W, H)
        warped = cv2.warpAffine(out, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        fr = Image.fromarray(warped).resize((1080, 1920), Image.LANCZOS)
        p = os.path.join(밖, "프레임", f"{name}_t{t:05.2f}_{판}.jpg")
        fr.save(p, quality=92)
        print(p, "scale", rows[t]["scale"], "rot", rows[t]["rot_deg"])


main()
