# 10번 도담중공업 소리(2026-11-07 첫 판 · 11-08 다시, Claude) — 최종편집.py 「소리」가 부른다.
# 11-08 유호님 「전체적으로 음질이 너무 안좋아. 목소리도 기업느낌으로 희망적인 느낌이어야할것같아. 백그라운드 뮤직도 너무 안좋거든? 갑자기 뒤에서 자기 혼자 끊기고
#   그러니까 다시 bgm 만들고 나레이션은 자막도 넣어줘, 슬롭처럼 만들지마」로 곡 · 내레이션을 바꿨다(02_콘티 19절).
#   곡: 수노 v6로 새로 지은 연주곡 한 곡(572b8b0b — 피아노 → 현 → 38.25초 차오름 → 47.5초 관현악이 빠지고 피아노만 → 57.97초 마지막 화음)을 0초부터 이음 없이.
#       옛 판의 두 곡 이음 · 곡 안 건너뛰기 · 46.26~48.90초 모든 소리 끊김(원본 1:1)은 모두 뺐다. 크기는 곡이 지은 그대로 두고 내레이션 아래만 내린다.
#       곡 파일은 60.0초에 울리는 채로 잘려 있어(−31 dB에서 뚝) 59.25초부터 잦아들게 한다.
#   내레이션: 일레븐 v4 아이작(8번에서 고르신 목소리) — 원고 전체를 한 번에 구운 판(내레이션_후보.py)을 문장 사이 무음에서만 잘라 놓는다.
#       자를 자리는 받아쓰기(일레븐 Scribe) 낱말 시각 사이의 가장 조용한 곳, 놓는 자리는 첫 낱말이 시작하는 화면 초(NARR_AT).
#       P10_NARR=<이름>으로 다른 후보(애셔 · 헨리 · 에스엠)를 같은 자리에 놓아 견준다. 자막 시간표(remotion src/p10/timing.json)도 같은 시각에서 낸다.
#   효과음: 녹음 모음(Fairlight · Sonniss — 상업 이용 가능) + 판이 화면과 함께 낸 소리(19d 공회전 · 에어브레이크, 11n 라쳇, 24b 시험동 웅)
#       + 여기서 짠 소리(방 공기 · 터빈 돌기 시작 · 바람). MMAudio는 가중치가 비상업이라 쓰지 않는다.
import json
import os

import numpy as np
import scipy.signal as S

import 최종편집공통 as C
import 도담_끝로고 as END

RATE = C.RATE
SND = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10/소리"
SONG = os.path.join(SND, "곡_수노", "572b8b0b.wav")   # 48kHz 16bit 원본(받은 MP3는 19kHz 위를 잘라 냄 · 표본 어긋남 0)
NARR_DIR = os.path.join(SND, "내레이션후보")
# 11-08 3차 — 유호님 「초반이 너무 나레이션도없고 그냥 영상만 나와서 심심하고 맹해 … 초반에 나레이션이든 자막이든 cg든 넣어줘야할것같아」:
#   원본은 0~40초를 가사 있는 노래가 끌었는데 연주곡으로 바꾸며 그 층이 빠졌다 → 이야기를 내레이션이 처음부터 맡는 원고(내레이션_후보.py TEXT_OPEN · 02_콘티 21절).
#   아이작 판은 씨앗만 바꿔 넷을 구워 「오늘은」 뒤 쉼(0.48초)이 사는 b를 쓴다(첫 판은 「오늘은」을 끌어 0.08초 만에 「이」로 붙음).
NARR = os.environ.get("P10_NARR", "아이작_초반b")
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
FAIR = os.path.join(LIB, "fairlight", "Media Files")
SON = os.path.join(LIB, "sonniss_gdc2026", "풀림")
HERE = os.path.dirname(os.path.abspath(__file__))
TIMING = os.path.join(HERE, "..", "자막시안_20261103", "remotion", "src", "p10", "timing.json")
rng = np.random.default_rng(10)

# 내레이션 네 토막 — (첫 낱말을 놓을 화면 초, 그 아래 곡을 내릴 dB, 목소리 띠(250~4000 Hz)를 더 내릴 dB, 자막 글 목록)
#   자막은 한 화면에 한 문장, 마침표 · 쉼표 없음(슬롭 점검표 6번 — 11-08 Fable 「다섯 줄 모두 쉼표라 멋부림으로 읽힘」) — 토막 안 두 문장은 받아쓰기 낱말 자리에서 나눈다
NARR_AT = [
    (40.14, -7.5, -5.0, [("한 대를 만드는 데 3년", "3년"), ("볼트 하나도 그냥 넘어가지 않았습니다", "않았습니다")]),   # 25 · 26 · 27 — 관제실 · 시험(곡이 가장 큰 자리라 더 내림 — 첫 시험 목소리 띠 +6.6 dB)
    (49.20, -2.5, -1.5, [("오늘은", "오늘은")]),                                                                    # 31 — 아래에서 본 준호가 올려다보다 시선을 내림(옛 48.90은 30 끝 · 컷 경계 0.2초 앞)
    (50.50, -2.5, -1.5, [("이 아이를 보냅니다", "보냅니다")]),                                                       # 33 — 노을 발전소의 우리 터빈
    (56.08, -4.0, -2.0, [("어디서든 잘 돌아갑니다", "돌아갑니다")]),                                                # 37 — 송전탑 · 도시 불, 끝 음절 뒤 마지막 화음(57.97)
]
FINAL_CHORD = 57.97   # 곡 572b8b0b의 마지막 화음 — 그 앞에서 내림을 다 풀고, 로고(58.25)와 함께 조금 올린다(슬롭 점검표 2번 「마지막 한 방을 브랜드에」)
LIFT = {}             # 줄마다 목소리를 올릴 dB(자막 첫 글 → dB) — 곡이 큰 자리의 줄은 곡을 깊이 누르지 않고 목소리를 올려 세운다
FINISH_BOOST = 0.0    # 섞음 마감 리미터 앞 이득(dB) — 봉우리를 1로 맞춘 합을 이만큼 더 밀어 넣는다(Mix.finish의 boost_db)
DUCK_IN, DUCK_OUT = 0.30, 0.65   # 곡을 내리기 시작하는 때(첫 낱말 앞 초) · 다 푸는 때(끝 낱말 뒤 초)
BREATH_MIN, BREATH_KEEP = 99.0, 1.0   # 한 줄 안 낱말 사이 쉼이 BREATH_MIN초 넘으면 그 쉼에서는 내림을 BREATH_KEEP 몫만 둔다(쉼에서 곡이 꺼진 듯 들리지 않게)
PIECE_ENDS = ["않았습니다", "오늘은", "보냅니다"]   # 토막을 끊는 낱말(그 낱말 뒤 무음에서 자름)
# 「오늘은」 뒤 쉼이 없는 판(11-08 「밝게」 · 「힘있게」 — 0.06~0.08초)은 그 사이를 자르지 않고 「오늘은 이 아이를 보냅니다」를 한 덩이로 두고,
#   덩이 안 「이」가 33번 컷(50.42초) 바로 뒤에 오게 놓는다(다섯째 칸 = 놓는 기준 낱말). P10_LAYOUT=이어 또는 그 판을 고르면 이 짜임.
LAYOUT = os.environ.get("P10_LAYOUT", "이어" if NARR.endswith(("_밝게", "_힘있게")) else "쉼")
if LAYOUT == "이어":
    NARR_AT = [NARR_AT[0], (50.48, -2.5, -1.5, [("오늘은 이 아이를 보냅니다", "보냅니다")], "이"), NARR_AT[3]]
    PIECE_ENDS = ["않았습니다", "보냅니다"]
