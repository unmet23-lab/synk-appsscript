# 8번 초반 말 전후 판(2026-11-08, Claude) — 유호님이 귀로 견주시게 같은 0~20초를 「전(v5) → 후」로 이어 붙이고 오른쪽 위에 이름표를 단다.
#   python -X utf8 전후.py   → git 밖 최종/p8/_시안/초반말_전후.mp4(0~20초 × 2) — 세션 안 재생은 지지직거릴 수 있어 내려받아 듣는다(메모 11-04)
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집공통 as C
from 최종편집 import OUT, label_font

BEFORE = os.path.join(OUT, "_v5보관", "캐스팅북_16x9.mp4")
AFTER = os.path.join(OUT, "캐스팅북_16x9.mp4")
SPAN = 20.0


def main():
    d = os.path.join(OUT, "_시안")
    os.makedirs(d, exist_ok=True)
    font = label_font()
    parts = []
    for src, tag, name in ((BEFORE, "전 · 11-07 v5(초반 말 없음)", "a"), (AFTER, "후 · 11-08 초반 말", "b")):
        p = os.path.join(d, f"_전후_{name}.mp4")
        C.run("ffmpeg", "-y", "-v", "error", "-i", src, "-t", f"{SPAN}", "-vf",
              f"drawbox=x=1130:y=30:w=760:h=64:color=black@0.55:t=fill,drawtext=fontfile='{font}':text='{tag}':x=1148:y=44:fontsize=34:fontcolor=white",
              "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", p)
        parts.append(p)
    lst = os.path.join(d, "_전후.txt")
    open(lst, "w", encoding="utf-8").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(d, "초반말_전후.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out)
    print(out)


if __name__ == "__main__":
    main()
