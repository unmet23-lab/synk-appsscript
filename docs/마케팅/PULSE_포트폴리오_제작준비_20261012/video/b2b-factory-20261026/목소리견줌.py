# 10번 내레이션 고르기 판(2026-11-08, Claude) — 일레븐 v4 후보 넷(아이작 · 애셔 · 헨리 · 에스엠, 내레이션_후보.py)을 실제 장면 위에서 견준다.
#   후보마다 최종소리.py를 P10_NARR=<이름>으로 다시 섞어(같은 곡 · 효과음 · 같은 자리) 39.5~60.04초를 잘라 잇는다. 자막은 아이작 시각이라 넣지 않는다(화면.mp4).
#   위 검은 띠에 번호와 이름(고르기용 표시). 크기는 최종본 마감 이득(최종본 LUFS − 아이작 섞음 LUFS)을 똑같이 주고 같은 리미터를 건다.
#   python -X utf8 목소리견줌.py   → git 밖 최종/p10/_고르기/목소리_내레이션_넷.mp4
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집 as E

OUT = os.path.join(E.OUT, "_고르기")
NAMES = ["아이작", "애셔", "헨리", "에스엠"]
A, B = 39.5, E.TF[-1]
DST = "목소리_내레이션_넷.mp4"
# 11-08 3차 — 내레이션이 처음부터 나오는 원고(「_초반」 판)로 0~31초(줄 다섯)를 견준다:  python -X utf8 목소리견줌.py --초반
if "--초반" in sys.argv:
    NAMES = ["아이작_초반b", "애셔_초반", "헨리_초반", "에스엠_초반"]
    A, B = 0.0, 31.0
    DST = "목소리_내레이션_넷_초반.mp4"
FONT = "C\\:/Windows/Fonts/malgun.ttf"   # 한글 경로 글꼴은 ffmpeg drawtext가 죽는다(8번 목소리견줌.py)


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])


def mix_of(name):
    wav = os.path.join(OUT, f"_{name}.wav")
    env = dict(os.environ, P10_NARR=name)
    subprocess.run([sys.executable, "-X", "utf8", "-c",
                    "import sys; sys.path.insert(0, r'%s'); sys.path.insert(0, r'%s'); import 최종소리 as S, 최종편집 as E; S.build(r'%s', E.TF, timing_path=None)"
                    % (HERE, os.path.join(HERE, ".."), wav)], check=True, env=env)
    return wav


def main():
    os.makedirs(OUT, exist_ok=True)
    final = os.path.join(E.OUT, E.NAME + ".mp4")
    gain = lufs(final) - lufs(mix_of(NAMES[0]))
    print(f"마감 이득 {gain:+.2f} dB")
    parts = []
    for k, name in enumerate(NAMES, 1):
        wav = mix_of(name)
        clip = os.path.join(OUT, f"_내레이션_{k}.mp4")
        label = f"내레이션 {k} · 일레븐 v4 {re.sub(r'_초반.*$', '', name)}"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{A}", "-to", f"{B}", "-i", os.path.join(E.OUT, "화면.mp4"), "-ss", f"{A}", "-to", f"{B}", "-i", wav,
                        "-map", "0:v", "-map", "1:a", "-vf", f"drawtext=fontfile='{FONT}':text='{label}':x=40:y=14:fontsize=30:fontcolor=white",
                        "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:level=false",
                        "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", clip], check=True)
        parts.append(clip)
    lst = os.path.join(OUT, "_내레이션.txt")
    open(lst, "w", encoding="utf-8").write("".join(f"file '{p}'\n" for p in parts))
    dst = os.path.join(OUT, DST)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", dst], check=True)
    print(dst)


if __name__ == "__main__":
    main()
