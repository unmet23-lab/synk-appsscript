# 11번 반려동물 이미지 콘티의 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 6번 「연말 빈방」 · 「매진 임박」 v4(S31)와 같은 길:
# 원본 사람 · 원본 개의 얼굴 · 몸 · 옷 · 털이 옮겨 오지 않게, 사람 자리는 검은 실루엣 · 개 자리는 짙은 회색 실루엣으로 두고 나머지는 크게 흐린다.
#   python -X utf8 이미지콘티_배치도.py 프레임        → 원본프레임/F<컷>_첫.jpg(컷 시작 + 0.12초) · F<컷>_끝.jpg(끝 − 0.12초)
#   python -X utf8 이미지콘티_배치도.py 배치 [컷…]    → 배치/S<컷>_배치.png(1080×1920) · _확인/S<컷>.jpg(원본 | 가림 | 배치도)
# 원본 프레임 · 배치도는 git 밖(synk-vendor/pulse-portfolio12-20261024/콘티/p11/)에만 둔다.
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p11")
SRC = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/p11/원본영상/7634397361254452493/7634397361254452493.mp4"
F, OUT, CHK = V / "원본프레임", V / "배치", V / "배치" / "_확인"
# 우리가 쓰는 원본 컷(01_샷표_원본.md 2절) — 이야기 1~9 + 끝 12
SHOTS = {1: (0.0, 2.167), 2: (2.167, 3.8), 3: (3.8, 6.5), 4: (6.5, 11.233), 5: (11.233, 12.833), 6: (12.833, 13.467),
         7: (13.467, 14.9), 8: (14.9, 16.267), 9: (16.267, 19.333), 12: (24.4, 27.133)}
HAS_PERSON = {3, 4, 5, 6, 7, 8, 12}   # 3은 멀리 두 사람 · 6 · 8은 손 · 다리만
# 지우기만 할 것(원본 좌표 1080×1920) — 4의 검은 고양이 자리는 배치도에서 메운다(우리 판에서 뺌)
ERASE = {4: [(0, 1180, 430, 1920)]}
# 분할 모델이 사람과 개를 한 덩이로 잡은 컷(3 · 4 · 6 · 8 · 12)은 눈금 대 본 원본 프레임(배치/_눈금.jpg)에서 자리를 읽어 도형으로 그린다.
# ("p" 사람 = 검정 · "d" 개 = 짙은 회색, 도형은 ("e", 가운데x, 가운데y, 반지름x, 반지름y) · ("r", x0, y0, x1, y1) · ("poly", [(x, y)…])). 4는 7.0초 프레임(주인이 화면 안).
FRAME_T = {4: 7.0}
SHAPES = {
    3: [("d", "e", 432, 492, 34, 92), ("p", "r", 462, 120, 510, 257), ("p", "e", 486, 108, 18, 22)],
    4: [("d", "e", 250, 1190, 140, 230), ("d", "e", 330, 1010, 80, 90), ("p", "e", 990, 700, 95, 115), ("p", "r", 860, 800, 1080, 1760)],
    6: [("d", "e", 620, 1180, 85, 130), ("d", "r", 560, 1260, 690, 1520), ("p", "poly", [(650, 1250), (1080, 1140), (1080, 1900), (880, 1900), (700, 1420)])],
    8: [("p", "r", 243, 0, 783, 840), ("p", "r", 330, 840, 460, 1760), ("p", "r", 540, 840, 680, 1760), ("p", "e", 390, 1790, 90, 45), ("p", "e", 650, 1800, 95, 45),
        ("d", "e", 470, 1060, 370, 250), ("d", "r", 250, 1150, 320, 1740), ("d", "r", 600, 1200, 660, 1740), ("d", "e", 860, 1000, 110, 90)],
    12: [("p", "e", 513, 165, 80, 100), ("p", "r", 270, 245, 756, 1080), ("p", "r", 300, 1080, 420, 1880), ("p", "r", 600, 1080, 720, 1880),
         ("d", "e", 610, 1400, 330, 200), ("d", "e", 915, 1220, 95, 85), ("d", "r", 330, 1450, 400, 1890), ("d", "r", 780, 1450, 850, 1890)],
}


