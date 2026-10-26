# 블프 세일 이미지 콘티 무음 가편집(2026-10-26) — 정지컷을 원본 컷 시각대로 이어 15초 · 6초 mp4와 내레이션 자막(srt)을 만든다.
# 낯선 사람 이해 시험(tools/낯선이시험.js --말 <srt> --컷 …)에 넣는 것이라 소리는 없다(목소리 · 음악은 소리 단계에서).
#   python -X utf8 콘티_가편집.py → git 밖 콘티/bf-sale/가편집/bf_가편집_15초.mp4 · _6초.mp4 · 말_15초.srt · 말_6초.srt
import os, subprocess
from PIL import Image

HOME = os.environ["USERPROFILE"]
B = os.path.join(HOME, "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale")
S = os.path.join(B, "정지컷")
OUT = os.path.join(B, "가편집")
os.makedirs(OUT, exist_ok=True)

# (그림, 시작 초) — 01_샷표 2절 원본 경계 그대로(휙 넘기기 3.64–3.76은 4번 그림을 이어 씀)
CUTS15 = [("C01_합성", 0.0), ("G02", 0.96), ("C03", 2.28), ("C04", 3.04), ("C06", 3.76), ("C07", 4.48), ("C08", 5.16),
          ("G09", 6.16), ("C10", 7.68), ("G11a", 8.60), ("G11b", 10.20), ("C12", 11.72), ("C13_합성", 12.56)]
CUTS6 = [("C01_합성", 0.0), ("G02", 0.9), ("G09", 2.2), ("C10", 3.7), ("C13_합성", 4.6)]
VO15 = [(0.0, 3.0, "자정까지! 전 품목 칠십 퍼센트!"), (3.5, 6.1, "일 년에 딱 한 번, 힘껏 밟아요!"),
        (6.7, 10.6, "레깅스도, 바람막이도, 전부 칠십 퍼센트!"), (11.0, 14.5, "자정 전에 끝나요, 지금 힘껏 앱에서!")]
VO6 = [(0.0, 2.8, "자정까지! 전 품목 칠십 퍼센트!"), (4.6, 5.9, "지금 힘껏 앱에서!")]


def frame(name, i):
    p = os.path.join(S, name + ".png")
    if not os.path.exists(p):
        import glob
        g = sorted(glob.glob(os.path.join(B, "받음", name.split("_")[0] + "_*.jpg")), key=os.path.getmtime)
        p = g[-1] if g else None
    im = Image.open(p).convert("RGB") if p else Image.new("RGB", (1080, 1920), (40, 36, 60))
    im = im.resize((1080, 1920), Image.LANCZOS)
    q = os.path.join(OUT, f"_f{i:02d}.png")
    im.save(q)
    return q


def srt(vo, path):
    t = lambda s: f"00:00:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
    with open(path, "w", encoding="utf-8") as fh:
        for i, (a, b, txt) in enumerate(vo, 1):
            fh.write(f"{i}\n{t(a)} --> {t(b)}\n{txt}\n\n")


def build(cuts, total, name):
    lst = os.path.join(OUT, f"_{name}.txt")
    with open(lst, "w", encoding="utf-8") as fh:
        for i, (img, st) in enumerate(cuts):
            en = cuts[i + 1][1] if i + 1 < len(cuts) else total
            fh.write(f"file '{frame(img, i).replace(os.sep, '/')}'\nduration {en - st:.3f}\n")
        fh.write(f"file '{frame(cuts[-1][0], 99).replace(os.sep, '/')}'\n")
    out = os.path.join(OUT, f"bf_가편집_{name}.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "fps=30,format=yuv420p",
                    "-t", f"{total:.2f}", "-c:v", "libx264", "-crf", "20", out], check=True)
    print(out)


build(CUTS15, 15.0, "15초")
build(CUTS6, 6.0, "6초")
srt(VO15, os.path.join(OUT, "말_15초.srt"))
srt(VO6, os.path.join(OUT, "말_6초.srt"))
