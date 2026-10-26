# 콘티 v5 카메라 시간대 재기(2026-10-26 밤) — 원본 31컷마다 카메라 움직임을 종류 · 크기 · 방향 · 시작 · 멈춤 초 · 가감속 · 번짐으로 재고,
# 그 숫자로 컷별 Seedance 지시문의 카메라 문장을 쓴다.
# 유호님 10-26 밤(9번 세션에서 전해 옴) 「원본이랑 카메라 기법이 너무 다른데? … 원본이랑 카메라 기법도 완전히 똑같게 하라고」.
#   python -X utf8 카메라시간대_v5.py            → synk-vendor/…/영상/_카메라_시간대.json + 컷별 요약(광고 카드 넷도 재기만)
#   python -X utf8 카메라시간대_v5.py --지시문    → 지시문/영상_v5.json 컷마다 첫 문장(카메라)을 그 숫자로 다시 쓰고 「카메라_원본」 칸에 숫자를 남긴다
# 재는 법: 이웃 프레임끼리 화면 가장자리 띠(가운데 60%×60%를 뺀 곳 — 배경 · 앞가림)의 특징점(LK 흐름 + RANSAC 닮음 변환)으로
#   이동 · 배율 · 기울기를 재고(사람 움직임이 카메라로 섞이지 않게, 띠에 점이 모자라면 화면 전체), 가우스(σ 3프레임)로 느린 움직임과 떨림을 가른다.
#   움직임 = 느린 이동 속도가 화면 폭 0.12%/프레임(초당 약 3%)을 넘는 구간(2프레임 틈은 잇고, 3프레임보다 짧거나 이동이 1%보다 작으면 버림).
#   쪽은 카메라 기준(화면 속이 왼쪽으로 가면 카메라는 오른쪽 팬, 아래로 가면 위로 틸트), 크기는 그 구간의 이동(화면 폭 %),
#   가감속은 구간 앞 1/3 대 뒤 1/3 속도(1.5배). 밀기 · 당기기 = 배율이 0.1%/프레임 넘게 바뀌는 구간, 휘두름 = 한 프레임에 화면 폭 2.5% 넘게 감,
#   번짐 = 가운데 선명도(라플라시안 분산)가 그 컷 최고의 절반 아래인 처음 구간 — 그동안 카메라가 프레임마다 0.8% 넘게 움직였을 때만(어두운 컷에서 사람 · 물건이 나타나는 것은 빼려고). 시각은 클립 시각(쓰는 구간 시작 + 원본 컷 안 시각)으로 쓴다.
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
REEL = os.path.join(V, "원본", "DeucDo_SVU5.mp4")
SH = json.load(open(os.path.join(V, "원본", "원본_샷.json"), encoding="utf-8"))
CARDS = {11, 21, 27, 29}
W, H, FPS = 480, 270, 24.0
BAND = np.full((H, W), 255, np.uint8)
BAND[int(H * 0.2):int(H * 0.8), int(W * 0.2):int(W * 0.8)] = 0
SHOT = {   # 컷마다 크기 · 앵글(원본 첫 프레임과 시작 그림이 같은 것) — 움직임은 숫자로 붙인다
    "S01": "Wide shot at standing eye level", "S03": "Wide shot",
    "S02": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S04": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S06": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S09": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S13": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S15": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S23": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S31": "Low-angle medium shot from the eye level of someone sitting on the sofa, looking up at him",
    "S19": "Low-angle medium shot from low down in the dim room", "S25": "Low-angle shot from below",
    "S05": "Very close handheld shot of the three women sitting pressed together on the sofa",
    "S07": "Extreme close-up from just above her eye level, very shallow depth of field",
    "S12": "Extreme close-up from just above her eye level, very shallow depth of field",
    "S14": "Extreme close-up from just above her eye level, very shallow depth of field",
    "S18": "Extreme close-up from just above her eye level, very shallow depth of field",
    "S08": "Close-up, shallow depth of field", "S16": "Close-up, shallow depth of field",
    "S17": "Close-up, shallow depth of field", "S20": "Close-up, shallow depth of field",
    "S10": "Tight three-shot", "S22": "Extreme close-up, shallow depth of field",
    "S24": "Extreme close-up from above the huddled women, on the top of a bowed head",
    "S26": "Close-up very close to her, shallow depth of field", "S28": "Close-up, shallow depth of field",
    "S30": "Close-up of the curly-haired woman with the rose crown, shallow depth of field",
}


