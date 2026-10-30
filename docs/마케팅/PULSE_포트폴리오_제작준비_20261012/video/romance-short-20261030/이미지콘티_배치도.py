# 로맨스 단편 「다 비침」 이미지 콘티의 배치도(2026-10-30) — 선버스트에 원본 프레임 대신 넣는 그림. 7번 이미지콘티_배치도.py · 엔진비교/배치.py와 같은 길:
# 원본 배우의 얼굴 · 몸 · 옷과 원본 장소가 옮겨 오지 않게 사람 자리만 검은 실루엣으로 두고 나머지는 밝은 회색. 투명 우산은 덮개 테두리 · 대만 진한 회색 선으로.
# 회상 컷의 좌우 검은 띠는 회색 바탕으로 남긴다(띠는 편집에서 다시 씌움 — 그림은 16:9로 굽는다).
#   python -X utf8 이미지콘티_배치도.py 배치 [C02 C18 …]   → git 밖 콘티/romance/배치/<컷>.png(2048×1152) · 배치/_확인/<컷>.jpg(원본 위 빨강 | 배치도)
#   python -X utf8 이미지콘티_배치도.py 한눈                → 배치/_확인/_한눈_<n>.jpg(확인판을 스무 컷씩 한 장으로)
# 원본 첫 프레임은 콘티/romance/원본첫프레임/<번호>.jpg(1920×1080, 컷 첫 프레임 + 2). 컷 목록은 콘티표.py가 낸 콘티/romance/컷목록.json.
import json, sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance")
F, OUT = V / "원본첫프레임", V / "배치"
CHK = OUT / "_확인"
SW, SH = 1920, 1080          # 원본 프레임
W, H = 2048, 1152            # 배치도(굽는 크기와 같음)
BG, INK, LINE = 205, 18, 90
FONT = ImageFont.truetype(str(Path(__file__).resolve().parents[5] / "docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"), 34)

