# 11-07 밤 유호님 「사람이 자꾸 바뀐다」 뒤 전수 검수에 쓴 판 만들기(Claude) — 결과 · 보고는 git 밖 콘티/romance/검수/전수_20261107/, 요지는 02_콘티 10절.
# 다시 만든 판을 볼 때도 같은 셋을 돌린다: 전수검수_판.py(원본 나란히 · 8장 움직임 띠) → 전수검수_얼굴.py(배역별 얼굴 조각, 자리로 나눔) → 전수검수_얼굴판.py <배역> [무리.json].
# 「다 비침」 배역별 얼굴 조각 — 최종 화면(자막 없는 화면.mp4)에서 컷마다 25 · 50 · 75% 세 장의 얼굴을 잘라
# 배역(태준 · 유나 · 민재)에 나눠 담는다. 배역 나눔은 기계 닮음(승인 유호 세트 · 확정 유나 정지컷 · 민재 정지컷) + 컷별 등장 인물 표로.
# 결과: 얼굴/조각/<배역>_<컷>.jpg (컷마다 가장 큰 조각) + 얼굴/조각.json
import os, sys, json, subprocess
import numpy as np, cv2

S = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance/검수/전수_20261107"
sys.path.insert(0, "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/romance-short-20261030")
M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.6, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def faces(img):
    FD.setInputSize((img.shape[1], img.shape[0]))
    r = FD.detect(img)[1]
    if r is None:
        return []
    out = []
    for f in sorted(r, key=lambda b: -b[2] * b[3]):
        if f[3] < 40:
            continue
        out.append((f, FR.feature(FR.alignCrop(img, f))))
    return out


def sim(a, b):
    return float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


FS = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40/기준그림/얼굴세트"
ST = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance/선버스트/정지컷"


def refs(paths):
    out = []
    for p in paths:
        im = read(p)
        if im is None:
            continue
        s = 1600 / max(im.shape[:2])
        im = cv2.resize(im, None, fx=s, fy=s)
        fs = faces(im)
        if fs:
            out.append(fs[0][1])
    return out


TJ = refs([os.path.join(FS, n) for n in ("B_face_only.png", "C_face_only.png", "ref_Bface.png", "ref_Cface.png", "ref_pro02_face.png")])
YN = refs([os.path.join(ST, "C02.jpg"), os.path.join(ST, "C04.jpg")])
# 민재: C14e 정지컷(크게 나온 민재) — 태준과 함께라 두 얼굴 중 태준 세트와 덜 닮은 쪽
mj = []
for c in ("C14e", "C17"):
    im = read(os.path.join(ST, c + ".jpg"))
    fs = faces(im)
    if len(fs) >= 2:
        fs2 = sorted(fs, key=lambda x: max(sim(x[1], r) for r in TJ))
        mj.append(fs2[0][1])
MJ = mj
print("기준", len(TJ), len(YN), len(MJ), file=sys.stderr)

