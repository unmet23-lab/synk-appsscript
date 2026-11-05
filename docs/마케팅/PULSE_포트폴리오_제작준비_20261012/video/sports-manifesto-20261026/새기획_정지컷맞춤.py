# 5번 새 기획(11-05) 정지컷을 영상에 넣을 판으로 맞춘다 — 받은 크기가 섞여(941×1672 · 887×1774 · 1060×1484) 모두 1080×1920(9:16)으로 채워 자르고,
# 딛기 매치 컷 N03 · N05는 N04에 신발 자리를 겹친다(신발 · 발의 특징점으로 닮음 변환을 재서 옮김 — Fable 2차: N03 앞코가 6% 위 · 크기 6% 다름 · 끈 매듭 다름).
# 겹친 뒤 신발 · 발 · 위쪽 어둠은 N04의 것을 그대로 쓰고 바닥만 각 판의 것을 남긴다 — 매치 컷 셋의 신발이 한 장처럼 같고, 옮긴 자리의 빈 가장자리도 안 생긴다.
#   python -X utf8 새기획_정지컷맞춤.py   → 콘티/p5n/정지컷_916/<컷>.png · 맞춤.json(매치 컷 옮긴 값 · 겹친 뒤 어긋남)
import json
from pathlib import Path
import numpy as np, cv2
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n")
SRC, OUT = V / "정지컷", V / "정지컷_916"
W, H = 1080, 1920
# 채워 자를 때 가운데에서 옮길 가로 자리(N01은 신발과 빛 기둥이 함께 남게 조금 왼쪽)
CX = {"N01": 0.46}


def load(p):
    return cv2.cvtColor(np.asarray(Image.open(p).convert("RGB")), cv2.COLOR_RGB2BGR)


def save(img, p):
    Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(p)


def cover(img, cx=0.5):
    h, w = img.shape[:2]
    s = max(W / w, H / h)
    img = cv2.resize(img, (int(w * s + 0.5), int(h * s + 0.5)), interpolation=cv2.INTER_LANCZOS4)
    x = int(round((img.shape[1] - W) * cx)); y = (img.shape[0] - H) // 2
    return img[y:y + H, x:x + W]


def align(mov, ref):
    """신발 · 발이 있는 위쪽 60%에서 SIFT로 맞춰 mov를 ref 자리로 옮긴다(닮음 변환). 바닥은 서로 달라 안 쓴다."""
    sift = cv2.SIFT_create(nfeatures=4000)
    m = np.zeros((H, W), np.uint8); m[: int(H * 0.6)] = 255
    k1, d1 = sift.detectAndCompute(cv2.cvtColor(mov, cv2.COLOR_BGR2GRAY), m)
    k2, d2 = sift.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), m)
    good = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < 0.75 * b.distance]
    p1 = np.float32([k1[g.queryIdx].pt for g in good]); p2 = np.float32([k2[g.trainIdx].pt for g in good])
    M, inl = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    out = cv2.warpAffine(mov, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
    err = np.linalg.norm((p1[inl.ravel() == 1] @ M[:, :2].T + M[:, 2]) - p2[inl.ravel() == 1], axis=1)
    s = float(np.hypot(M[0, 0], M[1, 0]))
    return out, {"배율": round(s, 4), "옮김_x_px": round(float(M[0, 2]), 1), "옮김_y_px": round(float(M[1, 2]), 1),
                 "맞은점": int(inl.sum()), "겹친뒤_중앙어긋남_px": round(float(np.median(err)), 2)}


OUT.mkdir(parents=True, exist_ok=True)
rec = {}
for p in sorted(SRC.glob("*.png")):
    if p.stem.startswith("D00") or p.stem.endswith("글자없음"):
        continue
    save(cover(load(p), CX.get(p.stem, 0.5)), OUT / p.name)
ref = load(OUT / "N04.png")
from rembg import remove, new_session
shoe = np.asarray(remove(Image.fromarray(cv2.cvtColor(ref, cv2.COLOR_BGR2RGB)), session=new_session("isnet-general-use"), only_mask=True)).astype(np.float32) / 255
shoe = cv2.dilate((shoe > 0.5).astype(np.float32), np.ones((9, 9), np.uint8))
# 신발 · 발(마스크)과 화면 위 30%(어둠 · 연기 — 옮긴 자리의 빈 가장자리가 생기는 곳)는 N04, 나머지 바닥은 각 판 — 경계는 부드럽게
keep = np.maximum(shoe, (np.arange(H)[:, None] < int(H * 0.30)).astype(np.float32) * np.ones((1, W), np.float32))
keep = cv2.GaussianBlur(np.clip(keep, 0, 1), (0, 0), 6)[..., None]
for n in ("N03", "N05"):
    if (OUT / f"{n}.png").exists():
        out, r = align(load(OUT / f"{n}.png"), ref)
        out = np.clip(ref * keep + out * (1 - keep), 0, 255).astype(np.uint8)
        r["신발_위쪽은_N04"] = True
        save(out, OUT / f"{n}.png"); rec[n] = r
(OUT / "맞춤.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(rec, ensure_ascii=False))
