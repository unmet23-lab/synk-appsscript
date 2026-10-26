# 2번 남성 향수 · 이미지 콘티 보드(2026-10-26, 8번 콘티보드.py와 같은 꼴) — 줄마다 원본 첫 프레임 | 우리 판 | 초 · 원본 · 우리 · 길 · 소리.
#   python -I -X utf8 콘티보드.py  → git 밖 콘티/p2/보드/p2_이미지콘티_1~3.jpg · p2_이미지콘티_한눈.jpg (원본 프레임이 들어가 git 밖에만 둔다)
# 우리 판은 콘티/p2/정지컷/S??.png(고른 판)를 먼저, 없으면 렌더/ · 받음/에서 찾는다.
import glob
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

P2 = Path(os.environ["USERPROFILE"]) / "Documents" / "synk-vendor" / "pulse-portfolio12-20261024" / "콘티" / "p2"
FONT = Path(os.environ["USERPROFILE"]) / "Documents" / "SYNK-appsscript" / "docs" / "브랜드_폰트" / "SUIT"
OUT = P2 / "보드"

# 컷: (초, 원본 화면, 우리 화면, 길, 소리) — 02_콘티.md 2절 표를 줄인 것
ROWS = {
    1: ("0.00-2.08 (2.08)", "어두운 무대 · 빛줄기 셋 아래 남자 실루엣", "같은 무대 · 빛줄기 아래 태준 실루엣이 카메라 쪽으로 걸어 나옴", "AI", "록 반주 시작(새로 짓는 노래)"),
    2: ("2.08-2.48 (0.40)", "얼음에 박힌 병 라벨 아주 가까이", "얼음에 박힌 솔서리 병 이름 아주 가까이", "블렌더", "얼음 울림(추측)"),
    3: ("2.48-3.20 (0.72)", "깨진 얼음 덩이 속 병", "깨진 얼음 덩이 속 솔서리 병", "블렌더", ""),
    4: ("3.20-4.00 (0.80)", "어깨 너머 · 팔을 위로 뻗어 손을 폄", "태준 맨 어깨 너머 아주 가까이 · 쥔 손을 빛 쪽으로 올리며 편다", "AI", "3.7 남자 보컬 시작"),
    5: ("4.00-4.96 (0.96)", "낮은 각도 · 두 팔 벌리고 고개를 젖힘", "태준 두 팔 벌리고 빛 쪽으로 고개를 젖힘", "AI", ""),
    6: ("4.96-5.24 (0.28)", "얼음 Y의 갈라진 V 자리", "세운 「ㅅ」 얼음 조각의 두 다리가 갈라지는 홈", "블렌더 + AI 질감", "5.00 노래 첫 강세"),
    7: ("5.24-5.72 (0.48)", "V 사이로 물줄기", "「ㅅ」 등마루에서 갈라져 두 다리를 타고 흐르는 물막", "블렌더 + AI 물", "물줄기"),
    8: ("5.72-6.68 (0.96)", "솟은 물보라가 렌즈를 덮음", "얼음벽 사이에서 솟는 물보라", "AI", "물보라"),
    9: ("6.68-7.40 (0.72)", "물에 잠긴 뚜껑(브랜드 각인)", "물에 잠긴 솔서리 뚜껑(「ㅅ」 음각)", "블렌더 + AI 물", ""),
    10: ("7.40-8.12 (0.72)", "얼음 Y 조각 · 속에 새싹", "「ㅅ」 얼음 조각(두 다리만) · 오른쪽 다리 속 솔가지", "블렌더 + AI 질감", "얼음이 쩍 갈라짐"),
    11: ("8.12-8.96 (0.84)", "얼음 속 초록 잎 아주 가까이", "세로 얼음 덩이 속 솔잎 · 가로 금을 따라 물", "AI", "얼음 깨짐 · 물 튐"),
    12: ("8.96-10.20 (1.24)", "선글라스 남자가 왼손에 든 병을 왼쪽 목에 뿌림", "태준이 왼손에 든 솔서리 병을 목 옆으로 듦(누르기 직전에 끊음)", "AI + 블렌더 병", "끝에 「칙」"),
    13: ("10.20-10.72 (0.52)", "향수 안개 입자", "같음", "AI", "칙 · 안개"),
    14: ("10.72-11.56 (0.84)", "서리 앉은 세이지 잎", "서리 앉은 솔잎", "AI", ""),
    15: ("11.56-12.32 (0.76)", "잎 위 서리 결 아주 가까이", "서리 앉은 솔잎 두세 가닥 아주 가까이", "AI", ""),
    16: ("12.32-14.84 (2.52)", "선글라스 얼굴 정면 → 옆얼굴", "태준 얼굴 정면 → 옆얼굴(선글라스 없음)", "AI", ""),
    17: ("14.84-15.84 (1.00)", "기운 병 몸통 · 라벨", "기운 솔서리 병 몸통 · 이름", "블렌더", "노래 마지막 높은 음 · 15.8~16.2 빠짐"),
    18: ("15.84-20.00 (4.16)", "병을 크게 · 물러남 · 빛 띠 · 병 밑 서리", "솔서리 병을 크게 · 끝까지 물러나 왼쪽 1/3에 · 빛 띠 · 병 밑 서리", "블렌더", "내레이션(태준 목소리) 16.0 「차갑게.」 16.9 「서리 앉은 솔잎의 향.」 18.9 「솔서리.」 · 19.72 끝"),
}
# 카메라 기법(10-26 밤 원본을 프레임마다 다시 잼 — 01_샷표_원본.md 2절 · 원본카메라_재기.py)
CAM = {1: "고정 · 태준이 걸어 나오고 빛줄기가 옮겨 감", 2: "거의 고정", 3: "천천히 물러남 0.93배", 4: "거의 고정 · 팔을 들며 몸이 돎", 5: "낮게 천천히 다가감(몸 1.5배) · 끝에 팔 흔들림 흐림", 6: "다가감 1.045배(0.28초)", 7: "살짝 다가감 · 조금 내려감 · 점점 느려짐", 8: "고정 · 물이 렌즈를 덮음(6.3초~)", 9: "다가감 1.10배 · 2.6° 돎", 10: "다가감 1.06배", 11: "다가감 1.13배 · 점점 빨라짐", 12: "다가감 1.4배 · 5° 기울어짐", 13: "고정 · 안개가 흘러감", 14: "살짝 다가감 · 점점 느려짐 · 끝에 초점 풀림", 15: "살짝 다가감 · 초점이 맞아 감", 16: "첫 1초 빠르게 다가가다 점점 느려짐", 17: "물러남 0.7배 · 천천히-빠르게-천천히 · 끝에 흐려짐", 18: "물러남 0.51배 · 점점 느려짐 · 띠 초점이 맞아 감"}
# 10-26 밤 5판(g5): Fable 이미지 콘티 1 · 2차를 반영해 다시 구운 판 · 블렌더 12판
SRC = {2: "렌더/s02.png", 3: "렌더/s03.png", 6: "받음/S06r_g5.png", 9: "받음/S09r_g5.png", 10: "받음/S10r_g5.png", 17: "렌더/s17.png", 18: "렌더/s18.png",
       1: "받음/S01_g5.png", 4: "받음/S04_g5.png",
       7: "받음/S07_g5.png", 8: "받음/S08_g5.png", 11: "받음/S11_g5.png", 13: "받음/S13_g5.png", 14: "받음/S14_g5.png", 15: "받음/S15_g5.png"}


