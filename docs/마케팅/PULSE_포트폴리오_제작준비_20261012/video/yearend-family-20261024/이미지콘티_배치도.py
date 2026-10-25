# 6번 「연말 빈방」 이미지 콘티의 배치도(2026-10-25) — Gemini에 원본 프레임 대신 넣는 그림. 「매진 임박」 v4 배치도(S31)와 같은 길:
# 원본 배우의 얼굴 · 몸 · 옷이 옮겨 오지 않게 사람을 지우고 크게 흐리거나, 사람 자리만 검은 실루엣으로 둔다.
#   python -X utf8 이미지콘티_배치도.py 방            → 배치/R1_배치.png(피아노 시대 · 원본 #4 첫 프레임, 사람 없음) · R2_배치(낮은 장 · #14) ·
#                                                     R3_배치(마지막 거실 · #18) · K20_배치(빈방 · #20) — 사람을 지우고 크게 흐림
#   python -X utf8 이미지콘티_배치도.py 실루엣 [조각…]  → 배치/S01_mask.png …(원본 그 조각 첫 프레임의 사람 자리, 1920×1080) · _확인/S01.jpg
#   python -X utf8 이미지콘티_배치도.py 합성 01=R1 …   → 배치/S01_배치.png = 우리 거실 판(정지컷/R1.png) 위 같은 자리에 검은 실루엣(11d=S11m: 엄마만 구운 판 위에 딸 실루엣)
#   python -X utf8 이미지콘티_배치도.py 가까이 19 21 22 → 배치/S19_배치.png = 사람을 지우고 크게 흐린 원본 위 검은 실루엣(끝 넷 — 새 카메라 자리)
#   python -X utf8 이미지콘티_배치도.py 실루엣만 11      → 배치/S11_실루엣만.png = 밝은 회색 바탕 + 검은 실루엣(11번 「방 참조 없는 판」)
# 원본 프레임 · 배치도는 git 밖(synk-vendor/pulse-portfolio12-20261024/콘티/p6/)에만 둔다.
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p6")
F = V / "원본프레임"
OUT = V / "배치"
ST = V / "정지컷"
W, H = 1920, 1080


def imread(p):   # cv2.imread는 한글 경로를 못 읽는다
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img)
    buf.tofile(str(p))


_ses = None


def person_mask(img):
    global _ses
    from rembg import new_session, remove
    _ses = _ses or new_session("u2net_human_seg")
    m = np.asarray(remove(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), session=_ses, only_mask=True)).astype(np.float32) / 255
    m = (m > 0.5).astype(np.uint8) * 255
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))


# 분할이 놓친 사람 · 물건(어두운 밤 컷 · 흔들린 팔)은 원본 1920×1080 좌표로 손수 채운다(눈으로 확인한 뒤 더함)
ADD = {11: {"poly": [[(1085, 335), (1150, 335), (1155, 420), (1150, 470), (1155, 600), (1150, 700), (1145, 860), (1140, 885), (1080, 885),
                       (1078, 830), (1062, 700), (1055, 600), (1050, 520), (1030, 470), (1020, 440), (1060, 425), (1080, 420), (1078, 370)]]}}   # 문간의 딸(밝은 옷이 문틀에 묻힘)


def mask_for(n):
    img = imread(F / f"F{n:02d}_첫.jpg")
    m = person_mask(img)
    for poly in ADD.get(n, {}).get("poly", []):
        cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
    for (cx, cy, rx, ry) in ADD.get(n, {}).get("ell", []):
        cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    return img, m


