# 12번 B급 코미디 몽타주 「모두의코스」 최종 편집(2026-11-03, Claude) — 02_콘티 3절 17컷을 시각 그대로 하드컷으로 잇고, 음악 · 장소마다 현장음을 놓고, 화면 글은 Remotion 섞은 판(p12)으로 굽는다.
#   python -X utf8 최종편집.py   → git 밖 pulse-portfolio12-20261024/최종/p12/모두의코스_9x16.mp4 · _폰.mp4 · _반초.jpg
# 말 · 입 맞춤 없음(콘티 1절). 음악(최종/음악/p12_*.mp3)이 없으면 현장음만으로 간다. 후보정 없음(결정 10-24).
import os
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C
import 폰다시얹기 as 폰

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "p12")
FAIR = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files"
SON = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림"
SFX = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx"
DING = os.path.join(SFX, "ding1.wav")
IMPACT = os.path.join(SON, "Cinematic Sound Design - Ultra Transitions & Impacts", "Impact Hit Rapid Chord Reverb.wav")
IMPACT_PEAK = 0.86   # 이 파일은 짧게 차오르다 0.86초에 터진다
SONG = os.path.join(ROOT, "최종", "음악", "p12_Hazy_A.mp3")   # Suno 「Hazy Summer Afternoon」(72b802a8, 11-03 — 피아노 아르페지오 + 따뜻한 패드, 드럼 없음, 콘티 1절 「소리」)
SONG_IN = 3.70   # 곡 27.5초 루프가 크게 올라오는 자리(저역 +26 dB)가 9번 해변에 그가 보이는 23.8초에 온다 — 그 앞 곡 22~27초 가라앉음은 ATV 엔진 밑, 곡 34.3초 올라옴은 속사포 15(30.6초)
CAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103")   # Remotion 섞은 판(p12)
PUB = os.path.join(ROOT, "최종", "자막시안_public", "p12")
FPS, W, H = 24, 1080, 1920
T = [0, 1.87, 3.87, 7.20, 11.73, 15.10, 18.30, 21.77, 22.87, 27.07, 27.77, 28.47, 29.17, 29.87, 30.57, 31.27, 35.14, 38.71]   # 컷 경계(02_콘티 3절) — 17은 식당 전체 와이드(02_콘티 7절, 11-05 유호님 「시안으로 바꿔」): 끝 글이 다 선 뒤 1.6초 읽게
END = T[-1]
ZOOM = (round(T[15] * FPS) + 폰.ZOOM_AT) / FPS   # 16컷 안 — 폰 디지털 줌으로 그 사람이 폰을 든 판이 뜨는 프레임(33.08초). 폭로의 한 방이 여기다
BLOCK_AT = ZOOM + 0.5   # 먼저 그 사람과 두 폰을 보고 「같은 코스」는 그다음(P12.tsx와 같은 값)
COUNT_AT = T[16] + 0.55   # 와이드로 넘어가 손님들을 먼저 본 뒤 숫자가 오른다(P12.tsx와 같은 값)
BRAND_AT = COUNT_AT + 0.85   # 숫자가 다 오르면 딩에 브랜드(P12.tsx와 같은 값)

