# 2번 원본(git 밖 원본 영상) 카메라 기법을 컷마다 프레임으로 잰다 — 10-26 밤 유호님 「원본이랑 카메라 기법도 완전히 똑같게」(9번 세션 전달).
# 컷마다 「움직이지 않는 기준 자리」(무대 끝선 · 얼음벽 · 제품 · 빛 자리 — 사람 · 물 · 안개가 아닌 곳, ROI 표)의 특징점 흐름으로
# 프레임마다 닮음 변환(이동 · 배율 · 회전)을 재고, 쌓아서 길(곡선)을 만든다 → 움직임 크기 · 방향 · 시작 · 멈춤 · 빨라짐/느려짐 · 흔들림.
# 기준 자리 안의 선명도(라플라시안 분산)로 초점이 흐려지거나 맞아 가는지도 본다(빠른 움직임의 흔들림 흐림과 같이 읽는다).
# 1판(화면 전체)은 사람 · 물을 따라가 4 · 5 · 8 · 13번 숫자가 틀렸다 — 2판부터 기준 자리만.
#   python -I -X utf8 원본카메라_재기.py   → git 밖 레퍼런스/p2/원본실측/YSL아이스_yi_Fjg4OLJA/카메라_프레임.json · 카메라_요약.txt
import json
import os

import cv2
import numpy as np

R = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "레퍼런스", "p2")
M = os.path.join(R, "원본실측", "YSL아이스_yi_Fjg4OLJA")
VIDEO = os.path.join(R, "원본영상", "hq_yi_Fjg4OLJA", "hq_yi_Fjg4OLJA_h264.mp4")
shots = json.load(open(os.path.join(M, "원본_샷.json"), encoding="utf-8"))["shots"]
W = 640
# 기준 자리(화면 비율 x0, y0, x1, y1 — 여럿이면 합친다)와 그 자리가 무엇인지. None은 잴 기준이 없음(물 · 안개만 있는 컷)
ROI = {
    1: ([(0, 0.52, 0.48, 0.80), (0.70, 0.52, 1, 0.80), (0, 0, 1, 0.45)], "무대 끝선 · 빛줄기(사람 빼고)"),
    2: ([(0.25, 0.30, 0.80, 0.85)], "병 라벨 · 병 몸통"),
    3: ([(0.18, 0.0, 0.62, 0.95)], "얼음 덩이 · 병"),
    4: ([(0.40, 0.0, 1.0, 0.32)], "뒤 빛 자리(어깨 · 팔 빼고)"),
    5: ([(0, 0, 0.22, 0.30), (0.78, 0, 1, 0.30)], "위 양쪽 빛줄기(사람 빼고)"),
    6: ([(0, 0, 1, 1)], "얼음 조각 전체"),
    7: ([(0, 0, 0.30, 1), (0.70, 0, 1, 1)], "양옆 얼음벽(물줄기 빼고)"),
    8: (None, "물만 있음 — 카메라 기준 없음"),
    9: ([(0.30, 0.10, 0.85, 0.75)], "뚜껑(물 빼고)"),
    10: ([(0.28, 0.02, 0.75, 0.98)], "얼음 조각"),
    11: ([(0.05, 0.0, 0.95, 1.0)], "얼음 덩이"),
    12: ([(0.10, 0.45, 0.62, 1.0)], "가슴 · 목걸이(사람이 함께 움직임)"),
    13: (None, "안개만 있음 — 카메라 기준 없음"),
    14: ([(0.10, 0.0, 1.0, 1.0)], "잎(식물이 함께 돌 수 있음)"),
    15: ([(0, 0, 1, 1)], "잎"),
    16: ([(0.20, 0.0, 0.80, 1.0)], "얼굴(고개를 돌림 — 사람이 함께 움직임)"),
    17: ([(0.05, 0.0, 0.95, 1.0)], "병"),
    18: ([(0, 0, 0.55, 1.0)], "병"),
}

cap = cv2.VideoCapture(VIDEO)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    frames.append(cv2.resize(g, (W, int(g.shape[0] * W / g.shape[1])), interpolation=cv2.INTER_AREA))
H = frames[0].shape[0]


