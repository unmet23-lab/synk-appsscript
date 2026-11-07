# 사람이 스스로 움직이는지 잰다 — 카메라 움직임을 걷어 낸 나머지(2026-11-07, Claude · 유호님 「카메라 구도는 괜찮은데 왜 모델이 그냥 굳어있는것같지? 모든 영상이 그래」).
# 편집전점검.py의 「움직임」(작은 회색 장 차이)은 카메라가 움직이면 사람이 굳어 있어도 값이 커서 「카메라만 움직이고 사람은 멈춘」 판을 못 잡는다.
#   python -X utf8 사람움직임.py <mp4> [<시작 장> <장 수>] [--이름 <이름>]          → 한 줄
#   python -X utf8 사람움직임.py --판 <판 id…>                                       → 받음 폴더 판마다 한 줄(판 전체)
# 숫자(480×270 회색, 이웃 장 Farneback 흐름, 장당 px):
#   카메라 — 흐름 전체에 RANSAC 호모그래피를 맞춘 화면 전체 움직임의 중앙값(배경이 넓다는 가정)
#   사람 — 그 호모그래피로 설명 안 되는 나머지 흐름의, 사람 자리(YuNet 얼굴 둘레로 잡은 몸 상자 — 얼굴이 없으면 rembg 사람 실루엣, 그것도 없으면 화면에서
#          나머지가 큰 위 10%) 평균에서 사람 밖 나머지 중앙값(바탕 잡음)을 뺀 값
#   판정 — 사람 < 0.12 이고 카메라 > 사람 × 3 이면 「카메라만 · 사람 굳음」, 사람 < 0.12 이고 카메라도 작으면 「멈춘 화면」
#          (자는 원본 MARAH 사람 컷과 우리 4번 판으로 맞췄다 — 사람움직임 기록은 저장소 docs/마케팅/제작양식/광고영상_슬롭점검표.md 26번)
#   원본과 견줄 때 — 원본이 손에 든 카메라(내내 흔들림)면 흔들림 · 번짐이 원본 값을 몇 배 부풀려 「원본 절반 아래」가 거의 모든 컷에 걸린다(10번 GE 37컷 중
#          고정 카메라 17 · 24만 맞음, 11-07 10번 세션). 원본 대비는 고정 카메라 원본 컷에서만 보고, 나머지는 0.12 문턱으로 본다
#   못 재는 컷 — 실루엣이 화면의 80%를 넘는 얼굴 극접사(「가까움 · 눈으로 판정」 — 카메라와 못 가르고 4장 무늬의 튐도 셈)와, 렌즈 앞 유리 겹상이 사람 곁에서
#          움직이는 컷(겹상도 실루엣에 들어가 사람 값을 부풀림 — p4-24m 64장부터 0.29, 눈으로는 굳음). 이 둘은 1/8초 띠를 눈으로 본다
import argparse
import json
import os
import subprocess
import sys

import cv2
import numpy as np

W, H = 480, 270
GOT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
MOD = os.path.join(os.path.expanduser("~"), ".rembg", "models", "yunet")
FD = cv2.FaceDetectorYN.create(os.path.join(MOD, "face_detection_yunet_2023mar.onnx"), "", (W, H), 0.6, 0.3, 5000)
FROZEN = 0.12   # 사람 움직임(장당 px, 480폭) 아래면 굳음
CLOSE = 0.6     # 얼굴로 잡은 몸 상자가 화면의 이 몫을 넘으면 상자 대신 실루엣으로 사람 자리를 잡는다
CLOSE_SIL = 0.8 # 실루엣이 화면의 이 몫을 넘는 얼굴 극접사는 바탕이 없어 호모그래피가 사람 움직임을 카메라로 먹는다(p4-23b 0.01로 나왔다) —
                #   카메라와 가르지 않고 사람 자리에서 많이 움직이는 쪽(흐름 위 25%) 평균을 「사람」으로 낸다(카메라 0 · 판정 「가까움」)


def frames(path, a=0, k=None):
    vf = f"select='gte(n\\,{a})',scale={W}:{H}" if k is None else f"select='between(n\\,{a}\\,{a + k - 1})',scale={W}:{H}"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-an", "-fps_mode", "passthrough", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def body_box(img):
    """가장 큰 얼굴 둘레의 몸 상자(x0, y0, x1, y1) — 얼굴 폭 기준 옆 2.2배, 위 0.6배, 아래 6배"""
    _, faces = FD.detect(img)
    if faces is None or not len(faces):
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])[:4]
    return (max(0, int(x - 2.2 * w)), max(0, int(y - 0.6 * h)), min(W, int(x + w + 2.2 * w)), min(H, int(y + h + 6 * h)))


_SEG = None


def silhouette(img):
    """사람 실루엣(rembg u2net_human_seg, 480×270에 한 장 0.6초) — 얼굴이 안 잡히는 뒷모습 · 실루엣 컷의 사람 자리.
    「나머지가 큰 위 10%」는 기계 · 배경 시차를 집어 굳은 판을 정상으로 냈다(10번 뒷모습 손짓 판 0.231 「-」 — 실루엣으로는 0.11, 11-07 10번 세션)"""
    global _SEG
    from rembg import new_session, remove
    if _SEG is None:
        _SEG = new_session("u2net_human_seg")
    m = np.asarray(remove(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), session=_SEG, only_mask=True)) > 128
    if m.mean() < 0.01:
        return None
    return cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0


