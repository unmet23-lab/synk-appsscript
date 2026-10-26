# 블프 세일 이미지 콘티 합성(2026-10-26, 경로 D) — 굽은 사람 컷 위에 AI로 그리지 않는 글자를 얹는다.
#   python -X utf8 이미지콘티_합성.py [--판 x0,y0,x1,y1]
#   ① 정지컷/C01.png의 어두운 전광판 자리에 G01전광판.png(「자정까지 00:59:59」)를 얹어 C01_합성.png — 판 자리는 굽은 그림에서 찾는다
#      (위쪽 1/3에서 가장 어둡고 넓은 가로 띠). 찾은 자리가 어긋나면 --판으로 1080×1920 기준 좌표를 준다.
#   ⑥ 정지컷/C06.png 뒷벽의 빈 간판(다홍 빛 테두리) 안에 「힘껏」 빛 글자를 얹어 C06_합성.png — 간판은 위쪽 45%에서 가장 넓은 다홍 테두리 덩어리.
#      어긋나면 --간판 x0,y0,x1,y1(1080×1920 기준, 테두리 안쪽).
#   ⑧ 정지컷/C08.png 위에 G08카드.png(터널 벽을 지나가는 제품 카드 둘)를 덮어 C08_합성.png.
#   ⑬ 정지컷/C13.png 위 절반(0–830px)에 G13위.png(끝 카드)를 덮어 C13_합성.png.
import os, sys
import numpy as np
from PIL import Image, ImageFilter

HOME = os.environ["USERPROFILE"]
S = os.path.join(HOME, "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale", "정지컷")
W, H = 1080, 1920


def fit(p):
    im = Image.open(p).convert("RGB")
    if im.size != (W, H):   # 9:16이 아니면 가운데를 9:16으로 잘라 맞춘다
        r = im.width / im.height
        if r > W / H:
            nw = int(im.height * W / H); im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
        else:
            nh = int(im.width * H / W); im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
        im = im.resize((W, H), Image.LANCZOS)
    return im


