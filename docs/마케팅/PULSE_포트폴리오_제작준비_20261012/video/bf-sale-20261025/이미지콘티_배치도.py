# 블프 세일 이미지 콘티 배치도(2026-10-26) — 8번 이미지콘티_배치도.py를 세로(9:16)로 옮김. Gemini에 원본 프레임 대신 넣는 그림.
# 원본 배우의 얼굴 · 몸 · 옷과 원본 장소(남의 브랜드 레드카펫 · 로고 아치)가 옮겨 오지 않게 사람을 검은 실루엣으로, 나머지는 밝은 회색 바탕만 둔다.
# 사람이 없는 3번은 원본을 크게 흐린 뒤 윤곽선만 옅게 남겨(작은 로고 무늬는 사라짐) 카메라 높이 · 바퀴 자리만 전한다.
# 합성할 자리(1번 전광판)는 크로마 초록 — 숫자는 후반에 얹는다(장면 속에서 읽혀야 하는 글자는 AI로 그리지 않는다).
#   python -X utf8 이미지콘티_배치도.py [컷 번호…]  → git 밖 콘티/bf-sale/배치/S01.png …(816×1456) · 배치/_확인/S01.jpg
import sys, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image

B = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sale")
F = B / "원본첫프레임"
OUT = B / "배치"
GREEN = (0, 177, 64)
BG, INK = 205, 18

# 좌표는 1080×1920 원본 기준(원본첫프레임/_격자.jpg — 108 · 192px 칸).
CUT = {
    1: {"seg": True, "drop": [(0, 0, 230, 1920), (930, 0, 1080, 1920)],        # 가운데 강사만(양 끝 두 사람 뺌)
        "green": [[(318, 258), (645, 258), (645, 352), (318, 352)]]},          # 위 벽 전광판 — 숫자는 후반
    3: {"seg": False, "edges": True},                                           # 사람 없음 — 바퀴 옆 낮은 카메라, 바닥이 굴러 펼쳐짐
    4: {"seg": True, "drop": [(880, 1250, 1080, 1920)]},                      # 얼굴 미디엄 클로즈업(오른쪽 아래 남의 손 · 수건 뺌)
    6: {"seg": True, "drop": [(0, 0, 400, 1920), (700, 0, 1080, 1920)]},        # 스튜디오 와이드 — 가운데 강사만(양옆 수강생 뺌)
    7: {"seg": True, "drop": [(0, 0, 230, 1920), (860, 0, 1080, 1920)]},        # 뒷모습 — 양옆 수강생 뺌
    8: {"seg": True, "model": "u2net", "drop": [(0, 0, 355, 1920), (0, 1560, 1080, 1920)]},
    # 터널 옆모습 — 사람 + 자전거만(왼쪽 떠 있는 카드 뺌). 10-26 첫 판(사람 따기 모델)은 센 네온 줄기까지 사람으로 잡아
    # 사람이 원본의 1.8배로 구워졌다(Fable P1) — 이 컷만 일반 모델 u2net이 사람 + 자전거를 깔끔하게 딴다
    10: {"seg": True},                                                          # 얼굴 놀람
    12: {"seg": True, "drop": [(0, 1500, 300, 1920)]},                          # 옆모습 페달(앞 자전거 흐림은 사람 아님)
    13: {"seg": True, "drop": [(0, 0, 1080, 830), (0, 830, 330, 1920)],         # 아래 절반 — 가운데 남자 자리에 채원(왼쪽 강사 · 위 끝 카드 뺌)
         "top": 830},
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
        lay = np.full((H, W, 3), BG, np.uint8)
        if cfg.get("edges"):
            g = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2GRAY)
            g = cv2.GaussianBlur(g, (0, 0), 6)
            e = cv2.Canny(g, 8, 24)
            e = cv2.dilate(e, np.ones((9, 9), np.uint8))
            lay[e > 0] = 70
        if cfg.get("seg"):
            s2 = new_session(cfg["model"]) if cfg.get("model") else ses
            mm = np.asarray(remove(im, session=s2, only_mask=True)).astype(np.float32) / 255
            m = ((mm > 0.5) * 255).astype(np.uint8)
            m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
            for (x0, y0, x1, y1) in cfg.get("drop", []):
                m[y0:y1, x0:x1] = 0
        g = np.zeros((H, W), np.uint8)
        for poly in cfg.get("green", []):
            cv2.fillPoly(g, [np.array(poly, np.int32)], 255)
        lay[m > 0] = INK
        lay[g > 0] = GREEN
        if cfg.get("top"):   # 13번 — 위 끝 카드 자리는 굽지 않는다(그래픽). 아래 절반만 남기고 위는 짙은 회색으로 표시
            lay[:cfg["top"]] = 90
        Image.fromarray(lay).resize((816, 1456), Image.LANCZOS).save(OUT / f"S{n:02d}.png")
        a = np.asarray(im).copy()
        a[m > 0] = (a[m > 0] * 0.4 + np.array([255, 0, 0]) * 0.6).astype(np.uint8)
        a[g > 0] = (a[g > 0] * 0.4 + np.array(GREEN) * 0.6).astype(np.uint8)
        Image.fromarray(a).resize((540, 960)).save(OUT / "_확인" / f"S{n:02d}.jpg", quality=85)
        rec[n] = {"사람%": round((m > 0).mean() * 100, 1), "초록%": round((g > 0).mean() * 100, 1)}
        print(n, rec[n])
    json.dump(rec, open(OUT / "_배치기록.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or sorted(CUT))