def blur_layout(img, m, sigma, name):
    """사람(마스크)을 지워 메우고 크게 흐린 배치도 — 큰 모양 자리만 남는다"""
    if m is not None and m.any():
        mm = cv2.dilate(m, np.ones((25, 25), np.uint8))
        small = cv2.resize(img, (W // 2, H // 2))
        ms = cv2.resize(mm, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST)
        small = cv2.inpaint(small, ms, 15, cv2.INPAINT_TELEA)
        img = cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC)
    out = cv2.GaussianBlur(img, (0, 0), sigma)
    imwrite(OUT / f"{name}.png", out)
    return out


def rooms():
    OUT.mkdir(parents=True, exist_ok=True)
    blur_layout(imread(F / "F04_첫.jpg"), None, 22, "R1_배치")      # 피아노 시대 — #4 첫 프레임은 사람이 없다(엄마는 화면 밖)
    for n, name in ((14, "R2_배치"), (18, "R3_배치")):              # 낮은 장 · 마지막 거실 — 엄마를 지운다
        img, m = mask_for(n)
        blur_layout(img, m, 22, name)
    blur_layout(imread(F / "F20_첫.jpg"), None, 18, "K20_배치")     # 빈방 — 사람 없음
    print("방 배치도 넷")


def silhouettes(ns):
    (OUT / "_확인").mkdir(parents=True, exist_ok=True)
    for n in ns:
        img, m = mask_for(n)
        imwrite(OUT / f"S{n:02d}_mask.png", m)
        dbg = img.copy()
        dbg[m > 0] = (dbg[m > 0] * 0.4 + np.array([0, 0, 255]) * 0.6).astype(np.uint8)
        imwrite(OUT / "_확인" / f"S{n:02d}.jpg", cv2.resize(dbg, (960, 540)))
        ys, xs = np.nonzero(m)
        box = (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None
        print(n, f"사람 {round((m > 0).mean() * 100, 1)}%", "상자", box)


def compose(pairs):
    """우리 거실 판 위 같은 자리에 검은 실루엣 — 고정 와이드라 원본 화면 자리 = 우리 화면 자리"""
    for a in pairs:
        n, _, room = a.partition("=")
        name = f"S{int(n):02d}" if n.isdigit() else f"S{n}"   # 11m · 11d = 11번 두 단계(엄마만 · 그 판에 딸을 더함)
        plate = imread(ST / f"{room}.png")
        plate = cv2.resize(plate, (W, H), interpolation=cv2.INTER_AREA)
        m = cv2.imdecode(np.fromfile(str(OUT / f"{name}_mask.png"), np.uint8), cv2.IMREAD_GRAYSCALE)
        out = plate.copy()
        out[m > 0] = (18, 18, 18)
        imwrite(OUT / f"{name}_배치.png", out)
        print(name, room, "합성")


def bare(ns):
    """방 참조 없는 판(11번 두 판 견주기): 밝은 회색 바탕 + 검은 실루엣만(S31 배치도와 같은 꼴)"""
    for n in ns:
        m = cv2.imdecode(np.fromfile(str(OUT / f"S{n:02d}_mask.png"), np.uint8), cv2.IMREAD_GRAYSCALE)
        out = np.full((H, W, 3), 205, np.uint8)
        out[m > 0] = (18, 18, 18)
        imwrite(OUT / f"S{n:02d}_실루엣만.png", out)
        print(n, "실루엣만")


def close(ns):
    """끝 넷(새 카메라 자리): 사람을 지우고 크게 흐린 원본 위 검은 실루엣"""
    for n in ns:
        img, m = mask_for(n)
        imwrite(OUT / f"S{n:02d}_mask.png", m)
        base = blur_layout(img, m, 26, f"S{n:02d}_흐림")
        out = base.copy()
        out[m > 0] = (18, 18, 18)
        imwrite(OUT / f"S{n:02d}_배치.png", out)
        print(n, "가까이 배치도")


if __name__ == "__main__":
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == "방":
        rooms()
    elif mode == "실루엣":
        silhouettes([int(x) for x in args])
    elif mode == "합성":
        compose(args)
    elif mode == "가까이":
        close([int(x) for x in args])
    elif mode == "실루엣만":
        bare([int(x) for x in args])
