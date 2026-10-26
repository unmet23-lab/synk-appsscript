# 6번 원본 카메라 기법 재기(2026-10-26) — 유호님 「원본이랑 카메라 기법도 완전히 똑같게」(9번 세션이 전함, 결정 표 10-26 행).
#   python -X utf8 원본_카메라재기.py   → git 밖 레퍼런스/원본실측/p6_빈방/카메라.json(컷마다 곡선 · 요약), 요약은 화면에도 — 숫자만 01 · 02에 옮긴다
# 이웃 프레임(2프레임 = 0.067초)마다 LK 광류 + estimateAffinePartial2D(RANSAC 1px)로 화면 변환(이동 · 크기 · 돎)을 쌓는다.
#  - 사람이 화면을 크게 채운 컷(19 · 21)과 사람이 크게 움직이는 컷(22)은 전체 화면으로 재면 사람 움직임이 카메라로 읽힌다
#    (처음 판: 19 −2.8% 물러남 · 21 위아래 10% · 22 −1.3% 물러남 — 모두 엄마 움직임). 그래서 컷마다 사람 상자 밖 배경 칸(ROI)만 쓴다.
#  - 「내용」 이동: 화면 속 물체가 움직인 쪽(%). 내용이 왼쪽(−)이면 카메라는 오른쪽으로, 내용이 위(−)면 카메라는 아래로 간 것.
#  - 시작 · 멈춤: 그 축 누적량이 끝 값의 10% · 90%에 닿은 초. 빠르기: 앞 · 가운데 · 뒤 3분의 1의 초당 변화.
#  - 흔들림: 누적 이동에서 0.5초 이동평균을 뺀 나머지의 표준편차(%) — 0.05% 안이면 삼각대 · 달리처럼 매끈, 0.12% 넘으면 손으로 든 흔들림.
#  - 줌인지 달리인지: 거리가 다른 두 물체의 커지는 비율(19번 벽 스위치판 ↔ 가까운 문틀, 20번 앞 책상 ↔ 뒤 벽)이 다르면 카메라가 몸째 움직인 것.
#  - 초점: 선명도 값은 자막 · 끝 문구 글자와 사람 움직임에도 크게 바뀌어(12번 81배 · 22번 왼쪽 25배는 글자 · 불빛) 수로 정하지 않고
#    컷마다 처음 · 가운데 · 끝을 확대해 눈으로 봤다(git 밖 콘티/p6/카메라/ 띠 · 초점 그림).
import json
import os

import cv2
import numpy as np

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024")
SRC = os.path.join(V, "레퍼런스", "원본영상", "hq_tuUKeM5Ocso", "hq_tuUKeM5Ocso.mp4")
OUT = os.path.join(V, "레퍼런스", "원본실측", "p6_빈방")
W, H = 960, 540
FULL = [[0, 0, 1, 1]]
# 우리 15조각이 쓰는 원본 구간(01 샷표, 16번은 우리가 쓰는 마지막 3.5초) — 2 · 17은 검은 글판이라 뺀다. 칸은 (x0, y0, x1, y1) 비율
CUTS = {
    1: ((0.00, 4.77), FULL), 3: ((7.57, 9.94), FULL), 4: ((9.94, 15.48), FULL), 7: ((26.53, 31.70), FULL),
    11: ((39.31, 43.48), FULL), 12: ((43.48, 47.11), FULL), 14: ((51.05, 53.65), FULL), 16: ((62.73, 66.23), FULL),
    18: ((69.64, 72.74), FULL),
    19: ((72.74, 75.74), [[0.0, 0.0, 0.42, 1.0], [0.9, 0.0, 1.0, 1.0]]),   # 엄마(42~90%) 뺀 왼쪽 벽 · 문틀 + 오른쪽 끝
    20: ((75.74, 77.91), FULL),                                               # 빈방 — 사람 없음
    21: ((77.91, 83.35), [[0.0, 0.0, 0.36, 0.62], [0.92, 0.0, 1.0, 0.6]]),   # 머리 · 어깨 뺀 흐린 복도
    22: ((83.35, 91.66), [[0.0, 0.6, 0.27, 1.0]]),                            # 끝 문구 글자(왼쪽 35~55%) 아래 왼쪽 벽
}
# 시차(줌 ↔ 달리) 가르기용 칸
PARALLAX = {20: {"앞 책상": [[0.0, 0.62, 0.45, 1.0]], "뒤 벽 · 창": [[0.3, 0.0, 1.0, 0.45]]},
            19: {"벽 스위치판": [[0.0, 0.42, 0.12, 0.68]], "가까운 문틀": [[0.12, 0.0, 0.32, 1.0]]}}


