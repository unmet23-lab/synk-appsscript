# 「매진 임박」 콘티 v3 정지컷 → 가편집용 판(2026-10-22, 03_콘티_v3.md). 정지컷_준비.py와 같은 틀(16:9로 채워 자르기 + 공포 컷 붉은밤)에
# v3에서 더한 셋: ① C01a · E3의 택배 상자에 그려진 깨진 글자를 흐린다 ② 그 둘의 TV 화면에 홈쇼핑 화면(remotion out/v3_tv.png)을 원근 합성한다
# ③ 쇼호스트 컷(H1a · H2c · H3d · E2)은 방송 색 그대로, 블렌더 C09b도 그대로(제품 접사는 색조를 바꾸지 않는다).
#   python -X utf8 정지컷_준비_v3.py   → synk-vendor/…/정지컷/색감/<컷>.jpg (없는 컷은 건너뛰고 알린다)
#   TV 화면 그림은 먼저: npx remotion still src/index.ts H1-3 out/v3_tv.png --frame=40  (remotion 폴더에서)
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "색감"))
import 색감  # noqa: E402

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
SRC = os.path.join(V, "정지컷")
OUT = os.path.join(SRC, "색감")
TV = os.path.join(HERE, "remotion", "out", "v3_tv.png")         # H1-3 40프레임(제품 · 가격판, 쇼호스트 없음) — C01a TV 속
TV_E = os.path.join(HERE, "remotion", "out", "v3_tv_e1.png")    # E1-3 15프레임(「주문 완료」) — 끝 고리 E3 TV 속(방송이 흘러간 뒤, Fable P3-7)
W, H = 1920, 1080
HOST = {"H1a", "H2c", "H3d", "E2"}
ROOM = {"C01a", "E3", "C01a_clean"}   # 빈 거실 와이드 — 상자 글자 흐리기 + TV 합성
# 16:9로 채운 C01a에서 상자 면(깨진 글자가 그려진 곳) — 10-22 받은 판 C01a_232412 기준. 그림자만 지운 판도 구도가 같다
BOXES = [(171, 624, 370, 924), (442, 643, 578, 820)]
EXTRA = {"C09b": os.path.join(V, "블렌더", "2안", "horror", "horror_0001.png")}
# 끝 고리 E3 합성 — 칼 그림자에서 칼날 자리를 지우고 같은 손에 택배 상자 그림자를 쥐어 준다(16:9 C01a 기준 좌표)
BLADE = [(1055, 225), (1180, 215), (1185, 300), (1170, 395), (1060, 395), (1050, 300)]   # 손 밑으로 내려온 칼날(첫 판은 칼끝이 상자 밑에 남았다)
BOX = [(995, 128), (1165, 96), (1215, 120), (1222, 262), (1050, 290), (1000, 262)]      # 두 손으로 든 상자 — 윗면이 살짝 보이는 원근


def cover(im):
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((l, t, l + W, t + H))


def blur_boxes(im):
    soft = im.filter(ImageFilter.GaussianBlur(5))
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    for b in BOXES:
        d.rectangle(b, fill=255)
    return Image.composite(soft, im, mask.filter(ImageFilter.GaussianBlur(8)))


def tv_quad(im):
    """오른쪽 위(TV 자리, x 1640~ · y 280~660)에서 밝은 덩어리(켜진 TV 화면)의 네 모서리.
    오른쪽 3분의 1 전체로 찾으면 촛불빛 받은 상자까지 잡혀 왼쪽 아래 모서리가 (1442, 702)로 튀었다"""
    a = np.asarray(im.convert("L"), dtype=np.int32)[280:660, 1640:]
    ys, xs = np.nonzero(a > 185)
    if len(xs) < 2000:
        return None
    xs, ys = xs + 1640, ys + 280
    s, d = xs + ys, xs - ys
    tl = (xs[s.argmin()], ys[s.argmin()])
    br = (xs[s.argmax()], ys[s.argmax()])
    tr = (xs[d.argmax()], ys[d.argmax()])
    bl = (xs[d.argmin()], ys[d.argmin()])
    return [tl, tr, br, bl]


def persp_coeffs(dst, src):
    """PIL PERSPECTIVE 계수: 출력(dst) 좌표 → 입력(src) 좌표"""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(m, dtype=float), np.array([c for p in src for c in p], dtype=float)).tolist()


def put_tv(im, tv_path=TV, q=None, quiet=False):
    """q를 주면 그 모서리를 그대로 쓴다(영상은 첫 프레임에서 한 번 찾아 모든 프레임에 — 영상_색감.py)"""
    q = q or tv_quad(im)
    if q is None or not os.path.exists(tv_path):
        print("  TV 합성 건너뜀", "(화면 못 찾음)" if q is None else f"({os.path.basename(tv_path)} 없음)")
        return im
    tv = Image.open(tv_path).convert("RGB")
    # 화면 안쪽으로 2px 들여 테두리를 남기고, 화면답게 살짝 흐리고 어둡게 · 원래 빛을 15% 남긴다
    cx, cy = sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4
    q = [(x + (2 if x < cx else -2), y + (2 if y < cy else -2)) for x, y in q]
    warped = tv.transform(im.size, Image.PERSPECTIVE, persp_coeffs(q, [(0, 0), (tv.width, 0), (tv.width, tv.height), (0, tv.height)]), Image.BICUBIC)
    warped = warped.filter(ImageFilter.GaussianBlur(0.8)).point(lambda v: int(v * 0.86))
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).polygon(q, fill=int(255 * 0.85))
    out = Image.composite(warped, im, mask.filter(ImageFilter.GaussianBlur(1.2)))
    if not quiet:
        print("  TV 합성", [tuple(map(int, p)) for p in q])
    return out