def gray(path, vf):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", vf + f",scale={W}:{H},format=gray", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W)


def step(a, b):
    """이웃 프레임 사이 화면 속 이동(화면 폭 비율) · 기울기(도, 시계 방향 +) · 배율. 가장자리 띠 점이 모자라면 화면 전체."""
    c = np.array([W / 2, H / 2, 1.0])
    for mk in (BAND, None):
        p0 = cv2.goodFeaturesToTrack(a, maxCorners=400, qualityLevel=0.01, minDistance=6, blockSize=7, mask=mk)
        if p0 is None or len(p0) < 12:
            continue
        p1, st, _ = cv2.calcOpticalFlowPyrLK(a, b, p0, None, winSize=(21, 21), maxLevel=3)
        ok = st.ravel() == 1
        if ok.sum() < 12:
            continue
        M, _ = cv2.estimateAffinePartial2D(p0[ok], p1[ok], method=cv2.RANSAC, ransacReprojThreshold=1.5)
        if M is None:
            continue
        cx, cy = M @ c
        return (cx - c[0]) / W, (cy - c[1]) / W, float(np.degrees(np.arctan2(M[1, 0], M[0, 0]))), float(np.hypot(M[0, 0], M[1, 0]))
    return 0.0, 0.0, 0.0, 1.0


def runs(mask, gap=2, minlen=3):
    out = []
    for i in np.flatnonzero(mask):
        if out and i - out[-1][1] <= gap + 1:
            out[-1][1] = i
        else:
            out.append([int(i), int(i)])
    return [(a, b) for a, b in out if b - a + 1 >= minlen]


