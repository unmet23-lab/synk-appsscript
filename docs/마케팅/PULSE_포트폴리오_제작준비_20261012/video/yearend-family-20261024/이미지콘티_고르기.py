# 6번 「연말 빈방」 이미지 콘티 — 받은 판 고르기(2026-10-25). 색 · 밝기는 손대지 않는다(장부 공통 원칙 3 — 받은 색 그대로).
#   python -X utf8 이미지콘티_고르기.py R1=R1_151903.png S20 …   (=파일을 안 주면 받음/의 그 이름 가장 최근 판)
#   → 정지컷/<이름>.png(받은 그대로) · 컷/<이름>.jpg(보드용 1920×1080) · 방 판 · 빈방은 ego/refs/<이름>.jpg(다음 지시문의 참조) · 정지컷/_고른판.json
# 16:9가 아니게 받으면(Gemini가 비율을 어김) 가운데에서 16:9로만 자르고 적어 둔다.
import glob
import json
import os
import shutil
import sys

from PIL import Image

V = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p6/"
REFS = {"R1", "R2", "R3", "S20", "E50", "S04"}   # S04: 3번 포스터를 4번 판과 같게(S03c 참조)


def pick(name, src):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    note = f"{w}×{h}"
    if abs(w / h - 16 / 9) > 0.01:
        if w / h > 16 / 9:
            nw = round(h * 16 / 9)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w * 9 / 16)
            im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
        note += " → 가운데 16:9로 자름"
    os.makedirs(V + "정지컷", exist_ok=True)
    os.makedirs(V + "컷", exist_ok=True)
    shutil.copyfile(src, V + f"정지컷/{name}{os.path.splitext(src)[1]}")
    im.resize((1920, 1080), Image.LANCZOS).save(V + f"컷/{name}.jpg", quality=92)
    if name in REFS:
        r = im.copy()
        r.thumbnail((1600, 1600))
        r.save(V + f"ego/refs/{name}.jpg", quality=92)
    if name in ("R1", "R2", "R3", "S11m"):   # 실루엣 합성(이미지콘티_배치도.py 합성)이 정지컷/R1.png를 읽는다 — S11m은 11번 둘째 단계(딸 더하기)의 판
        im.save(V + f"정지컷/{name}.png")
    return note


if __name__ == "__main__":
    lp = V + "정지컷/_고른판.json"
    log = json.load(open(lp, encoding="utf-8")) if os.path.exists(lp) else {}
    for a in sys.argv[1:]:
        name, _, f = a.partition("=")
        if f:
            src = V + "받음/" + f
        else:
            c = sorted(glob.glob(V + f"받음/{name}_*.*"), key=os.path.getmtime)
            src = c[-1]
        note = pick(name, src)
        log[name] = {"src": os.path.basename(src), "note": note}
        print(name, os.path.basename(src), note)
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