# 초반 원고(「_초반」 판) — 기 · 승 · 전 · 결로 아홉 자리. 「아이」라는 말은 50.5초까지 아끼고 25.5초 아기 표지 → 28.9초 「다 컸습니다」가 「이게 다 크면」을 받는다.
#   40초 줄(「한 대를 만드는 데 삼 년 · 볼트 …」)은 뺐다 — 40.1~45.5초에 말이 44.04초 첫 시동 소리를 덮었다(Fable · Opus 원고 맹검 둘 다).
#   곡 내림은 그 자리 곡 크기에 맞췄다(0~5초 피아노만은 얕게). 07:11 판까지 16~30초 현이 찬 자리를 깊게 누른 것은 아래 11-08 고침으로 바꿨다.
if "_초반" in NARR:
    NARR_AT = [
        (1.70, -4.5, -3.5, [("이게 다 크면 300톤 나갑니다", "나갑니다")]),         # 기 — 2 도면(1.63)에 「이게」, 5.5초 곡 큰 소리 앞에서 끝남
        (9.60, -4.5, -3.0, [("날개는 한 장씩 손으로 달아 줬습니다", "달아줬습니다")]),  # 승 — 8 날개 원
        (16.60, -3.5, -2.5, [("볼트 하나도 그냥 넘긴 적 없습니다", "없습니다")]),       # 승 — 12 작업대 → 13 덮개(14 이음매 볼트 딸깍 19.81초)
        (21.80, -4.5, -3.5, [("3년을 매일 들여다봤습니다", "들여다봤습니다")]),           # 승 — 16 터빈을 들여다보는 준호
        (28.90, -4.5, -3.5, [("다 컸습니다", "컸습니다")]),                              # 전 — 19 크레인이 물러나 트레일러 위 터빈 전체(28초 곡 부풂 뒤)
        (35.80, -4.5, -3.5, [("이제 처음으로 깨워 봅니다", "깨워봅니다")]),              # 전 — 23 시험동 입구 → 24, 39초 곡 꼭대기 앞에서 끝남
        #   내림 값은 목소리 띠(250~4000 Hz)에서 목소리가 곡보다 +10 dB 안팎 위에 서게 맞췄다(첫 값 −2.5 · −6 · −5는 +6.2 · +7.5 · +7.1로 묻혔다 — 40초 뒤 옛 줄은 +11~12)
        (49.20, -2.5, -1.5, [("오늘은", "오늘은")]),                                   # 결 — 31
        (50.50, -2.5, -1.5, [("이 아이를 보냅니다", "보냅니다")]),                       # 결 — 33 노을 발전소
        (56.08, -4.0, -2.0, [("어디서든 잘 돌아갑니다", "돌아갑니다")]),                # 결 — 37
    ]
    PIECE_ENDS = ["나갑니다", "달아줬습니다", "없습니다", "들여다봤습니다", "컸습니다", "깨워봅니다", "오늘은", "보냅니다"]
    LAYOUT = "초반"
    # 11-08 유호님 「백그라운드뮤직도 갑자기 끊겼다 다시 시작되는 느낌」(02_콘티 22절) — 07:11 판은 곡이 큰 자리의 줄을 깊게 눌렀다
    #   (「다 컸습니다」 −8 · 띠 −6, 「이제, 처음으로 깨워 봅니다」 −7.5 · 띠 −5.5 → 0.28초 만에 내려가 「이제,」 뒤 0.6초 쉼에서 섞음이 10.9 dB 꺼지고
    #   줄 끝에서 곡이 다시 솟았다). 목소리는 줄마다 −21~−23 dB로 고르니 작게 읽어서가 아니라 그 자리 곡이 커서 깊게 눌렀던 것이다.
    #   그래서 내림은 −4.5 · 띠 −3.5까지만 두고, 곡이 큰 두 줄은 목소리를 올리며, 0.55초 넘는 말 사이 쉼에서는 곡을 되살린다(내림 3분의 1만 둠).
    #   내리고 푸는 것도 느리게 했다(0.30 → 0.35초 앞에서 내리기 시작, 0.65 → 0.80초 뒤에 다 풂).
    LIFT = {"다 컸습니다": 4.0, "이제 처음으로 깨워 봅니다": 3.0}
    DUCK_IN, DUCK_OUT = 0.35, 0.80
    BREATH_MIN, BREATH_KEEP = 0.55, 1 / 3
    #   두 줄을 올리고 곡을 덜 누르니 목소리 · 곡이 겹친 자리 봉우리가 섞음 최고점이 되어, 마감(−14 LUFS)에서 봉우리가 −0.8 dBFS(문턱 −1.2)로 넘었다
    #   → 리미터 앞 이득을 FINISH_BOOST만큼 준다(봉우리 위 1 dB 남짓만 눌림).
    FINISH_BOOST = 1.0


