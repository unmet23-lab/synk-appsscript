# PULSE 1번 블렌더 카메라 키 — 원본 본편 6컷의 카메라 곡선을 우리 장면 카메라 움직임으로 (2026-10-27)
# 유호님(10-26) 「원본이랑 카메라 기법도 완전히 똑같게」. 원본 곡선은 git 밖 레퍼런스/원본실측/p1_펩시/카메라/곡선.json
# (레퍼런스/스크립트/14_카메라곡선.py — 이웃 프레임 맞춤, 24fps를 30fps로 늘린 같은 프레임은 빼고 실제 촬영 시각으로).
#   python 카메라키.py   → 카메라곡선_원본.json(캔장면.py --anim이 읽는다)
# 컷 1 · 2 · 4 · 5 · 6: 우리 판 30fps 프레임마다 화면 곡선(배율 · 옆 · 위아래 · 돎, 0.1초 매끈)을 그대로 옮긴다 — 캔장면.py가
#   피사체 거리 Z의 평면이 이 곡선대로 움직이게 카메라 몸을 옮긴다(옆 · 위아래 = 트럭 · 페디스털, 배율 = 달리, 돎 = 롤).
# 컷 3(슬라이더): 화면 전체 값은 거리가 다른 캔 셋 · 네온이 섞여 쓸 수 없어, 템플릿으로 따로 따라간 주인공 캔 · 뒤 캔으로 길을 푼다.
#   같은 캔의 화면 폭 50% · 26.8%(W_HERO · W_FAR)에서 거리 0.652 · 1.216 m(폭은 거리에 반비례). 이 거리로 두 캔의 흐름을 풀면
#   0.8–1.45초에 뒤 캔 자리가 한 점(±1.5 mm)에 모인다 — 팬 없이 옆으로만 가는 슬라이더다. 3.4초쯤부터 뒤 캔이 약 20% 커지는 것은
#   앞으로 다가감(템플릿 크기 비 · 실루엣 폭이 같은 값, 줌이면 뒤 네온도 같이 커져야 하는데 덜 커진다). 초점은 1.95초까지 주인공 캔 → 2.55초 뒤 캔.
import json
import math
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "레퍼런스", "원본실측", "p1_펩시",
                   "카메라", "곡선.json")
FPS = 30
K = 100.0 / (36.0 * 9 / 16)       # 렌즈 100 mm · 세로 맞춤 센서 36 mm(9:16) → 화면 폭당 x/z
CAN_D = 0.066                     # 캔 지름(m)
# 3번 컷 두 캔의 실제 화면 폭(%) — 주인공 캔은 첫 프레임 펼침에서 0.30–0.80, 뒤 캔은 초점이 맞은 3.0–3.2초에 몸통 아래 띠
# (세로 56–62%)의 파란 윤곽으로 잰 값. 템플릿 층의 「폭」은 따라간 칸의 폭(24%)이라 캔 폭이 아니다 — 크기 비(다가감)만 쓴다.
W_HERO, W_FAR = 50.0, 26.8
# 컷마다 피사체 거리(카메라 → 곡선을 잰 면, m) — 캔장면.py의 컷 카메라에서
Z = {"1": 0.252, "2": 0.264, "4": 0.21, "5": 0.189, "6": 0.200}
# 2번 컷은 곡면 캔 전체로 쌓으면 가장자리의 흐린 면이 낱말표와 다르게 흘러 옆 이동이 1.2% 작게 읽힌다(Fable 10-27 P2) —
# 낱말표 칸(첫 프레임 가로 25–65% · 세로 15–60%)으로 다시 잰 곡선을 쓴다(14_카메라곡선.py --원본칸, 캔장면.py REGION["2"]와 같은 칸).
BOX = {"2": "C2_칸0.25_0.15_0.65_0.6.json"}


def gauss(v, sig):
    if sig <= 0:
        return np.asarray(v, float)
    v = np.asarray(v, float)
    p = int(3 * sig) + 1
    e = np.concatenate([2 * v[0] - v[p:0:-1], v, 2 * v[-1] - v[-2:-p - 2:-1]])
    k = np.exp(-0.5 * (np.arange(-p, p + 1) / sig) ** 2)
    return np.convolve(e, k / k.sum(), mode="same")[p:p + len(v)]


def screen_curves(c, n):
    t = np.array(c["곡선"]["t"])
    ti = np.arange(n) / FPS
    return {k: [round(float(x), 4) for x in np.interp(ti, t, np.array(c["곡선"][k + "_매끈"]))] for k in ("배율", "옆", "위아래", "돎")}


