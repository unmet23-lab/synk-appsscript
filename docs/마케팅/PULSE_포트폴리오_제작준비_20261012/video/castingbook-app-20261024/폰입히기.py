# 8번 폰 화면 컷 여섯 입히기(2026-11-07, Claude — 최종 편집) — 콘티 3절 「손가락이 닿는 프레임에 녹화를 맞추는 법」 4~7단계.
#   python -X utf8 폰입히기.py 계획 [컷…]   → 손가락 자취(폰추적.py)로 녹화 계획 → git 밖 최종/p8/폰/녹화/<R>.json
#   python -X utf8 폰입히기.py 녹화 [컷…]   → node 녹화_따라.cjs로 지금 캐스팅북을 그 계획대로 다시 찍음(최종/p8/폰/녹화/<R>/raw)
#   python -X utf8 폰입히기.py 입히기 [컷…] → 최종/p8/_컷/<컷>.mp4(1920×1080 · 24fps — 판 그대로 키우고 초록 자리에만 녹화를 붙임) · 폰/<컷>_입힘.jpg(확인판)
# 스크롤은 받은 판의 손끝과 1:1(끌기), 뗀 뒤는 뗀 빠르기에서 지수로 줄어 멈춤(넘기기). 누름 · 크게 보기는 손가락이 화면을 덮은 동안 바뀐다.
# 보드가 10-25 녹화 뒤에 바뀌어(모델 21 · 그룹 두 팀 칸) 3번은 한 번 넘겨 그룹 칸을 지나 하린 줄에 닿는다(손가락 판이 한 번 튕긴다).
# 12번은 질문을 넣은 보드다 — 11-07 저녁부터 질문이 있으면 그룹 칸이 모델 목록 뒤로 가서(캐스팅북 app.js placeTeams) 질문 칸에서 하린 줄로 바로 넘어간다.
# 색 · 밝기 후보정 없음(결정 10-24) — 받은 판은 키우기만 하고, 녹화 화면은 스스로 빛나는 면이라 0.93배 · 0.6px 흐림만(이미지콘티_합성.py와 같은 값).
import functools
import json
import os
import shutil
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util


def _load(name, file):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


HAP = _load("hap", "이미지콘티_합성.py")
TRK = _load("trk", "폰추적.py")
FIN = _load("fin", "녹화_마감.py")

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p8"
PH = os.path.join(ROOT, "폰")
REC = os.path.join(PH, "녹화")
CUTDIR = os.path.join(ROOT, "_컷")
FPS, OW, OH = 24, 1920, 1080
K = 1.5   # 받은 판 1280 → 1920
TAU = 0.42   # 넘긴 뒤 멈추는 빠르기(초) — 휴대폰 감속에 가까운 값
HEADER = 56  # 캐스팅북 붙박이 머리 줄 높이(pt, 11-07 공개 판)

