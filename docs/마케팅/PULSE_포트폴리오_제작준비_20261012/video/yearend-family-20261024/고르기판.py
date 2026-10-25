# 6번 「연말 빈방」 고르실 것 한 장(2026-10-25) — 브랜드 이름 넷(상표 확인 결과) · 끝 문구 두 안 · 끝 내레이터 두 안.
#   python -X utf8 고르기판.py   → synk-vendor/…/레퍼런스/여쭐판/6번_고르실것.jpg (원본 프레임은 안 들어가지만 보드와 같은 곳에 둔다)
# 글은 02_콘티.md 1절 · 3절 · 10절과 같다 — 고치면 둘 다 고친다.
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "레퍼런스", "여쭐판", "6번_고르실것.jpg")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, LINE, GOOD = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (60, 58, 62), (140, 210, 160)

NAMES = [("솜채", "추천", "솜으로 지은 집 한 채(안채 · 사랑채의 「채」): 「집에 가자」와 맞는다", "침구 류 깨끗 · 소리 또렷(다른 류에 「하솜채」 · 「다솜채」)"),
         ("곁잠", "", "곁에서 자는 잠: 「올 연말엔 엄마 곁에서」. 끝의 「엄마!」와 바로 이어진다", "상표 · 업체 겹침 없음 · 다만 소리로는 「겉잠」(선잠)과 같다"),
         ("겨울채", "", "겨울을 나는 집 한 채: 연말 · 겨울 이불과 맞는다", "같은 이름 없음 · 24류에 「겨울잠」 등록(앞 두 자가 같다)"),
         ("한겹", "덜 좋음", "한 겹 더 덮어 주는 마음", "옷 · 가방 류에 「HAN GYEOP」 등록")]
COPY = [("A · 추천", "아무도 자지 않는 방에도", "엄마는 철마다 새 이불을 펴 둡니다", "말하는 문장: 원본 끝 문구와 같은 구실(엄마의 마음을 한 줄로). 끝의 도어락 · 「엄마!」가 「그래서 왔다」를 대신 말한다"),
        ("B", "올겨울엔", "엄마가 펴 둔 이불을 덮으러 가요", "권하는 문장: 바라는 행동(연말에 집에 가기)을 글로 말한다. 끝 2초와 뜻이 겹친다")]
VOICE = [("A · 추천", "따로 한 명(차분한 여성 내레이터)", "원본처럼. 마지막 「엄마!」가 11번 뒤 처음 듣는 어른 딸 목소리라 놀람이 크다"),
         ("B", "딸(지유 목소리, 차분한 톤)", "끝 문구를 읽던 사람이 문 앞에 온 셈: 「오는 길의 생각」으로 이어진다. 대신 「엄마!」의 놀람은 줄고, 브랜드 이름도 딸이 읽는다")]


def wrap(d, text, font, width):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            lines.append(cur)
            cur = ch.lstrip()
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def main():
    W, H = 1800, 2250
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((60, 50), "6번 연말 빈방 · 고르실 것 셋", font=F("ExtraBold", 54), fill=INK)
    d.text((60, 125), "가상 침구 브랜드의 연말 브랜드 필름 59.99초 · 글 콘티는 02_콘티.md · 이미지 콘티는 보드", font=F("Medium", 26), fill=DIM)
    y = 200
    d.text((60, y), "1  브랜드 이름(KIPRIS 24 · 20류와 모든 류, 10-25)", font=F("ExtraBold", 34), fill=GOLD)
    y += 70
    for i, (nm, tag, mean, tm) in enumerate(NAMES):
        x = 60 + (i % 2) * 860
        yy = y + (i // 2) * 300
        d.rounded_rectangle([x, yy, x + 820, yy + 270], 18, outline=LINE, width=2)
        d.text((x + 30, yy + 20), nm, font=F("Heavy", 96), fill=INK)
        if tag:
            d.text((x + 30 + d.textlength(nm, font=F("Heavy", 96)) + 24, yy + 62), tag, font=F("ExtraBold", 30), fill=GOOD if tag == "추천" else (236, 170, 120))
        ty = yy + 140
        for ln in wrap(d, mean, F("SemiBold", 25), 760)[:2]:
            d.text((x + 30, ty), ln, font=F("SemiBold", 25), fill=INK)
            ty += 34
        d.text((x + 30, ty + 4), tm, font=F("Medium", 22), fill=DIM)
    y += 620
    d.text((60, y), "2  끝 문구(22번: 목소리 51.43~55.63초 · 화면 두 줄)", font=F("ExtraBold", 34), fill=GOLD)
    y += 70
    for tag, l1, l2, why in COPY:
        d.rounded_rectangle([60, y, W - 60, y + 260], 18, outline=LINE, width=2)
        d.text((90, y + 22), tag, font=F("ExtraBold", 30), fill=GOOD if "추천" in tag else DIM)
        d.text((300, y + 20), l1, font=F("SemiBold", 44), fill=INK)
        d.text((300, y + 80), l2, font=F("SemiBold", 44), fill=INK)
        ty = y + 158
        for ln in wrap(d, why, F("Medium", 24), W - 400)[:3]:
            d.text((300, ty), ln, font=F("Medium", 24), fill=DIM)
            ty += 32
        y += 290
    y += 20
    d.text((60, y), "3  끝 문구 · 브랜드 이름을 읽는 목소리", font=F("ExtraBold", 34), fill=GOLD)
    y += 70
    for tag, who, why in VOICE:
        d.rounded_rectangle([60, y, W - 60, y + 190], 18, outline=LINE, width=2)
        d.text((90, y + 22), tag, font=F("ExtraBold", 30), fill=GOOD if "추천" in tag else DIM)
        d.text((300, y + 20), who, font=F("SemiBold", 40), fill=INK)
        ty = y + 84
        for ln in wrap(d, why, F("Medium", 24), W - 400)[:3]:
            d.text((300, ty), ln, font=F("Medium", 24), fill=DIM)
            ty += 32
        y += 220
    im = im.crop((0, 0, W, min(H, y + 30)))
    im.save(OUT, quality=90)
    print(OUT, im.size)


if __name__ == "__main__":
    main()
