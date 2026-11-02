# 2번 남성 향수 「솔서리」 최종 편집(2026-11-03, Claude) — 02_콘티 2절 18컷을 시각 그대로 하드컷으로 잇는다. AI 컷은 시댄스, 2 · 3 · 17 · 18은 블렌더 렌더(블렌더/굽기_영상.sh).
#   python -X utf8 최종편집.py   → git 밖 pulse-portfolio12-20261024/최종/p2/솔서리_16x9.mp4 · _폰.mp4 · _반초.jpg
# 6 · 9 · 10(p2-06 · 09 · 10)과 태준 끝 세 마디(p2-말-태준), 노래(최종/p2/노래.mp3)가 들어오면 저절로 쓴다 — 아직이면 6 · 9 · 10은 시작 그림을 세워 두고 소리 없이 간다. 후보정 없음(결정 10-24).
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "p2")
REN = os.path.join(ROOT, "콘티", "p2", "렌더", "영상")
GOT = os.path.join(ROOT, "콘티", "p2", "받음")
FAIR = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files"
ICE = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림/Alexander Kopeikin - 100 kHz Designed Ice"
SPRAY = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림/344 Audio - Barbershop Vol. 1/OBJMisc_Spray Bottle, Spray 1_344 Audio_Barbershop Vol 1.wav"
SUIT_M = os.path.join(C.REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-Medium.otf")
FPS, W, H = 24, 1920, 1080
T = [0, 2.08, 2.48, 3.20, 4.00, 4.96, 5.24, 5.72, 6.68, 7.40, 8.12, 8.96, 10.20, 10.72, 11.56, 12.32, 14.84, 15.84, 20.00]   # 컷 경계(02_콘티 2절)
END = T[-1]

# 컷 번호 → 판과 시작 초, 또는 블렌더 프레임 폴더, 또는 아직 없는 판의 임시 시작 그림
CUTS = {
    1: ("p2-01", 1.92),      # 4초 판의 끝 2.08초 — 빛줄기가 밝아지며 가장 크게 걸어 나오는 구간
    2: ("렌더", "s02"),
    3: ("렌더", "s03"),
    4: ("p2-04-05", 1.00),   # 샷1(2.12초에 컷) — 팔을 들며 손을 펴는 구간
    5: ("p2-04-05", 3.00),   # 샷2 — 팔 벌림 → 끝에 팔을 위로 휘두르며 다가옴
    6: ("p2-06", 0.20, "S06r_g5.png"),
    7: ("p2-07", 0.50),      # 고속 슬로 — 첫 0.2초는 물방울이 빠르니 그 뒤
    8: ("p2-08", 2.90),      # 물이 렌즈를 덮는 순간이 컷 0.58초에 오게(원본 6.3초)
    9: ("p2-09", 0.20, "S09r_g6.png"),
    10: ("p2-10", 0.20, "S10r_g5.png"),
    11: ("p2-11", 1.20),     # 첫 1초는 왼쪽이 하얗게 탄다 — 그 뒤
    12: ("p2-12b", 0.40),    # 12b — 라벨이 읽히고 뚜껑이 그대로인 앞 구간(2.5초 뒤 뚜껑이 분사구로 바뀐다), 얼굴 닮음 0.90
    13: ("p2-13", 1.00),
    14: ("p2-14-15", 0.60),  # 샷1(1.96초에 컷)
    15: ("p2-14-15", 2.30),  # 샷2
    16: ("p2-16", 0.10),     # 고개 돌림이 컷 약 1초에(원본 13.4초)
    17: ("렌더", "s17"),
    18: ("렌더", "s18"),
}
NARR = "p2-말-태준"   # 「차갑게.」 · 「서리 앉은 솔잎의 향.」 · 「솔서리.」 — 원본 자리 16.0 · 16.9 · 18.9
NARR_AT = (16.0, 16.9, 18.9)
SONG = os.path.join(ROOT, "최종", "음악", "p2_Cold_B.wav")   # Suno 「Cold」(4922fbe5, 11-03)
SONG_IN = 35.12    # 후렴 첫 박(곡 40.12초)이 화면 5.00초 첫 강세에 오고, 「Cold, burning white…」(곡 49.98)가 14.86초 마지막 높은 음 자리에 온다
VOCAL_IN = 3.70    # 그 앞은 반주만(원본 3.7초에 보컬 시작) — 뗀 목소리를 빼서 만든다


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n, spec in CUTS.items():
        k = round(T[n] * FPS) - round(T[n - 1] * FPS)
        out = os.path.join(d, f"{n:02d}.mp4")
        if spec[0] == "렌더":
            src = os.path.join(REN, spec[1], "%04d.png")
            have = len([f for f in os.listdir(os.path.join(REN, spec[1])) if f.endswith(".png")])
            assert have == k, f"#{n} 렌더 {have}장 · 컷 {k}장"
            C.run("ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-start_number", "0", "-i", src, "-vf", f"scale={W}:{H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p", "-frames:v", str(k),
                  "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)
            print(f"#{n} 블렌더 {spec[1]} {k}장")
        elif os.path.exists(C.clip(spec[0])):
            src = C.clip(spec[0])
            a = round(spec[1] * FPS)
            have = C.frames_of(src)
            if a + k > have:
                a = max(0, have - k)
            C.cut_video(src, a, k, W, H, FPS, out)
            print(f"#{n} {spec[0]} {a / FPS:.2f}초부터 {k}장")
        else:   # 아직 안 받은 판 — 시작 그림을 임시로 세운다
            C.run("ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", str(FPS), "-i", os.path.join(GOT, spec[2]), "-vf", f"scale={W}:{H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p",
                  "-frames:v", str(k), "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)
            print(f"#{n} 임시 시작 그림 {spec[2]} {k}장")
        paths.append(out)
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))


def song():
    # 쓰는 구간만 잘라 Demucs로 목소리를 떼고, 3.7초 전에서는 목소리를 뺀 반주로 — 그 뒤는 곡 그대로
    import tempfile
    a = C.load_stereo(SONG)[int(SONG_IN * C.RATE):int((SONG_IN + 17.0) * C.RATE)]
    cache = os.path.join(OUT, "소리", "노래구간_목소리.wav")
    if not os.path.exists(cache):
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        tmp = tempfile.mkdtemp(prefix="노래_")
        wav = os.path.join(tmp, "소리.wav")
        C.run("ffmpeg", "-y", "-v", "error", "-ss", str(SONG_IN), "-t", "17", "-i", SONG, "-ar", "44100", "-ac", "2", wav)
        import shutil
        import subprocess
        subprocess.run([os.path.join(C.DEMUCS, "venv", "Scripts", "python.exe"), "-X", "utf8", os.path.join(C.DEMUCS, "목소리떼기.py"), tmp, wav], check=True, capture_output=True)
        shutil.copy2(os.path.join(tmp, "소리_목소리.wav"), cache)
    v = C.load_stereo(cache)
    n = min(len(a), len(v))
    a, v = a[:n], v[:n]
    k = np.ones(n, np.float32)
    x0 = int((VOCAL_IN - 0.06) * C.RATE)
    x1 = int((VOCAL_IN + 0.06) * C.RATE)
    k[:x0] = 0
    k[x0:x1] = np.linspace(0, 1, x1 - x0)
    return (a - v) + v * k[:, None]


def phrases(x):
    # 말 덩어리 셋을 찾는다 — 0.25초 넘는 빈틈으로 가른다
    n = 480
    e = np.array([np.sqrt(np.mean(x[i:i + n] ** 2) + 1e-12) for i in range(0, len(x) - n, n)])
    on = 20 * np.log10(e) > -40
    segs, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and (on[j] or on[j:j + 25].any()):
                j += 1
            if j - i > 12:
                segs.append((i * n, j * n))
            i = j
        else:
            i += 1
    return segs


def sound():
    m = C.Mix(END + 0.5)
    s = song()
    # 노래는 15.8초부터 빠르게 빠져 16.2초에 사라진다(콘티 3절)
    fade = np.ones(int(END * C.RATE), np.float32)
    x0, x1 = int(15.8 * C.RATE), int(16.2 * C.RATE)
    fade[x0:x1] = np.linspace(1, 0, x1 - x0)
    fade[x1:] = 0
    m.put(0, s[:x1] * fade[:x1, None], -2, fade=0.002)
    if os.path.exists(C.clip(NARR)):
        x = C.load(C.voice_only(NARR, os.path.join(OUT, "소리")))
        segs = phrases(x)
        print("내레이션 덩어리", [(round(a / C.RATE, 2), round(b / C.RATE, 2)) for a, b in segs])
        if len(segs) == 3:
            for (a, b), t in zip(segs, NARR_AT):
                m.put(t, x[a:b], 0)
        else:   # 셋으로 안 갈리면 첫 자리에서 통째로
            m.put(NARR_AT[0], x[segs[0][0]:segs[-1][1]], 0)
    # 효과음 — 얼음 · 물 · 칙 · 어는 소리(콘티 3절)
    def ice(name, t, db, dur=None):
        y = C.load(os.path.join(ICE, name))
        m.put(t, y[:int(dur * C.RATE)] if dur else y, db, fade_out=0.08)

    def fair(name, t, db, dur=None, start=0.0):
        y = C.load(os.path.join(FAIR, name))[int(start * C.RATE):]
        m.put(t, y[:int(dur * C.RATE)] if dur else y, db, fade_out=0.1)

    ice("ice, crack, ice block snapping-001.wav", 2.08, -18, 0.5)
    fair("Water Pouring and Spilling.M.wav", 5.24, -12, 0.5)
    fair("Water Splashing 1.M.wav", 5.72, -12, 0.96)
    fair("Water Movement Light Splashes.M.wav", 6.68, -14, 0.72)
    ice("ice, crack, ice block snapping-001.wav", 7.40, -6, 0.72)
    ice("ice, surface cracking, fissure, fast, hard-003.wav", 8.12, -8, 0.84)
    y = C.load(SPRAY)
    m.put(9.88, y[:int(0.9 * C.RATE)], -6, fade_out=0.25)
    ice("ice, movement, ice drift, ice field cracking up, initial, wide-001.wav", 15.84, -16, 1.4)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=0)


def render():
    t = os.path.join(OUT, "_글")
    os.makedirs(t, exist_ok=True)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(SUIT_M, 22)
    s = "가상 브랜드 · AI로 만든 가상 모델 · 음성"
    d.text((W - d.textlength(s, font=f) - 40, H - 50), s, font=f, fill=(255, 255, 255, 130))
    p = os.path.join(t, "고지.png")
    im.save(p)
    out = os.path.join(OUT, "솔서리_16x9.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(OUT, "화면.mp4"), "-i", os.path.join(OUT, "소리.wav"), "-i", p, "-filter_complex", "[0:v][2:v]overlay=0:0:enable='gte(t,17.5)',format=yuv420p[v]", "-map", "[v]", "-map", "1:a",
          "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out)
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, "솔서리_16x9_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=4,scale=240:-2,tile=12x7:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()
