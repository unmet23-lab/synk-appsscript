# 시즌 1 「옆집의 크리스마스」 이미지 콘티 첫 판 → 60초 애니매틱(낯선 사람 이해 시험 15차, 2026-10-26).
# 이야기스케치 애니매틱_13.py(연필 판)와 같은 초 · 자막 · 들리는 소리에, 그림만 이미지 콘티(git 밖 컷/C01~C36.jpg)로 바꾼다.
# 화면 글자(간판 「늘켬」 · 봉투 마크 · 1+1 · 끝 문구 · 로고)는 후반에 얹는 것이라 여기서도 애니매틱 표시로 얹는다(LABELS — 그림을 보고 자리를 잰다).
#   python -X utf8 이미지콘티_애니매틱.py  → git 밖 콘티/xmas-neighbors/시험/애니매틱_콘티1.mp4 · 말_콘티1.txt · 컷_콘티1.txt(--컷에 줄 초)
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "xmas-neighbors")
FONT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-SemiBold.otf")
FONT_B = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-ExtraBold.otf")
W, H = 1920, 1080
OUT = os.path.join(V, "시험")

# (컷, 시작, 끝, 그림, 자막) — 컷 경계는 02_콘티 2절(원본 그대로, 34 꼬리 1초만 35로). 1 · 34는 자막 때문에 둘로 나눈다.
SEGS = [(1, 0.00, 1.90, "C01", "(전화) 아들, 집엔 들어갔어?"), (1, 1.90, 3.56, "C01", "응, 들어왔어.")]
STARTS = [3.56, 4.52, 5.88, 7.04, 8.64, 10.08, 11.88, 13.28, 15.00, 15.96, 17.40, 18.80, 20.00, 21.44, 22.76, 24.12, 24.60, 25.88,
          28.44, 30.76, 32.00, 33.36, 34.48, 35.92, 37.48, 38.88, 40.12, 42.88, 44.04, 46.44, 47.60, 49.68, 50.84]
for k, s in enumerate(STARTS):
    n = k + 2
    e = STARTS[k + 1] if k + 1 < len(STARTS) else 52.40
    SEGS.append((n, s, e, f"C{n:02d}", "응, 엄마. 들어왔어." if n == 31 else None))
SEGS += [(34, 52.40, 53.84, "C34b", "메리 크리스마스, 옆집."), (35, 53.84, 57.08, "C35", None), (36, 57.08, 60.04, "C36", None)]

SOUND = [
    (0.0, "[낮은 피아노, 바깥 복도 바람]"), (0.3, "엄마(전화 스피커): 아들, 집엔 들어갔어?"), (1.9, "남자: 응, 들어왔어."),
    (2.7, "[어둠 속에서 열쇠 꾸러미가 바닥에 떨어지는 소리 — 짤그랑]"), (3.6, "[전등이 지직 하다 툭]"), (4.6, "[열쇠 짤랑]"),
    (7.0, "[봉투 내려놓는 바스락]"), (8.7, "[열쇠 끝이 문을 긁는 소리, 작은 한숨]"), (10.1, "[옆집 문 열림, 웃음소리 · 음악 · 수다]"),
    (15.0, "[옆집 스피커 음악이 커지고 환호]"), (16.0, "[웃음소리가 멀어짐]"), (17.5, "[철컥 — 문 열림, 철문 닫힘]"),
    (18.8, "[전자레인지 띵, 벽 너머 먹먹한 음악]"), (22.8, "[낙엽 바스락, 열쇠 짤랑]"), (24.1, "[휴대폰 배터리 부족 알림음]"),
    (24.6, "[웃음소리, 발소리]"), (28.4, "[폭우, 발소리]"), (30.8, "[빗소리, 열쇠 짤랑, 봉투 떨어지는 소리]"), (32.0, "[옷깃 스치는 소리]"),
    (33.4, "[눈 밟는 소리]"), (35.4, "[음악이 잠깐 멎었다가 현악이 들어온다]"), (40.1, "[딸깍 — 그리고 열쇠가 한 번에 철컥]"),
    (43.6, "[음악이 커진다]"), (46.5, "남자(복도 너머로 작게, 전화): 응, 엄마. 들어왔어."), (47.6, "[유리 전구 집는 소리, 비닐봉지]"),
    (49.7, "[스탠드 딸깍]"), (52.4, "여자(작게): 메리 크리스마스, 옆집."), (53.0, "[오케스트라]"),
    (57.1, "내레이션: 옆집까지, 늘 켜 둡니다. 늘켬."), (59.4, "[음악 끝]"),
]

# 그림 속 간판 · 봉투 · 상자 자리에 얹는 표시(그림 이름: [(종류, 가로 0~1, 세로 0~1, 크기)]) — 받은 그림을 보고 채운다.
LABELS = {}