# 컷마다: seg(rembg로 사람을 잡을지, 기본 True) · drop(잡은 것에서 뺄 상자) · poly · ell(손으로 그릴 사람 · 손) · umb(투명 우산 선 — 덮개 테두리 · 대)
# · fold(접은 우산 — 굵은 회색 선) · occ(이 x부터 오른쪽 끝까지 앞 가림 — 짙은 회색) · dark(검은 우산 덮개 — 짙은 회색 면).
# 좌표는 원본 1920×1080 기준. 원본 프레임에 10% 격자를 대 보고 읽은 자리다(10-30). 분할(u2net_human_seg · isnet · u2net 셋 다)이
# 흐린 앞사람 어깨 · 머리를 놓쳐 어깨 너머 컷은 손으로 그렸다.
SHOULDER_R = [[(1150, 1080), (1250, 900), (1400, 780), (1600, 700), (1920, 600), (1920, 1080)]]   # 그녀 클로즈업 — 오른쪽 아래 그의 흐린 어깨
CUT = {
    # C01 · C01e — 앞 가림(어두운 흐린 평면)은 정지 그림 · 영상에 넣지 않고 후반에서 얹는다(Fable 글 콘티 P2). 처음엔 문을 나선 태준이 오른쪽(약 62%)
    "C01": {"seg": False, "ell": [(975, 395, 12, 15), (1192, 372, 13, 16)],
            "poly": [[(958, 410), (992, 410), (1000, 500), (996, 680), (956, 680), (950, 500)],
                     [(1166, 389), (1218, 389), (1226, 520), (1222, 680), (1172, 680), (1166, 520)]]},
    "C01e": {"seg": False, "ell": [(970, 390, 12, 15), (1066, 368, 13, 16)],   # 분할이 아주 작은 둘을 못 잡음 — 왼쪽 유나 · 오른쪽 태준
             "poly": [[(950, 405), (990, 405), (998, 520), (994, 680), (952, 680), (946, 520)],
                      [(1040, 385), (1092, 385), (1100, 520), (1096, 680), (1046, 680), (1040, 520)]]},
    "C02": {"poly": SHOULDER_R}, "C04": {"poly": SHOULDER_R},
    "C03": {"poly": [[(0, 180), (250, 170), (480, 300), (580, 520), (560, 820), (520, 1080), (0, 1080)]]},
    "C06": {"seg": False, "umb": [[(420, 520), (520, 330), (700, 250), (880, 330), (960, 520)], [(690, 260), (690, 900)]]},
    "C40": {"seg": False, "umb": [[(420, 520), (520, 330), (700, 250), (880, 330), (960, 520)], [(690, 260), (690, 900)]]},
    "C18e": {"seg": True, "ell": [(1526, 551, 125, 119)], "poly": [[(1267, 1080), (1306, 756), (1421, 670), (1651, 670), (1690, 756), (1690, 1080)]],
             "umb": [[(595, 227), (768, 97), (998, 22), (1229, 0), (1459, 65), (1651, 216), (1670, 356)], [(1229, 0), (1344, 432), (1306, 853)]]},
    "C21": {"poly": [[(240, 0), (620, 0), (640, 150), (560, 300), (440, 380), (360, 520), (300, 760), (240, 900)]]},
    "C22": {"seg": False, "ell": [(650, 360, 250, 270), (1450, 360, 175, 240)]},
    "C24": {"poly": [[(1350, 1080), (1400, 800), (1500, 550), (1650, 380), (1800, 300), (1920, 280), (1920, 1080)]]},
    "C28": {"seg": False, "ell": [(1056, 400, 190, 270)], "poly": [[(560, 1080), (700, 800), (900, 690), (1200, 690), (1450, 800), (1600, 1080)]]},
    "C32": {"seg": False}, "C33": {"seg": False}, "C64": {"seg": False}, "C69": {"seg": False}, "C67": {"seg": False},
    "C35": {"ell": [(995, 555, 30, 42)], "poly": [[(930, 600), (1060, 600), (1110, 780), (1150, 1080), (890, 1080), (900, 780)]],
            "umb": [[(120, 590), (330, 430), (560, 330), (770, 300)], [(120, 590), (200, 300), (380, 140), (600, 110), (780, 160)]],
            "dark": [[(780, 560), (860, 460), (980, 425), (1100, 450), (1130, 500), (960, 520)]]},
    "C37": {"umb": [[(540, 150), (700, 330), (860, 520), (960, 620), (1150, 700)], [(1820, 0), (1840, 1080)]]},
    "C38": {"poly": [[(1000, 0), (1920, 0), (1920, 1080), (1150, 1080), (1050, 800), (980, 500)]]},
    "C44": {"poly": [[(240, 0), (560, 0), (580, 250), (520, 450), (600, 700), (650, 1080), (240, 1080)]]},
    "C47": {"drop": [(240, 700, 820, 1080)]},
    "C48": {"poly": [[(1450, 250), (1550, 200), (1680, 220), (1680, 1080), (1420, 1080), (1400, 600)]]},
    "C49": {"umb": [[(270, 330), (600, 300), (900, 310), (1190, 360)], [(590, 320), (600, 1000)],
                    [(810, 420), (1100, 380), (1400, 390), (1580, 430)], [(1440, 400), (1450, 990)]]},
    "C50": {"ell": [(1290, 300, 120, 170)]},
    "C51": {"poly": [[(1300, 0), (1680, 0), (1680, 1080), (1250, 1080), (1280, 700), (1350, 450), (1300, 250)]]},
    "C55": {"poly": [[(0, 0), (450, 0), (560, 250), (600, 500), (700, 800), (760, 1080), (0, 1080)]]},
    "C56": {"seg": False, "ell": [(1150, 830, 160, 110)], "poly": [[(1250, 760), (1920, 700), (1920, 960), (1250, 920)]], "fold": [[(1080, 790), (520, 260)]]},
    "C57": {"poly": [[(1500, 0), (1920, 0), (1920, 1080), (1550, 1080), (1450, 700), (1480, 350)]]},
    "C58": {"poly": [[(0, 0), (600, 0), (780, 200), (820, 500), (760, 800), (650, 1080), (0, 1080)]]},
    "C62": {"ell": [(1610, 400, 45, 58)], "poly": [[(1530, 450), (1700, 450), (1740, 700), (1740, 1080), (1500, 1080), (1510, 700)]],
            "umb": [[(1530, 380), (1650, 290), (1800, 270), (1920, 300)], [(1760, 300), (1700, 700)]]},
    "C68": {"drop": [(860, 0, 1920, 620)]},
}
NOLAYOUT = {"C59", "C60"}   # 눈 익스트림 클로즈업 — 얼굴이 화면을 채워 실루엣이 단서가 안 된다(글로만 잡음)
EXTRA = {"C01e": "01_끝.jpg", "C11e": "11_끝.jpg", "C14e": "14_끝.jpg", "C18e": "18_끝.jpg", "C43e": "43_끝.jpg"}   # 끝 그림 — 사람이 들어오거나 크게 다가가는 컷


