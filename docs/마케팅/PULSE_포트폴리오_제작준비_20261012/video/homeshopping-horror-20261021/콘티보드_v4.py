# 콘티 v4 이미지 콘티 보드(2026-10-23) — 31행: 원본 첫 프레임 | 우리 그림 | 초 · 원본 화면 · 우리 화면 · 말.
# 글은 04_콘티_v4_원본그대로.md 3절 샷표에서 그대로 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/)에만 둔다.
#   python -X utf8 콘티보드_v4.py   → 콘티/매진임박_이미지콘티_v4_1~4.jpg(8행씩) · _한눈.jpg(31칸) · 매진임박_옷비교_v4.jpg
# 우리 그림은 콘티/v4/컷/S01.jpg …(공포 컷은 원본 자리 · 빛에 맞춘 판, 카드는 카드합성_v4.py 시안).
import json
import os
import re
import textwrap

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
SH = json.load(open(os.path.join(V, "원본", "원본_샷.json"), encoding="utf-8"))
CUTS = os.path.join(V, "콘티", "v4", "컷")
OUT = os.path.join(V, "콘티")
BG, INK, DIM, GOLD, LINE = (17, 15, 14), (238, 232, 224), (160, 150, 140), (240, 200, 120), (60, 54, 50)


def rows_from_04():
    md = open(os.path.join(HERE, "04_콘티_v4_원본그대로.md"), encoding="utf-8").read()
    sec = md[md.index("## 3. v4 샷표"):md.index("## 4.")]
    out = {}
    for line in sec.splitlines():
        m = re.match(r"\|\s*(\d+)\s*\|(.+)\|\s*$", line)
        if not m:
            continue
        cells = [c.strip() for c in m.group(2).split("|")]
        # SUIT에 없는 글자(– · 〃)는 보드에서 바꿔 쓴다
        clean = lambda s: re.sub(r"\*\*", "", s).replace("–", "~").replace("—", "-").replace("〃", "(위 줄과 같음)")
        n = int(m.group(1))
        out[n] = {"t": clean(cells[0]), "orig": clean(cells[1]), "ours": RESULT.get(n, clean(cells[2])), "say": clean(cells[3])}
    return out


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


CARDS = {11, 21, 27, 29}
# 보드의 「우리」 칸은 3절 샷표(계획)를 읽는다 — 받은 그림이 계획과 다른 컷만 결과를 덧붙인다(Fable 10-23 P2)
RESULT = {10: "같음 — 셋이 붙어 앉아 모두 왼쪽 위 · 지유가 오른쪽에서 가장 큼(소파 오른쪽 끝에서 본 사선은 원본보다 정면에 가깝다)"}


def frame(n):
    # 광고 카드는 첫 프레임이 빈 바탕이라(카드 1 빈 갈색 · ? 빈 거실) 글자가 다 붙은 끝 프레임으로 견준다
    f = SH[n - 1]["f1"] - 1 if n in CARDS else SH[n - 1]["f0"]
    return Image.open(os.path.join(V, "검수", "fable_v4콘티", "frames", "%04d.jpg" % (f + 1))).convert("RGB")


def ours(n):
    p = os.path.join(CUTS, f"S{n:02d}.jpg")
    return Image.open(p).convert("RGB") if os.path.exists(p) else None