# 컷 번호 → (판, 그 판에서 시작하는 초)
CUTS = {
    1: ("p12-01", 0.00),     # 0초부터 이쪽을 보다 1.2초쯤 앞으로
    2: ("p12-02", 1.40),     # 첫 판 — 창밖으로 휙 돌았다가 그에게 도착하는 끝 구간(둘째 판은 내내 그에게 머물러 도착이 없음)
    3: ("p12-03", 0.40),     # 팬에 밀려 컷 2.7초쯤 왼쪽으로 나감
    4: ("p12-04", 1.00),     # 줄무늬 바닥 → 위로 → 벤치의 그와 일행(0.6초 앞은 동행 뒤통수가 화면을 덮음)
    5: ("p12-05", 0.30),     # 접시 → 컷 0.7초 눈을 들어 3초 가까이 봄
    6: ("p12-06", 1.30),     # 일행 손이 가리킴 → 억새로 휘두름 → 돌탑 옆 그를 지나침(판 1.2초 앞은 그가 미리 앉아 있어 공개가 샘 — Fable 11-03 P1)
    7: ("p12-07-08", 1.03),  # 샷1 끝까지(4.50초에 컷) — 올라타 앉고 넥게이터를 매만짐
    8: ("p12-07-08", 4.50),  # 샷2 — 넥게이터를 내려 얼굴을 드러냄
    9: ("p12-09", 1.84),     # 이쪽을 노려보다 끝 0.3초 왼쪽으로 흘러 빈 해변(판 끝까지 — Fable P1)
    10: ("p12-10", 0.80),    # 속사포 — 다가가는 판에서 뒤 컷일수록 가까운 자리(콘티 3-2)
    11: ("p12-11", 0.80),
    12: ("p12-12", 3.34),    # 판 끝 — 2.6초는 11보다 멀어 순서가 거꾸로였다(Fable P1)
    13: ("p12-13", 0.00),    # 단체가 보이는 채로 가장 덜 다가감
    14: ("p12-14", 1.00),    # 15보다 크지 않게
    15: ("p12-15", 3.34),
    16: ("p12-16", 0.00),    # 여행자 폰을 판 첫머리부터(또렷한 시간 0.2 → 0.35초) → 맞은편 테이블 → 1.83초 당김 → 같은 화면의 폰
    17: ("p12-17", 0.00),    # 식당 전체가 같은 앱 화면을 든 와이드(드리미나 첫 프레임 · 02_콘티 7절)
}


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n in range(1, 18):
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
    # 16은 앱 화면을 다시 얹고 잔 상표를 지운 판으로(폰다시얹기.py). 17은 판 그대로 — 예전엔 16 끝 17장을 이어 돌린 멈춤이었다(11-04 · 크몽 세션 Fable 「정지 한 장 + 글자 세 겹」)
    폰.main()
    paths[15] = 폰.OUT
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))


def amb(path, start, seconds):
    x = C.load_stereo(path)
    a = int(start * C.RATE)
    return x[a:a + int(seconds * C.RATE)]


def lowpass(x, hz, order=2):
    # 위상이 안 밀리는 저역 통과 — 짧은 조각 하나에만 쓴다
    f = np.fft.rfftfreq(len(x), 1 / C.RATE)
    g = 1 / np.sqrt(1 + (f / hz) ** (2 * order))
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c]) * g, len(x)) for c in range(x.shape[1])], axis=1).astype(np.float32)


def duck(x, t0, t1, db, ramp=0.25):
    # 곡을 t0~t1 동안 db만큼 내린다(양 끝은 ramp초 동안 서서히)
    t = np.arange(len(x)) / C.RATE
    k = np.clip((t - t0) / 0.03, 0, 1) * (1 - np.clip((t - t1) / ramp, 0, 1))
    return x * (10 ** (db * k / 20))[:, None].astype(np.float32)


def ring(x, seconds=1.25, wet_db=-9):
    # 짧은 알림음에 꼬리를 단다 — 지수로 줄어드는 잡음과 합성곱(끝 판 뒤로 맺히는 잔향)
    n = int(seconds * C.RATE)
    rng = np.random.default_rng(12)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / C.RATE / (seconds / 6.9))   # 그 시간에 −60 dB
    wet = np.fft.irfft(np.fft.rfft(x, n + len(x)) * np.fft.rfft(ir, n + len(x)), n + len(x)).astype(np.float32)
    wet *= (np.max(np.abs(x)) / (np.max(np.abs(wet)) or 1)) * (10 ** (wet_db / 20))
    wet[:len(x)] += x
    return wet


def pitched(x, k):
    return np.interp(np.arange(0, len(x), k), np.arange(len(x)), x).astype(np.float32)


