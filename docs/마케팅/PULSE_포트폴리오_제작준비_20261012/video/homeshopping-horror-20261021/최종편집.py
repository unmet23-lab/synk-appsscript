# 「매진 임박」 시댄스 판 최종 편집(2026-11-03, Claude) — 04_콘티 3절 31컷을 원본 시각 · 길이 그대로 하드컷으로 잇고, 대사는 시댄스 생성 목소리를 Demucs로 떼어 놓는다.
#   python -X utf8 최종편집.py 화면          → 최종/_컷/NN.mp4 · 최종/화면.mp4(1920×1080 · 24fps · 소리 없음)
#   python -X utf8 최종편집.py 소리          → 최종/소리.wav(대사 · 흐느낌 · 방 소리 · 카드 음악 · 효과음, −14 LUFS 안팎)
#   python -X utf8 최종편집.py 판            → 최종/매진임박_16x9.mp4 · 매진임박_9x16.mp4 · _폰.mp4 · 1초 시트(9:16은 원본처럼 가운데 영화 띠 + 위 머리글)
#   python -X utf8 최종편집.py 나란히        → 최종/원본과나란히.mp4(왼쪽 원본 띠 · 오른쪽 우리 판, 원본 프레임이 들어가 git 밖에만)
# 후보정 없음(결정 10-24): 색 · 밝기 · 떨림 · 속도를 건드리지 않고 받은 판을 시작점부터 잘라 잇기만 한다. 틀린 컷은 다시 뽑는다. 쓰는 판 · 시작점은 CUTS 한 곳이다.
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from 최종편집공통 import Mix, load, load_stereo

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
V = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021"
OUT = os.path.join(V, "최종")
VOX = os.path.join(OUT, "소리")   # 판마다 Demucs로 뗀 목소리(<판>.wav)
CARD = os.path.join(V, "영상", "v4", "카드")
REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
BGM = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/hs_OrderNow_B.mp3"   # Suno 「Order Now」(aaae3b39, 11-03 — 90년대 인포머셜풍 연주곡)
AMB = os.path.join(V, "remotion_v1-v3_워크트리사본", "public", "amb")
SFX = os.path.join(V, "remotion_v1-v3_워크트리사본", "public", "sfx")
SHOTS = {s["n"]: s for s in json.load(open(os.path.join(V, "원본", "원본_샷.json"), encoding="utf-8"))}
FPS = 24
RATE = 48000
ENDT = SHOTS[31]["f1"] / FPS

# 컷 번호 → (받은 판, 그 판에서 시작하는 초). 대사 컷은 말 시작이 원본 받아쓰기 시각에 오게 골랐다. 카드는 판이 None(영상/v4/카드/C<컷>.mp4).
CUTS = {
    1: ("hs-S01", 0.04),
    2: ("hs-S02-B", 2.40),
    3: ("hs-S03", 0.66),     # 주머니를 건네는 몸짓이 컷 0.4~0.8초
    4: ("hs-S04-B", 0.43),
    5: ("hs-S05", 1.20),     # 허리 → 얼굴 틸트가 2~3초
    6: ("hs-S06", 0.40),     # 첫 0.33초 칼이 튄다
    7: ("hs-S07-B", 3.08),
    8: ("hs-S08-B", 2.66),
    9: ("hs-S09", 0.95),      # 주머니에서 꺼내는 손부터
    10: ("hs-S10-B", 0.05),
    11: (None, 0),
    12: ("hs-S12-B", 0.62),
    13: ("hs-S13", 1.00),    # 내리는 동작이 컷 끝
    14: ("hs-S14", 0.30),
    15: ("hs-S15", 1.75),    # 돌아서는 동작이 컷 끝
    16: ("hs-S16-B", 2.75),  # 벌린 입 → 컷 0.4초에 손으로 가림(원본 25.1초)
    17: ("hs-S17", 3.00),    # 앞 3초는 어깨 위 손이 없다 — 손이 들어온 끝 구간
    18: ("hs-S18", 0.30),
    19: ("hs-S19b", 1.85),   # 다시 뽑은 판 — #23과 같은 분홍 인쇄 상자, 상자가 컷 1.1초에 올라온다(원본 1.4초)
    20: ("hs-S20-B", 1.52),
    21: (None, 0),
    22: ("hs-S22-B", 1.04),  # 두 번째 「제발요!」가 원본 40.08초에, 끝에 이를 드러냄
    23: ("hs-S23-B", 0.60),   # 상자를 내리고 주머니로 가는 몸짓을 원본 45.2 · 45.7초에 맞춤(말은 0.3초 늦음)
    24: ("hs-S24", 0.30),
    25: ("hs-S25", 0.30),
    26: ("hs-S26-B", 1.21),  # 끝 그림 얼굴에 닿는 뒤쪽 구간
    27: (None, 0),
    28: ("hs-S28-B", 0.60),
    29: (None, 0),
    30: ("hs-S30-B", 0.00),
    31: ("hs-S31", 0.30),
}


