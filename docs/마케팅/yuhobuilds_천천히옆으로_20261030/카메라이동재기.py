"""yuhobuilds Y24 — AI 영상의 카메라가 실제로 얼마나 옆으로 움직였나 잰다(2026-10-30).

앞뒤 프레임(0.1초 간격)의 가로 어긋남을 위상상관으로 재서 더해, 화면 폭 대비 %로 적는다.
시작 그림과 첫 프레임 · 끝 프레임을 나란히 둔 그림도 만든다(어디에 없던 것이 생겼는지 눈으로 본다).

    python -I 카메라이동재기.py <영상.mp4> <출력 폴더> [--시작 <시작 그림>]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


def frames(src, fps=10, w=360):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", src], capture_output=True, text=True).stdout.strip().split(",")
    W, H = int(probe[0]), int(probe[1])
    h = round(H * w / W / 2) * 2
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"fps={fps},scale={w}:{h},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32), (W, H)


def shift(a, b):
    """b가 a에 견줘 몇 화소 옮겨졌나(가로, 세로) — 창 함수를 씌운 위상상관."""
    win = np.outer(np.hanning(a.shape[0]), np.hanning(a.shape[1]))
    A = np.fft.fft2((a - a.mean()) * win)
    B = np.fft.fft2((b - b.mean()) * win)
    r = A * np.conj(B)
    r /= np.abs(r) + 1e-9
    c = np.fft.ifft2(r).real
    y, x = np.unravel_index(np.argmax(c), c.shape)
    if y > a.shape[0] // 2:
        y -= a.shape[0]
    if x > a.shape[1] // 2:
        x -= a.shape[1]
    return x, y, float(c.max())


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # -I로 돌리면 PYTHONIOENCODING이 안 먹는다
    src, out = sys.argv[1], Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    f, (W, H) = frames(src)
    w = f.shape[2]
    xs, ys, peaks, cum = [], [], [], [0.0]
    for i in range(1, len(f)):
        x, y, p = shift(f[i - 1], f[i])
        xs.append(x)
        ys.append(y)
        peaks.append(p)
        cum.append(cum[-1] + x)
    # shift의 x가 양수면 카메라가 오른쪽으로 간 것(내용은 왼쪽으로 흐름 — 합성 그림으로 확인, 10px → +10)
    total_px = cum[-1]
    res = {
        "영상": src,
        "크기": f"{W}x{H}",
        "프레임": len(f),
        "길이초": round(len(f) / 10, 1),
        "카메라_가로이동_화면폭비": round(total_px / w * 100, 1),
        "0.1초마다_누적_화면폭비": [round(c / w * 100, 2) for c in cum],
        "약한_상관_프레임": [i + 1 for i, p in enumerate(peaks) if p < 0.08],
    }
    (out / "이동.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{Path(src).name}: 카메라 가로 이동 {res['카메라_가로이동_화면폭비']}% (화면 폭 대비, {res['길이초']}초) · 약한 상관 {len(res['약한_상관_프레임'])}프레임")
    # 첫 · 끝 프레임(원래 크기)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], capture_output=True, text=True).stdout)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "select=eq(n\\,0)", "-frames:v", "1", str(out / "첫.png")])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(dur - 0.1, 0):.2f}", "-i", src, "-frames:v", "1", "-update", "1", str(out / "끝.png")])
    print(f"길이 {dur:.2f}초 · 첫.png · 끝.png")


if __name__ == "__main__":
    main()
