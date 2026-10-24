# 콘티 v4 이미지 콘티(2026-10-23): 받은 그림을 원본 그 컷 첫 프레임의 구도 · 빛에 맞춘다 — 보드(콘티보드_v4.py)에 들어가는 판.
#   python -X utf8 이미지콘티_v4_맞춤.py S07=S07_154301.jpg S02 …   (=파일을 안 주면 정지컷/v4/<컷>.png 고른 판)
#   → synk-vendor/…/콘티/v4/컷/S07.jpg(1920×1080) · _맞춤기록.json
# 1) 자리 · 크기: 피해자 컷은 얼굴(Haar 정면 · 옆 얼굴)을, 강도 · 그 밖은 사람 마스크 머리 폭을 원본과 같게 — 16:9 창을 잘라 1920×1080으로.
#    Gemini는 「클로즈업」이라 써도 조금 넓게 잡는다(현장노트 gemini_사진 「어깨 위」 항목) — 다시 굽지 않고 창을 잘라 맞춘다.
#    창이 원본 폭의 45%보다 작아지면(2.2배 넘게 키움) 화질이 모자라 「다시 굽기」로 적고 45%에서 멈춘다.
# 2) 빛: 원본 첫 프레임의 Lab 평균 · 퍼짐으로 옮긴다(밝기 0.8 · 색 1.0 — 원본 텅스텐 호박빛 · 어둡기).
# 손으로 정한 창은 CROP에(받은 그림 좌표 x0, y0, 폭).
import sys, json, glob, os
import numpy as np, cv2
from PIL import Image
from rembg import new_session, remove

V = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/"
SH = json.load(open(V + "원본/원본_샷.json", encoding="utf-8"))
OUT = V + "콘티/v4/컷/"
os.makedirs(OUT, exist_ok=True)
# 얼굴은 OpenCV YuNet(cv2 5.0에 Haar가 없다). 한글 경로의 ONNX는 못 읽어 영문 경로 사본을 쓴다(모델/에 원본)
YUNET = "C:/Users/q1212/.rembg/models/yunet/face_detection_yunet_2023mar.onnx"
FD = cv2.FaceDetectorYN.create(YUNET, "", (320, 320), 0.6, 0.3, 5000)
ROBBER = {2, 4, 6, 9, 13, 15, 19, 23, 25, 31}
WIDE = {1, 3, 5, 10, 24, 26, 30}   # 셋이 함께거나 얼굴이 안 보이는 컷 — 사람 마스크 전체 상자로
CROP = {1: (330, 140, 2420),         # 손으로 정한 창: 컷 → (x0, y0, w) — S01은 강도를 원본처럼 왼쪽 끝에 걸치게
        26: (1134, 125, 1240),       # S26 원본 첫 프레임은 숙인 정수리(꽃관)를 아주 가까이 — 받은 판은 앉아 숙인 몸 전체라 머리 쪽으로
        24: (806, 85, 1308),         # S24 원본은 B의 숙인 머리가 화면 대부분 — B 머리 가운데 폭 48%(A 손 · 반지가 들어오게, Fable P1)
        5: (490, 0, 1877)}           # S05 원본은 허리 높이 한 걸음 더 가까이(Fable P2)
_ses = None


def imread(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def mask(img):
    global _ses
    _ses = _ses or new_session("u2net_human_seg")
    h, w = img.shape[:2]
    k = 720 / w
    small = cv2.resize(img, (720, int(h * k)))
    m = np.asarray(remove(Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)), session=_ses, only_mask=True)) > 127
    return cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST) > 0


def face_box(img):
    s = 960 / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None or len(r) == 0:
        return None
    x, y, w, h = max(r[:, :4].tolist(), key=lambda b: b[2] * b[3])
    return (x / s, y / s, w / s, h / s)


def head_box(m):
    ys, xs = np.nonzero(m)
    if len(ys) == 0:
        return None
    top = ys.min()
    H = m.shape[0]
    band = m[top: top + int(H * 0.12)]
    cols = np.nonzero(band.any(0))[0]
    return (cols.min(), top, cols.max() - cols.min() + 1, int(H * 0.12))