def sub(img, text):
    d = ImageDraw.Draw(img, "RGBA")
    f = ImageFont.truetype(FONT, 50)
    tw = d.textlength(text, font=f)
    x = (W - tw) / 2
    y = H - 140
    d.rounded_rectangle((x - 28, y - 14, x + tw + 28, y + 70), radius=14, fill=(0, 0, 0, 170))
    d.text((x, y), text, font=f, fill=(255, 255, 255))


def label(img, kind, fx, fy, k):
    d = ImageDraw.Draw(img, "RGBA")
    x, y = W * fx, H * fy
    if kind == "sign":   # 길 건너 편의점 간판 — 영상에서는 거리의 실제 간판 글(화면 글이 아님)
        f = ImageFont.truetype(FONT_B, int(54 * k))
        tw = d.textlength("늘켬", font=f)
        d.rounded_rectangle((x - tw / 2 - 18 * k, y - 38 * k, x + tw / 2 + 18 * k, y + 38 * k), radius=10, fill=(246, 176, 62, 245))
        d.text((x, y), "늘켬", font=f, fill=(255, 252, 244), anchor="mm")
    elif kind == "bag":   # 늘켬 봉투의 호박빛 마크
        f = ImageFont.truetype(FONT_B, int(40 * k))
        r = 46 * k
        d.ellipse((x - r, y - r, x + r, y + r), fill=(246, 176, 62, 245))
        d.text((x, y - 2), "늘켬", font=f, fill=(255, 252, 244), anchor="mm")
    elif kind == "box":   # 1+1 상자 표시 — 상품 인서트가 아니라 흔적
        r = int(40 * k)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(200, 40, 50, 225))
        d.text((x, y - 2), "1+1", font=ImageFont.truetype(FONT_B, int(r * 0.82)), fill=(255, 255, 255), anchor="mm")


def ends(img, n):
    if n == 35:   # 마지막 넓은 그림 위 끝 문구(그림이 보이게 아래만 어둡게)
        grad = Image.new("L", (1, H))
        for y in range(H):
            grad.putpixel((0, y), int(190 * max(0.0, (y / H - 0.45) / 0.55)))
        shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        shade.putalpha(grad.resize((W, H)))
        img.alpha_composite(shade)
        ImageDraw.Draw(img).text((W / 2, H * 0.80), "1+1의 하나는, 옆집에", font=ImageFont.truetype(FONT_B, 88), fill=(255, 255, 255), anchor="mm")
    elif n == 36:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 120)))
        d = ImageDraw.Draw(img, "RGBA")
        d.rounded_rectangle((W / 2 - 320, H / 2 - 90, W / 2 + 320, H / 2 + 60), radius=18, fill=(246, 176, 62, 255))
        d.text((W / 2, H / 2 - 15), "늘켬 편의점", font=ImageFont.truetype(FONT_B, 92), fill=(255, 252, 244), anchor="mm")
        d.text((W / 2, H / 2 + 150), "옆집까지 늘 켜 둡니다", font=ImageFont.truetype(FONT_B, 64), fill=(255, 255, 255), anchor="mm")


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "칸"), exist_ok=True)
    for old in os.listdir(os.path.join(OUT, "칸")):
        os.remove(os.path.join(OUT, "칸", old))
    segs = []
    for k, (n, a, b, pic, s) in enumerate(SEGS):
        p = os.path.join(V, "컷", f"{pic}.jpg")
        if not os.path.exists(p):
            p = os.path.join(V, "컷", f"C{n:02d}.jpg")
        img = Image.open(p).convert("RGB").resize((W, H)).convert("RGBA")
        for kind, fx, fy, kk in LABELS.get(pic, LABELS.get(f"C{n:02d}", [])):
            label(img, kind, fx, fy, kk)
        ends(img, n)
        if s:
            sub(img, s)
        q = os.path.join(OUT, "칸", f"{k:02d}.png")
        img.convert("RGB").save(q)
        segs.append((q, b - a))
    lst = os.path.join(OUT, "칸", "목록.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for q, d in segs:
            f.write(f"file '{q.replace(os.sep, '/')}'\nduration {d:.3f}\n")
        f.write(f"file '{segs[-1][0].replace(os.sep, '/')}'\n")
    out = os.path.join(OUT, "애니매틱_콘티1.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-f", "lavfi", "-i",
                    "anullsrc=r=48000:cl=stereo", "-shortest", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20",
                    "-c:a", "aac", "-t", "60.04", out], check=True)
    with open(os.path.join(OUT, "말_콘티1.txt"), "w", encoding="utf-8") as f:
        for t, s in SOUND:
            f.write(f"{t:.1f}s  {s}\n")
    with open(os.path.join(OUT, "컷_콘티1.txt"), "w", encoding="utf-8") as f:
        f.write(",".join(f"{a:.2f}" for _, a, _, _, _ in SEGS))
    print("끝", out)
