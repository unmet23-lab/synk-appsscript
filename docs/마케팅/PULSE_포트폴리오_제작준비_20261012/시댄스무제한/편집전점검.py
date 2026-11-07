# 편집 전에 받은 판 점검(2026-11-07, 블프 두 편) — 판마다 한 장 보기(0.5초 간격 띠)와 카메라 · 움직임 · 얼굴 숫자를 한 번에 낸다.
# 재기.py는 판 전체의 처음 ↔ 끝 값만 내서, 쓰는 구간 안에서 멈췄는지 · 카메라가 언제 움직였는지를 못 본다(한강 11-06 「대화 컷 64판 중 17판이 멈춤」).
#   python -X utf8 편집전점검.py <묶음 이름> <판 id…> [--한줄 N]   → 받음/_편집전점검/<묶음>_띠_<k>.jpg · <묶음>.json · 표
# 숫자(0.25초마다, 첫 장 기준 누적):
#   카메라 — 이웃 장(3장 간격) SIFT 맞춤(estimateAffinePartial2D · RANSAC 2px)을 쌓은 배율 · 옆 · 위아래(화면 %) — 재기.py와 같은 길
#   움직임 — 0.25초 사이 작은 회색 장의 평균 차이(0~255). 0.6 아래가 이어지면 「멈춤」으로 본다
#   얼굴 — 가장 큰 얼굴(YuNet)의 가운데 x · 높이(화면 몫) · 얼굴 왼쪽 반과 오른쪽 반 밝기 차(평평한 빛이면 작다, 로맨스 11-05 잣대 0.131 ↔ 0.289)
#   사람 — 카메라 움직임을 걷어 낸 사람 자리의 움직임(장당 px, 480폭 — 사람움직임.py). 판 전체 값과 1초 창(0.5초씩)마다 값, 0.12 아래는 「!」 —
#          「움직임」만 보면 카메라가 움직이는 판의 굳은 사람이 통과한다(11-07 유호님 「카메라 구도는 괜찮은데 왜 모델이 그냥 굳어있는것같지?」).
#          고를 때 무늬를 숨기려고 사람이 덜 움직이는 구간을 고르지 않는다 — 굳은 판은 연기 박자를 고친 지시문으로 다시 낸다
# 고치지 않는다 — 숫자와 띠를 보고 편집 시작점 · 다시 뽑을 판을 정한다.
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import 사람움직임

GOT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
OUT = os.path.join(GOT, "_편집전점검")
MOD = os.path.join(os.path.expanduser("~"), ".rembg", "models", "yunet")
STEP = 0.25
SIFT = cv2.SIFT_create(nfeatures=2000)
BF = cv2.BFMatcher()
FD = cv2.FaceDetectorYN.create(os.path.join(MOD, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.7, 0.3, 5000)


def frames(path, long=720):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True)
    w, h = (int(x) for x in r.stdout.strip().split(",")[:2])
    s = long / max(w, h)
    W, H = int(round(w * s / 2) * 2), int(round(h * s / 2) * 2)
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-fps_mode", "passthrough", "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    a = np.frombuffer(r.stdout, np.uint8)
    n = a.size // (W * H * 3)
    return a[:n * W * H * 3].reshape(n, H, W, 3)


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
    M, _ = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    return M


def face(img):
    h, w = img.shape[:2]
    FD.setInputSize((w, h))
    _, fs = FD.detect(img)
    if fs is None or not len(fs):
        return None
    x, y, fw, fh = max(fs, key=lambda f: f[2] * f[3])[:4]
    x0, y0, x1, y1 = int(max(0, x)), int(max(0, y)), int(min(w, x + fw)), int(min(h, y + fh))
    g = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY).astype(np.float32)
    if g.size < 64:
        return None
    half = g.shape[1] // 2
    lr = abs(float(g[:, :half].mean()) - float(g[:, half:].mean())) / max(1.0, float(g.mean()))
    return {"x": round(float((x + fw / 2) / w), 3), "h": round(float(fh / h), 3), "lr": round(lr, 3)}


