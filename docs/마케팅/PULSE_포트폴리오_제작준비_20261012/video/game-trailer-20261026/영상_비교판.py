# 9번 Veo 첫 시험(2026-10-26) — 원본 그 컷 | 우리 Veo 판을 나란히 놓은 비교 영상과 0.5초 간격 프레임 판.
# 우리 판(4초)이 원본 컷보다 짧으면 마지막 프레임을 늘려 길이를 맞춘다(비교용 — 편집본에는 쓰지 않음). 원본 프레임이 들어가므로 git 밖에만 쓴다.
#   python -X utf8 영상_비교판.py [S02 S08 S11 | S02v2 …]   → 콘티/p9/영상/veo시험/비교_<컷>.mp4 · 비교_<컷>_프레임.jpg · 비교_셋(_v2).mp4
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
VENDOR = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024")
SRC = os.path.join(VENDOR, "레퍼런스", "p9", "원본영상", "hq_hwipOMtwHoQ", "hq_hwipOMtwHoQ_h264.mp4")
OUT = os.path.join(VENDOR, "콘티", "p9", "영상", "veo시험")
FONT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-ExtraBold.otf")
CUTS = {"S02": (1.668, 6.006), "S08": (15.349, 19.653), "S11": (22.823, 26.159)}   # 01_샷표_원본 2절
W, H = 960, 540


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def label(text):
    # drawtext 대신 글자 판(PNG)을 얹는다 — 윈도우 경로의 콜론 · 한글 글꼴 경로를 필터 문자열에 넣지 않으려고
    p = os.path.join(OUT, f"_글자_{abs(hash(text)) % 10**8}.png")
    im = Image.new("RGBA", (W, 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 10, 30 + d.textlength(text, font=ImageFont.truetype(FONT, 28)), 52], 8, fill=(0, 0, 0, 150))
    d.text((20, 13), text, font=ImageFont.truetype(FONT, 28), fill=(255, 255, 255))
    im.save(p)
    return p


def one(cut):
    t0, t1 = CUTS[cut[:3]]   # S02v2 같은 다시 낸 판도 원본 컷 시각은 앞 세 글자로
    dur = t1 - t0
    ours = os.path.join(OUT, f"{cut}_a.mp4")
    if not os.path.exists(ours):
        print(cut, "우리 판 없음")
        return None
    out = os.path.join(OUT, f"비교_{cut}.mp4")
    la, lb = label(f"원본 {cut[1:]}번 ({dur:.2f}초)"), label("우리 판 · Veo 3.1 Quality 4초")
    ff("-ss", f"{t0:.3f}", "-t", f"{dur:.3f}", "-i", SRC, "-i", ours, "-i", la, "-i", lb,
       "-filter_complex",
       f"[0:v]scale={W}:{H},setsar=1,fps=24[o0];[o0][2:v]overlay=0:0[o];"
       f"[1:v]scale={W}:{H},setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=2,trim=duration={dur:.3f}[u0];[u0][3:v]overlay=0:0[u];"
       f"[o][u]hstack=inputs=2,format=yuv420p[v]",
       "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "18", "-t", f"{dur:.3f}", out)
    # 0.5초 간격 프레임 판(위 원본 · 아래 우리 판)
    n = int(dur / 0.5) + 1
    tiles = []
    for i in range(n):
        t = min(i * 0.5, dur - 0.05)
        p = os.path.join(OUT, f"_f_{cut}_{i}.png")
        ff("-ss", f"{t:.3f}", "-i", out, "-frames:v", "1", p)
        tiles.append(Image.open(p).convert("RGB").resize((W, H // 2)))
    sheet = Image.new("RGB", (W // 2 * n, H), (16, 16, 18))
    for i, tl in enumerate(tiles):
        o, u = tl.crop((0, 0, W // 2, H // 2)), tl.crop((W // 2, 0, W, H // 2))
        sheet.paste(o, (i * W // 2, 0))
        sheet.paste(u, (i * W // 2, H // 2))
        os.remove(os.path.join(OUT, f"_f_{cut}_{i}.png"))
    sheet.save(os.path.join(OUT, f"비교_{cut}_프레임.jpg"), quality=90)
    print(out)
    return out


if __name__ == "__main__":
    done = [p for p in (one(c) for c in (sys.argv[1:] or list(CUTS))) if p]
    if len(done) > 1:
        lst = os.path.join(OUT, "_비교목록.txt")
        open(lst, "w", encoding="utf-8").write("\n".join(f"file '{p}'" for p in done).replace("\\", "/"))
        tail = "".join(sorted({c[3:] for c in (sys.argv[1:] or list(CUTS))}))
        name = "비교_셋" + (f"_{tail}" if tail else "") + ".mp4"
        ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(OUT, name))
        print(os.path.join(OUT, name))
    for f in os.listdir(OUT):
        if f.startswith("_글자_"):
            os.remove(os.path.join(OUT, f))
