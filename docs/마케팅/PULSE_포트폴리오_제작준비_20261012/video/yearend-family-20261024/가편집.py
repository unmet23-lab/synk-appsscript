# 6번 「연말 빈방」 가편집(2026-10-26) — 이미지 콘티 15조각을 02 콘티의 초대로 놓고, 자막 · 글판 · 끝 문구 · 로고 자리 표시를 얹고, 목소리 듣기 판을 붙인다.
#   python -X utf8 가편집.py [--노래 노래.wav --노래시작 0.0]   → synk-vendor/…/콘티/p6/가편집/가편집_<내레이터>.mp4(1280×720, 59.99초)
# 제작 규칙 순서 5(가편집: 콘티 이미지를 소리에 맞춰 놓고 리듬 · 장면 길이를 확정)의 판. 그림은 받은 판 그대로(컷/S##.jpg).
# 카메라는 원본 실측(01 2-1절 · 02 7-1절) — 고정 컷은 그대로 두고, 움직이는 셋(19 · 20 · 21)만 그 숫자대로 그림 안에서 움직인다
# (10-26 밤 유호님 「원본이랑 카메라 기법도 완전히 똑같게」). 그림 밖이 없으니 20 · 21은 가장자리를 9% · 6% 잘라 움직일 여유를 만든 판이다.
# 내레이터는 10-26 유호님 「나레이션은 이미지 콘티로 만들고나서 화면을 봐야 할것같아」 — 후보마다 한 판(혜리 · 서현 · 소진).
import argparse
import functools
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
P6 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024")
CUTS = os.path.join(P6, "콘티", "p6", "컷")
SOUND = os.path.join(P6, "소리", "p6")
OUT = os.path.join(P6, "콘티", "p6", "가편집")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
W, H, TOTAL = 1920, 1080, 59.99

# 02 2절 — 조각 · 우리 초(시작)
SHOTS = [(1, 0.00), (2, 4.77), (3, 7.57), (4, 9.94), (7, 15.48), (11, 20.65), (12, 24.83), (14, 28.46), (16, 31.06),
         (17, 34.56), (18, 37.97), (19, 41.07), (20, 44.07), (21, 46.24), (22, 51.68)]
# 자막(아래 가운데) — 02 2절의 말 자리
SUBS = [(5.11, 7.57, "아침은 먹고 가, 버스 놓친다!"), (10.11, 11.71, "밥 먹자, 김치찌개 했어!"), (12.01, 14.01, "배 안 고파, 이따 먹을게"),
        (14.01, 15.52, "다 식는다, 너!"), (16.88, 19.08, "문 잠그고 뭐 해, 또 자?"), (19.08, 20.65, "수능이 코앞이야!"),
        (20.68, 23.08, "내일 면접인데, 들어오지 말랬잖아!"), (23.08, 24.83, "이불만 갈았어, 이불만!"), (26.19, 28.46, "그 회사가 사람 볼 줄 모르네"),
        (28.96, 31.06, "첫 월급에 내복은 무슨…"), (48.11, 50.71, "이번 겨울엔… 오려나."), (58.85, 59.35, "엄마!")]
CARDS = [(4.80, 7.57, ["열일곱 살 딸의 방문에 노크가 필요해졌다"]), (35.80, 37.97, ["닫힌 문 앞이", "엄마의 자리였다"])]
ENDLINES = [(52.51, 56.72, "아무도 자지 않는 방에도", 0), (54.02, 56.72, "엄마는 철마다 새 이불을 펴 둡니다", 1)]   # 화면 왼쪽(엄마는 오른쪽)
LOGO = (57.72, TOTAL, "솜채")   # 로고는 자리 표시(글자) — 디자인은 브랜드 단계에서
NARR = ["혜리", "서현", "소진"]
FPS = 24


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ramp(t, t0, ease, v):
    """t0에서 들어와 ease초 동안 빨라진 뒤 초당 v로 가는 거리"""
    if t <= t0:
        return 0.0
    if t <= t0 + ease:
        return v * (t - t0) ** 2 / (2 * ease)
    return v * (ease / 2 + (t - t0 - ease))