def measure(pid, fps=24):
    f = frames(os.path.join(GOT, pid + ".mp4"))
    n = len(f)
    k = max(1, round(STEP * fps))
    T = np.eye(3)
    rows = []
    small = [cv2.resize(cv2.cvtColor(x, cv2.COLOR_BGR2GRAY), (96, 96)).astype(np.float32) for x in f]
    for i in range(0, n, k):
        if i:
            M = affine(f[i - k], f[i])
            if M is not None:
                T = np.vstack([M, [0, 0, 1]]) @ T
            move = float(np.mean(np.abs(small[i] - small[i - k])))
        else:
            move = 0.0
        h, w = f[0].shape[:2]
        cx, cy = w / 2, h / 2
        nx, ny = T[0, 0] * cx + T[0, 1] * cy + T[0, 2], T[1, 0] * cx + T[1, 1] * cy + T[1, 2]
        rows.append({"t": round(i / fps, 2), "배율": round(math.hypot(T[0, 0], T[1, 0]), 3), "옆": round(100 * (nx - cx) / w, 1), "위아래": round(100 * (ny - cy) / h, 1),
                     "움직임": round(move, 2), "얼굴": face(f[i])})
    return f, rows


def strip(f, fps=24, every=0.5, th=None):
    h, w = f[0].shape[:2]
    th = th or (240 if h > w else 150)   # 가로 판은 낮게 — 한 줄이 너무 넓으면 보기에서 줄어 안 보인다
    tw = int(round(w * th / h))
    picks = [min(len(f) - 1, round(t * fps)) for t in np.arange(0, len(f) / fps, every)]
    cells = []
    for i in picks:
        c = cv2.resize(f[i], (tw, th), interpolation=cv2.INTER_AREA)
        cv2.putText(c, f"{i / fps:.2f}", (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 3)
        cv2.putText(c, f"{i / fps:.2f}", (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cells.append(c)
    return np.hstack(cells)


def main():
    a = sys.argv[1:]
    per = 6
    if "--한줄" in a:
        i = a.index("--한줄")
        per = int(a[i + 1])
        del a[i:i + 2]
    name, pids = a[0], a[1:]
    os.makedirs(OUT, exist_ok=True)
    allrows, strips = {}, []
    for pid in pids:
        f, rows = measure(pid)
        allrows[pid] = rows
        s = strip(f)
        lab = np.zeros((26, s.shape[1], 3), np.uint8)
        cv2.putText(lab, pid, (6, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        strips.append(np.vstack([lab, s]))
        fz = [r["t"] for r in rows[1:] if r["움직임"] < 0.6]
        fc = [r["얼굴"] for r in rows if r["얼굴"]]
        # 사람 움직임(사람움직임.py — 카메라를 걷어 낸 나머지). 「움직임」은 카메라가 움직이면 굳은 사람도 크게 나와 못 잡는다(11-07 유호님 「모델이 굳어 있다」)
        ps = 사람움직임.pairs(os.path.join(GOT, pid + ".mp4"))
        whole = 사람움직임.summary(ps)
        allrows[pid] = {"0.25초": rows, "사람": whole, "사람 창": 사람움직임.windows(ps)}
        print(f"{pid}: {len(f)}장 · 끝 배율 {rows[-1]['배율']} 옆 {rows[-1]['옆']} 위아래 {rows[-1]['위아래']} · 움직임 중앙 {np.median([r['움직임'] for r in rows[1:]]):.2f}"
              + (f" · 멈춤 {fz}" if fz else "") + (f" · 얼굴 x {np.median([c['x'] for c in fc]):.2f} 높이 {np.median([c['h'] for c in fc]):.2f} 좌우빛 {np.median([c['lr'] for c in fc]):.2f}" if fc else "")
              + (f" · 사람 {whole['사람']:.2f}(카메라 {whole['카메라']:.2f}){' · ' + whole['판정'] if whole['판정'] != '-' else ''}" if whole else ""))
        print("   " + " ".join(f"{r['t']:.2f}:{r['배율']:.3f}/{r['옆']:+.1f}/{r['위아래']:+.1f}/{r['움직임']:.1f}" for r in rows))
        print("   사람 1초 창: " + " ".join(f"{t:.1f}:{p:.2f}{'!' if v != '-' else ''}" for t, c, p, v in allrows[pid]["사람 창"]))
    json.dump(allrows, open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    wmax = max(s.shape[1] for s in strips)
    strips = [np.hstack([s, np.zeros((s.shape[0], wmax - s.shape[1], 3), np.uint8)]) if s.shape[1] < wmax else s for s in strips]
    for k in range(0, len(strips), per):
        p = os.path.join(OUT, f"{name}_띠_{k // per + 1}.jpg")
        cv2.imencode(".jpg", np.vstack(strips[k:k + per]), [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(p)
        print(p)


if __name__ == "__main__":
    main()
