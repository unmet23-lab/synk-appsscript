# 로맨스 단편 「다 비침」 가편집(2026-10-30, 7번 가편집.py와 같은 길) — 우리 정지컷을 글 콘티 길이대로 이어 본다. 영상 생성 전 흐름 · 유호님 확인용.
#   python -X utf8 가편집.py   → git 밖 콘티/romance/가편집/다비침_가편집.mp4(1280×720 · 소리 없음)
#     회상 컷은 좌우 검은 띠(그림 4:3), 「」 안 대사는 아래 자막, 속말 · 손글씨 · 화면 글(후반 몫)은 기울인 회색 자막으로 적는다.
#     끝 그림이 있는 컷(C01 · C11 · C14 · C18 · C43)은 앞 절반 시작 그림 · 뒤 절반 끝 그림. 정지컷이 없으면 어두운 칸에 「아직 없음」. 색 · 빛은 정지컷 그대로.
import json, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "romance")
STILL = os.path.join(V, "선버스트", "정지컷")
OUT = os.path.join(V, "가편집")
W, H = 1280, 720
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)


def frame(k, cut, part=None):
    p = os.path.join(STILL, f"{k}.jpg")
    if cut["컷"] == "C65":
        im = Image.new("RGB", (W, H), (0, 0, 0))
    elif os.path.exists(p):
        im = Image.open(p).convert("RGB").resize((W, H))
    else:
        im = Image.new("RGB", (W, H), (34, 34, 38))
        ImageDraw.Draw(im).text((W // 2 - 60, H // 2 - 20), "아직 없음", font=F("ExtraBold", 34), fill=(170, 170, 170))
    d = ImageDraw.Draw(im)
    if cut["회상"]:
        bar = int(W * 240 / 1920)
        d.rectangle([0, 0, bar, H], fill=(0, 0, 0))
        d.rectangle([W - bar, 0, W, H], fill=(0, 0, 0))
    lines = [(f"{m['대사']}", not m["입"] and "속말" in m["누가"]) for m in cut["말"]]
    post = [x for x in (cut.get("글") or "").split(" · ") if x and ("손글씨" in x or "카드" in x or "「시작.」" in x or "「끝.」" in x)]
    y = H - 34
    rows = []
    for text, inner in lines:
        rows.append((("(속말) " if inner else "") + text, inner))
    for t in post:
        rows.append((f"[화면 글] {t}", True))
    for text, dim in reversed(rows[-3:]):
        font = F("Medium" if dim else "SemiBold", 26)
        tw = d.textlength(text, font=font)
        x = (W - tw) / 2
        y -= 38
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            d.text((x + dx, y + dy), text, font=font, fill=(0, 0, 0))
        d.text((x, y), text, font=font, fill=(200, 200, 205) if dim else (255, 255, 255))
    tag = f"{cut['컷']}{' 끝' if part == 'e' else ''} · {cut['우리초'][0]:.1f}초"
    d.text((16, 12), tag, font=F("ExtraBold", 20), fill=(255, 220, 120))
    return im


def main():
    cs = json.load(open(os.path.join(V, "컷목록.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp()
    lst, n = [], 0
    for c in cs:
        k = c["컷"]
        parts = [(k, c["길이"], None)]
        if os.path.exists(os.path.join(STILL, f"{k}e.jpg")):
            parts = [(k, c["길이"] / 2, None), (k + "e", c["길이"] / 2, "e")]
        for kk, dur, part in parts:
            p = os.path.join(tmp, f"{n:03d}.png")
            frame(kk, c, part).save(p)
            lst.append(f"file '{p}'\nduration {dur:.3f}")
            n += 1
    lst.append(f"file '{p}'")   # concat 데뮤서는 끝 그림을 한 번 더 적어야 마지막 길이를 지킨다
    with open(os.path.join(tmp, "list.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lst).replace("\\", "/"))
    dst = os.path.join(OUT, "다비침_가편집.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(tmp, "list.txt"), "-vf", "fps=24,format=yuv420p",
                    "-c:v", "libx264", "-crf", "22", "-preset", "medium", dst], check=True)
    print("→", dst, f"({sum(c['길이'] for c in cs):.2f}초)")


if __name__ == "__main__":
    main()
