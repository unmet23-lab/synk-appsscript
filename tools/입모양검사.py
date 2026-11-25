# 입모양 검사 — 노래하거나 말하는 컷의 입 움직임이 그 자리의 목소리와 맞는지 잰다(2026-11-26, 유호님 「몇군데 입모양이 안맞는부분이 있거든? …
#   체크가 가능하다면 입모양 체크 관문도 하나 넣어야할것같아」 · AI IDOL 「시스루」 최종본).
#
#   python -X utf8 tools/입모양검사.py <영상> [--종류 노래|말] [--목소리 <목소리만 wav>] [--노래컷 <몇 초,…|모두>] [--본것 <몇 초,…>] [--판표 <json>] [--곡 <원곡 wav>]
#          [--밖 <폴더>] [--json]
#   python -X utf8 tools/입모양검사.py --배움 <입.npz,…> --목소리들 <wav,…> --종류 <이름>     새 무게를 배워 tools/lib/입모양모델.npz에 더한다
#   python -X utf8 tools/입모양검사.py --자체시험                                             계산만 시험한다(영상 · 모델 없이)
#
# 왜 있나: 판을 받을 때 잰 것은 판 소리와 곡의 시각 차이뿐이었다. 소리가 곡에 맞아도 입은 (가) 첫 음절만 부르고 웃은 채 굳거나 (나) 낱말과 다른 모양으로
#   움직이거나 (다) 앞질러 움직인다. 또 편집에서 남은 구간을 다른 구절 자리에 붙이면 입이 다른 가사를 부른다. 그래서 다 만든 영상의 그림과 소리로 잰다.
# 어떻게 재나:
#   ① 컷을 장 차이로 나눈다(1/30초 장, 96×54).
#   ② 장마다 가장 큰 얼굴의 입 벌림 · 턱 · 오므림을 잰다(mediapipe FaceLandmarker — SYNK_FACE_PY 환경, 모델은 그 환경 옆 models/face_landmarker.task).
#   ③ 목소리(노래는 Demucs로 뗀 것)의 로그 멜 26칸 × 앞뒤 6장으로 입을 어림하는 선형 모델(tools/lib/입모양모델.npz)을 돌려, 컷 안에서 잰 입과의 상관을 본다.
#      자리 점수 = 그 자리에서의 상관(벌림 · 턱 · 오므림 평균), 최고 = 앞뒤 0.6초로 밀어 본 가운데 가장 높은 상관, 밀림 = 그때의 초(+면 입이 목소리보다 이르다).
#   ④ 입 굳음 = 목소리가 나오는데 입 움직임이 거의 없는 가장 긴 구간.
#   ⑤ --판표([[영상 안 초, 길이, 판 파일, 판 안 시작초], …])와 --곡을 주면 판에 딸린 소리와 곡의 시각 차이도 본다 — 남은 구간을 다른 구절에 붙인 컷을 잡는다.
# 판정: 걸림(--노래컷에 든 컷만) · 확인(그 밖의 컷, 짧거나 얼굴이 여럿이거나 값이 문턱 언저리) · 통과 · 입 안 움직임(알림) · 못 잼(얼굴 없음 · 작음 · 옆모습).
#   끝 코드 0 = 걸림 · 확인 없음, 2 = 확인만, 1 = 걸림 있음, 3 = 못 돌림.
# 맞춰 본 것(시스루 202초, 11-26): 잘 맞는 컷의 입을 일부러 0.2 · 0.3 · 0.5초 밀면 96 · 94 · 98%, 0.15초는 73%, 다른 자리 노래에 붙이면 78%가 문턱에 걸렸다.
#   그 판은 빼고 배운 모델로 쟀다(판 하나씩 빼기). 눈으로 본 것과 맞은 것: 로하 손가락 컷(첫 음절 뒤 굳음) · 새봄 흰 종이 컷 · 해인 클로즈업 · 윤슬 커튼 컷(0.15초 이름).
#   말 무게는 인터뷰 252초의 앞 절반으로 배워 뒤 절반을 쟀다: 2초 창 53개 가운데 83%가 0.1초 안, 자리 점수 0.15 아래는 4%. 노래 무게로 말을 재면 57%라 나눠 둔다.
# 한계: 노래 무게는 곡 하나(한국어 걸그룹 댄스팝)에서 배웠다 — 다른 곡 · 다른 목소리에서는 맞는 비율을 다시 재기 전까지 「확인」으로 읽는다(--배움으로 그 편 판을 더할 수 있다).
#   네 명이 함께 부르는 컷은 가장 큰 얼굴만 재서 확인까지만 낸다(시스루 0:56.5의 네 입 굳음은 못 잡았다 — 여럿이 부르는 컷은 눈으로 본다).
#   1.2초보다 짧은 컷, 옆모습, 웃는 컷은 값이 흔들린다. 점수가 낮아도 낱장 띠(결과 폴더의 띠_*.jpg — 노랑 = 목소리 크기, 초록 = 입 벌림)를 눈으로 보고 정한다.
import argparse
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "lib", "입모양모델.npz")
FACE_PY = os.environ.get("SYNK_FACE_PY", r"C:\SYNK-LoRA\tools\measure\venv\Scripts\python.exe")
FPS, SR, NFFT, CTX, NB = 30, 16000, 1024, 6, 26
W, H = 1280, 720
CH = (0, 1, 2)                     # 벌림 · 턱 · 오므림
FACE_MIN, MOVE_MIN = 90, 0.03      # 얼굴 높이(720p px) · 입 벌림 폭(얼굴 높이의 몫)
LOW, GAP, LAG = 0.15, 0.20, 0.12   # 자리 점수 · 최고와의 차 · 밀림(초)
STUCK, STUCK_MED = 0.85, 0.06      # 굳은 구간(초) · 움직임 가운데값
SHORT = 1.2                        # 이보다 짧은 컷은 걸림으로 올리지 않는다(밀림이 뚜렷할 때만)


