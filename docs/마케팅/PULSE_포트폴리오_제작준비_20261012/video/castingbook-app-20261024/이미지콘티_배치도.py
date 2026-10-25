# 8번 이미지 콘티 배치도(2026-10-25) — Gemini에 원본 프레임 대신 넣는 그림. 원본 배우의 얼굴 · 몸 · 옷이 옮겨 오지 않게 사람을 검은 실루엣으로,
# 장소(공원)는 빼고 밝은 회색 바탕만 둔다(우리 장소는 카페라 원본 배경이 섞이면 안 된다). 합성할 자리(폰 화면 · 쇼핑백 · 포스터 · 스티커 · 배너)는 크로마 초록.
#   python -X utf8 이미지콘티_배치도.py [컷 번호…]  → 배치/S01.png …(1456×816) · 배치/_확인/S01.jpg(원본 위에 실루엣 · 초록을 겹친 확인판)
# 만족 사례 장부 S31(「매진 임박」 v4 이미지콘티_v4_배치도.py)과 같은 방식 — 실루엣 바탕 205 · 사람 18 · 사람 분할 rembg u2net_human_seg.
import sys, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image

P8 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8")
F = P8 / "원본첫프레임"
OUT = P8 / "배치"
GREEN = (0, 177, 64)
BG, INK = 205, 18

# 컷마다: rembg로 사람을 잡을지(seg), 잡은 사람에서 뺄 상자(drop), 손으로 그릴 사람(poly · ell), 초록 자리(green), 쓰지 않음(skip)
# 좌표는 1920×1080 원본 기준(10-25 격자로 잼 — 배치/_격자).
CUT = {
    1: {"seg": True},                                    # 거꾸로 얼굴 · 두 손에 폰(위)
    2: {"seg": True},                                    # 와이드 · 가운데 작게
    3: {"seg": True, "green": [[(707, 30), (1252, 30), (1290, 1050), (700, 1050)]]},   # 똑바로 든 폰 · 왼손 검지
    4: {"seg": True},                                    # 거꾸로 얼굴 클로즈업
    # 5: 다리(오른쪽) + 쇼핑백(왼쪽 아래, 초록 앞면) + 창 너머 소연(가운데). 원본의 개는 빼고 그 자리에 쇼핑백을 둔다.
    5: {"seg": True, "drop": [(0, 760, 470, 1080)],   # 개 · 매달린 남자는 빼고(창 너머 소연은 글로) 걷는 다리만
        "drop_poly": [[(660, 0), (1235, 0), (1235, 370), (1060, 520), (990, 740), (700, 740), (660, 400)]],
        "green": [[(250, 520), (610, 500), (640, 900), (270, 930)]],
        "poly": [[(380, 430), (470, 430), (500, 520), (250, 520)]]},     # 쇼핑백 손잡이 · 위 테두리
    6: {"seg": False, "green": [[(300, 0), (1565, 0), (1600, 1080), (190, 1080)]],      # 극접사 · 오른쪽 엄지(손으로 그림)
        "hand": [[(1920, 420), (1520, 430), (1260, 470), (1205, 560), (1250, 700), (1480, 820), (1920, 900)], [(0, 640), (200, 600), (230, 1080), (0, 1080)]]},
    7: {"seg": True},                                    # 일어나 앉는 미디엄(첫 프레임은 아래에 손 · 폰만)
    # 8: 벤치의 두 사람 대신 가게 창 앞에 선 두 사람(뒷모습) — 둘 사이 창에 세로 포스터(초록)
    8: {"seg": False,
        "poly": [[(600, 330), (880, 330), (900, 1000), (590, 1000)], [(1170, 330), (1440, 330), (1460, 1000), (1150, 1000)]],
        "ell": [(740, 260, 75, 90), (1305, 260, 75, 90)],
        "green": [[(930, 110), (1130, 110), (1130, 480), (930, 480)]]},
    9: {"seg": True},
    10: {"seg": False, "green": [[(175, 0), (1460, 0), (1830, 1080), (425, 1080)]],      # 비스듬한 극접사(폰을 쥔 오른손 엄지만)
         "hand": [[(1700, 640), (1920, 600), (1920, 1080), (1760, 1080)]]},
    # 11: 가방 키링 대신 음료 냉장고 유리문의 스티커(초록) 접사
    11: {"seg": False, "green": [[(470, 170), (1330, 210), (1300, 940), (450, 900)]]},
    12: {"seg": True, "green": [[(578, 0), (1420, 0), (1430, 1080), (570, 1080)]],       # 두 손 · 화면
         "keep": [[(0, 520), (400, 460), (870, 500), (870, 660), (560, 700), (560, 1080), (0, 1080)], [(1380, 480), (1920, 480), (1920, 1080), (1380, 1080)]]},
    # 13: 니트 감은 나무 대신 가로등 기둥의 세로 배너(초록) · 먼 배너 하나
    13: {"seg": False, "green": [[(300, 0), (840, 0), (840, 1080), (300, 1080)], [(1440, 660), (1630, 660), (1690, 1080), (1490, 1080)]],
         "poly": [[(860, 0), (905, 0), (905, 1080), (860, 1080)]]},   # 배너 옆 가로등 기둥
    14: {"seg": True},
    15: {"seg": True, "green": [[(1045, 30), (1470, 45), (1265, 1080), (720, 1080)]],    # 비스듬히 든 폰
         "keep": [[(0, 0), (560, 0), (560, 290), (880, 300), (880, 500), (700, 560), (700, 1080), (0, 1080)], [(1230, 540), (1920, 540), (1920, 1080), (1230, 1080)]]},
    16: {"seg": True},
    17: {"seg": False, "green": [[(260, 0), (1920, 0), (1920, 900), (330, 900), (250, 720)]],  # 극접사 · 왼쪽 아래 폰 모서리
          "hand": [[(0, 560), (330, 520), (330, 1080), (0, 1080)]]},   # 왼쪽 아래 손가락 · 폰 아래 테두리 자리
    18: {"seg": True},                                   # 손 클로즈업(뜨개 손 → 우유 붓는 손)
    # 19: 가운데 남자 자리에 소연, 왼쪽 앞 어깨 너머 손님 하나(실루엣), 오른쪽 여자는 뺀다
    19: {"seg": True, "drop": [(1640, 250, 1920, 1080), (0, 0, 790, 1080)],
         "poly": [[(0, 180), (330, 160), (520, 330), (560, 1080), (0, 1080)]],
         "ell": [(230, 300, 190, 210)],
         "green": [[(600, 40), (860, 40), (860, 400), (600, 400)]]},   # 뒤 벽(창 옆)의 액자 포스터
    # 20: 높은 앵글 · 손님 둘(뒷모습, 왼쪽 앞 · 오른쪽 앞) · 소연(가운데 뒤) — 나머지는 뺀다
    20: {"seg": False,
         "poly": [[(560, 470), (900, 450), (930, 1080), (540, 1080)], [(1210, 440), (1560, 420), (1580, 1080), (1190, 1080)], [(1190, 300), (1350, 300), (1370, 520), (1180, 520)]],
         "ell": [(720, 400, 95, 105), (1385, 370, 100, 110), (1270, 235, 55, 65)]},
}