def find_panel(im):
    g = np.asarray(im.convert("L")).astype(np.float32)
    top = g[: H // 3]
    best, box = 1e9, None
    for y in range(120, H // 3 - 80, 8):
        for x in range(120, W - 420, 12):
            for (w, h) in ((330, 96), (380, 110), (300, 86)):
                if x + w > W or y + h > H // 3:
                    continue
                m = top[y:y + h, x:x + w].mean()
                if m < best:
                    best, box = m, (x, y, x + w, y + h)
    return box, best


def c01(box=None):
    p = os.path.join(S, "C01.png")
    if not os.path.exists(p):
        print("C01.png 없음 — 고른 판을 정지컷에 두고 다시"); return
    im = fit(p)
    if box is None:
        box, m = find_panel(im)
        print("전광판 자리", box, "밝기", round(m, 1))
    x0, y0, x1, y1 = box
    led = Image.open(os.path.join(S, "G01전광판.png")).convert("RGBA").resize((x1 - x0, y1 - y0), Image.LANCZOS)
    base = im.convert("RGBA")
    base.alpha_composite(led, (x0, y0))
    base.convert("RGB").save(os.path.join(S, "C01_합성.png"))


def find_sign(im):
    a = np.asarray(im.convert("HSV")).astype(np.int16)
    top = int(H * 0.45)
    h, sat, v = a[:top, :, 0], a[:top, :, 1], a[:top, :, 2]
    m = ((h < 22) | (h > 245)) & (sat > 120) & (v > 150)   # 다홍 · 주황 빛
    ys, xs = np.nonzero(m)
    if len(xs) < 200:
        return None
    rows = m.sum(1)
    band = np.nonzero(rows > 0.25 * rows.max())[0]           # 테두리의 위 · 아래 가로줄
    cols = m[band.min():band.max() + 1].sum(0)
    xb = np.nonzero(cols > 0.25 * cols.max())[0]
    x0, x1, y0, y1 = int(xb.min()), int(xb.max()), int(band.min()), int(band.max())
    if x1 - x0 < 200 or y1 - y0 < 50:
        return None
    pad = int((y1 - y0) * 0.12)
    return (x0 + pad, y0 + pad, x1 - pad, y1 - pad)


def glow_logo(w, h):
    REF = os.path.join(os.path.dirname(S), "참조")
    logo = Image.open(os.path.join(REF, "힘껏_로고.png")).convert("RGBA")
    s = min(w * 0.78 / logo.width, h * 0.78 / logo.height)
    logo = logo.resize((int(logo.width * s), int(logo.height * s)), Image.LANCZOS)
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    lay.alpha_composite(logo, ((w - logo.width) // 2, (h - logo.height) // 2))
    g = lay.filter(ImageFilter.GaussianBlur(max(4, h // 14)))
    core = lay.copy()
    core = Image.merge("RGBA", (*Image.new("RGB", (w, h), (255, 200, 165)).split(), lay.getchannel("A")))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(g); out.alpha_composite(g); out.alpha_composite(lay); out.alpha_composite(core.filter(ImageFilter.GaussianBlur(1)))
    return out


def c06(box=None):
    p = os.path.join(S, "C06.png")
    if not os.path.exists(p):
        print("C06.png 없음"); return
    im = fit(p).convert("RGBA")
    if box is None:
        box = find_sign(im)
        print("간판 자리", box)
        if box is None:
            print("간판을 못 찾음 — --간판으로 자리를 준다"); return
    x0, y0, x1, y1 = box
    im.alpha_composite(glow_logo(x1 - x0, y1 - y0), (x0, y0))
    im.convert("RGB").save(os.path.join(S, "C06_합성.png"))


def c08():
    # 카드는 사람 뒤 — 카드를 얹은 뒤 사람 + 자전거(u2net 마스크)를 다시 얹는다(Fable 10-26 P1 1)
    p = os.path.join(S, "C08.png")
    if not os.path.exists(p):
        print("C08.png 없음"); return
    from rembg import new_session, remove
    base = fit(p).convert("RGBA")
    m = remove(base.convert("RGB"), session=new_session("u2net"), only_mask=True).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(1.5))
    im = base.copy()
    im.alpha_composite(Image.open(os.path.join(S, "G08카드.png")).convert("RGBA"), (0, 0))
    person = base.copy(); person.putalpha(m)
    im.alpha_composite(person)
    im.convert("RGB").save(os.path.join(S, "C08_합성.png"))


def c13():
    p = os.path.join(S, "C13.png")
    if not os.path.exists(p):
        print("C13.png 없음"); return
    for card, out in (("G13위.png", "C13_합성.png"), ("G13위_6.png", "C13_합성_6.png")):   # 6초 판은 시계 숫자만 다르다
        if not os.path.exists(os.path.join(S, card)):
            continue
        im = fit(p).convert("RGBA")
        im.alpha_composite(Image.open(os.path.join(S, card)).convert("RGBA"), (0, 0))
        im.convert("RGB").save(os.path.join(S, out))


# 고른 판(이미지콘티_정지컷.py)에서 눈으로 잰 자리 — 판을 바꾸면 다시 잰다. ⑥은 자동 찾기가 다홍 옷을 간판으로 잡았다(10-26).
BOX01 = (315, 420, 795, 558)   # C01_203313 자른 판 — 벽 화면 안 가운데
BOX06 = (250, 90, 845, 425)    # C06_203639 자른 판 — 벽 화면 테두리 안

if __name__ == "__main__":
    box = BOX01
    if "--판" in sys.argv:
        box = tuple(int(v) for v in sys.argv[sys.argv.index("--판") + 1].split(","))
    c01(box)
    sign = tuple(int(v) for v in sys.argv[sys.argv.index("--간판") + 1].split(",")) if "--간판" in sys.argv else BOX06
    c06(sign)
    c08()
    c13()
    print("ok")
