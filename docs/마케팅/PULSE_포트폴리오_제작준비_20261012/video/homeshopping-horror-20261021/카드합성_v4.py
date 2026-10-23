# 콘티 v4 광고 카드 넷의 이미지 콘티 시안(2026-10-23) — 손 그림(Gemini, 물건 자리는 크로마키 초록 대역) + 블렌더 물건 + 글자 시안.
# 제품은 AI로 그리지 않는다: 초록 대역 자리에 블렌더 렌더(블렌더/광고카드_물건.py)를 넣고, 대역 앞을 가리던 손가락만 손 그림에서 되살린다.
# 글자는 원본 카드 자리 · 순서(04 4절)의 마지막 상태를 PIL로 얹은 시안이다 — 최종은 Remotion.
#   python -X utf8 카드합성_v4.py   → synk-vendor/…/콘티/v4/컷/S11.jpg · S21.jpg · S27.jpg · S29.jpg (+ _글자없음)
# 손 그림은 정지컷/v4/H1.png(카드 1) · H2.png(카드 2) · H3.png(카드 ? · 3).
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HOME = os.environ["USERPROFILE"]
V = os.path.join(HOME, "Documents", "synk-vendor", "homeshopping-horror-20261021")
PROPS = os.path.join(V, "블렌더", "카드v4")
OUT = os.path.join(V, "콘티", "v4", "컷")
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
BHS = os.path.join(V, "fonts", "BlackHanSans-Regular.ttf")
SERIF = "C:/Windows/Fonts/HANBatangB.ttf"   # 필기체 자리 시안(최종 Remotion에서 서체를 고른다)
W, H = 1920, 1080


def load(p, flag=cv2.IMREAD_UNCHANGED):
    return cv2.imdecode(np.fromfile(p, np.uint8), flag)


def save(p, img):
    cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tofile(p)


