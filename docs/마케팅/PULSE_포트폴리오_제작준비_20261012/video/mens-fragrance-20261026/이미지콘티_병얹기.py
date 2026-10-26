# 2번 이미지 콘티 12번 — Gemini가 그린 「태준이 든 크로마 초록 대역」 자리에 블렌더 병(렌더/hand.png, 투명 바탕)을 얹는다.
# 제품은 AI로 그리지 않는다(AI 광고영상 제작 규칙 원칙). 매진 임박 카드합성 · 8번 합성과 같은 길: 초록을 찾고, 그 상자에 병을 맞춰 얹은 뒤,
# 대역 앞을 가린 손가락(상자 안의 초록 아닌 화소)을 원래 그림에서 되살리고, 가장자리 초록 번짐을 뺀다.
#   python -I -X utf8 이미지콘티_병얹기.py <받은 그림> [나갈 이름=정지컷/S12.png]
import os
import sys

import cv2
import numpy as np
from PIL import Image

P2 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p2")
src = sys.argv[1]
out = os.path.join(P2, sys.argv[2] if len(sys.argv) > 2 else os.path.join("정지컷", "S12.png"))
im = np.asarray(Image.open(src).convert("RGB")).astype(np.int32)
H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
G = (g > 80) & (g > r * 1.35) & (g > b * 1.35)
G = cv2.morphologyEx(G.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
n, lab, st, _ = cv2.connectedComponentsWithStats(G.astype(np.uint8))
if n < 2:
    raise SystemExit("초록 대역을 못 찾음")
k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
G = lab == k
x, y, w, h = st[k, :4]
# 대역 상자를 조금 넓혀(손가락이 가린 쪽까지) 병을 그 높이에 맞춘다 — 병 실루엣 높이 = 대역 높이 × 1.05
bot = Image.open(os.path.join(P2, "렌더", "hand.png")).convert("RGBA")
bx0, by0, bx1, by1 = bot.getchannel("A").getbbox()
bot = bot.crop((bx0, by0, bx1, by1))
s = h * 1.05 / bot.height
bot = bot.resize((max(1, int(bot.width * s)), max(1, int(bot.height * s))), Image.LANCZOS)
cx, cy = x + w / 2, y + h / 2
px, py = int(round(cx - bot.width / 2)), int(round(cy - bot.height / 2))
base = Image.fromarray(im.astype(np.uint8)).convert("RGBA")
layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
layer.paste(bot, (px, py), bot)
comp = Image.alpha_composite(base, layer)
c = np.asarray(comp.convert("RGB")).astype(np.int32)
A = np.asarray(layer.getchannel("A")) > 8
# 손가락 되살리기: 대역 상자(넓힘) 안에서 초록이 아니고 병이 덮은 화소 = 대역 앞에 있던 것
box = np.zeros((H, W), bool)
pad = int(max(w, h) * 0.08)
box[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad] = True
front = box & A & ~cv2.dilate(G.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
# 병 바깥 테두리 쪽 바탕(초록 아님 · 손 아님)까지 되살리면 병 가장자리가 잘리므로, 살빛에 가까운 화소만(붉은 기가 파랑보다 큼)
skin = (r > b * 0.9) & (r > 60)
front &= skin
c[front] = im[front]
# 남은 초록 번짐(병이 덮지 못한 대역 가장자리) — 초록을 파랑 바탕 쪽으로 눌러 지운다
spill = G & ~A
c[spill] = np.stack([c[spill][:, 0], np.minimum(c[spill][:, 1], c[spill][:, 2]), c[spill][:, 2]], 1)
os.makedirs(os.path.dirname(out), exist_ok=True)
Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).save(out)
print(out, {"대역": [int(x), int(y), int(w), int(h)], "병": [px, py, bot.width, bot.height], "손가락화소": int(front.sum()), "번짐": int(spill.sum())})
