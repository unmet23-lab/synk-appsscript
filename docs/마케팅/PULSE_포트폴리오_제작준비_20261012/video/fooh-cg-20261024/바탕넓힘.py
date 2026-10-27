"""PULSE 3번 — 영상 단계 바탕을 2.0초 틀(F1)의 1.40배로 넓힌다(Gemini 바깥 채우기 + 가운데는 F1 원본 화소) (2026-10-27).

원본 첫 1.5초 팬이 2.0초 틀 왼쪽 밖 33% · 아래 8%를 보여 주므로 바탕은 틀의 1.40배 캔버스에 틀이 가로 25.66~97.09% ·
세로 11.57~82.99% 자리에 오게 넓힌다(02_콘티 1절). Gemini는 바깥만 채우라고 해도 가운데까지 다시 그리므로(현장노트
gemini_사진 「바깥 채우기를 시켜도 가운데까지 다시 그린다」), 받은 판을 ECC로 F1 자리에 되돌리고 가운데는 F1 원본 화소를,
바깥은 Gemini 화소를 쓴다. 색은 F1 테두리 안쪽 띠에서 잰 (F1 − Gemini)를 바깥으로 퍼뜨려(정규화 흐림) 이음매에서 맞추고
멀어질수록 0으로 줄인다. 이음매는 F1 안쪽 48px에서 섞는다.
  python 바탕넓힘.py 캔버스                → <밖>/넓힘/캔버스.jpg(Gemini에 보낼 1536×2752 · 회색 바깥) · 자리.json
  python 바탕넓힘.py 맞춤 <받은 그림>       → ECC 어긋남 · 가운데 부위별 차이 · 넓힘/맞춘판.png
  python 바탕넓힘.py 합치기 <받은 그림> <이름> → 넓힘/<이름>.jpg(1.40배 · F1 원본 크기 그대로 2150×3853) · <이름>_이음매.jpg
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/바탕"
F1 = os.path.join(밖, "받음", "F1_155418.jpg")
넓힘 = os.path.join(밖, "넓힘")
K = 1.40
FX, FY = 0.2566, 0.1157       # 틀 왼쪽 위 자리(캔버스 비) — 모든 프레임을 틀로 되돌린 범위 가로 −0.327~1.009 · 세로 −0.002~1.078의 가운데
GW, GH = 1536, 2752           # Gemini 9:16 원본 크기
SEAM, BAND = 48, 64


def 자리():
    w1, h1 = round(GW / K), round(GH / K)
    return {"K": K, "Gemini": [GW, GH], "틀": [round(FX * GW), round(FY * GH), w1, h1],
            "큰판": [round(GW * K), round(GH * K)], "큰판틀": [round(FX * GW * K), round(FY * GH * K), GW, GH]}


def 읽기(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)


def 캔버스():
    os.makedirs(넓힘, exist_ok=True)
    z = 자리()
    x, y, w, h = z["틀"]
    can = Image.new("RGB", (GW, GH), (128, 128, 128))
    can.paste(Image.open(F1).convert("RGB").resize((w, h), Image.LANCZOS), (x, y))
    can.save(os.path.join(넓힘, "캔버스.jpg"), quality=95)
    json.dump(z, open(os.path.join(넓힘, "자리.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("캔버스", can.size, "틀", z["틀"], "· 바깥 왼쪽", x, "오른쪽", GW - x - w, "위", y, "아래", GH - y - h)


def 맞춤(gp):
    """받은 그림 → 캔버스 자리로 되돌리는 아핀(F1이 놓인 자리에서 ECC)."""
    z = 자리()
    x, y, w, h = z["틀"]
    g = 읽기(gp)
    if g.shape[:2] != (GH, GW):
        g = cv2.resize(g, (GW, GH), interpolation=cv2.INTER_LANCZOS4)
    o = 읽기(os.path.join(넓힘, "캔버스.jpg"))
    m = np.zeros((GH, GW), np.uint8)
    m[y + 8:y + h - 8, x + 8:x + w - 8] = 255
    k = 4
    gs = cv2.cvtColor(cv2.resize(g, None, fx=1 / k, fy=1 / k, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
    os_ = cv2.cvtColor(cv2.resize(o, None, fx=1 / k, fy=1 / k, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
    ms = cv2.erode(cv2.resize(m, (os_.shape[1], os_.shape[0]), interpolation=cv2.INTER_NEAREST), np.ones((5, 5), np.uint8))
    warp = np.eye(2, 3, dtype=np.float32)
    cc, warp = cv2.findTransformECC(os_, gs, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), ms, 5)
    warp[:, 2] *= k
    gw = cv2.warpAffine(g, warp, (GW, GH), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    s = float(np.sqrt(abs(np.linalg.det(warp[:, :2]))))
    print(f"ECC {cc:.4f} · Gemini가 가운데를 {100 * (s - 1):+.2f}% 키우고 {warp[0, 2]:+.1f} · {warp[1, 2]:+.1f}px 옮겨 다시 그렸다")
    d = np.abs(gw - o).mean(axis=2)
    for nm, (a, b, c, e) in {"빌딩": (0.10, 0.10, 0.70, 0.62), "하늘": (0.05, 0.02, 0.95, 0.10), "나무": (0.0, 0.60, 1.0, 0.72),
                             "길": (0.0, 0.75, 1.0, 0.98)}.items():
        sub = (slice(y + int(b * h), y + int(e * h)), slice(x + int(a * w), x + int(c * w)))
        print(f"  {nm:3s} 차이 {d[sub].mean():5.1f} · 색 Gemini {np.round(gw[sub].reshape(-1, 3).mean(0), 1).tolist()} 원본 {np.round(o[sub].reshape(-1, 3).mean(0), 1).tolist()}")
    json.dump({"warp": warp.tolist(), "cc": cc}, open(os.path.join(넓힘, "맞춤.json"), "w"))
    Image.fromarray(np.clip(gw + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(넓힘, "맞춘판.png"))
    return gw


def 합치기(gp, name):
    z = 자리()
    if not os.path.exists(os.path.join(넓힘, "맞춤.json")):
        맞춤(gp)
    warp = np.array(json.load(open(os.path.join(넓힘, "맞춤.json")))["warp"], np.float32)
    g = 읽기(gp)
    if g.shape[:2] != (GH, GW):
        g = cv2.resize(g, (GW, GH), interpolation=cv2.INTER_LANCZOS4)
    W, H = z["큰판"]
    X, Y, w, h = z["큰판틀"]
    # Gemini 판을 캔버스 자리로 되돌린 뒤 1.40배 큰판으로 키운다(바깥은 Gemini 해상도라 조금 무르다 — 팬 1.5초 동안만 보인다)
    A = np.vstack([warp, [0, 0, 1]]).astype(np.float64)       # 캔버스 → Gemini
    S = np.diag([W / GW, H / GH, 1.0])                          # 캔버스 → 큰판
    gw = cv2.warpAffine(g, (A @ np.linalg.inv(S))[:2].astype(np.float32), (W, H),
                        flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    o = np.zeros((H, W, 3), np.float32)
    f1 = 읽기(F1)
    o[Y:Y + h, X:X + w] = f1
    inside = np.zeros((H, W), np.float32)
    inside[Y:Y + h, X:X + w] = 1
    # 색: F1 테두리 안쪽 띠(SEAM~SEAM+BAND)에서 (F1 − Gemini)를 재어 바깥으로 퍼뜨린다
    ring = np.zeros((H, W), np.float32)
    ring[Y + SEAM:Y + h - SEAM, X + SEAM:X + w - SEAM] = 1
    ring[Y + SEAM + BAND:Y + h - SEAM - BAND, X + SEAM + BAND:X + w - SEAM - BAND] = 0
    diff = np.clip((o - gw) * ring[..., None], -20, 20)
    sig = 60
    num = cv2.GaussianBlur(diff, (0, 0), sig)
    den = cv2.GaussianBlur(ring, (0, 0), sig)[..., None]
    off = np.where(den > 1e-3, num / np.maximum(den, 1e-3), 0)
    # 테두리에서 멀어질수록 줄인다(바깥 300px에서 0)
    dist = cv2.distanceTransform((1 - inside).astype(np.uint8), cv2.DIST_L2, 5)
    fall = np.clip(1 - dist / 300.0, 0, 1)[..., None]
    gc = gw + off * fall
    # 섞기: F1 안쪽 SEAM px에서 원본 ↔ Gemini 선형
    din = cv2.distanceTransform(inside.astype(np.uint8), cv2.DIST_L2, 5)
    alpha = np.clip(din / SEAM, 0, 1)[..., None]
    out = np.clip(o * alpha + gc * (1 - alpha) + 0.5, 0, 255).astype(np.uint8)
    full = Image.fromarray(out)
    full.save(os.path.join(넓힘, f"{name}.jpg"), quality=95)
    # 이음매 확인: 네 변 바로 안 · 밖 6px 평균 차, 네 모서리 둘레 확대
    rows, cols = slice(Y, Y + h), slice(X, X + w)
    sides = {"왼": ((rows, slice(X, X + 6)), (rows, slice(X - 6, X))),
             "오른": ((rows, slice(X + w - 6, X + w)), (rows, slice(X + w, X + w + 6))),
             "위": ((slice(Y, Y + 6), cols), (slice(Y - 6, Y), cols)),
             "아래": ((slice(Y + h - 6, Y + h), cols), (slice(Y + h, Y + h + 6), cols))}
    rep = {nm: round(float(np.abs(out[a].astype(np.float32).mean((0, 1)) - out[b].astype(np.float32).mean((0, 1))).mean()), 2)
           for nm, (a, b) in sides.items()}
    print("이음매 6px 안밖 평균 차:", rep, "· 색 보정 최대", np.round(np.abs(off).max(), 1))
    crops = [out[max(0, Y - 220):Y + 220, max(0, X - 220):X + 220], out[max(0, Y - 220):Y + 220, X + w - 220:min(W, X + w + 220)],
             out[Y + h - 220:min(H, Y + h + 220), max(0, X - 220):X + 220], out[Y + h - 220:min(H, Y + h + 220), X + w - 220:min(W, X + w + 220)]]
    crops = [cv2.resize(c, (440, 440)) for c in crops]
    Image.fromarray(np.concatenate([np.concatenate(crops[:2], 1), np.concatenate(crops[2:], 1)], 0)).save(os.path.join(넓힘, f"{name}_이음매.jpg"), quality=90)
    print(f"저장: {name}.jpg {full.size} · 틀 자리 {X},{Y} {w}×{h}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "캔버스"
    if cmd == "캔버스":
        캔버스()
    elif cmd == "맞춤":
        맞춤(sys.argv[2])
    elif cmd == "합치기":
        합치기(sys.argv[2], sys.argv[3])
