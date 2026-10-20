# 지유 스킨케어 · 가상 브랜드 「맑음 MALGEUM」 토너 라벨을 그린다(블렌더 병에 입힐 흰 실크 인쇄 그림 + 엔드카드 글자).
#   python -X utf8 라벨.py [브랜드=malgeum|soom]   → Documents/synk-vendor/jiyu-skincare-20261018/블렌더/라벨_<브랜드>.png 등
# 콘티 v2 5절은 「SVG 한 파일」이었으나, 블렌더는 SVG 글자를 그림으로 못 입혀 PIL로 같은 사양에서 두 그림을 낸다:
#   - 라벨_<브랜드>.png: 병 둘레에 감을 투명 바탕 흰 글자(4096×2048, 가로 = 병 둘레 141.4mm 중 앞면 70mm만 씀)
#   - 엔드카드글자_<브랜드>.png: 엔드카드 그늘 벽에 얹을 짙은 글자(투명 바탕)
# 둘째 브랜드 「숨 SOOM」은 「제품 교체 시연」(콘티 v2 6절)용.
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", ".."))
FONTS = os.path.join(ROOT, "docs", "브랜드_폰트")
SUIT = os.path.join(FONTS, "SUIT", "SUIT-Regular.otf")
SUIT_M = os.path.join(FONTS, "SUIT", "SUIT-Medium.otf")
INTER = os.path.join(FONTS, "InterTight", "InterTight-Regular.ttf")
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "블렌더")

BRANDS = {
    "malgeum": {"ko": "맑음", "en": "MALGEUM", "line": "pH 5.5  TONER", "vol": "150 ml"},
    "soom": {"ko": "숨", "en": "SOOM", "line": "MILD  TONER", "vol": "150 ml"},
}

# 병: 지름 45mm → 둘레 141.37mm. 라벨 그림 가로 4096px가 둘레 전체, 세로 2048px가 병 몸통 높이 70.7mm(같은 축척 29px/mm).
W, H = 4096, 2048
PX_MM = W / 141.37


def spaced(d, xy, text, font, fill, spacing_px, anchor="mm"):
    # 글자 사이를 벌려 가운데 맞춤(PIL에는 자간이 없다)
    widths = [d.textlength(c, font=font) for c in text]
    total = sum(widths) + spacing_px * (len(text) - 1)
    x = xy[0] - total / 2
    for c, w in zip(text, widths):
        d.text((x, xy[1]), c, font=font, fill=fill, anchor="lm" if anchor == "mm" else anchor)
        x += w + spacing_px


def label(b, ink=(255, 255, 255, 235)):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = W // 2  # 그림 가운데 = 병 앞면 가운데(블렌더에서 앞으로 돌려 맞춤)
    mm = lambda v: round(v * PX_MM)
    d.text((cx, mm(24)), b["ko"], font=ImageFont.truetype(SUIT, mm(14)), fill=ink, anchor="mm")
    spaced(d, (cx, mm(37)), b["en"], ImageFont.truetype(INTER, mm(4.2)), ink, mm(1.6))
    d.line((cx - mm(5), mm(44), cx + mm(5), mm(44)), fill=ink, width=max(2, mm(0.18)))
    spaced(d, (cx, mm(50)), b["line"], ImageFont.truetype(INTER, mm(2.7)), ink, mm(0.55))
    spaced(d, (cx, mm(55)), b["vol"], ImageFont.truetype(INTER, mm(2.7)), ink, mm(0.55))
    return im


