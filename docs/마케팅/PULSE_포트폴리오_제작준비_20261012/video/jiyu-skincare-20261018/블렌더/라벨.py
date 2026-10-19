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


def endcard_text(b, ink=(70, 70, 68, 255)):
    # 엔드카드: 오른쪽 맞춤 세 줄(1080 폭 화면 기준 글자 크기), 「세안 뒤 첫 숨, 맑게」는 맑음 전용 문구
    # 10-18 Fable 검수: 글자는 병 아래 가운데에(위쪽 y 140~320은 릴스·쇼츠 UI 아래이고 4:5·1:1 밖) → 가운데 맞춤 세 줄
    im = Image.new("RGBA", (900, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = 450
    d.text((cx, 60), b["ko"], font=ImageFont.truetype(SUIT_M, 80), fill=ink, anchor="mm")
    spaced(d, (cx, 140), b["en"], ImageFont.truetype(INTER, 34), (90, 90, 86, 255), 9)
    copy = "세안 뒤 첫 숨, 맑게" if b["ko"] == "맑음" else "세안 뒤 첫 숨"
    d.text((cx, 210), copy, font=ImageFont.truetype(SUIT, 36), fill=(90, 90, 86, 255), anchor="mm")
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
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