def track(a, b, rois):
    cap = cv2.VideoCapture(SRC)
    cap.set(cv2.CAP_PROP_POS_MSEC, (a + 0.04) * 1000)
    mask = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in rois:
        mask[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 255
    prev, k, tx, ty, sc, rot = None, 0, 0.0, 0.0, 1.0, 0.0
    curve = []
    while True:
        ok, f = cap.read()
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if not ok or t >= b - 0.04:
            break
        k += 1
        if k % 2:
            continue
        g = cv2.cvtColor(cv2.resize(f, (W, H)), cv2.COLOR_BGR2GRAY)
        if prev is not None:
            p0 = cv2.goodFeaturesToTrack(prev, maxCorners=400, qualityLevel=0.005, minDistance=6, mask=mask)
            m = None
            if p0 is not None and len(p0) >= 8:
                p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, p0, None, winSize=(25, 25), maxLevel=4)
                g0, g1 = p0[st.ravel() == 1], p1[st.ravel() == 1]
                if len(g0) >= 8:
                    m, _ = cv2.estimateAffinePartial2D(g0, g1, method=cv2.RANSAC, ransacReprojThreshold=1.0)
            if m is not None:
                tx += m[0, 2] / W * 100
                ty += m[1, 2] / H * 100
                sc *= float(np.hypot(m[0, 0], m[1, 0]))
                rot += float(np.degrees(np.arctan2(m[1, 0], m[0, 0])))
            curve.append([round(t, 3), round(tx, 3), round(ty, 3), round((sc - 1) * 100, 3), round(rot, 3)])
        prev = g
    return curve


def onset(ts, vals):
    end = vals[-1]
    if abs(end) < 0.3:   # 0.3% 안은 움직임으로 보지 않는다
        return None
    a = next(t for t, v in zip(ts, vals) if abs(v) >= 0.1 * abs(end))
    b = next(t for t, v in zip(ts, vals) if abs(v) >= 0.9 * abs(end))
    return [round(a, 2), round(b, 2)]


def summarize(n, a, b, curve):
    c = np.array(curve)
    ts, tx, ty, sc, rot = c[:, 0], c[:, 1], c[:, 2], c[:, 3], c[:, 4]
    dt = float(np.median(np.diff(ts)))
    kk = max(3, int(round(0.5 / dt)))

    def jitter(x):
        sm = np.convolve(x, np.ones(kk) / kk, mode="same")
        return round(float(np.std((x - sm)[kk:-kk])), 3) if len(x) > 2 * kk else 0.0

    def thirds(x):
        parts = np.array_split(np.diff(x) / dt, 3)
        return [round(float(p.mean()), 2) for p in parts]

    return {"조각": n, "원본초": [a, b], "길이": round(b - a, 2),
            "내용_옆%": round(float(tx[-1]), 2), "내용_위아래%": round(float(ty[-1]), 2), "크기%": round(float(sc[-1]), 2), "돎도": round(float(rot[-1]), 2),
            "옆_시작멈춤": onset(ts, tx), "위아래_시작멈춤": onset(ts, ty), "크기_시작멈춤": onset(ts, sc),
            "옆_빠르기_앞가운데뒤%초": thirds(tx), "위아래_빠르기%초": thirds(ty), "크기_빠르기%초": thirds(sc),
            "흔들림_옆%": jitter(tx), "흔들림_위아래%": jitter(ty)}


def panel_size():
    """19번 벽 스위치판(벽보다 어두운 네모)의 높이를 픽셀로 — 가장 먼 물체가 커지는 비율 = 카메라가 다가간 양의 아래 끝"""
    cap = cv2.VideoCapture(SRC)
    out = []
    for t in (72.80, 74.00, 75.65):
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        _, f = cap.read()
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        h, w = g.shape
        roi = g[int(0.35 * h):int(0.75 * h), :int(0.2 * w)]
        thr = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
        _, _, st, _ = cv2.connectedComponentsWithStats(thr)
        i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        out.append({"초": t, "높이px": int(st[i, cv2.CC_STAT_HEIGHT]), "가운데_폭%": round((st[i, 0] + st[i, 2] / 2) / w * 100, 2)})
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    res, curves, par = [], {}, {}
    for n, ((a, b), rois) in CUTS.items():
        curve = track(a, b, rois)
        s = summarize(n, a, b, curve)
        res.append(s)
        curves[n] = curve
        print(json.dumps(s, ensure_ascii=False))
    for n, parts in PARALLAX.items():
        a, b = CUTS[n][0]
        par[n] = {name: summarize(n, a, b, track(a, b, rois)) for name, rois in parts.items()}
        print(n, "시차", {k: (v["내용_옆%"], v["크기%"]) for k, v in par[n].items()})
    ps = panel_size()
    print("19 스위치판", ps)
    json.dump({"원본": os.path.basename(SRC), "칸": {n: r for n, (_, r) in CUTS.items()}, "조각": res, "시차": par, "19_스위치판": ps, "곡선": curves},
              open(os.path.join(OUT, "카메라.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
