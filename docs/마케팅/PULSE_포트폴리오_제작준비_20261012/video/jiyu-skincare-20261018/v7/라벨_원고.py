# 지유 광고 v7 · 맑음 병 라벨 원고(2026-10-21). 유호님(v6를 보고) 「병도 너무 촌스럽고 … 마감도 텍스트도 그냥 어거지로
# 붙여넣어서 병을 만든 느낌」 → 병 시안을 이미지 모델로 굽되, 글자는 우리 서체로 조판한 원고를 참고로 넣어 병에 인쇄된 것처럼
# 입히게 한다(글자 모양을 모델이 지어내지 않게). 글꼴은 v5 로고 층과 같다(SUIT SemiBold · SUIT Medium · Inter Tight Medium).
# 투명 PNG는 참고로 안 먹으므로(그림 굽기 현장 노트) 흰 바탕 JPEG로 낸다.
#   python 라벨_원고.py   → synk-vendor/jiyu-skincare-20261018/v7/병시안/라벨/{A_투명한무게,B_조약돌,C_렌즈_뒷면,C_렌즈_앞면}.jpg
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), *[".."] * 6))  # 저장소 뿌리(v7 → … → SYNK-appsscript)
FONTS = os.path.join(ROOT, "docs", "브랜드_폰트")
SUIT_SB = os.path.join(FONTS, "SUIT", "SUIT-SemiBold.otf")
SUIT_M = os.path.join(FONTS, "SUIT", "SUIT-Medium.otf")
INTER_M = os.path.join(FONTS, "InterTight", "InterTight-Medium.ttf")
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "v7", "병시안", "라벨")
INK = (52, 52, 50)        # 따뜻한 숯색(v5 로고 층과 같은 잉크)
GREY = (138, 133, 126)    # 조약돌 판의 작은 글(따뜻한 회색)
EMBOSS = (178, 176, 172)  # 음각 글자 모양만 보여 주는 옅은 회색(실제 병엔 잉크 없음)


def tracked(d, xy, text, font, fill, track, anchor="mm"):
    """자간을 벌려 가운데 맞춤으로 찍는다(track: 글자 크기 대비 비율)."""
    sizes = [d.textlength(ch, font=font) for ch in text]
    gap = font.size * track
    total = sum(sizes) + gap * (len(text) - 1)
    x = xy[0] - total / 2 if anchor == "mm" else xy[0]
    for ch, w in zip(text, sizes):
        d.text((x, xy[1]), ch, font=font, fill=fill, anchor="lm")
        x += w + gap


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"{name}.jpg")
    im.save(p, quality=95)
    print(p, im.size)


def label_a():
    """A 투명한 무게: 두꺼운 투명 유리에 숯색 실크 인쇄 — 위계는 영문 표기 · 「맑음」 · 품명 두 줄 · 수치 한 줄."""
    im = Image.new("RGB", (1000, 1400), "white")
    d = ImageDraw.Draw(im)
    cx = 500
    tracked(d, (cx, 330), "MALGEUM", ImageFont.truetype(INTER_M, 40), INK, 0.42)
    d.line([(cx - 60, 400), (cx + 60, 400)], fill=INK, width=2)
    d.text((cx, 560), "맑음", font=ImageFont.truetype(SUIT_SB, 190), fill=INK, anchor="mm")
    d.text((cx, 745), "약산성 토너", font=ImageFont.truetype(SUIT_M, 56), fill=INK, anchor="mm")
    tracked(d, (cx, 825), "MILD ACIDIC TONER", ImageFont.truetype(INTER_M, 30), INK, 0.28)
    d.text((cx, 1010), "pH 5.5   ·   무향   ·   150 ml", font=ImageFont.truetype(SUIT_M, 36), fill=INK, anchor="mm")
    save(im, "A_투명한무게")


def label_b():
    """B 조약돌: 서리 유리에 「맑음」을 음각(잉크 없음), 작은 두 줄만 따뜻한 회색 인쇄."""
    im = Image.new("RGB", (1000, 1200), "white")
    d = ImageDraw.Draw(im)
    cx = 500
    d.text((cx, 470), "맑음", font=ImageFont.truetype(SUIT_SB, 220), fill=EMBOSS, anchor="mm")
    tracked(d, (cx, 720), "MALGEUM  ·  MILD ACIDIC TONER", ImageFont.truetype(INTER_M, 26), GREY, 0.22)
    tracked(d, (cx, 780), "pH 5.5  ·  150 ml", ImageFont.truetype(INTER_M, 26), GREY, 0.22)
    save(im, "B_조약돌")


def label_c():
    """C 맑음 렌즈: 큰 「맑음」 + MALGEUM은 뒷면 안쪽에 인쇄(액체 너머로 확대돼 보임), 앞면엔 아래쪽 작은 한 줄."""
    back = Image.new("RGB", (1000, 1300), "white")
    d = ImageDraw.Draw(back)
    d.text((500, 560), "맑음", font=ImageFont.truetype(SUIT_SB, 300), fill=INK, anchor="mm")
    tracked(d, (500, 820), "MALGEUM", ImageFont.truetype(INTER_M, 56), INK, 0.42)
    save(back, "C_렌즈_뒷면")
    front = Image.new("RGB", (1400, 360), "white")
    d = ImageDraw.Draw(front)
    d.text((700, 140), "약산성 토너", font=ImageFont.truetype(SUIT_M, 48), fill=INK, anchor="mm")
    tracked(d, (700, 230), "MILD ACIDIC TONER  ·  pH 5.5  ·  150 ml", ImageFont.truetype(INTER_M, 28), INK, 0.22)
    save(front, "C_렌즈_앞면")


SILVER = (150, 152, 154)   # A2의 은색 잉크(뚜껑 브러시드 알루미늄과 같은 금속색 한 점)


def label_a2():
    """A2 서리→맑음: 벤치마킹 3-3(3단 이하 · 잉크 2색 이하 · 위쪽 1/3~1/2에만) — MALGEUM · 은색 가는 선 · 「맑음」 · 품명·용량 한 줄."""
    im = Image.new("RGB", (1000, 1400), "white")
    d = ImageDraw.Draw(im)
    cx = 500
    tracked(d, (cx, 250), "MALGEUM", ImageFont.truetype(INTER_M, 40), INK, 0.42)
    d.line([(cx - 60, 318), (cx + 60, 318)], fill=SILVER, width=3)
    d.text((cx, 470), "맑음", font=ImageFont.truetype(SUIT_SB, 190), fill=INK, anchor="mm")
    d.text((cx, 640), "약산성 토너   ·   150 ml", font=ImageFont.truetype(SUIT_M, 40), fill=INK, anchor="mm")
    save(im, "A2_서리맑음")


if __name__ == "__main__":
    label_a()
    label_b()
    label_c()
    label_a2()
