# 지유 「손에 든 새 병」 마지막 장면 시작 그림(키프레임_세트2/컷7손_틀.jpg, Gemini 1536×2752)의 병 아랫줄 고치기(10-20 Fable):
# Gemini가 병 인쇄를 거의 그대로 그렸는데 둘째 줄 「pH 5.5 · 150 ml」이 「pH 5 5 · 150ml」(소수점 빠짐)이었다.
# 그 줄의 짙은 획만 골라 둘레 색으로 메우고(cv2 inpaint), 같은 높이 · 색으로 바른 글자를 4배로 그려 줄여 얹는다.
#   python 컷7손_글자고침.py [--확인만]   → 컷7손_틀.jpg를 고치고 원본은 만들기/컷7손_gemini_a.jpg 그대로, 확인 그림 만들기/_컷7손_글자고침.png
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
INTER = os.path.join(ROOT, "docs", "브랜드_폰트", "InterTight", "InterTight-Medium.ttf")  # Regular는 Gemini 글자보다 가늘었다
K = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "키프레임_세트2")
SRC = os.path.join(K, "만들기", "컷7손_gemini_a.jpg")
DST = os.path.join(K, "컷7손_틀.jpg")
BOX = (452, 1774, 556, 1797)   # 둘째 줄이 든 칸(1536 폭 좌표, 4배 확대로 잼: 글자 x 461~542 · 기준선 y≈1788)
TEXT = "pH 5.5 · 150 ml"


def main():
    a = np.asarray(Image.open(SRC).convert("RGB"), np.uint8).copy()
    x0, y0, x1, y1 = BOX
    sub = a[y0:y1, x0:x1].astype(np.float32)
    lum = sub @ np.array([0.299, 0.587, 0.114], np.float32)
    med = cv2.medianBlur(sub.astype(np.uint8), 9).astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    ink = (lum < med - 22)
    # 색: 획 가장자리(밝은 섞임)를 빼고 진한 쪽 30%의 평균 — 평균 전체는 옅게 나왔다
    dark = ink & (lum <= np.percentile(lum[ink], 30)) if ink.any() else ink
    color = sub[dark].mean(axis=0) if dark.any() else np.array([70, 62, 60], np.float32)
    ys, xs = np.where(ink)
    left, top, bot = x0 + xs.min(), y0 + ys.min(), y0 + ys.max()
    mask = np.zeros(a.shape[:2], np.uint8)
    mask[y0:y1, x0:x1][ink] = 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    fixed = cv2.inpaint(a, mask, 3, cv2.INPAINT_TELEA)
    # 글자 높이: 원래 줄 폭(x 463~540, 77px)에 맞춘 대문자 높이 8.6px. 짙은 획 위~아래로 어림하면 p 내림까지 들어가 커졌고,
    # 4배 확대로 잰 7.4px는 원래 줄보다 작고 가늘었다
    cap = 8.6
    ss = 4
    font = ImageFont.truetype(INTER, max(8, int(round(cap / 0.727 * ss))))
    lay = Image.new("RGBA", ((x1 - x0 + 40) * ss, (y1 - y0 + 20) * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    base = (top - (y0 - 10)) * ss + cap * ss  # 기준선 = 원래 글자 위 + 대문자 높이
    d.text(((left - (x0 - 20)) * ss, base), TEXT, font=font, fill=tuple(int(v) for v in color) + (235,), anchor="ls")
    lay = lay.resize((lay.width // ss, lay.height // ss), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.35))
    out = Image.fromarray(fixed).convert("RGBA")
    out.alpha_composite(lay, (x0 - 20, y0 - 10))
    out = out.convert("RGB")
    print(f"글자색 {np.round(color).astype(int)} · 원래 줄 x {left}~{x0 + xs.max()} y {top}~{bot} · 대문자 높이 {cap:.1f}px · 메운 화소 {int((mask > 0).sum())}")
    view = Image.new("RGB", (1000, 340), (24, 24, 24))
    for k, im in enumerate((Image.open(SRC).convert("RGB"), out)):
        c = im.crop((x0 - 30, y0 - 30, x1 + 30, y1 + 20))
        view.paste(c.resize((c.width * 3, c.height * 3), Image.LANCZOS), (0, k * 170))
    view.save(os.path.join(K, "만들기", "_컷7손_글자고침.png"))
    if "--확인만" not in sys.argv:
        out.save(DST, quality=95)
        print(DST)


if __name__ == "__main__":
    main()
