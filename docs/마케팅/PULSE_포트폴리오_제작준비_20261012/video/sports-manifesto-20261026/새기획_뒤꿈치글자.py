# ※ 옛 판(글꼴로 친 글자) — 지금 길은 새기획_뒤꿈치글자_시안.py(글 콘티 9절). 기록으로 둔다.
# 5번 새 기획(11-05) N10 뒤꿈치 로고 — 글자를 지운 판(N10p)에 영문 「GAPPEUM」을 설계도 D00처럼 회색 프린트로 얹는다(곱하기 — 잉크가 니트 올 위에 앉아 결이 비친다).
# 11-05 밤 유호님 「신발 로고도 영어로 바꿔줘」 — 한글 「가쁨」 판은 git 밖 정지컷/_한글판_20261105/에 남겼다.
# 생성 모델이 「가」의 ㅏ 가로획을 세 번 빠뜨려(1~3차, git 밖 정지컷/_1차/) 글자는 처음부터 합성으로 얹는 길이고, 눌린(데보스) 모양 합성은 니트 결에 묻혀 긁힌 자국처럼 보여 버렸다.
# 영상 단계에서는 영상 모델이 글자를 다시 그리므로 프레임마다 다시 얹는다(제작 규칙). 원본 그림 · 결과는 git 밖.
#   python -X utf8 새기획_뒤꿈치글자.py
import os
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/정지컷")
# 니트 결을 설계도와 맞춘 글자 자리 빈 판(N10p)에, 설계도 D00처럼 연회색으로 찍는다. 호박빛 띠 아래 · 미드솔 위의 니트 칸에 다 들어가게(9:16으로 자르면 양옆 10.6%씩 빠진다).
BASE, TEXT, CX, CY, SIZE, TRACK, ROT, TINT = "N10p.png", "GAPPEUM", 0.675, 0.500, 0.066, 0.05, 7, (0.50, 0.52, 0.56)
FONT = Path(os.environ["USERPROFILE"]) / "Documents/SYNK-appsscript/docs/브랜드_폰트/InterTight/InterTight-Bold.ttf"
base = np.asarray(Image.open(V / BASE).convert("RGB")).astype(np.float32)
H, W = base.shape[:2]
mask = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(mask)
f = ImageFont.truetype(str(FONT), int(W * SIZE))
gap = f.size * TRACK
tw = sum(d.textlength(ch, font=f) for ch in TEXT) + gap * (len(TEXT) - 1)
cx, cy = W * CX, H * CY
x = cx - tw / 2
for ch in TEXT:   # 글자 사이를 조금 벌린 대문자 — 러닝화 뒤꿈치 프린트의 흔한 꼴
    d.text((x, cy - f.size * 0.62), ch, font=f, fill=255); x += d.textlength(ch, font=f) + gap
m = np.asarray(mask).astype(np.float32) / 255
# 표면 기울기: 니트 면이 오른쪽 위로 조금 들려 있어 글자도 돌리고 세로를 조금 눌러 원근을 준다
M = cv2.getRotationMatrix2D((cx, cy), ROT, 1.0)
M[1] *= 0.94
M[1, 2] += cy * 0.06
m = cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_LINEAR)
m = cv2.GaussianBlur(m, (0, 0), 0.5)
# 회색 열전사 프린트: 영문 대문자는 획이 가늘어 니트 구멍에 끊겨 읽히지 않았다(「SAPPEUM」처럼) → 잉크가 구멍을 메우는 불투명 프린트로.
# 잉크 밝기 = 그 자리 니트의 큰 빛(흐린 밝기) × 회색 비율 — 같은 빛을 받아 그늘을 따르고, 니트 결은 아주 옅게만 비친다.
# (고정 회색으로 얹으면 그늘진 니트보다 밝게 떠 스티커처럼 보였다 · 곱하기만 하면 구멍이 비쳐 글자가 끊겼다)
lum = base.mean(2)
low = cv2.GaussianBlur(lum, (0, 0), 7)
relief = (lum - low) * 0.18                                   # 니트 결은 18%만 남긴다
tint = np.array(TINT, np.float32)
ink = (low[..., None] * tint[None, None, :] / max(1e-3, float(np.mean(TINT))) * np.mean(TINT) + relief[..., None])
a = 0.95 * m[..., None]
out = np.clip(base * (1 - a) + ink * a, 0, 255).astype(np.uint8)
Image.fromarray(out).save(V / "N10.png")
z = Image.fromarray(out).crop((int(W * 0.28), int(H * 0.34), int(W * 0.92), int(H * 0.58)))
z.save(V / "_1차" / "N10_합성_확대.png")
print("ok", W, H)

# 설계도 D00의 뒤꿈치 글자도 영문으로(모든 시작 그림 · 영상 지시에 참고로 넣는 그림이라 한글이 남으면 모델이 한글을 다시 그린다).
# 한글 「가쁨」 자리(1672×941 판의 x 1186~1231 · y 523~551)를 바로 왼쪽 니트로 메우고 같은 회색 열전사로 작게 찍는다(뒤꿈치 가장자리 안에). 한글판은 _한글판_20261105/.
src = V / "_한글판_20261105" / "D00_신발설계도.png"
if src.exists():
    dz = np.asarray(Image.open(src).convert("RGB")).copy()
    x0, y0, x1, y1 = 1186, 523, 1231, 551
    # 메우기는 바로 왼쪽 니트를 그대로 옮겨 붙인다(inpaint는 흐린 네모가 남았다) — 가장자리는 부드럽게 섞는다
    sh = 46
    fill = dz.copy(); fill[y0 - 6:y1 + 6, x0 - 6:x1 + 6] = dz[y0 - 6:y1 + 6, x0 - 6 - sh:x1 + 6 - sh]
    hole = np.zeros(dz.shape[:2], np.float32); hole[y0:y1, x0:x1] = 1
    hole = cv2.GaussianBlur(hole, (0, 0), 2.5)[..., None]
    dz = (dz * (1 - hole) + fill * hole).astype(np.uint8)
    mk = Image.new("L", (dz.shape[1], dz.shape[0]), 0); dd = ImageDraw.Draw(mk)
    ff = ImageFont.truetype(str(FONT), 10); gg = ff.size * 0.08
    tw2 = sum(dd.textlength(ch, font=ff) for ch in TEXT) + gg * (len(TEXT) - 1)
    xx = 1197 - tw2 / 2
    for ch in TEXT:
        dd.text((xx, 537 - ff.size * 0.62), ch, font=ff, fill=255); xx += dd.textlength(ch, font=ff) + gg
    mm = cv2.GaussianBlur(np.asarray(mk).astype(np.float32) / 255, (0, 0), 0.4)[..., None]
    b2 = dz.astype(np.float32); lw = cv2.GaussianBlur(b2.mean(2), (0, 0), 4)[..., None]
    ink2 = lw * np.array(TINT, np.float32)[None, None, :]
    Image.fromarray(np.clip(b2 * (1 - 0.95 * mm) + ink2 * 0.95 * mm, 0, 255).astype(np.uint8)).save(V / "D00_신발설계도.png")
    print("D00 영문판")
