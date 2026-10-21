# 1차 다섯 명 H3 루프 점검(2026-10-21): 반복 이음매 · 움직임 크기 · 대표 사진과의 차 · 입 둘레 변화 · 얼굴 5장 · 웹판.
#   1기 점검(.tmp/pulse-loops-20261018/check.py)과 같은 잣대에, H3 버릇(가운데에서 입을 연다 — 현장노트 영상 「끝 프레임을 고정한 H3」)을
#   보려고 입 둘레 칸의 차를 더 잰다. 마지막 장(106번)은 첫 장과 같은 그림이라 웹판은 0~105번(106장)을 24fps로 담는다.
#   쓰기: <python> -X utf8 루프_점검.py <루프 폴더> [코드…]   → <폴더>/점검/<코드>_얼굴.jpg · 점검.json · <코드>_web.mp4
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

CAST = r"C:\SYNK-LoRA\casting\wave1_20261019"
HERO = {"F05": "F05_c2.jpg", "M04": "M04_c2.jpg", "F06": "F06_c1.jpg", "F07": "F07_c1.jpg", "M05": "M05_h1.jpg"}
USE = 106  # 0~105번
# 눈 감은 프레임 수(10-21 Fable 게이트 뒤): 눈 높이/폭이 첫 장의 60% 아래인 프레임. 0.2초 깜빡임은 5장 안팎이고, 은정 s42(0.65초)는 16장,
# 채원 s42는 두 번 감았다. MediaPipe 얼굴 표지(C:\SYNK-LoRA\tools\measure 가상환경)가 없으면 이 칸은 비운다.
LANDMARKER = r"C:\SYNK-LoRA\tools\measure\models\face_landmarker.task"


def eyes_closed(big):
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
    except ImportError:
        return None, None
    det = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(base_options=mp_python.BaseOptions(model_asset_path=LANDMARKER), num_faces=1))
    ratios = []
    for f in big[:USE]:
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f.astype(np.uint8))))
        if not r.face_landmarks:
            ratios.append(None)
            continue
        lm = r.face_landmarks[0]
        P = lambda i: np.array([lm[i].x, lm[i].y])
        ear = lambda a, b, c, d: np.linalg.norm(P(a) - P(b)) / max(np.linalg.norm(P(c) - P(d)), 1e-6)
        ratios.append((ear(159, 145, 33, 133) + ear(386, 374, 362, 263)) / 2)  # 위·아래 눈꺼풀 / 눈 폭(양쪽 평균)
    base = ratios[0] or max(r for r in ratios if r)
    closed = [i for i, r in enumerate(ratios) if r is not None and r < base * 0.6]
    runs = sum(1 for k, i in enumerate(closed) if k == 0 or closed[k - 1] != i - 1)  # 감은 덩어리 수(깜빡임 횟수)
    return len(closed), runs


def frames(path, w, h):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-vf", f"scale={w}:{h}", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "pipe:1"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32)


def check(folder, code, seed_file):
    src = os.path.join(folder, seed_file)
    a = frames(src, 384, 512)
    n = len(a)
    g = a.mean(axis=3)
    hero = np.asarray(Image.open(os.path.join(CAST, HERO[code])).convert("L").resize((384, 512), Image.LANCZOS)).astype(np.float32)
    use = g[:USE]
    steps = [float(np.abs(use[i] - use[i - 1]).mean()) for i in range(1, len(use))]
    # 얼굴 칸(대표 사진 틀: 위 가운데)과 입 둘레 칸(얼굴 칸의 아래 가운데)
    fx0, fy0, fw = int(384 * 0.24), int(512 * 0.10), int(384 * 0.52)
    face = use[:, fy0:fy0 + fw, fx0:fx0 + fw]
    mx0, my0, mw, mh = fx0 + int(fw * 0.28), fy0 + int(fw * 0.62), int(fw * 0.44), int(fw * 0.2)
    mouth = use[:, my0:my0 + mh, mx0:mx0 + mw]
    face_d = [float(np.abs(f - face[0]).mean()) for f in face]
    mouth_d = [float(np.abs(f - mouth[0]).mean()) for f in mouth]
    # 얼굴 칸 평균 색이 첫 장에서 가장 멀어진 정도(10-21: 민재 hold s101에 0.75~1.75초 햇빛 자국이 생겼다 사라졌다 — 깜빡임·입은 평균을 거의 안 바꾼다)
    face_rgb = a[:USE, fy0:fy0 + fw, fx0:fx0 + fw].mean(axis=(1, 2))
    light_d = np.abs(face_rgb - face_rgb[0]).sum(axis=1)
    row = {
        "file": seed_file, "frames": n, "used": USE, "seconds": round(USE / 24, 2),
        "loopSeam": round(float(np.abs(use[-1] - use[0]).mean()), 2),
        "maxStep": round(max(steps), 2),
        "maxFromFirst": round(max(float(np.abs(x - use[0]).mean()) for x in use), 2),
        "heroVsFirst": round(float(np.abs(hero - use[0]).mean()), 2),
        "faceMax": round(max(face_d), 2), "faceMaxAt": round(int(np.argmax(face_d)) / 24, 2),
        "mouthMax": round(max(mouth_d), 2), "mouthMaxAt": round(int(np.argmax(mouth_d)) / 24, 2),
        "faceLightMax": round(float(light_d.max()), 2), "faceLightMaxAt": round(int(np.argmax(light_d)) / 24, 2),
    }
    # 얼굴 5장(0 · 1.1 · 2.2 · 3.3 · 4.2초), 원본 크기에서 자른다
    big = frames(src, 768, 1024)
    row["eyesClosedFrames"], row["blinks"] = eyes_closed(big)
    tiles = []
    for t in (0.0, 1.1, 2.2, 3.3, 4.2):
        i = min(int(round(t * 24)), USE - 1)
        f = big[i]
        x0, y0, w = int(768 * 0.2), int(1024 * 0.13), int(768 * 0.6)
        tiles.append(Image.fromarray(f[y0:y0 + w, x0:x0 + w].astype(np.uint8)).resize((360, 360), Image.LANCZOS))
    sheet = Image.new("RGB", (360 * 5 + 40, 360), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * 370, 0))
    out = os.path.join(folder, "점검")
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, f"{code}_{os.path.splitext(seed_file)[0]}_얼굴.jpg"), quality=88)
    # 웹판: 720×960, 0~105번, 소리 없음(1기와 같은 인코딩)
    web = os.path.join(out, f"{code}_{os.path.splitext(seed_file)[0]}_web.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-an", "-vf",
                    f"select=lt(n\\,{USE}),setpts=N/24/TB,scale=720:960:flags=lanczos,format=yuv420p",
                    "-r", "24", "-c:v", "libx264", "-crf", "25", "-preset", "slow", "-movflags", "+faststart", web], check=True)
    row["webKB"] = os.path.getsize(web) // 1024
    return row


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    folder = sys.argv[1]
    want = set(sys.argv[2:])
    rows = {}
    path = os.path.join(folder, "점검", "점검.json")
    if os.path.exists(path):
        rows = json.load(open(path, encoding="utf-8"))
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".mp4") or "_h3_" not in f:
            continue
        code = f.split("_")[0]
        if want and code not in want:
            continue
        rows[os.path.splitext(f)[0]] = r = check(folder, code, f)
        print(os.path.splitext(f)[0], json.dumps(r, ensure_ascii=False), flush=True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(rows, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
