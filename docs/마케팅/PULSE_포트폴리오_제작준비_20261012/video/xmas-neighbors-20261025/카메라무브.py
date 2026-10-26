# 시즌 1 「옆집의 크리스마스」 원본 36컷의 카메라 기법(2026-10-26 밤 다시 잼)과 그것을 이미지 콘티에 담는 법.
# 유호님 10-26 23:2x(포트폴리오 세션 전달) 「원본이랑 카메라 기법이 너무 다른데? … 원본이랑 카메라 기법도 완전히 똑같게 하라」.
# 값은 원본카메라재기.py(25fps 모든 프레임 누적 추적) · 처음 ↔ 끝 프레임 SIFT 직접 맞춤(git 밖 카메라_처음끝_SIFT.json)을 견줘
# 믿을 만한 쪽을 골랐다 — SIFT 맞춤이 40점 넘으면 그 값, 아니면 누적 추적, 둘 다 약한 얼굴 접사는 처음 · 가운데 · 끝 프레임을 눈으로 보고 정했다(「약함」).
# 「가로 · 세로」는 화면 속 내용이 움직인 양(화면 %, + = 오른쪽 · 아래) — 카메라는 그 반대로 움직였다. 「배율」 + = 다가감, - = 물러남.
#   python -X utf8 카메라무브.py 글                → 02_콘티 카메라 칸에 쓸 한 줄(컷마다)과 지시문/카메라.json
#   python -X utf8 카메라무브.py 배치 4 7 …        → 움직이는 컷의 넓힌 배치도 ego/refs/배치/S04o.jpg — 원본 첫 프레임을 시작 창 자리에 두고
#                                                    끝 창까지 들어가게 바깥을 늘린 판(받은 판에서 시작 · 끝 창을 둘 다 잘라 낼 수 있게)
#   python -X utf8 카메라무브.py 자르기 C04 …       → 컷/C04_처음.jpg · 컷/C04_끝.jpg(받은 판 그대로 자르기만 — 색 손대지 않음)
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors")
W, H = 1920, 1080

