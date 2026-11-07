# 시즌 3 블프 세일 「힘껏」 최종 편집(2026-11-07, Claude) — 02_콘티 2절(15초) · 3절(6초)을 시각 그대로 하드컷으로 잇고, 채원 내레이션 · 음악 · 효과음을 놓고,
# 글자 카드 · 제품 칸 · 전광판 · 간판 · 끝 카드는 자막시안_20261103/remotion의 s3 합성(src/s3/S3.tsx)이 굽는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/s3/블프세일_15초_9x16.mp4 · _폰.mp4 (6초는 블프세일_6초_…)
# 판 · 시작점은 편집 전 점검(시댄스무제한/편집전점검.py, 11-07)으로 골랐다 — 받은 판에서 그 동작이 나오는 장으로 시작점을 옮기고, 속도 · 색은 손대지 않는다(결정 10-24).
import os
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "s3")
PUB = os.path.join(ROOT, "최종", "자막시안_public", "s3")
CAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "자막시안_20261103")
FPS, W, H = 24, 1080, 1920

# 컷 경계(02_콘티 2절 · 3절)
T15 = [0, 0.96, 2.28, 3.04, 3.64, 3.76, 4.48, 5.16, 6.16, 7.68, 8.60, 11.72, 12.56, 15.00]
T6 = [0, 0.90, 2.20, 3.70, 4.60, 6.00]

# 컷 → 토막 [(판, 그 판에서 시작하는 초, 토막 길이 초 또는 None=컷 끝까지)] — 그래픽 컷(② ⑨ ⑪)은 뒤에 깔 판(그래픽이 흐리게 덮는다)
CUTS15 = {
    1: [("s3-01", 0.40, None)],        # 1.10초에 손을 떼어 1.25초에 「가자」 — 컷 0.70 · 0.85초(콘티 0.80)
    2: [("s3-06", 1.20, None)],        # 글자 카드 — 판이 덮는다(뒤 판은 안 보임)
    3: [("s3-03__2", 0.95, None)],     # 매트 두루마리가 렌즈 바로 앞으로 들어와 펼쳐짐(첫 판은 2.1초에야 옴 — 굽기 시트 바우처 절)
    4: [("s3-04", 2.33, None)],        # 놀란 O → 2.85초부터 휙(컷 0.52초, 콘티 0.36) — 2.95초 뒤 장엔 같은 옷 사람이 비쳐 그 앞에서 끝냄
    5: [("s3-04", 3.15, None)],        # 휙 흐림 — 3.05초 장에 같은 옷 사람이 비쳐 그 뒤부터
    6: [("s3-06", 0.00, None)],        # 돌리 줌 — 채원 크기 그대로(+3%) · 뒷벽 0.91배(0.72초), 매트가 카메라 쪽으로 굴러 펼쳐짐
    7: [("s3-07", 3.00, None)],        # 아치로 빨라지며 밀고 들어감 · 3.4초 아치 안이 하얗게(컷 0.40초)
    8: [("s3-08", 0.80, None)],        # 0.9초까지 멈춘 판 — 0.1초 머문 뒤 고르게 물러남(1.6초 0.85배) · 왼쪽으로 비켜 감
    9: [("s3-08", 1.80, None)],        # 제품 칸 — 뒤에 흐린 빛 터널
    10: [("s3-10", 1.65, None)],       # O → 2.35초 웃음이 핌(컷 0.70초, 콘티 0.76)
    11: [("s3-07", 0.00, None)],       # 제품 칸 — 뒤에 흐린 빛 아치
    12: [("s3-13", 2.76, 0.17), ("s3-12b", 1.40, None)],   # 들어오는 휙(콘티 「편집 이음 0.12~0.2초」 — ⑬ 휙 흐림을 좌우로 뒤집어 왼쪽에서 들어오는 꼴, S3.tsx) → 고개 휙(1.65초)
    13: [("s3-13__2", 0.30, None)],   # 11-07 다시 뽑은 판(Fable 「안장에 옆으로 앉은 자세 · 옅은 스톡 미소」) — 7장(0.29초)에 일어서기 시작 · 0.6초 두 주먹 · 1.92초 휙(0.63초) → 2.54초 빈 벽, 끊지 않고 한 토막
}
CUTS6 = {
    1: [("s3-01", 0.40, None)],
    2: [("s3-06", 1.20, None)],
    3: [("s3-08", 1.80, None)],
    4: [("s3-10", 1.65, None)],
    5: [("s3-13__2", 1.25, None)],   # 콘티 3절 「⑬은 주먹부터(고정 → 휙)」 — 11-07 판 30장(1.25초)부터: 주먹 0.67초 → 휙 0.63초 → 빈 벽 0.13초
}
FLIP = {(12, 0)}   # 좌우로 뒤집는 토막(컷, 토막 차례) — 휙 방향을 왼쪽에서 들어오게


