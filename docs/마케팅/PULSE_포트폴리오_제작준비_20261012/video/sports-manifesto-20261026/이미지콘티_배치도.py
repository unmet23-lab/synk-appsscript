# 5번 스포츠 매니페스토 이미지 콘티의 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 「매진 임박」 v4 · 8번 · 6번과 같은 길(만족 사례 장부 S31):
# 원본 선수의 얼굴 · 몸 · 옷 · 머리카락이 옮겨 오지 않게 사람 자리만 검은 실루엣으로 두고, 나머지는 밝기 결만 남긴 회색으로 흐린다
# (빛 기둥 · 유리창 · 러닝머신처럼 구도를 잡는 큰 덩어리는 남고, 원본의 질감 · 상표는 사라진다).
#   python -X utf8 이미지콘티_배치도.py [행 번호 · 이름…]   → 배치/S01.png …(1456×816) · 배치/_확인/S01.jpg(원본 위에 실루엣을 겹친 확인판)
#   이름은 원본첫프레임/<이름>.png를 쓴다 — S11끝(고개 든 끝 그림) · S12b(12행 신발 조각) · S09r(9행을 180° 돌린 판: 바로 선 얼굴로 굽고 돌리려고)
# 원본 프레임 · 배치도는 git 밖(synk-vendor/pulse-portfolio12-20261024/콘티/p5/)에만 둔다. 번쩍 조각 · 그래픽 행(5 · 7 · 14 · 20)은 배치도를 만들지 않는다(후반).
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5")
F = V / "원본첫프레임"
OUT = V / "배치"
W, H = 1456, 816
BG_BLUR = 41
INK = 18

# 행마다: seg = 사람을 rembg로 잡을지, keep = 사람이 아니라 남길 밝은 덩어리(빛 기둥 · 유리창 · 기계)는 흐림으로 이미 남는다,
# hand = rembg가 놓치는 다리 · 발(트랙 접사)을 손으로 그린 다각형(1920×1080 좌표)
ROWS = {
    1: {"seg": True}, 2: {"seg": True}, 3: {"seg": True}, 4: {"seg": True}, 6: {"seg": True},
    8: {"seg": True}, 9: {"seg": True}, 10: {"seg": True}, 11: {"seg": True}, 12: {"seg": True},
    13: {"seg": True}, 15: {"seg": True}, 16: {"seg": True}, 17: {"seg": True}, 18: {"seg": True},
    19: {"seg": True}, 21: {"seg": True},
    "S11끝": {"seg": True}, "S12b": {"seg": True}, "S09r": {"seg": True, "src": "S09", "rot180": True},
}


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


def build(n):
    cfg = ROWS[n]
    name = n if isinstance(n, str) else f"S{n:02d}"
    src = imread(F / f"{cfg.get('src', name)}.png")
    if cfg.get("rot180"):
        src = cv2.rotate(src, cv2.ROTATE_180)
    mask = person_mask(src) if cfg.get("seg") else np.zeros(src.shape[:2], np.uint8)
    for poly in cfg.get("hand", []):
        cv2.fillPoly(mask, [np.array(poly, np.int32)], 255)
    # 바탕: 밝기만 남기고(회색) 크게 흐림 — 원본의 질감 · 글자 · 상표가 옮겨 오지 않게
    g = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY)
    g = cv2.GaussianBlur(g, (BG_BLUR, BG_BLUR), 0)
    g = (g.astype(np.float32) * 0.85 + 30).clip(0, 255).astype(np.uint8)
    out = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
    out[mask > 0] = (INK, INK, INK)
    out = cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "_확인").mkdir(exist_ok=True)
    imwrite(OUT / f"{name}.png", out)
    chk = src.copy()
    chk[mask > 0] = (chk[mask > 0] * 0.3 + np.array([0, 0, 180]) * 0.7).astype(np.uint8)
    imwrite(OUT / "_확인" / f"{name}.jpg", cv2.resize(chk, (960, 540)))
    return int((mask > 0).mean() * 1000) / 10


if __name__ == "__main__":
    rows = [int(a) if a.isdigit() else a for a in sys.argv[1:]] or list(ROWS)
    for n in rows:
        print(n, f"사람 자리 {build(n)}%", flush=True)
