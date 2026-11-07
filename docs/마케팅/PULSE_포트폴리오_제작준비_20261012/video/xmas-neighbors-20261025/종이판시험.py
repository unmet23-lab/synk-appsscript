# 짜임 사진 시험 「종이 판」(2026-11-08, Claude) — 지금 최종 영상에서 바꿔 볼 컷 자리만 Gemini 사진 한 장으로 덮고, 같은 낯선이 시험 재료
# (컷마다 한 장 정지컷 · 말 · 질문 · 볼이유_질문)를 뽑는다. 크레딧 0: 시댄스로 굽기 전에 같은 심사관(opus 볼 이유 · Fable 견주기)이
# 짜임 바꿈만으로 점수를 올리는지 먼저 본다(02_콘티 14절 — 25 미끼 · 27 얼굴은 떨어지고 9 알아챔만 Fable 견주기 3 → 4).
#   python -X utf8 종이판시험.py <이름> 9=<사진> 25=<사진> …   → git 밖 콘티/검수/울림시험_20261108/종이_<이름>/
# 정지컷은 컷 가운데 장면이라 사진이 그 컷 내내 선다(움직임 · 소리는 못 잼). 영상 · 말은 아래 VIDEO · SPEECH.
import os
import subprocess
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
VIDEO = os.path.join(ROOT, "최종", "s1", "옆집의크리스마스_16x9.mp4")
OUTROOT = os.path.join(ROOT, "콘티", "검수", "울림시험_20261108")
SPEECH = os.path.join(OUTROOT, "이해시험4", "말_원고.txt")
# 컷 경계(02_콘티 2절 · 최종편집.py T와 같음)
T = [0.00, 3.56, 4.52, 5.88, 7.04, 8.64, 10.08, 11.88, 13.28, 15.00, 15.96, 17.40, 18.80, 20.00, 21.44, 22.76, 24.12, 24.60, 25.88, 28.44,
     30.76, 32.00, 33.36, 34.48, 35.92, 37.48, 38.88, 40.12, 42.88, 44.04, 46.44, 47.60, 49.68, 50.84, 53.84, 57.08, 60.04]


def main():
    if len(sys.argv) < 3:
        raise SystemExit("쓰는 법: python -X utf8 종이판시험.py <이름> <컷>=<사진> …")
    name = sys.argv[1]
    reps = dict(a.split("=", 1) for a in sys.argv[2:])
    out = os.path.join(OUTROOT, f"종이_{name}")
    os.makedirs(out, exist_ok=True)
    vid = os.path.join(out, f"종이_{name}.mp4")
    args = ["ffmpeg", "-v", "error", "-y", "-i", VIDEO]
    for p in reps.values():
        args += ["-loop", "1", "-i", p]
    chain, last = [], "0:v"
    for i, cut in enumerate(reps, 1):
        a, b = T[int(cut) - 1], T[int(cut)]
        chain.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,format=yuv420p[p{i}]")
        chain.append(f"[{last}][p{i}]overlay=0:0:enable='between(t,{a},{b - 0.001})':shortest=1[v{i}]")
        last = f"v{i}"
    args += ["-filter_complex", ";".join(chain), "-map", f"[{last}]", "-map", "0:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
             "-pix_fmt", "yuv420p", "-c:a", "copy", "-t", f"{T[-1]}", vid]
    subprocess.run(args, check=True)
    cuts = ",".join(f"{t:.2f}" for t in T[:-1])
    subprocess.run(["node", os.path.join(REPO, "tools", "낯선이시험.js"), vid, "--말", SPEECH, "--브랜드", "pulse", "--밖", out, "--컷", cuts,
                    "--지난", "없음"], check=True, cwd=REPO)
    print("종이 판", out)


if __name__ == "__main__":
    main()