def green_mask(bgr):
    """크로마키 초록 대역 — 밝은 앞면(강한 초록)에 이어진 그늘진 옆면(아주 어두운 초록, 예: 15 · 23 · 10)까지 이어 잡는다(10-23 H3).
    약한 초록만으로는 어두운 바탕의 잡티까지 잡히니, 강한 초록과 이어진 약한 초록 덩어리만 둔다."""
    b, g, r = [bgr[..., i].astype(np.int16) for i in range(3)]
    d = g - np.maximum(r, b)
    strong = ((d > 16) & (g > 30)).astype(np.uint8)
    weak = ((d > 4) & (g > 12)).astype(np.uint8)
    weak = cv2.morphologyEx(weak * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab = cv2.connectedComponents(weak)
    keep = np.unique(lab[strong > 0])
    keep = keep[keep > 0]
    m = np.isin(lab, keep).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        raise SystemExit("초록 대역을 못 찾음")
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return (lab == k).astype(np.uint8) * 255


def body_box(alpha, narrow=0.5):
    """렌더 알파에서 몸통 상자 — 폭이 가장 넓은 줄의 반보다 좁은 줄(리본 꼬리 · 손잡이 끝)은 뺀다"""
    rows = (alpha > 40).sum(1)
    keep = np.nonzero(rows > rows.max() * narrow)[0]
    cols = np.nonzero((alpha[keep.min(): keep.max() + 1] > 40).any(0))[0]
    return cols.min(), keep.min(), cols.max() - cols.min() + 1, keep.max() - keep.min() + 1


def composite(plate_p, prop_p, narrow=0.5, scale=1.06, bottom_align=True, tint=(1.0, 1.0, 1.0)):
    plate = load(plate_p, cv2.IMREAD_COLOR)
    plate = cv2.resize(plate, (W, H), interpolation=cv2.INTER_AREA)
    gm = green_mask(plate)
    gx, gy, gw, gh = cv2.boundingRect(gm)
    prop = load(prop_p)
    bx, by, bw, bh = body_box(prop[..., 3], narrow)
    k = max(gw / bw, gh / bh) * scale
    pr = cv2.resize(prop, (max(1, int(prop.shape[1] * k)), max(1, int(prop.shape[0] * k))), interpolation=cv2.INTER_AREA)
    # 몸통 가운데를 대역 가운데에, 아래는 대역 아래(손끝 위에 얹힘)에 맞춘다
    ox = int(gx + gw / 2 - (bx + bw / 2) * k)
    oy = int(gy + gh - (by + bh) * k) if bottom_align else int(gy + gh / 2 - (by + bh / 2) * k)
    # 1) 초록은 먼저 바탕으로 메운다(물건이 덮지 못한 가장자리에 초록이 남지 않게)
    base = cv2.inpaint(plate, cv2.dilate(gm, np.ones((9, 9), np.uint8)), 7, cv2.INPAINT_TELEA)
    canvas = base.astype(np.float32)
    x0, y0 = max(ox, 0), max(oy, 0)
    x1, y1 = min(ox + pr.shape[1], W), min(oy + pr.shape[0], H)
    sub = pr[y0 - oy: y1 - oy, x0 - ox: x1 - ox].astype(np.float32)
    a = sub[..., 3:4] / 255.0
    canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - a) + sub[..., :3] * np.array(tint, np.float32) * a   # tint는 BGR 곱
    # 2) 대역 앞을 가리던 손가락: 대역 윤곽(볼록 껍질) 안의 초록 아닌 살빛 화소를 손 그림에서 되살린다
    cnts, _ = cv2.findContours(gm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull = np.zeros_like(gm)
    cv2.fillPoly(hull, [cv2.convexHull(max(cnts, key=cv2.contourArea))], 255)
    hsv = cv2.cvtColor(plate, cv2.COLOR_BGR2HSV)
    skin = ((hsv[..., 0] < 25) | (hsv[..., 0] > 165)) & (hsv[..., 1] > 40) & (hsv[..., 2] > 50)
    front = (hull > 0) & (gm == 0) & skin
    front = cv2.morphologyEx(front.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    front = cv2.GaussianBlur(front, (0, 0), 1.2).astype(np.float32)[..., None] / 255.0
    # 손가락에 묻은 초록 반사를 덜어 낸다
    fp = plate.astype(np.float32)
    g_over = np.clip(fp[..., 1] - np.maximum(fp[..., 0], fp[..., 2]), 0, None)
    fp[..., 1] -= g_over * 0.8
    canvas = canvas * (1 - front) + fp * front
    return np.clip(canvas, 0, 255).astype(np.uint8)


# ── 글자 시안(원본 카드 자리 · 마지막 상태) ───────────────────────────────────────
def F(p, s):
    return ImageFont.truetype(p, s)


def shadow_text(d, xy, t, f, fill, sh=(0, 0, 0), off=5):
    d.text((xy[0] + off, xy[1] + off), t, font=f, fill=sh)
    d.text(xy, t, font=f, fill=fill)


def center_text(d, cx, y, t, f, fill, **kw):
    w = d.textlength(t, font=f)
    shadow_text(d, (cx - w / 2, y), t, f, fill, **kw)


def seal(im, cx, cy, rx, ry, big, small="+배송비", color=(232, 196, 92), ink=(96, 66, 18)):
    """금빛 톱니 타원 가격 씰"""
    d = ImageDraw.Draw(im)
    pts = []
    for i in range(72):
        t = 2 * np.pi * i / 72
        r = 1.0 if i % 2 == 0 else 0.9
        pts.append((cx + rx * r * np.cos(t), cy + ry * r * np.sin(t)))
    d.polygon(pts, fill=color)
    d.ellipse([cx - rx * 0.8, cy - ry * 0.8, cx + rx * 0.8, cy + ry * 0.8], outline=(250, 226, 150), width=4)
    f = F(BHS, int(ry * 0.62))
    w = d.textlength(big, font=f)
    d.text((cx - w / 2, cy - ry * 0.45), big, font=f, fill=ink)
    f2 = F(os.path.join(SUIT, "SUIT-ExtraBold.otf"), int(ry * 0.26))
    w2 = d.textlength(small, font=f2)
    d.text((cx - w2 / 2, cy + ry * 0.28), small, font=f2, fill=ink)


def script(d, x, y, lines, size, fill, right=True):
    f = F(SERIF, size)
    for i, t in enumerate(lines):
        w = d.textlength(t, font=f)
        d.text(((x - w) if right else x, y + i * size * 1.15), t, font=f, fill=fill)


def card_text(img, which):
    im = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).convert("RGBA")
    d = ImageDraw.Draw(im)
    num = F(BHS, 132)
    if which == 1:
        d.rectangle([1180, 108, 1520, 178], fill=(196, 28, 36))
        center_text(d, 1350, 112, "한정판", F(BHS, 58), (255, 255, 255), off=0)
        seal(im, 1660, 150, 200, 112, "99,000원")
        script(d, 1840, 330, ["금장", "꽉 KKWAK", "미니"], 92, (236, 214, 168))
        center_text(d, 1150, 236, "*홈쇼핑 단독 구성*", F(os.path.join(SUIT, "SUIT-ExtraBold.otf"), 34), (255, 255, 255), off=2)
        center_text(d, 960, 840, "1577-꽉꽉", num, (255, 255, 255))
    elif which == 2:
        d.text((1020, 70), "핑크 에디션!", font=F(BHS, 78), fill=(236, 66, 146))
        d.text((1024, 160), "홈쇼핑 단독", font=F(BHS, 48), fill=(236, 66, 146))
        seal(im, 1690, 140, 190, 104, "999,000원")
        for i, t in enumerate(["진공", "4중 잠금", "6종", "세트", "뚜껑 색 다른 버전"]):
            d.text((1024, 270 + i * 82), t, font=F(BHS, 70), fill=(236, 90, 150))
        # 노란 띠(세 번 깜박 — 켜진 순간)
        band = Image.new("RGBA", (1100, 190), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        bd.rectangle([0, 0, 1099, 189], fill=(250, 240, 70), outline=(30, 30, 30), width=6)
        bd.text((60, 30), "라벨 스티커 포함!", font=F(BHS, 120), fill=(170, 30, 190))
        band = band.rotate(-12, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(band, (760, 380))
        # 「단독」 원 딱지 · 「지금 주문!!!」 거품
        d.ellipse([60, 780, 300, 1020], fill=(196, 30, 60))
        center_text(d, 180, 860, "단독", F(BHS, 76), (255, 255, 255), off=0)
        pts = [(1160 + 230 * np.cos(t) * (1.0 if i % 2 else 0.86), 930 + 70 * np.sin(t) * (1.0 if i % 2 else 0.86)) for i, t in enumerate(np.linspace(0, 2 * np.pi, 40, endpoint=False))]
        d.polygon(pts, fill=(160, 196, 250), outline=(30, 40, 90))
        center_text(d, 1160, 892, "지금 주문!!!", F(BHS, 64), (250, 236, 120), sh=(30, 40, 90), off=3)
        center_text(d, 640, 920, "1577-꽉꽉", F(BHS, 112), (255, 255, 255))
    elif which == 0:   # 「?」 카드
        script(d, 1560, 420, ["???"], 150, (226, 150, 196))
    elif which == 3:
        seal(im, 1660, 150, 200, 112, "9,999,000원")
        d.ellipse([1560, 70, 1800, 300], fill=(252, 232, 40))
        center_text(d, 1680, 140, "9,900원", F(BHS, 62), (210, 20, 30), off=0)
        stamp = Image.new("RGBA", (620, 130), (0, 0, 0, 0))
        sd = ImageDraw.Draw(stamp)
        sd.rectangle([0, 0, 619, 129], outline=(200, 30, 40), width=10)
        sd.text((90, 14), "특별 할인", font=F(BHS, 96), fill=(200, 30, 40))
        stamp = stamp.rotate(8, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(stamp, (560, 120))
        script(d, 1800, 520, ["코케트", "떡볶이"], 118, (226, 150, 196))
        center_text(d, 1660, 820, "*파리 미포함", F(os.path.join(SUIT, "SUIT-Medium.otf"), 34), (230, 230, 230), off=0)
        center_text(d, 1150, 920, "1577-꽉꽉", F(BHS, 112), (255, 255, 255))
    return cv2.cvtColor(np.asarray(im.convert("RGB")), cv2.COLOR_RGB2BGR)


# ── 강도가 든 물건: Gemini가 그린 대역(금빛 것 · 분홍 상자 · 리본 도시락)을 블렌더 렌더로 덮는다 ──────────
# 컷 → (받은 그림, 물건 렌더, 덮을 상자 x, y, w, h(받은 그림 좌표), 돌림 각도, 앞 손가락 다각형들). 상자 · 다각형은 받은 그림을 확대해 잰다.
# 앞 손가락 다각형 안은 받은 그림 화소를 되살린다(대역을 앞에서 감싸던 손가락이 물건 위로 오게).
# 지울 다각형: 블렌더 물건을 얹기 전에 대역을 둘레 바탕으로 메운다 — 맑은 용기 몸통 너머로 대역이 비쳤다(10-23 첫 판).
HELD = {
    "S13": ("S13_175855.jpg", "mini/mini_0001.png", (1438, 380, 130, 120), -8, [[(1395, 480), (1450, 470), (1545, 474), (1560, 502), (1560, 720), (1395, 720)]],
            [[(1448, 388), (1560, 392), (1562, 490), (1448, 490)]]),
    "S09": ("S09_180244.jpg", "mini/mini_0001.png", (915, 350, 150, 125), 18, [[(850, 330), (958, 352), (962, 520), (850, 520)], [(930, 480), (1000, 478), (1028, 502), (1072, 502), (1072, 620), (930, 620)]],
            [[(925, 345), (1052, 343), (1068, 500), (935, 505)]]),
    # #31 리본 끝에 매달린 도시락: 대역 도시락 · 나비 · 손에서 내려오는 끈 · 아래로 늘어진 끈을 지우고 블렌더 매달린 판을 건다(손은 되살림)
    "S31": ("S31_183341.jpg", "tteok_hang/tteok_hang_0001.png", (858, 860, 280, 140), 0, [[(940, 556), (1062, 556), (1066, 706), (936, 706)]],
            [[(986, 590), (1070, 590), (1165, 785), (1165, 1010), (840, 1010), (840, 785)], [(830, 990), (1165, 990), (1170, 1140), (825, 1140)]]),
}
# #23 납작한 선물 상자: 분홍 대역 상자의 앞면 네 귀퉁이에 블렌더 상자 앞면 그림(카드_상자앞면.png)을 원근째 씌운다 — 옆면은 같은 분홍이라 둔다
ART = {
    "S23": ("S23_182909.jpg", "카드_상자앞면.png", [(1660, 395), (1985, 545), (1850, 860), (1460, 750)],
            [[(1720, 800), (1770, 740), (1820, 725), (1870, 730), (1885, 770), (1860, 860), (1820, 905), (1725, 905)]]),
}


def put_art(src, art_p, quad, front=(), light=0.66):
    img = load(src, cv2.IMREAD_COLOR)
    art = load(art_p, cv2.IMREAD_COLOR)
    h, w = art.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([(0, 0), (w, 0), (w, h), (0, h)]), np.float32(quad))
    H_, W_ = img.shape[:2]
    warped = cv2.warpPerspective(art, M, (W_, H_), flags=cv2.INTER_AREA)
    mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), M, (W_, H_))
    mask = cv2.GaussianBlur(mask, (0, 0), 1.2).astype(np.float32)[..., None] / 255.0
    lit = warped.astype(np.float32) * np.array([light * 0.92, light * 0.97, light * 1.06], np.float32)   # 방 빛(텅스텐)에 맞춰 어둡게
    out = img.astype(np.float32) * (1 - mask) + lit * mask
    if front:
        m = np.zeros(img.shape[:2], np.uint8)
        for poly in front:
            cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
        m = cv2.GaussianBlur(m, (0, 0), 2.0).astype(np.float32)[..., None] / 255.0
        out = out * (1 - m) + img.astype(np.float32) * m
    return np.clip(out, 0, 255).astype(np.uint8)


def put_prop(src, prop_p, box, rot=0.0, narrow=0.5, front=(), erase=()):
    img = load(src, cv2.IMREAD_COLOR)
    base = img
    if erase:
        em = np.zeros(img.shape[:2], np.uint8)
        for poly in erase:
            cv2.fillPoly(em, [np.array(poly, np.int32)], 255)
        base = cv2.inpaint(img, cv2.dilate(em, np.ones((7, 7), np.uint8)), 9, cv2.INPAINT_TELEA)
    prop = load(prop_p)
    if rot:
        h, w = prop.shape[:2]
        M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, 1.0)
        prop = cv2.warpAffine(prop, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    bx, by, bw, bh = body_box(prop[..., 3], narrow)
    x, y, w, h = box
    k = min(w / bw, h / bh)
    pr = cv2.resize(prop, (max(1, int(prop.shape[1] * k)), max(1, int(prop.shape[0] * k))), interpolation=cv2.INTER_AREA)
    ox, oy = int(x + w / 2 - (bx + bw / 2) * k), int(y + h / 2 - (by + bh / 2) * k)
    H_, W_ = img.shape[:2]
    x0, y0, x1, y1 = max(ox, 0), max(oy, 0), min(ox + pr.shape[1], W_), min(oy + pr.shape[0], H_)
    sub = pr[y0 - oy: y1 - oy, x0 - ox: x1 - ox].astype(np.float32)
    a = sub[..., 3:4] / 255.0 * 0.97
    # 방 빛에 맞춰 조금 어둡게 · 따뜻하게(렌더는 밝은 텅스텐)
    sub = sub[..., :3] * np.array([0.62, 0.72, 0.84], np.float32)   # BGR — 0.78 · 0.80 · 0.86은 차고 밝아 붙인 티가 났다(Fable P2 #31)
    out = base.astype(np.float32)
    out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - a) + sub * a
    if front:
        m = np.zeros(img.shape[:2], np.uint8)
        for poly in front:
            cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
        m = cv2.GaussianBlur(m, (0, 0), 2.0).astype(np.float32)[..., None] / 255.0
        out = out * (1 - m) + img.astype(np.float32) * m
    return np.clip(out, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    st = os.path.join(V, "정지컷", "v4")
    for cid, (src, prop, box, rot, front, erase) in HELD.items():
        img = put_prop(os.path.join(V, "받음", "v4", src), os.path.join(PROPS, prop), box, rot, 0.55 if "tteok" in prop else 0.5, front, erase)
        cv2.imencode(".png", img)[1].tofile(os.path.join(st, f"{cid}.png"))
        print(cid, "물건 바꿔 끼움 →", os.path.join(st, f"{cid}.png"))
    for cid, (src, art, quad, front) in ART.items():
        img = put_art(os.path.join(V, "받음", "v4", src), os.path.join(PROPS, art), quad, front)
        cv2.imencode(".png", img)[1].tofile(os.path.join(st, f"{cid}.png"))
        print(cid, "상자 앞면 씌움 →", os.path.join(st, f"{cid}.png"))
    WARM = (0.66, 0.78, 0.92)   # BGR — 상자 · 도시락 렌더가 어두운 거실 손 그림보다 차고 밝았다(Fable P2). 금장 미니는 잘 맞아 그대로
    jobs = [("S11", "H1", "mini/mini_0001.png", 1, 0.5, (1.0, 1.0, 1.0)),
            ("S21", "H2", "giftbox/giftbox_0001.png", 2, 0.5, WARM),
            ("S27", "H3", "tteok/tteok_0001.png", 0, 0.55, WARM),
            ("S29", "H3", "tteok/tteok_0001.png", 3, 0.55, WARM)]
    for cid, hand, prop, which, narrow, tint in jobs:
        plate = os.path.join(st, f"{hand}.png")
        if not os.path.exists(plate):
            print(cid, "손 그림 없음", plate)
            continue
        img = composite(plate, os.path.join(PROPS, prop), narrow=narrow, bottom_align=(which != 2), tint=tint)
        save(os.path.join(OUT, f"{cid}_글자없음.jpg"), img)
        save(os.path.join(OUT, f"{cid}.jpg"), card_text(img, which))
        print(cid, "→", os.path.join(OUT, f"{cid}.jpg"))
