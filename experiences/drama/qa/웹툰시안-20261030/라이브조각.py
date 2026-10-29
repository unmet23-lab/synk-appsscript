# 드라마 말하기 1화 — 2D 라이브 조각 만들기(2026-10-30). 라이브실사.mjs가 구운 입신(live-prof · live-senior)을
#  ① rembg(isnet-general-use)로 바탕에서 떼고 가장자리의 회색 바탕 번짐을 걷어 WebP(투명)로,
#  ② 눈 감은 판 · 입 벌린 판을 바탕 그림에 맞춰 위상 상관으로 줄 세운 뒤 눈 둘레 · 입 둘레만 부드러운 테두리 조각(PNG)으로 자른다.
# 통째로 갈아 끼우면 그림이 흔들린다 — 조각만 켰다 끈다(현장노트 그림 굽기 「장면째 구운 마스코트의 깜빡임 · 눈웃음 판을 통째로 바꿔 끼우면 …」).
#   python -X utf8 라이브조각.py <작업>
#   → <작업>/보기/<id>-cut.webp · <id>-blink.png · <id>-talk.png · 라이브.json(조각 자리 %, 줄 세운 값, 조각 밖 차이)
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

work = sys.argv[1]
got = os.path.join(work, "받음")
out = os.path.join(work, "보기")
os.makedirs(out, exist_ok=True)
M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models")
os.environ.setdefault("U2NET_HOME", os.path.join(M, "isnet-general-use"))
from rembg import new_session, remove  # noqa: E402

