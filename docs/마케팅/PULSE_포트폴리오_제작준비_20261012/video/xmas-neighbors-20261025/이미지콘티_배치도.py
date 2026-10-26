# 시즌 1 「옆집의 크리스마스」 이미지 콘티의 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 6번 「연말 빈방」 배치도와 같은 길:
# 원본 배우의 얼굴 · 몸 · 옷이 옮겨 오지 않게 사람을 지우고 크게 흐리거나, 사람 자리만 검은 실루엣으로 둔다.
# 다른 점: 원본은 벽돌집 거리 · 우리는 5층 바깥 복도라 원본 배경은 카메라 높이 · 각도 · 화면 안 큰 모양 자리만 주도록 회색조로 낮춘다
# (원본 낮빛이 우리 밤 장면에 번지지 않게 — 밤 컷은 더 어둡게).
#   python -X utf8 이미지콘티_배치도.py 실루엣 [컷…]   → 배치/S01_mask.png …(원본 그 컷 첫 프레임의 사람 자리) · _확인/S01.jpg · 배치/_실루엣상자.json
#   python -X utf8 이미지콘티_배치도.py 가까이 3 4 …    → 배치/S03_배치.png = 사람을 지우고 크게 흐린 회색조 원본 위 검은 실루엣(새 카메라 자리)
#   python -X utf8 이미지콘티_배치도.py 흐림 2 6 …      → 배치/S02_배치.png = 사람 없이 크게 흐린 회색조 원본(물건 접사 · 사람 없는 컷)
#   python -X utf8 이미지콘티_배치도.py 놓기 <이름> <판> <사람그림> x0,y0,x1,y1 [뒤집기]
#        → 배치/<이름>_배치.png = 우리 복도 판(정지컷/<판>.png) 위, 사람그림(기준 사진)의 사람 자리를 상자(화면 %)에 맞춰 검은 실루엣으로
#          (고정 와이드 1 · 12 · 20 · 26 · 35 — 원본 정면 집 와이드를 복도 끝에서 본 와이드로 옮겨, 원본 사람 크기 · 자리만 숫자로 받는다)
# 원본 프레임 · 배치도는 git 밖(synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors/)에만 둔다.
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors")
F = V / "원본프레임"
OUT = V / "배치"
ST = V / "정지컷"
W, H = 1920, 1080
# 우리 판에서 밤 · 어두운 실내인 컷 — 배치도 회색을 낮춰 원본 낮빛이 번지지 않게
NIGHT = {1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 31, 32, 33, 34, 35, 36}


def imread(p):   # cv2.imread는 한글 경로를 못 읽는다
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img)
    buf.tofile(str(p))


def layout_out(name, img):
    """배치도는 배치/<이름>_배치.png(보드 · 확인용)와 올릴 사본 ego/refs/배치/<이름>.jpg(1600×900)로 둔다"""
    imwrite(OUT / f"{name}_배치.png", img)
    (V / "ego" / "refs" / "배치").mkdir(parents=True, exist_ok=True)
    imwrite(V / "ego" / "refs" / "배치" / f"{name}.jpg", cv2.resize(img, (1600, 900), interpolation=cv2.INTER_AREA))


_ses = None


def person_mask(img):
    global _ses
    from rembg import new_session, remove
    _ses = _ses or new_session("u2net_human_seg")
    m = np.asarray(remove(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), session=_ses, only_mask=True)).astype(np.float32) / 255
    m = (m > 0.5).astype(np.uint8) * 255
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))


# 분할이 놓친 사람 · 잘못 잡은 것은 원본 1920×1080 좌표로 손수 고친다(눈으로 확인한 뒤 더함). poly는 채우고 cut은 지운다.
ADD = {}


def mask_for(n):
    img = imread(F / f"F{n:02d}_첫.jpg")
    m = person_mask(img)
    for poly in ADD.get(n, {}).get("poly", []):
        cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
    for poly in ADD.get(n, {}).get("cut", []):
        cv2.fillPoly(m, [np.array(poly, np.int32)], 0)
    return img, m


