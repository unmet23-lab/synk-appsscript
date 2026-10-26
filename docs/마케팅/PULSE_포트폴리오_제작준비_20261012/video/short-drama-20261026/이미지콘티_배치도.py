# 7번 「사랑 한 칸」 이미지 콘티의 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 「매진 임박」 v4(S31) · 8번 · 11번과 같은 길:
# 원본 배우의 얼굴 · 몸 · 옷과 원본 장소가 옮겨 오지 않게 사람 자리만 검은 실루엣으로 두고 나머지는 밝은 회색. 합성할 자리(반찬 칸 · 칸찬 라벨 · 신고서 글씨)는 크로마 초록.
#   python -X utf8 이미지콘티_배치도.py 프레임          → 원본첫프레임/<화>-<컷>.jpg(컷 시작 + 0.12초, 차례로 읽어 정확히) · _한눈_<화>.jpg(번호 붙인 한 장)
#   python -X utf8 이미지콘티_배치도.py 장소            → 배치/L_<장소>.png — 원본에서 사람을 지우고 크게 흐린 장소 기준 그림의 바탕
#   python -X utf8 이미지콘티_배치도.py 배치 [1-3 2-50a …] → 배치/S<화>-<컷>.png(1080×1920) · _확인/S<화>-<컷>.jpg(원본 위에 실루엣 · 초록)
# 컷 목록은 콘티표.py가 낸 git 밖 콘티/p7/컷목록.json. 원본 프레임 · 배치도는 git 밖(synk-vendor/pulse-portfolio12-20261024/콘티/p7/)에만 둔다.
import sys, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p7")
REF = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/p7/원본영상")
SRC = {1: REF / "tt_7490730962452499730/tt_7490730962452499730.mp4",   # 원본 1화(A1) 1080×1920 · 30
       2: REF / "tt_7491100599451192583/tt_7491100599451192583.mp4"}   # 원본 2화(A2) 720×1280 · 29.967
F, OUT, CHK = V / "원본첫프레임", V / "배치", V / "배치" / "_확인"
W, H = 1080, 1920
GREEN = (0, 177, 64)
BG, INK = 205, 18
FONT = ImageFont.truetype(str(Path(__file__).resolve().parents[5] / "docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"), 30)

