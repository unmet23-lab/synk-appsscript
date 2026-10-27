# 시즌 1 「옆집의 크리스마스」 이미지 콘티 — 받은 판 고르기(2026-10-26). 색 · 밝기는 손대지 않는다(장부 공통 원칙 3 — 받은 색 그대로).
#   python -X utf8 이미지콘티_고르기.py PL1 C02=C02_191803.jpg …   (=파일을 안 주면 받음/의 그 이름 가장 최근 판)
#   C02=C02e_….jpg@29.8,5,99.8,75 — 받은 판에서 그 상자(화면 %, 16:9로 맞춤)만 잘라 고른다: 받은 구도가 원본 자리에서 비켜났을 때 원본 자리로
#   옮기는 틀 잡기(10-27 2번 — 등이 가운데에 왔다). 색 · 밝기는 그대로, 자르기만.
#   → 정지컷/<이름>.png(받은 그대로) · 컷/<이름>.jpg(보드 · 애니매틱용 1920×1080) · ego/refs/<이름>.jpg(다음 지시문의 참조) · 정지컷/_고른판.json
# 고정 와이드의 판(PL1)은 실루엣 놓기(이미지콘티_배치도.py 놓기)가 정지컷/PL1.png를 읽는다.
# 16:9가 아니게 받으면(Gemini가 비율을 어김) 가운데에서 16:9로만 자르고 적어 둔다. 3:4 기준 그림(H3)은 자르지 않는다.
import glob
import json
import os
import shutil
import sys

from PIL import Image

V = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors/"
PORTRAIT = {"H3", "C05"}   # H3 세로 기준 · C05 세로 4:3 판(카메라무브가 위 · 아래 창을 자름) — 16:9로 자르지 않는다


def pick(name, src, box=None):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    note = f"{w}×{h}"
    if box:
        x0, y0, x1, y1 = [float(v) / 100 for v in box.split(",")]
        im = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
        w, h = im.size
        note += f" → 상자 {box}(%)만 잘라 원본 자리로"
    if name not in PORTRAIT and abs(w / h - 16 / 9) > 0.01:
        if w / h > 16 / 9:
            nw = round(h * 16 / 9)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w * 9 / 16)
            im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
        note += " → 가운데 16:9로 자름"
    for d in ("정지컷", "컷", "ego/refs"):
        os.makedirs(V + d, exist_ok=True)
    shutil.copyfile(src, V + f"정지컷/{name}{os.path.splitext(src)[1]}")
    if name not in PORTRAIT:
        im.resize((1920, 1080), Image.LANCZOS).save(V + f"컷/{name}.jpg", quality=92)
    im.save(V + f"정지컷/{name}.png")
    r = im.copy()
    r.thumbnail((1600, 1600))
    r.save(V + f"ego/refs/{name}.jpg", quality=92)
    return note


if __name__ == "__main__":
    lp = V + "정지컷/_고른판.json"
    log = json.load(open(lp, encoding="utf-8")) if os.path.exists(lp) else {}
    for a in sys.argv[1:]:
        name, _, f = a.partition("=")
        f, _, box = f.partition("@")
        if f:
            src = V + "받음/" + f
        else:
            c = sorted(glob.glob(V + f"받음/{name}_*.*"), key=os.path.getmtime)
            src = c[-1]
        # 고른 이름은 컷 번호로(C30b를 고르면 C30) — 「C30=C30b_….jpg」처럼 준다
        note = pick(name, src, box or None)
        log[name] = {"src": os.path.basename(src), "note": note}
        print(name, os.path.basename(src), note)
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
