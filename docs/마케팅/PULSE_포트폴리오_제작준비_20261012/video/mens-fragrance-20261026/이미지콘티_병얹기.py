# 2번 이미지 콘티 12번 — Gemini가 그린 「태준이 든 크로마 초록 대역」 자리에 블렌더 병(렌더/hand.png, 투명 바탕)을 얹는다.
# 제품은 AI로 그리지 않는다(AI 광고영상 제작 규칙 원칙). 매진 임박 카드합성 · 8번 합성과 같은 길: 초록을 찾고, 그 자리에 병을 맞춰 얹은 뒤,
# 대역 앞을 가린 손가락(대역 자리 안의 초록 아닌 화소)을 원래 그림에서 되살리고, 가장자리 초록 번짐을 뺀다.
# 2판(10-26 밤, Fable 이미지 콘티 1차 P1-5): 대역은 원본 병처럼 17° 기울었다 — 사각 테두리(bbox)에 맞추면 병이 8%쯤 커지고 기울기가 안 맞아,
# 대역의 최소 외접 사각형(cv2.minAreaRect)의 긴 변 · 기울기에 병의 긴 축(모멘트로 잰 기울기)을 맞춰 돌려 얹는다.
#   python -I -X utf8 이미지콘티_병얹기.py <받은 그림> [나갈 이름=정지컷/S12.png]
import math
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


def tilt(mask):
    """세로로 긴 덩어리의 기울기(도, 윗부분이 화면 오른쪽이면 +)와 긴 축 길이(px)."""
    ys, xs = np.nonzero(mask)
    c = np.cov(np.stack([xs - xs.mean(), ys - ys.mean()]))
    val, vec = np.linalg.eigh(c)
    ax = vec[:, np.argmax(val)]
    if ax[1] > 0:
        ax = -ax                      # 위쪽(화면 y가 작은 쪽)을 가리키게
    ang = math.degrees(math.atan2(ax[0], -ax[1]))
    proj = (xs - xs.mean()) * ax[0] + (ys - ys.mean()) * ax[1]
    return ang, float(proj.max() - proj.min()), (float(xs.mean()), float(ys.mean()))


g_ang, g_len, (gcx, gcy) = tilt(G)
bot = Image.open(os.path.join(P2, "렌더", "hand.png")).convert("RGBA")
bot = bot.crop(bot.getchannel("A").getbbox())
b_ang, b_len, _ = tilt(np.asarray(bot.getchannel("A")) > 128)
# 긴 축을 대역 긴 축 × 1.05에 맞추고(손가락이 가린 끝까지), 기울기 차이만큼 돌린다(PIL rotate는 반시계 + — 윗부분을 오른쪽으로 보내려면 −)
s = g_len * 1.05 / b_len
bot = bot.resize((max(1, int(bot.width * s)), max(1, int(bot.height * s))), Image.LANCZOS)
bot = bot.rotate(-(g_ang - b_ang), resample=Image.BICUBIC, expand=True)
bot = bot.crop(bot.getchannel("A").getbbox())
_, _, (bcx, bcy) = tilt(np.asarray(bot.getchannel("A")) > 128)
px, py = int(round(gcx - bcx)), int(round(gcy - bcy))
# 깨끗한 판: 초록 자리(옅게 초록 기가 도는 가장자리까지 넓힘)를 둘레 색으로 먼저 메운 뒤 그 위에 병을 얹는다 —
# 2판 시험에서 얹은 뒤에 메우니 병 가장자리(반투명)가 초록 위에 섞여 초록 테가 남았다
Gw = (g > 60) & (g > r * 1.15) & (g > b * 1.05)
Gw = cv2.dilate((Gw & cv2.dilate(G.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)).astype(np.uint8) | G.astype(np.uint8),
                np.ones((7, 7), np.uint8))
clean = cv2.inpaint(im.astype(np.uint8), Gw, 9, cv2.INPAINT_TELEA)
layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
layer.paste(bot, (px, py), bot)
comp = Image.alpha_composite(Image.fromarray(clean).convert("RGBA"), layer)
c = np.asarray(comp.convert("RGB")).astype(np.int32)
A = np.asarray(layer.getchannel("A")) > 8
# 손가락 되살리기: 대역 둘레(넓힘) 안에서 초록이 아니고 병이 덮은 화소 = 대역 앞에 있던 것
pad = int(max(w, h) * 0.08)
box = cv2.dilate(G.astype(np.uint8), np.ones((2 * pad + 1, 2 * pad + 1), np.uint8)).astype(bool)
front = box & A & ~Gw.astype(bool)
# 병 바깥 테두리 쪽 바탕(초록 아님 · 손 아님)까지 되살리면 병 가장자리가 잘리므로, 살빛에 가까운 화소만(붉은 기가 파랑보다 큼)
skin = (r > b * 0.9) & (r > 60)
front &= skin
c[front] = im[front]
spill = Gw.astype(bool) & ~A
os.makedirs(os.path.dirname(out), exist_ok=True)
Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).save(out)
print(out, {"대역": [int(x), int(y), int(w), int(h)], "대역기울기": round(g_ang, 1), "병기울기": round(b_ang, 1), "배율": round(s, 3),
            "병": [px, py, bot.width, bot.height], "손가락화소": int(front.sum()), "번짐": int(spill.sum())})
