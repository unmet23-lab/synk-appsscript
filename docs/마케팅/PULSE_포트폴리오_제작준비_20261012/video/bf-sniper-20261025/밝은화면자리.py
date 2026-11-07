# 스나이퍼 19번 — 밤 거실의 밝은 화면 자리를 장마다 찾는다(2026-11-07, Claude). S4.tsx가 「블프 OPEN」(가까운 노트북) · 알림(바닥 휴대폰 위)을 그 자리에 붙인다.
#   python -X utf8 밝은화면자리.py   → 자막시안_20261103/remotion/src/s4/자리.json  {"laptop": {"from": 장, "r": [[x0,y0,x1,y1]…]}, "phone": {…}}
import json
import os
import subprocess

import cv2
import numpy as np

PIC = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s4/화면.mp4"
JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103", "remotion", "src", "s4", "자리.json")
W, H = 1920, 1080
JOBS = {"laptop": (628, 648, (0.25, 0.9, 0.2, 0.75)), "phone": (648, 769, (0.02, 0.72, 0.62, 1.0))}   # (첫 장, 끝 장 다음, 찾을 칸 x0 x1 y0 y1 — 화면 몫)


def frames(a, b):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", PIC, "-vf", f"select='between(n,{a},{b - 1})'", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


def find(img, box, prev, kind):
    x0, x1, y0, y1 = (int(box[0] * W), int(box[1] * W), int(box[2] * H), int(box[3] * H))
    v = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)[..., 2]
    m = (v > (215 if kind == "laptop" else 205)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, _, st, cen = cv2.connectedComponentsWithStats(m)
    best, score = None, -1e9
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < (900 if kind == "laptop" else 120) or w < 12 or h < 6:
            continue
        if kind == "phone" and not (1.6 <= w / h <= 4.5):
            continue   # 바닥에 누운 휴대폰 — 옆으로 긴 네모(소매 · 담요의 밝은 결을 거름)
        cx, cy = x + w / 2 + x0, y + h / 2 + y0
        s = a if prev is None else a - 40 * np.hypot(cx - (prev[0] + prev[2]) / 2, cy - (prev[1] + prev[3]) / 2)
        if s > score:
            best, score = [int(x + x0), int(y + y0), int(x + w + x0), int(y + h + y0)], s
    return best


def main():
    out = {}
    for kind, (a, b, box) in JOBS.items():
        F = frames(a, b)
        rs, prev = [], None
        for f in F:
            r = find(f, box, prev, kind) or prev
            rs.append(r)
            prev = r
        # 세 장 이동 평균(떨림 누름)
        arr = np.array(rs, float)
        sm = np.array([arr[max(0, k - 1):k + 2].mean(axis=0) for k in range(len(arr))])
        out[kind] = {"from": a, "r": [[round(float(v), 1) for v in r] for r in sm]}
        print(kind, len(rs), "장 · 첫", rs[0], "끝", rs[-1])
        chk = [cv2.rectangle(F[k].copy(), tuple(map(int, sm[k][:2])), tuple(map(int, sm[k][2:])), (0, 255, 0), 3) for k in (0, len(F) // 2, len(F) - 1)]
        cv2.imencode(".jpg", np.hstack([cv2.resize(c, (640, 360)) for c in chk]))[1].tofile(os.path.join(os.path.dirname(PIC), f"_자리확인_{kind}.jpg"))
    os.makedirs(os.path.dirname(JS), exist_ok=True)
    json.dump(out, open(JS, "w", encoding="utf-8"))
    print(JS)


if __name__ == "__main__":
    main()