def sound():
    m = C.Mix(END + 0.3)
    have_song = os.path.exists(SONG)
    if have_song:
        full = C.load_stereo(SONG)
        song = full[int(SONG_IN * C.RATE):]
        # 엔진이 뚝 끊긴 뒤 파도만 남게 곡을 잠깐 내린다(9컷 — 곡이 파도를 덮어 고역이 없었다, 크몽 세션 아르곤 · 수치 11-04)
        song = duck(song, T[8], T[8] + 1.0, -7, ramp=0.9)
        # 폭로에서 곡을 뚝 끊는다 — 한 방 뒤 그 사람과 눈 맞은 어색한 2초는 숯불 · 말소리만(크몽 세션 11-04 「소리 한 방이 약함」 · 예전엔 곡이 그대로 흘러 1~2 dB만 올랐다)
        m.put(0, song[:int(ZOOM * C.RATE)], -6, fade_out=0.015)
        # 끝은 곡 자기 맺음(맨 끝 음이 잦아드는 자리)을 끝 판에 맞춘다 — 곡 중간 토막을 페이드로 자르자 마지막 0.1초에 −20 dB에서 끊겼다
        outro = full[-int((END - T[16]) * C.RATE) - 1:]
        m.put(T[16], outro, -5.5, fade_out=1.5)   # 숫자 틱 · 딩이 들릴 자리 — −2.5면 곡에 묻혀 「효과음이 없다」로 들렸다(11-05 크몽 세션 아르곤)
    # 장소마다 현장음 — 컷 경계에서 끊김(하드컷), 음악 밑에 깐다
    bed = -22 if have_song else -16
    places = [
        (1, os.path.join(SON, "Epic Stock Media - Public Spaces - Basic Transportation Sounds", "AEROInt_Airplane Interior Small Plane Cruise Altitude Calm Flight 01_ESM_CPS.wav"), 10, 0),
        (2, os.path.join(FAIR, "Magnolia Night Traffic Car Bus B.wav"), 5, 0),
        (3, os.path.join(FAIR, "Pool Pump Motor Runs, Churning Constant.wav"), 2, -6),
        (4, os.path.join(SON, "Epic Stock Media - Public Spaces - Basic Transportation Sounds", "BOATMotr_Diesel Engine Boat Idle Steady Rpm Hum Motor Mic One 01_ESM_CPS.wav"), 4, -2),
        (5, os.path.join(FAIR, "Coffee Shop Ambience 1.wav"), 6, 2),
        (6, os.path.join(SON, "Just Sound Effects - Highlands of Norway", "AMBSwmp_Meadow Pipits calling many Insects humming Wind blowing through Grass_JSE_HoN_Stereo.wav"), 12, 0),
        (9, os.path.join(FAIR, "Ocean Waves Day From Balcony.wav"), 8, 18),   # 파일이 작다 — 엔진이 뚝 끊긴 곡의 빈자리(23~23.7초)에 파도가 들리는 크기
        (10, os.path.join(SON, "Just Sound Effects - Rocky Coast of Norway", "WATRWave_Medium Waves at Pebble Beach_JSE_RCoN_Stereo.wav"), 3, 0),
        (12, os.path.join(FAIR, "Grass Moving With The Win.M.wav"), 1, 0),
        (13, os.path.join(SON, "Sonik Sound Library - Spanish Crowds", "CRWDWalla_Crowd, Walla, Movement, 30 People Working Film Crew, Preparing a Movie Set in a Warehouse, Spanish Hum of Voice, Decor Mount, Ladders, Warning Alarm, Light Contruction-Stereo_KSL_KS015.wav"), 20, -4),
        (14, os.path.join(FAIR, "Coffee Shop Ambience 2.wav"), 4, 0),
        (15, os.path.join(SON, "Sonic Bat - Bars & Restaurants Ambience", "SBbra_Shopping Mall Food Court B 001.wav"), 40, 2),
    ]
    for n, path, start, db in places:
        m.put(T[n - 1], amb(path, start, T[n] - T[n - 1]), bed + db, fade=0.004)
    # 7~8 ATV 엔진은 음악을 거의 덮을 만큼 크게 → 9 해변으로 넘어가는 순간 뚝 끊기고 파도만(콘티 1절)
    eng = C.load_stereo(os.path.join(SON, "SoundBits - Motorcycles - Honda", "VEHSkid_Honda CB500F Engine Start Tires Skidding Stop 02_SNDBTS_MCH.wav"))
    # 고역이 앞뒤보다 27~30 dB 높아 거칠게 튀었다(11-04) → 2.2 kHz 위를 깎고 6 dB 내린다. 낮은 울림은 그대로라 「음악을 덮을 만큼 크게」는 남는다
    m.put(T[6], lowpass(eng[int(0.2 * C.RATE):int((0.2 + T[8] - T[6]) * C.RATE)], 2200), -7 if have_song else -14, fade=0.003)
    # 속사포 조각 소리 — 컷 머리마다 한 조각(파도 · 자전거 바퀴 · 바람 · 셔터 · 잔 · 숯불, 콘티 1절). 처음엔 10 · 12 · 13 · 14가 빠져 박이 없었고(Fable P2),
    # bed 기준 이득으로 넣자 파일 자체가 작은 조각이 묻혔다(재확인 P2) → 조각마다 봉우리를 합의 봉우리에 견줘 맞춘다(아래 hits)
    camp = os.path.join(SON, "Ivo Vicic - Campfire - Bonfire FX", "24 Campfire, Dropping Fresh Pine Branches in Fire, Crackling, Sizzling Strong, Close 02.wav")
    hits = [
        (T[9], amb(os.path.join(SON, "Just Sound Effects - Rocky Coast of Norway", "WATRWave_Medium Waves at Pebble Beach_JSE_RCoN_Stereo.wav"), 9.0, 0.3), 0.12),
        (T[10], amb(os.path.join(FAIR, "Bike By 1.M.wav"), 0.3, 0.7), 0.2),
        (T[11], amb(os.path.join(FAIR, "Grass Moving With The Win.M.wav"), 3.0, 0.3), 0.12),
        (T[12], C.load(os.path.join(FAIR, "Pen Clicks.M.wav"))[:int(0.12 * C.RATE)], 0.03),
        (T[13], C.load(os.path.join(FAIR, "Glass Clink Toast.M.wav"))[:int(0.4 * C.RATE)], 0.15),
        (T[14], amb(camp, 20, 0.7), 0.2),
    ]
    # 16 — 폭로 전엔 곡 밑에 깔리고, 폭로 뒤 2초는 곡이 없어 그대로면 −41 dB로 소리가 끊긴 것처럼 들린다 → 13 dB 올린다(어색한 정적이되 숯불 · 말소리는 들리게). 멈춤과 함께 뚝
    walla = os.path.join(SON, "Sonik Sound Library - Spanish Wallas", "CRWDWalla_Dinner Party Crowd in Terrace, Walla, Toast with Pomada, Mixed Group of Adults, Men and Women, Spanish, Catalan Language, Menorcan Language-Atmos_KSL_KS014.wav")
    for path, start, db in ((walla, 15, bed), (camp, 40, bed + 8)):
        m.put(T[15], amb(path, start, ZOOM - T[15]), db, fade=0.004)
    # 폭로 뒤 2초는 불판 소리만 — 웅성을 같이 올리니 「야하…」 「음~」처럼 뭉개진 말로 들렸다(11-05 크몽 세션 아르곤 두 판 연속, 받아쓰기에 뜻 있는 말 없음).
    # 지글거리는 18초 자리(파일 RMS −38 dB · 무게중심 4 kHz, 40초 자리는 −44 dB에 낮은 소리라 빼면 거의 무음이었다). 끝 컷도 같은 식당이라 곡 밑으로 이어 간다
    sizzle = amb(camp, 18, END - ZOOM)
    # 숯 튀는 소리가 앞뒤보다 30 dB 높아(34.9초 RMS −30에 봉우리 +1 dBFS) 마감의 한계기를 뚫었다 → 봉우리만 부드럽게 눌러(RMS의 3.5배, 약 11 dB) 지글거림은 고르게 둔다
    th = 3.5 * float(np.sqrt(np.mean(sizzle ** 2)))
    sizzle = lowpass(th * np.tanh(sizzle / th), 7500)   # 8 kHz 위를 깎아 고기 굽는 소리로 — 그대로면 화이트 노이즈처럼 치직거린다(11-05 아르곤)
    st = np.arange(len(sizzle)) / C.RATE + ZOOM
    sizzle = sizzle * (10 ** (np.interp(st, [ZOOM, T[16] - 0.08, T[16] + 0.25, END - 1.2, END], [7, 7, -3, -3, -30]) / 20))[:, None].astype(np.float32)
    m.put(ZOOM, sizzle, 0, fade=0.004)
    # 16 끝 휙
    m.put(T[16] - 0.12, C.load(os.path.join(FAIR, "Low Whoosh x2.wav"))[:int(0.5 * C.RATE)], 3, fade_out=0.15)   # 파일 자체가 작아(RMS −27) −10이면 곡 꼬리에 묻혔다(Fable P2)
    # 브랜드 카드에 앱 알림 같은 한 방 — 처음엔 끝 글이 잦아들기만 해 소리 사건이 없었다(Fable P2, 재확인에서 −10은 겨우 보여 −4)
    # 속사포 조각은 합 봉우리의 20%(−14 dB)에 봉우리를 맞춘다 — 마감의 정규화 · +1 dB 뒤 −7 dBFS 안팎(40%는 한계기 천장 −1까지 갔다)
    pk = float(np.max(np.abs(m.a)))
    # 브랜드에 앱 알림 같은 한 방 — pk를 잰 뒤에 넣는다. 앞뒤보다 4 dB뿐이라 약했다(11-05 수치). 꼬리를 달아 끝 판 뒤로 맺힌다(11-04 — 곡 토막이 끝에서 끊긴다는 지적)
    m.put(BRAND_AT, ring(C.load(DING)), 0)
    for t, x, fo in hits:
        m.put(t, x * (0.2 * pk / (float(np.max(np.abs(x))) or 1.0)), 0, fade=0.002, fade_out=fo)
    # 폭로 한 방 — 코드 임팩트(차오름 뒤 0.86초에 터짐)에 붐으로 무게, 툭으로 앞머리를 세운다(폰 스피커엔 붐이 안 들려 임팩트 · 툭이 몫을 한다)
    imp = C.load(IMPACT)
    m.put(ZOOM - IMPACT_PEAK, imp * (0.85 * pk / float(np.max(np.abs(imp)))), 0, fade=0.002, fade_out=0.6)
    for name, k in (("boom.wav", 0.8), ("thud.wav", 0.45)):
        x = C.load(os.path.join(SFX, name))
        m.put(ZOOM, x * (k * pk / float(np.max(np.abs(x)))), 0, fade=0.001, fade_out=0.3)
    # 「같은 코스」가 뜰 때 짧게 한 번(글자마다 넣으니 「드르륵」 탁하게 들렸다, 11-04 아르곤), 숫자가 12,480까지 오르는 동안 음이 오르는 틱(P12.tsx COUNT_FROM ~ COUNT_TO) — 마지막은 더 세게
    x = C.load(os.path.join(SFX, "snap.wav"))
    m.put(BLOCK_AT, x * (0.14 * pk / float(np.max(np.abs(x)))), 0, fade=0.001)
    x = C.load(os.path.join(SFX, "tick.wav"))
    for k in range(15):
        y = pitched(x, 1 + k * 0.07)
        m.put(COUNT_AT + k * 0.055, y * ((0.32 if k == 14 else 0.17) * pk / float(np.max(np.abs(y)))), 0, fade=0.001)   # 0.2 · 0.1이면 곡에 묻혀 「숫자가 오를 때 효과음이 없다」로 들렸다(11-05 크몽 세션 아르곤)
    # 딩에 무게 — 딩만으로는 끝의 한 방으로 안 들렸다(11-04 아르곤 「소리 한 방이 없다」). 폰 스피커에도 남게 툭을 깐다
    x = C.load(os.path.join(SFX, "thud.wav"))
    m.put(BRAND_AT, x * (0.42 * pk / float(np.max(np.abs(x)))), 0, fade=0.001, fade_out=0.25)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=3.9)   # 합 봉우리(폭로 한 방)에 맞춰 줄어든 만큼 올려 −14 LUFS 안팎, 한계기가 봉우리를 잡는다. 숯 튀는 소리를 누르기 전엔 그 소리가 합 봉우리라 −18.7까지 작아져 마감이 못 맞췄다(11-05)


def render(mint=False):
    # 화면 글 — 11-03 밤 유호님 「세 편에 넣기」: 고정 두 줄 자막을 버리고 자막시안_20261103/remotion의 p12(앱 화면 결 + 섞은 판 — 장소 칩 아래 큰 「N번째」 · 두 폰 테두리)가 굽는다.
    # 끝은 판 없이 그림 위 글자만(p12-cg, 11-04 슬롭 점검표 1번). 인자 민트판은 옛 끝(비교용)
    comp, name = ("p12", "모두의코스_9x16_민트판") if mint else ("p12-cg", "모두의코스_9x16")
    for src, to in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav")):
        if C.md5(src) != C.md5(os.path.join(PUB, to)):
            shutil.copyfile(src, os.path.join(PUB, to))
    out, raw = os.path.join(OUT, name + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", comp, raw, "--concurrency=3", "--log=error", cwd=os.path.join(CAP, "remotion"))
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")   # 소리 AAC 320k 이상(영상사전검사)
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    if not mint:
        C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=15x5:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    for w in what:
        {"화면": picture, "소리": sound, "판": render, "민트판": lambda: render(mint=True)}[w]()