def 재기(video, out):
    """measure 환경에서 돈다 — 장마다 얼굴 · 입."""
    import numpy as np
    import mediapipe as mp
    from mediapipe.tasks import python as tp
    from mediapipe.tasks.python import vision
    task = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(sys.executable))), "models", "face_landmarker.task")
    opt = vision.FaceLandmarkerOptions(base_options=tp.BaseOptions(model_asset_buffer=open(task, "rb").read()), running_mode=vision.RunningMode.IMAGE,
                                       num_faces=4, output_face_blendshapes=True, min_face_detection_confidence=0.4, min_face_presence_confidence=0.4)
    lm = vision.FaceLandmarker.create_from_options(opt)
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", video, "-an", "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    rows, n = [], 0
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3:
            break
        r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.frombuffer(b, np.uint8).reshape(H, W, 3).copy()))
        for k, l in enumerate(r.face_landmarks):
            a = np.array([(q.x * W, q.y * H, q.z * W) for q in l])
            x0, y0 = a[:, :2].min(0)
            x1, y1 = a[:, :2].max(0)
            d = lambda i, j: float(np.linalg.norm(a[i] - a[j]))
            face = d(10, 152) + 1e-6
            bl = {c.category_name: c.score for c in r.face_blendshapes[k]}
            yaw = float((a[1, 0] - (a[234, 0] + a[454, 0]) / 2) / (abs(a[454, 0] - a[234, 0]) + 1e-6))
            rows.append([n, k, x0, y0, x1 - x0, y1 - y0, (d(13, 14) + d(82, 87) + d(312, 317)) / 3 / face, d(78, 308) / face,
                         bl.get("jawOpen", 0), bl.get("mouthFunnel", 0), bl.get("mouthPucker", 0), yaw])
        n += 1
    np.savez_compressed(out, rows=np.array(rows, np.float32).reshape(-1, 12), n=n)


