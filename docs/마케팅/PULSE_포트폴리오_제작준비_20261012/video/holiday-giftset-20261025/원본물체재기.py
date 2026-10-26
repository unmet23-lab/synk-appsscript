# 시즌 2 · 홀리데이 기프트 세트 — 원본 3번 컷을 물체 · 색으로 잰다 (2026-10-27, 카메라 2판)
#   python 원본물체재기.py <원본.mp4> 상자     → 3.2–5.3초 밝은 금 · 흰 무늬 열의 띠(상자 폭 · 오른쪽 끝, 화면 폭 비율)
#   python 원본물체재기.py <원본.mp4> 병       → 7.4–11.6초 빨간 바탕 위 파란 병 무게중심의 화면 가로 자리
#   python 원본물체재기.py <원본.mp4> 흐름 [시작 길이]   → 금 조각(별 · 선화)만 남긴 화면의 이웃 프레임 위상 상관(%/초)
#   python 원본물체재기.py <원본.mp4> 바닥띠    → 병을 지운 바닥 가로 띠 셋의 위상 상관과 병의 흐름을 같은 두 프레임 사이에서
# 카메라재기.py(특징점 닮음 맞춤)는 흐린 빠른 옆 이동 · 무늬 없는 바닥 · 스스로 움직이는 물체에서 원본과 다르게 잰다 —
# 그 구간을 물체 크기 · 끝 · 색 덩이 · 바닥 띠로 다시 잰 값이 02_콘티 2절 표와 움직임표 옆 이동 · 병 길이다.
# 원본 프레임은 저장소에 올리지 않는다 — 숫자만 낸다. 색 기준은 이 원본(빨간 종이 · 금 선화 · 파란 병)에 맞춘 값이다.
import subprocess
import sys

import cv2
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
FPS = 25.0


def frames(src, t0, dur, w, h):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0}", "-t", f"{dur}", "-i", src, "-vf", f"scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw[: n * w * h * 3], np.uint8).reshape(n, h, w, 3).astype(np.int16)


def blue_mask(f):
    return (f[..., 2] > f[..., 0] + 25) & (f[..., 2] > 50)


def gold(f):
    """빨간 바탕을 지우고 금 조각 · 금 선화만 남긴 밝기(G − 0.35 R)."""
    return np.clip(f[..., 1] - 0.35 * f[..., 0], 0, 255).astype(np.float32)


def box(src):
    w, h = 270, 480
    fr = frames(src, 3.2, 2.1, w, h)
    print("원본초  왼끝  오른끝  폭(화면 폭 비율)")
    for i in range(0, len(fr), 2):
        band = fr[i][int(h * 0.25):int(h * 0.75), :, 1] > 140      # 화면 가운데 세로 띠의 밝은 금 · 흰 화소
        xs = np.nonzero(band.sum(0) > h * 0.06)[0]
        s = f"{xs[0] / w:5.2f} {xs[-1] / w:6.2f} {(xs[-1] - xs[0]) / w:6.2f}" if len(xs) > 5 else "  -"
        print(f"{3.2 + i / FPS:5.2f}  {s}")


def bottle(src):
    w, h = 270, 480
    fr = frames(src, 7.4, 4.2, w, h)
    print("원본초  병 가운데 x  보이는 폭 — 들어올 때(보이는 폭 < 0.19)는 가운데 = 왼끝 + 0.10으로 고쳐 쓴다")
    for i in range(0, len(fr), 4):
        m = blue_mask(fr[i])
        c = m.sum(0)
        if m.sum() < 150:
            continue
        xs = np.nonzero(c > 3)[0]
        print(f"{7.4 + i / FPS:5.2f}  {(c * np.arange(w)).sum() / c.sum() / w:6.3f}  {(xs[-1] - xs[0]) / w:5.2f}")


def flow(src, t0=4.9, dur=3.3):
    w, h = 540, 960
    fr = frames(src, t0, dur, w, h)
    g = [gold(f) for f in fr]
    win = cv2.createHanningWindow((w, h), cv2.CV_32F)
    print("원본초  가로 %/초  세로 %/초  응답(0.3 넘으면 믿을 만함)")
    for i in range(1, len(fr)):
        (dx, dy), r = cv2.phaseCorrelate(g[i - 1], g[i], win)
        print(f"{t0 + i / FPS:5.2f}  {dx / w * 100 * FPS:7.1f}  {dy / h * 100 * FPS:7.1f}  {r:.2f}")


def floor_strips(src):
    w, h = 540, 960
    pairs = ((7.80, 8.00), (8.00, 8.20), (8.20, 8.40), (8.40, 8.60), (8.60, 8.80), (8.80, 9.00), (9.00, 9.20), (9.20, 9.40),
             (10.6, 10.8), (10.8, 11.0), (11.0, 11.2))
    print("원본초        병 %/초 | 바닥 아래 · 가운데 · 위 띠 %/초 (띠마다 같으면 카메라 이동)")
    for a, b in pairs:
        fa, fb = frames(src, a, 0.04, w, h)[0], frames(src, b, 0.04, w, h)[0]
        out = []
        for y0, y1 in ((0.66, 0.80), (0.50, 0.64), (0.30, 0.44)):
            pa, pb = gold(fa[int(h * y0):int(h * y1)]), gold(fb[int(h * y0):int(h * y1)])
            for f, p in ((fa, pa), (fb, pb)):
                ff = f[int(h * y0):int(h * y1)]
                p[ff[..., 2] > ff[..., 0] + 10] = 0                      # 병 자리는 지운다
            win = cv2.createHanningWindow((w, pa.shape[0]), cv2.CV_32F)
            (dx, _), _ = cv2.phaseCorrelate(pa, pb, win)
            out.append(f"{dx / w * 100 / (b - a):6.1f}")

        def cx(f):
            c = blue_mask(f).sum(0)
            return (c * np.arange(w)).sum() / max(1, c.sum()) / w
        print(f"{a:.2f}-{b:.2f}  {(cx(fb) - cx(fa)) * 100 / (b - a):6.1f} | " + " · ".join(out))


if __name__ == "__main__":
    src, what = sys.argv[1], sys.argv[2]
    if what == "상자":
        box(src)
    elif what == "병":
        bottle(src)
    elif what == "흐름":
        flow(src, *(float(x) for x in sys.argv[3:5])) if len(sys.argv) > 4 else flow(src)
    elif what == "바닥띠":
        floor_strips(src)
    else:
        print(__doc__ or "상자 | 병 | 흐름 | 바닥띠")
