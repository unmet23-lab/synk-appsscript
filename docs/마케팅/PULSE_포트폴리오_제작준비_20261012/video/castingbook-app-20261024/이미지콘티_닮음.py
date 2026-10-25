# 8번 이미지 콘티 — 소연 얼굴 닮음(2026-10-25, 「매진 임박」 이미지콘티_v4_닮음.py와 같은 길).
# OpenCV YuNet(얼굴 찾기) + SFace(코사인 닮음). 같은 사람 기준선 0.363(SFace 안내값), 참조 사진끼리는 0.55~0.6쯤.
#   python -X utf8 이미지콘티_닮음.py C01 C01r C04 …   (정지컷/<컷>.png, 없으면 받음/<컷>_*.jpg 가운데 가장 최근 판 — 받음 판을 모두 재려면 --모두)
#   거꾸로 얼굴(C01 · C01c · C04 · C04b)은 180° 돌려 바로 선 얼굴로 잰다. 바로 선 얼굴로 받는 판(위에서 내려다본 C01r · C04r · C01e · C04s,
#   카메라를 거꾸로 든 C01u — 이름 끝 r · u · e · s)은 그대로 잰다(10-26 Fable 2차 P2 13: 새 이름이 안 뒤집혀 저울이 깨졌다).
import glob, json, os, sys
import cv2, numpy as np

HOME = os.environ["USERPROFILE"]
P8 = os.path.join(HOME, "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p8")
M = os.path.join(HOME, ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
REF = "C:/SYNK-LoRA/validation/F05_soyeon/refs"
FLIP = {"C01", "C04"}


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def faces(img, width=1600):
    s = width / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    if r is None:
        return []
    return [(f, FR.feature(FR.alignCrop(sm, f))) for f in sorted(r, key=lambda b: -b[2] * b[3]) if f[2] >= 28]


def refs():
    out = []
    for n in ("01_hero", "02_left90", "03_right90"):
        f = faces(read(os.path.join(REF, f"{n}.jpg")), 900)
        if f:
            out.append(f[0][1])
    return out


def score(f, rf):
    return float(np.mean([FR.match(f, g, cv2.FaceRecognizerSF_FR_COSINE) for g in rf]))


if __name__ == "__main__":
    allv = "--모두" in sys.argv
    cuts = [a for a in sys.argv[1:] if not a.startswith("--")]
    RF = refs()
    out_p = os.path.join(P8, "받음", "_닮음.json")
    log = json.load(open(out_p, encoding="utf-8")) if os.path.exists(out_p) else {}
    for cid in cuts:
        ps = sorted(glob.glob(os.path.join(P8, "받음", f"{cid}_*.jpg")), key=os.path.getmtime)
        if not allv:
            pick = os.path.join(P8, "정지컷", f"{cid}.png")
            ps = [pick] if os.path.exists(pick) else ps[-1:]
        for p in ps:
            img = read(p)
            base = cid[:3]
            if base in FLIP and not cid.endswith(("r", "u", "e", "s")):
                img = cv2.rotate(img, cv2.ROTATE_180)
            fl = faces(img)
            sc = round(score(fl[0][1], RF), 3) if fl else None
            log[os.path.basename(p)] = {"컷": cid, "닮음": sc, "얼굴폭": int(fl[0][0][2]) if fl else 0}
            print(cid, os.path.basename(p), "닮음", sc, "(얼굴 없음)" if not fl else f"얼굴 폭 {int(fl[0][0][2])}px@1600")
    json.dump(log, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
