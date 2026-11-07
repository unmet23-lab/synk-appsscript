# 8번 폰 화면 컷 추적(2026-11-07, Claude — 최종 편집) — 받은 시댄스 판의 초록 화면을 프레임마다 따라가 화면 평면(pt → 화면 화소)과 손가락 끝(화면 pt)을 잰다.
# 녹화는 이 손가락 자취에 맞춰 다시 찍고(녹화_따라.cjs), 입히기는 폰입히기.py가 한다. 콘티 3절 「손가락이 닿는 프레임에 녹화를 맞추는 법」 1~3단계.
#   python -X utf8 폰추적.py <컷>…   → git 밖 최종/p8/폰/<컷>_추적.json · <컷>_추적.jpg(확인판: 잡은 화면 테두리 · 손가락 끝)
# 화면 평면: 첫 장에서 초록 덩어리의 네 귀퉁이를 잡아(이미지콘티_합성.py의 quad_of · quad_lines — 극접사는 프레임에 잘린 변을 프레임 선으로) 녹화 pt 칸과 잇고,
#   그 장의 흰 십자들을 pt 좌표의 닻으로 삼는다. 다음 장부터는 닻을 앞 장 변환으로 옮겨 가장 가까운 십자와 짝짓고 RANSAC 원근 변환을 다시 구한다
#   (손가락이 귀퉁이를 가려도 남은 십자로 잡힌다). 짝이 모자란 장은 앞 장 변환을 쓴다. 마지막에 귀퉁이 자취를 5장 창으로 고르게 해 떨림을 뺀다.
# 손가락: 화면 칸 안에서 초록이 아닌 큰 덩어리 가운데 화면 가장자리에 닿은 것(밖에서 들어온 것). 끝 = 들어온 자리(가장자리에 닿은 화소의 가운데)에서 가장 먼 화소.
import json
import os
import subprocess
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util
_s = importlib.util.spec_from_file_location("hap", os.path.join(HERE, "이미지콘티_합성.py"))
HAP = importlib.util.module_from_spec(_s)
_s.loader.exec_module(HAP)

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p8/폰"
W, H = 1280, 720   # 받은 판 크기 — 추적은 이 크기, 입히기는 1920×1080에서 1.5배

# 컷 → 판 · 시작 장(24fps) · 장 수 · 녹화 칸(pt: 화면 393×852 가운데 초록 자리에 보이는 부분 x0 · y0 · x1 — 세로는 초록 비율로) · 극접사 여부
CUTS = {
    3: {"pid": "p8-03", "a": 0, "k": 41, "crop": None},
    6: {"pid": "p8-06", "a": 0, "k": 33, "crop": [0, 55, 393]},
    10: {"pid": "p8-10", "a": 0, "k": 24, "crop": [0, 100, 393]},
    12: {"pid": "p8-12", "a": 20, "k": 20, "crop": [0, 100, 393]},
    15: {"pid": "p8-15", "a": 25, "k": 27, "crop": None},
    17: {"pid": "p8-17__2", "a": 20, "k": 33, "crop": [0, 567.2, 260]},
}


def frames(pid, a, k):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(DAY, pid + ".mp4"), "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                       capture_output=True, check=True)
    n = len(r.stdout) // (W * H * 3)
    f = np.frombuffer(r.stdout, np.uint8)[:n * W * H * 3].reshape(n, H, W, 3)
    return f[a:a + k].copy()


