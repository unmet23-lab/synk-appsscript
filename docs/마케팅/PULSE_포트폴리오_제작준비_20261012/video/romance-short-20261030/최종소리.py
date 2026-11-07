# 로맨스 「다 비침」 소리(2026-11-07, Claude) — 최종편집.py 「소리」가 부른다. 02_콘티 5절 소리 설계를 받은 판 · 화면 시각에 맞춰 놓는다.
#   대사: 판이 낸 시댄스 목소리(허깅페이스 BS-RoFormer로 뗀 소리, C25 · C52는 그 떼기가 바탕으로 넘겨 로컬 Demucs). 입이 보이는 줄은 판 시각 그대로(sync),
#     화면 밖 줄은 자리를 옮김(at). 줄 자리는 뗀 목소리의 소리 덩어리(봉우리 −26 dB 위)로 잼.
#   속말 다섯: 배역 목소리 견본을 넣어 시댄스가 말하게 한 「말 판」 넷(rs-말-태준-1~3 · rs-말-유나-1)의 소리만 — 6번과 같은 길, Demucs로 뗌.
#   곡: 허깅페이스 stable-audio-3 연주곡(곡후보.py) — Gemini 소리 맹검으로 고름: 남자 쪽 주제 첼로_a(9점) · 여자 쪽 주제 바이올린_b(8.5, 허밍이 섞여
#     「같은 노래를 다른 목소리로」에 맞음) · 피아노 동기 피아노_a(8). 노래(가사)는 11-07 길이 다 막혀 악기로 옮김(곡후보.py 머리말).
#   바탕 · 사건 소리: 녹음 모음(Fairlight · Sonniss — 상업 이용 가능), 모음에 없는 엘리베이터 웅 · 띵 · 버튼은 여기서 짠다.
# 줄마다 놓은 시각은 자막이 같이 쓰도록 remotion/src/rs/timing.json으로 낸다.
import json
import os

import numpy as np
import scipy.signal as S

import 최종편집공통 as C

RATE = C.RATE
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/rs/소리"
VOX = os.path.join(ROOT, "목소리")
INNER = os.path.join(ROOT, "속말")
MUS = os.path.join(ROOT, "곡_스테이블")
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
FAIR = os.path.join(LIB, "fairlight", "Media Files")
SON = os.path.join(LIB, "sonniss_gdc2026", "풀림")
RAIN_CITY = os.path.join(SON, "The Noisery - City Rain", "RAINConc_Rain Medium Exterior Splatter City Traffic 6_The Noisery_City Rain.wav")
RAIN_WIN = os.path.join(SON, "Jake Fielding - Interior Wind Rain and Storms", "RAINInt_Heavy Rain on Window,  Constant _JF_INT Storm.wav")
RAIN_CARS = os.path.join(FAIR, "Light Rain Wet Car Bys.wav")
DRIPS = os.path.join(FAIR, "Water Drips Drops.M.wav")
PUB = os.path.join(SON, "Sonic Bat - Bars & Restaurants Ambience", "SBbra_Bar E 001.wav")
FRIDGE = os.path.join(SON, "Jake Fielding - Fridge Hums Vol.2", "MACHAppl_Deep Fridge Hum, Buzz, Electric Tone, Deep_Jake Fielding_Fridge Hums Pt2.wav")
TYPING = os.path.join(FAIR, "Laptop Keyboard Typing 1.wav")
AFTER = os.path.join(SON, "Epic Stock Media - Public Spaces - Urban Life Exteriors", "AMBTown_City Courtyard Calm Street Distant Traffic Children Playing 03_ESM_CPS.wav")
UMBRELLA = os.path.join(FAIR, "Umbrella Movement.M.wav")
SPLASH = os.path.join(FAIR, "Water Splashing 2.M.wav")
SPLASH_L = os.path.join(FAIR, "Water Light Splashing.M.wav")
PUDDLE = os.path.join(FAIR, "FS, Walking Through Water Puddles.wav")
POUR = os.path.join(FAIR, "Bottle Up Pour Down.M.wav")
rng = np.random.default_rng(23)


