# 「매진 임박」 새 개그 모델 후보판(2026-10-22): 배역/후보/<후보>_<시각>.png 가운데 후보마다 마지막 판을 두 줄(통 큰 언니 · 리액션 장인)로 놓는다.
#   python -X utf8 후보판.py   → synk-vendor/homeshopping-horror-20261021/배역/매진임박_개그모델_후보.jpg
# 칸 아래에 나이 · 머리 · 지킬 특징 둘(지시문/배역후보.json의 「설명」)을 적는다.
import glob
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
SRC = os.path.join(V, "배역", "후보")
FB, FR = "C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/malgun.ttf"
ROWS = [("통 큰 언니", ["통1", "통2", "통3", "통4"]), ("리액션 장인", ["리1", "리2", "리3", "리4"])]
TW, TH, CAP, GAP, HEAD, ROWH = 450, 600, 96, 14, 90, 46


def note(spec, cid):
    a, _, f = next(c["설명"] for c in spec["후보"] if c["id"] == cid).partition(" | ")
    return a, f


def main():
    spec = json.load(open(os.path.join(HERE, "지시문", "배역후보.json"), encoding="utf-8"))
    W = GAP + 4 * (TW + GAP)
    H = HEAD + len(ROWS) * (ROWH + TH + CAP + GAP)
    board = Image.new("RGB", (W, H), (18, 18, 20))
    d = ImageDraw.Draw(board)
    d.text((GAP + 4, 22), "「매진 임박」 새 개그 모델 후보 — 하나씩 골라 주세요(지유 + 두 사람이 피해자 셋)", font=ImageFont.truetype(FB, 32), fill=(240, 240, 240))
    fs, fn = ImageFont.truetype(FR, 17), ImageFont.truetype(FB, 24)
    for r, (who, ids) in enumerate(ROWS):
        y0 = HEAD + r * (ROWH + TH + CAP + GAP)
        d.text((GAP + 4, y0 + 6), who, font=ImageFont.truetype(FB, 28), fill=(255, 214, 90))
        for k, cid in enumerate(ids):
            x = GAP + k * (TW + GAP)
            y = y0 + ROWH
            files = sorted(glob.glob(os.path.join(SRC, f"{cid}_*.*")))
            if files:
                im = Image.open(files[-1]).convert("RGB")
                im.thumbnail((TW, TH), Image.LANCZOS)
                board.paste(im, (x + (TW - im.width) // 2, y + (TH - im.height) // 2))
            else:
                d.rectangle([x, y, x + TW, y + TH], outline=(90, 90, 90), width=2)
                d.text((x + 20, y + 20), "아직 없음", font=fn, fill=(200, 80, 80))
            a, f = note(spec, cid)
            d.text((x + 6, y + TH + 6), cid, font=fn, fill=(240, 120, 120))
            d.text((x + 52, y + TH + 10), a, font=fs, fill=(225, 225, 225))
            d.text((x + 6, y + TH + 42), f, font=fs, fill=(170, 170, 170))
    out = os.path.join(V, "배역", "매진임박_개그모델_후보.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    board.save(out, quality=90)
    print(out, board.size)


if __name__ == "__main__":
    main()
