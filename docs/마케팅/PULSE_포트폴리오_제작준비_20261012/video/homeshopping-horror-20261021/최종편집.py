# 「매진 임박」 시댄스 판 최종 편집(2026-11-03, Claude) — 04_콘티 3절 31컷을 원본 시각 · 길이 그대로 하드컷으로 잇고, 대사는 시댄스 생성 목소리를 Demucs로 떼어 놓는다.
#   python -X utf8 최종편집.py 화면          → 최종/_컷/NN.mp4 · 최종/화면.mp4(1920×1080 · 24fps · 소리 없음)
#   python -X utf8 최종편집.py 소리          → 최종/소리.wav(대사 · 흐느낌 · 방 소리 · 카드 음악 · 효과음, −14 LUFS 안팎)
#   python -X utf8 최종편집.py 판            → 최종/매진임박_16x9.mp4 · 매진임박_9x16.mp4 · _폰.mp4(9:16은 원본처럼 가운데 영화 띠 + 위 머리글 · 아래 말자막 — Remotion hs16 · hs9)
#   python -X utf8 최종편집.py 나란히        → 최종/원본과나란히.mp4(왼쪽 원본 띠 · 오른쪽 우리 판, 원본 프레임이 들어가 git 밖에만)
# 후보정 없음(결정 10-24): 색 · 밝기 · 떨림 · 속도를 건드리지 않고 받은 판을 시작점부터 잘라 잇기만 한다. 틀린 컷은 다시 뽑는다. 쓰는 판 · 시작점은 CUTS 한 곳이다.
import json
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from 최종편집공통 import Mix, load, load_stereo, md5

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
V = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021"
OUT = os.path.join(V, "최종")
VOX = os.path.join(OUT, "소리")   # 판마다 Demucs로 뗀 목소리(<판>.wav)
CARD = os.path.join(V, "영상", "v4", "카드")
BGM = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/hs_OrderNow_B.mp3"   # Suno 「Order Now」(aaae3b39, 11-03 — 90년대 인포머셜풍 연주곡)
AMB = os.path.join(V, "remotion_v1-v3_워크트리사본", "public", "amb")
SFX = os.path.join(V, "remotion_v1-v3_워크트리사본", "public", "sfx")
SHOTS = {s["n"]: s for s in json.load(open(os.path.join(V, "원본", "원본_샷.json"), encoding="utf-8"))}
FPS = 24
RATE = 48000
EXTRA_END = 53   # 끝 컷만 원본보다 2.2초 — 원본은 머리글로 닫고 우리는 도장 · 브랜드를 읽을 시간이 필요하다(11-05 크몽 세션 지적 「끝 3초가 절규보다 약함」)
ENDT = (SHOTS[31]["f1"] + EXTRA_END) / FPS
STAMP_AT = SHOTS[31]["f0"] / FPS + 1.08   # 강도가 말없이 허리 숙여 인사하고, 가장 깊이 숙인 순간(hs-S31c 36장)에 「매진 감사합니다」 쾅 — HS.tsx와 같은 값. 인사 첫머리에 찍으니 인사가 도장 뒤 어둠에 묻혔다(11-05 Fable)
BRAND_AT = STAMP_AT + 3 * 0.4925   # 도장을 읽는 곡의 세 박 — 곡의 착지에 강도가 다시 서서 렌즈를 본다(72장). 인사 도중에 로고가 들어오면 결을 밟는다(11-05 Fable)

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
    31: ("hs-S31c", 0.42),   # 꾸벅 인사 판(11-05) — 10장부터면 도장이 찍히는 20장에 고개를 숙이기 시작하고, 곡의 착지 뒤 일어나 72장부터 상자를 든 채 렌즈를 본다. 옛 판 hs-S31은 가만히 서 있어 끝이 맹했다(아르곤 두 번), hs-S31b는 2초 넘게 숙여 상자가 빠지고 어두운 덩어리로 보였다
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
            k = s["f1"] - s["f0"] + (EXTRA_END if n == 31 else 0)
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
    (64.42, "hs-말-통2", 6.09, 6.58, 0),    # 「그거 내」 — 6.52에서 자르면 「내」가 −8 dB 도중에 잘리고 0.08초 비어 「저- 저녁인데」처럼 들렸다(11-05 아르곤 네 번, 수치) · → #30의 「저녁인데!」로 이어짐. 63.99에 두면 그 사이 0.5초가 −38 dB로 비어 말이 끊겨 들렸다(11-04 아르곤 · 수치) — #30 첫머리는 휙 도는 흐림이라 입이 안 보인다
    (64.42, "hs-S30-B", 0.00, 6.38, 0),     # C 「…저녁인데!」 · 「그냥 죽여!」
    (66.75, "hs-S26-B", 1.51, 2.27, -4),    # 고개 떨구고 흐느낌(판 소리가 비는 자리)
    (67.85, "hs-S26-B", 2.48, 2.82, -4),
]
MUSIC = {"곡": BGM, "시작": 0.0, "dB": -7, "구간": [(SHOTS[n]["f0"] / FPS, SHOTS[n]["f1"] / FPS) for n in (11, 21, 27, 29)]}
ROOM = (os.path.join(AMB, "candle.wav"), -7)   # 공포 구간 −45~−50 dB 정적(원본 실측)
HITS = [(15.80, "ding1.wav", -14), (33.00, "ding1.wav", -14), (45.30, "thud.wav", -20), (62.10, "thud.wav", -8), (62.70, "ding2.wav", -10),
        (STAMP_AT, "thud.wav", -2), (BRAND_AT, "thud.wav", -8)]   # 끝 — 도장 쾅에 카드 음악이 돌아오고 브랜드에 딩. 정적만으로는 끝의 소리 한 방이 없었다(11-04 아르곤 · 11-05 −46 dB로 힘이 빠짐)


