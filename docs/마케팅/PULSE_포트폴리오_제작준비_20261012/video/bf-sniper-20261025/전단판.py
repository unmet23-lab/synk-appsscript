# 블프 스나이퍼 7번 느지막 전단 판(2026-10-27) — Gemini가 지어 낸 전단에 다른 가격(39,900 · 33,900)이 찍혀(Fable 이미지 콘티 1차 상),
# 전단 앞면을 코드로 그려 Gemini에 참조로 주고 「준호가 든 전단은 이 그림 그대로」로 굽는다. 달력판.py와 같은 길(글자는 코드, 사람 · 손은 Gemini).
#   python -X utf8 전단판.py   → 콘티/bf-sniper/달력판/전단.png(세로 3:4)
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/달력판/전단.png")
SUIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf"
SUIT_B = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"
W, H = 1500, 2000
AMBER, RED, INK = (214, 120, 40), (200, 40, 50), (30, 30, 30)

img = Image.new("RGB", (W, H), (255, 252, 246))
d = ImageDraw.Draw(img)
d.rectangle((0, 0, W, 260), fill=AMBER)
d.text((80, 130), "느지막", font=ImageFont.truetype(SUIT_B, 150), fill=(255, 255, 255), anchor="lm")
d.text((W - 80, 130), "가전 · 생활 온라인몰", font=ImageFont.truetype(SUIT_B, 64), fill=(255, 240, 220), anchor="rm")
# TV 사진(어두운 테두리 · 노을 화면)
tx0, ty0, tx1, ty1 = 140, 360, W - 140, 1010
d.rounded_rectangle((tx0, ty0, tx1, ty1), radius=18, fill=(25, 25, 28))
for i in range(ty1 - ty0 - 60):
    t = i / (ty1 - ty0 - 60)
    c = (int(250 - 120 * t), int(150 - 70 * t), int(90 + 60 * t))
    d.line((tx0 + 30, ty0 + 30 + i, tx1 - 30, ty0 + 30 + i), fill=c)
d.rectangle((W / 2 - 90, ty1, W / 2 + 90, ty1 + 50), fill=(40, 40, 44))
d.text((W / 2, 1110), "75인치 TV", font=ImageFont.truetype(SUIT_B, 120), fill=INK, anchor="mm")
f = ImageFont.truetype(SUIT_B, 110)
d.text((180, 1290), "198만 원", font=f, fill=(130, 130, 130), anchor="lm")
tw = d.textlength("198만 원", font=f)
d.line((170, 1295, 190 + tw, 1295), fill=RED, width=14)
d.text((W - 160, 1290), "99만 원", font=ImageFont.truetype(SUIT_B, 170), fill=RED, anchor="rm")
d.text((W / 2, 1520), "블프 반값", font=ImageFont.truetype(SUIT_B, 240), fill=RED, anchor="mm")
d.rounded_rectangle((180, 1700, W - 180, 1860), radius=30, fill=RED)
d.text((W / 2, 1780), "선착순 없음 · 11/27부터 일주일 내내", font=ImageFont.truetype(SUIT_B, 76), fill=(255, 255, 255), anchor="mm")
OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT)
print(OUT)
