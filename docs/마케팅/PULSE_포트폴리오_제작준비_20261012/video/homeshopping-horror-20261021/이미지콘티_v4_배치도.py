# 콘티 v4 이미지 콘티의 배치도(2026-10-23) — Gemini에 원본 프레임 대신 넣는 그림. 원본 배우의 얼굴 · 몸 · 옷이 옮겨 오지 않게 사람을 뺀다.
#   python -X utf8 이미지콘티_v4_배치도.py 거실        → synk-vendor/…/콘티/v4/배치/R1_배치.png · R2_배치.png(원본 #1 · #13 첫 프레임에서 사람을 지우고 크게 흐림)
#   python -X utf8 이미지콘티_v4_배치도.py [컷 번호…]  → 배치/S01.png …(1456×816, 밝은 회색 바탕 + 사람 자리만 검은 실루엣 · rembg u2net_human_seg)
#                                                     · 배치/_확인/S01.jpg(원본 위 마스크)
#   python -X utf8 이미지콘티_v4_배치도.py 5@156      → 배치/S05e.png — 컷 첫 프레임 대신 원본 프레임 156으로(끝 그림, 10-25 #5)
import sys, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image
V = Path(r"C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021")
F = V / "검수/fable_v4콘티/frames"
OUT = V / "콘티/v4/배치"
CARDS = {11, 21, 27, 29}


def imread(p):   # cv2.imread는 한글 경로를 못 읽는다
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img); buf.tofile(str(p))


def frame(n):   # 프레임 n은 n+1번 파일
    return imread(F / f"{n+1:04d}.jpg")


def layout(img, boxes, blur=9, name="x"):
    m = np.zeros(img.shape[:2], np.uint8)
    for (x0, y0, x1, y1) in boxes:
        cv2.rectangle(m, (x0, y0), (x1, y1), 255, -1)
    out = cv2.inpaint(img, m, 9, cv2.INPAINT_TELEA)
    out = cv2.GaussianBlur(out, (0, 0), blur)
    out = cv2.resize(out, (1456, 816), interpolation=cv2.INTER_CUBIC)
    imwrite(OUT / f"{name}.png", out)
    dbg = img.copy()
    for (x0, y0, x1, y1) in boxes:
        cv2.rectangle(dbg, (x0, y0), (x1, y1), (0, 0, 255), 2)
    imwrite(OUT / f"_{name}_마스크확인.jpg", dbg)


def rooms():
    # R1 피해자 쪽 넓은 컷(#1 첫 프레임): 왼쪽 끝 강도 · 가운데 C · B · 오른쪽 A
    layout(frame(0), [(0, 0, 75, 404), (330, 95, 415, 300), (398, 100, 478, 310), (500, 85, 640, 404)], 7, "R1_배치")
    # R2 강도 쪽(#13 첫 프레임 f462): 가운데 강도를 지우고 선반 · 문 · 벽등만
    layout(frame(462), [(215, 0, 345, 140), (110, 130, 452, 404), (345, 95, 458, 205)], 5, "R2_배치")


def silhouettes(cuts):
    from rembg import new_session, remove
    ses = new_session("u2net_human_seg")
    # 분할이 놓친 사람 · 팔(어두운 강도 · 흔들린 팔 · 숙인 C)은 원본 720×404 좌표로 손수 채운다(10-23 격자로 잼)
    ADD = {
        1: {"poly": [[(0, 0), (55, 0), (60, 60), (45, 100), (45, 160), (70, 165), (70, 180), (45, 185), (45, 404), (0, 404)],
                     [(345, 148), (405, 148), (405, 235), (395, 250), (395, 315), (350, 315), (350, 250), (343, 235)],
                     [(410, 145), (470, 145), (498, 235), (470, 240), (470, 310), (415, 310), (412, 240)],
                     [(520, 170), (610, 190), (615, 300), (600, 404), (530, 404), (510, 300)]],
            "ell": [(368, 123, 17, 21), (440, 120, 16, 20), (560, 130, 40, 45)]},
        2: {"poly": [[(125, 150), (160, 230), (300, 150), (400, 140), (400, 70), (320, 70), (220, 120)]],
            "line": [((395, 105), (530, 25), 22)]},
        3: {"poly": [[(95, 85), (185, 80), (195, 150), (235, 160), (235, 175), (195, 180), (175, 260), (160, 404), (80, 404), (75, 260), (70, 180)],
                     [(318, 160), (360, 150), (400, 215), (400, 265), (370, 280), (340, 270), (330, 230), (318, 200)],
                     [(410, 125), (470, 125), (470, 240), (460, 330), (420, 330), (410, 240)],
                     [(470, 125), (545, 125), (550, 260), (530, 404), (480, 404), (470, 260)]],
            "ell": [(170, 62, 26, 34), (335, 175, 18, 16), (430, 107, 15, 18), (500, 105, 20, 22)]},
    }
    SKIP = {30}   # 휙 돌아 흐린 첫 프레임 — 분할이 안 된다(글로만 쓴다)
    (OUT / "_확인").mkdir(parents=True, exist_ok=True)
    SHOTS = json.load(open(V / "원본/원본_샷.json", encoding="utf-8"))
    for n in cuts:
        n, f0, name = (n[0], n[1], f"S{n[0]:02d}e") if isinstance(n, tuple) else (n, SHOTS[n - 1]["f0"], f"S{n:02d}")
        im = Image.open(F / f"{f0 + 1:04d}.jpg").convert("RGB")
        m = np.asarray(remove(im, session=ses, only_mask=True)).astype(np.float32) / 255
        m = (m > 0.5).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        if n in SKIP:
            print(n, "건너뜀"); continue
        for poly in ADD.get(n, {}).get("poly", []):
            cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
        for (cx, cy, rx, ry) in ADD.get(n, {}).get("ell", []):
            cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
        for (a, b, w) in ADD.get(n, {}).get("line", []):
            cv2.line(m, a, b, 255, w)
        sil = np.full((im.height, im.width, 3), 205, np.uint8)
        sil[m > 0] = 18
        Image.fromarray(sil).resize((1456, 816), Image.LANCZOS).save(OUT / f"{name}.png")
        a = np.asarray(im).copy(); a[m > 0] = (a[m > 0] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
        Image.fromarray(a).save(OUT / "_확인" / f"{name}.jpg", quality=85)
        print(n, f"사람 {round((m > 0).mean() * 100, 1)}%")


if __name__ == "__main__":
    if sys.argv[1:2] == ["거실"]:
        rooms()
    else:
        SHOTS = json.load(open(V / "원본/원본_샷.json", encoding="utf-8"))
        silhouettes([tuple(int(v) for v in x.split("@")) if "@" in x else int(x) for x in sys.argv[1:]] or [s["n"] for s in SHOTS if s["n"] not in CARDS])
