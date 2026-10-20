# 지유 광고 · 「손에 든 병」 마지막 장면의 로고 · 문구 층(10-20 유호님 「병 CG가 너무 촌스러운데 트렌디하게」 → 「손에 든 병」 · 「병도 새로」).
# 벽에 띄운 병 그림 + 가운데 쌓은 세 줄(v3c · v4) 대신, 제품은 지유 손에(장면 안), 글자는 하린 MORU C안처럼 위쪽 빈 벽 왼쪽에 작게.
# 로고 「맑음」은 음의 ㅇ을 물방울 고리로 바꾼 판(본질 하나 숨기기 — 후반 가이드 3절 재미 장치)과 그냥 판 둘.
#   python 엔드카드_손.py <바탕 그림(9:16)> [출력 폴더]   → 엔드카드손_층_<판>.png(1080×1920 투명) + 엔드카드손_시안_<판>.jpg(바탕 위 · 글자 자리 선)
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
FONTS = os.path.join(ROOT, "docs", "브랜드_폰트")
SUIT_SB = os.path.join(FONTS, "SUIT", "SUIT-SemiBold.otf")
SUIT_M = os.path.join(FONTS, "SUIT", "SUIT-Medium.otf")
INTER_M = os.path.join(FONTS, "InterTight", "InterTight-Medium.ttf")
W, H = 1080, 1920
SAFE = (65, 269, 920, 1248)       # 9:16 글자 자리(SNS 키트 cover916)
INK, SUB = (45, 40, 36, 255), (66, 60, 54, 255)   # 세트 2 회벽 위 따뜻한 차콜(라벨.py INK_S2 · SUB_S2)
X0, Y0 = 84, 300                  # 하린 C안과 같은 자리(왼쪽 84 · 위 300)


def droplet_ring(size, stroke, ink):
    """물방울 고리: 동그라미 위가 살짝 뾰족한 물방울 윤곽(굵기 stroke). size = 원래 ㅇ 바깥 지름."""
    ss = 4
    S = size * ss
    im = Image.new("L", (S, int(S * 1.25)), 0)
    d = ImageDraw.Draw(im)
    r = S / 2
    cx, cy = S / 2, im.height - r
    pts = []
    for k in range(361):
        a = np.radians(k - 90)  # 위에서 시작
        # 위쪽 60°만 뾰족하게 끌어올림
        lift = max(0.0, np.cos(np.radians(k - 0 if k <= 180 else 360 - k)) ) ** 6 * 0.42 * S
        pts.append((cx + r * np.cos(a), cy + r * np.sin(a) - lift))
    d.polygon(pts, fill=255)
    inner = Image.new("L", im.size, 0)
    di = ImageDraw.Draw(inner)
    k2 = (r - stroke * ss) / r
    pts2 = [(cx + (x - cx) * k2, cy + (y - cy) * k2 + stroke * ss * 0.15) for x, y in pts]
    di.polygon(pts2, fill=255)
    ring = np.clip(np.asarray(im, np.int16) - np.asarray(inner, np.int16), 0, 255).astype(np.uint8)
    ring = Image.fromarray(ring).resize((size, int(size * 1.25)), Image.LANCZOS)
    out = Image.new("RGBA", ring.size, ink[:3] + (0,))
    out.putalpha(ring)
    return out