def run(*a):
    subprocess.run(a, check=True)


def probe_frames(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", p],
                       capture_output=True, text=True)
    return int(r.stdout.strip().split(",")[0])


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    lst = os.path.join(d, "_목록.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for n, (cid, t) in CUTS.items():
            s = SHOTS[n]
            k = s["f1"] - s["f0"]
            src = os.path.join(CARD, f"C{n}.mp4") if cid is None else os.path.join(DAY, cid + ".mp4")
            a = round(t * FPS)
            have = probe_frames(src)
            if a + k > have:   # 판 끝을 넘으면 시작을 당긴다(같은 장을 늘리지 않는다)
                print(f"#{n}: {cid} {a}+{k} > {have} — 시작을 당김")
                a = max(0, have - k)
            out = os.path.join(d, f"{n:02d}.mp4")
            vf = f"select='between(n,{a},{a + k - 1})',setpts=N/{FPS}/TB,scale=1920:1080:flags=lanczos:out_color_matrix=bt709,format=yuv420p"
            run("ffmpeg", "-y", "-v", "error", "-i", src, "-an", "-vf", vf, "-frames:v", str(k), "-c:v", "libx264", "-crf", "12", "-preset", "medium",
                "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)
            f.write(f"file '{out}'\n")
    run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(OUT, "화면.mp4"))
    print("화면", probe_frames(os.path.join(OUT, "화면.mp4")), "프레임 ·", SHOTS[31]["f1"])


def vox(cid, a, b):
    x = load(os.path.join(VOX, cid + ".wav"))
    return x[int(a * RATE):int(b * RATE)]


# 대사 · 흐느낌 놓기 — (타임라인 초, 판, 판 안 처음, 끝, dB). 화면에 입이 보이는 컷은 CUTS 시작점과 같은 자리에 둔다.
EVENTS = [
    (0.00, "hs-S02-B", 1.86, 3.07, 0),      # 강도 「가진 거 다 내놔!」 — 원본 0.00~1.12
    (1.38, "hs-말-통2", 0.89, 1.58, 0),     # C 「여기요!」
    (2.92, "hs-S04-B", 0.02, 1.93, 0),      # 강도 「다 앉아, 당장!」
    (5.20, "hs-S26-B", 1.51, 2.27, -10),    # #5 흐느낌
    (7.34, "hs-S07-B", 2.25, 3.59, 0),      # A 「이게 전부예요!」
    (9.05, "hs-S08-B", 2.63, 3.39, 0),      # B 「진짜!」
    (12.26, "hs-S10-B", 0.89, 2.40, 0),     # A 「안 돼 안 돼 안 돼 안 돼!」
    (12.60, "hs-S26-B", 2.48, 2.82, -12),   # C 흐느낌
    (13.82, "hs-말-지유", 0.64, 5.03, 0),   # 카드 1 — 한 호흡(원본 13.82~18.22와 거의 같은 길이)
    (18.30, "hs-S12-B", 0.63, 1.95, 0),     # A 「안 돼!」(#13으로 넘어가며 끊김)
    (21.20, "hs-S10-B", 2.73, 2.98, 10),    # #14 A 흐느낌
    (22.10, "hs-S10-B", 3.30, 4.03, 10),
    (23.32, "hs-말-통2", 2.58, 3.18, 0),    # C 「안 돼!」
    (24.58, "hs-말-통2", 4.44, 5.13, 0),    # C 「안 돼!」 — #16 입을 벌린 채
    (25.25, "hs-S26-B", 1.51, 2.27, -8),    # 손으로 가린 뒤 흐느낌
    (29.80, "hs-S20-B", 0.90, 2.20, 0),     # B 「잠깐만요!」 — #19 끝부터 #20 입과 같은 소리
    (31.16, "hs-말-리4", 0.02, 8.03, 0),    # 카드 2 — 한 호흡
    (39.00, "hs-S22-B", 1.04, 3.37, 0),     # B 흐느낌 · 「제발요!」
    (42.40, "hs-S23-B", 1.67, 2.83, 0),     # 강도 「방금 그거 한국말이야?」
    (44.56, "hs-말-지유", 6.01, 6.75, -2),  # 「안 돼!」
    (45.79, "hs-말-지유", 7.12, 8.03, -2),  # 「안 돼!」
    (47.46, "hs-말-강도", 0.19, 0.67, 0),   # 강도 「으!」
    (48.96, "hs-S26-B", 1.21, 7.00, 0),     # C 울부짖음 · 「세상에…!」
    (54.90, "hs-말-강도", 3.28, 3.65, 0),   # 강도 「…왜?」
    (57.46, "hs-S28-B", 0.60, 3.58, 0),     # C 「안 돼, 내 코케트 떡볶이!」
    (61.30, "hs-말-통2", 2.58, 3.18, 0),    # 「안 돼!」
    (62.50, "hs-말-통2", 4.44, 5.13, 0),    # 「안 돼!」
    (63.99, "hs-말-통2", 6.09, 6.52, 0),    # 「그거 내」 → #30의 「저녁인데!」로 이어짐
    (64.42, "hs-S30-B", 0.00, 6.38, 0),     # C 「…저녁인데!」 · 「그냥 죽여!」
    (66.75, "hs-S26-B", 1.51, 2.27, -4),    # 고개 떨구고 흐느낌(판 소리가 비는 자리)
    (67.85, "hs-S26-B", 2.48, 2.82, -4),
]
MUSIC = {"곡": BGM, "시작": 0.0, "dB": -7, "구간": [(SHOTS[n]["f0"] / FPS, SHOTS[n]["f1"] / FPS) for n in (11, 21, 27, 29)]}
ROOM = (os.path.join(AMB, "candle.wav"), -7)   # 공포 구간 −45~−50 dB 정적(원본 실측)
HITS = [(15.80, "ding1.wav", -14), (33.00, "ding1.wav", -14), (45.30, "thud.wav", -20), (62.10, "thud.wav", -8), (62.70, "ding2.wav", -10)]


def mix_audio():
    m = Mix(ENDT + 0.5)
    for t, cid, a, b, db in EVENTS:
        m.put(t, vox(cid, a, b), db)
    # 방 소리 — 공포 구간은 −45~−50 dB의 정적(원본 실측), 카드 구간에서는 끊는다
    room = load(ROOM[0])
    room = np.resize(room, len(m.a)) * (10 ** (ROOM[1] / 20))
    gate = np.ones(len(m.a), np.float32)
    for a, b in MUSIC["구간"]:
        gate[int(a * RATE):int(b * RATE)] = 0
    m.a += np.stack([room * gate, room * gate], axis=1)
    # 카드 음악 — 하드컷에서 뚝 끊긴다(원본 실측), 곡은 카드마다 이어진다
    bgm = load_stereo(MUSIC["곡"])
    pos = int(MUSIC["시작"] * RATE)
    for a, b in MUSIC["구간"]:
        n = int((b - a) * RATE)
        m.put(a, bgm[pos:pos + n], MUSIC["dB"], fade=0.004)
        pos += n
    for t, name, db in HITS:
        m.put(t, load(os.path.join(SFX, name)), db)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=-2.8)   # 스테레오 기준 원본 크기(−14.6 LUFS) 안팎