# ---------- 거르개 · 크기(6번 최종소리.py와 같은 꼴)
def lp(x, hz, order=4):
    return S.sosfiltfilt(S.butter(order, hz, "low", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def hp(x, hz, order=2):
    return S.sosfiltfilt(S.butter(order, hz, "high", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def bp(x, lo, hi, order=2):
    return S.sosfiltfilt(S.butter(order, [lo, hi], "band", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def rms_db(x):
    m = x if x.ndim == 1 else x.mean(axis=1)
    n = int(0.05 * RATE)
    e = np.array([np.sqrt(np.mean(m[i:i + n] ** 2) + 1e-12) for i in range(0, max(1, len(m) - n), n)])
    db = 20 * np.log10(e + 1e-12)
    live = e[db > db.max() - 30]
    return float(20 * np.log10(np.sqrt(np.mean(live ** 2)) + 1e-12))


def to_rms(x, target_db):
    g = target_db - rms_db(x)
    if g > 45:
        raise SystemExit(f"to_rms: {g:.0f} dB를 키워야 한다 — 조각이 거의 무음이다(자리 · 파일 확인)")
    return (x * 10 ** (g / 20)).astype(np.float32)


def seg(path, a, b, stereo=False):
    x = C.load_stereo(path) if stereo else C.load(path)
    return x[int(a * RATE):int(b * RATE)].copy()


def fades(x, fin=0.01, fout=0.01):
    x = x.copy()
    n, m = int(fin * RATE), int(fout * RATE)
    w = (lambda k: np.linspace(0, 1, k)[:, None]) if x.ndim == 2 else (lambda k: np.linspace(0, 1, k))
    if n:
        x[:n] *= w(n)
    if m:
        x[-m:] *= w(m)[::-1]
    return x


def pink(seconds, seed=0):
    r = np.random.default_rng(seed)
    w = r.standard_normal(int(seconds * RATE))
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return S.lfilter(b, a, w).astype(np.float32)


def loop_to(x, seconds):
    n = int(seconds * RATE)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x] * int(np.ceil(n / len(x))), axis=0)[:n]


def tame(x, over_db=9.0, release=0.06, look=0.002):
    """봉우리만 누른다(앞보기 리미터) — 조각 RMS보다 over_db 넘는 봉우리를 그 선으로. 말머리 파열음 · 딸깍이 한 판 마감의 봉우리를 정했다(11-07 첫 판 +0.8 dBFS)"""
    from scipy.ndimage import minimum_filter1d
    a = np.abs(x) if x.ndim == 1 else np.abs(x).max(axis=1)
    thr = 10 ** ((rms_db(x) + over_db) / 20)
    g = np.minimum(1.0, thr / (a + 1e-9))
    g = minimum_filter1d(g, size=max(1, int(look * RATE)) * 2 + 1)
    k = np.exp(-1.0 / (release * RATE))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):   # 내려갈 때는 바로, 올라갈 때는 release로 천천히
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * k
        out[i] = cur
    return (x * (out if x.ndim == 1 else out[:, None])).astype(np.float32)


def envelope(t, pts):
    """(초, dB) 자국 사이를 직선으로 — t는 배열"""
    return 10 ** (np.interp(t, [p[0] for p in pts], [p[1] for p in pts]) / 20)


# ---------- 짠 소리
def room(seconds, seed, lp_hz=1200.0):
    # 큰 공장 안 공기 — 분홍 잡음을 낮게 거른다(디지털 무음 대신)
    return lp(hp(pink(seconds, seed), 50), lp_hz)


END_RING_DB, END_CLICK_DB, END_BOOM_DB = -34.0, -31.0, -24.0   # 끝 소리 크기 — 잔향(60.1~60.5초 기준) · 로고가 켜지는 쇠 딸깍 · 낮은 쿵


def hall_ir(seconds, rt60, seed=61):
    """긴 잔향(왼 · 오른 따로 — 잡음에 지수 감쇠, 150 Hz~5 kHz) — 곡 끝 화음을 곡이 끝난 뒤까지 잇는다. 에너지 1로 맞춘다"""
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    r = np.random.default_rng(seed)
    x = (r.standard_normal((n, 2)) * (10 ** (-3 * t / rt60))[:, None]).astype(np.float32)
    x = lp(hp(x, 150), 5000)
    return x / np.sqrt(np.sum(x ** 2, axis=0, keepdims=True))


def wet(x, ir):
    return np.stack([S.fftconvolve(x[:, c], ir[:, c]) for c in range(2)], axis=1).astype(np.float32)


def turbine_spool(seconds):
    """터빈이 돌기 시작한다 — 낮은 웅(축 회전)이 올라가고, 날개 지나감 소리(축의 24배)와 공기 흐름이 뒤따른다."""
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    k = np.clip(t / seconds, 0, 1)
    f0 = 22 + 70 * k ** 1.6                                   # 축 회전 22 → 92 Hz
    ph = 2 * np.pi * np.cumsum(f0) / RATE
    hum = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * (0.25 + 0.75 * k)
    whine = (np.sin(24 * ph) * 0.18 + np.sin(48 * ph) * 0.05) * np.clip((k - 0.25) / 0.75, 0, 1) ** 1.5
    air = bp(pink(seconds, 77), 250, 3500) * (0.1 + 0.9 * k ** 1.3)
    air = air / (np.std(air) + 1e-9) * 0.35
    rumble = lp(hp(pink(seconds, 78), 35), 140)
    rumble = rumble / (np.std(rumble) + 1e-9) * 0.32 * (0.3 + 0.7 * k)   # 11-08 0.5 → 0.32(−4 dB) — 곡 저음과 겹쳐 아르곤 「저음이 뭉개져 먹먹」(44~45초)
    x = hum * 0.6 + whine + air + rumble
    return (x * np.minimum(1, t / 0.6)).astype(np.float32)


# ---------- 내레이션
def narration(name=NARR):
    """한 번에 구운 판을 토막으로 — [(판 a초, 판 b초, 첫 소리 판 초, 놓을 화면 초, 곡 dB, 띠 dB, 첫 낱말 판 초, [(쉼 판 시작초, 끝초)…], [(자막 글, 판 시작초, 판 끝초)…])]
    쉼은 토막 안 낱말 사이가 BREATH_MIN초 넘는 곳"""
    x = C.load(os.path.join(NARR_DIR, name + ".mp3"))
    words = [w for w in json.load(open(os.path.join(NARR_DIR, name + "_받아쓰기.json"), encoding="utf-8"))["words"] if w.get("type") == "word"]
    n20 = int(0.02 * RATE)
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + n20] ** 2)) + 1e-9) for i in range(0, len(x) - n20, n20)])

    def quietest(a, b):          # a~b초 사이 가장 조용한 20ms 창의 가운데
        i, j = int(a / 0.02), max(int(a / 0.02) + 1, int(b / 0.02))
        return (i + int(np.argmin(db[i:j]))) * 0.02 + 0.01

    def word_idx(stem, after=0):
        for k in range(after, len(words)):
            if words[k]["text"].strip(" .,").startswith(stem):
                return k
        raise SystemExit(f"내레이션 {name}: 받아쓰기에 「{stem}」이 없다 — {[w['text'] for w in words]}")

    cuts, k = [0.0], 0
    for stem in PIECE_ENDS:
        k = word_idx(stem, k)
        cuts.append(quietest(words[k]["end"], words[k + 1]["start"]))
        k += 1
    cuts.append(len(x) / RATE)
    # 놓는 기준은 토막 첫 낱말의 받아쓰기 시작(앞 숨소리는 토막에 남기되 기준으로 삼지 않는다 — 11-08 첫 시험에서 숨에 맞춰 0.16초 늦게 놓임)
    #   다섯째 칸(기준 낱말)이 있으면 그 낱말이 놓는 초에 온다(「이어」 짜임의 「이」).
    out, k0 = [], 0
    for p, entry in enumerate(NARR_AT):
        at, duck, mid, subs = entry[:4]
        a, b = cuts[p], cuts[p + 1]
        first = words[k0]["start"]
        on = words[word_idx(entry[4], k0)]["start"] if len(entry) > 4 else first
        lines, k1 = [], k0
        for text, last in subs:
            kk = word_idx(last, k0)
            lines.append((text, words[k0]["start"], words[kk]["end"]))
            k0 = kk + 1
        gaps = [(words[i]["end"], words[i + 1]["start"]) for i in range(k1, k0 - 1) if words[i + 1]["start"] - words[i]["end"] > BREATH_MIN]
        out.append((a, b, on, at, duck, mid, first, gaps, lines))
    return x, out


