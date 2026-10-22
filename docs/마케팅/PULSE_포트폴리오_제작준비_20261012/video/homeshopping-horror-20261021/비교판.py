# 「매진 임박」 제품 1안 · 2안 비교판(2026-10-22): 홈쇼핑 끼어들기 넷을 같은 프레임으로 찍어 왼쪽 1안 · 오른쪽 2안으로 나란히 놓는다.
#   (remotion 폴더에서) npx remotion still <장면> out/<장면>_f<프레임>.png --frame <프레임>  ← 1안 H1 · H2 · H3 · HE, 2안은 <장면>-2
#   python -X utf8 비교판.py   → synk-vendor/homeshopping-horror-20261021/콘티/매진임박_제품비교_1안2안.jpg
# 공포 컷 · 목소리 · 값은 두 안이 같아 홈쇼핑 칸만 비교한다.
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
OUT = os.path.join(V, "콘티")
FB, FR = "C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/malgun.ttf"
# (장면, 프레임, 칸 제목)
ROWS = [
    ("H1", 40, "끼어들기 1 · 8.0초 · 99,000원"),
    ("H2", 66, "끼어들기 2 · 15.5초 · 구성 추가 990,000원"),
    ("H3", 88, "끼어들기 3 · 22.5초 · 9,900,000원 → 특별 할인 9,900원"),
    ("HE", 30, "끝 · 34.5초 · 주문 완료"),
]
COLS = [
    ("", "1안 · 맑음 MALGEUM 토너", "지유 v7 병 그대로 · 셋째는 「미니 10ml」 · 공개 전 이름 바꿔야 함(같은 이름 화장품 있음)"),
    ("-2", "2안 · 꽉 KKWAK 진공 밀폐용기", "새로 지은 가상 제품 · 셋째는 「뚜껑만 1개」 · 같은 이름 밀폐용기는 간단 검색에서 안 보임"),
]
TW, TH, GAP, HEAD, ROWH = 880, 495, 16, 150, 44


def main():
    W = GAP + len(COLS) * (TW + GAP)
    H = HEAD + len(ROWS) * (ROWH + TH + GAP) + GAP
    board = Image.new("RGB", (W, H), (18, 18, 20))
    d = ImageDraw.Draw(board)
    d.text((GAP + 4, 18), "「매진 임박」 제품 고르기 — 홈쇼핑 칸만 다르다(공포 컷 · 목소리 · 값은 같음)", font=ImageFont.truetype(FB, 32), fill=(240, 240, 240))
    for j, (_, name, note) in enumerate(COLS):
        x = GAP + j * (TW + GAP)
        d.text((x + 4, 70), name, font=ImageFont.truetype(FB, 30), fill=(255, 214, 90))
        d.text((x + 4, 112), note, font=ImageFont.truetype(FR, 19), fill=(170, 170, 170))
    for i, (scene, frame, title) in enumerate(ROWS):
        y = HEAD + i * (ROWH + TH + GAP)
        d.text((GAP + 4, y + 8), title, font=ImageFont.truetype(FB, 24), fill=(240, 120, 120))
        for j, (suffix, _, _) in enumerate(COLS):
            x = GAP + j * (TW + GAP)
            p = os.path.join(HERE, "remotion", "out", f"{scene}{suffix}_f{frame}.png")
            if os.path.exists(p):
                board.paste(Image.open(p).convert("RGB").resize((TW, TH), Image.LANCZOS), (x, y + ROWH))
            else:
                d.rectangle([x, y + ROWH, x + TW, y + ROWH + TH], outline=(90, 90, 90), width=2)
                d.text((x + 20, y + ROWH + 20), f"없음: {os.path.basename(p)}", font=ImageFont.truetype(FR, 22), fill=(200, 80, 80))
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "매진임박_제품비교_1안2안.jpg")
    board.save(out, quality=90)
    print(out, board.size)


if __name__ == "__main__":
    main()
