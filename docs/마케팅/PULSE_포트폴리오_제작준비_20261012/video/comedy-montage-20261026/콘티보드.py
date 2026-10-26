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
    ("C02", "1.87–3.87", "C02", "렌터카 셔틀버스(밤)", "뒤보기 좌석에 앉으며 손잡이 · 2.2초부터 봄"),
    ("C03", "3.87–7.20", "C03", "호텔 수영장", "튜브에 기대 이쪽을 봄"),
    ("C04", "7.20–11.73", "C04", "요트 갑판", "벤치의 일행 사이"),
    ("C05", "11.73–15.10", "C05", "해변 카페", "데이베드에 책상다리 · 케이크 접시"),
    ("C06", "15.10–18.30", "C06", "억새 오름", "돌탑 아래 억새 속에 앉음"),
    ("C07", "18.30–21.77", "C07", "ATV 체험장", "뒷모습 — ATV에 앉아 넥게이터를 매만지다 끝에 어깨 너머로 돌아봄"),
    ("C08", "21.77–22.87", "C08", "ATV 가까이", "어깨 너머로 보며 코까지 덮은 넥게이터를 턱 밑으로 내림"),
    ("C09", "22.87–27.07", "C09", "해변", "아이와 모래 놀이하며 웃다가 고개를 들어 정색"),
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
    for p in (P / "컷" / f"{cid}.jpg", P / "컷" / f"{cid}.png", P / "합성" / {"C17": "끝글_보드.png"}.get(cid, "-")):
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


# 칸마다 카메라 한 줄(02_콘티 3-1절 — 원본 0.2초 실측 숫자, 10-26 밤 유호님 「카메라 기법도 완전히 똑같게」)
CAM = {
    "C01": "왼쪽으로 쓸림 폭 40% · 0.9초 최고 → 1.3초 뚝 멈춤",
    "C02": "오른쪽 도착 팬 폭 34% · 처음 0.25초 최고 → 느려지며 멈춤",
    "C03": "오른쪽 꾸준한 팬 폭 93% / 3.3초",
    "C04": "바닥 → 위로 들며 왼쪽 팬 → 멈춤 → 오른쪽으로 빨라짐 · 걸어 다가감",
    "C05": "걸어 다가감 1.4배 · 끝 0.9초 왼쪽으로 빨라지며 비켜 감",
    "C06": "가리키는 손 → 오른쪽으로 크게 휘두름(번짐) → 느린 팬으로 그를 지나침",
    "C07": "오른쪽 → 위로 살짝 → 왼쪽 쓸림 폭 35% · 살짝 물러남",
    "C08": "거의 멈춘 손떨림 ±1~2%",
    "C09": "왼쪽 팬 → 멈춤 → 오른쪽 조금 → 왼쪽으로 빨라지며 지나침",
    "C10": "0.3초 도착 팬(오른쪽) → 손떨림", "C11": "0.3초 도착 팬(왼쪽) → 손떨림", "C12": "0.3초 도착 팬(오른쪽) → 손떨림",
    "C13": "0.3초 도착 팬(왼쪽) → 손떨림", "C14": "0.3초 도착 팬(오른쪽) → 손떨림", "C15": "0.3초 도착 팬(왼쪽) → 손떨림",
    "C16a": "여행자 폰에서 시작 → 오른쪽 빠른 팬(폭 190%)", "C16": "도착 → 한 번에 1.42배 당김(줌 버튼처럼)",
    "C16b": "손떨림 ±1% · 끝에 아래로 조금 → 휙", "C17": "없음(검은 화면)",
}


def cell(row):
    cid, sec, orig, place, what = row
    W, H = TW * 2 + 18, TH + 190
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
    d.text((8, TH + 10), f"{cid[1:]}  {sec.replace(chr(8211), "~")}초  ·  {place}", font=f("ExtraBold", 26), fill=GOLD)
    y = TH + 50
    line = ""
    for ch in what.replace("—", "·"):  # SUIT에 「—」 글리프가 없어 빈칸으로 찍힌다
        if d.textlength(line + ch, font=f("Medium", 23)) > W - 16:
            d.text((8, y), line, font=f("Medium", 23), fill=INK); y += 30; line = ch
        else:
            line += ch
    d.text((8, y), line, font=f("Medium", 23), fill=INK)
    y += 34
    line = ""
    for ch in "카메라 " + CAM.get(cid, ""):
        if d.textlength(line + ch, font=f("Medium", 21)) > W - 16:
            d.text((8, y), line, font=f("Medium", 21), fill=(170, 220, 170)); y += 27; line = ch
        else:
            line += ch
    d.text((8, y), line, font=f("Medium", 21), fill=(170, 220, 170))
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
