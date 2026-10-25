# 8번 이미지 콘티 가편집(2026-10-25) — 우리 판 21컷을 원본 컷 시각대로 이어(무음) 원본과 나란히 본다.
# 폰 컷 여섯은 정지 그림의 초록 화면 위에서 녹화 프레임이 실제로 움직이고(합성.py의 화면 합성), 글자 1 · 2 · 제목 · 끝 화면도 그 시각에 얹는다.
#   python -X utf8 콘티_가편집.py  → 보드/p8_가편집_무음.mp4(1920×1080 우리 판) · 보드/p8_원본과나란히.mp4(왼쪽 원본 | 오른쪽 우리, 1920×600)
import sys, json, subprocess, importlib.util, tempfile
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

TOOLS = Path(__file__).resolve().parent
P8 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8")
F540 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/원본실측/p8_네이버/프레임540")
START = [0, 43, 72, 123, 178, 223, 264, 338, 363, 425, 455, 475, 500, 525, 568, 602, 629, 670, 708, 800, 852, 900]   # 원본 29.97fps
FPS = 30
FONT = r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT"


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, TOOLS / file)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


H = load("hap", "이미지콘티_합성.py" if (TOOLS / "이미지콘티_합성.py").exists() else "합성.py")
G = load("geul", "이미지콘티_글자.py" if (TOOLS / "이미지콘티_글자.py").exists() else "글자.py")


def still(n):
    for p in (P8 / "컷" / f"C{n:02d}.jpg", P8 / "정지컷" / f"C{n:02d}.png"):
        if p.exists():
            return cv2.resize(H.read(p), (1920, 1080))
    raw = H.pick(f"C{n:02d}")
    return cv2.resize(H.read(raw), (1920, 1080)) if raw else np.zeros((1080, 1920, 3), np.uint8)


def with_text(n, bgr):
    im = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    if n == 15:
        im = G.lines(im, [G.TEXT1], top=500)
    elif n in (16, 17):
        im = G.lines(im, G.TEXT2)
    elif n == 20:
        im = G.title(im.convert("RGBA")).convert("RGB")
    return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)


def end_frames(k):
    logo = Image.open(G.LOGO).convert("RGBA")
    out = []
    for i in range(k):
        u = min(1, i / max(1, int(0.5 * FPS)))   # 0.5초 동안 크게 → 작게(원본 아이콘 → 로고)
        e = 1 - (1 - u) ** 3
        w = int(900 + (360 - 900) * e)
        im = Image.new("RGB", (1920, 1080), (255, 255, 255))
        l = logo.resize((w, int(logo.height * w / logo.width)), Image.LANCZOS)
        im.paste(l, ((1920 - w) // 2, (1080 - l.height) // 2), l)
        t = i / FPS
        if t >= 0.57:   # 29.0초부터 로고 아래 작은 한 줄(콘티 5절 3 추천안) — 0.2초 동안 나타남
            im = G.url_line(im, l.height, int(255 * min(1, (t - 0.57) / 0.2)))
        out.append(cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR))
    return out


def push(fr, s):
    """카메라 다가감 — 가운데를 s배로 키워 자른다(원본 4번 4% · 17번 1.4배)."""
    if s <= 1.0001:
        return fr
    h, w = fr.shape[:2]
    big = cv2.resize(fr, (int(round(w * s)), int(round(h * s))), interpolation=cv2.INTER_LINEAR)
    y0, x0 = (big.shape[0] - h) // 2, (big.shape[1] - w) // 2
    return big[y0:y0 + h, x0:x0 + w]


PUSH = {4: lambda u: 1 + 0.04 * u, 17: lambda u: 1.4 ** u}   # u = 컷 안 0~1


def our_frames(n, k):
    cut = f"C{n:02d}"
    if n == 21:
        return end_frames(k)
    if cut in H.SCREEN:
        cfg = dict(H.SCREEN[cut])
        p = H.pick(cut)
        base = cv2.resize(H.read(p), (1920, 1080), interpolation=cv2.INTER_AREA)
        st = json.load(open(P8 / "녹화" / cfg["rec"] / "states.json", encoding="utf-8"))
        out = []
        for i in range(k):
            cfg["f"] = f = min(st["n"] - 1, i)
            dy = abs(st["states"][f]["y"] - st["states"][max(0, f - 1)]["y"])
            cfg["mblur"] = 0.75 * dy   # 녹화는 3배(1pt = 3px) — 10번 극접사에서 원본 번짐 길이(1920 기준 약 45px)에 맞춘 계수(1.5는 두 배로 뭉개졌다 — Fable 3차 P3 9)
            img = H.do_screen(cut, base.copy(), cfg, {})
            if n in PUSH:
                img = push(img, PUSH[n](i / max(1, k - 1)))
            out.append(with_text(n, img))
        return out
    fr0 = still(n)
    if n in PUSH:
        return [with_text(n, push(fr0, PUSH[n](i / max(1, k - 1)))) for i in range(k)]
    fr = with_text(n, fr0)
    return [fr] * k


def main():
    outdir = P8 / "보드"; outdir.mkdir(exist_ok=True)
    tmp = Path(tempfile.gettempdir()) / "p8_gapyeonjip"; tmp.mkdir(exist_ok=True)   # cv2.VideoWriter는 한글 경로에 조용히 못 쓴다 — 임시 avi는 한글 없는 곳에
    w1 = cv2.VideoWriter(str(tmp / "_ours.avi"), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (1920, 1080))
    w2 = cv2.VideoWriter(str(tmp / "_pair.avi"), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (1920, 600))
    font = ImageFont.truetype(FONT + "/SUIT-SemiBold.otf", 26)
    t0 = 0
    for n in range(1, 22):
        a, b = START[n - 1], START[n]
        k = round((b - a) / 29.97 * FPS)
        ours = our_frames(n, k)
        for i, fr in enumerate(ours):
            w1.write(fr)
            t = (t0 + i) / FPS
            org = H.read(F540 / f"{min(899, a + int(i * 29.97 / FPS)) + 1:04d}.jpg")   # cv2.imread는 한글 경로를 못 읽는다
            pair = np.zeros((600, 1920, 3), np.uint8)
            pair[60:600, :960] = org
            pair[60:600, 960:] = cv2.resize(fr, (960, 540), interpolation=cv2.INTER_AREA)
            im = Image.fromarray(cv2.cvtColor(pair, cv2.COLOR_BGR2RGB)); d = ImageDraw.Draw(im)
            d.text((14, 14), f"원본 #{n}", font=font, fill=(200, 200, 200))
            d.text((974, 14), f"우리 #{n}", font=font, fill=(255, 214, 90))
            d.text((1700, 14), f"{t:5.2f}s", font=font, fill=(255, 255, 255))
            w2.write(cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR))
        t0 += k
        print(n, k, "프레임")
    w1.release(); w2.release()
    for src, dst in (("_ours.avi", "p8_가편집_무음.mp4"), ("_pair.avi", "p8_원본과나란히.mp4")):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp / src), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(outdir / dst)], check=True)
        (tmp / src).unlink()
    print("끝", t0, "프레임", round(t0 / FPS, 2), "초")


if __name__ == "__main__":
    main()
