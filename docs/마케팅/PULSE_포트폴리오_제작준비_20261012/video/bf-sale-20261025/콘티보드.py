# 블프 세일 이미지 콘티 보드(2026-10-26, 8번 콘티보드.py와 같은 꼴을 세로 광고에 맞춤) — 줄마다 원본 첫 프레임 | 우리 그림 | 초 · 원본 화면 · 우리 화면 · 소리 · 글자.
#   python -X utf8 콘티보드.py  → git 밖 콘티/bf-sale/보드/bf_이미지콘티_1.jpg · _2.jpg · bf_이미지콘티_한눈.jpg(15초 · 6초 한 장) — 원본 프레임이 들어가 git 밖에만 둔다
import glob, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

B = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sale")
SUIT = r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT"
OUT = B / "보드"
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, CARD = (17, 15, 14), (238, 232, 224), (160, 150, 140), (240, 200, 120), (28, 25, 23)

# 컷: (원본 첫 프레임, 우리 그림 이름, 초, 원본 화면, 우리 화면, 소리 · 말 · 글자) — 02_콘티.md 2절 표를 줄인 것
ROWS = [
    ("C01", "C01_합성", "0.00–0.96", "스튜디오 와이드 · 강사가 웃으며 페달 · 0.92 폰을 집어 듦 · 멈춘 전광판 · 양 끝 두 사람", "채원(헤드셋 · 다홍 집업)이 웃으며 페달 · 0.8초 손짓(폰 없음) · 전광판 「자정까지 00:59:59」 · 양 끝 빈 자전거", "음악 · 내레이션 1 「자정까지! 전 품목 칠십 퍼센트!」"),
    ("C02", "G02", "0.96–2.28", "손에 든 폰 접사 · 검지로 1.32 누름 · 1.40 조각 터짐 · 1.19배 다가감", "글자 카드 「오늘 자정까지」(0.96) / 「전 품목 70%」(1.40) — 손 · 폰 없음", "내레이션 1"),
    ("C03", "C03", "2.28–3.04", "바퀴 옆 낮은 카메라 · 빛 고리 → 빨간 길 두루마리가 굴러 펼쳐짐", "다홍 매트 길이 굴러 펼쳐짐 · 바퀴 둘레 주황 빛 고리", "도르륵"),
    ("C04", "C04", "3.04–3.64", "얼굴 미디엄 클로즈업 · 3.16 위를 보며 놀람(입 O) · 폰 쥔 손 · 3.40 휙", "채원 같은 놀람 · 손 없음 · 끝에 휙", "휙 · 내레이션 2 시작"),
    ("C06", "C06", "3.76–4.48", "스튜디오 와이드 · 외침 · 매트 펼침(→ 4.32) · 간판 글자 맞춰짐(→ 4.24) · 수강생 4~5명", "채원 혼자 외침 · 빈 자전거 · 매트 펼침 · 빈 간판에 「힘껏」이 넘김판처럼(모션그래픽)", "내레이션 2 「일 년에 딱 한 번, 힘껏 밟아요!」"),
    ("C07", "C07", "4.48–5.16", "뒷모습 · 로고 모양 빛 아치로 밀고 들어감 · 4.88 흰 빛 터짐", "채원 뒷모습 · 둥근 네모 문 꼴 다홍 빛 아치 · 같은 흰 빛 터짐", "쉭"),
    ("C08", "C08", "5.16–6.16", "빛 터널 옆모습 질주 · 물러나며 기울어짐 · 떠 있는 제품 카드", "다홍 · 호박 빛 터널 옆모습 질주 · 힘껏 제품 카드 둘(모션그래픽)", "내레이션 2 끝"),
    ("C09", "G09", "6.16–7.68", "제품 칸 셋(이미 있음) · 6.20 · 6.36 · 6.48 차례로 한 바퀴 · 가격 없음", "레깅스 · 바람막이 · 브라탑 — 회전 끝에 정가 줄 긋고 70% 가격", "칸 착 · 다다닥 · 내레이션 3 「레깅스도, 바람막이도, 전부 칠십 퍼센트!」"),
    ("C10", "C10", "7.68–8.60", "얼굴 놀람(입 O) → 8.44 웃음 · 빛 배경 · 따라 흐름", "채원 놀람 → 웃음 · 다홍 네온 배경", "내레이션 3"),
    ("C11", "G11b", "8.60–11.72", "새 제품 셋 · 8.64 묶음 한 바퀴 · 10.12 묶음에서 가운데 · 아래만 새 제품", "후디 · 조거 · 러닝 캡 → 집업 재킷 · 반바지(그림은 마지막 모습) · -70% 꼬리표", "칸 넷 · 내레이션 4 시작"),
    ("C12", "C12", "11.72–12.56", "앞 자전거 흐림에서 휙 · 폰 보다 11.96 고개 휙 · 페달 · 웃음", "채원 핸들 잡고 위를 보다 고개 휙 · 페달 · 웃음 · 뒤 다홍 쇼핑 상자", "내레이션 4 「자정 전에 끝나요, 지금 힘껏 앱에서!」"),
    ("C13", "C13_합성", "12.56–15.00", "위 끝 카드(한 번에 · 12.84 빛살 · 13.0 금빛 조각) · 아래 강사 + 놀라는 남자 · 14.44 휙 → 빈 벽", "위 「힘껏 · 블랙프라이데이 · 오늘 자정까지 전 품목 70% · 00:59:46 · 지금 힘껏 앱에서」(한 번에) · 아래 채원 혼자 웃음 · 휙 → 빈 벽", "팡 · 음악 끝"),
]
SIX = [("C01_합성", "0.0–0.9"), ("G02", "0.9–2.2"), ("G09", "2.2–3.7"), ("C10", "3.7–4.6"), ("C13_합성", "4.6–6.0")]


