# 11번 반려동물 「첨벙댕」 최종 편집(2026-11-03, Claude) — 02_콘티 2절 10컷을 시각 그대로 하드컷으로 잇고, 민재 내레이션(시댄스 목소리) · 자막 · 음악 · 효과음을 놓는다.
#   python -X utf8 최종편집.py   → git 밖 pulse-portfolio12-20261024/최종/p11/첨벙댕_9x16.mp4 · _폰.mp4 · _반초.jpg
# 다시 뽑은 판(p11-03b · p11-04b)과 내레이션 판(p11-말-민재-1~3)이 들어오면 저절로 그 판을 쓴다 — 아직이면 앞 판 · 소리 없이. 후보정 없음(결정 10-24).
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p11"
SFX = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files"
DING = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx/ding1.wav"
BGM = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/p11_Splash_A.mp3"   # Suno 「Splash Dog」(13a45838, 11-03)
SUIT = os.path.join(C.REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-Heavy.otf")
SUIT_M = os.path.join(C.REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-Medium.otf")
BHS = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/fonts/BlackHanSans-Regular.ttf"
FPS, W, H = 24, 1080, 1920
T = [0, 2.17, 3.80, 6.50, 11.23, 12.83, 13.47, 14.90, 16.27, 19.33, 22.06]   # 컷 경계(02_콘티 2절)
END = T[-1]

# 컷 번호 → (쓸 판 차례, 그 판에서 시작하는 초)
CUTS = {
    1: (("p11-01-02",), 0.00),   # 샷1 — 2.42초에 샷2로 넘어가니 그 앞까지
    2: (("p11-01-02",), 3.38),   # 샷2 끝 — 걸어 나가 발자국만 남는 구간
    3: (("p11-03b", "p11-03"), 0.60),
    4: (("p11-04b", "p11-04"), 1.00),
    5: (("p11-05-06",), 0.20),   # 샷1(1.88초에 컷)
    6: (("p11-05-06",), 2.90),   # 샷2 — 손잡이를 쥔 채 살짝 당김
    7: (("p11-07-08",), 0.10),   # 샷1(1.67초에 컷)
    8: (("p11-07-08",), 1.75),   # 샷2 — 다리 사이에 매달린 무표정
    9: (("p11-09",), 0.40),      # 첫 판 — 둘째 판(__2)은 2.4초에 고개가 휙 돌아 첫 판을 쓴다
    10: (("p11-10",), 0.35),     # 놓고 → 쓰다듬고 → 엄지척이 컷 안에, 엄지는 끝 브랜드 글자 아래
}

# 자막 — (처음, 끝, 글). ★ 뒤 낱말을 강조색으로(원본처럼 한 자리에서 어절 2~4개씩). 내레이션을 받은 뒤 받아쓰기 시각으로 맞춘다
CAP = [
    (0.05, 1.05, "★외계인 닮은"), (1.05, 1.60, "우리 개는"), (1.60, 2.17, "★바닷가에서"),
    (2.17, 3.00, "뛰어노는 걸"), (3.00, 3.80, "제일 좋아해요"),
    (3.80, 4.55, "근데 사람들이"), (4.55, 5.70, "보면 깜짝 ★놀라요"), (5.70, 6.50, "그래서 올해는"),
    (6.50, 7.40, "★특별한 걸"), (7.40, 8.60, "준비했어요"), (8.60, 10.20, "★첨벙댕 구명조끼!"), (10.20, 11.23, "값도 착하고"),
    (11.23, 11.90, "★튼튼해요"), (11.90, 12.83, "등에 ★손잡이가 두 개라"),
    (12.83, 13.47, "물에서도"),
    (13.47, 14.05, "★번쩍"), (14.05, 14.90, "건져요"),
    (14.90, 15.55, "올해는 진짜"), (15.55, 16.27, "★멋있을 거예요"),
    (16.27, 16.95, "아무도"), (16.95, 18.15, "★외계인인 줄"), (18.15, 19.33, "모를걸요?"),
    (19.33, 21.20, "물놀이 가는 날엔"),
]
BRAND_T = 21.20   # 끝 0.86초 브랜드 이름 크게

NARR = [("p11-말-민재-1", 0.00), ("p11-말-민재-2", 8.60), ("p11-말-민재-3", 14.90)]   # (판, 타임라인 — 말 시작이 여기)


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n, (ids, t) in CUTS.items():
        a0, a1 = round(T[n - 1] * FPS), round(T[n] * FPS)
        k = a1 - a0
        pid = C.latest(*ids)
        src = C.clip(pid)
        a = round(t * FPS)
        have = C.frames_of(src)
        if a + k > have:
            a = max(0, have - k)
            print(f"#{n} {pid}: 시작을 {a / FPS:.2f}초로 당김")
        out = os.path.join(d, f"{n:02d}.mp4")
        C.cut_video(src, a, k, W, H, FPS, out)
        paths.append(out)
        print(f"#{n} {pid} {a / FPS:.2f}초부터 {k}장")
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))


