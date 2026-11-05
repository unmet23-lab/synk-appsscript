# 5번 새 기획(11-05) 끝 그림 N11_로고 — 화면에 얹는 로고라 후반에서 코드로 얹는다(제작 규칙). 이미지 콘티 보드용 시안이고 영상 단계에서 같은 값으로 움직인다.
# Fable 2차(11-05): 1차 판은 N11을 통째로 흐려 신발이 회색 얼룩이 되고 글자가 호박빛 패드 위에 판처럼 얹혔다 →
#   끝 판 N11e(뒤꿈치가 트랙을 차 알갱이가 튐)에서 아래 접점 · 패드만 또렷하게 두고 위로 갈수록 초점이 빠지며 어두워지는 두 톤을 만들고,
#   글자는 어두워진 위쪽 가운데에 패드와 겹치지 않게, 장면의 찬 빛을 옅게 두른다. 뜻 한 줄(「숨이 가쁠수록, 기쁨」)을 작게 — 마침표 없음(점검표 6번).
#   python -X utf8 새기획_끝로고.py   → 콘티/p5n/정지컷/N11_로고.png
import os
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/정지컷")
SUIT = Path(os.environ["USERPROFILE"]) / "Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT"
base = np.asarray(Image.open(V / "N11e.png").convert("RGB")).astype(np.float32)
H, W = base.shape[:2]
yy = np.linspace(0, 1, H)[:, None]
# 위로 갈수록 초점이 빠진다(아래 55%부터) — 패드 · 접점 · 알갱이는 또렷하게 남는다
soft = cv2.GaussianBlur(base, (0, 0), W * 0.014)
k = np.clip((0.58 - yy) / 0.25, 0, 1)[..., None]
arr = base * (1 - k) + soft * k
# 위는 어두운 허공으로(두 톤) — 빛 기둥 쪽 찬 빛만 조금 남긴다
arr *= (0.38 + 0.62 * np.clip((yy - 0.05) / 0.55, 0, 1))[..., None]
txt = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(txt)
f1 = ImageFont.truetype(str(SUIT / "SUIT-ExtraBold.otf"), int(W * 0.155))
f2 = ImageFont.truetype(str(SUIT / "SUIT-SemiBold.otf"), int(W * 0.032))
f3 = ImageFont.truetype(str(SUIT / "SUIT-Medium.otf"), int(W * 0.040))
cy = H * 0.165  # Fable 재확인: 뜻 한 줄 오른끝이 흐린 뒤꿈치 · 띠에 붙어 붐빔 → 글자 묶음을 올림
w1 = d.textlength("가쁨", font=f1); d.text(((W - w1) / 2, cy - f1.size * 0.72), "가쁨", font=f1, fill=255)


def spaced(text, font, y, gap, fill):
    w = d.textlength(text, font=font) + (len(text) - 1) * gap
    x = (W - w) / 2
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill); x += d.textlength(ch, font=font) + gap


spaced("GAPPEUM RUNNING", f2, cy + f1.size * 0.40, W * 0.006, 225)
w3 = d.textlength("숨이 가쁠수록, 기쁨", font=f3); d.text(((W - w3) / 2, cy + f1.size * 0.40 + f2.size * 2.3), "숨이 가쁠수록, 기쁨", font=f3, fill=210)
m = np.asarray(txt).astype(np.float32) / 255
glow = cv2.GaussianBlur(m, (0, 0), W * 0.010) * 0.22   # 장면의 찬 빛을 아주 옅게
a = np.clip(m + glow, 0, 1)[..., None]
col = np.array([238, 242, 248], np.float32)            # 빛 기둥과 같은 찬 흰색
out = np.clip(arr * (1 - a) + col * a, 0, 255).astype(np.uint8)
Image.fromarray(out).save(V / "N11_로고.png")
print("ok", W, H)
