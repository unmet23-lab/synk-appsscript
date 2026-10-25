# 콘티 v5 이미지 콘티 보드(2026-10-25) — Seedance에 넣을 시작 · 끝 그림을 원본 컷 프레임과 나란히.
# 줄마다: 원본 컷 첫 프레임 | v5 시작 그림(Gemini 2.1 받은 그대로를 16:9로 자르기만) | 초 · 원본 · 영상(Seedance) · 말.
# 끝 그림이 있는 #5 · #24 · #26은 한 줄 더: 원본 컷 끝 프레임 | v5 끝 그림. 글은 지시문/영상_v5.json(원본 · 요약 · 대사)에서 읽는다.
# 원본 프레임이 들어가므로 보드는 git 밖(synk-vendor/…/콘티/)에만 둔다.
#   python -X utf8 콘티보드_v5.py   → 콘티/매진임박_이미지콘티_v5_1~4.jpg(8줄씩) · _한눈.jpg(시작 그림 27칸)
import importlib.util
import json
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
SH = json.load(open(os.path.join(V, "원본", "원본_샷.json"), encoding="utf-8"))
START = os.path.join(V, "영상", "시작_v5")
OUT = os.path.join(V, "콘티")
BG, INK, DIM, GOLD, LINE, NOTE = (17, 15, 14), (238, 232, 224), (160, 150, 140), (240, 200, 120), (60, 54, 50), (236, 170, 120)
clean = lambda s: s.replace("–", "~").replace("—", "-").replace("…", "...").replace("「", "'").replace("」", "'")

# 얼굴 닮음(SFace, 같은 사람 기준선 0.363) — v4 모듈을 그대로 쓴다
_spec = importlib.util.spec_from_file_location("sim", os.path.join(HERE, "이미지콘티_v4_닮음.py"))
SIM = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SIM)
WHO = {"S07": ["A 지유"], "S12": ["A 지유"], "S14": ["A 지유"], "S18": ["A 지유"], "S08": ["B 리4"], "S17": ["B 리4"], "S20": ["B 리4"],
       "S22": ["B 리4"], "S16": ["C 통2"], "S28": ["C 통2"], "S30": ["C 통2"], "S26e": ["C 통2"], "S10": ["C 통2", "B 리4", "A 지유"],
       "S05e": ["C 통2", "B 리4", "A 지유"]}


def likeness(cid, img, RF):
    want = WHO.get(cid)
    if not want:
        return ""
    fl = SIM.faces(cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR))
    if not fl:
        return "얼굴 못 찾음"
    if len(want) == 1:
        f = max(fl, key=lambda t: SIM.score(t[1], RF[want[0]]))[1]
        return f"닮음 {want[0].split()[1]} {SIM.score(f, RF[want[0]]):.2f}"
    if len(fl) != len(want):
        return f"얼굴 {len(fl)}개 찾음"
    return "닮음 " + " · ".join(f"{w.split()[1]} {SIM.score(f, RF[w]):.2f}" for (_, f), w in zip(fl, want))


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


def frame(n, last=False):
    f = SH[n - 1]["f1"] - 1 if last else SH[n - 1]["f0"]
    return Image.open(os.path.join(V, "검수", "fable_v4콘티", "frames", "%04d.jpg" % (f + 1))).convert("RGB")


def ours(cid):
    p = os.path.join(START, f"{cid}.jpg")
    return Image.open(p).convert("RGB") if os.path.exists(p) else None


def rows_of(spec):
    rows = []
    for c in spec["클립"]:
        n = c["컷"]
        t, _, orig = c["원본"].partition(") ")
        ref = c.get("소리 참고")
        use = c["쓰는 구간"]
        tech = f"Seedance {c['길이']}초 · 쓰는 구간 {use[0]:.2f}초부터 {use[1]:.2f}초 · " + ("소리 참고(한국어 목소리)로 입모양" if ref else "말 없음 · 소리 참고 없음")
        rows.append({"cid": c["id"], "n": n, "t": clean(t + ")"), "orig": clean(orig), "video": clean(c["요약"]), "say": clean(c["대사"]), "tech": tech, "end": False})
        if c.get("끝 그림"):
            rows.append({"cid": c["id"] + "e", "n": n, "t": "끝 그림", "orig": "원본 컷 끝 프레임과 견준다",
                         "video": "영상이 이 그림으로 끝나게 끝 칸에 건다. 얼굴 없이 시작하는 컷에서 같은 사람으로 이어지게(10-25 #5 방법)", "say": "", "tech": "", "end": True})
    return rows


