# 시즌 4 블프 스나이퍼 「느지막」 최종 편집(2026-11-07, Claude) — 02_콘티 2절 20컷(원본 Target 「Montage」 32.15초)을 시각 그대로 하드컷으로 잇고,
# 준호 속삭임 · 가게 목소리 · 음악 · 효과음을 놓고, 작전명 글판 · 달력 D-숫자 · 훈련 꼬리표 · 전단 글 · 알림 · 끝은 자막시안_20261103/remotion의 s4 합성(src/s4/S4.tsx)이 굽는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/s4/블프스나이퍼_16x9.mp4 · _폰.mp4
# 판 · 시작점은 편집 전 점검(시댄스무제한/편집전점검.py, 11-07)으로 골랐다. 8 · 14는 11-07에 다시 뽑은 판(다시_1107_꾸러미.py), 19는 19a + 19b 하드 컷(02_콘티 7절 대비책 — 19 한 판은 2.5초에야 닿음).
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "s4")
FPS, W, H = 24, 1920, 1080
T = [0, 1.00, 2.68, 5.27, 7.61, 8.61, 10.45, 13.80, 15.09, 16.72, 17.23, 17.90, 18.94, 19.40, 20.70, 21.37, 23.04, 25.30, 26.17, 31.11, 33.46]   # 02_콘티 2절 — 끝만 32.15 → 33.46(11-07 가게 목소리를 끊지 않고 · 20번 검은 화면 코골이)

# 컷 → 토막 [(판, 그 판에서 시작하는 초, 토막 길이 초 또는 None=컷 끝까지)] — None 판은 검은 화면
CUTS = {
    1: [(None, 0, None)],                 # 검은 화면 + 「작전명: 블프」(합성)
    2: [("s4-02", 0.00, None)],           # 달력 20일 X(D-7)
    3: [("s4-03", 1.68, None)],           # 윗몸일으키기 — 판 2.2초에 첫째로 올라와 컷 0.52초(원본 3.2초 박), 둘째는 판이 느려 컷 끝에 다시 올라오는 중
    4: [("s4-04", 1.30, None)],           # 휴대폰 아령 → 로봇 청소기에 목례(판 2.2~2.6초)
    5: [("s4-05", 0.25, None)],           # 달력 24일 X(D-3)
    6: [("s4-06", 0.00, None)],           # 작전 책상 — 떠오르며 다가감, 트로피 자리는 아래로 빠짐
    7: [("s4-07", 0.00, None)],           # 현관 전단 — 1.4~1.9초 안경을 벗고 더 가까이
    8: [("s4-08__3", 2.25, None)],        # 다시 뽑은 휙 팬(11-07) — 선반 흐름 속 옆얼굴로 지나감(첫 판은 4초에 25%만 움직이고 가운데 정면에서 눈을 감음)
    9: [("s4-09", 0.00, None)],           # 욕실 거울 위장 줄
    10: [("s4-10", 2.00, None)],          # 초시계 누르는 엄지(판 2.0~2.5초 움직임)
    11: [("s4-11", 2.20, None)],          # 정면 집중(판 0.5~2.0초는 멈춤 — 그 뒤 눈이 움직이는 자리)
    12: [("s4-12", 1.00, None)],          # 두 손 자판 연타(꼬리표는 11-07 Fable 「광클 ↔ 자판」으로 「주소 입력」)
    13: [("s4-13", 0.40, None)],          # 달력 25일 둘째 획(D-2) — 1.5초 뒤엔 없던 「31」이 생김
    14: [("s4-14__2", 0.30, None)],       # 다시 뽑은 담요 저격 자세(11-07) — 첫 판은 4초 내내 멈춤
    15: [("s4-15", 0.50, None)],          # 달력 26일 X 마무리(D-1)
    16: [("s4-16", 0.10, None)],          # 탁상시계를 빈 받침에 「탁」 → 고개 듦
    17: [("s4-17", 0.00, None)],          # 로봇 청소기 먼저 → 1.0초부터 팔을 벌림
    18: [("s4-18", 0.30, None)],          # 27일 「00:00」 동그라미(D-DAY)
    19: [("s4-19a__2", 0.00, 0.83), ("s4-19b", 0.00, None)],   # 00:00 밤 거실 낮은 이동 → 27.0초 잠든 준호(스매시 컷)
    20: [("s4-19b", 4.125, 0.92), (None, 0, None)],   # 판 끝(32.03)까지 잠든 장면 → 검은 화면(원본 20번) 위에 끝 묶음 · 「느지막」 · 코골이 한 번(11-07 소리 맹검 「가게 목소리를 이어 붙인 티 · 끝이 뚝」)
}


