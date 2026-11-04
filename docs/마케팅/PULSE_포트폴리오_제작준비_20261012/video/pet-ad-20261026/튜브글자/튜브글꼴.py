# 첨벙댕 튜브 글자꼴 — 글꼴 윤곽을 부풀리면 ㅐ 틈이 메워지고 ㅊ이 뭉쳐 안 읽혔다(11-04). 자모를 굵은 획으로 직접 그려 조각마다 따로 부풀린다. ㅇ은 물놀이 튜브
import json
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

OUT = sys.argv[1]
W_STROKE = float(sys.argv[2]) if len(sys.argv) > 2 else 0.2
EM = 1000
S = 2  # 그리기 배율


def poly(*pts):
    return [("line", list(pts))]


# 글자 칸 x 0~1 · y 0~1(위로). 조각마다 획 목록. ring=True면 주황 튜브
LETTERS = [
    ("첨", [
        {"name": "ㅊ", "strokes": [[(0.16, 1.02), (0.40, 1.02)], [(0.0, 0.82), (0.56, 0.82)], [(0.28, 0.82), (0.28, 0.72), (-0.02, 0.44)], [(0.28, 0.72), (0.58, 0.44)]]},
        {"name": "ㅓ", "strokes": [[(0.90, 1.02), (0.90, 0.40)], [(0.70, 0.70), (0.90, 0.70)]]},
        {"name": "ㅁ", "rect": (0.14, 0.02, 0.82, 0.28)},
    ]),
    ("벙", [
        {"name": "ㅂ", "strokes": [[(0.02, 1.0), (0.02, 0.42), (0.54, 0.42), (0.54, 1.0)], [(0.02, 0.72), (0.54, 0.72)]]},
        {"name": "ㅓ", "strokes": [[(0.94, 1.02), (0.94, 0.40)], [(0.76, 0.70), (0.94, 0.70)]]},
        {"name": "ㅇ", "ring": (0.47, 0.145, 0.31, 0.135)},
    ]),
    ("댕", [
        {"name": "ㄷ", "strokes": [[(0.47, 0.93), (0.05, 0.93), (0.05, 0.47), (0.49, 0.47)]]},
        {"name": "ㅐ", "strokes": [[(0.69, 0.99), (0.69, 0.40)], [(0.98, 0.99), (0.98, 0.40)], [(0.57, 0.70), (0.98, 0.70)]]},
        {"name": "ㅇ", "ring": (0.50, 0.145, 0.31, 0.135)},
    ]),
]


def px(p):
    return (int(round((p[0] + 0.3) * EM * S)), int(round((1.3 - p[1]) * EM * S)))


def contours(a):
    cs, hier = cv2.findContours(a.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    polys = []
    for c, h in zip(cs, hier[0]):
        c = cv2.approxPolyDP(c, 2.0, True)[:, 0, :].astype(float)
        if len(c) >= 3:
            polys.append({"hole": bool(h[3] >= 0), "pts": [[float(x) / (EM * S) - 0.3, 1.3 - float(y) / (EM * S)] for x, y in c]})
    return polys


size = int(1.7 * EM * S)
w = int(round(W_STROKE * EM * S))
res = {"em": EM, "letters": []}
for ch, parts in LETTERS:
    L = {"ch": ch, "parts": []}
    for part in parts:
        a = np.zeros((size, size), np.uint8)
        ring = False
        if "strokes" in part:
            for st in part["strokes"]:
                pts = np.array([px(p) for p in st], np.int32)
                cv2.polylines(a, [pts], False, 255, w, cv2.LINE_8)
                for p in pts:
                    cv2.circle(a, tuple(int(v) for v in p), w // 2, 255, -1)
        elif "rect" in part:
            x0, y0, x1, y1 = part["rect"]
            pts = np.array([px((x0, y0)), px((x1, y0)), px((x1, y1)), px((x0, y1))], np.int32)
            cv2.polylines(a, [pts], True, 255, int(w * 0.92), cv2.LINE_8)
            for p in pts:
                cv2.circle(a, tuple(int(v) for v in p), int(w * 0.92) // 2, 255, -1)
        else:
            cx, cy, rx, ry = part["ring"]
            ring = True
            c = px((cx, cy))
            cv2.ellipse(a, c, (int(rx * EM * S), int(ry * EM * S)), 0, 0, 360, 255, int(w * 0.9))
        # 안쪽 구멍 없이 작아지는 틈을 막지 않게 살짝만 둥글린다
        a = cv2.GaussianBlur(a, (0, 0), 6) > 127
        L["parts"].append({"name": part["name"], "ring": ring, "polys": contours(a)})
    res["letters"].append(L)
json.dump(res, open(OUT, "w", encoding="utf8"))
v = Image.new("L", (1800, 700), 0)
dr = ImageDraw.Draw(v)
for i, L in enumerate(res["letters"]):
    for p in L["parts"]:
        for q in sorted(p["polys"], key=lambda z: z["hole"]):
            dr.polygon([(i * 560 + x * 480 + 150, 560 - y * 480) for x, y in q["pts"]], fill=0 if q["hole"] else 255)
v.save(OUT.replace(".json", "_flat.png"))
print("ok", [(L["ch"], [len(p["polys"]) for p in L["parts"]]) for L in res["letters"]])