def whole_box(m):
    ys, xs = np.nonzero(m)
    return (xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1)


def lab_match(img, ref, kl=0.8, kc=1.0):
    a = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    b = cv2.cvtColor(ref, cv2.COLOR_BGR2LAB).astype(np.float32)
    for c, k in ((0, kl), (1, kc), (2, kc)):
        ma, sa, mb, sb = a[..., c].mean(), a[..., c].std() + 1e-6, b[..., c].mean(), b[..., c].std()
        t = (a[..., c] - ma) * (sb / sa) + mb
        a[..., c] = a[..., c] * (1 - k) + t * k
    return cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def fit(n, src, blur=True, out=None):
    img = imread(src)
    H, W = img.shape[:2]
    orig = imread(V + "검수/fable_v4콘티/frames/%04d.jpg" % (SH[n - 1]["f0"] + 1))
    oh, ow = orig.shape[:2]
    note = ""
    if n in CROP:
        x0, y0, cw = CROP[n]
        note = "손으로 정한 창"
    else:
        mode = "whole" if n in WIDE else ("head" if n in ROBBER else "face")
        ob = tb = None
        if mode == "face":
            ob, tb = face_box(img), face_box(orig)
            if ob is None or tb is None:
                mode = "head"
                note = "얼굴을 못 찾아 머리 폭으로 "
        if mode == "head":
            ob, tb = head_box(mask(img)), head_box(mask(orig))
        if mode == "whole":
            ob, tb = whole_box(mask(img)), whole_box(mask(orig))
        if ob is None or tb is None:
            x0, y0, cw = 0, 0, W
            note += "사람을 못 찾아 그대로"
        else:
            # 원본 상자를 0~1로, 받은 그림의 같은 상자가 창 안 같은 자리 · 같은 폭이 되게
            tx, ty, tw, th = tb[0] / ow, tb[1] / oh, tb[2] / ow, tb[3] / oh
            cw = ob[2] / tw if mode != "whole" else max(ob[2] / tw, ob[3] / th * 16 / 9)
            cw = min(cw, W, H * 16 / 9)
            x0 = ob[0] + ob[2] / 2 - (tx + tw / 2) * cw
            y0 = ob[1] - ty * cw * 9 / 16
            note += f"{mode} 맞춤"
    if cw < W * 0.45:
        note += f" · 창 {cw / W:.0%} → 45%에서 멈춤(다시 굽기 후보)"
        cx = x0 + cw / 2
        cw = W * 0.45
        x0 = cx - cw / 2
    ch = cw * 9 / 16
    x0 = min(max(x0, 0), W - cw)
    y0 = min(max(y0, 0), H - ch)
    crop = img[int(y0): int(y0 + ch), int(x0): int(x0 + cw)]
    crop = cv2.resize(crop, (1920, 1080), interpolation=cv2.INTER_LANCZOS4 if cw < 1920 else cv2.INTER_AREA)
    graded = lab_match(crop, cv2.resize(orig, (1920, 1080)))
    if n == 30 and blur:   # 원본 #30은 카메라가 휙 돌아 흐린 채 시작한다(64.42~64.7초) — 가로 움직임 흐림(영상 시작 그림은 blur=False로 또렷하게 뽑고 흐림은 편집에서)
        k = np.zeros((1, 71), np.float32)
        k[0, :] = 1 / 71
        graded = cv2.filter2D(graded, -1, k)
        note += " · 휙 흐림"
    out = out or OUT + f"S{n:02d}.jpg"
    cv2.imencode(".jpg", graded, [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tofile(out)
    return out, f"창 x{int(x0)} y{int(y0)} 폭{int(cw)}({cw / W:.0%}) · {note}"


if __name__ == "__main__":
    log = {}
    lp = OUT + "_맞춤기록.json"
    if os.path.exists(lp):
        log = json.load(open(lp, encoding="utf-8"))
    for a in sys.argv[1:]:
        cid, _, f = a.partition("=")
        n = int(cid[1:3])
        src = V + "받음/v4/" + f if f else V + f"정지컷/v4/{cid}.png"
        out, note = fit(n, src)
        log[cid] = {"src": os.path.basename(src), "note": note}
        print(cid, note)
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