def wordmark(size, ink, drop=False):
    """「맑음」 글자 그림(투명). drop이면 음의 ㅇ(맨 위 고리)을 같은 굵기의 물방울 고리로 바꾼다."""
    font = ImageFont.truetype(SUIT_SB, size)
    pad = size // 2
    w = int(ImageDraw.Draw(Image.new("L", (1, 1))).textlength("맑음", font=font)) + 2 * pad
    im = Image.new("L", (w, size * 2), 0)
    ImageDraw.Draw(im).text((pad, pad), "맑음", font=font, fill=255)
    if drop:
        import cv2
        a = np.asarray(im)
        half = a.shape[1] // 2  # 음은 오른쪽 절반
        n, lab, st, _ = cv2.connectedComponentsWithStats((a > 127).astype(np.uint8), 8)
        # 오른쪽 절반에서 가장 위에 있는 덩어리 = 음의 ㅇ
        cands = [j for j in range(1, n) if st[j, cv2.CC_STAT_LEFT] > half - 2]
        j = min(cands, key=lambda j: st[j, cv2.CC_STAT_TOP])
        x, y, bw, bh = (int(v) for v in st[j, :4])
        ring_mask = (lab == j)
        thick = max(2, int(round(ring_mask.sum() / (np.pi * (bw + bh) / 2))))  # 고리 넓이 ÷ 둘레 ≈ 굵기
        a = a.copy()
        a[ring_mask] = 0
        # 지운 자리 둘레의 흐린 가장자리도 지운다
        a[max(0, y - 2):y + bh + 2, max(0, x - 2):x + bw + 2][a[max(0, y - 2):y + bh + 2, max(0, x - 2):x + bw + 2] < 200] = 0
        im = Image.fromarray(a)
        # 물방울 전체 높이 = 원래 ㅇ 높이(솟으면 음이 맑보다 커 보였다), 가로 가운데를 ㅇ 가운데에
        dsize = int(round(bh / 1.25))
        dr = droplet_ring(dsize, thick, (255, 255, 255, 255)).getchannel("A")
        im.paste(dr, (x + (bw - dr.width) // 2, y + bh - dr.height), dr)
    im = im.crop(im.getbbox())
    out = Image.new("RGBA", im.size, ink[:3] + (0,))
    out.putalpha(im)
    return out


def spaced_text(d, xy, text, font, fill, track):
    x, y = xy
    for c in text:
        d.text((x, y), c, font=font, fill=fill, anchor="ls")
        x += d.textlength(c, font=font) + track


def lockup(drop=False, size=(W, H), xy=(X0, Y0), scale=1.0):
    """로고 · 문구 층(투명, size). xy = 「맑음」 왼쪽 위, scale = 글자 크기 · 간격 배율."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    wm = wordmark(round(92 * scale), INK, drop)
    x0, y0 = xy
    layer.alpha_composite(wm, (x0, y0))
    d = ImageDraw.Draw(layer)
    y = y0 + wm.height + round(46 * scale)
    spaced_text(d, (x0 + 3, y), "malgeum", ImageFont.truetype(INTER_M, round(28 * scale)), SUB, 28 * scale * 0.08)
    d.text((x0 + 2, y + round(30 * scale)), "세안 뒤 첫 숨, 맑게", font=ImageFont.truetype(SUIT_M, round(34 * scale)), fill=SUB, anchor="lt")
    return layer


# 피드 판(4:5 · 1:1) 0.8배(10-20 v5 Fable P3): 같은 크기면 문구 줄(y 236~256)이 헤어밴드 윗선(≈240)과 같은 높이 · 가로 40~60px라
# 로고가 머리에 붙어 보였다
FEED_SCALE = 0.8


def lockup_for(ratio):
    """본편_편집.py --손: 비율마다 로고 층. 9:16은 글자 자리 안(84, 300), 피드 판은 위 여백 72px · 0.8배."""
    size = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080)}[ratio]
    if ratio == "9:16":
        return lockup(False, size, (X0, Y0))
    return lockup(False, size, (X0, 72), FEED_SCALE)


def main():
    bg_path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(bg_path)
    bg = Image.open(bg_path).convert("RGB")
    s = W / bg.width
    bg = bg.resize((W, round(bg.height * s)), Image.LANCZOS)
    top = (bg.height - H) // 2
    bg = bg.crop((0, top, W, top + H)).convert("RGBA")
    for name, drop in (("그냥", False), ("물방울", True)):
        lay = lockup(drop)
        lay.save(os.path.join(out_dir, f"엔드카드손_층_{name}.png"))
        im = bg.copy()
        im.alpha_composite(lay)
        box = lay.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        ok = box[0] >= SAFE[0] and box[1] >= SAFE[1] and box[2] <= SAFE[2] and box[3] <= SAFE[3]
        im.convert("RGB").save(os.path.join(out_dir, f"엔드카드손_시안_{name}.jpg"), quality=93)
        chk = im.copy()
        ImageDraw.Draw(chk).rectangle(SAFE, outline=(255, 60, 60, 255), width=3)
        chk.convert("RGB").resize((540, 960), Image.LANCZOS).save(os.path.join(out_dir, f"엔드카드손_자리_{name}.jpg"), quality=90)
        print(name, "글자 범위", box, "글자 자리 안" if ok else "글자 자리 밖")


if __name__ == "__main__":
    main()