# 컷마다(키 "화-컷"): rembg로 사람을 잡을지(seg, 기본 True) · 잡은 사람에서 뺄 상자(drop) · 손으로 그릴 사람(poly · ell) · 초록 자리(green)
# 좌표는 1080×1920 기준(원본 2화 720×1280은 1.5배로 올려 잼).
CUT = {
    # 식탁 위 A4(빈 혼인신고서) — 종이 전체가 초록, 아래 흐린 이안 어깨는 손으로
    "1-26": {"green": [[(67, 756), (859, 734), (940, 1148), (81, 1150)]],
             "poly": [[(0, 1330), (300, 1290), (700, 1330), (1080, 1420), (1080, 1920), (0, 1920)]]},
    "1-27": {"seg": False, "green": [[(0, 365), (473, 162), (1080, 810), (1080, 1920), (0, 1920)]]},
    # 현관 바닥 — 원본 구두 자리에 칸찬 상자(라벨만 초록)
    "2-4": {"green": [[(600, 640), (930, 640), (930, 800), (600, 800)]]},
    # 식탁 위 채운 신고서(위) — 도시락 · 상자는 글로, 맞잡은 손은 분할
    "2-43": {"green": [[(105, 600), (890, 390), (1055, 810), (340, 1015)]]},
    "2-44": {"seg": False, "green": [[(0, 0), (1080, 0), (1080, 1920), (0, 1920)]]},
    # 분할이 물건을 사람으로 잡은 컷(빈 도시락 · 수도꼭지 · 끝 장)
    "1-3": {"seg": False},
    "2-48": {"seg": False},
    "1-24": {"seg": False, "poly": [[(0, 1150), (400, 1050), (800, 1000), (1080, 1000), (1080, 1920), (0, 1920)],
                                    [(1080, 560), (930, 520), (850, 560), (860, 620), (980, 660), (1080, 700)]]},
    # 분할이 놓친 흐린 앞사람(어깨 너머 구도) — 눈금 대 본 원본 프레임에서 읽은 자리(10-26)
    "1-6": {"poly": [[(0, 100), (150, 150), (230, 400), (220, 900), (180, 1060), (350, 1150), (500, 1350), (580, 1600), (600, 1920), (0, 1920)]]},
    "1-8": {"poly": [[(0, 300), (120, 350), (170, 600), (160, 1100), (280, 1250), (340, 1500), (360, 1920), (0, 1920)]]},
    "1-9": {"poly": [[(1080, 450), (900, 480), (820, 600), (800, 900), (830, 1250), (880, 1500), (760, 1700), (720, 1920), (1080, 1920)]]},
    "1-11": {"poly": [[(0, 150), (200, 200), (320, 400), (340, 800), (300, 1050), (250, 1150), (370, 1350), (400, 1920), (0, 1920)]]},
    "1-23": {"seg": False, "poly": [[(0, 250), (250, 300), (450, 500), (520, 900), (600, 1100), (800, 1250), (850, 1600), (800, 1920), (0, 1920)],
                                    [(640, 670), (760, 670), (790, 1050), (620, 1050)]], "ell": [(700, 620, 45, 55)]},   # 이안은 열린 중문 자리(오른쪽)에 작게
    "1-29": {"poly": [[(1080, 0), (960, 0), (930, 300), (960, 800), (940, 1200), (980, 1920), (1080, 1920)]]},
    "2-7": {"poly": [[(0, 300), (250, 350), (450, 600), (520, 800), (480, 1000), (700, 1300), (900, 1600), (1000, 1920), (0, 1920)]]},
    "2-14": {"poly": [[(0, 0), (80, 0), (110, 600), (90, 1300), (150, 1920), (0, 1920)]]},
    "2-16": {"poly": [[(0, 0), (110, 0), (150, 500), (120, 1000), (200, 1500), (250, 1920), (0, 1920)]]},
    "2-30": {"seg": False, "poly": [[(0, 0), (250, 0), (320, 500), (330, 900), (550, 1150), (650, 1500), (700, 1920), (0, 1920)],
                                    [(480, 620), (620, 600), (700, 700), (760, 1150), (830, 1180), (830, 1250), (760, 1260), (740, 1920), (500, 1920), (470, 1200)]]},
    "2-35": {"seg": False, "ell": [(590, 500, 70, 95)],
             "poly": [[(400, 600), (560, 590), (620, 590), (780, 620), (840, 760), (870, 1000), (860, 1500), (380, 1500), (380, 1000), (400, 760)],
                      [(0, 1500), (300, 1430), (700, 1450), (1080, 1550), (1080, 1920), (0, 1920)]]},
    "2-36": {"ell": [(40, 1830, 200, 160)]},
    "2-38": {"seg": False, "ell": [(590, 330, 80, 100)],
             "poly": [[(520, 420), (660, 420), (700, 560), (880, 640), (920, 1000), (280, 1000), (300, 640), (480, 560)], [(0, 1000), (300, 900), (700, 880), (1080, 920), (1080, 1920), (0, 1920)]]},
}


def key(c):
    return f"{c['화']}-{c['컷']}"


def cuts():
    return json.load(open(V / "컷목록.json", encoding="utf-8"))


def imwrite(p, img):   # cv2는 한글 경로를 못 쓴다
    ok, buf = cv2.imencode(Path(p).suffix, img)
    buf.tofile(str(p))


def frames():
    F.mkdir(parents=True, exist_ok=True)
    allc = cuts()
    for ep in (1, 2):
        cap = cv2.VideoCapture(str(SRC[ep]))
        fps = cap.get(cv2.CAP_PROP_FPS)
        want = {}
        for c in allc:
            if c["화"] != ep:
                continue
            a, b = c["원본초"]
            t = a + min(0.12, (b - a) / 3)
            want.setdefault(int(round(t * fps)), []).append(key(c))
        last, i = max(want), 0
        while i <= last:   # HEVC는 건너뛰어 읽으면 ±2프레임 틀린다 — 처음부터 차례로
            ok, fr = cap.read()
            if not ok:
                break
            if i in want:
                fr = cv2.resize(fr, (W, H), interpolation=cv2.INTER_CUBIC if fr.shape[1] < W else cv2.INTER_AREA)
                for k in want[i]:
                    imwrite(F / f"{k}.jpg", fr)
            i += 1
        cap.release()
        sheet(ep, [key(c) for c in allc if c["화"] == ep])