def solve_c3(c, n):
    """3번 컷 카메라 길: 주인공 캔(0, 0) · 뒤 캔(Xf, Yf) 장면에서 카메라 x(옆) · y(앞뒤)."""
    hero = c["층"]["주인공캔T"]
    far = c["층"]["뒤캔T"]
    d_h = K * CAN_D / (W_HERO / 100)               # 주인공 캔 거리
    th, xh = np.array([q["t"] for q in hero]), np.array([q["x"] for q in hero]) / 100
    tf, xf, wf = np.array([q["t"] for q in far]), np.array([q["x"] for q in far]) / 100, np.array([q["폭"] for q in far]) / 100
    ok = tf >= 0.8                                 # 0.8초 전에는 뒤 캔이 주인공 캔 뒤에 반쯤 가려 자리 · 폭이 치우친다
    w_f0 = float(np.median(wf[(tf >= 1.8) & (tf <= 3.2)]))   # 템플릿 칸 폭(다가가기 전) — 크기 비의 바탕
    d_f0 = K * CAN_D / (W_FAR / 100)               # 뒤 캔 거리(다가가기 전, 실제 캔 폭으로)
    cy0 = -d_h
    # 주인공 캔이 주는 카메라 x
    cx_h = 0.0 - (xh - 0.5) * d_h / K
    # 뒤 캔: 거리는 폭으로(다가감), x는 자리로
    depth_f = d_f0 * w_f0 / wf
    # 겹치는 0.8–1.45초에서 뒤 캔 세계 x를 정한다
    both = (tf >= 0.8) & (tf <= th[-1])
    xf_world = float(np.median(np.interp(tf[both], th, cx_h) + (xf[both] - 0.5) * depth_f[both] / K))
    cx_f = xf_world - (xf - 0.5) * depth_f / K
    ti = np.arange(n) / FPS
    a = np.interp(ti, th, cx_h)
    b = np.interp(ti, tf[ok], cx_f[ok])
    wgt = np.clip((ti - 1.10) / 0.35, 0, 1)        # 1.10–1.45초에 주인공 캔 → 뒤 캔 값으로 넘김
    cx = gauss((1 - wgt) * a + wgt * b, 3)
    # 앞뒤: 뒤 캔 거리가 다가가기 전 거리보다 줄어든 만큼(3.0초 전은 0으로)
    dolly = np.clip(d_f0 - np.interp(ti, tf[ok], depth_f[ok]), 0, None)
    dolly = gauss(np.where(ti < 3.0, 0.0, dolly), 3)
    cy = cy0 + dolly
    # 초점: 1.95초까지 주인공 캔, 2.55초에 뒤 캔(그 뒤는 다가가는 만큼 줄어드는 거리)
    f_hero = 0.0 - cy
    f_far = (d_f0 + cy0) - cy                      # = 뒤 캔 y - 카메라 y
    u = np.clip((ti - 1.95) / 0.60, 0, 1)
    u = u * u * (3 - 2 * u)                         # 매끄러운 넘김
    focus = (1 - u) * f_hero + u * f_far
    return {"주인공거리": round(d_h, 4), "뒤캔": [round(xf_world, 4), round(d_f0 + cy0, 4)], "뒤캔폭_다가가기전": W_FAR,
            "카메라x": [round(float(v), 5) for v in cx], "카메라y": [round(float(v), 5) for v in cy], "초점": [round(float(v), 4) for v in focus],
            "다가감_끝m": round(float(dolly[-1]), 4)}


def main():
    d = json.load(open(SRC, encoding="utf-8"))
    out = {"출처": "원본 가짜 펩시 광고 본편 — 레퍼런스/원본실측/p1_펩시/카메라/곡선.json(14_카메라곡선.py)", "fps": FPS,
           "부호": "옆 + = 그림이 오른쪽으로(카메라 왼쪽), 위아래 + = 그림이 아래로(카메라 위로), 배율 + = 커짐(다가감), 돎 + = 그림이 시계 방향",
           "컷": {}}
    for c in d["컷"]:
        n = c["프레임"][1] - c["프레임"][0] + 1
        e = {"프레임수": n, "원본초": c["원본초"], "말": c["말"]}
        if c["id"] == "3":
            e["길"] = solve_c3(c, n)
        else:
            e["Z"] = Z[c["id"]]
            bx = os.path.join(os.path.dirname(SRC), BOX[c["id"]]) if c["id"] in BOX else None
            src = json.load(open(bx, encoding="utf-8")) if bx and os.path.exists(bx) else c
            e["화면"] = screen_curves(src, n)
            if src is not c:
                e["잰칸"], e["말"] = os.path.basename(bx), src["말"]
        out["컷"][c["id"]] = e
        print(c["id"], n, e.get("길", {}).get("다가감_끝m", ""), c["말"][:90])
    json.dump(out, open(os.path.join(HERE, "카메라곡선_원본.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
