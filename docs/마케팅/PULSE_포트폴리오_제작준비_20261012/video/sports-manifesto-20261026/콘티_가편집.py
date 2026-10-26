# 5번 「가쁨」 이미지 콘티 무음 가편집(2026-10-26) — 정지컷 · 그래픽 조각을 원본 컷 시각대로 이어 30초 mp4와 내레이션 자막(srt)을 만든다.
# 낯선 사람 이해 시험(tools/낯선이시험.js --말 <srt> --컷 …)에 넣는 것이라 소리는 없다(목소리 · 음악은 소리 단계에서).
#   python -X utf8 콘티_가편집.py → git 밖 콘티/p5/가편집/가쁨_가편집_30초.mp4 · 말_30초.srt
# 시각은 01_샷표 2절(원본 경계 46 · 번쩍 조각은 프레임 띠에서 잰 자리). 아직 없는 판은 회색 칸에 이름만 적는다.
import os, subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p5")
OUT = os.path.join(V, "가편집")
os.makedirs(OUT, exist_ok=True)
W, H, TOTAL = 1920, 1080, 30.03

# (그림, 시작 초)
CUTS = [("S01", 0.0), ("S02", 3.13), ("S03", 4.63), ("S04", 5.42),
        # 5행 번쩍 몽타주 6.13–8.76 — 원본 조각 자리마다 우리 조각(채원 조각 · 전구 · 빛줄기 · 번쩍 · 판 · 숫자 · 밝은 실험실)
        # 10-27 Fable: 다른 행 정지컷(S04 · S06 · S15)을 다시 쓰지 않고 따로 구운 조각(F3 따뜻한 옆얼굴 · F4 어깨)으로
        ("F4", 6.13), ("F1", 6.21), ("F2", 6.26), ("F1", 6.34), ("F4", 6.38), ("G_빛줄기", 6.55), ("F3", 6.59), ("F2", 6.88),
        ("G_회색판", 7.09), ("R1", 7.13), ("F4", 7.17), ("G_번쩍", 7.30), ("G_빛줄기", 7.38), ("F2", 7.47), ("G_빛줄기", 7.55),
        ("G_판", 7.67), ("G_숫자_흐림", 8.05), ("G_숫자_172", 8.09), ("G_빛줄기_20", 8.22), ("G_번쩍", 8.26), ("G_회색판", 8.34),
        ("F2", 8.43), ("G_회색판", 8.55),
        ("S06", 8.76), ("G_숫자_흐림", 11.55), ("S08", 11.80), ("S09", 14.06), ("S10", 16.60), ("S11", 18.89),
        # 12행 조각 다섯
        ("G_심박", 21.02), ("S12a", 21.19), ("G_숫자_흐림", 21.48), ("S12b", 21.73), ("G_심박", 22.02),
        ("S13", 22.15), ("G_판", 22.81), ("G_숫자_172", 23.19), ("S15", 23.27), ("G_빛줄기", 23.77), ("G_숫자_172", 23.85),
        ("S16_합성", 23.94), ("S17", 24.36), ("S18", 24.94), ("G_막대", 25.23), ("S19", 25.40), ("G_빛줄기_20", 26.48),
        # 21행 — 28.49 로고 켜짐 · 28.53 꺼짐 · 28.57 다시 켜짐
        ("S21", 26.65), ("S21_로고", 28.49), ("S21", 28.53), ("S21_로고", 28.57)]
VO = [(1.65, 2.4, "숨."), (4.91, 5.6, "땀."), (9.41, 10.3, "한 번 더."), (11.65, 12.7, "한 바퀴 더."), (18.74, 19.6, "어제보다 더."),
      (20.02, 20.8, "숨이,"), (21.62, 26.9, "턱 끝까지 차오른 그 자리에서, 너는"), (28.26, 29.6, "진짜 너를 만난다.")]


def frame(name, i):
    p = next((q for q in (os.path.join(V, "정지컷", name + ".png"), os.path.join(V, "그래픽", name + ".png")) if os.path.exists(q)), None)
    if p:
        im = Image.open(p).convert("RGB")
        s = max(W / im.width, H / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
    else:
        im = Image.new("RGB", (W, H), (44, 44, 48))
        ImageDraw.Draw(im).text((80, 80), f"{name} — 아직 없음", font=ImageFont.truetype(os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-ExtraBold.otf"), 64), fill=(160, 156, 150))
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
    out = os.path.join(OUT, f"가쁨_가편집_{name}.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "fps=23.976,format=yuv420p",
                    "-t", f"{total:.2f}", "-c:v", "libx264", "-crf", "20", out], check=True)
    print(out)


if __name__ == "__main__":
    assert all(a[1] < b[1] for a, b in zip(CUTS, CUTS[1:])), "시각이 차례대로가 아니다"
    build(CUTS, TOTAL, "30초")
    srt(VO, os.path.join(OUT, "말_30초.srt"))