def crop169(src):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", src], capture_output=True, text=True)
    w, h = (int(x) for x in r.stdout.strip().split(",")[:2])
    if abs(w / h - 16 / 9) < 0.002:
        return None
    if w / h > 16 / 9:
        cw = int(round(h * 16 / 9 / 2) * 2)
        return f"{cw}:{h}:{(w - cw) // 2}:0"
    ch = int(round(w * 9 / 16 / 2) * 2)
    return f"{w}:{ch}:0:{(h - ch) // 2}"


def black(k, out):
    C.run("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}", "-frames:v", str(k), "-c:v", "libx264", "-crf", "12", "-preset", "medium",
          "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n in range(1, len(T)):
        a0, a1 = round(T[n - 1] * FPS), round(T[n] * FPS)
        left = a1 - a0
        for j, (pid, t, dur) in enumerate(CUTS[n]):
            k = left if dur is None else min(left, round(dur * FPS))
            out = os.path.join(d, f"{n:02d}_{j}.mp4")
            if pid is None:
                black(k, out)
                print(f"#{n}.{j} 검은 화면 {k}장")
            else:
                src = C.clip(pid)
                a = round(t * FPS)
                have = C.frames_of(src)
                if a + k > have:
                    a = max(0, have - k)
                    print(f"#{n}.{j} {pid}: 시작을 {a / FPS:.2f}초로 당김")
                C.cut_video(src, a, k, W, H, FPS, out, crop=crop169(src))
                print(f"#{n}.{j} {pid} {a / FPS:.2f}초부터 {k}장")
            paths.append(out)
            left -= k
        assert left == 0, f"#{n} 장 수가 모자람 {left}"
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))
    print(os.path.join(OUT, "화면.mp4"), C.frames_of(os.path.join(OUT, "화면.mp4")), "장")