def board(rows, path, page, pages, RF):
    TW, TH, TXT = 576, 324, 940
    RH = TH + 28
    Wd = 40 + TW * 2 + 24 + TXT + 40
    Hd = 196 + RH * len(rows) + 30
    im = Image.new("RGB", (Wd, Hd), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 30), "매진 임박 · 이미지 콘티 v5  ·  Seedance 시작 그림(후보정 없음)", font=F("ExtraBold", 40), fill=INK)
    d.text((40, 90), f"{page}/{pages}   왼쪽: 원본 컷 첫 프레임 · 가운데: v5 시작 그림(Gemini 2.1 받은 그대로를 16:9로 자르기만, 색 옮기기 · 밝히기 없음) · 오른쪽: 초 · 원본 · 영상 지시 · 말", font=F("Medium", 22), fill=DIM)
    d.text((40, 126), "빛은 지시문으로 굽는다(낮은 노출 · 부드러운 대비 · 갈색 그림자 · 얼굴은 옆에서 흐리게). 「끝 그림」 줄은 원본 컷 끝 프레임과 견준다. 닮음은 같은 사람 기준선 0.363.", font=F("Medium", 22), fill=NOTE)
    for i, r in enumerate(rows):
        y = 196 + i * RH
        im.paste(frame(r["n"], last=r["end"]).resize((TW, TH)), (40, y))
        if r["end"]:
            d.rectangle([40, y, 40 + 150, y + 30], fill=(0, 0, 0))
            d.text((48, y + 3), "원본 끝 프레임", font=F("SemiBold", 20), fill=GOLD)
        b = ours(r["cid"])
        if b is not None:
            im.paste(b.resize((TW, TH)), (40 + TW + 12, y))
        else:
            d.rectangle([40 + TW + 12, y, 40 + 2 * TW + 12, y + TH], outline=LINE, width=2)
            d.text((40 + TW + 40, y + TH // 2 - 14), "(아직)", font=F("Medium", 26), fill=DIM)
        x = 40 + TW * 2 + 36
        d.text((x, y - 2), f"#{r['n']}", font=F("Heavy", 44), fill=GOLD)
        d.text((x + 100, y + 10), r["t"], font=F("ExtraBold", 26), fill=INK)
        sim = likeness(r["cid"], b, RF) if b is not None else ""
        if sim:
            d.text((x + 100 + d.textlength(r["t"], font=F("ExtraBold", 26)) + 20, y + 14), sim, font=F("SemiBold", 21), fill=DIM)
        yy = y + 60
        for label, key, fnt, col, cap in (("원본", "orig", F("Medium", 21), DIM, 2), ("영상", "video", F("SemiBold", 22), INK, 4),
                                          ("말", "say", F("SemiBold", 22), (250, 214, 160), 2)):
            if not r[key]:
                continue
            d.text((x, yy), label, font=F("ExtraBold", 21), fill=GOLD)
            for ln in wrap(d, r[key], fnt, TXT - 70)[:cap]:
                d.text((x + 64, yy), ln, font=fnt, fill=col)
                yy += 28
            yy += 5
        if r["tech"]:
            d.text((x, yy), r["tech"], font=F("Medium", 19), fill=DIM)
        d.line([(40, y + TH + 13), (Wd - 40, y + TH + 13)], fill=LINE, width=1)
    im.save(path, quality=88)
    print(path, im.size)


def glance(rows, path):
    starts = [r for r in rows if not r["end"]]
    TW, TH, C = 384, 216, 6
    R = (len(starts) + C - 1) // C
    im = Image.new("RGB", (40 + C * (TW + 10), 120 + R * (TH + 44)), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 34), "매진 임박 · 이미지 콘티 v5  ·  공포 컷 27개 시작 그림(광고 카드 넷은 블렌더 · 그대로)", font=F("ExtraBold", 34), fill=INK)
    for k, r in enumerate(starts):
        x, y = 40 + (k % C) * (TW + 10), 110 + (k // C) * (TH + 44)
        b = ours(r["cid"])
        if b is not None:
            im.paste(b.resize((TW, TH)), (x, y))
        d.text((x, y + TH + 6), f"#{r['n']}  {r['t']}", font=F("SemiBold", 20), fill=INK)
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__":
    spec = json.load(open(os.path.join(HERE, "지시문", "영상_v5.json"), encoding="utf-8"))
    rows = rows_of(spec)
    RF = SIM.ref_feats()
    per = 8
    pages = [rows[i:i + per] for i in range(0, len(rows), per)]
    for i, rs in enumerate(pages):
        board(rs, os.path.join(OUT, f"매진임박_이미지콘티_v5_{i + 1}.jpg"), i + 1, len(pages), RF)
    glance(rows, os.path.join(OUT, "매진임박_이미지콘티_v5_한눈.jpg"))
