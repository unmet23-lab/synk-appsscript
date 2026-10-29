# 드라마 말하기 1화 웹툰 시안 — 페이지에 올릴 보기 그림(2026-10-30).
# 받은 PNG를 JPEG로 바꿔 <작업>/보기/에 둔다 — 크기는 그대로, 생성 도구 표시(C2PA caBX 조각)를 포함한 메타데이터는 남기지 않는다
# (현장노트 그림_굽기_오리기 「GPT 그림 PNG에는 생성 도구 표시가 caBX 조각에 들어 있다」). 얼굴 띠(보드/)도 함께 옮긴다.
#   python -X utf8 보기.py <작업>     → <작업>/보기/<id>.jpg · face-prof.jpg · face-senior.jpg · 목록.json(이름 · 가로 · 세로 · 바이트)
import glob
import json
import os
import sys

from PIL import Image

work = sys.argv[1]
out = os.path.join(work, "보기")
os.makedirs(out, exist_ok=True)
items = {}
srcs = sorted(glob.glob(os.path.join(work, "받음", "*.png")))
srcs += [(os.path.join(work, "보드", "얼굴_교수.jpg"), "face-prof"), (os.path.join(work, "보드", "얼굴_선배.jpg"), "face-senior"),
         (os.path.join(work, "보드", "전후.jpg"), "before-after")]
for s in srcs:
    src, name = (s if isinstance(s, tuple) else (s, os.path.basename(s)[:-4]))
    if not os.path.exists(src):
        continue
    im = Image.open(src).convert("RGB")
    dst = os.path.join(out, f"{name}.jpg")
    im.save(dst, "JPEG", quality=86, optimize=True, progressive=True)
    items[name] = {"가로": im.width, "세로": im.height, "바이트": os.path.getsize(dst)}
json.dump(items, open(os.path.join(out, "목록.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"보기 {len(items)}장 · {sum(v['바이트'] for v in items.values()) / 1e6:.1f}MB → {out}")
