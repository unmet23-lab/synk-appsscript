# 5번 새 기획(11-05) 이미지 콘티 보드 — 컷마다 원본 첫 프레임과 우리 시작 그림을 나란히, 초 · 카메라 · 소리 한 줄씩.
# 원본 프레임이 들어가 보드는 git 밖(synk-vendor/pulse-portfolio12-20261024/콘티/p5n/보드/)에만 둔다. 원본 없이 우리 그림만 모은 한눈 판도 만든다.
#   python -X utf8 새기획_보드.py      → 보드/p5n_이미지콘티_보드.jpg · 보드/p5n_한눈.jpg
import json, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n")
SUIT = Path(os.environ["USERPROFILE"]) / "Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT"
F = lambda w, s: ImageFont.truetype(str(SUIT / f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, CARD = (16, 15, 14), (238, 232, 224), (160, 150, 140), (240, 200, 120), (28, 25, 23)
# 컷: (이름, 초, 원본 컷, 화면 한 줄, 카메라, 소리)
CUTS = [
    ("N01", "0.00~1.63", 1, "트랙 위 공중에 떠오르는 신발", "흐림에서 초점 · 떠오르며 다가옴", "숨소리 조각 → 휙"),
    ("N02", "1.63~2.87", 2, "아래에서 본 밑창", "6% 다가감", "베이스 떨어짐 · 드럼"),
    ("N03", "2.87~3.27", 4, "트랙 고무를 딛는 발", "고정 · 매치 컷 1", "딛는 소리 · 고무"),
    ("N04", "3.27~3.67", 5, "젖은 흰 레인 선을 딛는 발", "고정 · 매치 컷 2", "딛는 소리 · 물기"),
    ("N05", "3.67~4.43", 6, "트랙 가 인조 잔디를 딛는 발", "고정 · 매치 컷 3", "딛는 소리 · 잔디"),
    ("N06", "4.43~5.93", 7, "가파른 아래 각도의 밑창", "8.5% 다가감 · 위로", "숨 내쉼 · 끝에 드럼 비움"),
    ("N07", "5.93~6.90", 8, "니트 앞코 매크로", "느린 다가감", "없음"),
    ("N08s", "6.90~8.70", 9, "니트 낮은 옆 각도 · 숨구멍에서 새어 나오는 숨", "고정", "숨소리와 맞춤"),
    ("N09", "8.70~9.87", 10, "옆 미드솔 매크로", "조금 기울며 위로", "없음"),
    ("N10", "9.87~11.40", 11, "뒤꿈치에 찍힌 「GAPPEUM」", "고정 · 신발이 돎", "「Out of breath,」"),
    ("N11", "11.40~15.00", 13, "밑창이 트랙을 차는 고속 슬로", "내리꽂힘 → 천천히 아래로 · 초점 빠짐", "숨 멎은 정적 · 충격음 · 「into joy.」"),
    ("N11_로고", "12.90~15.00", 13, "끝: 빛 속 신발 위에 「GAPPEUM」(후반 합성)", "알갱이 · 연기만 움직임", "로고 한 방 → 뚝 끊김 → 무음"),
]
TH = 520  # 칸 높이
TW = int(TH * 9 / 16)


def fit(p, w, h):
    im = Image.open(p).convert("RGB")
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def board(with_src=True):
    per_row = 4 if with_src else 6
    cell_w = (TW * 2 + 14 if with_src else TW) + 30
    cell_h = TH + 150
    rows = (len(CUTS) + per_row - 1) // per_row
    W = cell_w * per_row + 60
    H = 170 + rows * cell_h + 40
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((40, 34), "5번 「가쁨 GAPPEUM」 15초 — 이미지 콘티" + (" (원본 첫 프레임 ↔ 우리 시작 그림)" if with_src else " 한눈"), font=F("ExtraBold", 40), fill=INK)
    d.text((40, 96), "뼈대 원본 A 본편 13컷 가운데 11컷 · 세로 9:16 · 밤 트랙과 세로 빛 기둥 · 끝 로고는 후반에서 얹음 · N08s(숨 연기) 확정 · 로고 · 말은 영어(11-05 밤) · 로고는 직접 그림", font=F("Medium", 22), fill=DIM)
    for i, (n, t, src, what, cam, snd) in enumerate(CUTS):
        r, c = divmod(i, per_row)
        x0, y0 = 40 + c * cell_w, 150 + r * cell_h
        d.rounded_rectangle([x0 - 8, y0 - 8, x0 + cell_w - 30, y0 + cell_h - 24], radius=12, fill=CARD)
        x = x0
        if with_src:
            sp = V / "원본첫프레임" / ("N11b.png" if n == "N11_로고" else f"{n.rstrip('s')}.png")
            if sp.exists():
                img.paste(fit(sp, TW, TH), (x, y0))
                d.text((x + 6, y0 + 4), "원본", font=F("ExtraBold", 18), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
            x += TW + 14
        op = V / "정지컷_916" / f"{n}.png"
        if op.exists():
            img.paste(fit(op, TW, TH), (x, y0))
        else:
            d.rectangle([x, y0, x + TW, y0 + TH], outline=DIM)
            d.text((x + 20, y0 + TH // 2), "아직 없음", font=F("SemiBold", 22), fill=DIM)
        d.text((x + 6, y0 + 4), n, font=F("ExtraBold", 20), fill=(255, 230, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        ty = y0 + TH + 10
        d.text((x0, ty), f"{n} · {t}초 · 원본 {src}".replace("N11_로고", "N11 끝"), font=F("ExtraBold", 21), fill=GOLD)
        d.text((x0, ty + 32), what, font=F("SemiBold", 20), fill=INK)
        d.text((x0, ty + 60), "카메라  " + cam, font=F("Medium", 18), fill=DIM)
        d.text((x0, ty + 86), "소리  " + snd, font=F("Medium", 18), fill=DIM)
    (V / "보드").mkdir(parents=True, exist_ok=True)
    out = V / "보드" / ("p5n_이미지콘티_보드.jpg" if with_src else "p5n_한눈.jpg")
    img.save(out, quality=88)
    print(out, img.size)


board(True)
board(False)