def f(w, s):
    return ImageFont.truetype(str(FONT / f"SUIT-{w}.otf"), s)


def ours(n):
    for p in (P2 / "정지컷" / f"S{n:02d}.png", P2 / SRC.get(n, "_없음")):
        if p.exists():
            return Image.open(p).convert("RGB"), p.name
    g = sorted(glob.glob(str(P2 / "받음" / f"P{n:02d}_*.jpg")) + glob.glob(str(P2 / "받음" / f"P{n:02d}_*.png")), key=os.path.getmtime)
    return (Image.open(g[-1]).convert("RGB"), Path(g[-1]).name) if g else (None, "")


def safe(text):
    return text.replace(" — ", " · ").replace("—", "·").replace("–", "-")


def wrap(d, text, font, width):
    out, cur = [], ""
    for word in safe(text).split(" "):
        t = (cur + " " + word).strip()
        if d.textlength(t, font=font) > width and cur:
            out.append(cur)
            cur = word
        else:
            cur = t
    return out + ([cur] if cur else [])


def board(nums, name, title):
    IW, IH, TW, PAD = 720, 405, 820, 18
    rowh = IH + PAD
    W = PAD * 4 + IW * 2 + TW
    H = 90 + rowh * len(nums) + PAD
    bd = Image.new("RGB", (W, H), (12, 14, 22))
    d = ImageDraw.Draw(bd)
    d.text((PAD, 22), title, font=f("SemiBold", 30), fill=(240, 240, 240))
    y = 90
    for n in nums:
        bd.paste(Image.open(P2 / "원본첫프레임" / f"S{n:02d}.png").convert("RGB").resize((IW, IH)), (PAD, y))
        im, src = ours(n)
        if im:
            bd.paste(im.resize((IW, IH)), (PAD * 2 + IW, y))
        else:
            d.rectangle([PAD * 2 + IW, y, PAD * 2 + IW * 2, y + IH], outline=(90, 90, 90))
            d.text((PAD * 2 + IW + 20, y + 20), "아직", font=f("Medium", 28), fill=(160, 160, 160))
        tx = PAD * 3 + IW * 2
        t, a, b, way, s = ROWS[n]
        cam = CAM.get(n, "")
        d.text((tx, y + 2), safe(f"#{n}  {t}"), font=f("ExtraBold", 34), fill=(120, 190, 255))
        yy = y + 54
        for label, text, col in (("원본", a, (170, 170, 170)), ("우리", b, (245, 245, 245)), ("카메라(원본과 같게)", cam, (255, 214, 140)),
                                 ("길", way, (170, 220, 170)), ("소리", s or "노래", (200, 225, 255))):
            d.text((tx, yy), label, font=f("SemiBold", 20), fill=(130, 130, 130))
            yy += 24
            for line in wrap(d, text, f("Medium", 25), TW - 10):
                d.text((tx, yy), line, font=f("Medium", 25), fill=col)
                yy += 30
            yy += 5
        d.text((tx, y + IH - 26), src, font=f("Regular", 18), fill=(110, 110, 110))
        y += rowh
    OUT.mkdir(parents=True, exist_ok=True)
    bd.save(OUT / name, quality=88)
    print(name, bd.size)