def picture(name, T, CUTS):
    d = os.path.join(OUT, "_컷_" + name)
    os.makedirs(d, exist_ok=True)
    paths = []
    for n in range(1, len(T)):
        a0, a1 = round(T[n - 1] * FPS), round(T[n] * FPS)
        left = a1 - a0
        for j, (pid, t, dur) in enumerate(CUTS[n]):
            k = left if dur is None else min(left, round(dur * FPS))
            src = C.clip(pid)
            a = round(t * FPS)
            have = C.frames_of(src)
            if a + k > have:
                a = max(0, have - k)
                print(f"#{n}.{j} {pid}: 시작을 {a / FPS:.2f}초로 당김")
            out = os.path.join(d, f"{n:02d}_{j}.mp4")
            C.cut_video(src, a, k, W, H, FPS, out)
            if (n, j) in FLIP and name == "15":
                tmp = out + ".flip.mp4"
                C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "hflip", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", tmp)
                os.replace(tmp, out)
            paths.append(out)
            left -= k
            print(f"#{n}.{j} {pid} {a / FPS:.2f}초부터 {k}장")
        assert left == 0, f"#{n} 장 수가 모자람 {left}"
    C.join_videos(paths, os.path.join(OUT, f"화면_{name}.mp4"))
    print(os.path.join(OUT, f"화면_{name}.mp4"), C.frames_of(os.path.join(OUT, f"화면_{name}.mp4")), "장")