def mask_of(rects):
    m = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in rects:
        m[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 255
    return m


def step(a, b, mask):
    """a → b 닮음 변환(기준 자리 특징점만): (dx%, dy%, 배율, 회전°, 믿음)."""
    p = cv2.goodFeaturesToTrack(a, 300, 0.01, 7, mask=mask)
    if p is None or len(p) < 10:
        return None
    q, st, _ = cv2.calcOpticalFlowPyrLK(a, b, p, None, winSize=(21, 21), maxLevel=3)
    ok = st.ravel() == 1
    if ok.sum() < 10:
        return None
    m, inl = cv2.estimateAffinePartial2D(p[ok], q[ok], method=cv2.RANSAC, ransacReprojThreshold=1.0)
    if m is None:
        return None
    s = float(np.hypot(m[0, 0], m[1, 0]))
    rot = float(np.degrees(np.arctan2(m[1, 0], m[0, 0])))
    c = np.array([W / 2, H / 2])
    moved = m[:, :2] @ c + m[:, 2]
    dx, dy = (moved - c) / W * 100
    return float(dx), float(dy), s, rot, float(inl.sum() / max(1, len(p)))


def shape_of(speed):
    """속도 곡선 → 시작 · 멈춤(최대의 20%를 넘는 첫 · 마지막 프레임 비율)과 모양."""
    if len(speed) < 3 or speed.max() <= 0:
        return None, None, "잴 수 없음"
    sm = np.convolve(speed, np.ones(3) / 3, "same")
    on = np.where(sm > 0.2 * sm.max())[0]
    t0, t1 = on[0] / len(sm), (on[-1] + 1) / len(sm)
    a, b, c = [float(x.mean()) for x in np.array_split(sm, 3)]
    if max(a, b, c) < 1e-6:
        kind = "멈춤"
    elif a > 1.35 * c and a >= b * 0.9:
        kind = "처음 빠르고 점점 느려짐"
    elif c > 1.35 * a and c >= b * 0.9:
        kind = "점점 빨라짐"
    elif b > 1.3 * a and b > 1.3 * c:
        kind = "가운데가 빠름(천천히 시작 · 천천히 멈춤)"
    else:
        kind = "고른 속도"
    return round(t0, 2), round(t1, 2), kind


res, lines = [], []
for sh in shots:
    n = sh["n"]
    a, b = int(round(sh["start"] * fps)), min(len(frames), int(round(sh["end"] * fps)))
    rects, what = ROI[n]
    item = {"n": n, "start": sh["start"], "end": sh["end"], "기준": what}
    if rects is None:
        item["잴 수 없음"] = True
        res.append(item)
        lines.append(f"{n:>2} {sh['start']:5.2f}–{sh['end']:5.2f} {what}")
        continue
    mask = mask_of(rects)
    st = [step(frames[k], frames[k + 1], mask) for k in range(a, b - 1)]
    good = [x for x in st if x is not None]
    if len(good) < 2:
        item["잴 수 없음"] = True
        res.append(item)
        lines.append(f"{n:>2} {sh['start']:5.2f}–{sh['end']:5.2f} {what} — 특징점 부족")
        continue
    dx = np.array([x[0] if x else 0.0 for x in st]); dy = np.array([x[1] if x else 0.0 for x in st])
    sc = np.array([x[2] if x else 1.0 for x in st]); ro = np.array([x[3] if x else 0.0 for x in st])
    trust = float(np.mean([x[4] for x in good]))
    cum_s = np.cumprod(sc); cum_x = np.cumsum(dx); cum_y = np.cumsum(dy); cum_r = np.cumsum(ro)
    k5 = np.ones(5) / 5
    jit = float(np.sqrt(np.mean((dx - np.convolve(dx, k5, "same"))[2:-2] ** 2 + (dy - np.convolve(dy, k5, "same"))[2:-2] ** 2))) if len(dx) >= 9 else 0.0
    zoom_speed = np.abs(np.log(sc)) * 100
    pan_speed = np.hypot(dx, dy)
    t0, t1, kind = shape_of(zoom_speed + pan_speed + np.abs(ro))
    sharp = np.array([cv2.Laplacian(frames[k], cv2.CV_64F)[mask > 0].var() for k in range(a, b)])
    sr = sharp / max(sharp[0], 1e-6)
    item.update({"믿음": round(trust, 2), "배율": round(float(cum_s[-1]), 3), "이동_x%": round(float(cum_x[-1]), 1), "이동_y%": round(float(cum_y[-1]), 1),
                 "회전°": round(float(cum_r[-1]), 1), "흔들림_rms%": round(jit, 3), "시작": t0, "멈춤": t1, "모양": kind,
                 "배율_곡선": [round(float(v), 4) for v in cum_s], "x_곡선": [round(float(v), 2) for v in cum_x], "y_곡선": [round(float(v), 2) for v in cum_y],
                 "회전_곡선": [round(float(v), 2) for v in cum_r], "선명_비": [round(float(v), 3) for v in sr]})
    res.append(item)
    third = [round(float(cum_s[min(len(cum_s) - 1, int(len(cum_s) * f))]), 3) for f in (1 / 3, 2 / 3)]
    lines.append(f"{n:>2} {sh['start']:5.2f}–{sh['end']:5.2f} [{what}] 믿음 {trust:.2f} | 배율 {cum_s[-1]:.3f}(1/3 {third[0]} · 2/3 {third[1]}) · x {cum_x[-1]:+.1f}% · y {cum_y[-1]:+.1f}% · 회전 {cum_r[-1]:+.1f}° | "
                 f"움직임 {t0}~{t1} · {kind} | 흔들림 {jit:.3f}% | 선명 처음→끝 ×{sr[-1]:.2f} (가장 낮음 ×{sr.min():.2f} · 가장 높음 ×{sr.max():.2f})")
json.dump({"src": VIDEO, "fps": fps, "W": W, "shots": res}, open(os.path.join(M, "카메라_프레임.json"), "w", encoding="utf-8"), ensure_ascii=False)
open(os.path.join(M, "카메라_요약.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))