def 소리(f, rate=SR):
    import numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.float32)


def 특징(x):
    """30장/초 로그 멜(앞뒤 6장) · 장마다 목소리 크기(dB, 위 1%가 0)."""
    import numpy as np
    hop = SR / FPS
    n = int(len(x) * FPS / SR)
    win, S = np.hanning(NFFT), np.zeros((n, NFFT // 2 + 1))
    for i in range(n):
        c = int((i + .5) * hop) - NFFT // 2
        a, b = max(0, c), min(len(x), c + NFFT)
        s = np.zeros(NFFT)
        if b > a:
            s[a - c:b - c] = x[a:b]
        S[i] = np.abs(np.fft.rfft(s * win)) ** 2
    fr = np.linspace(0, SR / 2, NFFT // 2 + 1)
    mel, inv = (lambda f: 2595 * np.log10(1 + f / 700)), (lambda z: 700 * (10 ** (z / 2595) - 1))
    e = inv(np.linspace(mel(100), mel(7000), NB + 2))
    fb = np.maximum(0, np.minimum((fr[None] - e[:-2, None]) / (e[1:-1] - e[:-2])[:, None], (e[2:, None] - fr[None]) / (e[2:] - e[1:-1])[:, None]))
    M = np.log10(S @ fb.T + 1e-6)
    db = 10 * np.log10(S[:, (fr > 150) & (fr < 5000)].sum(1) + 1e-9)
    M = (M - M.mean(0)) / (M.std(0) + 1e-6)
    return np.concatenate([np.roll(M, -k, 0) for k in range(-CTX, CTX + 1)], 1), db - np.percentile(db, 99)


def 입줄(npz):
    """장마다 가장 큰 얼굴의 [벌림, 턱, 오므림, 얼굴 높이, yaw, 얼굴 수, x, y, w, h]."""
    import numpy as np
    z = np.load(npz)
    r, n = z["rows"], int(z["n"])
    out = np.full((n, 10), np.nan)
    for k in range(n if len(r) else 0):
        q = r[r[:, 0] == k]
        if len(q):
            b = q[np.argmax(q[:, 4] * q[:, 5])]
            out[k] = [b[6], b[8], b[9] + b[10], b[5], b[11], len(q), b[2], b[3], b[4], b[5]]
    return out


def 컷경계(video):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-an", "-vf", f"fps={FPS},scale=96:54", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 54, 96, 3).astype(np.float32)
    d = np.abs(np.diff(a, axis=0)).mean((1, 2, 3))
    out = [0]
    for i in range(len(d)):
        if d[i] > 16 and d[i] > 2.2 * np.median(d[max(0, i - 8):i + 9]) and i + 1 - out[-1] >= 6:
            out.append(i + 1)
    return out + [len(a)]


def 점수(P, tr, g, l=0):
    """g(장 번호)의 입과 l장 뒤 목소리로 어림한 입의 상관 평균."""
    import numpy as np
    j = g + l
    q = (j >= 0) & (j < len(P))
    if q.sum() < 12:
        return float("nan")
    v = [np.corrcoef(P[j[q], i], tr[g[q], c])[0, 1] if tr[g[q], c].std() > 1e-4 else 0.0 for i, c in enumerate(CH)]
    return float(np.mean(v))


def 굳음(tr, on):
    """목소리가 나오는 동안 입이 거의 안 움직인 가장 긴 초 · 움직임 가운데값."""
    import numpy as np
    d = sum(np.abs(np.diff(tr[:, c], prepend=tr[0, c])) / s for c, s in ((0, .1), (1, .4), (2, .6)))
    d = np.convolve(np.nan_to_num(d, nan=1.0), np.ones(5) / 5, "same")
    run = best = 0
    for i in range(len(d)):
        run = run + 1 if d[i] < .07 and not np.isnan(tr[i, 0]) and on[i] else 0
        best = max(best, run)
    ok = ~np.isnan(tr[:, 0])
    return best / FPS, float(np.median(d[ok])) if ok.any() else 1.0


def 판정(r, 노래컷):
    """한 컷의 값(r)을 걸림 · 확인 · 통과로. 까닭을 함께 낸다."""
    까닭 = []
    밀림 = abs(r["밀림"]) >= LAG and r["최고"] - r["자리"] > GAP
    if 밀림 and r["자리"] < LOW + .05:
        까닭.append(f"입이 목소리보다 {abs(r['밀림']):.2f}초 {'이르다' if r['밀림'] > 0 else '늦다'}(또는 다른 말을 한다)")
    elif r["자리"] < LOW and r["길이"] >= SHORT:
        까닭.append("입 모양이 목소리와 따로 움직인다")
    if r["굳음"] >= STUCK or r["움직임"] < STUCK_MED:
        까닭.append(f"목소리가 나오는데 입이 {r['굳음']:.1f}초 굳어 있다")
    입흠 = bool(까닭)
    if r.get("판어긋남") and r["자리"] < .35:      # 후렴처럼 판을 다른 자리에 다시 쓴 컷이 많아, 소리만 어긋난 것은 확인까지만
        까닭.append(r["판어긋남"])
    if not 까닭:
        return ("확인" if 밀림 and 노래컷 and r["길이"] >= SHORT else "통과"), (["값이 문턱 언저리"] if 밀림 and 노래컷 and r["길이"] >= SHORT else [])
    약함 = not 입흠 or r["얼굴"] > 1 or r["옆"] or (r["길이"] < SHORT and not (밀림 and r["최고"] >= .45))
    return ("걸림" if 노래컷 and not 약함 else "확인"), 까닭


def 판소리차(표, 곡):
    """컷마다 판에 딸린 소리(그 컷 구간)를 곡에 대 본 시각 차이. 세 창이 안 맞으면 None(곡과 다른 자리 · 소리 없음)."""
    import numpy as np
    from scipy.signal import fftconvolve
    song = 소리(곡, 8000)
    out = {}
    for t, L, f, x in 표:
        full = 소리(f, 8000)
        rs = []
        for a0, n in ((x, L), (max(0, x - .4), L + .4), (x, min(L + .5, 5 - x)), (.2, 4.6)):
            a = full[int(a0 * 8000):int((a0 + n) * 8000)]
            T = t + a0 - x
            s0 = max(0, T - 2)
            s = song[int(s0 * 8000):int((T + 2 + n) * 8000)]
            if len(a) < 6000 or len(s) <= len(a) or np.abs(a).max() < 1e-3:
                continue
            c = fftconvolve(s, a[::-1], "valid")
            q = np.concatenate(([0.0], np.cumsum(s.astype(float) ** 2)))
            e = np.sqrt((q[len(a):] - q[:-len(a)])[:len(c)] * float((a.astype(float) ** 2).sum())) + 1e-9
            rs.append(s0 + int((c / e).argmax()) / 8000 - T)
        med = float(np.median(rs)) if rs else 0.0
        out[round(t, 2)] = med if len(rs) >= 3 and sum(abs(r - med) < .06 for r in rs) >= 3 else None
    return out


def 띠(video, tr, db, a, b, out):
    import cv2
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a / FPS:.3f}", "-t", f"{(b - a) / FPS:.3f}", "-i", video, "-an", "-vf",
                          f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    T = []
    for i in range(0, len(fr), 3):
        k = a + i
        if k >= len(tr) or np.isnan(tr[k, 0]):
            continue
        x, y, w, h = tr[k, 6:10]
        cx, cy, s = x + w / 2, y + h * .75, max(w * .9, 40)
        c = fr[i][int(max(0, cy - s * .4)):int(cy + s * .4), int(max(0, cx - s / 2)):int(cx + s / 2)]
        if not c.size:
            continue
        c = cv2.copyMakeBorder(cv2.resize(c, (200, 160)), 0, 44, 0, 4, cv2.BORDER_CONSTANT)
        cv2.putText(c, "%.1f" % (k / FPS), (4, 180), 0, .5, (255, 255, 255), 1)
        v = min(1, max(0, (db[k] + 36) / 36)) if k < len(db) else 0
        cv2.rectangle(c, (56, 168), (56 + int(140 * v), 182), (0, 220, 255), -1)
        cv2.rectangle(c, (56, 186), (56 + int(140 * min(1, tr[k, 0] / .15)), 200), (80, 255, 80), -1)
        T.append(c)
    if T:
        while len(T) % 10:
            T.append(np.zeros_like(T[0]))
        cv2.imencode(".jpg", np.vstack([np.hstack(T[i:i + 10]) for i in range(0, len(T), 10)]))[1].tofile(out)


def 검사(o):
    import numpy as np
    밖 = o.밖 or os.path.splitext(o.영상)[0] + "_입모양"
    os.makedirs(밖, exist_ok=True)
    npz = os.path.join(밖, "입.npz")
    if not os.path.exists(npz) or os.path.getmtime(npz) < os.path.getmtime(o.영상):
        if not os.path.exists(FACE_PY):
            raise SystemExit(f"입 재는 환경이 없다: {FACE_PY} (SYNK_FACE_PY)")
        subprocess.run([FACE_PY, "-X", "utf8", os.path.abspath(__file__), "--재기", o.영상, npz], check=True, stderr=subprocess.DEVNULL)
    목소리 = o.목소리
    if not 목소리 and o.종류 == "노래":
        wav = os.path.join(밖, "소리.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", o.곡 or o.영상, "-vn", "-ac", "2", "-ar", "44100", wav], check=True)
        목소리 = os.path.join(밖, "소리_목소리.wav")
        if not os.path.exists(목소리):
            subprocess.run([sys.executable, "-X", "utf8", os.path.join(HERE, "노래검수.py"), "떼기", 밖, wav], check=True)
    X, db = 특징(소리(목소리 or o.영상))
    P = np.c_[X, np.ones(len(X))] @ np.load(MODEL)[o.종류]
    tr, 경계 = 입줄(npz), 컷경계(o.영상)
    모두 = o.노래컷 == "모두"
    본것 = [float(v) for v in (o.본것 or "").split(",") if v.strip()]
    정한 = [] if 모두 else [float(v) for v in (o.노래컷 or "").split(",") if v.strip()]
    차 = 판소리차(json.load(open(o.판표, encoding="utf-8")), o.곡 or o.영상) if o.판표 else {}
    줄 = []
    for a, b in zip(경계, 경계[1:]):
        t = a / FPS
        seg = tr[a:b]
        ok = ~np.isnan(seg[:, 0]) & (seg[:, 3] >= FACE_MIN)
        r = {"시각": round(t, 2), "길이": round((b - a) / FPS, 2)}
        if ok.sum() < max(12, .4 * (b - a)):
            줄.append({**r, "판정": "못 잼", "까닭": ["얼굴이 없거나 작다"]})
            continue
        g = np.arange(a, b)[ok]
        on = (db[a:b] > -20) if b <= len(db) else np.ones(b - a, bool)
        r["벌림폭"] = round(float(np.percentile(seg[ok, 0], 95) - np.percentile(seg[ok, 0], 5)), 3)
        r["얼굴"], r["옆"] = int(np.nanmedian(seg[:, 5])), bool(abs(np.nanmedian(seg[:, 4])) > .6)
        노래컷 = 모두 or any(t - .1 <= s < b / FPS - .1 for s in 정한)
        if r["벌림폭"] < MOVE_MIN:
            줄.append({**r, "판정": "걸림" if 노래컷 and not 모두 and on.mean() > .6 else "입 안 움직임", "까닭": ["입을 거의 움직이지 않는다"]})
            continue
        c = np.array([점수(P, tr, g, l) for l in range(-18, 19)])
        i = int(np.nanargmax(c))
        r["자리"], r["최고"], r["밀림"] = round(float(c[18]), 2), round(float(c[i]), 2), round((i - 18) / FPS, 2)
        r["굳음"], r["움직임"] = (round(v, 2) for v in 굳음(seg, on))
        if 차 and min((abs(k - t) for k in 차), default=9) < .1:
            v = 차[min(차, key=lambda k: abs(k - t))]
            if v is None:
                r["판어긋남"] = "판에 딸린 소리가 이 자리의 곡과 맞지 않는다(다른 구절의 남은 구간인지 본다)"
            elif abs(v) > .08:
                r["판어긋남"] = f"판에 딸린 소리가 곡보다 {abs(v):.2f}초 {'이르다' if v > 0 else '늦다'}"
        r["판정"], r["까닭"] = 판정(r, 노래컷)
        if r["판정"] == "걸림" and any(t - .1 <= s < b / FPS - .1 for s in 본것):
            r["판정"], r["까닭"] = "확인", r["까닭"] + ["눈으로 보고 넘김"]
        if r["판정"] in ("걸림", "확인"):
            r["띠"] = f"띠_{t:06.2f}.jpg"
            띠(o.영상, tr, db, a, b, os.path.join(밖, r["띠"]))
        줄.append(r)
    out = {"영상": os.path.abspath(o.영상), "종류": o.종류, "컷": 줄, "걸림": sum(r["판정"] == "걸림" for r in 줄), "확인": sum(r["판정"] == "확인" for r in 줄)}
    json.dump(out, open(os.path.join(밖, "입모양.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if o.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        for r in 줄:
            if r["판정"] in ("걸림", "확인"):
                print(f"{r['판정']} {int(r['시각'] // 60)}:{r['시각'] % 60:05.2f} {r['길이']:.1f}초 자리 {r.get('자리', '-')} 최고 {r.get('최고', '-')} @{r.get('밀림', '-')} · {' · '.join(r['까닭'])}")
        print(f"입모양 검사: 컷 {len(줄)} · 걸림 {out['걸림']} · 확인 {out['확인']} · 통과 {sum(r['판정'] == '통과' for r in 줄)} · "
              f"입 안 움직임 {sum(r['판정'] == '입 안 움직임' for r in 줄)} · 못 잼 {sum(r['판정'] == '못 잼' for r in 줄)} · 띠와 값은 {밖}")
    return 1 if out["걸림"] else 2 if out["확인"] else 0


def 배움(npzs, wavs, 이름, lam=1000.0):
    import numpy as np
    A, Y = [], []
    for f, w in zip(npzs, wavs):
        X, _ = 특징(소리(w))
        tr = 입줄(f)
        n = min(len(X), len(tr))
        ok = ~np.isnan(tr[:n, 0])
        y = tr[:n][ok][:, list(CH)]
        A.append(X[:n][ok])
        Y.append((y - y.mean(0)) / (y.std(0) + 1e-6))
    A = np.vstack(A)
    A1 = np.c_[A, np.ones(len(A))]
    w = np.linalg.solve(A1.T @ A1 + lam * np.eye(A1.shape[1]), A1.T @ np.vstack(Y))
    옛 = dict(np.load(MODEL)) if os.path.exists(MODEL) else {}
    옛[이름] = w.astype(np.float32)
    np.savez_compressed(MODEL, **옛)
    print(f"배움 {이름}: 장 {len(A)} → {MODEL}")


def 자체시험():
    import numpy as np
    rng = np.random.default_rng(0)
    n = 300
    base = np.convolve(rng.standard_normal(n + 8), np.ones(9) / 9, "valid")
    P = np.stack([base, np.roll(base, 1) * .8 + rng.standard_normal(n) * .1, -base + rng.standard_normal(n) * .1], 1)
    tr = np.full((n, 10), 0.0)
    tr[:, 0], tr[:, 1], tr[:, 2], tr[:, 3] = .06 + P[:, 0] * .05, P[:, 1], P[:, 2], 300
    g = np.arange(60, 120)
    맞음, 밀린 = 점수(P, tr, g, 0), 점수(P, np.roll(tr, -9, 0), g, 0)
    curve = [점수(P, np.roll(tr, -9, 0), g, l) for l in range(-18, 19)]
    assert 맞음 > .9 and 밀린 < .5 and int(np.argmax(curve)) - 18 == 9, (맞음, 밀린, int(np.argmax(curve)) - 18)
    기본 = {"길이": 2.0, "자리": .5, "최고": .55, "밀림": 0.0, "굳음": .1, "움직임": .3, "얼굴": 1, "옆": False}
    assert 판정(기본, True)[0] == "통과"
    assert 판정({**기본, "자리": -.03, "최고": .4, "밀림": .43}, True)[0] == "걸림"
    assert 판정({**기본, "자리": -.03, "최고": .4, "밀림": .43}, False)[0] == "확인"
    assert 판정({**기본, "자리": .05, "최고": .38, "밀림": .07, "길이": 1.1}, True)[0] == "통과"
    assert 판정({**기본, "자리": -.05, "최고": .63, "밀림": .17, "길이": 1.1}, True)[0] == "걸림"
    assert 판정({**기본, "굳음": 1.37, "움직임": .05}, True)[0] == "걸림"
    assert 판정({**기본, "자리": -.2, "최고": .3, "밀림": .5, "얼굴": 4}, True)[0] == "확인"
    assert 판정({**기본, "판어긋남": "어긋남"}, True)[0] == "통과"
    assert 판정({**기본, "자리": .3, "판어긋남": "어긋남"}, True)[0] == "확인"
    assert 판정({**기본, "자리": -.1, "최고": .34, "밀림": -.3, "길이": 1.1}, True)[0] == "확인"
    s, m = 굳음(np.full((60, 10), .05), np.ones(60, bool))
    assert s > 1.5 and m < .01
    if os.path.exists(MODEL):
        z = np.load(MODEL)
        assert {"노래", "말"} <= set(z) and all(z[k].shape == (NB * (2 * CTX + 1) + 1, 3) for k in ("노래", "말"))
    X, db = 특징(np.sin(np.arange(SR * 2) * .1).astype(np.float32))
    assert X.shape == (60, NB * (2 * CTX + 1)) and len(db) == 60
    print("자체시험 통과")


def main(argv=None):
    sys.stdout.reconfigure(encoding="utf-8")
    a = sys.argv[1:] if argv is None else argv
    if a[:1] == ["--재기"]:
        재기(a[1], a[2])
        return 0
    if a[:1] == ["--자체시험"]:
        자체시험()
        return 0
    ap = argparse.ArgumentParser()
    ap.add_argument("영상", nargs="?")
    ap.add_argument("--종류", default="노래")
    ap.add_argument("--목소리")
    ap.add_argument("--노래컷", default="", help="입이 맞아야 하는 컷이 든 초(쉼표) 또는 「모두」. 안 주면 걸림 없이 확인만 낸다")
    ap.add_argument("--본것", help="띠를 눈으로 보고 괜찮다고 정한 컷이 든 초(쉼표) — 걸림을 확인으로 내린다")
    ap.add_argument("--판표")
    ap.add_argument("--곡")
    ap.add_argument("--밖")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--배움")
    ap.add_argument("--목소리들")
    o = ap.parse_args(a)
    if o.배움:
        배움(o.배움.split(","), o.목소리들.split(","), o.종류)
        return 0
    if not o.영상 or not os.path.exists(o.영상):
        ap.error("영상 파일이 없다")
    try:
        return 검사(o)
    except (subprocess.CalledProcessError, KeyError) as e:
        print("입모양 검사를 못 돌렸다:", e)
        return 3


if __name__ == "__main__":
    sys.exit(main())