def imread(p):   # cv2.imread는 한글 경로를 못 읽는다
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def main(cuts):
    from rembg import new_session, remove
    ses = new_session("u2net_human_seg")
    (OUT / "_확인").mkdir(parents=True, exist_ok=True)
    rec = {}
    for n in cuts:
        cfg = CUT[n]
        im = Image.open(F / f"C{n:02d}.png").convert("RGB")
        W, H = im.size
        m = np.zeros((H, W), np.uint8)
        if cfg.get("seg"):
            mm = np.asarray(remove(im, session=ses, only_mask=True)).astype(np.float32) / 255
            m = ((mm > 0.5) * 255).astype(np.uint8)
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
            for (x0, y0, x1, y1) in cfg.get("drop", []):
                m[y0:y1, x0:x1] = 0
            for poly in cfg.get("drop_poly", []):
                cv2.fillPoly(m, [np.array(poly, np.int32)], 0)
            if cfg.get("keep"):   # 폰 화면 속 사진의 사람까지 잡히는 컷 — 진짜 손 자리만 남긴다
                k = np.zeros_like(m)
                for poly in cfg["keep"]:
                    cv2.fillPoly(k, [np.array(poly, np.int32)], 255)
                m = np.where(k > 0, m, 0).astype(np.uint8)
        for poly in cfg.get("poly", []):
            cv2.fillPoly(m, [np.array(poly, np.int32)], 255)
        for (cx, cy, rx, ry) in cfg.get("ell", []):
            cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
        g = np.zeros((H, W), np.uint8)
        for poly in cfg.get("green", []):
            cv2.fillPoly(g, [np.array(poly, np.int32)], 255)
        lay = np.full((H, W, 3), BG, np.uint8)
        lay[m > 0] = INK
        lay[g > 0] = GREEN   # 초록 자리가 사람 위(폰 화면을 가리는 손가락은 아래 단계에서 다시 덮음)
        # 화면을 가리는 손가락 · 엄지는 사람 실루엣이 앞이다(원본에서 화면 앞에 있는 손)
        front = (m > 0) & (g > 0)
        if cfg.get("seg") and n in (3, 6, 10, 12, 15):
            lay[front] = INK
        for poly in cfg.get("hand", []):   # 화면 앞에 있는 손(손으로 그린 것) — 초록 위에 덮는다
            hm = np.zeros((H, W), np.uint8); cv2.fillPoly(hm, [np.array(poly, np.int32)], 255)
            lay[hm > 0] = INK; m[hm > 0] = 255
        Image.fromarray(lay).resize((1456, 816), Image.LANCZOS).save(OUT / f"S{n:02d}.png")
        a = np.asarray(im).copy()
        a[m > 0] = (a[m > 0] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
        a[(g > 0) & ~front] = (a[(g > 0) & ~front] * 0.4 + np.array(GREEN) * 0.6).astype(np.uint8)
        Image.fromarray(a).resize((960, 540)).save(OUT / "_확인" / f"S{n:02d}.jpg", quality=85)
        rec[n] = {"사람%": round((m > 0).mean() * 100, 1), "초록%": round((g > 0).mean() * 100, 1)}
        print(n, rec[n])
    json.dump(rec, open(OUT / "_배치기록.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or sorted(CUT))
