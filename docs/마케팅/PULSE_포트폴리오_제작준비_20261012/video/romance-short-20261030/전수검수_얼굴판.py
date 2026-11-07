# 11-07 밤 유호님 「사람이 자꾸 바뀐다」 뒤 전수 검수에 쓴 판 만들기(Claude) — 결과 · 보고는 git 밖 콘티/romance/검수/전수_20261107/, 요지는 02_콘티 10절.
# 다시 만든 판을 볼 때도 같은 셋을 돌린다: 전수검수_판.py(원본 나란히 · 8장 움직임 띠) → 전수검수_얼굴.py(배역별 얼굴 조각, 자리로 나눔) → 전수검수_얼굴판.py <배역> [무리.json].
# 배역별 얼굴 조각판 — 컷 차례 또는 무리(같은 얼굴끼리) 차례로. 칸 위 글: 컷 · 시작 그림 엔진(G = Gemini 11-07 · P = 10-31 GPT 판 · X = 11-07 Codex 고침) · 기계 닮음
#   python 얼굴판_배역.py 태준 [무리.json]
import os, sys, json
from PIL import Image, ImageDraw, ImageFont

S = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance/검수/전수_20261107"
GEM = set("C02 C03 C04 C05 C07 C08 C09 C11 C12 C13 C14 C16 C17 C19 C20 C22 C23 C24 C25 C27 C29 C31 C34 C36 C37 C38 C39 C41 C42 C43 C44 C45 C47 C49 C50 C51 C52 C53 C54 C55 C57 C58 C59 C60 C61 C62 C63 C66 C68 C70".split())
COD = set("C15 C28 C30 C32 C48 C56 C64 C67".split())
SECOND = set("C10 C16 C29 C31 C37 C68".split())


def eng(c):
    e = "X" if c in COD else ("G" if c in GEM else "P")
    return e + ("²" if c in SECOND else "")


FONT = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 22)
SMALL = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 18)
TW, TH = 200, 240


def tile(img, label, sub=""):
    t = Image.new("RGB", (TW, TH + 34), (16, 16, 16))
    im = img.copy()
    im.thumbnail((TW, TH))
    t.paste(im, ((TW - im.width) // 2, 34 + (TH - im.height) // 2))
    d = ImageDraw.Draw(t)
    d.text((6, 4), label, font=FONT, fill=(255, 230, 80))
    if sub:
        d.text((TW - 6 - d.textlength(sub, font=SMALL), 8), sub, font=SMALL, fill=(200, 200, 200))
    return t


def main():
    role = sys.argv[1]
    meta = json.load(open(os.path.join(S, "얼굴", "조각.json"), encoding="utf-8"))
    cuts = sorted([k.split("_")[1] for k in meta if k.startswith(role + "_")])
    groups = [("", cuts)]
    if len(sys.argv) > 2:
        groups = json.load(open(sys.argv[2], encoding="utf-8"))
    rows = []
    if role == "태준":
        U = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/참조_유호"   # 승인 얼굴 세트(유호님)
        refs = [("기준 B", f"{U}/1_B정면.jpg"), ("기준 C", f"{U}/2_C정면.jpg"), ("실제 사진", f"{U}/3_실제_pro02.jpg")]
        rows.append(("승인 얼굴 세트(유호님)", [tile(Image.open(os.path.join(S, p)).convert("RGB"), n) for n, p in refs]))
    for title, cs in groups:
        ts = []
        for c in cs:
            k = f"{role}_{c}"
            if k not in meta:
                continue
            im = Image.open(os.path.join(S, "얼굴", "조각", k + ".jpg")).convert("RGB")
            ts.append(tile(im, f"{c} {eng(c)}", f"{meta[k]['닮음']:.2f}"))
        if ts:
            rows.append((title, ts))
    per = 10
    lines = []
    for title, ts in rows:
        chunks = [ts[i:i + per] for i in range(0, len(ts), per)]
        for j, ch in enumerate(chunks):
            lines.append((title if j == 0 else "", ch))
    Wd = per * TW + (per + 1) * 6
    Hd = sum((TH + 34 + 12 + (34 if t else 0)) for t, _ in lines) + 10
    sheet = Image.new("RGB", (Wd, Hd), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    y = 6
    for t, ch in lines:
        if t:
            d.text((8, y), t, font=FONT, fill=(255, 255, 255))
            y += 34
        x = 6
        for tt in ch:
            sheet.paste(tt, (x, y))
            x += TW + 6
        y += TH + 34 + 12
    out = os.path.join(S, "얼굴", f"배역_{role}{'_무리' if len(sys.argv) > 2 else ''}.jpg")
    sheet.save(out, quality=88)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
