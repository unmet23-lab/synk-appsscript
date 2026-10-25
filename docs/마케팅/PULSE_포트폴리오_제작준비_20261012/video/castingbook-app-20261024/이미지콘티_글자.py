# 8번 이미지 콘티 — 화면 위 글자 시안(2026-10-25). 최종은 후반(Remotion)에서 움직이고, 여기는 원본 자리 · 크기를 맞춘 정지 시안이다.
#   글자 1(15번) 「이 얼굴이다 싶으면」, 글자 2(16 · 17번) 「패키지에 담아 / 우리 가게 광고까지」, 제목(20번) 「손님을 / 부르는 / 모델」, 끝 화면(21번).
#   python -X utf8 이미지콘티_글자.py  → 컷/C15.jpg · C16.jpg · C17.jpg · C20.jpg에 글자를 얹은 판(…_글자.jpg)과 컷/C21.jpg
# 자리는 원본 실측(1920×1080): 글자 1 · 2는 x 120, 글자 높이 약 64px, 흰색 · 그림자 없음. 제목은 원본 27.5초 판의 세 덩이 자리(계단, 오른쪽으로 기운 굵은 글자).
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

P8 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8")
CUT = P8 / "컷"
F = Path(r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT")
LOGO = Path(r"C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/assets/brand-pulse.webp")
BERRY = (0x99, 0x29, 0x5D)
TEXT1 = "이 얼굴이다 싶으면"
TEXT2 = ["패키지에 담아", "우리 가게 광고까지"]
TITLE = [("손님을", (255, 255, 255)), ("부르는", (255, 255, 255)), ("모델", BERRY)]
URL_LINE = "PULSE 모델 캐스팅북 · synk.im/pulse/casting"   # 끝 화면 작은 한 줄(콘티 5절 3 — 추천안, 원본에는 없음)


def font(w, size):
    return ImageFont.truetype(str(F / f"SUIT-{w}.otf"), size)


def lines(im, rows, x=120, top=455, size=74, gap=92):
    d = ImageDraw.Draw(im)
    f = font("ExtraBold", size)
    for i, t in enumerate(rows):
        d.text((x, top + i * gap), t, font=f, fill=(255, 255, 255))
    return im


def chunk(text, size, color):
    f = font("Heavy", size)
    l, t, r, b = f.getbbox(text)
    pad = 40
    layer = Image.new("RGBA", (r - l + pad * 2, b - t + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((pad - l, pad - t), text, font=f, fill=color + (255,))
    k = 0.22   # 위가 오른쪽으로 기운 글자(원본처럼) — 출력 (x, y)는 입력 (x + k·y − k·h, y)를 읽는다
    w, h = layer.size
    sheared = layer.transform((int(w + k * h), h), Image.AFFINE, (1, k, -k * h, 0, 1, 0), resample=Image.BICUBIC)
    return sheared.rotate(-3, resample=Image.BICUBIC, expand=True)   # 원본처럼 오른쪽으로 조금 내려가는 계단


def title(im):
    # 원본 27.5초 판(1920 기준): 첫 덩이 x 110 · y 130, 둘째 x 320 · y 380, 셋째(색) x 200 · y 560 — 셋째가 가장 크다
    for (text, color), (x, y, size) in zip(TITLE, [(100, 110, 190), (300, 360, 190), (170, 560, 280)]):
        c = chunk(text, size, color)
        im.alpha_composite(c, (x, y))
    return im


def url_line(im, logo_h, alpha=255):
    """로고(가운데) 아래 작은 한 줄 — 글자 높이 약 30px, 짙은 회색."""
    f = font("Medium", 36)
    d = ImageDraw.Draw(im, "RGBA")
    w = d.textlength(URL_LINE, font=f)
    d.text(((1920 - w) / 2, (1080 + logo_h) / 2 + 44), URL_LINE, font=f, fill=(68, 68, 68, alpha))
    return im


def end_frame():
    im = Image.new("RGB", (1920, 1080), (255, 255, 255))
    logo = Image.open(LOGO).convert("RGBA")
    w = 900; logo = logo.resize((w, int(logo.height * w / logo.width)), Image.LANCZOS)
    im.paste(logo, ((1920 - w) // 2, (1080 - logo.height) // 2), logo)
    small = Image.open(LOGO).convert("RGBA"); w2 = 360; small = small.resize((w2, int(small.height * w2 / small.width)), Image.LANCZOS)
    im2 = Image.new("RGB", (1920, 1080), (255, 255, 255)); im2.paste(small, ((1920 - w2) // 2, (1080 - small.height) // 2), small)
    im3 = url_line(im2.copy(), small.height)
    return im, im3, im2


def base(cut):
    """글자를 얹을 판: 합성한 판(컷/) → 고른 판(정지컷/) → 가장 최근에 받은 판(받음/)."""
    import glob, os
    for p in (CUT / f"{cut}.jpg", P8 / "정지컷" / f"{cut}.png"):
        if p.exists():
            return Image.open(p).convert("RGB").resize((1920, 1080), Image.LANCZOS)
    g = sorted(glob.glob(str(P8 / "받음" / f"{cut}_*.jpg")), key=os.path.getmtime)
    return Image.open(g[-1]).convert("RGB").resize((1920, 1080), Image.LANCZOS) if g else None


if __name__ == "__main__":
    CUT.mkdir(parents=True, exist_ok=True)
    for cut, fn in [("C15", lambda im: lines(im, [TEXT1], top=500)), ("C16", lambda im: lines(im, TEXT2)), ("C17", lambda im: lines(im, TEXT2))]:
        im = base(cut)
        if im:
            fn(im).save(CUT / f"{cut}_글자.jpg", quality=92); print(cut, "글자")
    im = base("C20")
    if im:
        title(im.convert("RGBA")).convert("RGB").save(CUT / "C20_글자.jpg", quality=92); print("C20 제목")
    a, b, c = end_frame()
    a.save(CUT / "C21.jpg", quality=95); b.save(CUT / "C21_끝.jpg", quality=95); c.save(CUT / "C21_끝_로고만.jpg", quality=95); print("C21 끝 화면(주소 줄 · 로고만)")
