# 지유 광고 v7 · 블렌더 A2 병 확인 시트(2026-10-21).
#   python 시트.py 룩 [판1]   → synk-vendor/…/v7/블렌더/룩/<판>/_시안비교.jpg · _글자대조.jpg · _부분.jpg
#   python 시트.py 컷 [판]    → synk-vendor/…/v7/블렌더/_컷시트_<판>.jpg (컷마다 콘티 정지컷 | 블렌더 가운데 장, 맨 앞에 A2 시안)
#   python 시트.py 흐름       → synk-vendor/…/v7/블렌더/_흐름_<컷>.jpg (컷마다 처음 · 1/4 · 가운데 · 3/4 · 끝)
#   python 시트.py 전후 [판3]  → synk-vendor/…/v7/블렌더/_전후_<판>.jpg (시험/<컷>_<판>_*/ 옛 판과 지금 판의 같은 장, 고친 자리만)
#   python 시트.py 흐름전후 [판5] → synk-vendor/…/v7/블렌더/_흐름전후_<컷>_<판>.jpg (옛 판 · 지금 판을 같은 여섯 장으로 위아래 — 시간에 따라 바뀐 것)
# 룩: A2 시안과 정면 · 45도를 같은 높이로, 라벨 원고와 라벨 접사 렌더를 같은 배율로(원고 1px = LABEL_K mm, 접사 1mm = 25.93px),
# 정면 스틸의 뚜껑 · 라벨 · 바닥을 100%로 잘라 붙인다.
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
V7 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "v7")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), *[".."] * 7))
FONT = os.path.join(ROOT, "docs", "브랜드_폰트", "SUIT", "SUIT-Medium.otf")
MOCK = os.path.join(V7, "병시안", "판", "A2_서리맑음_140728.png")
ART = os.path.join(V7, "병시안", "라벨", "A2_서리맑음.jpg")
LABEL_K = 0.094   # 병A2_장면.py T["label_k"]와 같게(10-21 Fable 룩 검수 뒤 0.102 → 0.094)
CUTS = ["P1_공개", "P3_방울", "P4_물높이", "P6_라벨접사", "P8_위에서", "P9_팩샷"]


def fit_h(im, h):
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def row(ims, gap=10, bg=(18, 18, 18), labels=None):
    h = max(i.height for i in ims)
    pad = 44 if labels else 0
    sheet = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), h + pad), bg)
    d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(FONT, 26)
    x = 0
    for k, i in enumerate(ims):
        sheet.paste(i, (x, pad))
        if labels:
            d.text((x + 8, 8), labels[k], font=f, fill=(225, 222, 216))
        x += i.width + gap
    return sheet


def save(im, path):
    im.convert("RGB").save(path, quality=92)
    print(path, im.size)


def look(tag):
    d = os.path.join(V7, "블렌더", "룩", tag)
    front = Image.open(os.path.join(d, "룩_front_0001.png")).convert("RGB")
    side = Image.open(os.path.join(d, "룩_45_0001.png")).convert("RGB")
    mock = Image.open(MOCK).convert("RGB")
    save(row([fit_h(mock, 1200), fit_h(front, 1200), fit_h(side, 1200)],
             labels=["A2 시안(GPT 이미지)", "블렌더 정면", "블렌더 45°"]), os.path.join(d, "_시안비교.jpg"))
    # 글자 대조: 원고의 글자 묶음(x 280~720 · y 200~690)을 접사 렌더와 같은 배율(원고 1px = LABEL_K mm × 25.93px/mm)로
    art = Image.open(ART).convert("RGB").crop((280, 200, 720, 690))
    k = LABEL_K * 25.93
    art = art.resize((round(art.width * k), round(art.height * k)), Image.LANCZOS)
    lab = Image.open(os.path.join(d, "룩_label_0001.png")).convert("RGB")
    save(row([fit_h(art, 1300), fit_h(lab, 1300)], labels=["라벨 원고(label_a2)", "블렌더 라벨 접사(200mm · 심도 끔)"]),
         os.path.join(d, "_글자대조.jpg"))
    # 정면 100%: 뚜껑 · 라벨 · 바닥
    w, h = front.size
    cx = w // 2
    parts = [front.crop((cx - 210, 20, cx + 210, 440)), front.crop((cx - 210, 400, cx + 210, 820)),
             front.crop((cx - 210, 880, cx + 210, 1300))]
    save(row(parts, labels=["뚜껑 100%", "라벨 100%", "맑은 아랫부분 · 바닥 100%"]), os.path.join(d, "_부분.jpg"))


def latest(pattern):
    fs = sorted(glob.glob(pattern))
    return fs[-1] if fs else None