def green(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    b, g, r = [img[..., i].astype(np.int16) for i in range(3)]
    # 짙은 초록 + 누를 때 생기는 옅은 초록 둘레(빛 고리)까지
    m = (hsv[..., 0] >= 38) & (hsv[..., 0] <= 90) & (hsv[..., 1] >= 45) & (hsv[..., 2] >= 40) & (g > r + 18) & (g > b + 12)
    return (m.astype(np.uint8) * 255)


def crosses(img, gm):
    """흰 십자 가운데 — 둘레가 초록인 작고 밝은 덩어리. 판마다 십자가 순백(3번)에서 옅은 연두빛 흰색(10 · 12번 — 극접사의 흐림)까지라
    색 문턱 대신 둘레보다 밝은 정도(밝기 톱햇)로 찾는다."""
    near = cv2.dilate(gm, np.ones((9, 9), np.uint8)) > 0
    lum = img.min(2)   # 초록 바탕은 R · B가 낮고 흰 십자는 셋 다 높다 — 가장 낮은 채널이 십자를 가장 또렷이 가른다
    th = cv2.morphologyEx(lum, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    vals = th[near & (gm > 0)]
    cut = max(18.0, float(np.percentile(vals, 99.7)) * 0.45) if vals.size else 18.0
    white = ((th > cut) & near).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(white, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 3 or a > 400 or max(w, h) > 40:
            continue
        x0, y0, x1, y1 = max(0, x - 4), max(0, y - 4), min(W, x + w + 4), min(H, y + h + 4)
        comp = lab[y0:y1, x0:x1] == i
        ring = (cv2.dilate(comp.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~comp
        if ring.sum() and (gm[y0:y1, x0:x1][ring] > 0).mean() > 0.6:
            out.append(cen[i])
    return np.array(out, np.float32).reshape(-1, 2)


def first_quad(img, gm, crop):
    one = HAP.regions(gm, 1)[0]
    if crop:
        dp = HAP.quad_lines(one)
        x0, y0, x1 = crop
        h = (x1 - x0) / HAP.side_aspect(dp)
        sp = np.array([[x0, y0], [x1, y0], [x1, y0 + h], [x0, y0 + h]], np.float32)
    else:
        dp = HAP.quad_of(one)
        sp = np.array([[0, 0], [393, 0], [393, 852], [0, 852]], np.float32)
    return sp, dp


def track(cut):
    c = CUTS[cut]
    fr = frames(c["pid"], c["a"], c["k"])
    g0 = green(fr[0])
    sp, dp = first_quad(fr[0], g0, c["crop"])
    H0 = cv2.getPerspectiveTransform(sp, dp)
    c0 = crosses(fr[0], g0)
    anchors = cv2.perspectiveTransform(c0.reshape(-1, 1, 2), np.linalg.inv(H0)).reshape(-1, 2)
    Hs, info = [H0], [{"십자": len(c0), "짝": len(c0)}]
    for t in range(1, len(fr)):
        gm = green(fr[t])
        ct = crosses(fr[t], gm)
        pred = cv2.perspectiveTransform(anchors.reshape(-1, 1, 2), Hs[-1]).reshape(-1, 2)
        pairs = []
        if len(ct):
            d = np.linalg.norm(pred[:, None, :] - ct[None, :, :], axis=2)
            for i in range(len(pred)):
                j = int(np.argmin(d[i]))
                if d[i, j] < 14 and int(np.argmin(d[:, j])) == i:
                    pairs.append((i, j))
        Ht = Hs[-1]
        if len(pairs) >= 8:
            A = anchors[[p[0] for p in pairs]]
            B = ct[[p[1] for p in pairs]]
            Hn, inl = cv2.findHomography(A, B, cv2.RANSAC, 2.5)
            if Hn is not None and inl.sum() >= 8:
                Ht = Hn
        Hs.append(Ht)
        info.append({"십자": len(ct), "짝": len(pairs)})
    # 귀퉁이 자취를 고르게(5장 창 — 끝은 짧은 창)
    corners = np.array([cv2.perspectiveTransform(sp.reshape(-1, 1, 2), Hh).reshape(-1, 2) for Hh in Hs])   # (n, 4, 2)
    sm = corners.copy()
    for t in range(len(corners)):
        lo, hi = max(0, t - 2), min(len(corners), t + 3)
        sm[t] = corners[lo:hi].mean(0)
    Hsm = [cv2.getPerspectiveTransform(sp, q.astype(np.float32)) for q in sm]
    tips = [fingertip(fr[t], green(fr[t]), Hsm[t], sp) for t in range(len(fr))]
    os.makedirs(OUT, exist_ok=True)
    rec = {"컷": cut, "판": c["pid"], "시작장": c["a"], "장수": c["k"], "fps": 24, "pt칸": sp.tolist(),
           "귀퉁이": [q.round(2).tolist() for q in sm], "손끝": tips, "십자": info}
    json.dump(rec, open(os.path.join(OUT, f"{cut:02d}_추적.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    sheet(fr, sm, tips, Hsm, os.path.join(OUT, f"{cut:02d}_추적.jpg"))
    jumps = np.abs(np.diff(sm, axis=0)).max(axis=(1, 2))
    print(f"#{cut} {c['pid']} {c['a']}장부터 {len(fr)}장 · 십자 짝 중앙 {int(np.median([i['짝'] for i in info]))} · 귀퉁이 한 장 최대 움직임 {jumps.max():.1f}px · "
          f"손끝 {sum(1 for t in tips if t)}장")
    return rec


def fingertip(img, gm, Hm, sp):
    """화면 pt 좌표의 손가락 끝(없으면 None)."""
    x0, y0 = sp[0]
    x1, y1 = sp[2]
    s = 2.0   # pt당 2화소로 펴서 본다
    Wp, Hp = int((x1 - x0) * s), int((y1 - y0) * s)
    T = np.array([[s, 0, -x0 * s], [0, s, -y0 * s], [0, 0, 1]], np.float64)
    M = T @ np.linalg.inv(Hm)
    flat = cv2.warpPerspective(img, M, (Wp, Hp), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    inframe = cv2.warpPerspective(np.full((H, W), 255, np.uint8), M, (Wp, Hp), flags=cv2.INTER_NEAREST, borderValue=0) > 0
    g = (green(flat) > 0) & inframe
    # 화면 자리 = 펴 놓은 판에서 초록의 볼록 껍질(폰 테두리 띠는 밖) — 처음 판은 사각형 칸 전체를 써서 테두리 띠를 손가락으로 잡았다
    cs, _ = cv2.findContours(g.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cs:
        return None
    hull = cv2.convexHull(np.vstack([c for c in cs if cv2.contourArea(c) > 50] or [max(cs, key=cv2.contourArea)]))
    inside = cv2.fillConvexPoly(np.zeros(g.shape, np.uint8), hull, 1)
    inside = cv2.erode(inside, np.ones((5, 5), np.uint8), borderType=cv2.BORDER_CONSTANT, borderValue=0) > 0   # 판 가장자리도 화면 끝으로(기본 테두리값은 깎지 않는다 — 12번 손끝 0장)
    non = (~g & inside).astype(np.uint8)
    non = cv2.morphologyEx(non, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(non, 8)
    m = 6
    edge = inside & ~(cv2.erode(inside.astype(np.uint8), np.ones((2 * m + 1, 2 * m + 1), np.uint8), borderType=cv2.BORDER_CONSTANT, borderValue=0) > 0)
    best = None
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 0.004 * Wp * Hp:
            continue
        comp = lab == i
        touch = comp & edge
        if touch.sum() < 10:
            continue
        if best is None or st[i, cv2.CC_STAT_AREA] > best[0]:
            best = (st[i, cv2.CC_STAT_AREA], comp, touch)
    if best is None:
        return None
    _, comp, touch = best
    ys, xs = np.nonzero(comp)
    ey, ex = np.nonzero(touch)
    e = np.array([ex.mean(), ey.mean()])
    d = (xs - e[0]) ** 2 + (ys - e[1]) ** 2
    k = int(np.argmax(d))
    return [round(float(xs[k] / s + x0), 1), round(float(ys[k] / s + y0), 1), round(float(comp.sum() / (Wp * Hp)), 3)]


def sheet(fr, sm, tips, Hsm, path):
    cells = []
    for t in range(0, len(fr), 3):
        im = fr[t].copy()
        cv2.polylines(im, [np.round(sm[t]).astype(np.int32)], True, (0, 0, 255), 2)
        if tips[t]:
            p = cv2.perspectiveTransform(np.array([[tips[t][:2]]], np.float32), Hsm[t]).reshape(2)
            cv2.circle(im, (int(p[0]), int(p[1])), 9, (255, 0, 255), 3)
        cv2.putText(im, f"{t / 24:.2f}", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3)
        cells.append(cv2.resize(im, (320, 180)))
    while len(cells) % 6:
        cells.append(np.zeros_like(cells[0]))
    rows = [np.hstack(cells[i:i + 6]) for i in range(0, len(cells), 6)]
    cv2.imencode(".jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(path)


if __name__ == "__main__":
    for c in [int(x) for x in sys.argv[1:]] or list(CUTS):
        track(c)