def ring(x, seconds, wet_db=-6):
    # 곡 끝 토막의 잔향만 돌려준다 — 지수로 줄어드는 잡음과 합성곱(그 시간에 −60 dB)
    n = int(seconds * RATE)
    ir = np.random.default_rng(12).standard_normal(n) * np.exp(-np.arange(n) / RATE / (seconds / 6.9))
    size = n + len(x)
    wet = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], size) * np.fft.rfft(ir, size), size) for c in range(x.shape[1])], axis=1).astype(np.float32)
    return wet * (np.max(np.abs(x)) / (np.max(np.abs(wet)) or 1) * 10 ** (wet_db / 20))


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
    gate[int(STAMP_AT * RATE):] = 0   # 끝 곡 아래 방 소리는 뺀다 — 잔향이 맺힌 뒤 44 Hz 울렁임만 남았다(11-05 수치)
    m.a += np.stack([room * gate, room * gate], axis=1)
    # 카드 음악 — 하드컷에서 뚝 끊긴다(원본 실측), 곡은 카드마다 이어진다
    bgm = load_stereo(MUSIC["곡"])
    pos = int(MUSIC["시작"] * RATE)
    for a, b in MUSIC["구간"]:
        n = int((b - a) * RATE)
        m.put(a, bgm[pos:pos + n], MUSIC["dB"], fade=0.004)
        pos += n
    # 끝 — 도장과 함께 홈쇼핑 곡이 돌아와 강도까지 광고 화면이 된다. 곡 자기 맺음(맨 끝 음)을 끝 컷에 맞춘다
    # 카드 크기(말 없이 −32 dB)로 두니 절규(−13) 뒤에 들리지 않아 8 dB 크게 — 말이 없는 끝이라 곡이 주인공이다(11-05 수치).
    # 이 곡 파일에는 맺는 끝이 없다(박 격자 실측 — 파일 끝이 다음 마디 첫 박, 그 앞 0.5초는 −30 dB 1 kHz 울림만) 그래서 곡 끝을 그대로 쓰니 연주 도중에 끊겼다(11-05 아르곤 두 번).
    # 곡에서 앞 대비 크게 착지하는 26.88초 박(121.8 BPM 격자)을 브랜드에 맞춰 거기서 연주를 멈추고, 그 한 방의 잔향으로 끝 컷 끝까지 맺는다
    landing = 26.88
    seg = bgm[int((landing - (BRAND_AT - STAMP_AT)) * RATE):int((landing + 0.30) * RATE)].copy()
    seg[-int(0.1 * RATE):] *= np.linspace(1, 0, int(0.1 * RATE))[:, None]
    wet = ring(bgm[int(landing * RATE):int((landing + 0.30) * RATE)], ENDT - BRAND_AT + 1.0, wet_db=-4)
    out = np.zeros((int((ENDT - STAMP_AT) * RATE), 2), np.float32)
    out[:len(seg)] = seg
    i = int((BRAND_AT - STAMP_AT) * RATE)
    k = min(len(out) - i, len(wet))
    out[i:i + k] += wet[:k]
    m.put(STAMP_AT, out, MUSIC["dB"] + 8, fade=0.004, fade_out=0.25)
    for t, name, db in HITS:
        m.put(t, load(os.path.join(SFX, name)), db)
    # 브랜드 한 방 — 모두의코스와 같은 알림음에 꼬리를 단다. 꼬리 없이 +6 dB로는 곡의 착지에 묻혀 「소리 한 방이 없다」로 들렸다(11-05 아르곤 세 번)
    d = load(os.path.join(SFX, "ding1.wav"))
    d = np.stack([d, d], axis=1) if d.ndim == 1 else d
    w = ring(d, 1.25, wet_db=-9)
    w[:len(d)] += d
    m.put(BRAND_AT + 0.04, w, 11)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=1.1)   # 스테레오 기준 원본 크기(−14.6 LUFS) 안팎 — 브랜드 알림음이 합 봉우리라 올린 만큼 한계기가 잡는다