def box_of(m):
    ys, xs = np.nonzero(m)
    if not len(xs):
        return None
    return {"left": round(xs.min() / W * 100), "right": round(xs.max() / W * 100),
            "top": round(ys.min() / H * 100), "bottom": round(ys.max() / H * 100), "area": round((m > 0).mean() * 100, 1)}


def grey_blur(img, m, sigma, night):
    """사람(마스크)을 지워 메우고 크게 흐린 회색조 — 카메라 높이 · 각도와 큰 모양 자리만 남는다"""
    if m is not None and m.any():
        mm = cv2.dilate(m, np.ones((25, 25), np.uint8))
        small = cv2.resize(img, (W // 2, H // 2))
        ms = cv2.resize(mm, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST)
        small = cv2.inpaint(small, ms, 15, cv2.INPAINT_TELEA)
        img = cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC)
    g = cv2.cvtColor(cv2.GaussianBlur(img, (0, 0), sigma), cv2.COLOR_BGR2GRAY).astype(np.float32)
    # 대비를 반으로 줄이고 가운데 밝기를 정한다(낮 105 · 밤 62) — 모양은 남기고 원본 노출은 넘기지 않는다
    target = 62 if night else 105
    g = (g - g.mean()) * 0.5 + target
    g = np.clip(g, 0, 255).astype(np.uint8)
    return cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)


def silhouettes(ns):
    (OUT / "_확인").mkdir(parents=True, exist_ok=True)
    bp = OUT / "_실루엣상자.json"
    boxes = json.loads(bp.read_text(encoding="utf-8")) if bp.exists() else {}
    for n in ns:
        img, m = mask_for(n)
        imwrite(OUT / f"S{n:02d}_mask.png", m)
        dbg = img.copy()
        dbg[m > 0] = (dbg[m > 0] * 0.4 + np.array([0, 0, 255]) * 0.6).astype(np.uint8)
        imwrite(OUT / "_확인" / f"S{n:02d}.jpg", cv2.resize(dbg, (960, 540)))
        boxes[str(n)] = box_of(m)
        print(n, boxes[str(n)])
    bp.write_text(json.dumps(boxes, ensure_ascii=False, indent=1), encoding="utf-8")


def close(ns, with_sil=True):
    """새 카메라 자리: 사람을 지우고 크게 흐린 회색조 원본 위 검은 실루엣(with_sil=False면 실루엣 없이)"""
    OUT.mkdir(parents=True, exist_ok=True)
    for n in ns:
        img, m = mask_for(n)
        base = grey_blur(img, m, 24, n in NIGHT)
        if with_sil:
            base[m > 0] = (14, 14, 14)
        layout_out(f"S{n:02d}", base)
        print(n, "배치도", "실루엣" if with_sil else "흐림만")


