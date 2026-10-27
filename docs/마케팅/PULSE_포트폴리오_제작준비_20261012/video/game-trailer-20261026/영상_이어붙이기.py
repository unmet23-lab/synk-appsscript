# 9번 11번 두 판 이어 붙이기(2026-10-27) — 첫 판(빠른 아래 틸트 → 내려앉음)의 앞 몇 초와 둘째 판(손 대기 → 번쩍 → 펠트 전구)을 잇는다.
# 둘째 판의 시작 그림이 첫 판의 끝 그림과 같은 그림이라, 첫 판이 내려앉은 뒤 멈춰 있는 구간에서 넘기면 이음매가 보이지 않는다.
# 넘기는 자리는 첫 판 0.4초 뒤에서 둘째 판 첫 프레임과 가장 닮은 프레임(160×90 흑백 평균 차가 가장 작은 곳)으로 고른다.
#   python -X utf8 영상_이어붙이기.py S11tA_a.mp4 S11tB_a.mp4 3.336 S11t_a.mp4   (원본 11번 길이 3.336초)
import os
import subprocess
import sys

import numpy as np

D = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p9", "영상", "veo시험")


def gray(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=160:90,format=gray", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(float)


if __name__ == "__main__":
    a, b, total, out = os.path.join(D, sys.argv[1]), os.path.join(D, sys.argv[2]), float(sys.argv[3]), os.path.join(D, sys.argv[4])
    fa, fb = gray(a), gray(b)
    lo = int(0.4 * 24)
    diffs = [float(np.abs(fa[k] - fb[0]).mean()) for k in range(lo, len(fa))]
    k = lo + int(np.argmin(diffs))
    ta = k / 24
    tb = total - ta
    print(f"넘김 첫 판 {ta:.3f}초(프레임 {k}, 둘째 판 첫 프레임과 평균 차 {min(diffs):.2f}) · 둘째 판 0–{tb:.3f}초")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-i", b, "-filter_complex",
                    f"[0:v]trim=0:{ta:.4f},setpts=PTS-STARTPTS[x];[1:v]trim=0:{tb:.4f},setpts=PTS-STARTPTS[y];[x][y]concat=n=2:v=1:a=0,format=yuv420p[v]",
                    "-map", "[v]", "-c:v", "libx264", "-crf", "16", "-r", "24", out], check=True)
    print(out)