def font(name, size):
    return ImageFont.truetype(os.path.join(SUIT, f"SUIT-{name}.otf"), size)


def band_layer(W, H, top, bottom, band_h):
    # 9:16 위 · 아래 검정 띠의 글 — 원본 자리(가운데 16:9 띠 위에 머리글 두 줄, 아래 비움) + AI 고지
    im = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(im)
    y0 = (H - band_h) // 2
    f = font("ExtraBold", 58)
    lines = top
    lh = 76
    total = lh * len(lines)
    y = y0 - 60 - total
    for s in lines:
        w = d.textlength(s, font=f)
        d.text(((W - w) / 2, y), s, font=f, fill=(255, 255, 255))
        y += lh
    f2 = font("Medium", 26)
    w = d.textlength(bottom, font=f2)
    d.text(((W - w) / 2, y0 + band_h + 28), bottom, font=f2, fill=(150, 150, 150))
    return im


NOTICE = "가상 브랜드 · AI로 만든 가상 모델 · 음성"
HEAD_A = ["홈쇼핑 덕후", "코미디 스케치를 만들었다"]
HEAD_B = ["제품 광고 문의", "PULSE"]
HEAD_CHANGE = 67.21


def render():
    pic = os.path.join(OUT, "화면.mp4")
    wav = os.path.join(OUT, "소리.wav")
    t = os.path.join(OUT, "_글")
    os.makedirs(t, exist_ok=True)
    # 16:9 — 화면 그대로, 마지막 컷(#31)에 PULSE 로고 · 문의 한 줄, 밑에 AI 고지(글자는 후반에서, 제작 규칙 D)
    ov = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    f = font("Medium", 22)
    w = d.textlength(NOTICE, font=f)
    d.text((1920 - w - 40, 1080 - 50), NOTICE, font=f, fill=(255, 255, 255, 150))
    ov.save(os.path.join(t, "고지.png"))
    ov2 = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    logo = Image.open(os.path.join(REPO, "docs", "홍보물", "마케팅실행_20260909", "브랜드킷", "배치용", "SYNK-PULSE-Paper.png")).convert("RGBA")   # 어두운 바탕용 승인 조합
    logo = logo.resize((480, round(480 * logo.height / logo.width)), Image.LANCZOS)
    ov2.alpha_composite(logo, (1920 - 480 - 60, 770))
    d = ImageDraw.Draw(ov2)
    f = font("SemiBold", 44)
    s = "제품 광고 문의"
    w = d.textlength(s, font=f)
    d.text((1920 - w - 60, 770 + logo.height + 14), s, font=f, fill=(255, 255, 255, 235))
    ov2.save(os.path.join(t, "문의.png"))
    a16 = os.path.join(OUT, "매진임박_16x9.mp4")
    run("ffmpeg", "-y", "-v", "error", "-i", pic, "-i", wav, "-i", os.path.join(t, "고지.png"), "-i", os.path.join(t, "문의.png"), "-filter_complex",
        f"[0:v][2:v]overlay=0:0[a];[a][3:v]overlay=0:0:enable='gte(t,{SHOTS[31]["f0"] / FPS})',format=yuv420p[v]", "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", a16)
    # 9:16 — 1080×1920, 가운데 16:9 띠(폭 그대로 608줄)
    bh = 608
    band_layer(1080, 1920, HEAD_A, NOTICE, bh).save(os.path.join(t, "띠_앞.png"))
    band_layer(1080, 1920, HEAD_B, NOTICE, bh).save(os.path.join(t, "띠_뒤.png"))
    a9 = os.path.join(OUT, "매진임박_9x16.mp4")
    y0 = (1920 - bh) // 2
    run("ffmpeg", "-y", "-v", "error", "-i", pic, "-i", wav, "-loop", "1", "-i", os.path.join(t, "띠_앞.png"), "-loop", "1", "-i", os.path.join(t, "띠_뒤.png"), "-filter_complex",
        f"[0:v]scale=1080:{bh}:flags=lanczos[b];[2:v][3:v]overlay=0:0:enable='gte(t,{HEAD_CHANGE})'[bg];[bg][b]overlay=0:{y0}:shortest=1,format=yuv420p[v]",
        "-map", "[v]", "-map", "1:a", "-t", f"{ENDT:.3f}", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", a9)
    for src, dst, sc in ((a16, "매진임박_16x9_폰.mp4", "1280:-2"), (a9, "매진임박_9x16_폰.mp4", "720:-2")):
        run("ffmpeg", "-y", "-v", "error", "-i", src, "-vf", f"scale={sc}", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, dst))
    print(a16, a9)


def side_by_side():
    reel = os.path.join(V, "원본", "DeucDo_SVU5.mp4")
    out = os.path.join(OUT, "원본과나란히.mp4")
    run("ffmpeg", "-y", "-v", "error", "-i", reel, "-i", os.path.join(OUT, "매진임박_16x9.mp4"), "-filter_complex",
        "[0:v]crop=720:404:0:438,scale=960:540[a];[1:v]scale=960:540[b];[a][b]hstack,format=yuv420p[v]", "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-crf", "23", "-preset", "fast", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-shortest", out)
    print(out)


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    what = sys.argv[1] if len(sys.argv) > 1 else "화면"
    {"화면": picture, "소리": mix_audio, "판": render, "나란히": side_by_side}[what]()
