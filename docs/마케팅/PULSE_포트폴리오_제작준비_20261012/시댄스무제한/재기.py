# 시댄스 2.5 무제한 날 — 받은 판을 먼저 재서 검수한다(2026-10-29). 재기만 하고 고치지 않는다(후보정 없음 — 틀린 판은 지시문을 고쳐 다시 낸다).
#   python -X utf8 재기.py [<판 id…>]          → 받음/_검수/<판>.jpg(얼굴 띠) · 받음/_검수/_재기.json · 한 줄 표
#   python -X utf8 재기.py --클립 <mp4> <판 id>  → 아무 클립이나 그 판의 그림 · 지시문과 견준다(시험용)
# 받기.py가 받은 받음/<판>.mp4(다시 낸 판은 <판>__2.mp4)를 웹올리기 · 웹올리기_둘째날(7번)/<폴더>의 그림 · 지시문과 견준다:
#   첫 장 — 첫 장이 시작 그림과 같은가(작게 줄인 Lab 평균 차이 · 구도가 같으면 작다). 끝 그림 판은 끝 장도, 두 샷 판은 컷 뒤 첫 장을 @이미지 2와.
#   컷 — 이웃 장의 색 분포(HSV 히스토그램)가 크게 바뀐 곳. 한 샷 판은 0이어야, 두 샷 판은 지시문 「ONE hard cut at N s」 근처에 하나.
#   카메라 — 샷마다 0.2초 간격으로 SIFT 특징점 맞춤(estimateAffinePartial2D · RANSAC 2px, 현장노트 영상 「위상 상관으로 재면 다가가는 컷을
#     고정으로 적는다」의 고침)을 쌓아 배율 · 이동(화면 %) · 회전을 낸다. CAMERA 줄이 고정이면 배율 3% · 이동 3% · 회전 1.5°를 넘을 때,
#     다가감이면 배율이 1.02보다 작을 때 알린다(글로 적은 나머지 움직임은 숫자와 그림을 눈으로 본다).
#   얼굴 — 시작 그림에서 가장 큰 얼굴(YuNet)을 기준으로 0.33초마다 가장 큰 얼굴의 닮음(SFace 코사인, 같은 사람 기준선 0.363).
#   급한 변화 — 컷이 아닌데 이웃 장 차이가 그 판 중앙값의 6배를 넘는 곳, 같은 장이 이어지는 멈춤.
# 숫자는 거르기용이다 — 얼굴 띠 그림을 눈으로 보고 옷 · 소품 · 사라짐을 본다(굽기 시트 「받은 뒤 다시 볼 것」).
import json, math, os, re, subprocess, sys

import cv2
import numpy as np

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
WEBS, GOT = [os.path.join(DAY, d) for d in ("웹올리기", "웹올리기_둘째날", "웹올리기_7번비교", "웹올리기_프리비즈")], os.path.join(DAY, "받음")
OUT = os.path.join(GOT, "_검수")
MOD = os.path.join(os.path.expanduser("~"), ".rembg", "models", "yunet")
SAME = 0.363
LONG = 960   # 재는 장의 긴 변
STRIP_H = 220
SIFT = cv2.SIFT_create(nfeatures=2500)
BF = cv2.BFMatcher()
FD = cv2.FaceDetectorYN.create(os.path.join(MOD, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.7, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(MOD, "face_recognition_sface_2021dec.onnx"), "")


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate", "-show_entries", "format=duration",
                        "-of", "json", path], capture_output=True, text=True, encoding="utf-8")
    j = json.loads(r.stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    num, den = v["r_frame_rate"].split("/")
    return {"w": int(v["width"]), "h": int(v["height"]), "fps": float(num) / float(den), "dur": float(j["format"]["duration"]),
            "audio": any(s["codec_type"] == "audio" for s in j["streams"])}


def frames(path, w, h):
    s = LONG / max(w, h)
    W, H = int(round(w * s / 2) * 2), int(round(h * s / 2) * 2)
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    a = np.frombuffer(r.stdout, np.uint8)
    n = a.size // (W * H * 3)
    return a[:n * W * H * 3].reshape(n, H, W, 3)


def imread(path, size=None):
    img = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_COLOR)
    return cv2.resize(img, size, interpolation=cv2.INTER_AREA) if size else img