FD = cv2.FaceDetectorYN.create(os.path.join(M, "yunet", "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.55, 0.3, 50)


def rgb(p):
    return np.asarray(Image.open(p).convert("RGB"))


def face(img):
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    r = FD.detect(cv2.cvtColor(img, cv2.COLOR_RGB2BGR))[1]
    if r is None:
        raise SystemExit("얼굴을 못 찾았다")
    f = max(r, key=lambda b: b[2])
    pts = f[4:14].reshape(5, 2)   # 오른눈 · 왼눈 · 코 · 입 오른끝 · 입 왼끝(보는 쪽 기준 YuNet 순서)
    return f[:4], pts


def box(cx, cy, w, h, W, H):
    x0, y0 = int(max(0, cx - w / 2)), int(max(0, cy - h / 2))
    return [x0, y0, int(min(W, cx + w / 2)) - x0, int(min(H, cy + h / 2)) - y0]


def cutout(img, ses):
    a = np.asarray(remove(Image.fromarray(img), session=ses, only_mask=True)).astype(np.float32) / 255.0
    # 바탕(#DADADA)과 비슷한 밝은 회색 옷(후드)이 반쯤 비쳤다(10-30) → 사람 윤곽 안쪽의 반투명은 메운다.
    # 진짜 바탕 구멍(팔과 몸 사이, 알파 0 근처)은 그대로 두고, 바깥 테두리 몇 화소만 부드럽게 남긴다.
    from scipy import ndimage
    filled = ndimage.binary_fill_holes(a > 0.5)
    inner = ndimage.binary_erosion(filled, iterations=6)
    a = np.where(inner & (a > 0.05), 1.0, a)
    # 실루엣 안에 닫힌 작은 구멍(후드 목 V — 17×30px, 10-30 Fable 검수 #2)은 알파와 상관없이 메운다. 팔 · 몸 사이 큰 틈은 남긴다.
    holes, n = ndimage.label(filled & (a <= 0.5))
    if n:
        size = ndimage.sum(np.ones_like(a), holes, index=np.arange(1, n + 1))
        small = np.isin(holes, np.arange(1, n + 1)[size < 2000])
        a = np.where(small, 1.0, a)
    # 머리 바깥 1px 밝은 톱니 테(Fable #8) → 테두리를 1px 깎는다
    a = ndimage.grey_erosion(a, size=(3, 3))
    bg = np.median(img[a < 0.03].reshape(-1, 3), axis=0) if (a < 0.03).any() else np.array([218, 218, 218], np.float32)
    f = img.astype(np.float32)
    aa = np.clip(a, 1e-3, 1)[..., None]
    clean = np.clip((f - (1 - aa) * bg) / aa, 0, 255)   # 가장자리에 섞인 바탕색을 걷는다
    clean[a <= 0.02] = 0
    rgba = np.dstack([clean, a * 255]).astype(np.uint8)
    return rgba, a


def align(base, var, roi):
    x, y, w, h = roi
    g1 = cv2.cvtColor(base[y:y + h, x:x + w], cv2.COLOR_RGB2GRAY).astype(np.float32)
    g2 = cv2.cvtColor(var[y:y + h, x:x + w], cv2.COLOR_RGB2GRAY).astype(np.float32)
    win = cv2.createHanningWindow((w, h), cv2.CV_32F)
    (dx, dy), resp = cv2.phaseCorrelate(g1, g2, win)
    return float(dx), float(dy), float(resp)


def patch(var, dx, dy, b, feather=0.16):
    H, W = var.shape[:2]
    m = np.float32([[1, 0, -dx], [0, 1, -dy]])
    shifted = cv2.warpAffine(var, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    x, y, w, h = b
    crop = shifted[y:y + h, x:x + w]
    mask = np.zeros((h, w), np.float32)
    pad = int(min(w, h) * feather)
    mask[pad:h - pad, pad:w - pad] = 1
    mask = cv2.GaussianBlur(mask, (0, 0), max(1, pad / 2))
    return np.dstack([crop, mask * 255]).astype(np.uint8), shifted


ses = new_session("isnet-general-use")
rec = {}
ids = [c for c in ("live-prof", "live-senior", "live-prof-g", "live-senior-g")
       if all(os.path.exists(os.path.join(got, f"{c}{s}.png")) for s in ("", "-blink", "-talk"))]
for cid in ids:
    base = rgb(os.path.join(got, f"{cid}.png"))
    H, W = base.shape[:2]
    rgba, alpha = cutout(base, ses)
    Image.fromarray(rgba, "RGBA").save(os.path.join(out, f"{cid}-cut.webp"), "WEBP", quality=92, method=6)
    fb, pts = face(base)
    eyes, mouth = pts[:2], pts[3:5]
    ed = float(np.linalg.norm(eyes[0] - eyes[1]))
    mw = float(np.linalg.norm(mouth[0] - mouth[1]))
    ex, ey = eyes.mean(axis=0)
    mx, my = mouth.mean(axis=0)
    eye_b = box(ex, ey + ed * 0.02, ed * 2.3, ed * 0.85, W, H)   # 높이 1.05 → 0.85: 앞머리를 덜 담아 깜빡일 때 머리가 튀지 않게(Fable #7)
    mouth_b = box(mx, my + mw * 0.12, max(mw * 2.1, ed * 1.1), max(mw * 1.5, ed * 0.75), W, H)
    face_roi = [int(fb[0]), int(fb[1]), int(fb[2]), int(fb[3])]
    r = {"크기": [W, H], "얼굴": face_roi, "눈": eye_b, "입": mouth_b, "사람비율": round(float((alpha > 0.5).mean()), 3)}
    for kind, b in (("blink", eye_b), ("talk", mouth_b)):
        var = rgb(os.path.join(got, f"{cid}-{kind}.png"))
        dx, dy, resp = align(base, var, face_roi)
        pt, shifted = patch(var, dx, dy, b)
        Image.fromarray(pt, "RGBA").save(os.path.join(out, f"{cid}-{kind}.png"))
        # 조각 밖이 얼마나 그대로인가(줄 세운 뒤, 사람 영역만) — 크면 편집 굽기가 그림 전체를 바꾼 것
        inside = np.zeros((H, W), bool)
        inside[b[1]:b[1] + b[3], b[0]:b[0] + b[2]] = True
        person = (alpha > 0.5) & ~inside
        diff = float(np.abs(shifted.astype(np.int16) - base.astype(np.int16))[person].mean())
        r[kind] = {"이동": [round(dx, 2), round(dy, 2)], "상관": round(resp, 3), "조각밖차이": round(diff, 2)}
    # 페이지가 쓸 % 자리
    r["눈%"] = [round(100 * eye_b[0] / W, 3), round(100 * eye_b[1] / H, 3), round(100 * eye_b[2] / W, 3), round(100 * eye_b[3] / H, 3)]
    r["입%"] = [round(100 * mouth_b[0] / W, 3), round(100 * mouth_b[1] / H, 3), round(100 * mouth_b[2] / W, 3), round(100 * mouth_b[3] / H, 3)]
    rec[cid] = r
    print(cid, json.dumps({k: r[k] for k in ("눈", "입", "blink", "talk", "사람비율")}, ensure_ascii=False))
# 실사 — 오리지 않고 눈 · 입 조각만(Fable #3: 실사도 같은 방식으로 깜빡이고 말하게)
for cid in [c for c in ("real-prof", "real-senior") if all(os.path.exists(os.path.join(got, f"{c}{s}.png")) for s in ("", "-blink", "-talk"))]:
    base = rgb(os.path.join(got, f"{cid}.png"))
    H, W = base.shape[:2]
    fb, pts = face(base)
    eyes, mouth = pts[:2], pts[3:5]
    ed = float(np.linalg.norm(eyes[0] - eyes[1])); mw = float(np.linalg.norm(mouth[0] - mouth[1]))
    ex, ey = eyes.mean(axis=0); mx, my = mouth.mean(axis=0)
    eye_b = box(ex, ey + ed * 0.02, ed * 2.3, ed * 0.85, W, H)
    mouth_b = box(mx, my + mw * 0.12, max(mw * 2.1, ed * 1.1), max(mw * 1.5, ed * 0.75), W, H)
    face_roi = [int(fb[0]), int(fb[1]), int(fb[2]), int(fb[3])]
    r = {"크기": [W, H], "얼굴": face_roi, "눈": eye_b, "입": mouth_b}
    for kind, b in (("blink", eye_b), ("talk", mouth_b)):
        var = rgb(os.path.join(got, f"{cid}-{kind}.png"))
        dx, dy, resp = align(base, var, face_roi)
        pt, shifted = patch(var, dx, dy, b)
        Image.fromarray(pt, "RGBA").save(os.path.join(out, f"{cid}-{kind}.png"))
        outside = np.ones((H, W), bool); outside[b[1]:b[1] + b[3], b[0]:b[0] + b[2]] = False
        diff = float(np.abs(shifted.astype(np.int16) - base.astype(np.int16))[outside].mean())
        r[kind] = {"이동": [round(dx, 2), round(dy, 2)], "상관": round(resp, 3), "조각밖차이": round(diff, 2)}
    r["눈%"] = [round(100 * eye_b[0] / W, 3), round(100 * eye_b[1] / H, 3), round(100 * eye_b[2] / W, 3), round(100 * eye_b[3] / H, 3)]
    r["입%"] = [round(100 * mouth_b[0] / W, 3), round(100 * mouth_b[1] / H, 3), round(100 * mouth_b[2] / W, 3), round(100 * mouth_b[3] / H, 3)]
    rec[cid] = r
    print(cid, json.dumps({k: r[k] for k in ("눈", "입", "blink", "talk")}, ensure_ascii=False))
json.dump(rec, open(os.path.join(out, "라이브.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