def overview():
    w, h, cols = 480, 270, 6
    bd = Image.new("RGB", (cols * w, 3 * (h + 34) + 70), (12, 14, 22))
    d = ImageDraw.Draw(bd)
    d.text((14, 16), "2번 솔서리 20초 우리 판 18컷 한눈 — 빛줄기 실루엣 → 얼음 · 물 · 솔잎 · 태준을 번갈아 → 병을 크게", font=f("SemiBold", 30), fill=(240, 240, 240))
    for i, n in enumerate(range(1, 19)):
        im, _ = ours(n)
        x, y = (i % cols) * w, 70 + (i // cols) * (h + 34)
        if im:
            bd.paste(im.resize((w - 6, h)), (x + 3, y + 34))
        d.text((x + 8, y + 4), safe(f"#{n} {ROWS[n][0]}"), font=f("SemiBold", 22), fill=(120, 190, 255))
    bd.save(OUT / "p2_이미지콘티_한눈.jpg", quality=88)
    print("한눈", bd.size)


if __name__ == "__main__":
    T = "2번 남성 향수 20초 · 이미지 콘티 — 왼쪽 원본 첫 프레임 | 가운데 우리 판 | 오른쪽 초 · 원본 · 우리 · 카메라 · 길 · 소리"
    board(list(range(1, 7)), "p2_이미지콘티_1.jpg", T + "  (1/3)")
    board(list(range(7, 13)), "p2_이미지콘티_2.jpg", T + "  (2/3)")
    board(list(range(13, 19)), "p2_이미지콘티_3.jpg", T + "  (3/3)")
    overview()