def endcard_text(b, ink=(70, 70, 68, 255), sub=(90, 90, 86, 255)):
    # 엔드카드: 오른쪽 맞춤 세 줄(1080 폭 화면 기준 글자 크기), 「세안 뒤 첫 숨, 맑게」는 맑음 전용 문구
    # 10-18 Fable 검수: 글자는 병 아래 가운데에(위쪽 y 140~320은 릴스·쇼츠 UI 아래이고 4:5·1:1 밖) → 가운데 맞춤 세 줄
    im = Image.new("RGBA", (900, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = 450
    d.text((cx, 60), b["ko"], font=ImageFont.truetype(SUIT_M, 80), fill=ink, anchor="mm")
    spaced(d, (cx, 140), b["en"], ImageFont.truetype(INTER, 34), sub, 9)
    copy = "세안 뒤 첫 숨, 맑게" if b["ko"] == "맑음" else "세안 뒤 첫 숨"
    d.text((cx, 210), copy, font=ImageFont.truetype(SUIT, 36), fill=sub, anchor="mm")
    return im


# 세트 2(10-19 새 욕실): 그레이지 석회 벽(RGB 약 183,170,154)에서 v3c 글자색은 제목 4.2:1 · 아랫줄 3.0:1로 떨어졌다(Fable)
# → 따뜻한 차콜. 제목 (45,40,36) 약 6.8:1, 아랫줄 (66,60,54) 약 5:1
INK_S2, SUB_S2 = (45, 40, 36, 255), (66, 60, 54, 255)

# 병 2(10-20 유호님 「병 CG가 너무 촌스러운데 트렌디하게」 → 「병도 새로」): 투명 유리에 바로 찍는 인쇄(라벨 종이 없음).
# 병 2는 지름 44mm(인쇄 소매 반지름 22.12mm → 둘레 138.98mm), 인쇄 높이 z 10~98mm(88mm). 30px/mm.
# 가운데 맞춤 세 줄(v1) 대신 왼쪽 맞춤 · 작은 글자 · 빈 유리를 넉넉히: 위에 「맑음」 + 소문자 영문, 아래에 성분 두 줄
PX2 = 30
W2, H2 = round(2 * 3.14159265 * 22.12 * PX2), 88 * PX2
BRANDS2 = {
    "malgeum": {"ko": "맑음", "en": "malgeum", "l1": "약산성 무향 토너", "l2": "pH 5.5 · 150 ml"},
    "soom": {"ko": "숨", "en": "soom", "l1": "순한 진정 토너", "l2": "pH 5.5 · 150 ml"},
}
SUIT_SB = os.path.join(FONTS, "SUIT", "SUIT-SemiBold.otf")
INTER_M = os.path.join(FONTS, "InterTight", "InterTight-Medium.ttf")


def label_v2(b, ink=(255, 255, 255, 240)):
    """병 2 인쇄 그림(투명 바탕, 알파 = 잉크). 블렌더 재질이 잉크 색을 정하므로 여기서는 모양만."""
    im = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    mm = lambda v: round(v * PX2)  # noqa: E731
    # 앞면 가운데에서 왼쪽 10.5mm(14.5mm는 창빛 세로 반사 띠가 첫 글자를 가렸다, 10-20 참고 렌더)
    x0 = W2 // 2 - mm(10.5)
    d.text((x0, mm(9)), b["ko"], font=ImageFont.truetype(SUIT_SB, mm(10.5)), fill=ink, anchor="lt")
    en = ImageFont.truetype(INTER_M, mm(3.4))
    x = x0 + mm(0.4)
    for c in b["en"]:  # 자간 +0.06em, 글자마다 그리므로 기준선(ls)으로 맞춘다(lt면 l이 내려앉음)
        d.text((x, mm(26.0)), c, font=en, fill=ink, anchor="ls")
        x += d.textlength(c, font=en) + mm(3.4) * 0.06
    small_ko, small_en = ImageFont.truetype(SUIT, mm(2.5)), ImageFont.truetype(INTER, mm(2.3))
    d.text((x0 + mm(0.3), mm(74)), b["l1"], font=small_ko, fill=ink, anchor="lt")
    d.text((x0 + mm(0.3), mm(78.2)), b["l2"], font=small_en, fill=ink, anchor="lt")
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    if "--병2" in sys.argv:  # 병 2 인쇄 그림 + 확인용 앞면(짙은 잉크를 옅은 물빛 바탕에)
        for n in [a for a in sys.argv[1:] if not a.startswith("--")] or list(BRANDS2):
            p = os.path.join(OUT, f"라벨_{n}_v2.png")
            lab = label_v2(BRANDS2[n])
            lab.save(p)
            fw = round(46 * PX2)
            prev = Image.new("RGBA", (fw, H2), (214, 232, 232, 255))
            ink = Image.new("RGBA", lab.size, (40, 42, 44, 255))
            ink.putalpha(lab.getchannel("A"))
            prev.alpha_composite(ink.crop(((W2 - fw) // 2, 0, (W2 + fw) // 2, H2)))
            prev.convert("RGB").resize((fw // 3, H2 // 3)).save(os.path.join(OUT, f"_라벨확인_{n}_v2.jpg"), quality=90)
            print(p)
        return
    if "--세트2" in sys.argv:  # 세트 2 엔드카드 글자만(라벨 그림은 그대로)
        for n in [a for a in sys.argv[1:] if not a.startswith("--")] or ["malgeum"]:
            p = os.path.join(OUT, f"엔드카드글자_{n}_세트2.png")
            endcard_text(BRANDS[n], INK_S2, SUB_S2).save(p)
            print(p)
        return
    names = sys.argv[1:] or list(BRANDS)
    for n in names:
        b = BRANDS[n]
        p1 = os.path.join(OUT, f"라벨_{n}.png")
        label(b).save(p1)
        p2 = os.path.join(OUT, f"엔드카드글자_{n}.png")
        endcard_text(b).save(p2)
        # 확인용: 회색 바탕에 얹은 앞면만
        prev = Image.new("RGBA", (round(70 * PX_MM), H), (150, 160, 165, 255))
        prev.alpha_composite(label(b).crop(((W - prev.width) // 2, 0, (W + prev.width) // 2, H)))
        prev.convert("RGB").resize((prev.width // 4, H // 4)).save(os.path.join(OUT, f"_라벨확인_{n}.jpg"), quality=90)
        print(p1, p2)


if __name__ == "__main__":
    main()
