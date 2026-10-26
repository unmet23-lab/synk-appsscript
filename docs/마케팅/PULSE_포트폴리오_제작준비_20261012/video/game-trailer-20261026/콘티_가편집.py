# 9번 게임 트레일러 애니매틱(2026-10-26) — 고른 정지컷을 원본 15컷 시각 그대로 이어 붙인 무음 36.04초(낯선 사람 이해 시험 · 보드 확인용).
# 2 · 8 · 11번은 한 컷 안에서 일이 바뀌는 순간(3.25 · 17.3 · 25.29초)에 첫 그림 → 끝 그림으로 바꾼다. 1 · 15 표지와 14번 제목은 자리 시안.
#   python -X utf8 콘티_가편집.py   → 콘티/p9/가편집/애니매틱_<판>.mp4 (git 밖)
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p9")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
W, H = 1920, 1080
판 = "4"
# (시작 초, 그림) — 끝은 다음 줄의 시작, 마지막은 36.036
SEQ = [
    (0.000, "card1"), (1.668, "S02a"), (3.25, "S02b"), (6.006, "S03"), (8.342, "S04"), (10.010, "S05"),
    (11.845, "S06"), (13.013, "game7"), (15.349, "S08a"), (17.3, "S08b"), (19.653, "S09"), (21.154, "S10"),
    (22.823, "S11a"), (25.29, "S11b"), (26.159, "S12"), (28.996, "S13"), (31.665, "S14"), (34.468, "card15"),
]
END = 36.036


def title(im, W, H):
    """14번 제목 자리 시안 — 「SYNK WORLD」와 무엇인지 알리는 한 줄(낯선이 시험 1차: 무엇을 알리는 광고인지 모르겠다)"""
    d = ImageDraw.Draw(im)
    f1, f2 = F("Heavy", int(H * 0.095)), F("Bold" if os.path.exists(os.path.join(SUIT, "SUIT-Bold.otf")) else "ExtraBold", int(H * 0.042))
    s1, s2 = "SYNK WORLD", "펠트 친구들이 사는 작은 한국 동네"
    x2 = W - d.textlength(s2, font=f2) - W * 0.05
    x1 = W - d.textlength(s1, font=f1) - W * 0.05
    d.text((x1, H * 0.56), s1, font=f1, fill=(255, 255, 255), stroke_width=max(2, H // 270), stroke_fill=(40, 30, 30))
    d.text((x2, H * 0.56 + H * 0.115), s2, font=f2, fill=(255, 255, 255), stroke_width=max(2, H // 360), stroke_fill=(40, 30, 30))


def band(img):
    w, h = img.size
    nh = round(w * 9 / 16)
    if nh < h:
        t = (h - nh) // 2
        img = img.crop((0, t, w, t + nh))
    return img.resize((W, H), Image.LANCZOS)


def card(kind):
    im = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    if kind == "card1":
        f = F("Heavy", 150)
        s = "SYNK WORLD"
        d.text(((W - d.textlength(s, font=f)) / 2, H * 0.36), s, font=f, fill=(20, 20, 24))
        f2 = F("SemiBold", 54)
        s2 = "아늑한 한국 동네 게임"
        d.text(((W - d.textlength(s2, font=f2)) / 2, H * 0.58), s2, font=f2, fill=(90, 90, 96))
    else:
        lg = Image.open(os.path.join(REPO, "experiences", "brand-opening", "assets", "synk-paper.webp")).convert("RGBA")
        lg.thumbnail((int(W * 0.40), int(H * 0.40)))
        im.paste(lg, ((W - lg.width) // 2, int(H * 0.28)), lg)
        f = F("SemiBold", 64)
        s = "synk.im/world 에서 만나요"
        d.text(((W - d.textlength(s, font=f)) / 2, H * 0.74), s, font=f, fill=(40, 40, 44))
    return im


def picture(name):
    if name.startswith("card"):
        return card(name)
    im = band(Image.open(os.path.join(V, "정지컷", f"{name}.png")).convert("RGB"))
    if name == "S14":
        title(im, W, H)
    return im


if __name__ == "__main__":
    out_dir = os.path.join(V, "가편집")
    os.makedirs(out_dir, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="p9_animatic_")
    lines = []
    for i, (t0, name) in enumerate(SEQ):
        t1 = SEQ[i + 1][0] if i + 1 < len(SEQ) else END
        p = os.path.join(tmp, f"{i:02d}.png")
        picture(name).save(p)
        lines.append(f"file '{p}'\nduration {t1 - t0:.3f}")
    lines.append(f"file '{os.path.join(tmp, f'{len(SEQ) - 1:02d}.png')}'")
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w", encoding="utf-8").write("\n".join(lines).replace("\\", "/"))
    out = os.path.join(out_dir, f"애니매틱_{판}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "fps=30,format=yuv420p",
                    "-c:v", "libx264", "-crf", "20", "-t", f"{END:.3f}", out], check=True)
    print(out)