def lab_diff(a, b):
    s = 160 / max(a.shape[:2])
    sz = (int(a.shape[1] * s), int(a.shape[0] * s))
    la = cv2.cvtColor(cv2.resize(a, sz, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2LAB).astype(np.float32)
    lb = cv2.cvtColor(cv2.resize(b, sz, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2LAB).astype(np.float32)
    return float(np.mean(np.linalg.norm(la - lb, axis=2)))


def ssim_gray(a, b):
    # 흐린 회색 SSIM — 현장노트 higgsfield 「얼굴 정지컷에 소리 참고를 같이 주면 첫 화면을 다시 짠다」의 잣대(10-26 2.0은 0.89로 시작 그림대로 남음)
    from skimage.metrics import structural_similarity
    s = 256 / max(a.shape[:2])
    sz = (int(a.shape[1] * s), int(a.shape[0] * s))
    ga = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(a, sz, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (5, 5), 0)
    gb = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(b, sz, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (5, 5), 0)
    return float(structural_similarity(ga, gb))


def hist(f):
    hsv = cv2.cvtColor(cv2.resize(f, (160, 90) if f.shape[1] > f.shape[0] else (90, 160)), cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1], None, [32, 32], [0, 180, 0, 256])
    return cv2.normalize(h, h).flatten()


def affine(a, b):
    ga, gb = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    ka, da = SIFT.detectAndCompute(ga, None)
    kb, db = SIFT.detectAndCompute(gb, None)
    if da is None or db is None or len(ka) < 8 or len(kb) < 8:
        return None
    good = [m for m, n2 in (x for x in BF.knnMatch(da, db, k=2) if len(x) == 2) if m.distance < 0.75 * n2.distance]
    if len(good) < 8:
        return None
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    if M is None:
        return None
    h, w = ga.shape
    cx, cy = w / 2, h / 2
    nx, ny = M[0, 0] * cx + M[0, 1] * cy + M[0, 2], M[1, 0] * cx + M[1, 1] * cy + M[1, 2]
    return {"scale": math.hypot(M[0, 0], M[1, 0]), "dx": 100 * (nx - cx) / w, "dy": 100 * (ny - cy) / h,
            "rot": math.degrees(math.atan2(M[1, 0], M[0, 0])), "inl": int(inl.sum()) if inl is not None else 0}


def biggest_face(img):
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, faces = FD.detect(img)
    if faces is None or not len(faces):
        return None
    f = max(faces, key=lambda r: r[2] * r[3])
    return FR.feature(FR.alignCrop(img, f)), f


def expect(prompt):
    # 두 샷 판은 샷마다 CAMERA가 따로 있다 — 샷 차례대로 낸다. 부정문(no push-in · never zooms)은 지우고 본다.
    cams = re.findall(r"CAMERA:\s*(.+?)(?=\s+(?:LOOK|SHOT \d|ENERGY|SOUND)\b|$)", prompt, flags=re.S)
    if not cams:   # 매진 임박(웹올리기_v5 지시문)은 CAMERA 칸 없이 「Camera, copying the original cut exactly: …」로 글 속에 쓴다
        if re.search(r"camera is locked off", prompt):
            return ["고정"]
        return ["거리 고정"] if re.search(r"never pushes in or zooms|keeps the same distance", prompt) else ["그 밖"]
    out = []
    for cam in cams:
        low = cam.lower()
        pos = re.sub(r"\b(no|never|not|without)\b[^.;,]{0,40}", " ", low)
        if re.search(r"stays exactly where it is|locked off|no movement", low):
            out.append("고정")
        elif re.search(r"almost (static|still)", low):
            out.append("그 밖")   # 피사체가 렌즈 쪽으로 오는 컷(5번 11b)을 다가감으로 읽지 않게
        elif re.search(r"dolly[- ]in|push(es|ing)?[ -]?in\b|\bcloser\b|leans? in\b|creeps? in|walks? toward (him|her)", pos):
            out.append("다가감")
        else:
            out.append("그 밖")
    return out


def measure(clip, board):
    folder = os.path.join(board["꾸러미"], board["폴더"])
    prompt = open(os.path.join(folder, "지시문.txt"), encoding="utf-8").read()
    pics = sorted(f for f in os.listdir(folder) if f.lower().endswith((".jpg", ".png")))
    info = probe(clip)
    fr = frames(clip, info["w"], info["h"])
    n, fps = len(fr), info["fps"]
    H, W = fr.shape[1:3]
    imgs = {p: imread(os.path.join(folder, p), (W, H)) for p in pics}
    # 컷과 급한 변화
    hs = [hist(f) for f in fr]
    d = np.array([1 - cv2.compareHist(hs[i - 1], hs[i], cv2.HISTCMP_CORREL) for i in range(1, n)])
    g = np.array([np.mean(cv2.absdiff(cv2.cvtColor(fr[i - 1], cv2.COLOR_BGR2GRAY), cv2.cvtColor(fr[i], cv2.COLOR_BGR2GRAY))) for i in range(1, n)])
    cut_i = [i + 1 for i in range(len(d)) if d[i] > max(0.35, 10 * float(np.median(d)) + 0.05) and g[i] > 12]
    med = float(np.median(g)) + 0.3
    spikes = [round((i + 1) / fps, 2) for i in range(len(g)) if g[i] > 6 * med and (i + 1) not in cut_i]
    frozen = int(np.sum(g < 0.05))
    m = re.search(r"ONE hard cut at ([\d.]+) s", prompt)
    want_cut = float(m.group(1)) if m else None
    # 샷 나누기와 첫 장
    starts = [0] + cut_i
    shots = []
    cams = expect(prompt)
    for k, a in enumerate(starts):
        b = (starts[k + 1] if k + 1 < len(starts) else n) - 1
        ref = pics[k] if k < len(pics) and (want_cut is not None or k == 0) else None
        row = {"샷": k + 1, "처음": round(a / fps, 2), "끝": round((b + 1) / fps, 2)}
        if ref:
            row["첫장차이"] = round(lab_diff(fr[min(a + 1, b)], imgs[ref]), 1)
            row["첫장SSIM"] = round(ssim_gray(fr[min(a + 1, b)], imgs[ref]), 3)
            row["견준그림"] = ref
        step = max(1, int(round(0.2 * fps)))
        idx = list(range(a + 1, b, step)) + [b]
        sc, dx, dy, rot, weak = 1.0, 0.0, 0.0, 0.0, 0
        for i0, i1 in zip(idx, idx[1:]):
            r = affine(fr[i0], fr[i1])
            if r is None or r["inl"] < 30:
                weak += 1
                continue
            sc *= r["scale"]; dx += r["dx"]; dy += r["dy"]; rot += r["rot"]
        row.update({"배율": round(sc, 3), "옆": round(dx, 1), "위아래": round(dy, 1), "회전": round(rot, 1), "못잰구간": weak})
        want = cams[k] if k < len(cams) else (cams[0] if cams else "그 밖")
        row["지시"] = want
        flag = []
        if want == "고정" and (abs(sc - 1) > 0.03 or abs(dx) > 3 or abs(dy) > 3 or abs(rot) > 1.5):
            flag.append("고정인데 움직임")
        if want == "다가감" and sc < 1.02:
            flag.append("다가감이 거의 없음")
        if want == "거리 고정" and abs(sc - 1) > 0.03:
            flag.append("거리가 바뀜(밀거나 당김)")
        row["알림"] = flag
        shots.append(row)
    end_diff = end_ssim = None
    end_pic = next((p for p in pics if p.startswith("2_끝")), None)
    if end_pic:
        end_diff = round(lab_diff(fr[-1], imgs[end_pic]), 1)
        end_ssim = round(ssim_gray(fr[-1], imgs[end_pic]), 3)
    # 얼굴 띠
    # 기준 얼굴은 잰 장과 같은 크기로 줄인 시작 그림에서 — YuNet은 1920폭 원본의 큰 얼굴을 못 찾는다(10-29 매진 #7 시작 그림)
    ref_face = biggest_face(imgs[pics[0]]) if pics else None
    marks = list(range(0, n, max(1, int(round(fps / 3))))) + [n - 1]
    faces = []
    for i in marks:
        sim = None
        if ref_face is not None:
            got = biggest_face(fr[i])
            if got is not None:
                sim = round(float(FR.match(ref_face[0], got[0], cv2.FaceRecognizerSF_FR_COSINE)), 3)
        faces.append((round(i / fps, 2), sim))
    sims = [s for _, s in faces if s is not None]
    face = None
    if ref_face is not None:
        face = {"가장낮음": min(sims) if sims else None, "그때": next((t for t, s in faces if sims and s == min(sims)), None),
                "평균": round(float(np.mean(sims)), 3) if sims else None, "못찾음": sum(1 for _, s in faces if s is None), "장": len(faces)}
    strip(board["id"], clip, [imgs[p] for p in pics], [(fr[i], t, s) for i, (t, s) in zip(marks, faces)])
    alerts = []
    if want_cut is None and cut_i:
        alerts.append(f"한 샷인데 컷 {[round(i / fps, 2) for i in cut_i]}")
    if want_cut is not None:
        if len(cut_i) != 1:
            alerts.append(f"두 샷인데 컷 {len(cut_i)}개 {[round(i / fps, 2) for i in cut_i]}")
        elif abs(cut_i[0] / fps - want_cut) > 0.5:
            alerts.append(f"컷이 {cut_i[0] / fps:.2f}초(지시 {want_cut:g}초)")
    # 프리비즈 판(id pv…, 팁 장부 36행)은 시작 프레임 칸을 비우고 그림을 생김새 참고로만 준다 — 첫 장 숫자는 남기되 불일치 알림은 내지 않는다
    previz = board["id"].startswith("pv")
    for s in shots:
        alerts += [f"샷{s['샷']} {x}" for x in s["알림"]]
        if not previz and (s.get("첫장SSIM", 1) < 0.8 or s.get("첫장차이", 0) > 15):
            alerts.append(f"샷{s['샷']} 첫 장이 그림과 다름(SSIM {s['첫장SSIM']} · 색 {s['첫장차이']})")
    if end_diff is not None and (end_diff > 15 or end_ssim < 0.8):
        alerts.append(f"끝 장이 끝 그림과 다름(SSIM {end_ssim:.3f} · 색 {end_diff})")
    if face and face["가장낮음"] is not None and face["가장낮음"] < SAME:
        alerts.append(f"얼굴 닮음 {face['가장낮음']}({face['그때']}초)")
    if spikes:
        alerts.append(f"급한 변화 {spikes[:6]}")
    if frozen > 6:   # 정말 고정인 컷은 이웃 장이 거의 같을 수 있다 — 많을 때만 알리고 그림으로 본다
        alerts.append(f"같은 장 {frozen}(고정 컷이면 괜찮음)")
    return {"판": board["id"], "클립": os.path.basename(clip), "길이": round(info["dur"], 2), "fps": round(fps, 2), "크기": f"{info['w']}x{info['h']}",
            "소리": info["audio"], "컷": [round(i / fps, 2) for i in cut_i], "지시컷": want_cut, "샷": shots, "끝장차이": end_diff, "끝장SSIM": end_ssim,
            "얼굴": face, "급한변화": spikes, "멈춘장": frozen, "알림": alerts}


def strip(bid, clip, refs, shots):
    os.makedirs(OUT, exist_ok=True)
    def th(img, label, sub=None, color=(255, 255, 255)):
        s = STRIP_H / img.shape[0]
        t = cv2.resize(img, (int(img.shape[1] * s), STRIP_H), interpolation=cv2.INTER_AREA)
        cv2.rectangle(t, (0, 0), (t.shape[1], 22), (0, 0, 0), -1)
        cv2.putText(t, label, (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
        if sub is not None:
            cv2.putText(t, sub, (4, STRIP_H - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255) if sub.startswith("f") else (0, 0, 255), 1, cv2.LINE_AA)
        return t
    tiles = [th(r, f"REF{i + 1}", None, (120, 255, 120)) for i, r in enumerate(refs)]
    tiles += [th(f, f"{t:.2f}s", ("f" + f"{s:.2f}") if s is not None else None) for f, t, s in shots]
    per = 10
    rows = [tiles[i:i + per] for i in range(0, len(tiles), per)]
    width = max(sum(t.shape[1] for t in r) for r in rows)
    canvas = np.zeros((STRIP_H * len(rows), width, 3), np.uint8)
    for k, r in enumerate(rows):
        x = 0
        for t in r:
            canvas[k * STRIP_H:(k + 1) * STRIP_H, x:x + t.shape[1]] = t
            x += t.shape[1]
    name = os.path.splitext(os.path.basename(clip))[0]
    ok, buf = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 85])
    buf.tofile(os.path.join(OUT, f"{name}.jpg"))


def line(r):
    s = " · ".join(f"샷{x['샷']} {x['지시']} 배율{x['배율']} 옆{x['옆']} 위{x['위아래']} 돎{x['회전']}" + (f" 첫장 SSIM{x['첫장SSIM']} 색{x['첫장차이']}" if "첫장차이" in x else "") for x in r["샷"])
    f = r["얼굴"]
    fs = f" · 얼굴 최저 {f['가장낮음']} 평균 {f['평균']}" if f and f["가장낮음"] is not None else ""
    return f"{r['판']:<14} {r['길이']:>4}초 {s}{fs}" + (f"  ⚠ {' / '.join(r['알림'])}" if r["알림"] else "  ✓")


def main():
    order = {b["id"]: {**b, "꾸러미": web} for web in WEBS if os.path.exists(os.path.join(web, "_순서.json"))
             for b in json.load(open(os.path.join(web, "_순서.json"), encoding="utf-8"))}
    if "--클립" in sys.argv:
        k = sys.argv.index("--클립")
        r = measure(sys.argv[k + 1], order[sys.argv[k + 2]])
        print(line(r))
        print(json.dumps(r, ensure_ascii=False, indent=1))
        return
    want = [a for a in sys.argv[1:] if not a.startswith("--")]
    led = json.load(open(os.path.join(GOT, "_받음.json"), encoding="utf-8")) if os.path.exists(os.path.join(GOT, "_받음.json")) else {}
    res_path = os.path.join(OUT, "_재기.json")
    os.makedirs(OUT, exist_ok=True)
    res = json.load(open(res_path, encoding="utf-8")) if os.path.exists(res_path) else {}
    for v in sorted(led.values(), key=lambda v: (v["순서"], v["파일"])):
        if want and v["판"] not in want:
            continue
        if v["파일"] in res and not want:
            continue
        r = measure(os.path.join(GOT, v["파일"]), order[v["판"]])
        res[v["파일"]] = r
        json.dump(res, open(res_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(line(r), flush=True)


if __name__ == "__main__":
    main()
