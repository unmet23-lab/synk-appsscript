# 도담중공업 영어 판 만들기(2026-11-17, Claude) — PULSE 영어 시험 첫 편(11-20 올림, 유호님 11-17 「권고대로」 · 결정 표 11-17).
#   한국어 판(b2b-factory-20261026/최종편집.py · 최종소리.py · 도담_끝로고.py, 유호님 「이대로 확정」)을 그대로 불러 쓰고 바뀌는 셋만 갈아 끼운다.
#     화면: 1~36컷은 한국어 판이 잘라 둔 컷(최종/p10/_컷/01~36.mp4)을 그대로 잇고, 37컷 끝 로고만 영문으로 그린 이름(로고_영어.py)으로 다시 굽는다. 다시 굽는 영상 판은 없다.
#     소리: 최종소리.build를 그대로 쓰고 내레이션만 영어 판(내레이션_영어.py)으로 바꾼다 — 놓는 자리 · 곡 내림 · 효과음은 한국어 판과 같다.
#           마지막 줄만 56.08 → 55.58초로 0.5초 당긴다(영어 줄 2.28초가 57.97초 마지막 화음 앞에서 끝나야 곡 내림을 화음 전에 다 푼다).
#     판: Remotion src/p10en(영어 자막 · SYNK PULSE 끝 화면 3.25초)으로 굽고 음량을 −14 LUFS로 맞춘다.
#   python -X utf8 영어판.py [소리] [화면] [판] [--목소리 아이작|조지|브라이언] [--로고 A|B]
#     → git 밖 synk-vendor/pulse-portfolio12-20261024/최종/p10_en/도담_영어_<로고>_<목소리>.mp4 · _폰.mp4 · _반초.jpg
#   python -X utf8 영어판.py 낱장 <파일> <초> [<초> …]   → p10_en/_낱장/<파일 이름>_t<초>.png
import os
import shutil
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
B2B = os.path.normpath(os.path.join(HERE, "..", "..", "PULSE_포트폴리오_제작준비_20261012", "video", "b2b-factory-20261026"))
sys.path.insert(0, B2B)
sys.path.insert(0, HERE)
import 최종편집 as E        # noqa: E402 — 컷 경계(F · TF) · decode · encode · 띠
import 도담_끝로고 as END   # noqa: E402
import 최종소리 as SND      # noqa: E402
import 로고_영어 as LE      # noqa: E402

C = E.C
OUT = os.path.join(E.ROOT, "최종", "p10_en")
KO_CUTS = os.path.join(E.OUT, "_컷")
CAP = os.path.normpath(os.path.join(B2B, "..", "자막시안_20261103", "remotion"))
PUB = os.path.join(E.ROOT, "최종", "자막시안_public", "p10en")
CARD = 78   # P10en.tsx의 CARD와 같아야 한다(끝 화면이 필름 뒤로 더 서 있는 장 수)

# 영어 내레이션 아홉 줄 — (첫 낱말을 놓을 화면 초, 곡 dB, 목소리 띠 dB, [(자막 글, 줄 끝 낱말)]). 자리 · 내림 값은 한국어 판 「_초반」 그대로(최종소리.py 54~66줄).
#   자막은 한 화면에 한 문장, 마침표 · 쉼표 없음(슬롭 점검표 6번). 숫자는 읽기 쉽게 300으로 적는다.
NARR_AT = [
    (1.70, -4.5, -3.5, [("When it's fully grown it'll weigh 300 tons", "tons")]),        # 기 — 2 도면
    (9.60, -4.5, -3.0, [("We fitted every blade by hand", "hand")]),                       # 승 — 8 날개 원
    (16.60, -3.5, -2.5, [("Not one bolt went unchecked", "unchecked")]),                   # 승 — 12 → 13
    (21.80, -4.5, -3.5, [("For three years we looked in on it every day", "day")]),        # 승 — 16 터빈을 들여다보는 준호
    (28.90, -4.5, -3.5, [("It's all grown up", "up")]),                                    # 전 — 19 크레인이 물러남
    (35.80, -4.5, -3.5, [("Now for the first time we wake it", "it")]),                    # 전 — 23 → 24
    (49.20, -2.5, -1.5, [("Today", "Today")]),                                             # 결 — 31
    (50.50, -2.5, -1.5, [("we send our baby out into the world", "world")]),               # 결 — 33 노을 발전소
    (55.58, -4.0, -2.0, [("Wherever it goes it'll keep turning", "turning")]),             # 결 — 36 준호 옅은 웃음 끝 → 37 송전탑 · 도시 불
]
PIECE_ENDS = ["tons", "hand", "unchecked", "day", "up", "it", "Today", "world"]
# 줄마다 목소리를 올릴 dB — 한국어 판은 「다 컸습니다」 +4 · 「이제 처음으로 깨워 봅니다」 +3만 올렸다. 영어 첫 판(같은 값)은 목소리 띠에서 목소리 − 곡이
#   +8.3 · +8.4 · +10.5 · +9.1 · +8.6 · +8.4 · +10.9 · +7.7 · +10.6 dB로, 한국어 판이 맞춘 「+10 dB 안팎」(그 아래 +6~7은 「묻혔다」)보다 낮은 줄이 다섯이라 그 줄만 더 올린다
LIFT = {"When it's fully grown it'll weigh 300 tons": 1.5, "We fitted every blade by hand": 1.5, "For three years we looked in on it every day": 1.0,
        "It's all grown up": 5.5, "Now for the first time we wake it": 4.5, "we send our baby out into the world": 2.5}


