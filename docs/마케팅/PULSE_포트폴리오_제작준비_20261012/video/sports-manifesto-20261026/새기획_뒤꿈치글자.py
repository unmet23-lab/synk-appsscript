# 5번 새 기획(11-05) N10 뒤꿈치의 「가쁨」 — 생성 모델이 「가」의 ㅏ 가로획을 세 번 빠뜨려(1~3차, git 밖 정지컷/_1차/),
# 글자를 지운 판(N10_글자없음)에 SUIT ExtraBold 「가쁨」을 설계도 D00처럼 회색 프린트로 얹는다(곱하기 — 잉크가 니트 올 위에 앉아 결이 비친다).
# 눌린(데보스) 모양 합성은 니트 결에 묻혀 긁힌 자국처럼 보여 버렸다.
# 영상 단계에서는 영상 모델이 글자를 다시 그리므로 프레임마다 다시 얹는다(제작 규칙). 원본 그림 · 결과는 git 밖.
#   python -X utf8 새기획_뒤꿈치글자.py
import os
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/정지컷")
# 11-05 Fable 2차 뒤: 니트 결을 설계도와 맞춘 글자 자리 빈 판(N10p)에, 설계도 D00처럼 연회색으로 찍는다
BASE, CX, CY, SIZE, ROT, TINT = "N10p.png", 0.61, 0.47, 0.17, 6, (0.60, 0.62, 0.66)  # 9:16으로 자르면 양옆 21%가 빠져 가운데 쪽에
SUIT = Path(os.environ["USERPROFILE"]) / "Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"
base = np.asarray(Image.open(V / BASE).convert("RGB")).astype(np.float32)
H, W = base.shape[:2]
# 글자 판: 가로 460px 안팎(3차 판의 글자 자리), 가운데 (0.58W, 0.46H)
mask = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(mask)
f = ImageFont.truetype(str(SUIT), int(W * SIZE))
tw = d.textlength("가쁨", font=f)
cx, cy = W * CX, H * CY
d.text((cx - tw / 2, cy - f.size * 0.62), "가쁨", font=f, fill=255)
m = np.asarray(mask).astype(np.float32) / 255
# 표면 기울기: 니트 면이 오른쪽 위로 조금 들려 있어 글자도 -7° 돌리고 세로를 조금 눌러 원근을 준다
M = cv2.getRotationMatrix2D((cx, cy), ROT, 1.0)
M[1] *= 0.94
M[1, 2] += cy * 0.06
m = cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_LINEAR)
m = cv2.GaussianBlur(m, (0, 0), 0.5)
# 회색 프린트(실크스크린): 같은 빛을 받는 잉크라 니트 밝기에 일정 비율로 곱한다 — 가장자리는 또렷하게, 결은 그대로 비친다.
# (잉크를 고정 회색으로 얹으면 그늘진 니트보다 밝게 떠 스티커처럼 보였다)
a = 0.92 * m[..., None]
tint = np.array(TINT, np.float32)                             # 설계도 D00의 연회색 글자 — 흰 니트에 곱하면 회색
out = np.clip(base * (1 - a) + base * tint * a, 0, 255).astype(np.uint8)
Image.fromarray(out).save(V / "N10.png")
z = Image.fromarray(out).crop((int(W * 0.28), int(H * 0.34), int(W * 0.92), int(H * 0.58)))
z.save(V / "_1차" / "N10_합성_확대.png")
print("ok", W, H)