# 컷 안 초 → 보이는 창(그림 비율의 왼쪽 위 x0 · y0, 배율 s). 내용이 왼쪽 · 위로 가면 창은 오른쪽 · 아래로 간다
CAM = {
    # 19 앞으로 다가감 — 3초 내내 같은 빠르기로 6%(먼 벽 4.9% · 가까운 문틀 5.8~7.8%의 가운데, 엄마는 문 앞), 중심 가로 44% · 세로 64%
    19: lambda t: (lambda s: (0.44 * (1 - 1 / s), 0.64 * (1 - 1 / s), s))(1 + 0.06 * t / 3.0),
    # 20 오른쪽으로 미끄러짐 — 2.17초 내내 같은 빠르기로 내용이 왼쪽 8.2%
    20: lambda t: (0.082 / 1.09 * t / 2.17, (1 - 1 / 1.09) / 2, 1.09),
    # 21 아래로 기욺(0~2.6초, 내용 위로 4.3%) → 끝 1.3초 0.8% 되돌아옴 · 오른쪽으로 돎(2.1초에 들어와 0.7초 동안 빨라져 초당 1.47% — 끝에 4.4%)
    21: lambda t: (ramp(t, 2.1, 0.7, 0.0147) / 1.06, (0.043 * smooth(t / 2.6) - 0.008 * smooth((t - 4.14) / 1.3)) / 1.06, 1.06),
}


@functools.lru_cache(maxsize=None)
def still(n):
    if n in (2, 17):
        return Image.new("RGB", (W, H), (0, 0, 0))
    return Image.open(os.path.join(CUTS, f"S{n:02d}.jpg")).convert("RGB").resize((W, H))


def shot_img(n, tr=0.0):
    im = still(n)
    if n not in CAM:
        return im.copy()
    x0, y0, s = CAM[n](tr)
    return im.transform((W, H), Image.AFFINE, (1 / s, 0, x0 * W, 0, 1 / s, y0 * H), resample=Image.BICUBIC)


def text_c(d, xy, s, font, fill=(245, 243, 238)):
    w = d.textlength(s, font=font)
    d.text((xy[0] - w / 2, xy[1]), s, font=font, fill=fill, stroke_width=3, stroke_fill=(10, 10, 10))


def frame(t):
    n, st = [(s, st) for s, st in SHOTS if st <= t + 1e-6][-1]
    im = shot_img(n, t - st)
    d = ImageDraw.Draw(im)
    for a, b, lines in CARDS:
        if a <= t < b:
            f = F("Medium", 58)
            y0 = H // 2 - 46 * len(lines)
            for i, s in enumerate(lines):
                w = d.textlength(s, font=f)
                d.text(((W - w) / 2, y0 + i * 92), s, font=f, fill=(232, 232, 232))
    for a, b, s in SUBS:
        if a <= t < b:
            text_c(d, (W / 2, H - 132), s, F("SemiBold", 50))
    for a, b, s, row in ENDLINES:
        if a <= t < b:
            d.text((150, 400 + row * 84), s, font=F("Medium", 56), fill=(248, 246, 240), stroke_width=2, stroke_fill=(20, 20, 20))
    if LOGO[0] <= t < LOGO[1]:
        d.text((150, 470), LOGO[2], font=F("ExtraBold", 120), fill=(248, 246, 240), stroke_width=3, stroke_fill=(20, 20, 20))
    return im


def song_graph(chorus, outro, outro_at=49.2):
    """노래 두 자리(02 4절): ① 후렴 첫 낱말을 31.63초에 — 0.5초 앞에서 0.4초에 걸쳐 들어와 44.43초에 0.35초로 끝남
    ② 맺음 첫 낱말을 outro_at초에(기본 49.2, 노래 A는 맺음을 길게 불러 「불 켜 둘게」가 다 들리게 47.5) — 46.5초부터 1초에 걸쳐 들어와
    −18dB로 속말 밑에 깔리고 52.4초까지 0.6초로 풀림(끝 내레이션 아래엔 음악 없음)"""
    a1, s1, e1 = 31.63 - 0.5, chorus - 0.5, chorus + 12.8
    a2, s2, e2 = 46.5, outro - (outro_at - 46.5), outro + (52.4 - outro_at)
    d1, d2 = e1 - s1, e2 - s2
    return (f"[2:a]asplit=2[sa][sb];"
            f"[sa]atrim=start={s1:.3f}:end={e1:.3f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.4,afade=t=out:st={d1 - 0.35:.3f}:d=0.35,adelay={int(a1 * 1000)}|{int(a1 * 1000)}[m1];"
            f"[sb]atrim=start={s2:.3f}:end={e2:.3f},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.0,afade=t=out:st={d2 - 0.6:.3f}:d=0.6,volume=-18dB,adelay={int(a2 * 1000)}|{int(a2 * 1000)}[m2];"
            f"[1:a][m1][m2]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.89[a]")