# ---------- 소리 ----------
# 준호 속삭임: 시댄스 화면 밖 대사 판에서 뗀 목소리(bf-sale-20261025/목소리재기.py). 첫 줄은 11-07 다시 뽑은 __3(첫 판 · __2는 두 받아쓰기 모두 「불프」로 들림).
# 가게 목소리: 일레븐 v4 루나(가게목소리.py · 11-07 Gemini 맹검 1위 — 「블프 · 선착순 · 느지막」 또렷, 나머지 둘은 「블프」를 뭉갬).
#   한 판(5.5초)이 콘티 2.5초 자리보다 길다. 처음엔 문장 사이 쉼(0.71 · 0.59초)을 없애 32.15초에 맞췄더니 11-07 Gemini 소리 맹검이 「이어 붙인 티 · AI 같음 · 끝이 뚝」 —
#   쉼을 0.24 · 0.33초로만 줄여 판 그대로 잇고, 알람 · 음악 뚝은 27.4초, 끝은 원본 20번(검은 화면 · 코골이 한 번)을 살려 33.46초로 늘렸다.
# 효과음: 자료실 + 판이 낸 소리 가운데 깨끗한 것(4 · 17 로봇 청소기, 7 전단, 16 「탁」 — Gemini로 들어 보고 골랐다, 6은 피아노가 깔려 안 씀). 알람 셋 · 코골이는 s4-19소리 판.
# 음악: 02_콘티 3절 — 1.0초부터 훈련 몽타주, 조금씩 커져 18번 끝 정점 → 27.4초 뚝. 11-07 허깅페이스 ZeroGPU stable-audio-3 후보 둘 가운데 Gemini 맹검 1위 s4_a
#   (117.5박 · 80년대 훈련 몽타주, 곡 16초부터 브라스 · 기타가 들어와 커짐). 곡 크기가 고르니 원본처럼 +3 dB를 천천히 올린다. 0.412초(첫 박)부터 쓴다.
VOICE = os.path.join(OUT, "목소리")
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
SON = f"{LIB}/sonniss_gdc2026/풀림"
FAIR = f"{LIB}/fairlight/Media Files"
HS = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx"
SFX = {
    "째깍": f"{SON}/344 Audio - Antique Clocks/CLOCKTick_You're Running Late _344 Audio_Antique Clocks.wav",
    "펜": f"{FAIR}/Drawing Small Tiny Pencil.M.wav",
    "휙": f"{SON}/Cinematic Sound Design - Ultra Transitions & Impacts/Woosh Sweep Slide Infographics Basic.wav",
    "삑": f"{SON}/InMotionAudio - Medical Thermometer/BEEPMed_Thermometer_Beep11_InMotionAudio_MedicalThermometer.wav",
    "타자": f"{FAIR}/Typing On Computer Keyboard.M.wav",
    "딸깍": f"{SON}/Epic Stock Media - Board Game - Sound Set Kit for Tabletop and Digital Games/UIClick_UI Button Analog Vintage Double Click Neutral Dry Press 11_ESM_BG.wav",
    "담요": f"{FAIR}/Cloth Movement.M.wav",
    "띵": f"{HS}/ding2.wav",
    "냉장고": f"{SON}/Jake Fielding - Fridge Hums Vol.2/MACHAppl_Deep Fridge Hum, Buzz, Electric Tone, Deep_Jake Fielding_Fridge Hums Pt2.wav",
}
MUSIC = os.path.join(ROOT, "최종", "음악", "블프_1107", "s4_곡.wav")
MUSIC_IN = 0.412
CUT_AT = 27.40   # 음악 · 알람 뚝


def seg(path, a, b, pad_a=0.05, pad_b=0.10):
    x = C.load(path)
    return x[max(0, int((a - pad_a) * C.RATE)):int((b + pad_b) * C.RATE)]


def highpass(x, hz):
    from scipy.signal import butter, sosfiltfilt
    return sosfiltfilt(butter(2, hz, "highpass", fs=C.RATE, output="sos"), x).astype(x.dtype)


def lowpass(x, hz):
    from scipy.signal import butter, sosfiltfilt
    return sosfiltfilt(butter(2, hz, "lowpass", fs=C.RATE, output="sos"), x).astype(x.dtype)


def take_audio(pid, a, dur):
    return C.load(C.clip(pid))[int(a * C.RATE):int((a + dur) * C.RATE)]


def loudest(x, sec):
    import numpy as np
    n, k = int(sec * C.RATE), int(0.02 * C.RATE)
    e = np.convolve(x ** 2, np.ones(n) / n, mode="valid")[::k]
    i = int(np.argmax(e)) * k
    return x[i:i + n]