def text_png(s, path):
    # 강조 낱말은 레몬색, 나머지는 흰색 — 굵은 글자 + 검은 테
    f = ImageFont.truetype(SUIT, 76)
    parts = []
    for i, chunk in enumerate(s.split("★")):
        if not chunk:
            continue
        if i == 0:
            parts.append((chunk, (255, 255, 255)))
        else:
            w = chunk.split(" ", 1)
            parts.append((w[0], (255, 214, 10)))
            if len(w) > 1:
                parts.append((" " + w[1], (255, 255, 255)))
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tw = sum(d.textlength(p, font=f) for p, _ in parts)
    x = (W - tw) / 2
    for p, col in parts:
        d.text((x, 1290), p, font=f, fill=col, stroke_width=7, stroke_fill=(0, 0, 0))
        x += d.textlength(p, font=f)
    im.save(path)


def brand_png(path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(BHS, 196)
    s = "첨벙댕"
    d.text(((W - d.textlength(s, font=f)) / 2, 130), s, font=f, fill=(255, 224, 40), stroke_width=12, stroke_fill=(16, 28, 84))   # 천장 빈 자리 — 개와 조끼를 가리지 않게
    im.save(path)


def notice_png(path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(SUIT_M, 24)
    s = "가상 브랜드 · AI로 만든 가상 모델 · 음성"
    d.text(((W - d.textlength(s, font=f)) / 2, H - 70), s, font=f, fill=(255, 255, 255, 170), stroke_width=2, stroke_fill=(0, 0, 0, 120))
    im.save(path)


def speech_span(x):
    # 소리 나는 처음 · 끝(−38 dB 위) — 판 앞뒤의 빈 자리를 뺀다
    import numpy as np
    n = 480
    e = np.array([np.sqrt(np.mean(x[i:i + n] ** 2) + 1e-12) for i in range(0, len(x) - n, n)])
    on = np.where(20 * np.log10(e) > -38)[0]
    return (int(on[0]) * n, int(on[-1] + 1) * n) if len(on) else (0, len(x))


def sound():
    m = C.Mix(END + 0.3)
    voiced = False
    for pid, t in NARR:
        if os.path.exists(C.clip(pid)):
            x = C.load(C.voice_only(pid, os.path.join(OUT, "소리")))
            a, b = speech_span(x)
            m.put(t, x[a:b])
            voiced = True
            print(pid, "말", round((b - a) / C.RATE, 2), "초 →", t, "~", round(t + (b - a) / C.RATE, 2))
    bgm = C.load_stereo(BGM)
    m.put(0, bgm[:int((END + 0.2) * C.RATE)], -17 if voiced else -8, fade_out=0.25)
    # 바탕: 해변 1~3번 컷만(하드컷에서 끊김), 파도 · 바람 아주 작게
    sea = C.load_stereo(os.path.join(SFX, "Ocean Waves Day From Balcony.wav"))
    m.put(0, sea[C.RATE * 3:C.RATE * 3 + int(T[3] * C.RATE)], -24, fade=0.004)
    # 사건 소리 — 동물 소리는 내지 않는다(콘티 3절)
    m.put(6.75, C.load(os.path.join(SFX, "Tape Ripping.M.wav"))[:int(1.0 * C.RATE)], -18, fade_out=0.2)
    m.put(11.95, C.load(os.path.join(SFX, "Belt Buckle.M.wav"))[:int(0.5 * C.RATE)], -12, fade_out=0.1)
    m.put(21.38, C.load(DING), -12)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=-3.0)   # 스테레오 기준 −14 LUFS 안팎


def render():
    t = os.path.join(OUT, "_글")
    os.makedirs(t, exist_ok=True)
    inputs, chain, last = [], [], "0:v"
    for i, (a, b, s) in enumerate(CAP):
        p = os.path.join(t, f"{i:02d}.png")
        text_png(s, p)
        inputs += ["-i", p]
        chain.append(f"[{last}][{i + 2}:v]overlay=0:0:enable='between(t,{a},{b - 0.001})'[v{i}]")
        last = f"v{i}"
    n = len(CAP) + 2
    p = os.path.join(t, "브랜드.png")
    brand_png(p)
    inputs += ["-i", p]
    chain.append(f"[{last}][{n}:v]overlay=0:0:enable='gte(t,{BRAND_T})'[vb]")
    p = os.path.join(t, "고지.png")
    notice_png(p)
    inputs += ["-i", p]
    chain.append(f"[vb][{n + 1}:v]overlay=0:0,format=yuv420p[v]")
    out = os.path.join(OUT, "첨벙댕_9x16.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(OUT, "화면.mp4"), "-i", os.path.join(OUT, "소리.wav"), *inputs, "-filter_complex", ";".join(chain), "-map", "[v]", "-map", "1:a",
          "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out)
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, "첨벙댕_9x16_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=12x4:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()