def args():
    a = sys.argv[1:]
    voice, logo, what = "아이작", "B", []
    i = 0
    while i < len(a):
        if a[i] == "--목소리":
            voice, i = a[i + 1], i + 2
        elif a[i] == "--로고":
            logo, i = a[i + 1], i + 2
        else:
            what.append(a[i])
            i += 1
    return voice, logo, what or ["소리", "화면", "판"]


def sound(voice):
    SND.NARR = voice
    SND.NARR_DIR = os.path.join(OUT, "소리", "내레이션")
    SND.narration.__defaults__ = (voice,)      # 기본값이 불러올 때 묶여 있어 갈아 끼운다
    SND.NARR_AT, SND.PIECE_ENDS, SND.LIFT, SND.LAYOUT = NARR_AT, PIECE_ENDS, LIFT, "영어"
    # 곡 내림 · 쉼 · 마감 이득은 한국어 판 「_초반」 값 그대로다(최종소리.py가 NARR 기본값 「아이작_초반b」로 불러올 때 이미 그 값이다)
    assert (SND.DUCK_IN, SND.DUCK_OUT, SND.BREATH_MIN, SND.FINISH_BOOST) == (0.35, 0.80, 0.55, 1.0), "최종소리 초반 값이 바뀌었다 — 확인"
    # 리미터 앞 이득만 1.0 → 2.0 dB. 영어 첫 판(1.0)은 섞음이 −14.0 LUFS · 실제 봉우리 −0.6 dBFS로 나와 음량마감이 소리를 내리지 않았고,
    #   마감 파일 봉우리가 −1.0 dBFS(문턱 −1.2)로 미통과였다. 섞음을 조금 더 크게 만들어 음량마감이 내리면서 봉우리도 문턱 아래로 간다.
    SND.FINISH_BOOST = 2.0
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(OUT, f"소리_{voice}.wav")
    SND.build(wav, E.TF, timing_path=os.path.join(OUT, f"timing_{voice}.json"))
    sign_off(wav)


ECHO_AT = (E.F[-1] - 8) / E.FPS + 0.75   # P10en.tsx 끝 화면의 SYNK PULSE 로고가 올라오기 시작하는 초(CARD_ON + 0.75 = 61.67초)
ECHO_DB = -3.0                           # 메아리 첫 0.5초 크기 = 몸통 0.25초 칸 크기 가운데 + 이 값


