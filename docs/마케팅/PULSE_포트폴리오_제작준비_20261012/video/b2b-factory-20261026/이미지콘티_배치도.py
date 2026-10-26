# 10번 이미지 콘티 배치도(2026-10-26) — 블프 세일 · 8번 이미지콘티_배치도.py를 옮김. Gemini에 원본 프레임 대신 넣는 그림.
# 원본 직원의 얼굴 · 몸 · 옷과 원본 엔진 · 장소가 옮겨 오지 않게, 사람은 검은 실루엣, 기계 · 공간은 크게 흐린 윤곽선만 옅게 남긴다
# (원본 로고 무늬는 흐림에 사라짐 — 카메라 높이 · 크기 · 둥근 날개 원의 자리만 전한다). 원본은 위아래 검은 띠가 있는 약 2:1 그림이라
# 띠를 잘라 낸 그림을 16:9 판 가운데에 놓고 위아래 남는 칸은 바탕색으로 둔다(그 칸도 장소로 채워 굽고, 후반에서 띠로 덮는다).
#   python -X utf8 이미지콘티_배치도.py 첫프레임        → git 밖 콘티/p10/원본첫프레임/S01.png …(원본 그대로) · 첫프레임 시각표
#   python -X utf8 이미지콘티_배치도.py [컷 번호…]      → 콘티/p10/배치/S01.png …(1456×816) · 배치/_확인/S01.jpg(원본 위에 실루엣을 겹친 확인판)
# 사람 분할은 rembg u2net_human_seg(8번 · 블프 세일과 같음), 윤곽은 가우스 흐림 6 → Canny 8/24 → 굵게 9px.
import sys, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image

P = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024")
SRC = P / "레퍼런스/p10/원본영상/hq_6YbgvCqq6yY/hq_6YbgvCqq6yY.mp4"
SHOTS = P / "레퍼런스/p10/원본실측/p10A_GE/원본_샷.json"
F = P / "콘티/p10/원본첫프레임"
OUT = P / "콘티/p10/배치"
BG, INK, EDGE = 205, 18, 120
TOP, BOT = 25, 25          # 854×480 원본의 위아래 검은 띠(px) — 05_컷재기 area(640 폭에서 19px)를 480 높이로 환산
# 첫 프레임을 컷 처음 + 0.10초가 아닌 다른 순간으로 뜰 컷(그 컷을 대표하는 순간 — 어둡게 시작하거나 움직임이 큰 컷)
AT = {4: 3.90, 7: 6.95, 19: 25.60, 20: 30.60, 37: 56.20}
# 사람을 실루엣으로 잡을 컷(그 밖은 윤곽만). 뺄 상자(drop)는 854×480 좌표.
# 15(날개를 사람으로) · 17(엔진 앞면) · 20(계기판) · 24(엔진)는 분할이 틀려 윤곽만 둔다(10-26 _모음.jpg로 확인). 33 · 37은 원본 비행기 모양이
# 윤곽에 남아 배치도를 지시문에 넣지 않는다(지시문 refs에서 뺌).
SEG = {1, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16, 18, 23, 25, 26, 27, 29, 30, 31, 32, 34, 35, 36}
DROP = {}


def imread(p):   # cv2.imread는 한글 경로를 못 읽는다
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def first_frames():
    sh = json.load(open(SHOTS, encoding="utf-8"))["shots"]
    cap = cv2.VideoCapture(str(SRC))
    fps = cap.get(cv2.CAP_PROP_FPS)
    F.mkdir(parents=True, exist_ok=True)
    table = {}
    for s in sh:
        n = s["n"]
        t = AT.get(n, s["start"] + 0.10)
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
        ok, fr = cap.read()
        if not ok:
            print("못 읽음", n)
            continue
        Image.fromarray(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)).save(F / f"S{n:02d}.png")
        table[n] = {"시각": round(t, 2), "컷": [s["start"], s["end"]]}
    json.dump(table, open(F / "_시각.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("첫 프레임", len(table))


def main(cuts):
    from rembg import new_session, remove
    ses = new_session("u2net_human_seg")
    (OUT / "_확인").mkdir(parents=True, exist_ok=True)
    rec = {}
    for n in cuts:
        full = Image.open(F / f"S{n:02d}.png").convert("RGB")
        W, H = full.size
        im = full.crop((0, TOP, W, H - BOT))
        w, h = im.size
        g = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2GRAY)
        g = cv2.GaussianBlur(g, (0, 0), 6)
        e = cv2.Canny(g, 8, 24)
        e = cv2.dilate(e, np.ones((9, 9), np.uint8))
        lay = np.full((h, w, 3), BG, np.uint8)
        lay[e > 0] = EDGE
        m = np.zeros((h, w), np.uint8)
        if n in SEG:
            mm = np.asarray(remove(im, session=ses, only_mask=True)).astype(np.float32) / 255
            m = ((mm > 0.5) * 255).astype(np.uint8)
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
            for (x0, y0, x1, y1) in DROP.get(n, []):
                m[max(0, y0 - TOP):max(0, y1 - TOP), x0:x1] = 0
        lay[m > 0] = INK
        # 2:1 그림을 16:9 판 가운데에 — 폭을 1456에 맞추고 위아래는 바탕색
        out = np.full((816, 1456, 3), BG, np.uint8)
        nh = int(round(h * 1456 / w))
        y0 = (816 - nh) // 2
        out[y0:y0 + nh] = np.asarray(Image.fromarray(lay).resize((1456, nh), Image.LANCZOS))
        Image.fromarray(out).save(OUT / f"S{n:02d}.png")
        a = np.asarray(im).copy()
        a[m > 0] = (a[m > 0] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
        Image.fromarray(a).resize((w, h)).save(OUT / "_확인" / f"S{n:02d}.jpg", quality=85)
        rec[n] = {"사람%": round((m > 0).mean() * 100, 1), "윤곽%": round((e > 0).mean() * 100, 1)}
        print(n, rec[n])
    json.dump(rec, open(OUT / "_배치기록.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    if sys.argv[1:2] == ["첫프레임"]:
        first_frames()
    else:
        main([int(x) for x in sys.argv[1:]] or list(range(1, 38)))