def pairs(path, a=0, k=None):
    """이웃 장마다 (카메라, 사람, 사람 자리를 잡은 길 「얼굴」 · 「실루엣」 · 「위10%」) — 장 수 − 1개"""
    fr = frames(path, a, k)
    gs = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in fr]
    ys, xs = np.mgrid[4:H:8, 4:W:8]
    pts = np.stack([xs.ravel(), ys.ravel()], 1).astype(np.float32)
    out, mask, mask_at = [], None, -99
    for i in range(len(gs) - 1):
        fl = cv2.calcOpticalFlowFarneback(gs[i], gs[i + 1], None, 0.5, 3, 15, 3, 5, 1.2, 0)
        d = fl[pts[:, 1].astype(int), pts[:, 0].astype(int)]
        Hm, _ = cv2.findHomography(pts, pts + d, cv2.RANSAC, 0.6)
        if Hm is None:
            continue
        model = cv2.perspectiveTransform(pts[None], Hm)[0] - pts
        res = np.linalg.norm(d - model, axis=1)
        cam = float(np.median(np.linalg.norm(model, axis=1)))
        bb = body_box(fr[i])
        if bb:
            x0, y0, x1, y1 = bb
            inside = (pts[:, 0] >= x0) & (pts[:, 0] < x1) & (pts[:, 1] >= y0) & (pts[:, 1] < y1)
            if inside.mean() <= CLOSE and inside.sum() > 20 and (~inside).sum() > 20:
                out.append((cam, float(res[inside].mean() - np.median(res[~inside])), "얼굴"))
                continue
        # 얼굴이 없거나 몸 상자가 화면을 너무 덮으면(얼굴이 큰 허리 위 컷은 상자가 100%, 실루엣은 50%) 실루엣으로 사람 자리를 잡는다
        if i - mask_at >= 4:                     # 실루엣은 4장마다 새로 뜬다(사람이 크게 안 움직이는 동안은 같은 자리)
            mask, mask_at = silhouette(fr[i]), i
        if mask is not None:
            inside = mask[pts[:, 1].astype(int), pts[:, 0].astype(int)]
            if inside.mean() > CLOSE_SIL:        # 얼굴 극접사 — 바탕이 없어 카메라와 못 가른다: 사람 자리에서 많이 움직이는 쪽(위 25%) 평균
                mag = np.sort(np.linalg.norm(d[inside], axis=1))
                out.append((0.0, float(mag[-max(10, len(mag) // 4):].mean()), "가까움"))
                continue
            if inside.sum() > 20 and (~inside).sum() > 20:
                out.append((cam, float(res[inside].mean() - np.median(res[~inside])), "실루엣"))
                continue
        top = np.sort(res)[-max(20, len(res) // 10):]
        out.append((cam, float(top.mean() - np.median(res)), "위10%"))
    return out


def verdict(c, p):
    return "카메라만 · 사람 굳음" if (p < FROZEN and c > 3 * p and c > 0.15) else ("멈춘 화면" if p < FROZEN else "-")


def summary(ps):
    if not ps:
        return None
    c, p = float(np.mean([x[0] for x in ps])), max(0.0, float(np.mean([x[1] for x in ps])))
    close = sum(x[2] == "가까움" for x in ps)
    v = verdict(c, p)
    if close > len(ps) / 2:   # 얼굴 극접사 — 카메라와 못 가르고 4장 무늬의 튐도 움직임으로 세니 값은 참고만, 판정은 1/8초 띠를 눈으로
        v = "가까움 · 눈으로 판정"
    return {"장": len(ps) + 1, "카메라": round(c, 3), "사람": round(p, 3), "얼굴 장": sum(x[2] == "얼굴" for x in ps),
            "실루엣 장": sum(x[2] == "실루엣" for x in ps), "가까운 장": close, "판정": v}


def measure(path, a=0, k=None):
    ps = pairs(path, a, k)
    return summary(ps) if len(ps) >= 2 else None


def windows(ps, fps=24, win=24, step=12):
    """판 안 1초 창(0.5초씩)마다 (시작 초, 카메라, 사람, 판정) — 사람이 살아 있는 구간을 고르는 데 쓴다"""
    out = []
    for w0 in range(0, max(1, len(ps) - win + 1), step):
        s = summary(ps[w0:w0 + win])
        if s:
            out.append((round(w0 / fps, 2), s["카메라"], s["사람"], s["판정"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mp4", nargs="?")
    ap.add_argument("a", nargs="?", type=int, default=0)
    ap.add_argument("k", nargs="?", type=int, default=None)
    ap.add_argument("--판", nargs="*")
    ap.add_argument("--이름", default=None)
    o = ap.parse_args()
    jobs = [(p, os.path.join(GOT, p + ".mp4"), 0, None) for p in (o.판 or [])] or [(o.이름 or os.path.basename(o.mp4), o.mp4, o.a, o.k)]
    for name, path, a, k in jobs:
        r = measure(path, a, k)
        print(f"{name:24s} " + (json.dumps(r, ensure_ascii=False) if r else "장이 모자람"))


if __name__ == "__main__":
    main()