def ease(sp):
    k = max(1, len(sp) // 3)
    a, b = float(np.mean(sp[:k])), float(np.mean(sp[-k:]))
    return "가속" if b > a * 1.5 else "감속" if a > b * 1.5 else "고르게"


def cam_dir(dx, dy):
    """화면 속 이동(dx 오른쪽 +, dy 아래 +)을 카메라 쪽으로 — 화면 속이 왼쪽으로 가면 카메라는 오른쪽 팬, 아래로 가면 위로 틸트."""
    cx, cy, m = -dx, -dy, max(abs(dx), abs(dy))
    out = []
    if abs(cx) >= 0.5 * m:
        out.append("오른쪽" if cx > 0 else "왼쪽")
    if abs(cy) >= 0.5 * m:
        out.append("아래" if cy > 0 else "위")
    return out


def profile(frames):
    st = np.array([(0.0, 0.0, 0.0, 1.0)] + [step(a, b) for a, b in zip(frames[:-1], frames[1:])])
    n = len(st)
    sig = 3.0 if n >= 12 else 1.5
    tr = np.cumsum(st[:, :2], 0) * 100
    slow = gaussian_filter1d(tr, sig, axis=0, mode="nearest")
    fast = tr - slow
    vel = np.gradient(slow, axis=0)
    speed = np.hypot(vel[:, 0], vel[:, 1])
    moves = []
    for i0, i1 in runs(speed > 0.12):
        d = slow[i1] - slow[i0]
        if np.hypot(*d) < 1.0:
            continue
        moves.append({"시작": round(i0 / FPS, 2), "끝": round(i1 / FPS, 2), "쪽": cam_dir(*d), "크기%": round(float(np.hypot(*d)), 1),
                      "빠르기%/초": round(float(speed[i0:i1 + 1].max() * FPS), 1), "가감속": ease(speed[i0:i1 + 1])})
    lz = gaussian_filter1d(np.cumsum(np.log(st[:, 3])) * 100, sig, mode="nearest")
    zv = np.gradient(lz)
    zooms = []
    for i0, i1 in runs(np.abs(zv) > 0.1):
        amt = float(lz[i1] - lz[i0])
        if abs(amt) < 1.5:
            continue
        zooms.append({"시작": round(i0 / FPS, 2), "끝": round(i1 / FPS, 2), "종류": "밀기" if amt > 0 else "당기기", "크기%": round(abs(amt), 1), "가감속": ease(np.abs(zv[i0:i1 + 1]))})
    rl = np.cumsum(st[:, 2])
    rs = gaussian_filter1d(rl, sig, mode="nearest")
    raw = np.hypot(st[:, 0], st[:, 1]) * 100
    sharp = np.array([cv2.Laplacian(f[int(H * .25):int(H * .75), int(W * .25):int(W * .75)], cv2.CV_64F).var() for f in frames])
    sn = sharp / max(sharp.max(), 1e-6)
    blur_end = 0.0
    if sn[0] < 0.5:
        j = int(np.argmax(sn >= 0.5)) if (sn >= 0.5).any() else n
        if j and raw[:max(j, 2)].mean() > 0.8:   # 그동안 카메라가 프레임마다 화면 폭 0.8% 넘게 움직였을 때만 번짐으로 본다
            blur_end = round(j / FPS, 2)
    return {"길이초": round(n / FPS, 2), "떨림%": round(float(np.sqrt((fast ** 2).sum(1).mean())), 2),
            "기울기흔들림°": round(float(np.std(rl - rs)), 1), "기울기변화°": round(float(rs[-1] - rs[0]), 1),
            "움직임": moves, "밀기당기기": zooms, "휘두름초": [round(i / FPS, 2) for i in np.flatnonzero(raw > 2.5)],
            "처음번짐초": blur_end, "선명도처음·가운데·끝": [round(float(sn[0]), 2), round(float(sn[n // 2]), 2), round(float(sn[-1]), 2)]}


EN_DIR = {"오른쪽": "pans right", "왼쪽": "pans left", "위": "tilts up", "아래": "tilts down"}
EN_EASE = {"가속": "speeding up", "감속": "slowing to a stop", "고르게": "at an even speed"}


def sentence(cid, p, use0, dur, clip):
    """원본 숫자로 카메라 문장(영어) — 시각은 클립 시각."""
    t = lambda s: f"{use0 + s:.1f} s"
    sh = p["떨림%"]
    if sh < 0.1 and not p["움직임"] and not p["밀기당기기"]:
        feel = "the camera is locked off and almost perfectly still, exactly like the original cut, with only a faint drift"
    elif sh < 0.4:
        feel = f"handheld with only a faint drift (about {sh:.1f}% of the frame width)"
    elif sh < 1.0:
        feel = f"handheld with a light, constant shake of about {sh:.1f}% of the frame width"
    elif sh < 3.0:
        feel = f"handheld with a strong, constant shake of about {sh:.1f}% of the frame width"
    else:
        feel = f"handheld with a violent shake of about {sh:.0f}% of the frame width, as if the operator is jostled"
    if p["기울기흔들림°"] >= 0.5:
        feel += f" and a roll wobble of about {p['기울기흔들림°']:.1f}°"
    parts = [feel]
    if use0 >= 0.5:
        parts.append(f"until {use0:.1f} s it holds the opening framing with that same handheld feel")
    events = []
    for m in p["움직임"]:
        verb = " and ".join(EN_DIR[d] for d in m["쪽"])
        events.append((m["시작"], f"from {t(m['시작'])} to {t(m['끝'])} it {verb} about {m['크기%']:.0f}% of the frame width, {EN_EASE[m['가감속']]}"))
    for z in p["밀기당기기"]:
        verb = "pushes in" if z["종류"] == "밀기" else "pulls back"
        events.append((z["시작"], f"from {t(z['시작'])} to {t(z['끝'])} it {verb} about {z['크기%']:.0f}%, {EN_EASE[z['가감속']]}"))
    if p["휘두름초"]:
        w = p["휘두름초"]
        if w[-1] - w[0] > 0.5:
            events.append((w[0], f"from {t(w[0])} to {t(w[-1])} it jolts hard again and again, with motion blur on each jolt"))
        else:
            events.append((w[0], f"at {t(w[0])} it whips fast with heavy motion blur"))
    for _, e in sorted(events):
        parts.append(e)
    if abs(p["기울기변화°"]) >= 2:
        parts.append(f"over the shot the picture tilts about {abs(p['기울기변화°']):.0f}° {'clockwise' if p['기울기변화°'] > 0 else 'counterclockwise'}")
    if p["처음번짐초"] >= 0.1:
        parts.append((f"from {use0:.1f} s" if use0 >= 0.5 else "right after the first frame") + f" it is motion-blurred until about {t(p['처음번짐초'])}")
    if use0 + dur < clip - 0.1:
        parts.append(f"after {use0 + dur:.1f} s it " + ("stays just as still" if feel.startswith("the camera is locked off") else "keeps the same handheld feel with no new moves"))
    return f"{SHOT[cid]}. Camera, copying the original cut exactly: " + "; ".join(parts) + "."


def ko(p):
    out = [f"떨림 {p['떨림%']}% · 기울기 흔들림 {p['기울기흔들림°']}°"]
    out += [f"{m['시작']}~{m['끝']}초 {'+'.join(m['쪽'])} {m['크기%']}% {m['가감속']}" for m in p["움직임"]]
    out += [f"{z['시작']}~{z['끝']}초 {z['종류']} {z['크기%']}% {z['가감속']}" for z in p["밀기당기기"]]
    if p["휘두름초"]:
        out.append(f"휘두름 {p['휘두름초'][0]}~{p['휘두름초'][-1]}초")
    if abs(p["기울기변화°"]) >= 2:
        out.append(f"기울기 {p['기울기변화°']}°")
    if p["처음번짐초"]:
        out.append(f"처음 {p['처음번짐초']}초 번짐")
    return " · ".join(out)


def main():
    reel = gray(REEL, "crop=720:404:0:438")
    data = {}
    for i, s in enumerate(SH, 1):
        p = profile(reel[s["f0"]:s["f1"]])
        data[i] = p
        print(f"#{i:<3}{'(광고 카드)' if i in CARDS else ''} {s['dur']:.2f}초 · {ko(p)}")
    json.dump(data, open(os.path.join(V, "영상", "_카메라_시간대.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if "--지시문" in sys.argv:
        path = os.path.join(HERE, "지시문", "영상_v5.json")
        spec = json.load(open(path, encoding="utf-8"))
        for c in spec["클립"]:
            n, (use0, dur) = c["컷"], c["쓰는 구간"]
            p = data[n]
            pr, mark = c["prompt"], "Camera, copying the original cut exactly: "
            if c["id"] == "S05":
                body = pr.split("ends exactly on the end frame: " if mark in pr else "ending exactly on the end frame: ", 1)[1]
            elif mark in pr:   # 다시 돌릴 때 — 앞서 쓴 카메라 문장(크기 · 앵글 + 숫자)을 떼어 낸다
                body = pr.split(mark, 1)[1].split(". ", 1)[1]
            else:              # 처음 — 옛 카메라 첫 문장을 떼어 낸다
                body = pr.split(". ", 1)[1]
            cam = sentence(c["id"], p, use0, dur, c["길이"])
            if c["id"] == "S05":   # 허리 높이에서 얼굴까지 오르는 원본 틸트 — 끝 그림(세 얼굴)에 닿는다
                cam = cam[:-1] + "; it starts at their waist height, on their clutched hands in their laps, and ends exactly on the end frame: "
                c["prompt"] = cam + body
            else:
                c["prompt"] = cam + " " + body
            c["카메라_원본"] = {k: v for k, v in p.items() if k != "선명도처음·가운데·끝"}
            print(c["id"], len(c["prompt"]), "자 ·", cam[:160])
        json.dump(spec, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        open(path, "a", encoding="utf-8").write("\n")


if __name__ == "__main__":
    main()