# ---------- 소리 ----------
# 목소리: 시댄스 화면 밖 대사 판(11-01 유호님 「시댄스 목소리로 붙여」)에서 Demucs로 뗀 채원 목소리(목소리재기.py). 4줄은 11-07 다시 뽑은 __2(3.0초 — 첫 판 4.25초는 콘티 3.5초를 넘었다).
# 효과음: 자료실(sonniss · fairlight · 매진 임박 sfx). 효과음이 말머리에 겹치면 첫 자음이 묻혀(현장노트 영상) 그 박은 말 앞으로 비키거나 낮춘다.
# 음악: 02_콘티 4절 — 분당 128박 밝은 전자 음악. 11-07 Suno · 일레븐 웹이 로그아웃이라 허깅페이스 ZeroGPU stable-audio-3로 구운 후보 둘(../블프_곡후보.py) 가운데
#   Gemini 맹검 1위 s3_b(129박 · 0.464초 박, 15.5초까지 고른 크기). 곡 0.48초부터 쓰면 박이 「팡」(1.40) · 끝 카드(12.56)에 ±0.02초로 맞는다.
VOICE = os.path.join(OUT, "목소리")
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
SON = f"{LIB}/sonniss_gdc2026/풀림"
FAIR = f"{LIB}/fairlight/Media Files"
HS = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx"
SFX = {
    "삑": f"{SON}/InMotionAudio - Medical Thermometer/BEEPMed_Thermometer_Beep11_InMotionAudio_MedicalThermometer.wav",
    "팡": f"{SON}/Cinematic Sound Design - Interface & Infographics/Interface Pop High Short.wav",
    "조각": f"{SON}/Cinematic Sound Design - Hybrid Game & UI Elements/Cofetti Whoosh Pluck Spill.wav",
    "매트": f"{FAIR}/Bed Unrolling Sheets.M.wav",
    "휙": f"{SON}/Cinematic Sound Design - Ultra Transitions & Impacts/Woosh Sweep Slide Infographics Basic.wav",
    "넘김": f"{SON}/Epic Stock Media - Board Game - Sound Set Kit for Tabletop and Digital Games/PAPRHndl_Game Play Cards Dry Show Flip Toss Disgard Near 12_ESM_BG.wav",
    "쉭": f"{FAIR}/Low Whoosh x2.wav",
    "스침": f"{HS}/swish.wav",
    "착": f"{HS}/snap.wav",
    "틱": f"{HS}/tick.wav",
    "반짝": f"{HS}/sparkle.wav",
    "유리": f"{SON}/Cinematic Sound Design - Interface & Infographics/Interface Accept Glassy Snap.wav",
    "쿵": f"{HS}/boom.wav",
    "여운": f"{SON}/Epic Stock Media - Anime Game/DSGNStngr_Power Up Bright Positive Successful Light Saturation Crash Shimmer 05_ESM_AG.wav",
}
MUSIC = {"15": os.path.join(ROOT, "최종", "음악", "블프_1107", "s3_곡.wav"), "6": os.path.join(ROOT, "최종", "음악", "블프_1107", "s3_곡.wav")}
MUSIC_IN = {"15": 0.48, "6": 0.38}   # 6초는 「팡」이 1.30초라 한 박 앞(0.38)


def seg(path, a, b, pad_a=0.06, pad_b=0.12):
    x = C.load(path)
    return x[max(0, int((a - pad_a) * C.RATE)):int((b + pad_b) * C.RATE)]


def xfade(a, b, sec):
    k = int(sec * C.RATE)
    a, b = a.copy(), b.copy()
    a[-k:] *= np.linspace(1, 0, k, dtype=a.dtype)
    b[:k] *= np.linspace(0, 1, k, dtype=b.dtype)
    return np.concatenate([a[:-k], a[-k:] + b[:k], b[k:]])


def sfx(name, a=None, b=None):
    x = C.load(SFX[name])
    if a is not None:
        x = x[int(a * C.RATE):int(b * C.RATE) if b else None]
    return x


def loudest(x, sec):
    # 긴 파일에서 sec초 창 가운데 가장 큰 자리
    n, k = int(sec * C.RATE), int(0.05 * C.RATE)
    e = np.convolve(x ** 2, np.ones(n) / n, mode="valid")[::k]
    i = int(np.argmax(e)) * k
    return x[i:i + n]