def cuts():
    cs = [c for c in json.load(open(V / "컷목록.json", encoding="utf-8")) if c["원본그림"] and c["컷"] not in NOLAYOUT]
    by = {c["컷"]: c for c in cs}
    for k, fn in EXTRA.items():
        cs.append(dict(by[k[:-1]], 컷=k, 원본그림=fn))
    return cs


def imwrite(p, img):   # cv2는 한글 경로를 못 쓴다
    ok, buf = cv2.imencode(Path(p).suffix, img)
    buf.tofile(str(p))


def layout(keys):
    from rembg import new_session, remove
    ses = new_session("u2net_human_seg")
    CHK.mkdir(parents=True, exist_ok=True)
    rec_p = OUT / "_배치기록.json"
    rec = json.load(open(rec_p, encoding="utf-8")) if rec_p.exists() else {}
    for c in cuts():
        k = c["컷"]
        if keys and k not in keys:
            continue
        cfg = CUT.get(k, {})
        im = Image.open(F / c["원본그림"]).convert("RGB")
        m = np.zeros((SH, SW), np.uint8)
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
        if c["회상"]:   # 좌우 띠(각 240px) 안은 비운다 — 분할이 띠 가장자리를 사람으로 잡는 일이 있다
            m[:, :240] = 0
            m[:, SW - 240:] = 0
        lay = np.full((SH, SW, 3), BG, np.uint8)
        if cfg.get("occ"):   # 렌즈 바로 앞을 지나는 흐린 검은 우산(C01) — 사람과 갈리게 짙은 회색
            lay[:, cfg["occ"]:] = 60
        for poly in cfg.get("dark", []):   # 검은 우산 덮개
            cv2.fillPoly(lay, [np.array(poly, np.int32)], (60, 60, 60))
        lay[m > 0] = INK
        for line in cfg.get("umb", []):
            cv2.polylines(lay, [np.array(line, np.int32)], False, (LINE, LINE, LINE), 9, cv2.LINE_AA)
        for line in cfg.get("fold", []):
            cv2.polylines(lay, [np.array(line, np.int32)], False, (LINE, LINE, LINE), 46, cv2.LINE_AA)
        out = cv2.resize(lay, (W, H), interpolation=cv2.INTER_AREA)
        Image.fromarray(out).save(OUT / f"{k}.png")
        a = np.asarray(im).copy()
        a[m > 0] = (a[m > 0] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
        for line in cfg.get("umb", []):
            cv2.polylines(a, [np.array(line, np.int32)], False, (0, 255, 255), 7, cv2.LINE_AA)
        both = Image.new("RGB", (SW, SH // 2))
        both.paste(Image.fromarray(a).resize((SW // 2, SH // 2)), (0, 0))
        both.paste(Image.fromarray(lay).resize((SW // 2, SH // 2)), (SW // 2, 0))
        both.save(CHK / f"{k}.jpg", quality=84)
        rec[k] = {"사람%": round((m > 0).mean() * 100, 1), "손질": sorted(cfg)}
        print(k, rec[k], flush=True)
    json.dump(rec, open(rec_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def glance(per=20, cols=4):
    ks = [c["컷"] for c in cuts()]
    tw, th = 760, 190
    for n in range(0, len(ks), per):
        part = ks[n:n + per]
        rows = (len(part) + cols - 1) // cols
        b = Image.new("RGB", (cols * (tw + 10) + 10, rows * (th + 46) + 10), (20, 18, 16))
        dr = ImageDraw.Draw(b)
        for i, k in enumerate(part):
            x, y = 10 + (i % cols) * (tw + 10), 10 + (i // cols) * (th + 46)
            p = CHK / f"{k}.jpg"
            if p.exists():
                b.paste(Image.open(p).resize((tw, th)), (x, y + 40))
            dr.text((x, y), k, fill=(255, 220, 120), font=FONT)
        b.save(CHK / f"_한눈_{n // per + 1}.jpg", quality=82)
    print("한눈 →", CHK)


if __name__ == "__main__":
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == "배치":
        layout(rest)
    elif cmd == "한눈":
        glance()