def place(name, plate, src, box, flip=False):
    """우리 판 위에 기준 사진의 사람 모양을 상자(화면 %)에 맞춰 검은 실루엣으로 — 고정 와이드의 사람 자리"""
    pl = cv2.resize(imread(ST / f"{plate}.png") if (ST / f"{plate}.png").exists() else imread(ST / f"{plate}.jpg"), (W, H), interpolation=cv2.INTER_AREA)
    sim = imread(src)
    m = person_mask(sim)
    if flip:
        m = cv2.flip(m, 1)
    ys, xs = np.nonzero(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    x0, y0, x1, y1 = [float(v) / 100 for v in box.split(",")]
    bw, bh = int((x1 - x0) * W), int((y1 - y0) * H)
    # 사람 모양의 가로세로 비를 지키고 상자 높이에 맞춘 뒤 상자 가운데에 둔다
    s = bh / m.shape[0]
    mw = max(1, int(m.shape[1] * s))
    mr = cv2.resize(m, (mw, bh), interpolation=cv2.INTER_NEAREST)
    cx = int((x0 + x1) / 2 * W)
    left = cx - mw // 2
    out = pl.copy()
    tgt = np.zeros((H, W), np.uint8)
    xa, xb = max(0, left), min(W, left + mw)
    tgt[int(y0 * H):int(y0 * H) + bh, xa:xb] = mr[:, xa - left:xb - left]
    out[tgt > 0] = (14, 14, 14)
    layout_out(name, out)
    imwrite(OUT / f"{name}_mask.png", tgt)
    print(name, plate, "놓음", box_of(tgt))


def tilt(n, end_t, shift, ratio=(4, 3)):
    """큰 위아래 기울임(5번 아래로 43%)을 한 장에: 원본 처음 프레임(위)과 끝 프레임(아래)을 기울인 만큼 겹쳐 이어 붙인 세로 판 —
    Gemini 비율(4:3)에 맞춰 양옆을 늘이고, 받은 판에서 위 창(시작) · 아래 창(끝)을 잘라 쓴다(카메라무브.py)."""
    img, m = mask_for(n)
    SRC = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/레퍼런스/원본영상/hq_3cAzAf6s3ic/hq_3cAzAf6s3ic_h264.mp4")
    cap = cv2.VideoCapture(str(SRC))
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(end_t * 25)))
    ok, end = cap.read()
    top = grey_blur(img, m, 24, n in NIGHT)
    em = person_mask(end)
    bot = grey_blur(end, em, 24, n in NIGHT)
    off = int(round(H * shift))
    ch = H + off
    canvas = np.zeros((ch, W, 3), np.uint8)
    canvas[off:off + H] = bot
    # 겹친 띠는 위(시작)에서 아래(끝)로 부드럽게 넘긴다(바탕만) — 사람은 처음 · 끝 두 실루엣을 합쳐 끊김 없이 검게
    for y in range(H):
        a = 1.0 if y < off else max(0.0, 1.0 - (y - off) / max(1, H - off))
        canvas[y] = (top[y] * a + canvas[y] * (1 - a)).astype(np.uint8)
    # 끝 프레임 실루엣은 처음 실루엣 아래쪽(다리)의 가로 폭 안만 — 원본의 개 · 장바구니 끌개는 다리와 붙어 한 덩이라 폭으로 자른다(우리 판은 봉투 · 발)
    leg = m[int(H * 0.8):]
    xs = np.nonzero(leg)[1]
    x0, x1 = (max(0, xs.min() - 30), min(W, xs.max() + 30)) if len(xs) else (0, W)
    keep = np.zeros_like(em)
    keep[:, x0:x1] = em[:, x0:x1]
    sil = np.zeros((ch, W), np.uint8)
    sil[:H] |= m
    sil[off:off + H] |= keep
    canvas[sil > 0] = (14, 14, 14)
    cw = int(round(ch * ratio[0] / ratio[1]))
    pad = max(0, (cw - W) // 2)
    canvas = cv2.copyMakeBorder(canvas, 0, 0, pad, cw - W - pad, cv2.BORDER_REPLICATE)
    name = f"S{n:02d}t"
    imwrite(OUT / f"{name}_배치.png", canvas)
    (V / "ego" / "refs" / "배치").mkdir(parents=True, exist_ok=True)
    imwrite(V / "ego" / "refs" / "배치" / f"{name}.jpg", cv2.resize(canvas, (1600, int(1600 * canvas.shape[0] / canvas.shape[1])), interpolation=cv2.INTER_AREA))
    json.dump({"shift": shift, "pad_frac": pad / cw, "win_w_frac": W / cw, "win_h_frac": H / ch}, open(OUT / f"{name}_창.json", "w", encoding="utf-8"))
    print(name, "기울임 판", canvas.shape[1], "×", canvas.shape[0], "창 가로", round(W / cw, 3), "세로", round(H / ch, 3))


if __name__ == "__main__":
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == "실루엣":
        silhouettes([int(x) for x in args] or list(range(1, 37)))
    elif mode == "가까이":
        close([int(x) for x in args])
    elif mode == "흐림":
        close([int(x) for x in args], with_sil=False)
    elif mode == "기울임":   # 기울임 5 8.56 0.43 — 컷 · 원본 끝 프레임 초 · 기울인 양(화면 높이 비)
        tilt(int(args[0]), float(args[1]), float(args[2]))
    elif mode == "놓기":
        place(args[0], args[1], args[2], args[3], len(args) > 4 and args[4] == "뒤집기")