# ---------- 거르개 · 울림(6번 최종소리.py와 같은 꼴) ----------
def lp(x, hz, order=4):
    return S.sosfiltfilt(S.butter(order, hz, "low", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def hp(x, hz, order=2):
    return S.sosfiltfilt(S.butter(order, hz, "high", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def bp(x, lo, hi, order=2):
    return S.sosfiltfilt(S.butter(order, [lo, hi], "band", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def reverb(x, rt60, wet_db, tone=5000.0, pre=0.012, seed=1):
    mono = x if x.ndim == 1 else x.mean(axis=1)
    n = int(rt60 * RATE)
    t = np.arange(n) / RATE
    r = np.random.default_rng(seed)
    outs = []
    for c in range(2):
        ir = r.standard_normal(n) * np.exp(-6.9 * t / rt60)
        ir = S.sosfiltfilt(S.butter(2, tone, "low", fs=RATE, output="sos"), ir)
        ir = np.concatenate([np.zeros(int(pre * RATE)), ir])
        outs.append(S.fftconvolve(mono, ir)[: len(mono) + n])
    wet = np.stack(outs, axis=1).astype(np.float32)
    dry = np.stack([mono, mono], axis=1)
    dry = np.pad(dry, ((0, len(wet) - len(dry)), (0, 0)))
    k = (np.sqrt(np.mean(dry ** 2)) + 1e-9) / (np.sqrt(np.mean(wet ** 2)) + 1e-9) * 10 ** (wet_db / 20)
    return (dry + wet * k).astype(np.float32)


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
        raise SystemExit(f"to_rms: {g:.0f} dB를 키워야 한다 — 조각이 거의 무음이다")
    return (x * 10 ** (g / 20)).astype(np.float32)


_CACHE = {}


def load(path, stereo=False):
    k = (path, stereo)
    if k not in _CACHE:
        _CACHE[k] = C.load_stereo(path) if stereo else C.load(path)
    return _CACHE[k]


def seg(path, a, b, stereo=False):
    x = load(path, stereo)
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


def loop_to(x, seconds, xfade=0.5):
    # 이음새가 들리지 않게 끝과 처음을 겹쳐 되풀이
    n = int(seconds * RATE)
    if len(x) >= n:
        return x[:n].copy()
    k = int(xfade * RATE)
    out = x.copy()
    while len(out) < n:
        a = out[-k:] * np.linspace(1, 0, k)[(slice(None),) + (None,) * (x.ndim - 1)]
        b = x[:k] * np.linspace(0, 1, k)[(slice(None),) + (None,) * (x.ndim - 1)]
        out = np.concatenate([out[:-k], a + b, x[k:]], axis=0)
    return out[:n].copy()


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


# ---------- 짠 소리 ----------
def elevator_hum(seconds):
    # 엘리베이터 칸 웅 소리 — 낮은 기계 웅(55 · 110Hz) + 환기 바람(분홍 잡음 저역)
    t = np.arange(int(seconds * RATE)) / RATE
    air = lp(hp(pink(seconds, 41), 80), 900)
    hum = 0.05 * np.std(air) * (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 110 * t))
    return (air + hum).astype(np.float32)


def click():
    # 버튼 눌림 — 짧은 딸깍(두 번 겹친 띠 잡음)
    n = int(0.03 * RATE)
    e = np.exp(-np.arange(n) / (0.004 * RATE))
    a = bp(rng.standard_normal(n).astype(np.float32), 1500, 6000) * e
    b = np.zeros(int(0.05 * RATE), np.float32)
    b[int(0.012 * RATE):int(0.012 * RATE) + n] += 0.6 * a
    return (np.concatenate([a, np.zeros(int(0.02 * RATE), np.float32)])[:len(b)] + b).astype(np.float32)


def door_motor(seconds):
    # 엘리베이터 문이 미끄러지는 소리 — 낮은 굴림(바퀴) + 공기
    t = np.arange(int(seconds * RATE)) / RATE
    roll = bp(pink(seconds, 43), 60, 500)
    env = np.minimum(1, t / 0.12) * np.minimum(1, (seconds - t) / 0.18)
    thud = np.zeros_like(roll)
    k = int(max(0, seconds - 0.08) * RATE)
    m = min(len(thud) - k, int(0.12 * RATE))
    if m > 0:
        thud[k:k + m] = lp(rng.standard_normal(m).astype(np.float32), 300) * np.exp(-np.arange(m) / (0.03 * RATE)) * 3
    return ((roll * env) + thud).astype(np.float32)


def chime():
    # 엘리베이터 「띵」 — 부드러운 종(기음 + 배음, 빨리 줄어듦)
    d = 1.2
    t = np.arange(int(d * RATE)) / RATE
    f = 880.0
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3.01 * f * t)
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.35)
    return (x * env).astype(np.float32)


# ---------- 목소리 ----------
def voice(path, a, b, kind, level):
    """뗀 목소리 a~b초를 자리마다 다르게 — street(처마 · 길, 짧은 울림) · office(사무실) · lift(엘리베이터 칸) · pub(술집) · store(가게 안) ·
    off(화면 밖에서, 멀고 먹먹하게) · close(속말 — 가깝고 마름)"""
    x = fades(seg(path, a, b), 0.01, 0.06)
    x = hp(x, 90)
    if kind == "street":
        x = reverb(x, 0.30, -20, tone=5000, pre=0.008, seed=3)
    elif kind == "office":
        x = reverb(x, 0.45, -17, tone=5500, pre=0.012, seed=4)
    elif kind == "lift":
        x = reverb(x, 0.28, -15, tone=4200, pre=0.004, seed=5)
    elif kind == "pub":
        x = reverb(lp(x, 9000), 0.55, -16, tone=4000, pre=0.014, seed=6)
    elif kind == "store":
        x = reverb(x, 0.40, -17, tone=5200, pre=0.010, seed=7)
    elif kind == "off":
        x = reverb(lp(hp(x, 160), 5200), 0.55, -9, tone=3800, pre=0.02, seed=8)
    elif kind == "close":
        x = stereo(x)
    elif kind == "inner":
        # 속말 — 장면 속 말과 갈리게 마른 소리에 옅은 머릿속 울림(긴 잔향을 아주 작게). 11-07 첫 섞음은 마른 소리만이라 Gemini 소리 맹검이
        #   「장면 속 말과 구별이 안 된다 · 혼잣말 5점」
        x = reverb(hp(x, 120), 1.1, -15, tone=4200, pre=0.03, seed=9)
    return to_rms(x, level)


def compress(x, thr_db=-30.0, ratio=2.5, att=0.008, rel=0.18):
    hop = int(0.001 * RATE)
    n = len(x) // hop
    pk = np.abs(x[: n * hop]).reshape(n, hop, 2).max(axis=(1, 2))
    db = 20 * np.log10(pk + 1e-9)
    a_att, a_rel = 1 - np.exp(-0.001 / att), 1 - np.exp(-0.001 / rel)
    env = np.empty(n, np.float32)
    cur = -90.0
    for i in range(n):
        d = db[i]
        cur += (d - cur) * (a_att if d > cur else a_rel)
        env[i] = cur
    gdb = np.minimum(0.0, (thr_db - env) * (1 - 1 / ratio))
    g = np.repeat(10 ** (gdb / 20), hop)
    g = np.concatenate([g, np.full(len(x) - len(g), g[-1] if len(g) else 1.0)])
    return (x * g[:, None]).astype(np.float32)


def build(out_wav, timing_json, TF, idx, CUTS):
    total = TF[-1]
    N = int((total + 1.0) * RATE)
    V = np.zeros((N, 2), np.float32)    # 목소리
    M = np.zeros((N, 2), np.float32)    # 곡
    B = np.zeros((N, 2), np.float32)    # 바탕 · 사건
    L = []
    T = lambda c: TF[idx[c]]
    END = lambda c: TF[idx[c] + 1]
    off = lambda c: CUTS[c][1] / 24.0

    def put(track, t, x, db=0.0, fade=0.004):
        x = stereo(x).copy() * (10 ** (db / 20))
        n = int(fade * RATE)
        if n and len(x) > 2 * n:
            x[:n] *= np.linspace(0, 1, n)[:, None]
            x[-n:] *= np.linspace(1, 0, n)[:, None]
        i = int(round(t * RATE))
        if i < 0:
            x = x[-i:]
            i = 0
        j = min(len(track), i + len(x))
        if i < j:
            track[i:j] += x[:j - i]

    def say(path, a, b, at, kind, level, who, text, inner=False, sub=True):
        x = voice(path, a, b, kind, level)
        put(V, at, x)
        if not sub:
            return
        m = x.mean(axis=1)
        n = int(0.02 * RATE)
        e = np.array([np.sqrt(np.mean(m[i:i + n] ** 2) + 1e-12) for i in range(0, len(m) - n, n)])
        db = 20 * np.log10(e + 1e-12)
        on = np.where(db > db.max() - 30)[0]
        L.append({"a": round(at + on[0] * 0.02, 3), "b": round(at + (on[-1] + 1) * 0.02, 3), "who": who, "s": text, "inner": inner})

    v = lambda key: os.path.join(VOX, key + "_목소리.wav")
    vi = lambda key: os.path.join(INNER, key + "_목소리.wav")

    def sync(cut, key, a, b, kind, level, who, text, sub=True):
        # 입 보이는 줄 — 판 시각 그대로(컷 시작 + (판 초 − 시작점))
        say(v(key), a, b, T(cut) + a - off(cut), kind, level, who, text, sub=sub)

    # ===== 시작 편 =====
    sync("C02", "rs-C02", 0.96, 1.95, "street", -21, "유나", "저 좋아하죠?")
    sync("C04", "rs-C04", 3.54, 4.56, "street", -21, "유나", "좋아하냐고요")
    sync("C07", "rs-C07m", 1.20, 3.38, "office", -22, "민재", "과장님, 연애 안 하세요?")
    sync("C08", "rs-C08", 1.46, 2.40, "office", -22, "태준", "뭐, 아직은…")
    say(v("rs-C09-10"), 0.70, 1.60, T("C09") - 0.62, "off", -27, "유나", "잠깐만요!")           # 화면 밖 — 닫히는 문 앞에서 J컷
    sync("C12", "rs-C12m__2", 2.06, 3.44, "lift", -22, "유나", "고맙습니다")
    sync("C14", "rs-C14m", 1.00, 2.38, "pub", -22, "민재", "이 자리에 좋아하는 사람 있죠?")
    sync("C14", "rs-C14m", 5.06, 6.42, "pub", -21, "태준", "에이, 없어요")
    sync("C20", "rs-C20n", 2.42, 6.08, "street", -22, "유나", "어깨 다 젖으셨네… 하나 사야겠다, 어디 있더라")   # 새 판도 말 2.52–6.02(옛 판과 같은 자리)
    sync("C21", "rs-C21m", 4.42, 5.80, "store", -24, "태준", "거기, 투명한 거요")
    sync("C22", "rs-C22", 2.56, 5.08, "store", -22, "유나", "제가 투명한 거 좋아하는 건 어떻게 알아요?")
    # C23 태준 속말 — 「다 보이고 있었다는 걸」이 김 서린 유리에 글이 써지는 때(컷 3.95–5.55)와 함께
    say(vi("rs-말-태준-1"), 0.80, 1.56, T("C23") + 0.30, "inner", -23, "태준", "몰랐다", inner=True, sub=False)
    say(vi("rs-말-태준-1"), 2.96, 4.36, T("C23") + 1.75, "inner", -23, "태준", "숨긴다고 숨긴 게,", inner=True, sub=False)
    say(vi("rs-말-태준-1"), 5.46, 7.07, T("C23") + 3.90, "inner", -23, "태준", "다 보이고 있었다는 걸", inner=True, sub=False)
    sync("C24", "rs-C24", 2.38, 3.34, "street", -21, "유나", "저 좋아하죠?")
    sync("C25", "rs-C25", 2.38, 3.32, "street", -22, "태준", "아니, 뭐…")
    sync("C27", "rs-C27", 3.20, 7.70, "street", -21, "유나", "아까 우산, 다 제 쪽으로 기울였잖아요, 어깨 다 젖고")
    say(v("rs-C28-29"), 2.16, 3.16, T("C29") - 0.42, "street", -22, "유나", "다 보여요,")       # 화면 밖 J컷(원본 「끝 0.4초에 그녀 말이 먼저」)
    sync("C29", "rs-C28-29", 7.02, 7.70, "street", -22, "유나", "과장님")
    # ===== 끝 편 =====
    sync("C36", "rs-C36-37", 0.74, 1.70, "street", -21, "유나", "넌 그대로다")
    sync("C38", "rs-C38", 4.02, 5.06, "street", -21, "유나", "여전히 다 보여")
    sync("C41", "rs-C41", 0.16, 2.58, "office", -23, "민재", "과장님, 요즘 사내 연애 하시는 거 아니죠?")
    say(v("rs-C41"), 4.84, 5.22, T("C41") + 3.05, "office", -30, "태준", "아…", sub=False)  # 짧은 한숨 — 넓은 컷이라 입이 안 보임, 컷 안으로
    sync("C43", "rs-C43m2__2", 0.92, 1.78, "off", -27, "유나", "잠깐만요")
    say(vi("rs-말-태준-2"), 0.54, 2.78, T("C46") + 0.55, "inner", -23, "태준", "그날, 내 손을 피했지", inner=True)
    sync("C47", "rs-C47", 0.64, 2.00, "pub", -25, "민재", "이 자리에 좋아하는 사람 있죠?")
    sync("C47", "rs-C47", 4.84, 5.38, "pub", -22, "유나", "아니요")
    # C48 그림은 rs-C48n__2(우산이 부스 벽에 기댐)지만 그 판 목소리는 「잔이나 피워」로 받아써져(새 두 벌 다) 옛 rs-C48 목소리를 같은 자리에 —
    #   입 모양(ㅂ · ㅍ 같음) · 말 덩이 박자가 0초 어긋남에서 가장 맞다(소리 크기 곡선 상관 0.74)
    sync("C48", "rs-C48", 0.00, 3.60, "pub", -21, "태준", "쓸데없는 소리 말고 잔이나 비워")
    say(vi("rs-말-태준-2"), 6.10, 7.68, T("C48") + 3.72, "inner", -23, "태준", "넌 눈 하나 깜짝 안 하더라", inner=True)
    sync("C50", "rs-C50", 4.46, 5.12, "street", -22, "유나", "뭐 봐?")
    sync("C51", "rs-C51", 2.70, 4.46, "street", -22, "태준", "응? 아무것도 아냐")
    sync("C52", "rs-C52m", 3.46, 3.88, "store", -22, "태준", "이거,")
    sync("C53", "rs-C53a", 1.56, 2.42, "store", -22, "태준", "너 좋아하겠다")
    sync("C53", "rs-C53a", 6.78, 7.36, "store", -22, "유나", "바빠?")
    b0 = T("C53") + 193 / 24 - 1 / 24     # 이음 판 1장 = 앞 토막 끝 장 다음
    say(v("rs-C53b-이음"), 1.48, 2.44, b0 + 1.48, "store", -22, "태준", "아니, 괜찮아")
    say(v("rs-C53b-이음"), 3.94, 4.80, b0 + 3.94, "store", -22, "태준", "할 말 있구나")
    say(vi("rs-말-유나-1"), 1.26, 1.92, T("C54") + 1.60, "inner", -23, "유나", "우리,", inner=True, sub=False)
    say(vi("rs-말-유나-1"), 2.88, 4.66, T("C54") + 2.95, "inner", -23, "유나", "한때는 서로가 다 보였다", inner=True, sub=False)
    sync("C55", "rs-C55-56", 1.36, 2.54, "street", -23, "태준", "검은 거 말고 이거 써")   # 첫 섞음에서 리미터가 4.2 dB 누른 줄 — 2 dB 낮춤
    say(v("rs-C55-56"), 3.80, 5.02, T("C56") + 0.04, "street", -21, "태준", "너 투명한 거 좋아하잖아")   # 손 인서트 위로(화면 밖)
    sync("C57", "rs-C57", 1.90, 6.08, "street", -21, "유나", "이런 거 자꾸 챙겨 주지 마, 나중에 생각나")
    sync("C58", "rs-C58", 2.12, 4.10, "street", -21, "태준", "그냥… 비 맞을까 봐")
    say(vi("rs-말-태준-3"), 0.82, 5.28, T("C60") + 0.45, "inner", -23, "태준", "우산을 접고 나니, 서로의 얼굴이 다 말해 버렸다", inner=True)
    say(vi("rs-말-태준-3"), 6.86, 7.96, T("C60") + 5.35, "inner", -23, "태준", "여기까지라는 걸", inner=True)
    sync("C61", "rs-C61", 1.04, 2.06, "street", -22, "유나", "잘 지내")
    sync("C66", "rs-C66", 3.72, 5.10, "street", -21, "태준", "어, 비 그쳤네")

    # ===== 곡 =====
    cello = load(os.path.join(MUS, "첼로_a.wav"), True)
    violin = load(os.path.join(MUS, "바이올린_b.wav"), True)
    piano = load(os.path.join(MUS, "피아노_a.wav"), True)

    def music(src, s0, s1, at, fin, fout, level, gain_db=None):
        # level: 그 조각을 맞출 크기. gain_db를 주면 그 이득을 그대로(한 흐름의 뒤 조각 — 꼬리를 따로 키우지 않게)
        x = src[int(s0 * RATE):int(s1 * RATE)].copy()
        x = fades(x, fin, fout)
        g = gain_db if gain_db is not None else level - rms_db(src[int(s0 * RATE):int(s1 * RATE)])
        put(M, at, x * 10 ** (g / 20))
        return g

    # 시작 편: 피아노 동기(C05 끝 말이 막힌 얼굴에 들어와 제목 카드 · 사무실 바닥) → C11 엘리베이터에서 첼로 주제(남) — 첼로가 곡 12초에 들어와 유나가
    #   타는 때에 오고, 소리가 커지는 곡 36–47초가 우산 하나를 같이 쓰고 걷는 C18 · 접는 C19에 오게 곡 9.7초부터. 회상이 끝나는 C23 띠 열림에 풀림.
    music(piano, 0.0, 15.8, T("C05") + 2.55, 0.25, 1.8, -27)
    music(cello, 9.7, 9.7 + (T("C24") - T("C11")) + 0.1, T("C11") - 0.1, 2.0, 2.2, -24)   # 들어옴 2초 — 첫 섞음은 「피아노 브릿지가 갑자기 커져」(맹검)
    # 손을 잡는 C30에서 같은 곡이 다시(곡 33초 숨 → 36초 부풂이 C31 「고조」 · C32 물보라에), C34 끝 1.2초에 풀려 끝 편 첫 컷은 빗소리만
    music(cello, 33.0, 33.0 + (T("C35") - T("C30")), T("C30"), 0.8, 1.3, -21)
    # 끝 편: C39 눈시울에 같은 피아노 동기(시작 편과 거울) → C43 엘리베이터에서 바이올린 주제(여) — 곡의 부풂(29초)이 떨어져 걷는 C49에,
    #   잦아듦(64–72초)이 C54 손글씨에 오게 곡 2.3초부터
    music(piano, 0.0, 15.0, T("C39") + 1.4, 0.4, 1.8, -27)
    # 곡 안의 쉼(11.7–13.4초, −30~−40 dB)은 건너뛴다 — 첫 섞음에서 맹검이 「곡이 한번 완전히 끊겼다가 다시 시작」(2:45)
    vg = music(violin, 2.3, 11.75, T("C43") - 0.1, 1.5, 0.3, -23)
    v2 = T("C43") - 0.1 + (11.75 - 2.3) - 0.3
    music(violin, 13.40, 13.40 + (T("C55") - v2) + 0.1, v2, 0.3, 2.2, -23, gain_db=vg)
    # 이별 뒤: C59 눈물에 첼로 주제가 돌아와(곡 25초) 곡의 숨(33–35초)이 C61 「잘 지내」에, 부풂(36초)이 유나가 떠나는 C62에 온다.
    #   곡 64초 숨(C70 들어서 1.1초)에서 곡 끝 피아노 여운으로 건너 끝까지
    #   곡 64.5초 숨(C70 들어서 2초)에서 곡의 맺음(89초부터 잦아들어 93초에 거의 사라짐)으로 건너, 끝 장에서 거의 사라지게 — 첫 섞음은 맺음 전
    #   89.2초 한창에 잘려 「칼로 자른 듯 끝난다」(맹검), 꼬리를 따로 −23 dB로 맞춰 여운까지 키웠다
    f_at = T("C59") - 0.45
    f_s0 = 36.0 - (T("C62") + 0.5 - f_at)
    jump_t = f_at + (64.5 - f_s0)
    fg = music(cello, f_s0, 64.5 + 0.5, f_at, 1.0, 0.5, -21)
    tail_s0 = 93.0 - (total - jump_t)
    music(cello, tail_s0, 93.4, jump_t, 0.5, 0.5, 0, gain_db=fg)

    # ===== 바탕 =====
    def bed(a, b, x, level, fin=0.45, fout=0.5, lpf=None, hpf=None):   # 장소가 바뀌는 컷에서 「공간이 툭」(맹검 2:38) — 들어옴 · 나감을 길게
        x = loop_to(stereo(x), b - a + 0.01)
        x = lp(x, lpf) if lpf else lp(x, 12000, order=2)   # 따로 정한 거르개가 없으면 12 kHz 위를 살짝 — 빗소리 고음 어택이 AAC 뒤 봉우리를 띄운다
        if hpf:
            x = hp(x, hpf)
        x = to_rms(x, level)
        x = fades(x, fin, fout)
        put(B, a, x, fade=0.002)

    rain = load(RAIN_CITY, True)
    rain_day = load(RAIN_CARS, True)
    window = load(RAIN_WIN, True)
    drips = load(DRIPS)
    # 밤비(현재 · 처마 밑) — 비는 컷마다 끊지 않고 이어 깐다
    bed(0.0, T("C06") + 0.6, rain[int(5 * RATE):], -35, fin=0.05)
    bed(T("C06"), T("C07"), rain[int(40 * RATE):], -42, fin=0.4, fout=0.3, lpf=2500)    # 제목 카드 — 유리 너머 먹먹하게
    bed(0.0, T("C06"), drips, -48, lpf=6000)
    # 회상 — 사무실(방 공기 · 먼 자판) · 엘리베이터(웅) · 술집(웅성) · 빗길 · 처마 · 가게 안(냉장고 · 창의 비)
    room = lp(hp(pink(40, 5), 60), 1600)
    bed(T("C07"), T("C09"), room, -50)
    bed(T("C07"), T("C09"), load(TYPING), -52, lpf=6000)
    bed(T("C09"), T("C14"), elevator_hum(20), -47)
    bed(T("C14"), T("C18"), load(PUB, True)[int(60 * RATE):], -39, lpf=7000)
    bed(T("C18") - 0.3, T("C21") + 0.3, rain[int(70 * RATE):], -34)
    bed(T("C19"), T("C21"), drips, -48, lpf=6000)
    bed(T("C21"), T("C24"), window, -43, lpf=1800)
    bed(T("C21"), T("C24"), load(FRIDGE, True)[int(30 * RATE):], -49, lpf=900)
    # 현재(밤) — 처마 밑 둘
    bed(T("C24"), T("C35"), rain[int(95 * RATE):], -35, fin=0.05)
    bed(T("C24"), T("C32"), drips, -48, lpf=6000)
    # ===== 끝 편: 낮비 =====
    bed(T("C35"), T("C40") + 0.5, rain_day[int(10 * RATE):], -35, fin=0.05)
    bed(T("C35"), T("C40"), rain[int(20 * RATE):], -39, hpf=900, lpf=6500)             # 우산 덮개에 듣는 비 — 고음 어택이 AAC 뒤 봉우리를 −0.3 dBFS로 띄워(11-07) 6.5 kHz 위를 깎고 3 dB 낮춤
    bed(T("C40"), T("C41"), rain_day[int(60 * RATE):], -43, lpf=2500)
    bed(T("C41"), T("C43"), room, -50)
    bed(T("C41"), T("C43"), load(TYPING), -53, lpf=6000)
    bed(T("C43"), T("C47"), elevator_hum(20), -47)
    bed(T("C47"), T("C49"), load(PUB, True)[int(80 * RATE):], -40, lpf=7000)   # 200초 자리에 표본 급변 여섯(지지직 의심) — 80초 자리로
    bed(T("C49") - 0.3, T("C52"), rain_day[int(30 * RATE):], -34)
    bed(T("C50"), T("C52"), drips, -49, lpf=6000)
    bed(T("C52"), T("C55"), window, -44, lpf=1800)
    bed(T("C52"), T("C55"), load(FRIDGE, True)[int(60 * RATE):], -49, lpf=900)
    bed(T("C55"), T("C66") + 0.7, rain_day[int(70 * RATE):], -35, fin=0.05, fout=2.4)  # 검은 화면 C65 위로 2.4초에 걸쳐 잦아들어 C66 밝아지며 그침(첫 섞음 0.9초는 「탁 끊기듯」)
    bed(T("C55"), T("C62"), drips, -49, lpf=6000)
    # 비 갠 뒤 — 처마 끝 마지막 물방울 · 먼 거리 · 새
    bed(T("C66"), T("C68"), drips, -47, fout=1.2, lpf=6000)
    bed(T("C66") + 0.3, total + 0.3, load(AFTER, True)[int(20 * RATE):], -44, fin=1.5, fout=0.8)

    # ===== 사건 소리 =====
    # C09 문이 닫혀 감 → C10 버튼 딸깍 · 띵 → C11 문이 다시 열림(굴림)
    put(B, T("C09") - 0.1, to_rms(door_motor(1.1), -36))
    put(B, T("C10") + 0.32, to_rms(lp(click(), 5000), -35))
    put(B, T("C10") + 0.45, to_rms(chime(), -44), fade=0.001)
    put(B, T("C11") - 0.35, to_rms(door_motor(1.0), -38))
    # C19 우산을 접고 터는 소리
    put(B, T("C19") + 1.0, to_rms(lp(seg(UMBRELLA, 0.2, 2.6), 9000), -36), fade=0.05)
    # C32 · C64 물보라(C64는 내려앉아 옅게)
    put(B, T("C32") + 0.44, to_rms(seg(SPLASH, 0.0, 2.2), -27), fade=0.002)      # rs-C32m__4 닿음 판 0.78 − 시작점 8장(0.33)
    put(B, T("C64") + 0.25, to_rms(seg(SPLASH_L, 0.4, 2.2), -32), fade=0.002)    # rs-C64g__2 파란 우산 닿음 판 1.33 − 시작점 26장(1.08)
    put(B, T("C64") + 0.52, to_rms(seg(SPLASH_L, 0.5, 1.8), -36), fade=0.002)    # 맑은 우산이 그 위로 닿음 판 1.6
    # C48 맥주를 따름
    put(B, T("C48") + 0.25, to_rms(seg(POUR, 1.0, 3.6), -40), fade=0.05)
    # C67 접은 우산을 볕 속으로 들어 올리는 비닐 스침
    put(B, T("C67") + 0.1, to_rms(lp(seg(UMBRELLA, 3.0, 4.6), 9000), -42), fade=0.05)
    # C69 구두가 물웅덩이를 디딤(판 2.0초에 들어와 2.4초쯤 닿음)
    put(B, T("C69") + 2.35, to_rms(seg(PUDDLE, 1.10, 1.75), -32), fade=0.003)
    put(B, T("C69") + 3.55, to_rms(seg(PUDDLE, 2.30, 2.90), -36), fade=0.003)

    # ===== 섞기 — 대사 아래 곡을 낮춘다(현장노트 「효과음 · 킥이 말머리에 겹치면」 — 말하는 동안 −9 dB, 들어감 0.15 · 풀림 0.45초) =====
    vm = np.abs(V).max(axis=1)
    hop = int(0.01 * RATE)
    act = np.array([vm[i:i + hop].max() for i in range(0, N, hop)]) > 10 ** (-40 / 20)
    g = np.where(act, 10 ** (-9 / 20), 1.0).astype(np.float32)
    # 들어감 0.15초 · 풀림 0.45초(10ms 칸마다 한 극 거르개)
    a_att, a_rel = 1 - np.exp(-1 / (0.15 * 100)), 1 - np.exp(-1 / (0.45 * 100))
    out_g = np.ones_like(g)
    cur = 1.0
    for i, tgt in enumerate(g):
        cur += (tgt - cur) * (a_att if tgt < cur else a_rel)
        out_g[i] = cur
    duck = np.repeat(out_g, hop)[:N][:, None]
    bduck = 1 - (1 - duck) * 0.55   # 바탕도 대사 아래 조금 — 맹검 「빗소리가 커 작은 대사가 뭉개짐」
    mix = C.Mix(total + 1.0)
    # 처마 물방울 · 물보라 같은 짧은 봉우리가 봉우리 맞춤을 잡아 통합 크기가 −29.7 LUFS로 낮았다(11-07 첫 섞음 — 봉우리와 통합 차 29 dB).
    #   −14 LUFS로 올릴 때 리미터가 10 dB 넘게 누르지 않게, 섞은 소리에 가벼운 압축(1 ms 칸 · 들어감 8 ms · 풀림 180 ms · 문턱 −30 dB · 2.5:1)
    # 대사 줄은 먼저 빠른 압축(들어감 3 ms · 풀림 120 ms · 문턱 −32 dB · 3:1) — 자음 봉우리가 리미터를 세게 밀지 않게
    Vc = compress(V, thr_db=-32.0, ratio=3.0, att=0.003, rel=0.12)
    Vc *= 10 ** ((rms_db(V) - rms_db(Vc)) / 20)
    mix.a[:N] = compress(Vc + M * duck + B * bduck)
    mix.finish(out_wav, boost_db=0.0)
    json.dump({"lines": L}, open(timing_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return L
