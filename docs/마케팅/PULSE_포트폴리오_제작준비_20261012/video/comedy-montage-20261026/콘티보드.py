# 12번 이미지 콘티 보드(2026-10-26, 8번 콘티보드.py와 같은 꼴을 세로 9:16에 맞춤) — 칸마다 원본 대표 프레임 | 우리 판, 아래에 초 · 장소 · 우리 화면.
# 원본 대표 프레임은 그 사람이 이쪽을 보는 순간(01_샷표 2절). 속사포 6컷(10~15)은 원본에 없는 박자라 원본 칸을 비운다.
#   python -X utf8 콘티보드.py  → git 밖 콘티/p12/보드/p12_이미지콘티_1~3.jpg · p12_이미지콘티_한눈.jpg (원본 프레임이 들어가 git 밖에만 둔다)
#   우리 판은 콘티/p12/정지컷/_고름.json({"C01": "C01_g1.png", …})에서 고른 판, 없으면 가장 최근 판.
import glob, json, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

P = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p12")
FONT = r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT"
OUT = P / "보드"
BG, INK, DIM, GOLD, CARD = (17, 15, 14), (238, 232, 224), (160, 150, 140), (240, 200, 120), (28, 25, 23)

# (컷, 초, 원본 대표 프레임, 장소, 우리 화면) — 02_콘티.md 3절을 줄인 것
ROWS = [
    ("C01", "0.00–1.87", "C01", "기내", "옆 줄 가운데 좌석 — 처음부터 이쪽을 보며 눈썹 살짝"),
    ("C02", "1.87–3.87", "C02", "렌터카 셔틀버스(밤)", "뒤보기 좌석 · 손잡이 · 처음부터 봄"),
    ("C03", "3.87–7.20", "C03", "호텔 수영장", "튜브에 기대 이쪽을 봄"),
    ("C04", "7.20–11.73", "C04", "요트 갑판", "벤치의 일행 사이"),
    ("C05", "11.73–15.10", "C05", "해변 카페", "데이베드에 책상다리 · 케이크 접시"),
    ("C06", "15.10–18.30", "C06", "억새 오름", "돌탑 아래 억새 속에 앉음"),
    ("C07", "18.30–21.77", "C07", "ATV 체험장", "뒷모습 — ATV에 올라탐"),
    ("C08", "21.77–22.87", "C08", "ATV 가까이", "넥게이터를 코까지 올리며 정면"),
    ("C09", "22.87–27.07", "C09", "해변", "모래 놀이 하는 아이 곁에 쪼그려 앉음"),
    ("C10", "27.07–27.77", None, "해녀 식당 줄", "앞사람이 어깨 너머로 돌아봄"),
    ("C11", "27.77–28.47", None, "우도 해안 도로", "옆 자전거"),
    ("C12", "28.47–29.17", None, "감귤밭", "가지 사이로"),
    ("C13", "29.17–29.87", None, "성산일출봉", "단체 사진 앞줄 끝 — 혼자 이쪽"),
    ("C14", "29.87–30.57", None, "바다 카페 노을", "옆 테이블에서 폰을 내리고"),
    ("C15", "30.57–31.27", None, "야시장 밤", "꼬치 연기 너머"),
    ("C16a", "31.27–32.3", "C16", "흑돼지 식당", "여행자 손의 앱 화면 — 팬 시작"),
    ("C16", "32.0–32.6", "C16", "흑돼지 식당", "맞은편 테이블 — 이쪽을 봄 · 줌인"),
    ("C16b", "32.6–35.14", "C16", "흑돼지 식당", "똑같은 화면의 폰을 들어 보이며 끄덕"),
    ("C17", "35.14–37.64", None, "끝 글", "알고 보니, 같은 코스. → 모두의코스"),
]
TW, TH = 300, 533          # 칸 하나(9:16)
COLS = 6


def f(w, s):
    return ImageFont.truetype(os.path.join(FONT, f"SUIT-{w}.otf"), s)


def ours(cid):
    pick = {}
    pj = P / "정지컷" / "_고름.json"
    if pj.exists():
        pick = json.load(open(pj, encoding="utf-8"))
    if cid in pick and (P / "정지컷" / pick[cid]).exists():
        return Image.open(P / "정지컷" / pick[cid]).convert("RGB")
    for p in (P / "컷" / f"{cid}.jpg", P / "컷" / f"{cid}.png"):
        if p.exists():
            return Image.open(p).convert("RGB")
    g = sorted(glob.glob(str(P / "정지컷" / f"{cid}_g*.png")), key=os.path.getmtime)
    return Image.open(g[-1]).convert("RGB") if g else None


def fit(im):
    if im is None:
        return None
    w, h = im.size
    t = TW / TH
    if w / h > t:
        nw = int(h * t); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / t); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize((TW, TH), Image.LANCZOS)


def cell(row):
    cid, sec, orig, place, what = row
    W, H = TW * 2 + 18, TH + 150
    c = Image.new("RGB", (W, H), CARD)
    d = ImageDraw.Draw(c)
    o = fit(Image.open(P / "원본대표프레임" / f"{orig}.png").convert("RGB")) if orig else None
    u = fit(ours(cid))
    for x, im, lab in ((0, o, "원본" if orig else "원본 없음(속사포)"), (TW + 18, u, "우리 판")):
        if im is not None:
            c.paste(im, (x, 0))
        else:
            d.rectangle([x, 0, x + TW, TH], fill=(40, 36, 33))
        d.text((x + 8, 6), lab, font=f("ExtraBold", 20), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
    d.text((8, TH + 10), f"{cid[1:]}  {sec}초  ·  {place}", font=f("ExtraBold", 26), fill=GOLD)
    y = TH + 50
    line = ""
    for ch in what:
        if d.textlength(line + ch, font=f("Medium", 23)) > W - 16:
            d.text((8, y), line, font=f("Medium", 23), fill=INK); y += 30; line = ch
        else:
            line += ch
    d.text((8, y), line, font=f("Medium", 23), fill=INK)
    return c


def board(rows, name, title):
    cells = [cell(r) for r in rows]
    cw, ch = cells[0].size
    cols = min(COLS // 2, len(cells))
    nrow = (len(cells) + cols - 1) // cols
    W = 40 + cols * (cw + 24)
    H = 120 + nrow * (ch + 24) + 20
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((40, 30), title, font=f("ExtraBold", 40), fill=INK)
    for i, c in enumerate(cells):
        img.paste(c, (40 + (i % cols) * (cw + 24), 110 + (i // cols) * (ch + 24)))
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, quality=88)
    print(OUT / name, img.size)


if __name__ == "__main__":
    t = "12번 B급 코미디 몽타주 — 이미지 콘티(원본 대표 프레임 | 우리 판)"
    board(ROWS[:6], "p12_이미지콘티_1.jpg", t + "  1/3")
    board(ROWS[6:12], "p12_이미지콘티_2.jpg", t + "  2/3")
    board(ROWS[12:], "p12_이미지콘티_3.jpg", t + "  3/3")
