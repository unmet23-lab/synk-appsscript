"""
「제2의 나」 인물 참고 결 시안 (2026-11-02) — 고른 판을 한 장으로 모아 본다.
묶음마다 위 줄은 판 전체, 아래 줄은 같은 판의 얼굴을 얼굴 너비의 1.3배 네모로 잘라 같은 크기로 맞춰 결(모공 · 노이즈 · 빛)을 견준다
(엔진마다 판 크기가 달라 — GPT 1086×1448 · 나노바나나 1792×2400 — 원본 1:1로 자르면 큰 판이 더 가까이 보인다).
얼굴 자리는 YuNet으로 찾고(찾지 못하면 위 가운데), 묶음 · 칸은 JSON 하나로 받는다.

    python -I -X utf8 모아보기.py <묶음.json> <낼.jpg>

묶음.json = [{"제목": "권태오", "칸": [{"이름": "승인 원천", "파일": "…png", "글": "닮음 0.91", "얼굴": 0}]}, …]
「얼굴」은 그 판에서 몇 번째로 큰 얼굴을 자를지(셀카의 태오처럼 둘 중 하나를 고를 때, 기본 0) 또는 "오른쪽" · "왼쪽".
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
글꼴 = lambda n: ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", n)
칸폭, 판높이, 얼굴칸 = 330, 440, 330


def 얼굴상자(p, 고름):
    img = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    if faces is None:
        return None
    fs = [f for f in faces if f[14] >= 0.8 and f[2] >= 0.08 * w] or list(faces)
    if 고름 == "오른쪽":
        f = max(fs, key=lambda f: f[0])
    elif 고름 == "왼쪽":
        f = min(fs, key=lambda f: f[0])
    else:
        f = sorted(fs, key=lambda f: -f[2] * f[3])[min(int(고름 or 0), len(fs) - 1)]
    return [float(v) for v in f[:4]]


def 칸그림(c):
    im = Image.open(c["파일"]).convert("RGB")
    판 = im.copy()
    판.thumbnail((칸폭 - 10, 판높이))
    상자 = 얼굴상자(c["파일"], c.get("얼굴", 0))
    if 상자:
        x, y, w, h = 상자
        cx, cy = x + w / 2, y + h / 2
        반 = w * 1.3 / 2  # 얼굴 너비에 맞춰 자르고 같은 크기로 — 엔진마다 판 크기가 달라도 같은 얼굴 크기로 견준다
    else:
        cx, cy = im.width / 2, im.height * 0.3
        반 = 얼굴칸 / 2
    얼 = im.crop((int(cx - 반), int(cy - 반), int(cx + 반), int(cy + 반))).resize((얼굴칸, 얼굴칸), Image.LANCZOS)
    return 판, 얼


묶음 = json.load(open(sys.argv[1], encoding="utf-8"))
줄들 = []
for 묶 in 묶음:
    n = len(묶["칸"])
    폭 = max(n * 칸폭, int(ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(묶["제목"], font=글꼴(26))) + 24)
    높 = 56 + 판높이 + 40 + 얼굴칸 + 20
    판 = Image.new("RGB", (폭, 높), (24, 24, 26))
    d = ImageDraw.Draw(판)
    d.text((12, 12), 묶["제목"], fill=(240, 240, 240), font=글꼴(26))
    for i, c in enumerate(묶["칸"]):
        x0 = (폭 - n * 칸폭) // 2 + i * 칸폭
        전체, 얼 = 칸그림(c)
        판.paste(전체, (x0 + (칸폭 - 전체.width) // 2, 56 + (판높이 - 전체.height)))
        d.text((x0 + 8, 56 + 판높이 + 6), c["이름"] + ("  " + c["글"] if c.get("글") else ""), fill=(250, 210, 120), font=글꼴(17))
        판.paste(얼, (x0 + (칸폭 - 얼.width) // 2, 56 + 판높이 + 40))
    줄들.append(판)
W = max(p.width for p in 줄들)
H = sum(p.height for p in 줄들) + 10 * (len(줄들) - 1)
out = Image.new("RGB", (W, H), (12, 12, 14))
y = 0
for p in 줄들:
    out.paste(p, ((W - p.width) // 2, y))
    y += p.height + 10
out.save(sys.argv[2], quality=90)
print(sys.argv[2], out.size)