# n: (종류, 배율 %, 가로 %, 세로 %, 기울기 °, 시작 초, 멈춤 초, 빠르기, 손떨림 %, 덧말)
CAM = {
    1: ("고정", 0, 0, 0, 0, None, None, None, 0.03, "삼각대"),
    2: ("손에 든 다가감", 2.4, -5.1, 1.5, 1.0, 3.56, 4.20, "고른", 0.42, "0.64초 움직이고 멈춤"),
    3: ("다가감", 2.3, -0.6, -1.5, -0.7, 4.56, 5.84, "고른", 0.09, "매끈(슬라이더)"),
    4: ("손에 든 따라감", -1.2, -5.1, -3.2, 0.8, 5.88, 7.00, "점점 빨라짐", 0.09, "약함 — 고개 숙이는 사람을 따라감"),
    5: ("아래로 기울임", -3.5, -3.6, -42.9, 0.2, 7.04, 8.52, "점점 느려짐", 0.24, ""),
    6: ("거의 고정", 0, 1.1, 1.8, 0.3, 8.64, 10.04, "고른", 0.07, "아주 느린 미끄러짐"),
    7: ("어깨 너머 따라감", 0.6, 10.5, -1.3, -0.3, 10.08, 11.64, "고른", 0.19, "어깨 너머로 옮겨 감(원본은 걷는 사람을 따라감)"),
    8: ("손에 든 흔들림", -0.9, 2.8, 3.3, -0.3, 11.88, 12.76, "고른", 0.21, "0.9초 흐르고 멈춤"),
    9: ("손에 든 다가감", 3.3, -4.9, -1.2, 2.5, 13.28, 14.96, "점점 느려짐", 0.10, "약함 — 얼굴을 따라감"),
    10: ("고정", 0, 0, 0, 0, None, None, None, 0.02, "삼각대 · 낮은 자리"),
    11: ("손에 든 물러남", -2.2, -1.1, -2.1, -0.1, 15.96, 17.36, "점점 느려짐", 0.30, "약함"),
    12: ("고정", 0, 0, 0, 0, None, None, None, 0.02, "삼각대"),
    13: ("고정", 0, 0, 0, 0, None, None, None, 0.06, "삼각대"),
    14: ("거의 고정", -0.1, 1.2, 0.9, -0.4, 20.00, 21.24, "점점 느려짐", 0.04, "아주 느린 미끄러짐"),
    15: ("손에 든 아래로 기울임", 0, -0.8, -4.0, -0.2, 21.44, 22.60, "고른", 0.12, "창 너머를 엿봄"),
    16: ("위로 따라 올림", 1.4, -0.5, 7.5, -0.9, 22.76, 23.72, "점점 느려짐", 0.11, ""),
    17: ("다가감", 2.1, -0.9, -0.4, 0.4, 24.12, 24.56, "고른", 0.06, "0.44초"),
    18: ("거의 고정", 0.1, 1.4, 1.7, 0.1, 24.60, 25.84, "점점 느려짐", 0.06, "아주 느린 미끄러짐"),
    19: ("손에 든 따라감", -1.7, -20.4, 5.3, 10.1, 25.88, 27.32, "점점 느려짐", 0.49, "약함 — 사람을 따라 돎"),
    20: ("고정", 0, 0, 0, 0, None, None, None, 0.01, "삼각대"),
    21: ("손에 든 위아래 흔들림", 0.5, 2.0, -7.9, -3.9, 30.76, 31.96, "고른", 0.73, "약함 — 빗속 손떨림"),
    22: ("거의 고정", 0, -0.9, 1.7, -0.3, 32.00, 33.32, "고른", 0.04, "거울 틀은 그대로(샷표 「4% 다가감」은 이번 재기에서 0~1%)"),
    23: ("낮게 옆으로 따라감", -5.0, 7.1, -0.5, 0.4, 33.36, 34.44, "고른", 0.10, "약함 — 걷는 발을 따라 왼쪽으로"),
    24: ("거의 고정", -1.5, 2.1, -3.1, -0.7, 34.48, 35.88, "점점 느려짐", 0.06, "아주 느린 미끄러짐"),
    25: ("다가감", 12.5, -6.5, 5.1, 0.3, 35.92, 37.36, "점점 느려짐", 0.03, "유리 너머로 또렷해짐"),
    26: ("고정", 0, 0, 0, 0, None, None, None, 0.05, "삼각대"),
    27: ("손에 든 따라감", 2.1, -8.0, -9.0, -0.4, 38.88, 40.08, "고른", 0.11, "약함 — 걷는 사람을 따라감"),
    28: ("거의 고정", 0.4, 2.5, -2.3, 0.3, 40.12, 42.84, "점점 빨라짐", 0.02, "아주 느린 미끄러짐"),
    29: ("물러남", -1.8, -0.6, 0.4, -1.1, 42.88, 43.60, "점점 느려짐", 0.06, ""),
    30: ("손에 든 큰 따라감", -2.6, 47.9, 3.9, -6.7, 44.12, 46.40, "점점 느려짐", 0.88, "약함 — 사람을 따라 돌아 바탕이 크게 흐름"),
    31: ("고정", 0.3, -1.7, -0.3, 0.5, 46.44, 47.56, "점점 느려짐", 0.11, "앞 뒤통수만 움직임"),
    32: ("손에 든 돌며 다가감", 6.2, 9.2, 8.1, -9.9, 47.60, 49.52, "점점 느려짐", 0.10, "약함 — 49.5초 손이 들어옴"),
    33: ("거의 고정", 1.3, 1.0, 0.5, 0.2, 49.68, 50.80, "점점 빨라짐", 0.09, "앞 전구 보케"),
    34: ("손에 든 흔들림", -1.5, 3.9, 1.1, 1.1, 51.12, 53.84, "점점 느려짐", 0.06, "53.84초에 고개를 돌림(꼬리 1초는 35로)"),
    35: ("고정", 0, 0, 0, 0, None, None, None, 0.04, "삼각대"),
    36: ("물러남", -4.2, 0.4, 0.2, 0.2, 57.08, 60.00, "고른", 0.01, ""),
}
MOVING = [n for n, c in CAM.items() if c[0] not in ("고정", "거의 고정")]