def subtitle_timing(pieces, TF):
    """자막 화면마다 (뜨는 초, 지는 초, 글) — 드라마 자막 규칙(한 화면 1.5초 이상 · 다음 화면과 겹치지 않음 · 소리 끝 뒤 꼬리)
    + 컷 경계: 뜨는 때가 경계 3장(0.125초) 안이면 경계에, 지는 때가 경계 0.6초 앞이면 경계 2장 앞까지 늘린다(경계에 걸쳐 1~2장 남지 않게)"""
    cuts = list(TF[1:-1])
    raw = []
    for a, b, on, at, *_rest, lines in pieces:
        shift = at - on
        for text, s, e in lines:
            raw.append([s + shift - 0.06, e + shift, text])   # 목소리보다 0.06초 먼저 뜬다
    for r in raw:
        near = [c for c in cuts if abs(c - r[0]) <= 0.125]
        if near:
            r[0] = near[0]
    # 0.9초를 못 채우는 화면만 뒤 화면과 한 줄로 묶는다(넷플릭스 최소 5/6초). 첫 판은 1.5초 문턱으로 「오늘은,」(1.18초)을 「이 아이를 보냅니다」와 한 줄로 묶고
    #   뒷부분만 이어 띄웠는데, 11-08 Fable · 아르곤 둘 다 「앞 토막이 가운데에서 비켜 1.3초 떠 있어 정렬 실수 · 시선 분산」으로 짚어 따로 띄운다
    merged, i = [], 0
    while i < len(raw):
        r = raw[i]
        if i + 1 < len(raw) and raw[i + 1][0] - 0.12 - r[0] < 0.9:
            n = raw[i + 1]
            merged.append([r[0], n[1], r[2] + " " + n[2], [(r[2], r[0]), (" " + n[2], n[0])]])
            i += 2
        else:
            merged.append(r + [None])
            i += 1
    for i, r in enumerate(merged):
        want = max(r[1] + 0.35, r[0] + 1.6)   # 짧은 줄도 1.6초는 둔다(「다 컸습니다」 — 11-08 밤 19번 경계가 31.03초로 밀려 경계 맞춤이 안 걸리면 1.2초만에 사라졌다. 원래 값 1.2)
        nxt = merged[i + 1][0] - 0.12 if i + 1 < len(merged) else min(want, END.LOCK_T + 0.02)   # 끝 줄은 로고가 다 켜지기 전에 진다(한 화면에 글자 갈래 하나 — 폰트 정본 §10-4)
        b = min(want, nxt)
        after = [c for c in cuts if b < c <= b + 0.6 and c - 2 / 24 <= nxt]
        if after:
            b = after[0] - 2 / 24
        r[0], r[1] = round(r[0], 3), round(b, 3)
    return merged


