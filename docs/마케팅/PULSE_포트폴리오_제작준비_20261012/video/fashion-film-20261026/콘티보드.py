# 4번 「결채 — 한 벌」 이미지 콘티 보드(2026-10-26) — 행마다: 원본 첫 프레임 | 우리 그림 | 초 · 우리 화면 · 카메라 · 소리. 6번 콘티보드.py와 같은 꼴.
# 글은 02_콘티.md 2절 표에서 그대로 읽는다. 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/p4/보드/)에만 둔다.
#   python -X utf8 콘티보드.py   → 콘티/p4/보드/결채_이미지콘티_1~4.jpg · _한눈.jpg(우리 그림만) · 결채_룩북.jpg(6장)
# 우리 그림은 콘티/p4/컷/<번호>.png(고른 판 — 색 손대지 않음). 없으면 받음/의 가장 최근 판을 쓴다. 흰 빛 번쩍(10 · 17a · 31)은 흰 칸,
# 1은 검은 칸, 끝 화면은 우리 그림 위에 「결채」를 얹은 시안(후반 글자 자리를 보이려는 것 — 그림에는 굽지 않았다).
# 카메라가 크게 움직이는 컷은 원본 칸 오른쪽 아래에 원본 끝 프레임을 작게 얹는다(콘티/p4/원본끝프레임/, 10-26 밤 카메라 다시 재기).
import glob
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p4")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, LINE = (17, 16, 18), (236, 234, 230), (160, 156, 150), (240, 200, 120), (60, 58, 62)
TW, TH = 560, 315
WHITE = {"10", "17a", "31"}


def clean(s):
    return re.sub(r"\*\*", "", s).replace("–", "~").replace("—", "-").replace("→", ">")


def rows_from_02():
    md = open(os.path.join(HERE, "02_콘티.md"), encoding="utf-8").read()
    sec = md[md.index("## 2. 컷별 글 콘티"):md.index("## 3.")]
    out = []
    for line in sec.splitlines():
        m = re.match(r"\|\s*(\d+a?|끝)\s*\|(.+)\|\s*$", line)
        if not m:
            continue
        c = [x.strip() for x in m.group(2).split("|")]
        out.append({"n": m.group(1), "t": clean(c[0]), "ours": clean(c[1]), "cam": clean(c[2]), "light": clean(c[3]), "face": clean(c[4]), "snd": clean(c[5])})
    return out


def cid(n):
    return "CEND" if n == "끝" else f"C{int(re.sub(r'a$', '', n)):02d}" + ("a" if n.endswith("a") else "")


def latest(i):
    pick = os.path.join(V, "컷", f"{i}.png")
    if os.path.exists(pick):
        return pick
    got = sorted(glob.glob(os.path.join(V, "받음", f"{i}_*.png")) + glob.glob(os.path.join(V, "받음", f"{i}_*.jpg")), key=os.path.getmtime)
    return got[-1] if got else None


