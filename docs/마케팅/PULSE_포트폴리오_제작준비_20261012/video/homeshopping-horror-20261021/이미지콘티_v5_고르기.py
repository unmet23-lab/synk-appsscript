# 콘티 v5 이미지 콘티 고르기 판(2026-10-25): 원본 컷 첫 프레임(끝 그림은 끝 프레임) | 받은 그대로의 판들 — 판마다 빛 숫자 · 얼굴 상자 · 닮음.
#   python -X utf8 이미지콘티_v5_고르기.py S07 S08 S05e …   → synk-vendor/…/콘티/v5/고르기/<첫 컷>_외.jpg (원본 프레임이 들어가 git 밖)
# 받은 판은 받음/v5/<컷><판 글자>_<시각>.jpg를 모두 찾는다(S07a · S07b · S07_171230 …). 빛은 L 5/50/95 분위 · a · b 평균 · 밝기 120 넘는 화소 비,
# 얼굴은 YuNet 상자의 화면 비(위~아래 · 가로), 닮음은 SFace(같은 사람 기준선 0.363 — 이미지콘티_v4_닮음.py). 결정 10-24대로 받은 그대로를 잰다.
import glob
import importlib.util
import json
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
V = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/"
SH = json.load(open(V + "원본/원본_샷.json", encoding="utf-8"))
_spec = importlib.util.spec_from_file_location("sim", os.path.join(HERE, "이미지콘티_v4_닮음.py"))
SIM = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SIM)
WHO = {7: ["A 지유"], 12: ["A 지유"], 14: ["A 지유"], 18: ["A 지유"], 8: ["B 리4"], 17: ["B 리4"], 20: ["B 리4"], 22: ["B 리4"],
       16: ["C 통2"], 28: ["C 통2"], 30: ["C 통2"], 26: ["C 통2"], 10: ["C 통2", "B 리4", "A 지유"], 5: ["C 통2", "B 리4", "A 지유"]}
FONT = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)


def imread(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def light(im):
    im = cv2.resize(im, (720, int(720 * im.shape[0] / im.shape[1])), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    return f"L {np.percentile(L, 5):.0f}/{np.percentile(L, 50):.0f}/{np.percentile(L, 95):.0f} a{a.mean():.0f} b{b.mean():.0f} 밝{100 * (g > 120).mean():.1f}%"


def facebox(im):
    s = 960 / im.shape[1]
    sm = cv2.resize(im, None, fx=s, fy=s)
    hh, ww = sm.shape[:2]
    SIM.FD.setInputSize((ww, hh))
    r = SIM.FD.detect(sm)[1]
    if r is None:
        return "얼굴 없음"
    x, y, w, h = max(r.tolist(), key=lambda t: t[2] * t[3])[:4]
    return f"얼굴 {y / hh:.2f}~{(y + h) / hh:.2f} 가로 {x / ww:.2f}~{(x + w) / ww:.2f}"


def like(n, im, rf):
    want = WHO.get(n)
    if not want:
        return ""
    fl = SIM.faces(im)
    if not fl:
        return "닮음: 얼굴 못 찾음"
    if len(want) == 1:
        return f"닮음 {want[0].split()[1]} {max(SIM.score(f, rf[want[0]]) for _, f in fl):.2f}"
    if len(fl) != len(want):
        return f"닮음: 얼굴 {len(fl)}개"
    return "닮음 " + " ".join(f"{w.split()[1]} {SIM.score(f, rf[w]):.2f}" for (_, f), w in zip(fl, want))


if __name__ == "__main__":
    cuts = sys.argv[1:]
    rf = SIM.ref_feats()
    tw, th = 560, 315
    rows = []
    for c in cuts:
        m = re.match(r"S(\d+)(e?)", c)
        n, end = int(m.group(1)), bool(m.group(2))
        s = SH[n - 1]
        orig = imread(V + "검수/fable_v4콘티/frames/%04d.jpg" % ((s["f1"] - 1 if end else s["f0"]) + 1))
        names = [os.path.basename(p) for p in glob.glob(V + f"받음/v5/{c}*_*.jpg")]
        names = sorted(x for x in names if re.match(rf"{c}[a-d]?_\d+\.jpg$", x))
        rows.append((c, n, orig, [(x, imread(V + "받음/v5/" + x)) for x in names]))
    cols = max(len(r[3]) for r in rows) + 1
    sheet = Image.new("RGB", (cols * (tw + 10) + 10, len(rows) * (th + 70) + 10), (18, 16, 15))
    d = ImageDraw.Draw(sheet)
    for i, (c, n, orig, picks) in enumerate(rows):
        y = 10 + i * (th + 70)
        for j, (name, im) in enumerate([("원본 " + c, orig)] + picks):
            x = 10 + j * (tw + 10)
            sheet.paste(Image.fromarray(cv2.cvtColor(cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)), (x, y))
            d.text((x, y + th + 2), f"{name}  {light(im)}", font=FONT, fill=(235, 225, 210))
            d.text((x, y + th + 30), f"{facebox(im)}  {like(n, im, rf) if j else ''}", font=FONT, fill=(200, 180, 150))
    os.makedirs(V + "콘티/v5/고르기", exist_ok=True)
    out = V + f"콘티/v5/고르기/{cuts[0]}{'_외' if len(cuts) > 1 else ''}.jpg"
    sheet.save(out, quality=86)
    print(out, sheet.size)