def ours(name):
    for p in (B / "컷" / f"{name}.jpg", B / "정지컷" / f"{name}.png"):
        if p.exists():
            return Image.open(p).convert("RGB")
    g = sorted(glob.glob(str(B / "받음" / f"{name.split('_')[0]}_*.jpg")), key=os.path.getmtime)
    return Image.open(g[-1]).convert("RGB") if g else None


def wrap(d, text, font, width):
    text = text.replace(" — ", " · ").replace("—", "·").replace("–", "-")
    out, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            out.append(cur)
            cur = ch
        else:
            cur += ch
    out.append(cur)
    return out


def tile(im, h):
    if im is None:
        t = Image.new("RGB", (int(h * 9 / 16), h), (60, 56, 52))
        ImageDraw.Draw(t).text((20, h // 2), "굽는 중", font=F("ExtraBold", 28), fill=INK)
        return t
    return im.resize((int(h * im.width / im.height), h), Image.LANCZOS)


def board(rows, out, th=520):
    W = 2100
    rh = th + 40
    img = Image.new("RGB", (W, 150 + rh * len(rows) + 30), BG)
    d = ImageDraw.Draw(img)
    d.text((40, 36), "블프 세일 숏폼 15초 · 이미지 콘티 — 원본 첫 프레임 | 우리 판", font=F("ExtraBold", 44), fill=INK)
    d.text((40, 96), "왼쪽은 남의 광고 원본(구도 · 크기 · 빛만 옮김), 오른쪽이 우리 판 — 컷 시각 · 카메라는 원본 그대로", font=F("Medium", 26), fill=DIM)
    y = 150
    for (orig, mine, sec, o_txt, m_txt, snd) in rows:
        d.rounded_rectangle([24, y - 8, W - 24, y + th + 16], radius=12, fill=CARD)
        po = B / "원본첫프레임" / f"{orig}.png"
        a = tile(Image.open(po).convert("RGB") if po.exists() else None, th)
        b = tile(ours(mine), th)
        img.paste(a, (40, y + 4))
        img.paste(b, (40 + a.width + 16, y + 4))
        x = 40 + a.width + b.width + 48
        tw = W - x - 40
        d.text((x, y + 8), f"{orig[1:].lstrip('0')}번  {sec}초", font=F("Heavy", 36), fill=GOLD)
        yy = y + 66
        for label, txt, col in (("원본", o_txt, DIM), ("우리", m_txt, INK), ("소리 · 말", snd, (170, 200, 240))):
            d.text((x, yy), label, font=F("ExtraBold", 24), fill=col)
            yy += 34
            for ln in wrap(d, txt, F("Medium", 27), tw):
                d.text((x, yy), ln, font=F("Medium", 27), fill=col)
                yy += 36
            yy += 12
        y += rh
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / out, quality=88)
    print(OUT / out, img.size)


def glance():
    th = 400
    tiles = [tile(ours(r[1]), th) for r in ROWS]
    six = [tile(ours(n), th) for n, _ in SIX]
    W = max(sum(t.width + 10 for t in tiles), sum(t.width + 10 for t in six)) + 60
    img = Image.new("RGB", (W, 2 * (th + 70) + 120), BG)
    d = ImageDraw.Draw(img)
    d.text((30, 24), "블프 세일 숏폼 — 15초(위) · 6초(아래) 한눈", font=F("ExtraBold", 40), fill=INK)
    x, y = 30, 100
    for r, t in zip(ROWS, tiles):
        img.paste(t, (x, y)); d.text((x + 6, y + 6), r[2].split("–")[0], font=F("Heavy", 26), fill=GOLD); x += t.width + 10
    x, y = 30, 100 + th + 70
    for (n, s), t in zip(SIX, six):
        img.paste(t, (x, y)); d.text((x + 6, y + 6), s, font=F("Heavy", 26), fill=GOLD); x += t.width + 10
    img.save(OUT / "bf_이미지콘티_한눈.jpg", quality=88)
    print(OUT / "bf_이미지콘티_한눈.jpg", img.size)


if __name__ == "__main__":
    board(ROWS[:6], "bf_이미지콘티_1.jpg")
    board(ROWS[6:], "bf_이미지콘티_2.jpg")
    glance()