def board(rows, ns, path, page, pages):
    TW, TH = 576, 324
    TXT = 900
    RH = TH + 28
    Wd = 40 + TW * 2 + 24 + TXT + 40
    Hd = 186 + RH * len(ns) + 30
    im = Image.new("RGB", (Wd, Hd), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "매진 임박 · 이미지 콘티 v4  ·  원본 릴스의 컷 · 초 · 구도 그대로", font=F("ExtraBold", 40), fill=INK)
    d.text((40, 92), f"{page}/{pages}   왼쪽: 원본 컷 첫 프레임(광고 카드는 끝 프레임) · 가운데: 우리 그림(같은 카메라 자리 · 크기 · 빛) · 오른쪽: 초 · 화면 · 말  ·  광고 카드는 손 + 블렌더 물건 + 글자 시안", font=F("Medium", 22), fill=DIM)
    d.text((40, 128), "탁자 · 벽 액자의 파스텔 용기 · 상자는 자리 표시(AI 그림)다 — 영상 시작 그림에서 블렌더 렌더로 바꾼다. 강도 손 · 광고 카드의 제품은 블렌더 렌더.", font=F("Medium", 22), fill=(236, 170, 120))
    for i, n in enumerate(ns):
        y = 186 + i * RH
        r = rows[n]
        a = frame(n).resize((TW, TH))
        im.paste(a, (40, y))
        if n in CARDS:
            d.rectangle([40, y, 40 + 150, y + 30], fill=(0, 0, 0))
            d.text((48, y + 3), "원본 끝 프레임", font=F("SemiBold", 20), fill=GOLD)
        b = ours(n)
        if b is not None:
            im.paste(b.resize((TW, TH)), (40 + TW + 12, y))
        else:
            d.rectangle([40 + TW + 12, y, 40 + 2 * TW + 12, y + TH], outline=LINE, width=2)
            d.text((40 + TW + 40, y + TH // 2 - 14), "(아직)", font=F("Medium", 26), fill=DIM)
        x = 40 + TW * 2 + 36
        d.text((x, y - 2), f"#{n}", font=F("Heavy", 44), fill=GOLD)
        d.text((x + 96, y + 10), r["t"], font=F("Bold" if os.path.exists(os.path.join(SUIT, "SUIT-Bold.otf")) else "ExtraBold", 26), fill=INK)
        yy = y + 64
        for label, key, fnt, col in (("원본", "orig", F("Medium", 21), DIM), ("우리", "ours", F("SemiBold", 23), INK), ("말", "say", F("SemiBold", 23), (250, 214, 160))):
            d.text((x, yy), label, font=F("ExtraBold", 21), fill=GOLD)
            for ln in wrap(d, r[key], fnt, TXT - 70)[:4 if key == "orig" else 3]:
                d.text((x + 64, yy), ln, font=fnt, fill=col)
                yy += 29
            yy += 6
        d.line([(40, y + TH + 13), (Wd - 40, y + TH + 13)], fill=LINE, width=1)
    im.save(path, quality=88)
    print(path, im.size)


def glance(rows, path):
    """우리 그림 31칸 한 장(폰에서 흐름을 한 번에)"""
    TW, TH, C = 384, 216, 6
    R = (31 + C - 1) // C
    im = Image.new("RGB", (40 + C * (TW + 10), 120 + R * (TH + 44)), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "매진 임박 · 이미지 콘티 v4  ·  우리 그림 31컷(72.7초)", font=F("ExtraBold", 36), fill=INK)
    for n in range(1, 32):
        x, y = 40 + ((n - 1) % C) * (TW + 10), 110 + ((n - 1) // C) * (TH + 44)
        b = ours(n)
        if b is not None:
            im.paste(b.resize((TW, TH)), (x, y))
        d.text((x, y + TH + 6), f"#{n}  {rows[n]['t']}", font=F("SemiBold", 20), fill=INK)
    im.save(path, quality=88)
    print(path, im.size)


def outfits(path):
    """옷 두 안: 셋 × (원본 꼴 리본 · 코케트 / 지금 옷)"""
    st = os.path.join(V, "정지컷", "v4")
    people = [("A 지유", "O_A1", "O_A2", "흰 레이스 베일 · 흰 새틴 원피스 · 진주", "크림 니트 가디건"),
              ("B 리4", "O_B1", "O_B2", "빨간 깅엄 · 빨간 리본 · 머리 위 하트 선글라스 · 양갈래(안경은 쓴 채)", "초록 스웨터 · 안경"),
              ("C 통2", "O_C1", "O_C2", "장미 꽃관 · 흰 크롭 티(작은 하트) · 검정 반바지", "보라 물방울 잠옷")]
    TW, TH = 540, 720
    Wd = 40 + 260 + 2 * (TW + 30) + 20
    Hd = 230 + 3 * (TH + 110)
    im = Image.new("RGB", (Wd, Hd), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "매진 임박 · 피해자 셋의 옷 두 안", font=F("ExtraBold", 44), fill=INK)
    d.text((40, 100), "왼쪽: 원본 꼴 리본 · 코케트(기본 추천: 셋째 물건 「리본 묶은 떡볶이」와 운이 맞는다) · 오른쪽: 지금 옷", font=F("Medium", 24), fill=DIM)
    d.text((40, 134), "탁자의 파스텔 용기 · 벽 액자 상자는 자리 표시(AI 그림) — 영상 단계에서 블렌더 렌더로 바꾼다 · 지금 옷을 고르면 피해자가 나오는 컷을 그 옷으로 다시 굽는다", font=F("Medium", 20), fill=(236, 170, 120))
    for i, (who, a, b, ta, tb) in enumerate(people):
        y = 200 + i * (TH + 110)
        d.text((40, y + TH // 2 - 30), who, font=F("Heavy", 46), fill=GOLD)
        for j, (cid, cap) in enumerate(((a, "코케트: " + ta), (b, "지금 옷: " + tb))):
            x = 300 + j * (TW + 30)
            p = os.path.join(st, f"{cid}.png")
            if os.path.exists(p):
                o = Image.open(p).convert("RGB")
                o.thumbnail((TW, TH))
                im.paste(o, (x + (TW - o.width) // 2, y))
            else:
                d.rectangle([x, y, x + TW, y + TH], outline=LINE, width=2)
            for k, ln in enumerate(wrap(d, cap, F("SemiBold", 24), TW)[:2]):
                d.text((x, y + TH + 12 + k * 32), ln, font=F("SemiBold", 24), fill=INK if j == 0 else DIM)
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__":
    rows = rows_from_04()
    assert len(rows) == 31, len(rows)
    pages = [list(range(1, 9)), list(range(9, 17)), list(range(17, 25)), list(range(25, 32))]
    for i, ns in enumerate(pages):
        board(rows, ns, os.path.join(OUT, f"매진임박_이미지콘티_v4_{i + 1}.jpg"), i + 1, len(pages))
    glance(rows, os.path.join(OUT, "매진임박_이미지콘티_v4_한눈.jpg"))
    outfits(os.path.join(OUT, "매진임박_옷비교_v4.jpg"))