# 화면 글 — 11-03 밤 유호님 「세 편에 넣기」: 흰 가운데 머리글 · 로고 덧씌우기를 버리고, 자막시안_20261103/remotion의 섞은 판(hs16 · hs9)이 굽는다
#   말자막(S42 상자, 핵심 낱말 레몬) · 강도 컷 둘의 큰 낱말(강도 뒤) · 끝 PULSE 종이 블록 · 9:16 머리글(원본 두 줄 · 67.21초에 블록으로)
#   화면.mp4를 다시 자르면 강도 컷 마스크(c02 · c23)를 자막시안 피사체따기_rembg.py hs로 다시 딴다
CAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103")
PUB = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/hs"


def stamp_png():
    # 끝 도장 — 카드 3 「특별 할인」 도장과 같은 글꼴 · 테(카드움직임_v4.py card3), 어두운 벽에서 읽히게 밝은 빨강.
    # 글은 「매진 감사합니다」 — 방송 자막의 그 말을 강도 앞에 찍어 다 털린 것이 곧 완판이 되게 한다. 「매진 임박」은 앞 절규와 이어지지 않아 사족처럼 읽혔다(11-05 아르곤)
    from PIL import Image, ImageDraw, ImageFont
    S = 2
    w, h = 800 * S, 372 * S
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    red = (255, 58, 58, 255)
    d.rounded_rectangle([7 * S, 7 * S, w - 7 * S, h - 7 * S], radius=14 * S, outline=red, width=14 * S)
    y = 34 * S
    for text, size in (("매진", 186), ("감사합니다", 122)):
        f = ImageFont.truetype(os.path.join(V, "fonts", "BlackHanSans-Regular.ttf"), size * S)
        l, tp, r, b = d.textbbox((0, 0), text, font=f)
        d.text(((w - (r - l)) / 2 - l, y - tp), text, font=f, fill=red)
        y += (b - tp) + 26 * S
    im.save(os.path.join(PUB, "stamp.png"))


def render():
    stamp_png()
    for src, dst in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav")):
        if not os.path.exists(os.path.join(PUB, dst)) or md5(src) != md5(os.path.join(PUB, dst)):
            shutil.copyfile(src, os.path.join(PUB, dst))
    a16, a9 = os.path.join(OUT, "매진임박_16x9.mp4"), os.path.join(OUT, "매진임박_9x16.mp4")
    for comp, out in (("hs16", a16), ("hs9", a9)):   # 렌더는 한 번에 하나(둘을 같이 돌리면 하나가 죽는다 — 현장노트)
        # 음량마감.mjs를 거치지 않는다 — 소리가 대부분 −45~−50 dB 정적이라 다시 담으면 AAC가 305k까지만 써 올림 기준(320k)에 못 미친다.
        # 소리.wav가 이미 −14.4 LUFS로 섞여 있고, Remotion이 384k(remotion.config.ts)로 바로 담으면 381k(11-04)
        subprocess.run([shutil.which("npx"), "remotion", "render", "src/index.ts", comp, out, "--concurrency=3", "--log=error"], check=True, cwd=os.path.join(CAP, "remotion"))
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