def draw(shapes, h, w):
    pm, dm = np.zeros((h, w), np.uint8), np.zeros((h, w), np.uint8)
    for who, kind, *a in shapes:
        m = pm if who == "p" else dm
        if kind == "e":
            cv2.ellipse(m, (a[0], a[1]), (a[2], a[3]), 0, 0, 360, 255, -1)
        elif kind == "r":
            cv2.rectangle(m, (a[0], a[1]), (a[2], a[3]), 255, -1)
        else:
            cv2.fillPoly(m, [np.array(a[0], np.int32)], 255)
    return pm, dm


def imread(p):
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img)
    buf.tofile(str(p))


def frames():
    F.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(SRC)
    fps = cap.get(cv2.CAP_PROP_FPS)
    for n, (a, b) in SHOTS.items():
        for tag, t in (("첫", a + 0.12), ("끝", b - 0.12)):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
            ok, fr = cap.read()
            imwrite(F / f"F{n:02d}_{tag}.jpg", fr)
    print("프레임", len(SHOTS) * 2)


_ses = {}


def mask(img, model):
    from rembg import new_session, remove
    _ses[model] = _ses.get(model) or new_session(model)
    m = np.asarray(remove(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), session=_ses[model], only_mask=True)).astype(np.float32) / 255
    m = (m > 0.5).astype(np.uint8) * 255
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))


def layout(n):
    if n in FRAME_T:
        cap = cv2.VideoCapture(SRC)
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(FRAME_T[n] * cap.get(cv2.CAP_PROP_FPS))))
        img = cap.read()[1]
        imwrite(F / f"F{n:02d}_첫.jpg", img)
    else:
        img = imread(F / f"F{n:02d}_첫.jpg")
    for (x0, y0, x1, y1) in ERASE.get(n, []):
        sm = np.zeros(img.shape[:2], np.uint8); sm[y0:y1, x0:x1] = 255
        img = cv2.inpaint(img, sm, 21, cv2.INPAINT_TELEA)
    allm = mask(img, "isnet-general-use")            # 눈에 띄는 것 전부(개 + 사람 + 큰 물건)
    pm = mask(img, "u2net_human_seg") if n in HAS_PERSON else np.zeros_like(allm)
    dm = cv2.subtract(allm, cv2.dilate(pm, np.ones((7, 7), np.uint8)))
    dm = cv2.morphologyEx(dm, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
    both = cv2.dilate(cv2.max(cv2.max(pm, dm), allm), np.ones((25, 25), np.uint8))
    if n in SHAPES:   # 분할 대신 도형 — 지우기는 분할 · 도형을 다 덮는다
        pm, dm = draw(SHAPES[n], *img.shape[:2])
        both = cv2.dilate(cv2.max(both, cv2.max(pm, dm)), np.ones((25, 25), np.uint8))
    h, w = img.shape[:2]
    small = cv2.resize(img, (w // 2, h // 2))
    ms = cv2.resize(both, (w // 2, h // 2), interpolation=cv2.INTER_NEAREST)
    bg = cv2.resize(cv2.inpaint(small, ms, 15, cv2.INPAINT_TELEA), (w, h), interpolation=cv2.INTER_CUBIC)
    out = cv2.GaussianBlur(bg, (0, 0), 20)
    out[pm > 0] = (0, 0, 0)          # 사람 = 검정
    out[dm > 0] = (70, 70, 70)       # 개 = 짙은 회색(개가 다리 앞에 있는 8 · 12는 개를 위에)
    OUT.mkdir(parents=True, exist_ok=True); CHK.mkdir(parents=True, exist_ok=True)
    imwrite(OUT / f"S{n:02d}_배치.png", out)
    vis = img.copy(); vis[dm > 0] = (0, 200, 255); vis[pm > 0] = (255, 0, 255)
    show = np.hstack([cv2.resize(x, (360, 640)) for x in (imread(F / f"F{n:02d}_첫.jpg"), vis, out)])
    imwrite(CHK / f"S{n:02d}.jpg", show)
    return int((dm > 0).mean() * 1000) / 10, int((pm > 0).mean() * 1000) / 10


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:]
    if cmd == "프레임":
        frames()
    elif cmd == "배치":
        for n in ([int(x) for x in rest] or list(SHOTS)):
            print(n, "개·사람 넓이(%)", layout(n))