def sound(name):
    T = T15 if name == "15" else T6
    m = C.Mix(T[-1] + 0.2)
    v1, v3, v4 = (os.path.join(VOICE, f"{p}.wav") for p in ("s3-말-채원-1", "s3-말-채원-2", "s3-말-채원-3__2"))
    if name == "15":
        # 1 · 2줄은 같은 판이라 사이 방 소리를 끊지 않고 잇는다 — 판의 쉼 1.41초 가운데 조용한 0.65초(4.30~4.95)만 0.05초 겹쳐 뺌(셋째 맹검 「2.8 숨이 게이트에 걸려 뚝」)
        x12 = xfade(seg(v1, 1.00, 4.30, 0.06, 0.0), seg(v1, 4.95, 7.65, 0.0, 0.18), 0.05)
        # 줄 크기 고르기(말 덩어리 RMS 줄1 −13.9 · 줄2 −10.3 · 줄3 −16.8 · 줄4 −12.0 dB — 셋째 맹검 「11초 뒤 목소리가 1~2 dB 낮음」 · 첫 맹검 「바람막이도 뭉개짐」)
        g12 = np.ones(len(x12), np.float32); g12[int(3.36 * C.RATE):] = 10 ** (-1.5 / 20)
        lines = [(0.05, x12 * g12 * 10 ** (0.5 / 20)), (6.65, seg(v3, 1.50, 5.60, 0.06, 0.18) * 10 ** (2.5 / 20)), (11.05, seg(v4, 1.38, 4.38, 0.06, 0.18) * 10 ** (1.5 / 20))]
    else:
        # 「지금 힘껏!」 뒤 쉼 0.28 → 0.12초(0.03초 겹쳐 이음 — 맹검 「숨 없이 붙인 티 · 틱」), 앞은 「끝나요」 꼬리를 빼고 「지」 바로 앞(2.54)부터
        tail = xfade(seg(v4, 2.57, 3.46, 0.03, 0.0), seg(v4, 3.58, 4.38, 0.0, 0.16), 0.03)
        lines = [(0.02, seg(v1, 1.00, 3.75, 0.06, 0.15) * 10 ** (0.5 / 20)), (4.23, tail)]
    for t, x in lines:
        m.put(t, x, 0, fade=0.012, fade_out=0.15)
    pk = float(np.max(np.abs(m.a))) or 1.0
    hit = lambda t, x, k, fo=None: m.put(t, x * (k * pk / (float(np.max(np.abs(x))) or 1.0)), 0, fade=0.002, fade_out=fo)
    if name == "15":
        hit(0.28, sfx("삑"), 0.22)
        hit(1.40, sfx("팡"), 0.42); hit(1.40, sfx("쿵")[: int(0.5 * C.RATE)], 0.38, 0.3); hit(1.42, sfx("조각", 0.0, 1.3), 0.26, 0.5)
        hit(2.30, loudest(sfx("매트"), 0.7), 0.34, 0.2)
        hit(3.40, sfx("휙"), 0.36)
        for k in range(5):
            hit(3.88 + k * 0.085, sfx("넘김"), 0.14); hit(3.94 + k * 0.085, sfx("넘김"), 0.11)
        hit(4.48, sfx("쉭"), 0.30, 0.3)
        hit(5.22, sfx("스침"), 0.22); hit(5.52, sfx("스침"), 0.2)
        for t in (6.20, 6.36, 6.48):
            hit(t, sfx("착"), 0.30)
        for t0 in (6.52, 6.64, 6.76):
            for k in range(6):
                hit(t0 + k * 0.05, sfx("틱"), 0.07)
        hit(8.40, sfx("반짝"), 0.10)
        hit(8.64, sfx("착"), 0.32)
        for t0 in (8.96, 9.12, 9.24):
            for k in range(6):
                hit(t0 + k * 0.05, sfx("틱"), 0.09)
        hit(10.12, sfx("착"), 0.32)
        for t0 in (10.44, 10.52, 10.64):
            for k in range(6):
                hit(t0 + k * 0.05, sfx("틱"), 0.09)
        hit(10.82, sfx("반짝"), 0.22)
        hit(11.66, sfx("스침"), 0.16)
        hit(12.80, sfx("유리"), 0.24)
        hit(13.00, sfx("조각", 0.0, 1.6), 0.18, 0.6)
        hit(14.26, sfx("휙"), 0.26)    # 휙 시작 14.185(12.56 + 39장) — 소리는 가장 빠른 14.4 쪽으로 · 「앱에서」(~14.15) 뒤에
        hit(14.30, sfx("여운")[: int((T[-1] - 14.30) * C.RATE)], 0.26, 0.5)   # 영상 끝(15.0)에서 다 내려앉게
    else:
        hit(0.28, sfx("삑"), 0.22)
        hit(1.30, sfx("팡"), 0.42); hit(1.30, sfx("쿵")[: int(0.5 * C.RATE)], 0.38, 0.3); hit(1.32, sfx("조각", 0.0, 1.0), 0.26, 0.4)
        for t in (2.24, 2.40, 2.52):
            hit(t, sfx("착"), 0.24)
        for t0 in (2.56, 2.68, 2.80):
            for k in range(6):
                hit(t0 + k * 0.05, sfx("틱"), 0.10)
        hit(3.95, sfx("반짝"), 0.12)   # 「지금」(4.26)을 덮지 않게 앞으로 · 작게
        hit(4.62, sfx("유리"), 0.22)
        hit(4.80, sfx("조각", 0.0, 1.0), 0.24, 0.4)
        hit(5.30, sfx("휙"), 0.20)   # 휙 시작 5.267(4.60 + 16장) — 「앱에서!」(5.26~5.96)를 덮지 않게 작게
        hit(5.34, sfx("여운")[: int((T[-1] - 5.34) * C.RATE)], 0.16, 0.45)   # 영상 끝(6.0)에서 다 내려앉게
    song = MUSIC[name]
    if os.path.exists(song):
        x = C.load_stereo(song)[int(MUSIC_IN[name] * C.RATE):][: int(T[-1] * C.RATE)]   # 섞음은 영상보다 0.2초 길다 — 곡을 영상 끝에서 끊어야 끝 페이드가 다 내려간다(셋째 맹검 「뚝」의 까닭)
        # 말하는 동안 −18 dB 안팎으로 눌러 둔다(02_콘티 4절 −16~−24) — 말 덩어리 앞뒤 0.1초에 걸쳐 내린다
        env = np.ones(len(x), np.float32)
        spans = []
        for t, s in lines:   # 0.9초보다 짧은 틈은 이어서 누른다(맹검 「덕킹 핑퐁 · 3초 뒤 갑자기 커짐」)
            a0, a1 = t - 0.1, t + len(s) / C.RATE + 0.1
            if spans and a0 - spans[-1][1] < 0.9:
                spans[-1][1] = a1
            else:
                spans.append([a0, a1])
        for a0, a1 in spans:
            env[max(0, int(a0 * C.RATE)):max(0, int(a1 * C.RATE))] = 10 ** (-6 / 20)
        env = np.convolve(env, np.ones(21600) / 21600, mode="same").astype(np.float32)
        m.put(0, x * env[:, None] * (0.55 * pk / (float(np.max(np.abs(x))) or 1.0)), 0, fade=0.004, fade_out=0.8 if name == "15" else 0.7)   # 끝을 0.7~0.8초에 걸쳐(맹검 「칼로 자른 듯」)
    else:
        print(f"⚠ 곡이 없다({song}) — 음악 없이 섞음")
    m.finish(os.path.join(OUT, f"소리_{name}.wav"), boost_db=2.0)


