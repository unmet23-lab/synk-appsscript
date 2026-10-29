"""리허설(10-29) 자체 검수 — 보여 드리기 전에 재서 찾는다(사라짐 · 급한 변화 · 끝 3초 · 소리).

  python -X utf8 자체검수.py <완성본.mp4> [--원본 R1,R2,R3,R4]
  → 같은 폴더 <이름>_검수/ : 띠.jpg(0.25초 간격 한 줄에 컷 하나), 끝3초.jpg, 검수.json(이웃 프레임 차 상위 · 컷 경계 · 소리 크기 · 받아쓰기)
이웃 프레임 차는 160×284 흑백 평균 절대차. 컷 경계(2.4 · 4.8 · 7.8 · 10.8초) 밖에서 그 컷 중앙값의 3배를 넘으면 「급한 변화」 후보로 적는다.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

FPS = 24
BOUNDS = [0.0, 2.4, 4.8, 7.8, 10.8, 15.0]


def read(path, w, h):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def main():
    src = sys.argv[1]
    out = os.path.splitext(src)[0] + "_검수"
    os.makedirs(out, exist_ok=True)
    small = read(src, 160, 284).astype(np.float32).mean(3)
    d = np.abs(np.diff(small, axis=0)).mean((1, 2))
    rep = {"프레임": int(len(small)), "길이초": round(len(small) / FPS, 3), "급한변화": [], "컷별중앙값": []}
    for a, b in zip(BOUNDS[:-1], BOUNDS[1:]):
        i0, i1 = int(round(a * FPS)), int(round(b * FPS)) - 1
        seg = d[i0:i1 - 1] if i1 - 1 > i0 else d[i0:i1]
        med = float(np.median(seg)) if len(seg) else 0.0
        rep["컷별중앙값"].append({"구간": f"{a}–{b}", "중앙": round(med, 2), "최대": round(float(seg.max()) if len(seg) else 0, 2)})
        for k in range(i0, i1 - 1):
            if d[k] > max(3 * med, 2.5):
                rep["급한변화"].append({"초": round((k + 1) / FPS, 3), "차": round(float(d[k]), 2), "중앙": round(med, 2)})
    big = read(src, 270, 480)
    rows = []
    for a, b in zip(BOUNDS[:-1], BOUNDS[1:]):
        ts = np.arange(a, b - 1e-6, 0.25)
        tiles = [big[min(len(big) - 1, int(round(t * FPS)))] for t in ts]
        rows.append(np.concatenate(tiles + [np.full((480, 270 * (17 - len(tiles)), 3), 255, np.uint8)] if len(tiles) < 17 else tiles[:17], 1))
    Image.fromarray(np.concatenate(rows, 0)).save(os.path.join(out, "띠.jpg"), quality=85)
    tail = [big[min(len(big) - 1, int(round(t * FPS)))] for t in np.arange(12.0, 15.0, 0.25)]
    Image.fromarray(np.concatenate(tail, 1)).save(os.path.join(out, "끝3초.jpg"), quality=88)
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", src, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True,
                       encoding="utf-8", errors="replace").stderr
    s = r[r.rfind("Summary:"):]
    rep["소리"] = " ".join(l.strip() for l in s.splitlines() if any(k in l for k in ("I:", "LRA:", "Peak:")))
    try:
        from faster_whisper import WhisperModel
        m = WhisperModel("medium", device="cpu", compute_type="int8")
        segs, _ = m.transcribe(src, language="ko", word_timestamps=True)
        rep["받아쓰기"] = " ".join(f"{w.word.strip()}[{w.start:.2f}]" for sg in segs for w in sg.words)
    except Exception as e:  # noqa: BLE001
        rep["받아쓰기"] = f"못 함: {e}"
    json.dump(rep, open(os.path.join(out, "검수.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(rep, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