def say(n):
    """02_콘티 카메라 칸 한 줄"""
    k, s, dx, dy, r, t0, t1, ease, sh, note = CAM[n]
    if k == "고정":
        return f"고정({note}) · 떨림 {sh}%" if sh >= 0.05 else f"고정({note})"
    parts = []
    if abs(s) >= 1:
        parts.append(f"{'다가감' if s > 0 else '물러남'} {abs(s):g}%")
    if abs(dx) >= 1:
        parts.append(f"카메라 {'오른쪽' if dx < 0 else '왼쪽'}으로 {abs(dx):g}%")
    if abs(dy) >= 1:
        parts.append(f"카메라 {'아래' if dy < 0 else '위'}로 {abs(dy):g}%")
    if abs(r) >= 1:
        parts.append(f"기울기 {r:+g}°")
    span = f"{t0:.2f}~{t1:.2f}초" if t0 is not None else ""
    body = " · ".join(parts) if parts else "움직임 1% 아래"
    tail = f" · {ease}" if ease and ease != "고른" else (" · 고른 속도" if ease else "")
    shake = f" · 손떨림 {sh}%" if sh >= 0.1 else ""
    return f"{k} — {body} ({span}{tail}){shake}" + (f" · {note}" if note else "")


def windows(n):
    """받은 판(16:9) 안의 시작 창 · 끝 창(가운데 x · y, 너비, 높이 — 판 크기 비, 기울기 °)과 넓힘 배율 k.
    끝 창은 시작 창에서 내용이 (배율 s · 이동 d · 기울기 r)로 움직였을 때 카메라가 본 자리다."""
    k_, s, dx, dy, r, *_ = CAM[n]
    sc = 1 + s / 100
    c0 = np.array([W / 2, H / 2])
    d = np.array([dx / 100 * W, dy / 100 * H])
    c1 = c0 - d / sc
    w1, h1 = W / sc, H / sc

    def corners(c, w, h, ang):
        a = math.radians(ang)
        R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
        pts = np.array([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]])
        return pts @ R.T + c
    pts = np.vstack([corners(c0, W, H, 0), corners(c1, w1, h1, -r)])
    x0, y0 = pts.min(0)
    x1, y1 = pts.max(0)
    k = max((x1 - x0) / W, (y1 - y0) / H, 1.0)
    B = np.array([(x0 + x1) / 2, (y0 + y1) / 2])
    CW, CH = W * k, H * k   # 판(받은 그림) 크기 — 16:9 그대로
    def norm(c):
        return ((c - B) + np.array([CW / 2, CH / 2])) / np.array([CW, CH])
    return {"k": float(k), "처음": [*map(float, norm(c0)), 1 / k, 1 / k, 0.0], "끝": [*map(float, norm(c1)), 1 / sc / k, 1 / sc / k, float(-r)]}


def crop(img, win, out=(W, H)):
    """판에서 창(가운데 · 너비 · 높이 비 · 기울기)을 잘라 out 크기로"""
    ih, iw = img.shape[:2]
    cx, cy, ww, hh, ang = win
    cx, cy, ww, hh = cx * iw, cy * ih, ww * iw, hh * ih
    M = cv2.getRotationMatrix2D((cx, cy), -ang, out[0] / ww)
    M[0, 2] += out[0] / 2 - cx
    M[1, 2] += out[1] / 2 - cy
    return cv2.warpAffine(img, M, out, flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)


def imread(p):
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def imwrite(p, img, q=92):
    ok, buf = cv2.imencode(Path(p).suffix, img, [cv2.IMWRITE_JPEG_QUALITY, q] if str(p).endswith(".jpg") else [])
    buf.tofile(str(p))


