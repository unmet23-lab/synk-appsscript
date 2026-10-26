# 2번 · 남성 향수(가칭 솔서리 SOLSEORI) — 병 인쇄 · 뚜껑 각인 · 상징 원고 (2026-10-26, 크레딧 0)
# 제품 글자 · 상징은 AI로 그리지 않고 이 원고를 블렌더 재질에 붙인다(AI 광고영상 제작 규칙 원칙).
#   python -I -X utf8 라벨.py  → <밖>/라벨/병앞_흰잉크.png · 뚜껑_각인.png · 상징_ㅅ.png
#   <밖> = Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p2
# 상징: 이름 첫 자모 「ㅅ」을 솔잎 두 가닥이 잎집에서 갈라지는 꼴로 — 원본의 브랜드 머리글자 얼음 조각 자리에 우리 머리글자를 둔다.
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p2", "라벨")
os.makedirs(밖, exist_ok=True)
SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"
SANS = os.path.join(os.environ["USERPROFILE"], "Documents", "SYNK-appsscript", "docs", "브랜드_폰트", "InterTight", "InterTight-Medium.ttf")


def serif(size, weight="Regular"):
    f = ImageFont.truetype(SERIF, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def spaced(d, cx, y, text, f, spacing, fill=255):
    widths = [d.textlength(ch, font=f) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fill, anchor="lm")
        x += w + spacing


def needle_pair(d, cx, top, h, spread, width, fill=255):
    """가는 잎집에서 두 솔잎이 아래로 갈라지는 「ㅅ」. 1판은 동그란 머리 + 곧은 두 다리라 제도용 컴퍼스로 읽혀,
    잎집을 가늘고 길쭉하게(머리 폭의 0.7배) 줄이고 솔잎은 머리카락처럼 가늘게 끝을 모으며 바깥으로 살짝 휘게, 오른쪽을 7 % 길게 했다.
    3판(10-26 밤, Fable 이미지 콘티 2차 P1-3 · P2-1): 잎집이 글자 높이의 20~40%라 꼭대기가 기둥으로 솟아 λ(뒤집은 Y) · 人으로 읽혔다 —
    잎집을 작은 마디(폭 × 1.0, 글자 높이의 10% 안)로 줄여 두 획이 꼭대기에서 바로 갈라지게."""
    sw, sh = width * 0.7, width * 1.0
    d.rounded_rectangle([cx - sw / 2, top, cx + sw / 2, top + sh], radius=sw / 2, fill=fill)
    for side, longer in ((-1, 1.0), (1, 1.07)):
        pts = []
        for i in range(61):
            t = i / 60
            # 잎집 바로 밑은 붙어 있다가(처음 8 %) 갈라지고, 아래로 갈수록 바깥으로 휜다
            k = max(0.0, (t - 0.08) / 0.92)
            x = cx + side * (width * 0.18 + spread * longer * (k ** 1.35))
            y = top + sh * 0.85 + h * longer * t
            pts.append((x, y))
        for i in range(len(pts) - 1):
            t = i / (len(pts) - 1)
            w = width * 0.55 * (1.0 - 0.85 * t ** 1.3)
            d.line([pts[i], pts[i + 1]], fill=fill, width=max(1, int(round(w))))
            r = w / 2
            d.ellipse([pts[i][0] - r, pts[i][1] - r, pts[i][0] + r, pts[i][1] + r], fill=fill)


def bottle_front():
    # 병 앞면(가로 46 mm × 세로 88 mm)을 1 mm = 20 px로 — 920 × 1760. 흰 잉크 자리만 하얗다(나머지 투명 유리).
    W, H = 920, 1760
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    cx = W // 2
    # 2판(10-26 밤, Fable 이미지 콘티 1차 P1-6 · P2-8): 원본 라벨판은 어깨 바로 아래라 18번 첫 프레임 · 17번에 이름 자리가 보인다 —
    # 「ㅅ」 · 「솔서리」를 몸통 위쪽으로 올리고(ㅅ 470 → 300 · 솔서리 1000 → 760) 사이를 좁혔다. 300은 향수 수면(287) 바로 아래
    needle_pair(d, cx, 300, 230, 120, 22)
    spaced(d, cx, 760, "솔서리", serif(170, "Medium"), 26)
    spaced(d, cx, 920, "SOLSEORI", ImageFont.truetype(SANS, 52), 30)
    d.line([cx - 90, 1000, cx + 90, 1000], fill=255, width=3)
    spaced(d, cx, 1070, "EAU DE COLOGNE", ImageFont.truetype(SANS, 34), 16)
    spaced(d, cx, 1130, "100 ml", ImageFont.truetype(SANS, 30), 10)
    im.save(os.path.join(밖, "병앞_흰잉크.png"))


def cap_top():
    # 뚜껑 윗면(26 × 26 mm)을 1 mm = 40 px로 — 1040 × 1040. 흰 자리가 음각(깊이는 블렌더에서).
    S = 1040
    im = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(im)
    needle_pair(d, S // 2, 260, 430, 220, 90)   # 2판(Fable P2-4): 0.72초 접사에서 가는 선이 안 읽혔다 — 선 굵기 2배 · 3판(Fable 2차 P1-3): 2판은 다리 끝이 윗면 밖으로 나가 잘렸다 — 윗면의 75% 안
    im = im.filter(ImageFilter.GaussianBlur(3))
    im.save(os.path.join(밖, "뚜껑_각인.png"))


def symbol():
    S = 1600
    im = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(im)
    needle_pair(d, S // 2, 260, 1050, 520, 150)
    im.save(os.path.join(밖, "상징_ㅅ.png"))


if __name__ == "__main__":
    bottle_front()
    cap_top()
    symbol()
    print("ok", 밖)