def shadow_mask(full, clean):
    """그림자 있는 판과 지운 판의 밝기 차이(그림자 자리) — 0~255, 가장자리를 부드럽게"""
    a = np.asarray(full.convert("L"), dtype=np.float32)
    b = np.asarray(clean.convert("L"), dtype=np.float32)
    m = np.clip((b - a - 6) * 6, 0, 255).astype(np.uint8)
    m[:, :560] = 0   # 그림자는 소파 뒤 벽(왼쪽 커튼 · 책장 밖)에만
    m[:, 1450:] = 0  # TV · 옷걸이 쪽은 지운 판이 미세하게 달라 TV 모서리가 흔들렸다
    m[700:, :] = 0
    return Image.fromarray(m).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))


def room_plates(full, clean):
    """① C01a_bg: 그림자 자리만 지운 판에서 가져온 바탕(그 밖은 C01a 픽셀 그대로 — 0.3초에 그림자만 쓸려 들어오게)
    ② E3: 같은 바탕에 칼날을 지우고 상자를 쥔 그림자를 다시 드리운다(어둡기는 칼 그림자 속 실제 비율)"""
    mask = shadow_mask(full, clean)
    bg = Image.composite(clean, full, mask)
    a = np.asarray(full, dtype=np.float32)
    b = np.asarray(clean, dtype=np.float32) + 1
    core = np.asarray(mask) > 200
    ratio = np.median(a[core] / b[core], axis=0) if core.sum() > 500 else np.array([0.35, 0.35, 0.35])
    box_mask = mask.copy()
    d = ImageDraw.Draw(box_mask)
    d.polygon(BLADE, fill=0)
    d.polygon(BOX, fill=255)
    box_mask = box_mask.filter(ImageFilter.GaussianBlur(2))
    dark = Image.fromarray(np.clip(np.asarray(bg, dtype=np.float32) * ratio, 0, 255).astype(np.uint8))
    e3 = Image.composite(dark, bg, box_mask)
    print("  그림자 비율", np.round(ratio, 2), "· 그림자 면적", int(core.sum()))
    return bg, e3


def main():
    ids = [c["id"] for c in json.load(open(os.path.join(HERE, "지시문", "정지컷_v3.json"), encoding="utf-8"))["컷"]]
    os.makedirs(OUT, exist_ok=True)
    done, missing, made = [], [], {}
    for cid in ids + list(EXTRA):
        src = EXTRA.get(cid, os.path.join(SRC, f"{cid}.png"))
        if not os.path.exists(src):
            missing.append(cid)
            continue
        im = cover(Image.open(src).convert("RGB"))
        if cid in ROOM:
            im = blur_boxes(im)
        made[cid] = im
    # 거실 판: 그림자만 지운 판이 있으면 바탕판 · 끝 고리를 합성(픽셀이 같아야 고리가 된다, Fable P2-5), 없으면 C01a를 그대로 바탕으로
    if "C01a" in made:
        if "C01a_clean" in made:
            made["C01a_bg"], made["E3"] = room_plates(made["C01a"], made["C01a_clean"])
        else:
            made["C01a_bg"] = made["C01a"]
            made.setdefault("E3", made["C01a"])
            print("  그림자 지운 판 아직 없음 — C01a_bg · E3를 C01a로 임시")
        made["C01a"] = put_tv(made["C01a"])
        made["C01a_bg"] = put_tv(made["C01a_bg"])
        made["E3"] = put_tv(made["E3"], TV_E)
    # 얼굴이 보이게 다시 굽는 C09v3가 아직 없으면 v2 C09(같은 자리 · 붉은밤 입힌 판)를 임시로
    if "C09v3" not in made and os.path.exists(os.path.join(OUT, "C09.jpg")):
        Image.open(os.path.join(OUT, "C09.jpg")).save(os.path.join(OUT, "C09v3.jpg"), quality=92)
        print("  C09v3 아직 없음 — v2 C09로 임시")
    for cid, im in made.items():
        if cid == "C01a_clean":
            continue
        if cid not in HOST and cid not in EXTRA:
            im = 색감.grade(im, "붉은밤")
        im.save(os.path.join(OUT, f"{cid}.jpg"), quality=92)
        done.append(cid)
    print(f"정지컷/색감 v3: {len(done)}장 {done} · 아직 없음 {missing}")


if __name__ == "__main__":
    main()
