# 「매진 임박」 이미지 콘티 보드(2026-10-21): 18칸(공포 정지컷 14 + 홈쇼핑 4)을 시간 순서로 놓고 칸마다 컷 · 초 · 화면 · 소리 · 대사를 적는다.
#   python -X utf8 콘티보드.py   → synk-vendor/homeshopping-horror-20261021/콘티/매진임박_이미지콘티.jpg
# 공포 칸은 정지컷/색감/<컷>.jpg(붉은밤), 홈쇼핑 칸은 remotion/out/<장면>_f<프레임>.png(npx remotion still로 찍은 것).
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
OUT = os.path.join(V, "콘티")
FB, FR = "C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/malgun.ttf"
# (칸, 초, 화면, 소리 · 대사, 그림)
CELLS = [
    ("C01", "0.0–2.0", "빈 거실, 벽에 칼 든 팔 그림자", "낮은 울림 · 삐걱", "stills:C01"),
    ("C02", "2.0–4.0", "복면 강도 가슴 위", "강도 「가진 거… 다 내놔.」", "stills:C02"),
    ("C03", "4.0–5.5", "하린 클로즈업, 우는 숨", "흐느낌", "stills:C03"),
    ("C04", "5.5–8.0", "지유, 손으로 입 가리고 울며 올려다봄", "지유 「이, 이거… 한정판이에요…」", "stills:C04"),
    ("H1", "8.0–10.0", "홈쇼핑 1 · 99,000원(글자가 하나씩)", "음악 터짐 · 혜수 「지금 이 구성, 마지막입니다!」", "hs:H1_f40"),
    ("C05", "10.0–11.5", "강도, 고개를 갸웃", "정적 0.6초", "stills:C05"),
    ("C06", "11.5–13.0", "그림자: 칼이 들린다", "강도 「…장난해?」", "stills:C06"),
    ("C07", "13.0–15.5", "하린, 두 손 모아 빌며", "하린 「이것도요! 구성 추가… 무이자 십 개월…!」", "stills:C07"),
    ("H2", "15.5–18.5", "홈쇼핑 2 · 3병 세트 990,000원(딱지 0.35초마다)", "성준 「구성 추가! 무이자 10개월! 지금 바로 전화 주세요!」", "hs:H2_f66"),
    ("C08", "18.5–20.0", "지유 비명", "정적 → 비명", "stills:C08"),
    ("C09", "20.0–22.5", "강도, 손에 든 것을 내려다봄", "강도 「…이게, 얼만데.」", "stills:C09"),
    ("H3", "22.5–26.5", "홈쇼핑 3 · 미니 10ml 9,900,000원 → 「특별 할인」 → 9,900원", "혜수 「오늘 단 하루!」 · 성준 「특별 할인!」 · 혜수 「구천구백 원!」", "hs:H3_f88"),
    ("C10", "26.5–28.5", "그림자: 칼이 내려간다", "정적 · 「탁」", "stills:C10"),
    ("C11", "28.5–31.0", "강도, 휴대폰을 귀에", "강도 「…네. 방송 보고 전화했는데요.」", "stills:C11"),
    ("C12", "31.0–32.0", "하린, 멍", "—", "stills:C12"),
    ("C13", "32.0–33.0", "지유, 멍", "—", "stills:C13"),
    ("C14", "33.0–34.5", "강도 눈, 휴대폰 빛", "강도 「…두 개요.」", "stills:C14"),
    ("끝", "34.5–38.5", "주문 +2 · 「주문 완료」 → 「강도도 사게 만드는 광고」 · PULSE", "혜수 「주문 감사합니다!」", "hs:HE_f90"),
]
TW, TH, CAP, COLS, GAP = 480, 270, 132, 6, 12


def wrap(d, text, font, width, n):
    lines, cur = [], ""
    for ch in text.split(" "):
        t = (cur + " " + ch).strip()
        if d.textlength(t, font=font) > width and cur:
            lines.append(cur)
            cur = ch
        else:
            cur = t
    lines.append(cur)
    return lines[:n]


def main():
    rows = (len(CELLS) + COLS - 1) // COLS
    W = COLS * (TW + GAP) + GAP
    board = Image.new("RGB", (W, 120 + rows * (TH + CAP + GAP) + 10), (18, 18, 20))
    d = ImageDraw.Draw(board)
    d.text((GAP + 4, 20), "「매진 임박」 공포 코미디 × 홈쇼핑 — 이미지 콘티(38.5초 · 16:9 · 힉스필드 · Flow 크레딧 0)", font=ImageFont.truetype(FB, 34), fill=(240, 240, 240))
    d.text((GAP + 4, 70), "공포 컷: Gemini Ultra 2.1 정지컷 + 색감 「붉은밤」(시험) · 홈쇼핑 컷: 블렌더 병 A2 회전판 + Remotion 그래픽 · 한 화면 한 사람 · 칼은 그림자로만 · 가상 브랜드",
           font=ImageFont.truetype(FR, 22), fill=(170, 170, 170))
    fb, fr = ImageFont.truetype(FB, 21), ImageFont.truetype(FR, 19)
    for k, (cid, when, what, sound, src) in enumerate(CELLS):
        x = GAP + (k % COLS) * (TW + GAP)
        y = 120 + (k // COLS) * (TH + CAP + GAP)
        kind, name = src.split(":")
        p = os.path.join(V, "정지컷", "색감", f"{name}.jpg") if kind == "stills" else os.path.join(HERE, "remotion", "out", f"{name}.png")
        if os.path.exists(p):
            board.paste(Image.open(p).convert("RGB").resize((TW, TH), Image.LANCZOS), (x, y))
        hs = kind == "hs"
        d.rectangle([x, y + TH, x + TW, y + TH + CAP], fill=(52, 30, 8) if hs else (34, 20, 22))
        d.text((x + 10, y + TH + 8), f"{cid} · {when}초", font=fb, fill=(255, 214, 90) if hs else (240, 120, 120))
        for j, line in enumerate(wrap(d, what, fr, TW - 20, 2)):
            d.text((x + 10, y + TH + 38 + j * 23), line, font=fr, fill=(235, 235, 235))
        for j, line in enumerate(wrap(d, sound, fr, TW - 20, 2)):
            d.text((x + 10, y + TH + 86 + j * 22), line, font=fr, fill=(160, 160, 160))
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "매진임박_이미지콘티.jpg")
    board.save(out, quality=90)
    print(out, board.size)


if __name__ == "__main__":
    main()
