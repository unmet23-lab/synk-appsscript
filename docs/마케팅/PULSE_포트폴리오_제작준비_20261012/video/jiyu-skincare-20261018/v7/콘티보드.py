# 지유 광고 v7 · 이미지 콘티 보드(2026-10-21): 9컷 정지컷 아래에 컷 번호 · 초 · 화면 · 카메라 · 얹는 글자를 적어 한 장으로.
#   python 콘티보드.py   → synk-vendor/jiyu-skincare-20261018/v7/콘티/v7_이미지콘티.jpg
import glob
import os

from PIL import Image, ImageDraw, ImageFont

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "v7", "콘티")
FB = "C:/Windows/Fonts/malgunbd.ttf"
FR = "C:/Windows/Fonts/malgun.ttf"
CUTS = [  # (정지컷 이름, 컷 · 초, 화면, 카메라, 글자)
    ("P1_공개", "1 · 0.0–1.5", "어둠 속 병, 빛 한 줄기가 위에서 아래로 훑는다", "망원 · 3% 밀기", "작은 MALGEUM"),
    ("K2_정면", "2 · 1.5–3.0", "지유 어깨 위, 내린 시선 → 렌즈", "85mm · 거의 정지", "머리말 「세안 뒤 첫 숨」"),
    ("P3_방울", "3 · 3.0–4.5", "한 방울이 떨어진 뒤 고리가 퍼짐", "수면 높이 · 고정", "큰 줄 「약산성」"),
    ("P4_물높이", "4 · 4.5–6.5", "병이 라벨 아래까지 잠겨 수면선이 화면을 가름", "수면선 옆 미끄러지기", "큰 줄 「무향」"),
    ("K5_옆얼굴숨", "5 · 6.5–8.0", "왼쪽 옆얼굴, 눈 감고 들숨", "아주 느린 기울기", "내레이션 「피부가 먼저, 숨 쉬게.」"),
    ("P6_라벨접사", "6 · 8.0–9.5", "라벨 초접사, 도톰한 인쇄 위로 빛", "고정 · 초점 옮기기", "없음(인쇄가 주인공)"),
    ("K7_미소", "7 · 9.5–11.0", "정면 클로즈업, 입 다문 미소", "제자리 작은 호", "없음"),
    ("P8_위에서", "8 · 11.0–12.0", "위에서 본 은색 뚜껑 둘레 파문(컷 3 동그라미 잇기)", "위에서 4° 돌기", "없음"),
    ("P9_팩샷", "9 · 12.0–15.0", "끝 팩샷, 얕은 물 위 유리 받침", "고정", "로크업 · AI 표시 알약"),
]
TW, TH, CAP = 360, 640, 150


def main():
    cols = len(CUTS)
    board = Image.new("RGB", (cols * (TW + 12) + 12, 70 + TH + CAP + 12), (246, 243, 238))
    d = ImageDraw.Draw(board)
    d.text((14, 18), "지유 × 맑음 MALGEUM 15초 · v7 이미지 콘티(제품 70% · 지유 30%, 힉스필드 크레딧 0)", font=ImageFont.truetype(FB, 28), fill=(52, 52, 50))
    fb, fr = ImageFont.truetype(FB, 20), ImageFont.truetype(FR, 18)
    for k, (name, when, what, cam, txt) in enumerate(CUTS):
        x = 12 + k * (TW + 12)
        im = Image.open(sorted(glob.glob(os.path.join(V, "판", f"{name}_*.png")))[-1]).convert("RGB")
        s = max(TW / im.width, TH / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        l, t = (im.width - TW) // 2, (im.height - TH) // 2
        board.paste(im.crop((l, t, l + TW, t + TH)), (x, 70))
        y = 70 + TH + 10
        d.text((x, y), when + "초", font=fb, fill=(52, 52, 50))
        lines, cur = [], ""
        for word in what.split(" "):   # 칸 폭에 맞춰 줄 바꿈
            if d.textlength(cur + " " + word, font=fr) > TW and cur:
                lines.append(cur)
                cur = word
            else:
                cur = (cur + " " + word).strip()
        lines.append(cur)
        for j, line in enumerate(lines[:2]):
            d.text((x, y + 30 + j * 24), line, font=fr, fill=(52, 52, 50))
        d.text((x, y + 82), "카메라 · " + cam, font=fr, fill=(120, 116, 110))
        d.text((x, y + 106), "글자 · " + txt, font=fr, fill=(120, 116, 110))
    out = os.path.join(V, "v7_이미지콘티.jpg")
    board.save(out, quality=90)
    print(out, board.size)


if __name__ == "__main__":
    main()
