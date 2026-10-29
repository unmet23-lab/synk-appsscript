# 드라마 말하기 1화 웹툰 시안의 얼굴 닮음(2026-10-30) — 기획 §6 · 장부 S21 「칸마다 같은 얼굴 검사」를 숫자로.
# OpenCV YuNet(얼굴 찾기) + SFace(얼굴 특징, 코사인 닮음). 실사 기준선 0.363(SFace 안내값)은 그림에 그대로 맞지 않아서,
# 같은 화풍의 「다른 인물」 점수(교수 시트 ↔ 선배 시트)를 기준선으로 함께 재고, 칸 얼굴이 기준선보다 얼마나 위인지를 본다.
#   python -X utf8 닮음.py <작업> [교수안 선배안]     (기본 1 1 — 칸을 구울 때 참고로 넣은 시트)
#   → 표 출력 · <작업>/닮음.json · <작업>/보드/얼굴_교수.jpg · 얼굴_선배.jpg(시트 얼굴 | 칸 얼굴을 한 줄로)
# 모델은 영문 경로 사본(%USERPROFILE%/.rembg/models/yunet/ — OpenCV가 한글 경로의 ONNX를 못 읽는다, 현장노트 gemini_사진).
import glob
import json
import os
import sys

import cv2
import numpy as np

M = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet")
# 찾기 문턱 0.55 — 시트 뒷모습의 뒤통수가 0.53으로 잡혔다(10-30 실측). 큰 얼굴 상자 안에 든 작은 상자(귀 · 연필)도 뺀다.
FD = cv2.FaceDetectorYN.create(os.path.join(M, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.55, 0.3, 5000)
FR = cv2.FaceRecognizerSF.create(os.path.join(M, "face_recognition_sface_2021dec.onnx"), "")
MIN_FACE = 40   # 이보다 작은 얼굴(넓은 칸의 먼 사람)은 닮음을 재지 않는다
SMALL_FACE = 80  # SFace 입력(112px)의 70% 아래 — 값이 흔들려 「작음」으로 표시만 한다(10-30 Fable 검수)


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def faces(img):
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    r = FD.detect(img)[1]
    found = [f for f in (r if r is not None else []) if f[2] >= MIN_FACE]

    def inside(a, b):   # a의 가운데가 더 큰 b 안에 있나
        cx, cy = a[0] + a[2] / 2, a[1] + a[3] / 2
        return b[2] > a[2] and b[0] <= cx <= b[0] + b[2] and b[1] <= cy <= b[1] + b[3]

    out = []
    for f in found:
        if any(inside(f, g) for g in found if g is not f):
            continue
        x, y, fw, fh = [int(v) for v in f[:4]]
        out.append({"box": [x, y, fw, fh], "score": round(float(f[14]), 3), "feat": FR.feature(FR.alignCrop(img, f))})
    return sorted(out, key=lambda d: d["box"][0])


def cos(a, b):
    return float(FR.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def mean_sim(f, refs):
    return round(float(np.mean([cos(f, g) for g in refs])), 3) if refs else None


def crop(img, box, size=220):
    x, y, w, h = box
    m = int(max(w, h) * 0.45)
    x0, y0 = max(0, x - m), max(0, y - m)
    x1, y1 = min(img.shape[1], x + w + m), min(img.shape[0], y + h + m)
    c = img[y0:y1, x0:x1]
    s = size / max(c.shape[:2])
    c = cv2.resize(c, (max(1, int(c.shape[1] * s)), max(1, int(c.shape[0] * s))))
    pad = np.full((size, size, 3), 245, np.uint8)
    pad[: c.shape[0], : c.shape[1]] = c
    return pad


def label(tile, text):
    t = tile.copy()
    cv2.rectangle(t, (0, t.shape[0] - 24), (t.shape[1], t.shape[0]), (30, 30, 30), -1)
    cv2.putText(t, text, (6, t.shape[0] - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    return t


if __name__ == "__main__":
    work = sys.argv[1]
    want = {"prof": int(sys.argv[2]) if len(sys.argv) > 2 else 1, "senior": int(sys.argv[3]) if len(sys.argv) > 3 else 1}
    got = os.path.join(work, "받음")
    sheets = {}
    for p in sorted(glob.glob(os.path.join(got, "sheet-*.png"))):
        sid = os.path.basename(p)[:-4]
        img = read(p)
        fl = faces(img)
        # 시트 뒷모습의 뒤통수가 0.6 넘게 잡힐 때가 있다(10-30 선배 안 3 — 나머지 얼굴과 0.23) → 나머지와 평균 0.35 아래로만 닮은 얼굴은 뺀다
        if len(fl) > 2:
            fl = [f for i, f in enumerate(fl) if np.mean([cos(f["feat"], g["feat"]) for j, g in enumerate(fl) if j != i]) >= 0.35]
        sheets[sid] = {"img": img, "faces": fl}
    report = {"시트": {}, "칸": {}, "기준선": {}}
    for sid, s in sheets.items():
        fs = [d["feat"] for d in s["faces"]]
        pair = [cos(fs[i], fs[j]) for i in range(len(fs)) for j in range(i + 1, len(fs))]
        report["시트"][sid] = {"얼굴": len(fs), "안끼리평균": round(float(np.mean(pair)), 3) if pair else None,
                              "점수": [d["score"] for d in s["faces"]], "크기": [d["box"][2] for d in s["faces"]]}
    # 기준선: 교수 시트 얼굴 ↔ 선배 시트 얼굴(같은 화풍의 다른 사람)
    prof_all = [d["feat"] for k, s in sheets.items() if k.startswith("sheet-prof") for d in s["faces"]]
    sen_all = [d["feat"] for k, s in sheets.items() if k.startswith("sheet-senior") for d in s["faces"]]
    cross = [cos(a, b) for a in prof_all for b in sen_all]
    report["기준선"]["교수시트-선배시트"] = round(float(np.mean(cross)), 3) if cross else None
    report["기준선"]["가장높은교차"] = round(float(np.max(cross)), 3) if cross else None
    # 참고 얼굴: 시트 얼굴 + 좌우 뒤집은 시트의 얼굴(칸에는 시트와 반대쪽으로 돈 얼굴이 많다 — 10-30 Fable 검수). 기준선 표는 뒤집지 않은 것만.
    refs = {k: [d["feat"] for d in s["faces"]] + [d["feat"] for d in faces(cv2.flip(s["img"], 1))] for k, s in sheets.items()}
    tiles = {"prof": [], "senior": []}
    for k in ("prof", "senior"):
        sid = f"sheet-{k}-{want[k]}"
        if sid in sheets:
            for i, d in enumerate(sheets[sid]["faces"]):
                tiles[k].append(label(crop(sheets[sid]["img"], d["box"]), f"sheet {i + 1}"))
    # 칸마다 나오는 인물(칸 1 · 12 · 14 = 선배, 4 · 8 = 교수). 가장 큰 얼굴을 그 인물로 보고, 나머지는 배경 사람으로 따로 적는다.
    who = {"01": "senior", "04": "prof", "08": "prof", "12": "senior", "14": "senior"}
    for p in sorted(glob.glob(os.path.join(got, "panel-*.png"))):
        pid = os.path.basename(p)[:-4]
        k = who.get(pid.split("-")[1])
        img = read(p)
        fl = faces(img)
        rows = []
        main = max(fl, key=lambda d: d["box"][2]) if fl else None
        for d in fl:
            sc = {sid: mean_sim(d["feat"], fs) for sid, fs in refs.items()}
            best = max(sc, key=lambda s: sc[s] if sc[s] is not None else -9)
            row = {"상자": d["box"], "찾기점수": d["score"], "닮음": sc, "가장닮은시트": best, "인물": (k if d is main else "배경"),
                   "작음": d["box"][2] < SMALL_FACE}
            if d is main and k:
                same_role = {s: v for s, v in sc.items() if s.startswith(f"sheet-{k}-")}
                mine = same_role.get(f"sheet-{k}-{want[k]}")
                others = [v for s, v in same_role.items() if s != f"sheet-{k}-{want[k]}"]
                row["기준시트"] = mine
                row["같은역다른안최고"] = max(others) if others else None
                tiles[k].append(label(crop(img, d["box"]), f"{pid[6:]} {mine:.2f}{'*' if row['작음'] else ''}"))
            rows.append(row)
        report["칸"][pid] = rows
    os.makedirs(os.path.join(work, "보드"), exist_ok=True)
    for k, ts in tiles.items():
        if ts:
            board = np.hstack(ts)
            cv2.imencode(".jpg", board, [cv2.IMWRITE_JPEG_QUALITY, 90])[1].tofile(os.path.join(work, "보드", f"얼굴_{'교수' if k == 'prof' else '선배'}.jpg"))
    json.dump(report, open(os.path.join(work, "닮음.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("시트:", {k: (v["얼굴"], v["안끼리평균"]) for k, v in report["시트"].items()})
    print("기준선(교수 시트 ↔ 선배 시트):", report["기준선"])
    for pid, rows in report["칸"].items():
        for r in rows:
            if r["인물"] == "배경":
                print(f"{pid}  배경 사람 {r['상자'][2]}px · 가장 닮은 {r['가장닮은시트']} {r['닮음'][r['가장닮은시트']]}")
            else:
                print(f"{pid}  {r['인물']} {r['상자'][2]}px{'(작음)' if r['작음'] else ''} · 기준 시트 {r.get('기준시트')} · 같은 역 다른 안 최고 {r.get('같은역다른안최고')} · 가장 닮은 {r['가장닮은시트']}")
        if not rows:
            print(pid, "얼굴 못 찾음(또는 40px 아래)")
