"""라벨 시안 한 장 — 편 라벨(2D 원본) + 블렌더 캔 셋(앞면 · 왼 옆면 · 뒷면) + 색 견본 + 끝 1초 글자 견본 (2026-10-25).
결과는 git 밖 <밖>/보드/라벨_시안_<판>.jpg. SUIT에 줄표(–, —) 글리프가 없어 글에는 쓰지 않는다.
  python 라벨시안.py [판]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

여기 = os.path.dirname(os.path.abspath(__file__))
저장소 = os.path.abspath(os.path.join(여기, *[".."] * 6))
밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3"
판 = sys.argv[1] if len(sys.argv) > 1 else "v1"
F = os.path.join(저장소, "docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf")
FB = os.path.join(저장소, "docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf")


def font(s, b=False):
    return ImageFont.truetype(FB if b else F, s)


def wrap(d, text, f, width):
    out, cur = [], ""
    for w in text.split(" "):
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width:
            cur = t
        else:
            out.append(cur)
            cur = w
    out.append(cur)
    return out


W, H = 2400, 1760
B = Image.new("RGB", (W, H), (246, 245, 242))
d = ImageDraw.Draw(B)
d.text((48, 36), "「오미톡 · omitok」 오미자 스파클링 355ml · 라벨 시안 " + 판 + " (2D 원본 + 블렌더 캔)", font=font(40, True), fill=(20, 24, 40))
flat = Image.open(os.path.join(밖, "라벨", "라벨_오미톡_미리.png")).convert("RGB").resize((1400, 770), Image.LANCZOS)
B.paste(flat, (48, 116))
d.text((48, 896), "펼친 라벨(207 × 114 mm, 캔 몸통 둘레 그대로). 가운데가 앞면, 왼쪽에 아래에서 위로 읽는 큰 세로 낱말표(2번 컷 자리, 뒷면 표시와 반대쪽), 양 끝이 뒷면 표시.",
       font=font(23), fill=(50, 54, 70))
cans = Image.open(os.path.join(밖, "렌더", "최종", "label_first.png")).convert("RGB").resize((1400, 788), Image.LANCZOS)
B.paste(cans, (48, 940))
# 오른쪽 칸: 색 견본 → 끝 글자 견본 → 설명
x0 = 1500
sw = [("짙은 남색", "#16214A", (22, 33, 74)), ("루비", "#B3122F", (179, 18, 47)), ("연분홍", "#F6C3D1", (246, 195, 209)), ("흰", "#FFFFFF", (255, 255, 255))]
for i, (n, hx, rgb) in enumerate(sw):
    x = x0 + (i % 2) * 430
    y = 116 + (i // 2) * 170
    d.rounded_rectangle((x, y, x + 400, y + 110), radius=14, fill=rgb, outline=(205, 205, 205))
    d.text((x, y + 120), f"{n}  {hx}", font=font(24, True), fill=(30, 34, 50))
end = Image.open(os.path.join(밖, "라벨", "끝글자_오미톡_세로.png")).convert("RGBA")
bg = Image.new("RGBA", end.size, (16, 24, 60, 255))
end_c = Image.alpha_composite(bg, end).convert("RGB").crop((0, 0, 1080, 240)).resize((830, 184), Image.LANCZOS)
end_box = Image.new("RGB", (830, 369), (16, 24, 60))
end_box.paste(end_c, (0, (369 - 184) // 2))  # 화면 맨 위 9%에 얹는 글자라 그 띠만 잘라 가운데에
B.paste(end_box, (x0, 470))
d.text((x0, 850), "끝 1초 글자(화면 위 가운데에 후반에서 얹음)", font=font(22, True), fill=(30, 34, 50))
notes = [
    "글자는 OFL 글꼴(Fraunces Black Soft · SUIT)의 윤곽을 하프버즈로 짜서 굳힌 벡터. AI로 그린 데가 없다. 이름을 바꾸면 라벨.py --이름 --라틴 한 번으로 새 판.",
    "앞면: 지름 43 mm 루비 엠블럼(오미자 송이, 열매 다섯 · 잎 하나), 그 아래 낱말표 omitok(i의 점이 루비 열매), 「오미톡 오미자 스파클링」, 아래 루비 띠(캔 속 음료)에서 기포 줄기.",
    "왼 옆면: 아래에서 위로 읽는 큰 세로 낱말표(원본 2번 컷처럼 세로 글자 접사 자리). 오른 옆면: 작은 SPARKLING OMIJA. 뒷면: 이름 · 식품유형 · 내용량 · 보관.",
    "남색 · 루비 잉크는 알루미늄이 조금 비치는 금속 몫, 흰 · 연분홍은 금속 아님. 블렌더에서 금속 그림을 같이 쓴다.",
]
y = 940
for n_ in notes:
    for ln in wrap(d, "· " + n_, font(23), 840):
        d.text((x0, y), ln, font=font(23), fill=(50, 54, 70))
        y += 36
    y += 14
out = os.path.join(밖, "보드", f"라벨_시안_{판}.jpg")
B.save(out, quality=90)
print(out, B.size)
