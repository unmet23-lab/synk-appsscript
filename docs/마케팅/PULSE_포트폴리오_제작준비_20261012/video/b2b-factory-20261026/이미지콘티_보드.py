# 10번 이미지 콘티 보드(2026-10-26) — 컷마다 「원본 첫 프레임 | 우리 판」을 나란히, 아래에 초 · 우리 화면 한 줄 · 말. 원본 프레임이 들어가 git 밖에만 둔다.
# 우리 판은 고른 판(콘티/p10/고름/S01.png …)이 있으면 그것, 없으면 받은 판 가운데 가장 최근(받음/ · 받음_gpt/판/)을 쓴다. 우리 판은 원본처럼 약 2:1로 잘라(위아래 띠) 보인다.
#   python -X utf8 이미지콘티_보드.py            → 콘티/p10/보드/p10_이미지콘티_1.jpg …(컷 12개씩)
import json, os, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
P = Path(os.environ["USERPROFILE"]) / "Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10"
SUIT = HERE.parents[4] / "docs/브랜드_폰트/SUIT"
F = lambda w, s: ImageFont.truetype(str(SUIT / f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, CARD = (17, 15, 14), (238, 232, 224), (160, 150, 140), (240, 200, 120), (28, 25, 23)
W, PAD, COLS, PER = 2400, 40, 2, 12
TW = (W - PAD * (COLS + 1)) // COLS        # 칸 폭
OW, UW = int(TW * 0.40), TW - int(TW * 0.40) - 12   # 원본 · 우리 판 폭
ASPECT = 2.0                                # 원본 그림 부분 약 2:1

# 02_콘티.md 2절 표에서 컷마다 초 · 우리 화면 · 말을 읽는다
rows = {}
for line in (HERE / "02_콘티.md").read_text(encoding="utf-8").splitlines():
    m = re.match(r"\|\s*(\d+)\s*\|\s*([\d.–\- ()]+)\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$", line)
    if m and 1 <= int(m.group(1)) <= 37:
        rows[int(m.group(1))] = {"초": m.group(2).strip(), "화면": m.group(3), "말": m.group(5)}


def ours(n):
    k = f"S{n:02d}"
    for p in [P / "고름" / f"{k}.png"]:
        if p.exists():
            return p
    # Gemini 받기는 .jpg로 저장된다(받음/S01_225917.jpg) — png만 찾으면 얼굴 컷이 보드에서 빠진다
    cands = sorted([p for d in ("받음", "받음_gpt/판") for ext in ("png", "jpg") for p in (P / d).glob(f"{k}_*.{ext}")], key=lambda p: p.stat().st_mtime)
    return cands[-1] if cands else None


def crop2(im):
    w, h = im.size
    nh = int(w / ASPECT)
    y0 = (h - nh) // 2
    return im.crop((0, max(0, y0), w, min(h, y0 + nh)))


def clean(s):
    s = re.sub(r"\*\*(.*?)\*\*", r"\1", s)
    return s.replace("—", "-").replace("–", "~")


def wrap(d, text, font, width, maxl=3):
    out, cur = [], ""
    for ch in clean(text):
        if d.textlength(cur + ch, font=font) > width:
            out.append(cur)
            cur = ch
        else:
            cur += ch
    out.append(cur)
    return out[:maxl] if len(out) <= maxl else out[:maxl - 1] + [out[maxl - 1][:-1] + "…"]


def board(nums, idx):
    oh, uh = int(OW / ASPECT), int(UW / ASPECT)
    cell_h = uh + 24 + 3 * 28 + 2 * 26 + 30
    nrow = (len(nums) + COLS - 1) // COLS
    H = 140 + nrow * (cell_h + PAD) + 40
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((PAD, 30), f"10번 B2B 제조 홍보영상 60초 - 이미지 콘티 {idx}(원본 첫 프레임 | 우리 판)", font=F("ExtraBold", 40), fill=INK)
    d.text((PAD, 86), "원본 GE Aerospace 「Emotional Launch」 37컷의 자리 · 크기 · 카메라를 그대로 · 우리 판은 가상 제조사의 발전용 가스터빈 · 얼굴은 준호만", font=F("Medium", 24), fill=DIM)
    for i, n in enumerate(nums):
        cx = PAD + (i % COLS) * (TW + PAD)
        cy = 140 + (i // COLS) * (cell_h + PAD)
        d.rounded_rectangle([cx - 10, cy - 10, cx + TW + 10, cy + cell_h], radius=12, fill=CARD)
        o = Image.open(P / "원본첫프레임" / f"S{n:02d}.png").convert("RGB")
        o = o.crop((0, 25, o.width, o.height - 25)).resize((OW, oh), Image.LANCZOS)
        img.paste(o, (cx, cy + (uh - oh)))
        u = ours(n)
        if u:
            ui = crop2(Image.open(u).convert("RGB")).resize((UW, uh), Image.LANCZOS)
            img.paste(ui, (cx + OW + 12, cy))
        else:
            d.rectangle([cx + OW + 12, cy, cx + TW, cy + uh], outline=DIM, width=2)
            d.text((cx + OW + 40, cy + uh // 2 - 14), "굽는 중", font=F("SemiBold", 28), fill=DIM)
        r = rows.get(n, {})
        d.text((cx + 4, cy + 4), f"{n}", font=F("Heavy", 30), fill=(255, 230, 0), stroke_width=3, stroke_fill=(0, 0, 0))
        y = cy + uh + 12
        d.text((cx, y), clean(r.get("초", "")), font=F("SemiBold", 22), fill=GOLD)
        y += 30
        for ln in wrap(d, r.get("화면", ""), F("Medium", 22), TW, 3):
            d.text((cx, y), ln, font=F("Medium", 22), fill=INK)
            y += 28
        mal = r.get("말", "")
        if mal and mal != "—":
            for ln in wrap(d, "말 · 글  " + mal, F("Medium", 20), TW, 2):
                d.text((cx, y), ln, font=F("Medium", 20), fill=(170, 200, 240))
                y += 26
    out = P / "보드" / f"p10_이미지콘티_{idx}.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, quality=88)
    print(out, img.size)


if __name__ == "__main__":
    ns = list(range(1, 38))
    for k in range(0, len(ns), PER):
        board(ns[k:k + PER], k // PER + 1)
