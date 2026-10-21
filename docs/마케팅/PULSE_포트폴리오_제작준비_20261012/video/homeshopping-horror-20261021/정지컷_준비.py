# 「매진 임박」 정지컷 → 가편집용 판(2026-10-21): 고른 정지컷(synk-vendor/…/정지컷/<컷>.png)을 16:9 1920×1080으로 채워 자르고
# 공포 컷 색감 「붉은밤」(../색감/색감.py, 시험)을 입혀 정지컷/색감/<컷>.jpg로. 아직 없는 컷은 컷 이름 · 화면 설명을 적은 어두운 자리표시를 둔다.
#   python -X utf8 정지컷_준비.py [--색감 붉은밤|원본] [--비교]   (--비교: 원본 | 붉은밤 나란히 한 장 정지컷/색감/_비교.jpg)
import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "색감"))
import 색감  # noqa: E402

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
SRC = os.path.join(V, "정지컷")
OUT = os.path.join(SRC, "색감")
W, H = 1920, 1080
FB = "C:/Windows/Fonts/malgunbd.ttf"
CUTS = [c["id"] for c in json.load(open(os.path.join(HERE, "지시문", "정지컷.json"), encoding="utf-8"))["컷"]]
DESC = {"C01": "빈 거실 · 벽에 칼 그림자", "C02": "강도 가슴 위", "C03": "하린 울음", "C04": "지유 입 가리고 울음", "C05": "강도 갸웃",
        "C06": "그림자 칼 들림", "C07": "하린 빌기", "C08": "지유 비명", "C09": "강도 내려다봄", "C10": "그림자 칼 내려감",
        "C11": "강도 휴대폰", "C12": "하린 멍", "C13": "지유 멍", "C14": "강도 눈 · 휴대폰 빛"}


def cover(im):
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((l, t, l + W, t + H))


def placeholder(cid):
    im = Image.new("RGB", (W, H), (34, 8, 10))
    d = ImageDraw.Draw(im)
    d.text((80, 80), cid, font=ImageFont.truetype(FB, 120), fill=(200, 60, 60))
    d.text((80, 240), DESC.get(cid, ""), font=ImageFont.truetype(FB, 64), fill=(220, 200, 200))
    d.text((80, 340), "정지컷 준비 중", font=ImageFont.truetype(FB, 44), fill=(150, 120, 120))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--색감", default="붉은밤")
    ap.add_argument("--비교", action="store_true")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    done, ph, pairs = [], [], []
    for cid in CUTS:
        src = os.path.join(SRC, f"{cid}.png")
        if os.path.exists(src):
            base = cover(Image.open(src).convert("RGB"))
            graded = 색감.grade(base, a.색감) if a.색감 != "원본" else base
            done.append(cid)
            pairs.append((cid, base, graded))
        else:
            graded = placeholder(cid)
            ph.append(cid)
        graded.save(os.path.join(OUT, f"{cid}.jpg"), quality=93)
    print(f"정지컷/색감: {a.색감} {len(done)}장 {done} · 자리표시 {len(ph)}장 {ph}")
    if a.비교 and pairs:
        tw, th = 640, 360
        sheet = Image.new("RGB", (tw * 2 + 30, (th + 40) * len(pairs) + 10), (20, 20, 20))
        d = ImageDraw.Draw(sheet)
        for i, (cid, b, g) in enumerate(pairs):
            y = 10 + i * (th + 40)
            sheet.paste(b.resize((tw, th)), (10, y + 30))
            sheet.paste(g.resize((tw, th)), (tw + 20, y + 30))
            d.text((10, y + 2), f"{cid} 원본", font=ImageFont.truetype(FB, 22), fill=(230, 230, 230))
            d.text((tw + 20, y + 2), f"{cid} {a.색감}", font=ImageFont.truetype(FB, 22), fill=(230, 230, 230))
        sheet.save(os.path.join(OUT, "_비교.jpg"), quality=88)
        print(os.path.join(OUT, "_비교.jpg"))


if __name__ == "__main__":
    main()