# 컷: 판 · 판에서 시작하는 장 · 장 수(02_콘티 컷 시각을 24fps로 — 아래 최종편집.py와 같은 경계) · 녹화
CUTS = {
    3: {"pid": "p8-03", "a": 22, "k": 40, "rec": "R3", "route": "#board", "ask": "", "mode": "flick", "drag": (24, 30), "y0": 0, "target": 1669},
    # v4 edge_fix(6 · 10): v3 Fable 「7.5~8.0 · 15.0 가장자리 초록 실선」 — 6번 8.0초 화면 맨 위에 초록 띠(가장 큰 초록 덩어리만 덮개로 써서 끊긴 띠가 빠짐),
    # 10번 15.0초 엄지 아래 초록 번짐(둘레 누름 15px 밖). 칸 안 초록은 모두 덮고, 화면 가장자리에 닿는 칸 귀퉁이는 밖으로 밀고, 둘레 누름은 40px.
    6: {"pid": "p8-06", "a": 10, "k": 32, "rec": "R6", "route": "#m-F02", "ask": "", "mode": "follow", "y0": 345, "edge_fix": True},
    10: {"pid": "p8-10", "a": 34, "k": 24, "rec": "R10", "route": "#m-F02-scene", "ask": "", "mode": "follow", "y0": 480, "edge_fix": True},
    # 12번(v5, 11-07 저녁): 손끝은 117pt를 끌고 836pt/s로 뗀다 — 휴대폰 감속 그대로면 모두 350pt. v1~v3은 질문 칸(150) → 01 하린(1484) 1,334pt를 맞추려
    # 3.8배로 날려 그룹 칸이 번지며 「깨진 화면 · 파형」으로 읽혔고(v3 시험관 셋 · opus), v4는 닿을 자리만 두어 질문 칸이 컷에서 빠졌다(Fable 3차 「딸기 라떼 입력 고리가 안 읽힘」).
    # 보드가 질문이 있으면 그룹 칸을 목록 뒤로 보내 같은 두 자리가 150 → 471(01 하린 타일 571, 위에 「모델 21명」 줄)로 321pt — 뗀 빠르기를 731pt/s(손끝의 0.87배)로 맞추면 한 컷에 질문 → 하린.
    12: {"pid": "p8-12", "a": 22, "k": 20, "rec": "R12", "route": "#board", "ask": "딸기 라떼 신메뉴", "mode": "flick", "drag": (24, 30), "y0": 150, "target": 471},
    15: {"pid": "p8-15", "a": 25, "k": 27, "rec": "R15", "route": "#m-F02", "ask": "", "mode": "open", "y0": 150, "strip": 5, "open_at": 1.55},
    17: {"pid": "p8-17__2", "a": 18, "k": 33, "rec": "R17", "route": "#board", "ask": "딸기 라떼 신메뉴", "mode": "press", "press_at": 1.62,
         "zoom": {"tileCode": "F02"}, "crop_w": 380, "hide_toast": True,   # v4: 누름 알림 상자(#toast)가 02 얼굴을 덮어 「개발 UI 알림」(Fable v1 · v3) — 칩이 「패키지에 담김」으로 바뀌는 것만
         # 11-07 저녁 보드 고침(질문이 있으면 그룹 칸이 모델 목록 뒤로) 전 판에서 찍은 v4 녹화(R17 zoom, 타일 1584 · scrollY 928)를 그대로 쓴다. 고친 보드에서는 타일이 571이라
         # 엄지 자리(화면 681pt)에 단추를 두려면 scrollY가 −85가 되어 못 찍는다. 극접사 칸 안 짜임(거르기 줄 · 「모델 21명」 · 01 · 02)은 두 판이 같다(1pt 차).
         "frozen": "보드 고침 전 판에서 찍은 v4 녹화를 쓴다(고친 보드에서는 엄지 자리에 단추를 둘 수 없다) — 입히기만 한다"},
}


def tracked(cut):
    return json.load(open(os.path.join(PH, f"{cut:02d}_추적.json"), encoding="utf-8"))


def tip_y(rec):
    """손끝 y(화면 pt) — 없는 장은 앞뒤로 메우고 3장 창으로 고르게."""
    ys = [t[1] if t else None for t in rec["손끝"]]
    idx = [i for i, v in enumerate(ys) if v is not None]
    arr = np.interp(np.arange(len(ys)), idx, [ys[i] for i in idx])
    return np.convolve(np.pad(arr, 1, mode="edge"), np.ones(3) / 3, mode="valid")