def sheet(ep, keys, cols=12, tw=180):
    th = tw * 16 // 9
    rows = (len(keys) + cols - 1) // cols
    img = Image.new("RGB", (cols * tw, rows * (th + 36)), (20, 18, 16))
    dr = ImageDraw.Draw(img)
    for n, k in enumerate(keys):
        x, y = (n % cols) * tw, (n // cols) * (th + 36)
        p = F / f"{k}.jpg"
        if p.exists():
            img.paste(Image.open(p).resize((tw - 4, th)), (x + 2, y))
        dr.text((x + 6, y + th + 2), k, fill=(255, 220, 120), font=FONT)
    img.save(F / f"_한눈_{ep}.jpg", quality=86)


def faces():   # 원본 첫 프레임의 얼굴 자리(YuNet) — 지시문이 「얼굴이 화면 높이의 몇 %」로 쓰고, 받은 그림을 이 자리로 잘라 맞춘다
    m = Path.home() / ".rembg/models/yunet/face_detection_yunet_2023mar.onnx"
    fd = cv2.FaceDetectorYN.create(str(m), "", (320, 320), 0.6, 0.3, 5000)
    out = {}
    for c in cuts():
        k = key(c)
        img = cv2.imdecode(np.fromfile(str(F / f"{k}.jpg"), np.uint8), cv2.IMREAD_COLOR)
        sm = cv2.resize(img, (540, 960))
        fd.setInputSize((540, 960))
        r = fd.detect(sm)[1]
        fs = [] if r is None else sorted(r.tolist(), key=lambda b: -b[2] * b[3])
        out[k] = [{"x": round(f[0] / 540, 3), "y": round(f[1] / 960, 3), "w": round(f[2] / 540, 3), "h": round(f[3] / 960, 3),
                   "점수": round(f[14], 2)} for f in fs if f[2] >= 14]
    json.dump(out, open(F / "_얼굴.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for k, v in out.items():
        print(k, [(f["x"], f["y"], f["w"], f["h"]) for f in v])


def layout(keys):
    from rembg import new_session, remove
    ses = new_session("u2net_human_seg")
    CHK.mkdir(parents=True, exist_ok=True)
    rec_p = OUT / "_배치기록.json"
    rec = json.load(open(rec_p, encoding="utf-8")) if rec_p.exists() else {}
    for k in keys:
        cfg = CUT.get(k, {})
        im = Image.open(F / f"{k}.jpg").convert("RGB")
        m = np.zeros((H, W), np.uint8)
        if cfg.get("seg", True):
            mm = np.asarray(remove(im, session=ses, only_mask=True)).astype(np.float32) / 255
            m = ((mm > 0.5) * 255).astype(np.uint8)
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
            for (x0, y0, x1, y1) in cfg.get("drop", []):
                m[y0:y1, x0:x1] = 0
        for poly in cfg.get("poly", []):
            cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
        for (cx, cy, rx, ry) in cfg.get("ell", []):
            cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
        g = np.zeros((H, W), np.uint8)
        for poly in cfg.get("green", []):
            cv2.fillPoly(g, [np.array(poly, np.int32)], 255)
        lay = np.full((H, W, 3), BG, np.uint8)
        lay[m > 0] = INK
        lay[g > 0] = GREEN
        for poly in cfg.get("hand", []):   # 초록 앞에 있는 손 — 초록 위에 덮는다
            hm = np.zeros((H, W), np.uint8)
            cv2.fillPoly(hm, [np.array(poly, np.int32)], 255)
            lay[hm > 0] = INK
            m[hm > 0] = 255
        Image.fromarray(lay).save(OUT / f"S{k}.png")
        a = np.asarray(im).copy()
        a[m > 0] = (a[m > 0] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
        a[g > 0] = (a[g > 0] * 0.4 + np.array(GREEN) * 0.6).astype(np.uint8)
        both = Image.new("RGB", (W, H // 2))
        both.paste(Image.fromarray(a).resize((W // 2, H // 2)), (0, 0))
        both.paste(Image.fromarray(lay).resize((W // 2, H // 2)), (W // 2, 0))
        both.save(CHK / f"S{k}.jpg", quality=84)
        rec[k] = {"사람%": round((m > 0).mean() * 100, 1), "초록%": round((g > 0).mean() * 100, 1)}
        print(k, rec[k])
    json.dump(rec, open(rec_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == "프레임":
        frames()
    elif cmd == "얼굴":
        faces()
    elif cmd == "배치":
        layout(rest or [key(c) for c in cuts()])
