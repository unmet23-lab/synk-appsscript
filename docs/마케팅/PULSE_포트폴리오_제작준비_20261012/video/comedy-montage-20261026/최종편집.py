# 12번 B급 코미디 몽타주 「모두의코스」 최종 편집(2026-11-03, Claude) — 02_콘티 3절 17컷을 시각 그대로 하드컷으로 잇고, 고정 자막 · 끝 글 두 장 · 음악 · 장소마다 현장음을 놓는다.
#   python -X utf8 최종편집.py   → git 밖 pulse-portfolio12-20261024/최종/p12/모두의코스_9x16.mp4 · _폰.mp4 · _반초.jpg
# 말 · 입 맞춤 없음(콘티 1절). 음악(최종/음악/p12_*.mp3)이 없으면 현장음만으로 간다. 후보정 없음(결정 10-24).
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "p12")
CARD = os.path.join(ROOT, "콘티", "p12", "합성")
FAIR = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files"
SON = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림"
SONG = os.path.join(ROOT, "최종", "음악", "p12_Hazy_A.mp3")   # Suno 「Hazy Summer Afternoon」(72b802a8, 11-03 — 피아노 아르페지오 + 따뜻한 패드, 드럼 없음, 콘티 1절 「소리」)
SONG_IN = 3.70   # 곡 27.5초 루프가 크게 올라오는 자리(저역 +26 dB)가 9번 해변에 그가 보이는 23.8초에 온다 — 그 앞 곡 22~27초 가라앉음은 ATV 엔진 밑, 곡 34.3초 올라옴은 속사포 15(30.6초)
SUIT = os.path.join(C.REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-SemiBold.otf")
SUIT_M = os.path.join(C.REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-Medium.otf")
FPS, W, H = 24, 1080, 1920
T = [0, 1.87, 3.87, 7.20, 11.73, 15.10, 18.30, 21.77, 22.87, 27.07, 27.77, 28.47, 29.17, 29.87, 30.57, 31.27, 35.14, 37.64]   # 컷 경계(02_콘티 3절)
END = T[-1]
LOOK = T[16]   # 1~16컷 고정 자막, 17은 끝 글

# 컷 번호 → (판, 그 판에서 시작하는 초). 17은 끝 글 두 장(합성/끝글_1.png → 끝글.png)
CUTS = {
    1: ("p12-01", 0.00),     # 0초부터 이쪽을 보다 1.2초쯤 앞으로
    2: ("p12-02", 1.40),     # 첫 판 — 창밖으로 휙 돌았다가 그에게 도착하는 끝 구간(둘째 판은 내내 그에게 머물러 도착이 없음)
    3: ("p12-03", 0.40),     # 팬에 밀려 컷 2.7초쯤 왼쪽으로 나감
    4: ("p12-04", 1.00),     # 줄무늬 바닥 → 위로 → 벤치의 그와 일행(0.6초 앞은 동행 뒤통수가 화면을 덮음)
    5: ("p12-05", 0.30),     # 접시 → 컷 0.7초 눈을 들어 3초 가까이 봄
    6: ("p12-06", 0.90),     # 일행 손이 가리킴 → 억새로 휘두름 → 돌탑 옆 그
    7: ("p12-07-08", 1.03),  # 샷1 끝까지(4.50초에 컷) — 올라타 앉고 넥게이터를 매만짐
    8: ("p12-07-08", 4.50),  # 샷2 — 넥게이터를 내려 얼굴을 드러냄
    9: ("p12-09", 1.50),     # 아이와 놀다 컷 0.5초부터 정색해 이쪽, 끝에 왼쪽으로 흐름
    10: ("p12-10", 0.80),    # 속사포 — 다가가는 판에서 뒤 컷일수록 가까운 자리(콘티 3-2)
    11: ("p12-11", 0.80),
    12: ("p12-12", 2.60),
    13: ("p12-13", 0.00),
    14: ("p12-14", 1.60),
    15: ("p12-15", 3.00),
    16: ("p12-16", 0.15),    # 여행자 폰 → 맞은편 테이블 → 1.68초 한 번에 당김 → 같은 화면의 폰
}
LINE = ("제주 2박 3일,", "가는 데마다 또 그 사람")


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n in range(1, 17):
        pid, t = CUTS[n]
        k = round(T[n] * FPS) - round(T[n - 1] * FPS)
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
    # 17 — 끝 글 두 장(이유 1.2초 → 브랜드 1.3초)
    for i, (png, sec) in enumerate((("끝글_1.png", 1.20), ("끝글.png", round(END - T[16] - 1.20, 2)))):
        out = os.path.join(d, f"17{'ab'[i]}.mp4")
        k = round((T[16] + 1.20 if i == 0 else END) * FPS) - round((T[16] if i == 0 else T[16] + 1.20) * FPS)
        C.run("ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", os.path.join(CARD, png), "-frames:v", str(k), "-vf", f"scale={W}:{H},format=yuv420p", "-c:v", "libx264", "-crf", "12",
              "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)
        paths.append(out)
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))


def caption_png(path):
    # 원본 자리 · 크기 그대로 — 흰 글자 + 얇은 검은 테, 화면 높이 72~84%
    f = ImageFont.truetype(SUIT, 62)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, s in enumerate(LINE):
        d.text(((W - d.textlength(s, font=f)) / 2, 1418 + i * 80), s, font=f, fill=(255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0))
    im.save(path)


def notice_png(path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(SUIT_M, 24)
    s = "가상 브랜드 · AI로 만든 가상 모델"
    d.text(((W - d.textlength(s, font=f)) / 2, H - 70), s, font=f, fill=(255, 255, 255, 170), stroke_width=2, stroke_fill=(0, 0, 0, 120))
    im.save(path)


def amb(path, start, seconds):
    x = C.load_stereo(path)
    a = int(start * C.RATE)
    return x[a:a + int(seconds * C.RATE)]


def sound():
    m = C.Mix(END + 0.3)
    have_song = os.path.exists(SONG)
    if have_song:
        song = C.load_stereo(SONG)[int(SONG_IN * C.RATE):]
        m.put(0, song[:int((T[16] + 0.05) * C.RATE)], -6, fade_out=0.05)   # 16 끝 휙에서 뚝 — 끝 글은 아래 꼬리로 닫는다
        tail = song[int(T[16] * C.RATE):int((END + 0.2) * C.RATE)]
        m.put(T[16], tail, -9, fade_out=1.6)
    # 장소마다 현장음 — 컷 경계에서 끊김(하드컷), 음악 밑에 깐다
    bed = -22 if have_song else -16
    places = [
        (1, os.path.join(SON, "Epic Stock Media - Public Spaces - Basic Transportation Sounds", "AEROInt_Airplane Interior Small Plane Cruise Altitude Calm Flight 01_ESM_CPS.wav"), 10, 0),
        (2, os.path.join(FAIR, "Magnolia Night Traffic Car Bus B.wav"), 5, 0),
        (3, os.path.join(FAIR, "Pool Pump Motor Runs, Churning Constant.wav"), 2, -6),
        (4, os.path.join(SON, "Epic Stock Media - Public Spaces - Basic Transportation Sounds", "BOATMotr_Diesel Engine Boat Idle Steady Rpm Hum Motor Mic One 01_ESM_CPS.wav"), 4, -2),
        (5, os.path.join(FAIR, "Coffee Shop Ambience 1.wav"), 6, -2),
        (6, os.path.join(SON, "Just Sound Effects - Highlands of Norway", "AMBSwmp_Meadow Pipits calling many Insects humming Wind blowing through Grass_JSE_HoN_Stereo.wav"), 12, 0),
        (9, os.path.join(FAIR, "Ocean Waves Day From Balcony.wav"), 8, 0),
        (10, os.path.join(SON, "Just Sound Effects - Rocky Coast of Norway", "WATRWave_Medium Waves at Pebble Beach_JSE_RCoN_Stereo.wav"), 3, 0),
        (12, os.path.join(FAIR, "Grass Moving With The Win.M.wav"), 1, 0),
        (13, os.path.join(SON, "Sonik Sound Library - Spanish Crowds", "CRWDWalla_Crowd, Walla, Movement, 30 People Working Film Crew, Preparing a Movie Set in a Warehouse, Spanish Hum of Voice, Decor Mount, Ladders, Warning Alarm, Light Contruction-Stereo_KSL_KS015.wav"), 20, -4),
        (14, os.path.join(FAIR, "Coffee Shop Ambience 2.wav"), 4, 0),
        (15, os.path.join(SON, "Sonic Bat - Bars & Restaurants Ambience", "SBbra_Shopping Mall Food Court B 001.wav"), 40, 2),
        (16, os.path.join(SON, "Sonik Sound Library - Spanish Wallas", "CRWDWalla_Dinner Party Crowd in Terrace, Walla, Toast with Pomada, Mixed Group of Adults, Men and Women, Spanish, Catalan Language, Menorcan Language-Atmos_KSL_KS014.wav"), 15, 0),
    ]
    for n, path, start, db in places:
        m.put(T[n - 1], amb(path, start, T[n] - T[n - 1]), bed + db, fade=0.004)
    # 7~8 ATV 엔진은 음악을 거의 덮을 만큼 크게 → 9 해변으로 넘어가는 순간 뚝 끊기고 파도만(콘티 1절)
    eng = C.load_stereo(os.path.join(SON, "SoundBits - Motorcycles - Honda", "VEHSkid_Honda CB500F Engine Start Tires Skidding Stop 02_SNDBTS_MCH.wav"))
    m.put(T[6], eng[int(0.2 * C.RATE):int((0.2 + T[8] - T[6]) * C.RATE)], -1 if have_song else -10, fade=0.003)
    # 속사포 조각 소리 — 자전거 바퀴 · 숯불
    m.put(T[10], amb(os.path.join(FAIR, "Bike By 1.M.wav"), 0.3, 0.7), bed + 4, fade=0.003)
    m.put(T[14], amb(os.path.join(SON, "Ivo Vicic - Campfire - Bonfire FX", "24 Campfire, Dropping Fresh Pine Branches in Fire, Crackling, Sizzling Strong, Close 02.wav"), 20, 0.7), bed + 4, fade=0.003)
    m.put(T[15], amb(os.path.join(SON, "Ivo Vicic - Campfire - Bonfire FX", "24 Campfire, Dropping Fresh Pine Branches in Fire, Crackling, Sizzling Strong, Close 02.wav"), 40, T[16] - T[15]), bed - 2, fade=0.004)
    # 16 끝 휙
    m.put(T[16] - 0.12, C.load(os.path.join(FAIR, "Low Whoosh x2.wav"))[:int(0.5 * C.RATE)], -10, fade_out=0.15)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=-3.0)


def render():
    t = os.path.join(OUT, "_글")
    os.makedirs(t, exist_ok=True)
    cap, note = os.path.join(t, "자막.png"), os.path.join(t, "고지.png")
    caption_png(cap)
    notice_png(note)
    out = os.path.join(OUT, "모두의코스_9x16.mp4")
    chain = f"[0:v][2:v]overlay=0:0:enable='lt(t,{LOOK})'[v1];[v1][3:v]overlay=0:0:enable='lt(t,{LOOK})',format=yuv420p[v]"
    C.run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(OUT, "화면.mp4"), "-i", os.path.join(OUT, "소리.wav"), "-i", cap, "-i", note, "-filter_complex", chain, "-map", "[v]", "-map", "1:a",
          "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "256k",
          "-shortest", "-movflags", "+faststart", out)
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, "모두의코스_9x16_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=15x5:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()