# 컷마다 배역이 서 있는 자리(화면 가로 0~1, 대조판에서 눈으로 잼) — 자리로 나눈다(기계 닮음은 민재 · 흐린 얼굴에서 틀림)
POS = {
 'C02': {'유나': (0, 1)}, 'C03': {'태준': (0.35, 1)}, 'C04': {'유나': (0, 0.7)}, 'C05': {'태준': (0, 1)},
 'C07': {'태준': (0, 0.47), '민재': (0.47, 1)}, 'C08': {'태준': (0.4, 1)}, 'C09': {'태준': (0, 1)},
 'C11': {'태준': (0, 0.5), '유나': (0.5, 1)}, 'C12': {'태준': (0, 0.5), '유나': (0.5, 1)}, 'C13': {'태준': (0, 1)},
 'C14': {'태준': (0, 0.49), '민재': (0.49, 1)}, 'C16': {'유나': (0.4, 1)}, 'C17': {'태준': (0, 0.5), '민재': (0.5, 1)},
 'C19': {'태준': (0, 0.5), '유나': (0.5, 1)}, 'C20': {'태준': (0, 0.5), '유나': (0.5, 1)},
 'C22': {'태준': (0, 0.55), '유나': (0.55, 1)}, 'C23': {'태준': (0, 0.55), '유나': (0.55, 1)}, 'C24': {'유나': (0, 0.7)},
 'C25': {'태준': (0, 1)}, 'C27': {'유나': (0, 0.5), '태준': (0.5, 1)}, 'C28': {'태준': (0, 1)},
 'C29': {'태준': (0, 0.35), '유나': (0.35, 1)}, 'C31': {'태준': (0, 1)}, 'C34': {'태준': (0, 0.5), '유나': (0.5, 1)},
 'C36': {'유나': (0, 0.8)}, 'C37': {'태준': (0.3, 1)}, 'C38': {'태준': (0, 0.45), '유나': (0.45, 1)}, 'C39': {'태준': (0, 1)},
 'C41': {'태준': (0, 0.52), '민재': (0.52, 1)}, 'C42': {'태준': (0, 0.45), '유나': (0.45, 1)},
 'C43': {'태준': (0, 0.55), '유나': (0.55, 1)}, 'C44': {'유나': (0.35, 1)}, 'C45': {'태준': (0, 0.55), '유나': (0.55, 1)},
 'C47': {'유나': (0.4, 1)}, 'C48': {'태준': (0, 0.62), '민재': (0.62, 1)}, 'C49': {'유나': (0, 0.5), '태준': (0.5, 1)},
 'C50': {'태준': (0, 0.58), '유나': (0.58, 1)}, 'C51': {'태준': (0, 0.6), '유나': (0.6, 1)}, 'C52': {'태준': (0, 1)},
 'C53': {'태준': (0, 0.5), '유나': (0.5, 1)}, 'C54': {'유나': (0, 1)}, 'C55': {'태준': (0.4, 1)}, 'C57': {'유나': (0, 0.75)},
 'C58': {'태준': (0.3, 1)}, 'C59': {'유나': (0, 1)}, 'C60': {'태준': (0, 1)}, 'C61': {'유나': (0, 0.75)},
 'C62': {'태준': (0, 0.72), '유나': (0.72, 1)}, 'C63': {'태준': (0, 1)}, 'C66': {'태준': (0, 1)}, 'C68': {'태준': (0, 1)}, 'C70': {'태준': (0, 1)},
}

import 최종편집 as E

V = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/rs/화면.mp4"
want = {}
for i, name in enumerate(E.NAMES):
    a, b = E.F[i], E.F[i + 1] - 1
    for k, fr in enumerate((a + (b - a) // 4, (a + b) // 2, b - (b - a) // 4)):
        want.setdefault(fr, []).append((name, k))
W, H = 1920, 1080
pr = subprocess.Popen(["ffmpeg", "-v", "error", "-i", V, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
OUT = os.path.join(S, "얼굴", "조각")
import shutil
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
best = {}   # (cut, role) -> (h, score, crop, k)
n = 0
while True:
    buf = pr.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        break
    if n in want:
        img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        for (name, k) in want[n]:
            pos = POS.get(name)
            if not pos:
                continue
            for (f, feat) in faces(img):
                sc = {"태준": max(sim(feat, r) for r in TJ), "유나": max(sim(feat, r) for r in YN),
                      "민재": max([sim(feat, r) for r in MJ] or [-1])}
                x0, y0, w, h = [int(v) for v in f[:4]]
                cxn = (x0 + w / 2) / W
                role = next((r for r, (a, b) in pos.items() if a <= cxn < b), None)
                if role is None:
                    continue
                key = (name, role)
                if key in best and best[key][0] >= h:
                    continue
                pad = int(h * 0.45)
                cx, cy = x0 + w // 2, y0 + h // 2
                half = h // 2 + pad
                crop = img[max(0, cy - half - int(h * 0.1)):cy + half, max(0, cx - half):cx + half]
                if crop.size == 0:
                    continue
                crop = cv2.resize(crop, (240, int(240 * crop.shape[0] / crop.shape[1])))
                best[key] = (h, round(sc[role], 3), crop, k)
    n += 1
pr.wait()
meta = {}
for (name, role), (h, s, crop, k) in best.items():
    cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])[1].tofile(os.path.join(OUT, f"{role}_{name}.jpg"))
    meta[f"{role}_{name}"] = {"얼굴높이": h, "닮음": s, "자리": ["25%", "50%", "75%"][k]}
json.dump(meta, open(os.path.join(S, "얼굴", "조각.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(meta), "조각")
