# -*- coding: utf-8 -*-
"""상표견본 `SYNK` 조판 v2 — 정본 폰트(라틴=Inter Tight)로 다시.

바뀐 것 두 가지
  ① 폰트 — 브랜드 폰트 정본 §1 은 SUIT 를 **한글 전용**으로 못박았고 라틴은 Inter Tight 다.
     확정 로고 W5 도 Inter Tight 600 이다(tools/로고주입.js 실물).
  ② 조판 — v1 은 글자를 하나씩 찍어 커닝이 빠졌다. 통짜 렌더를 기본으로 하고,
     트래킹이 필요할 때만 글자별로 가되 **통짜와 폭을 대조해 커닝 손실을 실측**한다.

견본은 브랜드 산출물이 아니라 법적 서류다 — 잉크 순검정·바탕 순백(색을 넣으면 보호가
그 색 조합에 묶일 여지가 생긴다). DESIGN.md 철칙①(순백·순검정 금지)은 여기 적용하지 않는다.
"""
import os
from PIL import Image, ImageDraw, ImageFont

FONT = r"C:\Users\q1212\Documents\SYNK-appsscript\docs\브랜드_폰트"
OUT = os.path.dirname(os.path.abspath(__file__))
DPI = 300
CM = DPI / 2.54
SS = 4

def cm2px(cm):
    return int(round(cm * CM))

def 그리기(font, text, tracking_px):
    """마스크(L 모드)를 돌려준다. tracking 0 이면 통짜 — 폰트 커닝이 산다."""
    img = Image.new("L", (16000, 6000), 0)
    d = ImageDraw.Draw(img)
    if tracking_px == 0:
        d.text((600, 1200), text, font=font, fill=255)
    else:
        x = 600
        for ch in text:
            d.text((x, 1200), ch, font=font, fill=255)
            x += int(round(d.textlength(ch, font=font))) + tracking_px
    return img

def 폰트찾기(경로, 목표h):
    lo, hi = 10, 4000
    while lo < hi:
        mid = (lo + hi) // 2
        f = ImageFont.truetype(경로, mid)
        bb = 그리기(f, "SYNK", 0).getbbox()
        if bb[3] - bb[1] < 목표h:
            lo = mid + 1
        else:
            hi = mid
    return lo

def 조판(경로, 라벨, 글자높이_cm=1.9, 여백_cm=0.55, 트래킹_em=0.0):
    목표h = cm2px(글자높이_cm) * SS
    size = 폰트찾기(경로, 목표h)
    font = ImageFont.truetype(경로, size)

    통짜 = 그리기(font, "SYNK", 0).getbbox()
    낱자 = 그리기(font, "SYNK", 0 if 트래킹_em == 0 else 1).getbbox()  # 커닝 대조용
    커닝손실 = (낱자[2] - 낱자[0]) - (통짜[2] - 통짜[0]) - (3 if 트래킹_em else 0)

    tr = int(round(size * 트래킹_em))
    마스크전체 = 그리기(font, "SYNK", tr)
    bb = 마스크전체.getbbox()
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    pad = cm2px(여백_cm) * SS

    큰판 = Image.new("RGB", (w + pad * 2, h + pad * 2), (255, 255, 255))
    잉크 = Image.new("RGB", (w, h), (0, 0, 0))
    큰판.paste(잉크, (pad, pad), 마스크전체.crop(bb))
    최종 = 큰판.resize((큰판.width // SS, 큰판.height // SS), Image.LANCZOS)

    jpg = os.path.join(OUT, 라벨 + ".jpg")
    최종.save(jpg, "JPEG", quality=95, dpi=(DPI, DPI), subsampling=0)
    print("%-32s %4dx%-4d px = %.2f x %.2f cm | %5.1fKB | 커닝손실 %dpx"
          % (라벨, 최종.width, 최종.height, 최종.width / CM, 최종.height / CM,
             os.path.getsize(jpg) / 1024, 커닝손실))
    return 최종, 라벨

if __name__ == "__main__":
    후보 = [
        (os.path.join(FONT, "InterTight", "InterTight-Bold.ttf"),
         "ㄱ_InterTight_Bold", -0.014),
        (os.path.join(FONT, "InterTight", "InterTight-SemiBold.ttf"),
         "ㄴ_InterTight_SemiBold_로고와_같은_웨이트", -0.014),
        (os.path.join(FONT, "SUIT", "SUIT-ExtraBold.otf"),
         "ㄷ_SUIT_ExtraBold_한글전용_폰트", 0.0),
    ]
    판들 = [조판(p, l, 트래킹_em=t) for p, l, t in 후보]

    # 비교판 — 세 후보를 한 장에 쌓는다(유호님이 한 번에 고르게).
    라벨폰트 = ImageFont.truetype(os.path.join(FONT, "SUIT", "SUIT-SemiBold.otf"), 30)
    이름 = ["ㄱ · Inter Tight Bold  — 정본 라틴 폰트 (권고)",
            "ㄴ · Inter Tight SemiBold — 확정 로고와 같은 웨이트",
            "ㄷ · SUIT ExtraBold — 정본상 한글 전용 폰트"]
    폭 = max(im.width for im, _ in 판들) + 80
    높 = sum(im.height + 70 for im, _ in 판들) + 40
    비교 = Image.new("RGB", (폭, 높), (255, 255, 255))
    d = ImageDraw.Draw(비교)
    y = 20
    for (im, _), nm in zip(판들, 이름):
        d.text((40, y), nm, font=라벨폰트, fill=(90, 90, 100))
        y += 46
        비교.paste(im, (40, y))
        d.rectangle([40, y, 40 + im.width - 1, y + im.height - 1], outline=(220, 220, 225))
        y += im.height + 24
    비교.save(os.path.join(OUT, "비교_SYNK_견본_3후보.png"), "PNG")
    print("\n비교판 = 비교_SYNK_견본_3후보.png  (%dx%d)" % (비교.width, 비교.height))