def build(narr, music=None, music_at=0.0, song=None, tag=""):
    os.makedirs(os.path.join(OUT, "프레임"), exist_ok=True)
    moving = []   # 움직이는 컷은 1/FPS초마다 한 장
    for k, (n, st) in enumerate(SHOTS):
        if n in CAM:
            en = SHOTS[k + 1][1] if k + 1 < len(SHOTS) else TOTAL
            moving += [st + i / FPS for i in range(int((en - st) * FPS) + 1)]
    cuts = sorted({0.0, TOTAL, *[st for _, st in SHOTS], *[x for a, b, _ in SUBS for x in (a, b)],
                   *[x for a, b, _ in CARDS for x in (a, b)], *[x for a, b, _, _ in ENDLINES for x in (a, b)], LOGO[0],
                   *[round(x, 4) for x in moving]})
    cuts = [c for c in cuts if 0 <= c <= TOTAL]
    lst = os.path.join(OUT, "프레임", "목록.txt")
    with open(lst, "w", encoding="utf-8") as fh:
        for k in range(len(cuts) - 1):
            a, b = cuts[k], cuts[k + 1]
            if b - a < 1e-3:
                continue
            p = os.path.join(OUT, "프레임", f"f{k:03d}.png")
            frame((a + b) / 2).save(p)
            fh.write(f"file '{p.replace(os.sep, '/')}'\nduration {b - a:.3f}\n")
        fh.write(f"file '{p.replace(os.sep, '/')}'\n")
    voice = os.path.join(SOUND, f"듣기_{narr}.mp3")
    out = os.path.join(OUT, f"가편집{tag}_{narr}.mp4")
    args = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-i", voice]
    flt = "[1:a]anull[a]"
    if song:   # (파일, 후렴 첫 낱말 초, 맺음 첫 낱말 초, 맺음을 놓을 초)
        args += ["-i", song[0]]
        flt = song_graph(song[1], song[2], song[3])
    elif music:
        ms = int(round(music_at * 1000))
        args += ["-i", music]
        flt = f"[2:a]adelay={ms}|{ms},volume=0.55[m];[1:a][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[a]"
    args += ["-filter_complex", flt, "-map", "0:v", "-map", "[a]", "-vf", "scale=1280:720,fps=24,format=yuv420p",
             "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-t", f"{TOTAL}", out]
    subprocess.run(args, check=True)
    print(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--노래", default=None)
    ap.add_argument("--노래시작", type=float, default=0.0)
    ap.add_argument("--후렴", type=float, default=None, help="노래 파일 안 후렴 첫 낱말 초(주면 02 4절의 두 자리로 얹는다)")
    ap.add_argument("--맺음", type=float, default=None, help="노래 파일 안 맺음 첫 낱말 초")
    ap.add_argument("--맺음자리", type=float, default=49.2, help="맺음 첫 낱말을 놓을 영상 초(기본 원본 자리 49.2)")
    ap.add_argument("--판", default=",".join(NARR), help="내레이터 후보(쉼표)")
    ap.add_argument("--이름", default="", help="출력 이름 덧말(예: _노래A)")
    a = ap.parse_args()
    song = (a.노래, a.후렴, a.맺음, a.맺음자리) if a.노래 and a.후렴 is not None and a.맺음 is not None else None
    for n in a.판.split(","):
        build(n, a.노래, a.노래시작, song, a.이름)