def sign_off(wav):
    """끝 화면(61.0~64.5초) 아래에 곡의 마지막 화음(57.97초)을 한 번 더, 잔향을 붙여 SYNK PULSE 로고가 올라오는 자리에 놓는다.
    첫 판은 끝 화면 3.25초가 방 소리뿐이라 최종본검사 「끝소리」(끝 4.25초가 몸통 가운데보다 10 dB 넘게 작음 — 점검표 2)에 걸렸다.
    새 소리를 들이지 않고 필름이 끝난 그 화음을 메아리처럼 되울려, 도담 로고의 한 방(57.97초)과 같은 소리로 맺는다."""
    import wave
    import numpy as np
    rate = SND.RATE
    with wave.open(wav, "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
    total = (E.F[-1] + CARD) / E.FPS + 0.05
    if len(x) < int(total * rate):
        x = np.pad(x, ((0, int(total * rate) - len(x)), (0, 0)))
    n4 = int(0.25 * rate)
    db = [20 * np.log10(np.sqrt(np.mean(x[i:i + n4] ** 2)) + 1e-9) for i in range(int(1 * rate), int(55 * rate), n4)]
    body = float(np.median(db))
    song = C.load_stereo(SND.SONG)
    chord = song[int(SND.FINAL_CHORD * rate):int(60.0 * rate)]
    echo = np.concatenate([chord, np.zeros((int(3.0 * rate), 2), np.float32)]) + 0.5 * np.pad(
        SND.wet(chord, SND.hall_ir(3.5, 2.8)), ((0, 0), (0, 0)))[:len(chord) + int(3.0 * rate)]
    echo = SND.lp(echo, 7000)                                             # 먼 메아리처럼 윗소리를 조금 덜어 낸다
    head = echo[:int(0.5 * rate)]
    g = 10 ** ((body + ECHO_DB - 20 * np.log10(np.sqrt(np.mean(head ** 2)) + 1e-9)) / 20)
    a = int(ECHO_AT * rate)
    seg = (echo * g)[:len(x) - a]
    seg = SND.fades(seg.astype(np.float32), 0.03, 0.9)
    x[a:a + len(seg)] += seg
    nf = int(0.1 * rate)
    x[-nf:] *= np.linspace(1, 0, nf, dtype=np.float32)[:, None]
    peak = float(np.max(np.abs(x)))
    if peak > 0.89:
        x *= 0.89 / peak
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(np.clip(x * 32767, -32768, 32767).astype(np.int16).tobytes())
    print(f"끝 메아리 {ECHO_AT:.2f}초 · 몸통 가운데 {body:.1f} dB{ECHO_DB:+.0f} · 봉우리 {20 * np.log10(peak):.1f} dBFS · 길이 {len(x) / rate:.2f}초")


def picture(logo):
    d = os.path.join(OUT, f"_컷_{logo}")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n in range(1, 37):
        p = os.path.join(KO_CUTS, f"{n:02d}.mp4")
        k = E.F[n] - E.F[n - 1]
        if not os.path.exists(p) or C.frames_of(p) != k:
            raise SystemExit(f"한국어 판 컷 {p}가 없거나 {k}장이 아니다 — b2b-factory-20261026/최종편집.py 화면을 먼저 돌린다")
        paths.append(p)
    END.L = types.SimpleNamespace(render=lambda h: LE.render(h, logo))   # 끝 로고 이름만 영문으로(표식 · 자리 · 움직임은 한국어 판 그대로)
    k = E.F[37] - E.F[36]
    out37 = os.path.join(d, "37.mp4")
    E.encode(END.frames(E.decode(C.clip(E.CUTS[37][0]), 0, END.PLATE_N), E.F[36], k), out37)
    if C.frames_of(out37) != k:
        raise SystemExit(f"{out37}: {k}장이어야 하는데 {C.frames_of(out37)}장")
    paths.append(out37)
    raw = os.path.join(OUT, f"_화면_띠없음_{logo}.mp4")
    C.join_videos(paths, raw)
    bar = E.BAR
    C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-vf", f"drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill,drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill",
          "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(E.FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
          os.path.join(OUT, f"화면_{logo}.mp4"))
    print("화면", logo, C.frames_of(os.path.join(OUT, f"화면_{logo}.mp4")), "장")


def render(logo, voice, jobs=2):
    os.makedirs(PUB, exist_ok=True)
    for src, to in ((os.path.join(OUT, f"화면_{logo}.mp4"), os.path.join(PUB, "picture.mp4")), (os.path.join(OUT, f"소리_{voice}.wav"), os.path.join(PUB, "sound.wav")),
                    (os.path.join(OUT, f"timing_{voice}.json"), os.path.join(CAP, "src", "p10en", "timing.json"))):
        if not os.path.exists(to) or C.md5(src) != C.md5(to):
            shutil.copyfile(src, to)
    name = f"도담_영어_{logo}_{voice}"
    out, raw = os.path.join(OUT, name + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/p10en/entry.tsx", "p10en", raw, f"--concurrency={jobs}", "--log=error", cwd=CAP)
    want = E.F[-1] + CARD
    if C.frames_of(raw) != want:
        raise SystemExit(f"렌더가 {C.frames_of(raw)}장 — {want}장이어야 한다(P10en.tsx의 CARD를 맞춘다)")
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=240:-2,tile=12x11:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, name + "_반초.jpg"))
    print(out)


def stills(path, *secs):
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    src = path if os.path.isabs(path) else os.path.join(OUT, path)
    stem = os.path.splitext(os.path.basename(src))[0]
    for s in secs:
        n = int(round(float(s) * E.FPS))
        C.run("ffmpeg", "-y", "-v", "error", "-i", src, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", os.path.join(d, f"{stem}_t{float(s):05.2f}.png"))
    print(d)


if __name__ == "__main__":
    voice, logo, what = args()
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    for w in what:
        {"소리": lambda: sound(voice), "화면": lambda: picture(logo), "판": lambda: render(logo, voice)}[w]()