def plan(cut):
    c = CUTS[cut]
    if c.get("frozen"):
        print(f"#{cut} 계획 건너뜀 — {c['frozen']}")
        return None
    rec = tracked(cut)
    ty = tip_y(rec)
    a, k = c["a"], c["k"]
    frames = []
    if c["mode"] == "follow":
        for i in range(k):
            frames.append({"y": round(c["y0"] + (ty[a] - ty[a + i]), 2)})
    elif c["mode"] == "flick":
        d0, d1 = c["drag"]
        v = (ty[d0:d1] - ty[d0 + 1:d1 + 1]) * FPS     # 끌기 동안 손끝 빠르기(pt/s, 위로 +)
        vrel = float(np.max(v[-4:]))                   # 손을 떼는 순간의 빠르기 — 끝 장은 손이 들리며 느려지니 마지막 넷 가운데 가장 큰 값
        drag = ty[d0] - ty[d1]
        tau = c.get("tau", TAU)
        tail = (a + k - 1 - d1) / FPS                  # 뗀 뒤 컷 끝까지
        reach = 1 - np.exp(-tail / tau)
        if "y0" in c:   # 처음 자리와 닿을 자리를 둘 다 정함 → 뗀 빠르기를 거기에 맞춘다
            vrel = (c["target"] - c["y0"] - drag) / (tau * reach)
            y0 = c["y0"]
        else:           # 닿을 자리만 정함 → 처음 자리를 거꾸로 셈
            y0 = c["target"] - drag - vrel * tau * reach
        if "stop" in c:   # 12번: 컷이 0.83초라 지수로는 끝까지 번진다 — 같은 감속으로 줄여 컷 끝 stop장 앞에 멈춘다(마지막 장의 01 하린이 또렷하게)
            T = (a + k - 1 - c["stop"] - d1) / FPS
            vrel = 2 * (c["target"] - y0 - drag) / T
        for i in range(k):
            t = a + i
            if t <= d0:
                y = y0
            elif t <= d1:
                y = y0 + (ty[d0] - ty[t])
            elif "stop" in c:
                u = min((t - d1) / FPS, T)
                y = y0 + drag + vrel * u - 0.5 * (vrel / T) * u * u
            else:
                y = y0 + drag + vrel * tau * (1 - np.exp(-((t - d1) / FPS) / tau))
            frames.append({"y": round(float(y), 2)})
        print(f"#{cut} 넘김: 처음 {y0:.0f}pt · 끌기 {drag:.0f}pt · 뗀 빠르기 {vrel:.0f}pt/s(손끝 최대 {np.max(v):.0f}) · 컷 끝 {frames[-1]['y']:.0f}pt(목표 {c['target']})")
    elif c["mode"] == "open":
        for i in range(k):
            frames.append({"y": c["y0"], "open": (a + i) / FPS >= c["open_at"]})
    elif c["mode"] == "press":
        for i in range(k):
            frames.append({"y": 0, "press": (a + i) / FPS >= c["press_at"]})
    p = {"id": c["rec"], "route": c["route"], "ask": c["ask"], "fps": FPS, "frames": frames, "cut": cut}
    if "strip" in c:
        p["strip"] = c["strip"]
    if c.get("hide_toast"):
        p["hideToast"] = True
    if c["mode"] == "press":
        p["pressCode"] = c["zoom"]["tileCode"]
        sp = press_sp(cut, tracked(cut))
        top = int(np.floor(sp[0][1] - 47)) - 4
        p["zoom"] = {"tileCode": c["zoom"]["tileCode"], "scrollY": press_scroll(cut), "clip": {"x": 0, "y": top, "width": int(np.ceil(sp[1][0])) + 4, "height": 805 - top}}
    os.makedirs(REC, exist_ok=True)
    json.dump(p, open(os.path.join(REC, c["rec"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    ys = [f["y"] for f in frames]
    print(f"#{cut} {c['rec']} 계획 {len(frames)}장 · y {min(ys):.0f}~{max(ys):.0f}")
    return p


ADD = {"dx": 95.8, "w": 64.7, "dy": 10.0, "h": 30.0}   # 타일 안 「+ 패키지」 단추 자리(10-25 clip.json — 타일 왼위에서 pt)


def press_sp(cut, rec):
    """17번 화면 pt 칸 — 받은 판에 보이는 폰 귀퉁이는 화면 아래 왼쪽이다(왼쪽 · 아래 테두리가 보임). 초록 왼 변 = 화면 x 0, 아래 변 = 화면 맨 아래(852pt),
    가로는 crop_w pt가 보이게(세로는 초록 비율로). 10-25 이미지 콘티는 위 변을 567pt에 두어 아래 테두리와 어긋났다."""
    c = CUTS[cut]
    sp0 = np.array(rec["pt칸"], np.float32)
    asp = (sp0[1][0] - sp0[0][0]) / (sp0[2][1] - sp0[1][1])
    w = c["crop_w"]
    h = w / asp
    return np.array([[0, 852 - h], [w, 852 - h], [w, 852], [0, 852]], np.float32)


def to_new(rec, sp, pt):
    """추적 때 칸(rec pt칸) 좌표를 새 칸(sp) 좌표로 — 같은 초록 귀퉁이에 이어진 두 칸 사이의 바꿈."""
    sp0 = np.array(rec["pt칸"], np.float32)
    u = (pt[0] - sp0[0][0]) / (sp0[1][0] - sp0[0][0])
    v = (pt[1] - sp0[0][1]) / (sp0[2][1] - sp0[0][1])
    return sp[0][0] + u * (sp[1][0] - sp[0][0]), sp[0][1] + v * (sp[2][1] - sp[0][1])


def press_scroll(cut):
    """17번: 엄지가 쉬는 자리(화면 pt)에 「+ 패키지」 단추가 오게 극접사 판의 스크롤을 정한다(가로는 보드 짜임으로 정해져 있어 crop_w로 맞춘다)."""
    c = CUTS[cut]
    rec = tracked(cut)
    sp = press_sp(cut, rec)
    tips = [t for t in rec["손끝"][c["a"]:c["a"] + c["k"]] if t]
    tx, ty = np.median([t[0] for t in tips[-10:]]), np.median([t[1] for t in tips[-10:]])
    px, py = to_new(rec, sp, (tx, ty))
    tile_top = 1584   # 「딸기 라떼 신메뉴」 보드의 01 하린 타일(11-07 공개 판에서 잼 — 녹화 뒤 clip.json의 box로 다시 확인). 보드 고침 뒤는 571 — CUTS[17] frozen
    want_btn_y = py - 47 - 8        # 화면 pt → 페이지 화면(위 상태 표시줄 47pt). 엄지 끝보다 조금 위에 단추 가운데
    scroll = tile_top + ADD["dy"] + ADD["h"] / 2 - want_btn_y
    print(f"#{cut} 칸 {sp[0].tolist()}~{sp[2].tolist()} · 엄지 끝 화면 ({px:.0f}, {py:.0f})pt — 단추 가로 {20 + ADD['dx']:.0f}~{20 + ADD['dx'] + ADD['w']:.0f} · 스크롤 {scroll:.1f}")
    return round(float(scroll), 1)


def record(cut):
    c = CUTS[cut]
    if c.get("frozen"):
        print(f"#{cut} 녹화 건너뜀 — {c['frozen']}")
        return
    subprocess.run(["node", os.path.join(HERE, "녹화_따라.cjs"), os.path.join(REC, c["rec"] + ".json")], check=True)


def take_frames(c):
    return TRK.frames(c["pid"], c["a"], c["k"])


def screen_img(c, i, st, bars):
    """녹화 i장(상태 표시줄을 얹은 화면 그림)과 그림 화소 → 화면 pt 변환."""
    d = os.path.join(REC, c["rec"])
    if c["mode"] == "press":
        z = json.load(open(os.path.join(d, "zoom", "clip.json"), encoding="utf-8"))
        im = HAP.read(os.path.join(d, "zoom", "after.png" if st["states"][i]["pressed"] else "before.png"))
        s = z["dpr"]
        T = np.array([[1 / s, 0, z["clip"]["x"]], [0, 1 / s, z["clip"]["y"] + 47], [0, 0, 1]], np.float64)
        return im, T
    raw = Image.open(os.path.join(d, "raw", f"{i:04d}.png")).convert("RGB")
    top = np.asarray(raw.crop((0, 0, raw.width, 6))).mean()
    full = Image.new("RGB", (raw.width, raw.height + FIN.BAR))
    full.paste(bars[top < 60], (0, 0))
    full.paste(raw, (0, FIN.BAR))
    im = cv2.cvtColor(np.asarray(full), cv2.COLOR_RGB2BGR)
    return im, np.array([[1 / 3, 0, 0], [0, 1 / 3, 0], [0, 0, 1]], np.float64)


def composite(cut):
    c = CUTS[cut]
    rec = tracked(cut)
    st = json.load(open(os.path.join(REC, c["rec"], "states.json"), encoding="utf-8"))
    fr = take_frames(c)
    sp = np.array(rec["pt칸"], np.float32)
    if c["mode"] == "press":
        sp = press_sp(cut, rec)
    bars = {False: FIN.status_bar(False), True: FIN.status_bar(True)}
    S = np.array([[K, 0, 0], [0, K, 0], [0, 0, 1]], np.float64)
    out = []
    prev_y = None
    for i in range(c["k"]):
        q = np.array(rec["귀퉁이"][c["a"] + i], np.float32)
        Hm = cv2.getPerspectiveTransform(sp, q).astype(np.float64)   # 추적한 초록 자리 귀퉁이 ↔ 화면 pt 칸
        img = cv2.resize(fr[i], (OW, OH), interpolation=cv2.INTER_LANCZOS4)
        src, T = screen_img(c, i, st, bars)
        y = st["states"][i].get("y")
        if c["mode"] in ("flick", "follow") and prev_y is not None:
            # 넘김 방향 번짐(녹화 1pt = 3화소). 처음 판은 셔터 반 바퀴(0.5)였는데 12번 빠른 넘김(장마다 200pt 넘게)이 줄무늬로만 남아
            # 이해 시험관 둘이 「줄무늬로 뭉개진 화면 전환 — 의도 불명」(11-07 v1) — 넘김은 셔터 0.2 · 최대 45pt로 지나가는 칸이 알아보이게
            # v4: 따라가기도 0.2 — 6번 8.0초 탭 줄(북 · 디지털 · 장면 · 프로필) 글자가 번져 「검은 막대 · 점선, 깨진 화면 같다」(v3 Fable)
            sh, cap = (0.2, 45)
            L = int(min(abs(y - prev_y) * sh, cap) * 3) | 1
            if L > 2:   # 위 상태 표시줄 · 붙박이 머리 줄(synk PULSE · 패키지 · 문의하기)은 화면에 붙어 있어 번지지 않는다
                top = int((47 + HEADER) * 3)
                src[top:] = cv2.filter2D(src, -1, np.full((L, 1), 1.0 / L, np.float32))[top:]
        prev_y = y
        quad = cv2.perspectiveTransform(sp.reshape(-1, 1, 2), S @ Hm).reshape(-1, 2)
        # 가장자리 덮기(11-07 v1 Fable): ① 3번 시계 「3:12」가 폰 위 테두리에 걸려 잘림 — 온 화면 컷(3 · 15)은 녹화 둘레를 9pt 늘여(가장자리 색 그대로)
        #   늘인 칸을 초록 귀퉁이에 잇는다 → 내용이 9pt 안으로 들어온다. ② 15번 아래 왼쪽 귀퉁이 초록 — 덮개 칸을 귀퉁이 둘레 12px 넓혀 남은 초록도 덮고,
        #   그 자리는 늘인 가장자리 색이 채운다(극접사도 녹화 둘레를 10pt 늘여 칸 밖이 비지 않게).
        full = TRK.CUTS[cut]["crop"] is None   # 온 화면 컷(3 · 15) — 폰추적.py의 칸
        pad = 9 if full else 10
        P = int(round(pad / T[0, 0]))   # 녹화 화소로
        src = cv2.copyMakeBorder(src, P, P, P, P, cv2.BORDER_REPLICATE)
        T2 = T @ np.array([[1, 0, -P], [0, 1, -P], [0, 0, 1]], np.float64)   # 늘인 판 화소 → 원래 녹화 화소 → 화면 pt
        if full:
            x0, y0 = sp[0]
            x1, y1 = sp[2]
            sp_in = np.array([[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x1 + pad, y1 + pad], [x0 - pad, y1 + pad]], np.float32)
            Hfull = S @ cv2.getPerspectiveTransform(sp_in, q).astype(np.float64) @ T2
        else:
            Hfull = S @ Hm @ T2
        gm = HAP.green_mask(img)
        one = HAP.regions(gm, 1)[0]
        dp = grow_px(quad.astype(np.float32), 12)
        if c.get("edge_fix"):
            qm2 = cv2.fillConvexPoly(np.zeros(gm.shape, np.uint8), np.round(grow_px(quad.astype(np.float32), 30)).astype(np.int32), 1) > 0
            parts = [r_ for r_ in HAP.regions(gm, 8) if int((r_[qm2] > 0).sum()) > 150]
            if parts:
                one = functools.reduce(cv2.bitwise_or, parts)
            dp = snap_border(dp)
        a = HAP.matte(img, one, dp, px=4)
        base = HAP.despill(img, one)
        o = HAP.put(base, src, Hfull, one, gain=0.93, blur=0.6, alpha=a)
        o = near_despill(o, one, dp, px=40 if c.get("edge_fix") else 15)
        if c.get("edge_fix"):
            o = skin_despill(o, quad, a)
        out.append(bezel_gray(o, dp))
    os.makedirs(CUTDIR, exist_ok=True)
    path = os.path.join(CUTDIR, f"{cut:02d}_입힘.mp4")
    write(out, path)
    sheet(out, os.path.join(PH, f"{cut:02d}_입힘.jpg"))
    print(f"#{cut} → {path}")
    return out


def grow_px(q, px):
    """사각형을 가운데에서 px만큼 넓힌다(짧은 변 기준 배율)."""
    short = max(8.0, min(np.ptp(q[:, 0]), np.ptp(q[:, 1])))
    c = q.mean(0)
    return (c + (q - c) * (1 + 2 * px / short)).astype(np.float32)


def snap_border(q, m=30, out=40):
    """칸 귀퉁이가 화면 가장자리 m px 안이면 밖(out px)으로 민다 — 판의 초록 화면은 가장자리 너머로 이어지는데 추적 칸이 몇 px 안쪽에 서면 그 띠가 덮개 밖에 남는다(6번 8.0초)."""
    q = q.copy()
    q[:, 0] = np.where(q[:, 0] < m, -out, np.where(q[:, 0] > OW - m, OW + out, q[:, 0]))
    q[:, 1] = np.where(q[:, 1] < m, -out, np.where(q[:, 1] > OH - m, OH + out, q[:, 1]))
    return q.astype(np.float32)


def skin_despill(o, quad, alpha, px=160):
    """녹화가 얹히지 않은 판 화소(엄지 · 손)에 남은 초록 빛 번짐을 넓게 누른다 — 초록 화면이 엄지 아랫면에 비친 자리(10번 15.0초, v3 Fable).
    실제 폰이면 흰 앱 화면이 비칠 자리라 초록 기운만 뺀다(g ≤ max(r, b) + 6). 녹화 화소(alpha ≥ 0.5)는 건드리지 않는다 — 장면 사진의 초록이 남게."""
    qm = cv2.fillConvexPoly(np.zeros(o.shape[:2], np.uint8), np.round(grow_px(quad.astype(np.float32), px)).astype(np.int32), 1) > 0
    take = qm & (np.asarray(alpha, np.float32).reshape(o.shape[:2]) < 0.5)
    b, g, r = [o[..., i].astype(np.int16) for i in range(3)]
    lim = np.maximum(r, b) + 6
    out = o.copy()
    out[..., 1] = np.where(take & (g > lim), lim, g).clip(0, 255).astype(np.uint8)
    return out


def near_despill(o, one, quad, px=15):
    """초록 덩어리 둘레(px)와 화면 칸 둘레에서만 초록 기운을 누른다(g ≤ max(r, b) + 6) — HAP.last_despill은 칸 둘레 띠 전체를 눌러
    폰 밖 창빛 배경까지 바꿨다(3번 위 「흐린 사각형」, 11-07 v1 Fable)."""
    near = cv2.dilate(one, np.ones((2 * px + 1, 2 * px + 1), np.uint8)) > 0
    qm = cv2.dilate(cv2.fillConvexPoly(np.zeros(o.shape[:2], np.uint8), np.round(quad).astype(np.int32), 1), np.ones((9, 9), np.uint8)) > 0
    b, g, r = [o[..., i].astype(np.int16) for i in range(3)]
    lim = np.maximum(r, b) + 6
    out = o.copy()
    out[..., 1] = np.where(near & qm & (g > lim), lim, g).clip(0, 255).astype(np.uint8)
    return out


def bezel_gray(o, quad, out_px=26, in_px=16):   # 안쪽 16px — 15번 크게 보기(검은 화면) 가장자리의 어두운 청록 줄은 초록 판정(채도 · 밝기 문턱) 밖이라 덮개에서 빠졌다
    """화면 둘레 테두리 띠(밖 26px · 안 4px)에 남은 초록 · 청록 기운을 무채색으로 — 초록 화면 빛이 폰 테두리 유리에 비친 자리(15번 왼쪽 테두리 청록 줄).
    last_despill은 초록만 눌러 파랑이 남아 청록이 됐다. 이 띠는 실제로는 흰 앱 화면이 비치는 자리라 회색이 맞다."""
    qm = cv2.fillConvexPoly(np.zeros(o.shape[:2], np.uint8), np.round(quad).astype(np.int32), 1)
    band = (cv2.dilate(qm, np.ones((2 * out_px + 1, 2 * out_px + 1), np.uint8)) > 0) & ~(cv2.erode(qm, np.ones((2 * in_px + 1, 2 * in_px + 1), np.uint8)) > 0)
    b, g, r = [o[..., i].astype(np.float32) for i in range(3)]
    y0 = 0.3 * r + 0.59 * g + 0.11 * b
    tint = band & (g > r + 6) & (g >= b - 25) & (y0 < 95)   # 어두운 테두리만 — 처음 판은 밝은 창 배경까지 회색으로 바꿔 폰 둘레에 사각형 자국(3번 위)
    if tint.any():
        y = 0.3 * r + 0.59 * g + 0.11 * b
        o = o.copy()
        for i in range(3):
            o[..., i] = np.where(tint, y, o[..., i]).clip(0, 255).astype(np.uint8)
    return o


FROM_YUV = "zscale=matrixin=709:rangein=limited:range=full,format=gbrp"
TO_YUV = "zscale=matrix=709:range=limited:rangein=full,format=yuv420p"


def write(frames, path):
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
                          "-vf", TO_YUV, "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", path], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(np.ascontiguousarray(f).tobytes())
    p.stdin.close()
    if p.wait():
        raise SystemExit("ffmpeg 실패")


def sheet(frames, path, every=3, w=480):
    cells = []
    for i in range(0, len(frames), every):
        c = cv2.resize(frames[i], (w, int(w * OH / OW)))
        cv2.putText(c, f"{i / FPS:.2f}", (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cells.append(c)
    while len(cells) % 4:
        cells.append(np.zeros_like(cells[0]))
    rows = [np.hstack(cells[i:i + 4]) for i in range(0, len(cells), 4)]
    cv2.imencode(".jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(path)


if __name__ == "__main__":
    what = sys.argv[1]
    cuts = [int(x) for x in sys.argv[2:]] or list(CUTS)
    for cc in cuts:
        {"계획": plan, "녹화": record, "입히기": composite}[what](cc)