# ---------- 놓기
class Mix(C.Mix):
    pass


def build(out_wav, TF, timing_path=TIMING):
    total = TF[-1]
    m = Mix(total + 0.5)

    # ===== 내레이션 — 한 판 전체를 한 크기로 맞춘 뒤 토막으로(토막마다 크기를 따로 맞추지 않아 말의 높낮이가 그대로)
    vx, pieces = narration()
    vx = tame(hp(to_rms(vx, -17.0), 70), 7.0)
    spans = []
    for a, b, on, at, duck, mid, first, gaps, lines in pieces:
        # 올리는 줄은 봉우리 누르기(tame) 뒤에 올린다 — 앞에서 올리면 tame이 거의 다 도로 눌러 「이제, …」는 +3 dB가 +0.6 dB만 남았다
        piece = fades(vx[int(a * RATE):int(b * RATE)], 0.01, 0.06) * np.float32(10 ** (LIFT.get(lines[0][0], 0.0) / 20))
        t0 = at - (on - a)
        m.put(t0, piece, 0, fade=0.0)
        spans.append((at - (on - first), at + (lines[-1][2] - on), duck, mid, [(at - on + g0, at - on + g1) for g0, g1 in gaps]))
        print(f"내레이션 {NARR}({LAYOUT}) 판 {a:.2f}–{b:.2f}초 → 화면 {t0:.2f}초(첫 낱말 {at - (on - first):.2f}) · " + " / ".join(f"{s} {e:.2f}" for s, _a, e in lines))
    if timing_path:
        subs = subtitle_timing(pieces, TF)
        os.makedirs(os.path.dirname(timing_path), exist_ok=True)
        lines = []
        for a, b, s, parts in subs:
            d = {"a": a, "b": b, "s": s}
            if parts:
                d["parts"] = [{"s": ps, "a": round(pa, 3)} for ps, pa in parts]
            lines.append(d)
        json.dump({"narr": NARR, "frames": int(round(TF[-1] * 24)), "lines": lines}, open(timing_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("자막", " · ".join(f"{a:.2f}–{b:.2f} {s}" + (f" (뒷부분 {parts[1][1]:.2f})" if parts else "") for a, b, s, parts in subs))

    # ===== 곡 — 수노 572b8b0b 한 곡을 0초부터(곡 시각 = 화면 시각). 내레이션 아래만 내리고(첫 낱말 DUCK_IN초 앞부터 · 끝 낱말 DUCK_OUT초 뒤까지), 목소리 띠는 조금 더 비운다
    song = C.load_stereo(SONG)[:int(total * RATE)]
    t = np.arange(len(song)) / RATE
    g_all = np.ones(len(song), np.float32)
    g_mid = np.ones(len(song), np.float32)
    duck_spans = []   # 1.2초보다 가까운 내레이션은 한 번에 내린다(「오늘은,」 · 「이 아이를 보냅니다」 사이 0.9초에 곡이 올랐다 내려 출렁이지 않게)
    for s, e, duck, mid, gaps in spans:
        if duck_spans and s - duck_spans[-1][1] < 1.2:
            ps, pe, pd, pm, pg = duck_spans[-1]
            duck_spans[-1] = (ps, e, min(pd, duck), min(pm, mid), pg + gaps)
        else:
            duck_spans.append((s, e, duck, mid, gaps))
    for s, e, duck, mid, gaps in duck_spans:
        for g, d in ((g_all, duck), (g_mid, mid)):
            body = [(s - 0.02, d)]
            for g0, g1 in gaps:   # 말 사이 긴 쉼 — 낱말이 끝나고 0.08초 뒤부터 0.15초에 걸쳐 내림을 BREATH_KEEP 몫으로, 다음 낱말 0.08초 앞에 다시 다 내림
                r = min(0.15, (g1 - g0 - 0.16) / 2)
                if r >= 0.08:
                    body += [(g0 + 0.08, d), (g0 + 0.08 + r, d * BREATH_KEEP), (g1 - 0.08 - r, d * BREATH_KEEP), (g1 - 0.08, d)]
            if s < FINAL_CHORD < e + DUCK_OUT:   # 마지막 줄 — 화음 앞에서 다 푼다(첫 판은 57.86~58.41초에 풀려 화음 어택이 눌렸다)
                pts = [(0.0, 0.0), (s - DUCK_IN, 0.0)] + body + [(e + 0.04, d), (FINAL_CHORD - 0.03, 0.0), (total + 1, 0.0)]
            else:
                pts = [(0.0, 0.0), (s - DUCK_IN, 0.0)] + body + [(e + 0.10, d), (e + DUCK_OUT, 0.0), (total + 1, 0.0)]
            g *= envelope(t, pts).astype(np.float32)
    # 마지막 화음 +4 dB(로고와 함께) — +2.5 dB에서는 화음 · 로고 구간(57.97~59.0초)이 앞 내레이션 구간보다 2.4 dB 작았다(슬롭 점검표 2번 「끝 소리를 앞 소리와 RMS로 대고」)
    g_all *= envelope(t, [(0.0, 0.0), (FINAL_CHORD - 0.05, 0.0), (FINAL_CHORD + 0.05, 4.0), (59.40, 4.0), (59.90, 0.0), (total + 1, 0.0)]).astype(np.float32)
    tail = np.clip((60.0 - t) / 0.75, 0, 1)            # 59.25초부터 잦아듦(파일이 60.0초에 울리는 채로 잘림) — 그 뒤는 아래 잔향이 잇는다
    g_all *= (0.5 - 0.5 * np.cos(np.pi * tail)).astype(np.float32)
    mid_band = bp(song, 250, 4000)
    song = song * g_all[:, None] - mid_band * ((1 - g_mid) * g_all)[:, None]
    song = fades(song.astype(np.float32), 0.01, 0.0)
    lvl = rms_db(C.load_stereo(SONG))                    # 곡 전체 크기 기준(내림 전) — 곡이 지은 크기 흐름을 그대로 둔다
    song = (song * 10 ** ((-23.0 - lvl) / 20)).astype(np.float32)
    m.put(0.0, song, 0, fade=0.0)
    for s, e, *_ in spans:   # 확인용 — 목소리 대 그 아래 곡(목소리 띠 250~4000 Hz)
        i, j = int(s * RATE), int(e * RATE)
        v = m.a[i:j].mean(axis=1) - song[i:j].mean(axis=1)
        vb, sb = bp(v, 250, 4000), bp(song[i:j].mean(axis=1), 250, 4000)
        print(f"  {s:.2f}–{e:.2f}초 목소리 {20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-9):.1f} · 곡 {20 * np.log10(np.sqrt(np.mean(song[i:j] ** 2)) + 1e-9):.1f} dB"
              f" · 목소리 띠에서 목소리 − 곡 {20 * np.log10(np.sqrt(np.mean(vb ** 2)) / (np.sqrt(np.mean(sb ** 2)) + 1e-9)):+.1f} dB")

    # ===== 바탕 소리 — 컷마다(컷 뒤 0.06초 꼬리)
    def bed(a, b, x, level, pre=0.0, post=0.06):
        x = loop_to(x, b - a + pre + post + 0.01)
        x = fades(to_rms(x, level), max(0.03, pre), post)
        m.put(a - pre, x, 0, fade=0.002)

    # 실내(0~25.5초) — 공장 안 공기, 아주 낮게
    bed(0.0, TF[18], room(TF[18] + 0.2, 1, 900), -50)
    # 19 바깥 마당 — 판이 낸 공회전 · 4.75초 에어브레이크(화면과 같은 판). 60 Hz 아래를 깎는다(11-08 아르곤 「저음이 먹먹하게 뭉개짐」 — 곡 저음과 겹침)
    #   20 운전석으로 넘어갈 때 엔진은 끊지 않고 0.5초 동안 이어 빠지며 0.35초에 걸쳐 먹먹해진다(900 Hz 아래) — 같은 트럭 안으로 들어가는 소리(첫 판은 컷에서 0.08초에 꺼져 「푹 꺼지며 튄다」)
    eng_all = hp(C.load_stereo(C.clip("p10-19d")), 60)
    nmain = int((TF[19] - TF[18]) * RATE)
    eng = eng_all[:nmain + int(0.05 * RATE)]
    eng_lvl = 10 ** ((-30 - rms_db(eng)) / 20)
    m.put(TF[18], (tame(fades(lp(eng, 7000), 0.25, 0.08), 10.0) * eng_lvl).astype(np.float32), 0, fade=0.0)
    eng_tail = eng_all[nmain:nmain + int(0.5 * RATE)]
    if len(eng_tail) > int(0.1 * RATE):
        # 꼬리는 바깥 소리(7 kHz 아래)에서 0.35초에 걸쳐 운전석 안 먹먹한 소리(900 Hz 아래)로 넘긴다 — 19 판 에어브레이크 치익(30.29초에 솟아
        #   컷 뒤 0.5초에 걸쳐 잦아듦)을 컷에서 900 Hz로 바로 자르니 고음(2~8 kHz)이 컷에서 50ms 만에 −34 → −42 dB로 꺼졌다(11-08 「갑자기 끊겼다 다시 시작」 · 22절)
        k = np.clip(np.arange(len(eng_tail)) / (0.35 * RATE), 0, 1).astype(np.float32)[:, None]
        tail = lp(eng_tail, 7000) * (1 - k) + lp(eng_tail, 900) * k
        m.put(TF[19], (fades(tail, 0.06, len(eng_tail) / RATE * 0.9) * eng_lvl * 0.7).astype(np.float32), 0, fade=0.0)
    # 20 운전석 — 차 안 웅(길 소음 낮춤), 0.3초에 걸쳐 들어온다
    cab = lp(seg(os.path.join(SON, "InMotionAudio - Car Interior Driving Ambience", "VEHCar_TownDrivingAmbience06_InMotionAudio_CarInteriorDrivingAmbience.wav"), 8, 12, True), 900)
    bed(TF[19], TF[20], tame(cab, 8.0), -33, pre=0.3)
    # 21 창밖 거울 — 바람
    wind_all = seg(os.path.join(SON, "InMotionAudio - Chimney Wind", "WINDInt_ChimneyWind05_InMotionAudio_ChimneyWind.wav"), 0, 110, True)
    W_ = lambda a, b, hz: lp(wind_all[int(a * RATE):int(b * RATE)], hz)   # 바람 녹음(115초)의 구간마다 다른 결
    bed(TF[20], TF[21], W_(30, 40, 2500), -36)
    # 22~23 한낮 바깥 — 낮은 바람
    bed(TF[21], TF[23], W_(40, 50, 1200), -44)
    # 24~28 시험동 · 관제실 — 판이 낸 시험동 웅(24b)을 늘여 깜. 28 → 29(46.0초, 조립동 손바닥)에서 0.7초에 걸쳐 빠진다(옛 판은 46.26초에 모든 소리가 끊김)
    hum = lp(C.load_stereo(C.clip("p10-24b")), 900)
    bed(TF[22], TF[28] + 0.7, hum, -42, pre=0.0, post=0.7)
    # 29~32 조립동 — 손바닥 · 다 만든 터빈 앞(방 공기, 아주 낮게)
    bed(TF[28], TF[32], room(TF[32] - TF[28] + 1.0, 9, 800), -52, pre=0.4, post=0.4)
    # 33 노을 터빈동 · 34~37 바깥 해 질 녘 — 낮은 바람, 37은 높은 데 바람과 먼 도시
    bed(TF[32], TF[33], W_(60, 66, 1400), -46, pre=0.3)
    bed(TF[33], TF[36], W_(70, 78, 1800), -44)
    city = lp(seg(os.path.join(FAIR, "Ext City Ambience, Car Drive-Bys, Pedestrian, Air.wav"), 20, 26, True), 1500)
    bed(TF[36], total - 0.6, hp((W_(85, 91, 2200)[:len(city)] * 0.8 + city * 0.6).astype(np.float32), 220), -42, pre=0.1, post=0.55)   # 로고가 어두워질 때 함께 빠져 파일 끝 0.05초 앞에 0(11-09 Fable — post가 끝을 넘어 −32 dB에서 잘렸다). 220 Hz 아래를 깎는다 — 저음만 남으면 곡이 끝난 뒤 폰에서 무음이다(11-08 Fable)

    # ===== 사건 소리(화면 장에 맞춤) — 곡보다 9 dB 넘게 아래로 묻힌 것(종이 · 첫 렌치 · 라쳇 · 크레인 · 트럭 · 운전석)은 3~4 dB 올렸다(11-07 효과음 대 곡 실측)
    # 2 도면 — 종이 스침
    paper = seg(os.path.join(FAIR, "Paper Handle Airline Tickets.M.wav"), 0.6, 1.4)
    m.put(TF[1] + 0.10, to_rms(lp(paper, 7000), -41), 0, fade=0.01, fade_out=0.25)
    # 3 바닥 불꽃 — 튀는 소리(컷 0.1초 앞에서). 11-07 밤: 5 kHz 위 비율이 앞뒤보다 15 dB 많아 지지직이 튀었다 → 6.5 kHz 위를 깎고 2 dB 내림
    spark = seg(os.path.join(FAIR, "Sparklers Whoosh Popping.M.wav"), 6.0, 6.8)
    m.put(TF[2] - 0.10, to_rms(tame(lp(hp(spark, 900), 6500), 9.0), -36), 0, fade=0.03, fade_out=0.15)
    # 4~6 용접 — 아크가 켜지는 장(판 19장 = 컷 4장 → 화면 TF[3] + 4/24)부터 컷 7 앞까지 실제 녹음 한 줄기(불꽃 지글거림 + 낮은 전기 웅).
    #   11-07 밤 유호님 「소리가 너무 튀는데 잘못 효과음을 입혔던지 지지직이 너무 심한데」 — 전기 스파크용 디자인 소리(ArcDesign15, −29)가
    #   고음 비율 −10 dB · 이 편 가장 높은 봉우리 −2.0 dBFS로 튀었다. 그 소리를 빼고, 켜질 때 0.35초만 3 dB 올린다.
    t_arc = TF[3] + 4 / 24
    span = TF[6] - t_arc + 0.05
    nw = int(span * RATE)
    buzz = lp(bp(seg(os.path.join(SON, "InMotionAudio - Arc", "ELECBuzz_Buzz27_InMotionAudio_Arc.wav"), 1.0, 1.1 + span), 120, 6000), 3500)
    sizzle = lp(bp(seg(os.path.join(FAIR, "Sparklers Sizzle Stamp.M.wav"), 3.0, 3.1 + span), 500, 9000), 6500)
    weld = (to_rms(loop_to(buzz, span), -42) + to_rms(loop_to(sizzle, span), -38))[:nw]
    weld = tame((weld * envelope(np.arange(nw) / RATE, [(0.0, 3.0), (0.35, 3.0), (0.7, 0.0), (span, 0.0)])).astype(np.float32), 8.0)
    m.put(t_arc - 0.01, fades(weld, 0.04, 0.3), 0, fade=0.0)
    # 7 렌치 — 07n(30장부터)에서 손이 렌치를 빠르게 두 번 돌리는 장(31 · 42장 → 컷 0.04 · 0.50초, 장마다 확대해 봄)
    bolt = seg(os.path.join(FAIR, "Metal Bolts.M.wav"), 0.0, 1.2)
    m.put(TF[6] + 1 / 24, to_rms(bolt[:int(0.45 * RATE)], -37), 0, fade=0.003, fade_out=0.1)
    m.put(TF[6] + 12 / 24, to_rms(bolt[int(0.5 * RATE):], -40), 0, fade=0.003, fade_out=0.1)
    # 10 조립동 와이드 — 천장 크레인 모터(멀리)
    crane = lp(seg(os.path.join(SON, "Victor Ermakov - Industrial Ambiences - Ship Repair Factory", "MACHInd_Crane Onboard Ride Squeaks Motors_CW.wav"), 20, 23, True), 1500)
    bed(TF[9], TF[10], crane, -38, pre=0.1)
    # 11 라쳇 — 화면에서 안전모가 끄덕이는 당김 박(p10-11n 30장부터 32 · 40 · 48 · 56 · 64장 = 컷 0.08 · 0.42 · 0.75 · 1.08 · 1.42초)에 쇠 딸깍 둘씩.
    #   11-08까지는 판이 낸 소리를 썼는데, 딸깍이 아니라 내내 고른 −31 dB 쉬익 잡음이었다(5 kHz 위 몫이 앞뒤 컷보다 20~30 dB 많음 —
    #   곡이 잦아드는 15~16.5초에 드러나 아르곤 「날카롭게 튀고 찢어지는 듯」). 판 소리는 빼고 Fairlight Metal Bolts의 작은 딸깍 쌍을 번갈아 놓는다
    bolts = C.load(os.path.join(FAIR, "Metal Bolts.M.wav"))
    clicks = [(0.20, 0.40), (0.46, 0.66), (0.83, 1.03)]
    for k, t11 in enumerate((2, 10, 18, 26, 34)):
        a_, b_ = clicks[k % len(clicks)]
        c = fades(hp(bolts[int(a_ * RATE):int(b_ * RATE)], 300), 0.003, 0.05)
        m.put(TF[10] + t11 / 24 - 0.02, to_rms(c, -38 if k % 2 == 0 else -40), 0, fade=0.0)
    # 12 작업대 — 12n(0장부터)은 판 소리가 꺼진 판이라 녹음 모음으로: 줄질하는 작업대 공구 소리 낮게 + 날개 든 동료가 들어오는 컷 1.45초부터 발소리
    tools = lp(seg(os.path.join(FAIR, "Tool Box Rummage.M.wav"), 0.5, 2.6), 5000)
    m.put(TF[11] + 0.05, to_rms(tools, -45), 0, fade=0.06, fade_out=0.3)
    steps = lp(seg(os.path.join(FAIR, "BG Footsteps Concrete.wav"), 4.0, 4.7), 5000)
    m.put(TF[11] + 1.45, to_rms(steps, -43), 0, fade=0.05, fade_out=0.2)
    # 13 덮개를 받친 작업자 — 고쳐 잡고 밀어 올림(컷 0.25초부터): 낮은 쇠 삐걱
    creak = lp(seg(os.path.join(FAIR, "Metal Door Creaks and Groans.M.wav"), 0.2, 1.1), 2500)
    m.put(TF[12] + 0.20, to_rms(creak, -45), 0, fade=0.08, fade_out=0.3)
    # 14 이음매 볼트
    m.put(TF[13] + 0.62, to_rms(bolt[int(0.5 * RATE):], -41), 0, fade=0.003, fade_out=0.1)
    # 22 시험대 틀 — 사슬
    chain = seg(os.path.join(FAIR, "Metal Chains Movement.M.wav"), 1.0, 2.2)
    m.put(TF[21] + 0.15, to_rms(lp(chain, 6000), -40), 0, fade=0.02, fade_out=0.3)
    # 26 관제실 레버(손이 미는 자리)
    click = seg(os.path.join(SON, "Epic Stock Media - HD Lock And Mechanism Sound Design Kit", "MECHLtch_Click Deep Mechanism Latch Button Nearfield Thunk 02_ESM_HDLM.wav"), 0.0, 0.378)
    m.put(TF[25] + 0.55, to_rms(tame(click, 10.0), -31), 0, fade=0.002, fade_out=0.05)
    # 27~28 터빈이 돌기 시작 → 29(46.0초)로 넘어가며 0.7초에 걸쳐 빠짐(옛 판은 46.26초에 칼같이 끊음 — 11-08 「갑자기 … 끊기고」)
    t0 = TF[26] + 0.05
    spool = turbine_spool(TF[28] + 0.7 - t0)
    m.put(t0, fades(to_rms(spool, -35), 0.4, 0.7), 0, fade=0.0)
    # 29 손바닥 — 몸통에 댄 손이 살짝 옮겨 감(29n 12장부터): 손과 칠한 쇠가 스치는 소리, 아주 작게
    palm = lp(hp(seg(os.path.join(FAIR, "Hand to Metal or Brass.M.wav"), 0.0, 1.0), 200), 6000)
    m.put(TF[28] + 0.08, to_rms(palm, -44), 0, fade=0.03, fade_out=0.35)
    # 34 걸어 나오는 세 사람 — 발소리
    fs = seg(os.path.join(FAIR, "BG Footsteps Concrete.wav"), 10.0, 11.6)
    m.put(TF[33] + 0.05, to_rms(lp(fs, 6000), -42), 0, fade=0.05, fade_out=0.2)

    # ===== 끝 — 곡 파일은 60.0초에 끝나고 로고는 그 뒤 2초 남는다. 마지막 화음을 잔향으로 이어 로고 위에서 잦아들게 하고(로고가 어두워질 때 함께 빠짐),
    #   로고가 다 켜지는 장(곡의 마지막 화음이 들어오는 58.0초)에 쇠 딸깍(26번 레버와 같은 소리) + 낮은 쿵을 얹는다 — 슬롭 점검표 2번 「마지막 한 방을 브랜드에」. 끝은 디지털 무음이 아니라 바깥 공기
    tl = END.LOCK_T
    raw_song = C.load_stereo(SONG) * 10 ** ((-23.0 - lvl) / 20)
    ring = wet(raw_song[int(FINAL_CHORD * RATE):int(59.7 * RATE)], hall_ir(5.0, 3.4))
    at = int((60.1 - FINAL_CHORD) * RATE)
    ring = (ring * 10 ** ((END_RING_DB - rms_db(ring[at:at + int(0.4 * RATE)])) / 20))[:int((total - FINAL_CHORD) * RATE)]
    m.put(FINAL_CHORD, fades(ring.astype(np.float32), 0.05, 1.2), 0, fade=0.0)
    m.put(tl, to_rms(tame(click, 10.0), END_CLICK_DB), 0, fade=0.002, fade_out=0.05)
    nb = int(1.6 * RATE)
    tb = np.arange(nb) / RATE
    boom = (np.sin(2 * np.pi * np.cumsum(46 + 44 * np.exp(-tb / 0.05)) / RATE) * np.exp(-tb / 0.32)        # 몸통 — 음높이가 빠르게 떨어져야 그 장에 바로 들린다(46 + 10은 0.1초 넘게 굴러 들어왔다)
            + 0.30 * np.sin(2 * np.pi * 118 * tb) * np.exp(-tb / 0.16)) * np.minimum(1, tb / 0.004)      # 작은 스피커에서도 들리게 118 Hz
    m.put(tl, (boom * 10 ** (END_BOOM_DB / 20)).astype(np.float32), 0, fade=0.0)

    nf = int(0.08 * RATE)                    # 마지막 0.08초는 무엇이 남았든 0으로
    i_end = int(total * RATE)
    m.a[i_end - nf:i_end] *= np.linspace(1, 0, nf, dtype=np.float32)[:, None]
    m.a[i_end:] = 0
    m.finish(out_wav, boost_db=FINISH_BOOST)
    print("소리", out_wav)