def cuts(tag):
    """위 줄: A2 시안 | 블렌더 컷 여섯(가운데 장), 아래 줄: 같은 자리의 이미지 콘티 정지컷(목표 그림)."""
    H = 720
    mock = fit_h(Image.open(MOCK).convert("RGB"), H)
    top, bottom, lt, lb = [mock], [Image.new("RGB", mock.size, (18, 18, 18))], ["A2 시안(GPT 이미지)"], ["아래: 이미지 콘티(목표)"]
    for c in CUTS:
        frames = sorted(glob.glob(os.path.join(V7, "블렌더", c, "*.png")))
        still = latest(os.path.join(V7, "콘티", "판", f"{c}_*.png"))
        if not frames:
            continue
        top.append(fit_h(Image.open(frames[len(frames) // 2]).convert("RGB"), H))
        lt.append(f"{c} 블렌더")
        bottom.append(fit_h(Image.open(still).convert("RGB"), H).resize(top[-1].size) if still else Image.new("RGB", top[-1].size))
        lb.append(f"{c} 콘티")
    a, b = row(top, labels=lt), row(bottom, labels=lb)
    sheet = Image.new("RGB", (max(a.width, b.width), a.height + b.height + 12), (18, 18, 18))
    sheet.paste(a, (0, 0))
    sheet.paste(b, (0, a.height + 12))
    save(sheet, os.path.join(V7, "블렌더", f"_컷시트_{tag}.jpg"))


def flows():
    """컷마다 처음 · 1/4 · 가운데 · 3/4 · 끝 다섯 장(움직임 확인용) → _흐름_<컷>.jpg."""
    for c in CUTS:
        frames = sorted(glob.glob(os.path.join(V7, "블렌더", c, "*.png")))
        if not frames:
            continue
        idx = sorted({0, len(frames) // 4, len(frames) // 2, 3 * len(frames) // 4, len(frames) - 1})
        tiles = [fit_h(Image.open(frames[i]).convert("RGB"), 960) for i in idx]
        save(row(tiles, labels=[f"{c} {i + 1}/{len(frames)}" for i in idx]), os.path.join(V7, "블렌더", f"_흐름_{c}.jpg"))


def before_after(tag):
    """다듬기 전후(10-22): 옮겨 둔 옛 판(시험/<컷>_<tag>_*/)과 지금 판의 같은 장에서 고친 자리만 잘라 나란히 —
    P1 32장 맑은 부분 · 뚜껑, P6 21장 훑는 빛이 정면을 지나는 라벨, P9 36장 맑은 부분 · 받침."""
    spots = {"P1_공개": (32, (330, 400, 750, 1560)), "P6_라벨접사": (21, (0, 160, 1080, 1460)),
             "P9_팩샷": (36, (330, 780, 760, 1800))}
    pairs = []
    for c, (f, box) in spots.items():
        old = sorted(glob.glob(os.path.join(V7, "블렌더", "시험", f"{c}_{tag}_*")))
        name = f"{c[:2]}_{f:04d}.png"
        if not old or not os.path.exists(os.path.join(V7, "블렌더", c, name)):
            continue
        a = Image.open(os.path.join(old[0], name)).convert("RGB").crop(box)
        b = Image.open(os.path.join(V7, "블렌더", c, name)).convert("RGB").crop(box)
        pairs.append(row([fit_h(a, 900), fit_h(b, 900)], labels=[f"{c} {f}장 · 전", "후"]))
    save(row(pairs, gap=24), os.path.join(V7, "블렌더", f"_전후_{tag}.jpg"))


def flow_before_after(tag):
    """흐름 전후(10-22): 옮겨 둔 옛 판(시험/<컷>_<tag>_*/)과 지금 판을 같은 여섯 장(처음 ~ 끝을 고르게)으로 위아래 두 줄 —
    P1 판 켜짐처럼 한 장으로는 안 보이고 시간에 따라 바뀐 것을 본다."""
    for c in CUTS:
        old = sorted(glob.glob(os.path.join(V7, "블렌더", "시험", f"{c}_{tag}_*")))
        new = sorted(glob.glob(os.path.join(V7, "블렌더", c, "*.png")))
        if not old or not new:
            continue
        idx = [round(i * (len(new) - 1) / 5) for i in range(6)]
        rows = []
        for label, d in (("전", old[0]), ("후", os.path.join(V7, "블렌더", c))):
            tiles = [fit_h(Image.open(os.path.join(d, os.path.basename(new[i]))).convert("RGB"), 720) for i in idx]
            rows.append(row(tiles, labels=[f"{c} {label} {i + 1}/{len(new)}" for i in idx]))
        sheet = Image.new("RGB", (max(r.width for r in rows), rows[0].height + rows[1].height + 12), (18, 18, 18))
        sheet.paste(rows[0], (0, 0))
        sheet.paste(rows[1], (0, rows[0].height + 12))
        save(sheet, os.path.join(V7, "블렌더", f"_흐름전후_{c}_{tag}.jpg"))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "룩"
    tag = sys.argv[2] if len(sys.argv) > 2 else "판1"
    {"룩": lambda: look(tag), "컷": lambda: cuts(tag), "흐름": flows, "전후": lambda: before_after(tag),
     "흐름전후": lambda: flow_before_after(tag)}[mode]()