def overscan(n):
    """원본 첫 프레임 배치도(S{n}_배치.png)를 시작 창 자리에 두고 바깥을 늘린 넓힌 배치도 — k가 1이면 만들지 않는다"""
    wn = windows(n)
    if wn["k"] <= 1.005:
        print(n, "넓힐 것 없음(시작 창 안에 끝 창이 들어감)")
        return
    src = imread(V / "배치" / f"S{n:02d}_배치.png")
    k = wn["k"]
    CW, CH = int(round(W * k)), int(round(H * k))
    cx, cy = wn["처음"][0] * CW, wn["처음"][1] * CH
    left, top = int(round(cx - W / 2)), int(round(cy - H / 2))
    canvas = cv2.copyMakeBorder(src, max(0, top), max(0, CH - top - H), max(0, left), max(0, CW - left - W), cv2.BORDER_REPLICATE)
    canvas = canvas[:CH, :CW]
    # 늘린 바깥은 더 흐리게(모양이 없는 곳이라는 표시) — 시작 창 안은 그대로
    blur = cv2.GaussianBlur(canvas, (0, 0), 30)
    m = np.zeros((CH, CW), np.float32)
    m[max(0, top):top + H, max(0, left):left + W] = 1
    m = cv2.GaussianBlur(m, (0, 0), 25)[..., None]
    out = (canvas * m + blur * (1 - m)).astype(np.uint8)
    out = cv2.resize(out, (W, H), interpolation=cv2.INTER_AREA)
    imwrite(V / "배치" / f"S{n:02d}o_배치.png", out)
    imwrite(V / "ego" / "refs" / "배치" / f"S{n:02d}o.jpg", cv2.resize(out, (1600, 900), interpolation=cv2.INTER_AREA))
    json.dump(wn, open(V / "배치" / f"S{n:02d}o_창.json", "w", encoding="utf-8"))
    print(n, f"넓힌 배치도 k={k:.3f}", "처음", [round(x, 3) for x in wn["처음"]], "끝", [round(x, 3) for x in wn["끝"]])


def cut_windows(cid):
    """받은 판의 시작 · 끝 창 — 넓힌 배치도로 구운 컷은 그 창, 5번 세로 판은 위 · 아래 창, 아니면 windows()를 판 안으로 줄여 맞춤"""
    n = int(cid[1:3])
    o = V / "배치" / f"S{n:02d}o_창.json"
    if n == 5:
        g = json.load(open(V / "배치" / "S05t_창.json", encoding="utf-8"))
        ww, hh, pad = g["win_w_frac"], g["win_h_frac"], g["pad_frac"]
        return [pad + ww / 2, hh / 2, ww, hh, 0.0], [pad + ww / 2, 1 - hh / 2, ww, hh, 0.0]
    if o.exists():
        wn = json.load(open(o, encoding="utf-8"))
        return wn["처음"], wn["끝"]
    # 넓힌 배치도 없이 구운 판(2 · 3 · 29 · 거의 고정 컷): 받은 판을 넓힌 판으로 보고 같은 셈의 창을 쓴다 — 시작 창이 받은 판보다 1/k만큼
    # 좁아진다(k는 2번 1.04 · 3번 1.01 · 29번 1.05 · 거의 고정 1.02~1.06). 받은 판 = 시작 프레임으로 쓰려면 넓힌 배치도로 다시 굽는다.
    wn = windows(n)
    return wn["처음"], wn["끝"]


def cut(cid):
    src = V / "컷" / f"{cid}.jpg"
    full = V / "정지컷" / f"{cid}.png"
    img = imread(full) if full.exists() else imread(src)
    a, b = cut_windows(cid)
    imwrite(V / "컷" / f"{cid}_처음.jpg", crop(img, a))
    imwrite(V / "컷" / f"{cid}_끝.jpg", crop(img, b))
    print(cid, "처음", [round(x, 3) for x in a], "끝", [round(x, 3) for x in b])


if __name__ == "__main__":
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == "글":
        rows = {n: say(n) for n in CAM}
        for n, t in rows.items():
            print(n, t)
        (HERE / "지시문").mkdir(exist_ok=True)
        (HERE / "지시문" / "카메라.json").write_text(json.dumps({str(n): {"종류": c[0], "배율%": c[1], "가로%": c[2], "세로%": c[3], "기울기°": c[4],
            "시작초": c[5], "멈춤초": c[6], "빠르기": c[7], "손떨림%": c[8], "덧말": c[9], "글": rows[n]} for n, c in CAM.items()}, ensure_ascii=False, indent=1), encoding="utf-8")
    elif mode == "배치":
        for a in args:
            overscan(int(a))
    elif mode == "자르기":
        for a in args:
            cut(a)