def render(name, end="scene"):
    import shutil
    pub = PUB
    os.makedirs(pub, exist_ok=True)
    for src, to in ((os.path.join(OUT, f"화면_{name}.mp4"), f"picture_{name}.mp4"), (os.path.join(OUT, f"소리_{name}.wav"), f"sound_{name}.wav")):
        if not os.path.exists(os.path.join(pub, to)) or C.md5(src) != C.md5(os.path.join(pub, to)):
            shutil.copyfile(src, os.path.join(pub, to))
    comp = f"s3-{name}" + ("-card" if end == "card" else "")
    base = f"블프세일_{name}초" + ("_원본짜임" if end == "card" else "")
    out, raw = os.path.join(OUT, base + "_9x16.mp4"), os.path.join(OUT, f"_렌더_{comp}.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", comp, raw, "--concurrency=4", "--log=error", cwd=os.path.join(CAP, "remotion"))
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
          os.path.join(OUT, base + "_폰.mp4"))
    print(out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    what = sys.argv[1:] or ["화면", "소리", "판"]
    for w in what:
        if w == "화면":
            picture("15", T15, CUTS15)
            picture("6", T6, CUTS6)
        elif w == "소리":
            sound("15")
            sound("6")
        elif w == "판":
            for n in ("15", "6"):
                render(n)
                render(n, "card")