def sound():
    import numpy as np
    m = C.Mix(T[-1] + 0.1)
    j1, j2 = os.path.join(VOICE, "s4-말-준호-1__3.wav"), os.path.join(VOICE, "s4-말-준호-2.wav")
    store = os.path.join(VOICE, "가게_루나.mp3")
    lines = [
        (0.10, seg(j1, 0.75, 1.30)), (0.76, seg(j1, 1.80, 2.25)),        # 작전명… 블프.(0.2–0.9)
        (10.80, seg(j1, 3.10, 3.50)),                                     # 반값…
        (15.30, seg(j1, 4.45, 4.80)), (15.95, seg(j1, 5.50, 5.90)),       # 이번엔… 이긴다.
        (21.60, seg(j2, 1.00, 1.60)), (23.20, seg(j2, 3.10, 3.90)), (25.45, seg(j2, 5.30, 5.80)),   # 들이쉬고… 반 내쉬고… 멈추고…
    ]
    # 속삭임 — 90 Hz 아래(입술 「텁」)를 걷고 +3.5 dB(11-07 소리 맹검 「작전명 텁 · 블프의 프가 묻힘 · 속삭임과 알람 차가 너무 큼」)
    boost = {10.80: 3.2, 15.30: 1.9, 15.95: 1.9}   # 「반값…」은 넷째 확인 듣기까지 「덜 풀림」 → +10 dB   # 몽타주 한가운데 「반값…」 · 「이번엔… 이긴다.」는 셋째 맹검까지 「곡에 묻힘」 — 더 올림
    lines = [(t, highpass(x, 90) * boost.get(round(t, 2), 1.5)) for t, x in lines]
    # 가게 목소리(루나 한 판: 주무세요 0.09–0.82 · 블프는 … 내내 1.53–4.40 · 느지막 4.99–5.57) — 말은 그대로, 쉼만 0.71 → 0.24 · 0.59 → 0.33초
    lines += [(27.84, seg(store, 0.09, 0.82, 0.04, 0.12)), (28.81, seg(store, 1.53, 4.40, 0.04, 0.12)), (32.01, seg(store, 4.99, 5.57, 0.04, 0.26))]
    for t, x in lines:
        m.put(t, x, 0, fade=0.012)
    pk = float(np.max(np.abs(m.a))) or 1.0
    hit = lambda t, x, k, fo=None: m.put(t, x * (k * pk / (float(np.max(np.abs(x))) or 1.0)), 0, fade=0.003, fade_out=fo)
    hit(0.0, C.load(SFX["째깍"])[int(2.0 * C.RATE):int(3.0 * C.RATE)], 0.16, 0.15)        # 1 째깍
    for t in (1.30, 7.72, 18.96, 20.74):                                                 # 펜 — 달력 X
        hit(t, loudest(C.load(SFX["펜"]), 0.45), 0.20, 0.12)
    hit(25.36, loudest(C.load(SFX["펜"]), 0.75), 0.20, 0.2)                              # 18 동그라미
    hit(T[3], take_audio("s4-04", 1.29, T[4] - T[3]), 0.12, 0.2)                         # 4 로봇 청소기(판 소리)
    rustle = take_audio("s4-07", 0.0, T[7] - T[6]).copy()
    i0, i1 = int((10.70 - T[6]) * C.RATE), int((11.40 - T[6]) * C.RATE)
    rustle[i0:i1] *= 0.35                                                                  # 「반값…」 동안 바스락을 −9 dB
    hit(T[6], rustle, 0.06, 0.2)                                                          # 7 전단 바스락(판 소리) — 「반값…」을 덮어 0.10 → 0.06
    hit(T[7] + 0.02, C.load(SFX["휙"]), 0.34)                                            # 8 휙 팬
    hit(16.90, C.load(SFX["삑"]), 0.20)                                                  # 10 초시계
    hit(T[11], loudest(C.load(SFX["타자"]), T[12] - T[11]), 0.13, 0.1)                   # 12 두 손 자판(맹검 「17~19초 클릭이 큼」 0.20 → 0.13)
    hit(19.82, C.load(SFX["딸깍"]), 0.15); hit(T[13], loudest(C.load(SFX["담요"]), 1.2), 0.08, 0.3)   # 14 딸깍(0.24 → 0.15) · 담요
    hit(T[15], take_audio("s4-16", 0.08, T[16] - T[15]), 0.26, 0.2)                      # 16 「탁」(판 소리)
    hit(T[16], take_audio("s4-17", 0.0, T[17] - T[16]), 0.12, 0.2)                       # 17 로봇 청소기(판 소리)
    al = C.load(C.clip("s4-19소리"))
    al_soft = lowpass(al, 6500)   # 셋째 맹검 「알람 고음이 이어폰에서 귀를 찌름」 — 6.5 kHz 위를 깎음
    a1, a2 = al_soft[int(0.05 * C.RATE):int(0.85 * C.RATE)], al_soft[int(0.30 * C.RATE):int(0.95 * C.RATE)]
    hit(26.20, a1, 0.36, 0.1); hit(CUT_AT - len(a2) / C.RATE, a2, 0.36)                # 알람 셋 — 판 0.95초의 「뚝」을 음악 뚝(27.40)에 맞춤(맹검 「귀가 아플 만큼 · 찢어짐」 0.50 → 0.36)
    hum = C.load(SFX["냉장고"])[: int((T[-1] - CUT_AT + 0.2) * C.RATE)]
    m.put(CUT_AT, hum * (0.025 * pk / (float(np.max(np.abs(hum))) or 1.0)), 0, fade=0.05, fade_out=0.3)   # 뚝 뒤 밤 거실 냉장고 소리(맹검 「디지털 무음 · 편집 실수 같음」)
    hit(27.10, C.load(SFX["띵"]), 0.30)                                                  # 알림
    hit(27.42, loudest(al[int(2.6 * C.RATE):int(3.7 * C.RATE)], 0.53), 0.48, 0.12)      # 드르렁
    al2 = C.load(C.clip("s4-19소리__2"))   # 둘째 소리 판의 코골이(2.78~3.75초) — 27.42초 것과 다른 숨
    hit(32.90, loudest(al2[int(2.75 * C.RATE):int(3.75 * C.RATE)], 0.45), 0.36, 0.12)   # 20 검은 화면 코골이 한 번(02_콘티 2절 20)
    song = MUSIC
    if os.path.exists(song):
        x = C.load_stereo(song)[int(MUSIC_IN * C.RATE):]
        n = int((CUT_AT - 1.0) * C.RATE)
        x = x[:n]
        env = np.ones(len(x), np.float32)
        for t, s in lines:
            i, j = int((t - 1.0 - 0.1) * C.RATE), int((t - 1.0 + len(s) / C.RATE + 0.1) * C.RATE)
            if j > 0:
                env[max(0, i):max(0, j)] = 10 ** ((-14 if t < 2 else -18 if abs(t - 10.80) < 0.01 else -7) / 20)   # 첫 「작전명… 블프.」 · 「반값…」은 곡에 묻혀 −14 dB
        env = np.convolve(env, np.ones(2400) / 2400, mode="same").astype(np.float32)
        env *= (10 ** (np.linspace(0, 3, len(x)) / 20)).astype(np.float32)   # 원본 곡선처럼 끝으로 갈수록 조금씩(+3 dB)
        y = x * env[:, None] * (0.42 * pk / (float(np.max(np.abs(x))) or 1.0))
        k = int(0.3 * C.RATE)
        y[:k] *= np.linspace(0, 1, k, dtype=np.float32)[:, None]   # 첫 박을 0.3초에 걸쳐 올림(맹검 「블프의 프가 첫 박에」) — put의 fade는 끝에도 걸려 쓰지 않음
        m.put(1.0, y, 0, fade=0.004, fade_out=0.06)   # 뚝은 0.06초 꼬리(맹검 「디지털로 0을 만든 듯」)
    else:
        print(f"⚠ 곡이 없다({song}) — 음악 없이 섞음")
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=2.0)


def render(end="scene"):
    import shutil
    pub = os.path.join(ROOT, "최종", "자막시안_public", "s4")
    os.makedirs(pub, exist_ok=True)
    for src, to in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav")):
        if not os.path.exists(os.path.join(pub, to)) or C.md5(src) != C.md5(os.path.join(pub, to)):
            shutil.copyfile(src, os.path.join(pub, to))
    comp = "s4" + ("-card" if end == "card" else "")
    base = "블프스나이퍼" + ("_콘티끝카드" if end == "card" else "")
    cap = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103", "remotion")
    out, raw = os.path.join(OUT, base + "_16x9.mp4"), os.path.join(OUT, f"_렌더_{comp}.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", comp, raw, "--concurrency=4", "--log=error", cwd=cap)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
          os.path.join(OUT, base + "_폰.mp4"))
    print(out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for w in sys.argv[1:] or ["화면", "소리", "판"]:
        if w == "판":
            render()
            render("card")
        else:
            {"화면": picture, "소리": sound}[w]()