def fit(path, w, h):
    im = Image.open(path).convert("RGB")
    r = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * r + 0.5), int(im.height * r + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def box(text, fill):
    im = Image.new("RGB", (TW, TH), fill)
    ImageDraw.Draw(im).text((20, 18), text, font=F("Medium", 22), fill=DIM if fill != (250, 250, 250) else (90, 90, 90))
    return im


def ours(n):
    if n in WHITE:
        return box("흰 빛 번쩍", (250, 250, 250))
    if n == "1":
        return box("검은 화면", (0, 0, 0))
    i = cid(n)
    p = latest(i)
    if not p:
        return box("아직 굽지 않음", (40, 38, 42))
    im = fit(p, TW, TH)
    if n == "끝":
        d = ImageDraw.Draw(im)
        f = F("Medium", 64)
        w = d.textlength("결채", font=f)
        d.text(((TW - w) / 2, TH / 2 - 40), "결채", font=f, fill=(245, 240, 232))
    if n == "21":
        e = latest("C21e")
        if e:
            im.paste(fit(e, TW // 3, TH // 3), (TW - TW // 3 - 8, TH - TH // 3 - 8))
    return im


def orig(n):
    if n in WHITE:
        return box("흰 빛 번쩍", (250, 250, 250))
    if n == "1":
        return box("검은 화면", (0, 0, 0))
    p = os.path.join(V, "원본첫프레임", f"{cid(n)}.jpg")
    if not os.path.exists(p):
        return box("원본 프레임 없음", (40, 38, 42))
    im = fit(p, TW, TH)
    # 카메라가 3% 넘게 움직이는 컷은 원본 끝 프레임을 오른쪽 아래에 작게(16_카메라_프레임별.py가 뽑는다)
    e = os.path.join(V, "원본끝프레임", f"{cid(n)}.jpg")
    if os.path.exists(e):
        w, h = TW // 3, TH // 3
        im.paste(fit(e, w, h), (TW - w - 8, TH - h - 8))
        d = ImageDraw.Draw(im)
        d.rectangle([TW - w - 8, TH - h - 8, TW - 8, TH - 8], outline=GOLD, width=2)
        d.text((TW - w - 2, TH - h - 6), "끝", font=F("SemiBold", 18), fill=GOLD)
    return im


def wrap(d, s, f, w):
    lines, cur = [], ""
    for ch in s:
        if d.textlength(cur + ch, font=f) > w:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def page(rows, k, total):
    W = 40 + TW * 2 + 30 + 900 + 40
    H = 120 + len(rows) * (TH + 24) + 40
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 30), f"4번 패션 필름 「결채 - 한 벌」 이미지 콘티 {k}/{total} - 원본 첫 프레임 | 우리 그림", font=F("ExtraBold", 38), fill=INK)
    d.text((40, 80), "원본: 감독 Yeio 「MARAH (SS25)」 앞 26.28초 + 끝 화면 · 우리: 유나 · 결채 가을 트렌치 한 벌 · 스튜디오 · 억새밭 · 황토 흙담 빈 한옥", font=F("Medium", 22), fill=DIM)
    y = 120
    for r in rows:
        im.paste(orig(r["n"]), (40, y))
        im.paste(ours(r["n"]), (40 + TW + 10, y))
        tx = 40 + TW * 2 + 30
        d.text((tx, y), f"{r['n']}  {r['t']}", font=F("ExtraBold", 30), fill=GOLD)
        yy = y + 44
        for label, val, col in (("우리", r["ours"], INK), ("카메라", r["cam"], DIM), ("빛", r["light"], DIM), ("소리", r["snd"], DIM)):
            for line in wrap(d, f"{label}  {val}", F("Medium", 21), 880)[:3]:
                d.text((tx, yy), line, font=F("Medium", 21), fill=col)
                yy += 28
        y += TH + 24
        d.line([(40, y - 12), (W - 40, y - 12)], fill=LINE)
    return im


def lookbook():
    ims = [latest(f"L{i}") for i in range(1, 7)]
    w, h = 600, 750   # 4:5로 자르기만
    sheet = Image.new("RGB", (40 + 3 * (w + 20) + 20, 140 + 2 * (h + 70)), (236, 232, 226))
    d = ImageDraw.Draw(sheet)
    d.text((40, 40), "결채 26 가을 - 한 벌 룩북 6장(유나)", font=F("ExtraBold", 40), fill=(40, 36, 34))
    for k, p in enumerate(ims):
        x, y = 40 + (k % 3) * (w + 20), 120 + (k // 3) * (h + 70)
        sheet.paste(fit(p, w, h) if p else Image.new("RGB", (w, h), (200, 196, 190)), (x, y))
        d.text((x, y + h + 14), f"LOOK {k + 1}", font=F("SemiBold", 24), fill=(60, 56, 52))
    return sheet


def main():
    rows = rows_from_02()
    os.makedirs(os.path.join(V, "보드"), exist_ok=True)
    per = 9
    chunks = [rows[i:i + per] for i in range(0, len(rows), per)]
    for k, ch in enumerate(chunks, 1):
        page(ch, k, len(chunks)).save(os.path.join(V, "보드", f"결채_이미지콘티_{k}.jpg"), quality=86)
    # 한눈: 우리 그림만 6열
    cols, tw, th = 6, 320, 180
    sh = Image.new("RGB", (cols * tw, ((len(rows) + cols - 1) // cols) * (th + 26)), BG)
    d = ImageDraw.Draw(sh)
    for k, r in enumerate(rows):
        x, y = (k % cols) * tw, (k // cols) * (th + 26)
        sh.paste(ours(r["n"]).resize((tw, th)), (x, y + 26))
        d.text((x + 6, y + 2), f"{r['n']}  {r['t']}", font=F("Medium", 18), fill=GOLD)
    sh.save(os.path.join(V, "보드", "결채_이미지콘티_한눈.jpg"), quality=86)
    lookbook().save(os.path.join(V, "보드", "결채_룩북.jpg"), quality=88)
    print(len(rows), "행", len(chunks), "쪽")


if __name__ == "__main__":
    main()
