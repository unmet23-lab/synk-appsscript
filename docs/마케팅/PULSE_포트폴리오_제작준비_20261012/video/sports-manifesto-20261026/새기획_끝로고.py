# ※ 옛 판 — 11-05 밤 유호님 「너무 AI 슬롭티나고 정말 초보 디자이너가 디자인한 느낌」으로 버렸다. 지금 길은 새기획_끝타이포.py · 새기획_워드마크.py(글 콘티 9절). 기록으로 둔다.
# 5번 새 기획(11-05) 끝 그림 N11_로고 — 화면에 얹는 로고라 후반에서 코드로 얹는다(제작 규칙). 이미지 콘티 보드용 시안이고 영상 단계에서 같은 값으로 움직인다.
# Fable 2차(11-05): 1차 판은 N11을 통째로 흐려 신발이 회색 얼룩이 되고 글자가 호박빛 패드 위에 판처럼 얹혔다 →
#   끝 판 N11e(뒤꿈치가 트랙을 차 알갱이가 튐)에서 아래 접점 · 패드만 또렷하게 두고 위로 갈수록 초점이 빠지며 어두워지는 두 톤을 만들고,
#   글자는 어두워진 위쪽 가운데에 패드와 겹치지 않게, 장면의 찬 빛을 옅게 두른다. 뜻 한 줄을 작게 — 마침표 없음(점검표 6번).
# 11-05 밤 유호님 「이런건 영어로 … 신발 로고도 영어로 바꿔줘」 → 영문 「GAPPEUM」 · RUNNING · 뜻 한 줄 「Out of breath, into joy」(내레이션과 같은 줄).
#   한글 「가쁨」 판은 git 밖 정지컷/_한글판_20261105/에 남겼다.
#   python -X utf8 새기획_끝로고.py   → 콘티/p5n/정지컷/N11_로고.png
import os
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/정지컷")
IT = Path(os.environ["USERPROFILE"]) / "Documents/SYNK-appsscript/docs/브랜드_폰트/InterTight"
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
f1 = ImageFont.truetype(str(IT / "InterTight-SemiBold.ttf"), int(W * 0.094))
f2 = ImageFont.truetype(str(IT / "InterTight-Medium.ttf"), int(W * 0.028))
f3 = ImageFont.truetype(str(IT / "InterTight-Regular.ttf"), int(W * 0.036))


def spaced(text, font, y, gap, fill):
    w = sum(d.textlength(ch, font=font) for ch in text) + (len(text) - 1) * gap
    x = (W - w) / 2
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill); x += d.textlength(ch, font=font) + gap


cy = H * 0.165  # Fable 재확인: 뜻 한 줄 오른끝이 흐린 뒤꿈치 · 띠에 붙어 붐빔 → 글자 묶음을 올림
# 글자 사이를 넓게 벌린 대문자 한 줄 — 고급 브랜드 워드마크의 꼴, 굵기는 SemiBold로 눌러 둔다
spaced("GAPPEUM", f1, cy - f1.size * 0.62, f1.size * 0.16, 255)
spaced("RUNNING", f2, cy + f1.size * 0.62, f2.size * 0.55, 215)
w3 = d.textlength("Out of breath, into joy", font=f3)
d.text(((W - w3) / 2, cy + f1.size * 0.62 + f2.size * 2.6), "Out of breath, into joy", font=f3, fill=205)
m = np.asarray(txt).astype(np.float32) / 255
glow = cv2.GaussianBlur(m, (0, 0), W * 0.010) * 0.22   # 장면의 찬 빛을 아주 옅게
a = np.clip(m + glow, 0, 1)[..., None]
col = np.array([238, 242, 248], np.float32)            # 빛 기둥과 같은 찬 흰색
out = np.clip(arr * (1 - a) + col * a, 0, 255).astype(np.uint8)
Image.fromarray(out).save(V / "N11_로고.png")
print("ok", W, H)
