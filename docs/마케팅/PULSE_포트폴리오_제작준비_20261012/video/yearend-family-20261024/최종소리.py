# 6번 「연말 빈방」 소리(2026-11-07, Claude) — 최종편집.py 「소리」가 부른다. 02_콘티 5절 소리 설계를 받은 판 · 화면 시각에 맞춰 놓는다.
#   목소리: 엄마 · 딸은 시댄스가 낸 목소리(허깅페이스 BS-RoFormer로 뗀 소리), 줄 자리는 소리 크기 덩어리 + 받아쓰기 두 귀(faster-whisper · 일레븐 Scribe)로 잼.
#   내레이션: 일레븐 v4 Luna 한 번에 이어 읽은 판에서 끝 문구 · 「솜채.」를 덩어리로 나눠 놓음. 노래: Suno 노래 A 두 자리(후렴 · 맺음).
#   효과음: 녹음 모음(Fairlight · Sonniss — 상업 이용 가능) 소리를 화면 사건 장에 맞춰 놓고, 모음에 없는 것(디지털 도어락 전자음 · 매미 · 선풍기 · 방 공기)은 여기서 짠다.
#   MMAudio는 체크포인트가 비상업(CC-BY-NC)이라 쓰지 않는다(현장노트 영상 「영상에 맞춘 효과음은 MMAudio를…」 10-28). 일레븐 효과음 웹은 11-07 ego 로그인이 풀려 못 씀.
# 줄마다 놓은 시각은 자막이 같이 쓰도록 remotion/src/p6/timing.json으로 낸다.
import json
import os

import numpy as np
import scipy.signal as S

import 최종편집공통 as C

RATE = C.RATE
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
FAIR = os.path.join(LIB, "fairlight", "Media Files")
SON = os.path.join(LIB, "sonniss_gdc2026", "풀림")
HS_SFX = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx"
rng = np.random.default_rng(6)


# ---------- 거르개 · 울림 ----------
def lp(x, hz, order=4):
    return S.sosfiltfilt(S.butter(order, hz, "low", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def hp(x, hz, order=2):
    return S.sosfiltfilt(S.butter(order, hz, "high", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def bp(x, lo, hi, order=2):
    return S.sosfiltfilt(S.butter(order, [lo, hi], "band", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def bump(x, f0, db, width=0.6):
    # 한 대역을 키운다(문짝 · 상자 울림) — 그 대역만 뽑아 더한다
    return (x + (10 ** (db / 20) - 1) * bp(x, f0 * (1 - width / 2), f0 * (1 + width / 2))).astype(np.float32)


def reverb(x, rt60, wet_db, tone=5000.0, pre=0.012, seed=1):
    # 지수로 줄어드는 잡음 울림(스테레오 두 줄은 다른 잡음) — 젖은 소리 RMS를 마른 소리 RMS에 wet_db로 맞춘다
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
    # 소리가 있는 50ms 칸(그 조각 봉우리 −30 dB 위)만의 RMS — 절대 문턱을 두면 작은 녹음(침대 스침 봉우리 −35 dB)이 「소리 없음」으로 나와
    # to_rms가 +70 dB 넘게 키워 잡음이 터졌다(11-07 첫 섞음)
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
    reps = int(np.ceil(n / len(x)))
    return np.concatenate([x] * reps, axis=0)[:n]


# ---------- 짠 소리 ----------
def room(seconds, seed, lp_hz=1400.0):
    # 아파트 방 공기 — 분홍 잡음을 낮게 거른다(디지털 무음 대신)
    return lp(hp(pink(seconds, seed), 60), lp_hz)


def desk_fan(seconds):
    # 탁상 선풍기 — 날개 바람(250–3500Hz 잡음)에 날개 지나감(초당 23번)과 모터 웅(120Hz)
    t = np.arange(int(seconds * RATE)) / RATE
    air = bp(pink(seconds, 21), 250, 3500)
    air = air * (1 + 0.10 * np.sin(2 * np.pi * 23.3 * t))
    hum = 0.04 * np.std(air) * (np.sin(2 * np.pi * 120 * t) + 0.4 * np.sin(2 * np.pi * 240 * t))
    return (air + hum).astype(np.float32)


def cicadas(seconds):
    # 한여름 말매미 · 참매미 떼 — 창밖, 거실 안에서 듣는 크기. 소리 결은 4.5~7kHz 잡음 띠를 날개 떨림(90~180Hz)으로 두드리고, 몇 초씩 부풀었다 잦아든다
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    out = np.zeros(n, np.float32)
    r = np.random.default_rng(31)
    for k in range(7):   # 말매미 — 길게 이어지는 「쏴아」
        f0 = r.uniform(4600, 6600)
        band = bp(r.standard_normal(n).astype(np.float32), f0 * 0.82, f0 * 1.18)
        rate = r.uniform(95, 170)
        am = 0.55 + 0.45 * (np.sin(2 * np.pi * rate * t + r.uniform(0, 6)) > 0)
        start, length = r.uniform(-3, seconds - 3), r.uniform(6, 11)
        env = np.clip((t - start) / 1.2, 0, 1) * np.clip((start + length - t) / 1.8, 0, 1)
        env = env * (0.8 + 0.2 * np.sin(2 * np.pi * r.uniform(0.15, 0.4) * t))
        out += band * am * env * r.uniform(0.5, 1.0)
    for k in range(2):   # 참매미 — 「맴 맴 맴」 끊어 우는 소리
        f0 = r.uniform(3800, 4800)
        band = bp(r.standard_normal(n).astype(np.float32), f0 * 0.85, f0 * 1.2)
        am = 0.5 + 0.5 * (np.sin(2 * np.pi * 120 * t) > 0)
        period, on = r.uniform(0.38, 0.46), 0.26
        ph = ((t + r.uniform(0, 1)) % period) / period
        pulse = np.clip(np.minimum(ph / 0.15, (on / period - ph) / 0.2), 0, 1) * (ph < on / period)
        start, length = r.uniform(0, seconds - 4), r.uniform(3.5, 5)
        env = np.clip((t - start) / 0.4, 0, 1) * np.clip((start + length - t) / 0.8, 0, 1)
        out += band * am * pulse * env * 0.7
    return lp(hp(out, 2200), 7500)   # 창 · 방충망을 지나 조금 무뎌짐


def _piezo(f, d):
    # 도어락 압전 버저 — 사각파(홀수 배음)를 평평하게 켰다 끈다. 치고 줄어드는 소리(첫 판)는 맹검에서 「실로폰 · 차임 징글」로 들렸다(11-07 Gemini)
    t = np.arange(int(d * RATE)) / RATE
    sq = np.sign(np.sin(2 * np.pi * f * t))
    env = np.minimum(1, t / 0.003) * np.minimum(1, (d - t) / 0.004)
    return lp((sq * env).astype(np.float32), 6500, order=2)


def doorlock():
    """현관 디지털 도어락 — 번호 누름 「삑 삑 삑」(같은 높이 셋, 작게) → 열림음(오르는 넷, 평평한 버저) → 모터 「위잉」 → 걸쇠 「철컥」 → 현관문이 열림.
    번호 누름과 버저 결이 있어야 한국 아파트 현관으로 읽힌다(첫 판은 열림음 · 모터 · 걸쇠만이라 징글로 들렸다). 돌려주는 값: (소리, 각 마디 시작 초)"""
    parts, marks, at = [], {}, 0.0

    def add(x, name=None, gap=0.0):
        nonlocal at
        if name:
            marks[name] = at
        parts.append(x)
        at += len(x) / RATE
        if gap:
            parts.append(np.zeros(int(gap * RATE), np.float32))
            at += gap

    marks["번호"] = 0.0
    # 사람 손 빠르기로 — 고른 0.115초 간격 넷은 맹검에서 「로고 징글(띵-띵-)」로 들렸다(11-07 Gemini 둘째 판). 간격을 고르지 않게,
    # 누름마다 손끝이 유리 판을 치는 「톡」(짧은 띠 잡음)을 앞에 붙이고, 셋만 · 열림음보다 5 dB 작게 — 셋째 시험에서도 「솜채.」 바로 뒤 번호음이
    # 「브랜드 징글인지 상황음인지 혼선」이라 해서, 번호는 뒤로 물리고 열림음(맹검이 도어락으로 알아들음)이 주인공이 되게 했다. 셋째 뒤 0.15초에 열림음
    tap = bp(rng.standard_normal(int(0.006 * RATE)).astype(np.float32), 1800, 5200) * np.hanning(int(0.006 * RATE)).astype(np.float32)
    for k, (gap, amp) in enumerate(((0.09, 0.3), (0.115, 0.27), (0.15, 0.32))):
        add(tap * 0.35 * amp / 0.55)
        add(_piezo(2350.0, 0.045) * amp, gap=gap)
    marks["열림음"] = at
    for f in (1568.0, 1976.0, 2349.0, 3136.0):
        add(_piezo(f, 0.075) * 0.5, gap=0.008)
    parts.append(np.zeros(int(0.06 * RATE), np.float32))
    at += 0.06
    md = 0.30
    t = np.arange(int(md * RATE)) / RATE
    ph = 2 * np.pi * np.cumsum(140 + 110 * t / md) / RATE
    motor = (np.sign(np.sin(ph)) * 0.45 + np.sin(2 * ph) * 0.3) * 0.3 + 0.12 * bp(rng.standard_normal(len(t)).astype(np.float32), 700, 3200)
    motor = lp(motor.astype(np.float32), 2600) * np.minimum(1, t / 0.03) * np.minimum(1, (md - t) / 0.04)
    add(motor.astype(np.float32), "모터")
    latch = seg(os.path.join(FAIR, "Metal Door Latch Movement.M.wav"), 3.47, 3.85)
    add(to_rms(latch, rms_db(motor) + 7), "걸쇠", gap=0.07)
    door = seg(os.path.join(FAIR, "INT Hollow Wood Door, Open Close x3 with INT Air.M.wav"), 7.95, 8.85)   # 여는 소리 — 현관문은 더 무겁게(낮게)
    door = np.interp(np.arange(0, len(door) - 1, 0.86), np.arange(len(door)), door).astype(np.float32)
    add(to_rms(door, rms_db(motor) + 2), "문")
    return np.concatenate(parts).astype(np.float32), marks


def vacuum(seconds, seed=0):
    # 통 청소기 — 헤어드라이어 녹음(고르게 도는 0.5~10.5초)을 조금 낮춰(×0.9) 큰 모터로, 흡입구가 바닥을 밀고 당길 때 부하가 바뀌는 결(초당 0.8번)
    src = seg(os.path.join(SON, "344 Audio - Barbershop Vol. 1", "OBJMisc_Hair Dryer, On, Idle, Off 4_344 Audio_Barbershop Vol 1.wav"), 0.8, 10.3)
    slow = np.interp(np.arange(0, len(src) - 1, 0.9), np.arange(len(src)), src).astype(np.float32)
    x = loop_to(slow, seconds)
    t = np.arange(len(x)) / RATE
    body = lp(pink(seconds, 40 + seed), 420) * 0.6 * np.std(x) / (np.std(lp(pink(1, 1), 420)) + 1e-9)
    stroke = 1 + 0.18 * np.sin(2 * np.pi * 0.8 * t + seed)
    return ((x + body[:len(x)]) * stroke).astype(np.float32)


# ---------- 놓기 ----------
class Placer:
    """C.Mix에 놓고, 자막이 쓸 줄 시각을 모은다."""

    def __init__(self, seconds):
        self.m = C.Mix(seconds)
        self.lines = []

    def put(self, t, x, db=0.0, fade=0.006, fade_out=None):
        self.m.put(t, x, db, fade, fade_out)


def voice(path, a, b, kind, level):
    """뗀 목소리 a~b초를 자리마다 다르게 — kitchen(부엌 울림) · door(문 너머 먹먹하게) · room(화면 속 거실) · close(속말, 가깝고 마름) · hall(현관에서 멀리)"""
    x = fades(seg(path, a, b), 0.008, 0.06)
    x = hp(x, 90)
    if kind == "kitchen":
        x = reverb(lp(x, 7000), 0.55, -11, tone=4500, pre=0.018, seed=3)
    elif kind == "door":
        x = bump(lp(hp(x, 160), 1050, order=4), 330, 4)
        x = reverb(x, 0.35, -14, tone=1500, pre=0.006, seed=4)
    elif kind == "room":
        x = reverb(x, 0.45, -19, tone=5000, pre=0.01, seed=5)
    elif kind == "close":
        x = np.stack([x, x], axis=1)
    elif kind == "hall":
        x = reverb(lp(hp(x, 220), 4200), 0.95, -6, tone=3500, pre=0.03, seed=6)
    return to_rms(x, level)


def build(out_wav, timing_json, T, VOX, NARR, SONG, NARR_AT, BRAND_AT):
    total = T[-1]
    p = Placer(total + 0.5)
    L = []   # 자막: {a, b, who, s}

    def say(path, a, b, at, kind, level, who, text, inner=False):
        x = voice(path, a, b, kind, level)
        p.put(at, x, 0, fade=0.004)
        # 자막 시각은 소리 덩어리(봉우리 −30 dB 위)로 — 조각 처음 · 끝의 숨 · 꼬리는 뺀다
        m = x if x.ndim == 1 else x.mean(axis=1)
        n = int(0.02 * RATE)
        e = np.array([np.sqrt(np.mean(m[i:i + n] ** 2) + 1e-12) for i in range(0, len(m) - n, n)])
        db = 20 * np.log10(e + 1e-12)
        on = np.where(db > db.max() - 30)[0]
        L.append({"a": round(at + on[0] * 0.02, 3), "b": round(at + (on[-1] + 1) * 0.02, 3), "who": who, "s": text, "inner": inner})   # inner: 속말 자막 결(P6.tsx)

    v = lambda name: os.path.join(VOX, name + "_목소리.wav")
    # 2 검은 글판 — 엄마, 부엌에서(화면 밖)
    say(v("p6-말-엄마-1"), 0.45, 2.85, T[1] + 0.33, "kitchen", -24, "엄마", "아침은 먹고 가, 버스 놓친다!")
    # 4 저녁 빈 거실 — 엄마(부엌) → 딸(문 너머) → 엄마(부엌)
    say(v("p6-말-엄마-1"), 4.60, 6.75, T[3] + 0.12, "kitchen", -24, "엄마", "밥 먹자, 김치찌개 했어!")
    say(v("p6-말-딸-1"), 0.40, 2.20, T[3] + 2.34, "door", -30, "딸", "배 안 고파, 이따 먹을게")
    say(v("p6-말-엄마-2"), 0.00, 1.20, T[3] + 4.19, "kitchen", -24, "엄마", "다 식는다, 너!")   # 첫 판 — 다시 낸 판(__2)은 네 귀 모두 「나 식는다」로 들음
    # 7 여름 — 화면 속 엄마, 다시 낸 p6-07b(앉은 채 문에 소리친다 — 11-07 Fable 「엎드려 쉬는 장면」). 판 소리를 화면과 같은 자리로(판 1장 = 컷 처음),
    #   말 덩어리는 판 1.45–2.95초 · 3.65–5.05초(뗀 목소리 50ms 칸)
    a7 = 1 / 24
    x7 = voice(v("p6-07b"), a7, a7 + (T[5] - T[4]) - 0.01, "room", -20)
    p.put(T[4], x7, 0, fade=0.004)
    L.append({"a": round(T[4] + 1.45 - a7, 3), "b": round(T[4] + 2.95 - a7, 3), "who": "엄마", "s": "문 잠그고 뭐 해, 또 자?"})
    L.append({"a": round(T[4] + 3.65 - a7, 3), "b": round(T[4] + 5.05 - a7, 3), "who": "엄마", "s": "수능이 코앞이야!"})
    # 11 면접 전날 — 딸은 다시 낸 p6-11c__2의 판 소리(입이 보임, Scribe 「내일 면접인데 들어오지 말랬잖아!」 0.36–2.32초). 엄마 대답은 대사 판(뒷모습)
    a11 = 6 / 24
    x11 = voice(v("p6-11c__2"), a11, 2.45, "room", -21)
    p.put(T[5], x11, 0, fade=0.004)
    L.append({"a": round(T[5] + 0.25 - a11, 3), "b": round(T[5] + 2.35 - a11, 3), "who": "딸", "s": "내일 면접인데, 들어오지 말랬잖아!"})
    say(v("p6-말-엄마-2__2"), 3.62, 5.76, T[5] + 2.06, "room", -21, "엄마", "이불만 갈았어, 이불만!")   # 딸 말끝(22.77초) 바로 뒤 · 컷(24.83초) 0.02초 앞에 끝남
    # 12 밤 · 14 첫 월급
    say(v("p6-말-엄마-3"), 0.95, 3.00, T[6] + 1.37, "room", -24, "엄마", "그 회사가 사람 볼 줄 모르네")
    say(v("p6-말-엄마-3"), 4.70, 6.85, T[7] + 0.44, "room", -22, "엄마", "첫 월급에 내복은 무슨")   # 화면 글은 물음표 · 느낌표 · 쉼표만(슬롭 점검표 6번) — 말줄임표도 뺀다
    # 21 속말 — 가깝고 마른 소리, 「이번 겨울엔」과 「오려나」 사이 쉼은 판 그대로. 21번을 3.29초로 줄여(22번이 49.54초에 시작) 46.02~48.80초 —
    #   20번 끝 0.23초 앞에서 시작하는 J컷, 내레이션 첫소리(49.38초)와 0.58초 떨어진다(옛 판 47.95~50.70초, 원본 자막 자리 48.11~50.71초)
    INNER_AT = 45.90
    say(v("p6-말-엄마-4"), 1.30, 4.30, INNER_AT, "close", -22, "엄마", "이번 겨울엔, 오려나", inner=True)
    # 22 현관 — 도어락 번호(55.45~55.81초) → 열림음(55.96초) → 모터 · 걸쇠 → 현관문(57.10초) → 「엄마!」(57.34초). 화면은 22b(54.54초부터) → 22c(58.54초부터):
    #   번호 사이 판 1.2~1.9초(55.74~56.44초) 고개를 들고, 「엄마!」 0.5초 뒤 판 3.3초(57.84초)부터 웃어 60.0초까지 머문다(22c).
    #   번호는 「솜채.」(54.48~55.08초)에서 0.37초 띄운다 — 바로 붙이자 로고 징글로 들렸다(11-07 Gemini 둘째 · 셋째 시험)
    END_DOORLOCK = 55.45
    END_CALL = 57.34
    say(v("p6-말-딸-1"), 5.30, 5.85, END_CALL - 0.08, "hall", -25, "딸", "엄마!")

    # ---- 내레이션(Luna 한 판) — 끝 문구 덩어리 · 「솜채.」 덩어리를 따로 놓는다
    nar = hp(C.load(NARR), 80)
    copy = to_rms(fades(nar[int(0.10 * RATE):int(5.35 * RATE)], 0.01, 0.08), -19)
    brand = to_rms(fades(nar[int(5.70 * RATE):int(6.60 * RATE)], 0.01, 0.06), -19)
    p.put(NARR_AT + 0.10, copy, 0, fade=0.004)
    p.put(BRAND_AT - 0.15, brand, 0, fade=0.004)

    # ---- 노래 A — ① 후렴 첫 낱말(곡 56.19초)을 31.63초에, 44.43초에 끝 ② 맺음 「불」(곡 140.6초)을 속말 첫소리 0.45초 앞(45.57초)에, 0.7초 앞에서 −18 dB로 들어와 속말 밑, 내레이션 첫소리까지 풀림
    song = C.load_stereo(SONG)
    s1, e1 = 56.19 - 0.5, 56.19 + 12.8
    ch = song[int(s1 * RATE):int(e1 * RATE)].copy()
    ch = fades(ch, 0.4, 0.35)
    ch = to_rms(ch, -21)
    p.put(31.63 - 0.5, ch, 0, fade=0.004)
    # 맺음은 내레이션 첫소리(NARR_AT + 0.25초) 앞에서 다 풀린다 — 52.4초까지 깔자 Gemini 심사가 「내레이션과 노래 보컬이 겹쳐 집중이 흩어진다」(11-07).
    #   속말을 당긴 만큼 같이 당긴다(「불」이 속말 첫소리보다 0.45초 앞). 후렴 끝(44.43초)과 붙지 않게 들어오는 길이를 1.0 → 0.7초로
    BUL = INNER_AT + 0.12 - 0.45
    OUT_AT = BUL - 0.7
    s2, e2 = 140.6 - (BUL - OUT_AT), 140.6 + (NARR_AT + 0.25 - BUL)
    oc = fades(song[int(s2 * RATE):int(e2 * RATE)].copy(), 0.7, 0.55)
    oc = oc * 10 ** ((rms_db(ch) - rms_db(oc) - 18) / 20)
    p.put(OUT_AT, oc.astype(np.float32), 0, fade=0.004)

    # ---- 바탕 소리 — 컷마다 바뀐다. 컷 뒤 0.06초 꼬리로 풀어 「뚝 끊김」을 없앤다(11-07 Gemini 소리 맹검 — 20.67초 매미 · 선풍기가 뚝).
    #      pre: 컷보다 먼저 들어오는 초(J컷), post: 컷 뒤 꼬리 초
    def bed(i, x, level, pre=0.0, post=0.06):
        a, b = T[i] - pre, T[i + 1] + post
        x = loop_to(x, b - a + 0.01)
        x = to_rms(x, level)
        x = fades(x, max(0.03, pre), post)
        p.put(a, x, 0, fade=0.002)

    # 방 공기 — 전체(글판 포함)에 아주 낮게
    p.put(0, to_rms(room(total + 0.2, 1), -58), 0, fade=0.02)
    # 1 이른 아침 — 바깥 새 · 먼 거리(창 너머로 무뎌짐). 첫 글판 밑으로 1.4초 이어 풀린다 — 글판 첫 0.4초가 「텅 빈 진공」으로 들렸다(11-07 Gemini)
    bed(0, lp(seg(os.path.join(SON, "344 Audio - East Coast America Vol. 1", "AMBSubn_Ambience, Forest Crickets, Birds, Connecticut 02_344 Audio_East Coast America.wav"), 12, 19.5, True), 5000), -47, post=1.4)
    # 3 청소기(가깝고 큼) — 컷 0.15초 앞에서 차오른다(J컷 — 「페이드 없이 갑자기 크게 튀어나온다」, 11-07 Gemini)
    bed(2, vacuum(T[3] - T[2] + 0.6, 0), -23, pre=0.35)   # 0.15초 앞서도 「훅 치고 들어온다」(11-07 Gemini 둘째 판) — 0.35초 앞에서 차오르게
    # 4 저녁 — 창 너머 먼 차 소리
    bed(3, lp(seg(os.path.join(FAIR, "Magnolia Night Traffic Car Bus B.wav"), 30, 37, True), 1100), -44)
    # 7 한여름 — 매미(창밖) + 선풍기
    bed(4, cicadas(T[5] - T[4] + 0.2), -38)
    bed(4, desk_fan(T[5] - T[4] + 0.2), -41)
    # 11 흐린 낮 — 거실 공기
    bed(5, room(T[6] - T[5] + 0.1, 11, 2000), -50)
    # 12 밤 — 냉장고 웅 · 시계 초침
    bed(6, lp(seg(os.path.join(SON, "Jake Fielding - Fridge Hums Vol.2", "MACHAppl_Deep Fridge Hum, Buzz, Electric Tone, Deep_Jake Fielding_Fridge Hums Pt2.wav"), 40, 45, True), 900), -48)
    clock = lp(seg(os.path.join(SON, "344 Audio - Antique Clocks", "CLOCKTick_Crooked Antique Clock_344 Audio_Antique Clocks.wav"), 0.6, 5.6), 3500)
    bed(6, clock, -47)
    # 14 맑은 낮 — 거실 공기
    bed(7, room(T[8] - T[7] + 0.1, 14, 2200), -50)
    # 16 깊은 밤 — 거의 정적(냉장고가 아주 멀리)
    bed(8, lp(seg(os.path.join(SON, "Jake Fielding - Fridge Hums Vol.2", "MACHAppl_Deep Fridge Hum, Buzz, Electric Tone, Deep_Jake Fielding_Fridge Hums Pt2.wav"), 60, 65, True), 600), -55)
    # 18 마지막 거실 — 청소기(낮게, 노래 밑)
    bed(10, vacuum(T[11] - T[10] + 0.2, 2), -35)
    # 20~22 겨울 방 — 창밖 바람(아주 작게)
    wind = lp(seg(os.path.join(SON, "InMotionAudio - Chimney Wind", "WINDInt_ChimneyWind05_InMotionAudio_ChimneyWind.wav"), 20, 40, True), 700)
    for i in (12, 13, 14):
        bed(i, wind[int((T[i] - T[12]) * RATE):], -53 if i != 12 else -50)

    # ---- 사건 소리(화면 장에 맞춤)
    door = os.path.join(FAIR, "INT Hollow Wood Door, Open Close x3 with INT Air.M.wav")
    flip = os.path.join(SON, "TheWorkRoom - Flip Flops", "FFW003.wav")
    # 1 실내화 세 걸음(판 0.67~2.2초에 걷는다) · 가방 스침 · 문 엶(판 2.2초) · 문 닫힘(판 4.95초 → 화면 4.28초): 쿵 + 걸쇠
    for k, t in enumerate((0.12, 0.60, 1.08)):
        st = lp(seg(flip, [0.48, 1.22, 1.74][k], [0.48, 1.22, 1.74][k] + 0.35), 5500)
        p.put(t, to_rms(st, -40), 0, fade=0.002)
    bag = lp(seg(os.path.join(FAIR, "Backpack Bookbag Rummage.M.wav"), 1.0, 2.2), 6000)
    p.put(0.2, to_rms(bag, -46), 0, fade=0.05, fade_out=0.4)
    p.put(1.50, to_rms(seg(door, 7.95, 9.0), -38), 0, fade=0.004, fade_out=0.3)
    p.put(4.28 - 0.06, to_rms(seg(door, 23.96, 24.95), -29), 0, fade=0.002, fade_out=0.3)
    # 4 부엌 그릇 한 번(딸 말 뒤 — 엄마가 그릇을 내려놓고 「다 식는다」)
    plate = reverb(seg(os.path.join(FAIR, "Ceramic Plate Rubs.M.wav"), 0.28, 0.9), 0.5, -10, seed=8)
    p.put(T[3] + 4.02, to_rms(lp(plate, 6000), -40), 0, fade=0.002)
    # 11 문을 닫는다(p6-11c__2 64장 → 화면 23.08초) · 문에 걸린 비닐이 흔들림(판 2.71~3.4초 → 23.13~23.8초)
    slam11 = T[5] + (64 - 6) / 24
    p.put(slam11 - 0.06, to_rms(seg(door, 11.84, 12.9), -32), 0, fade=0.002, fade_out=0.3)
    vin = seg(os.path.join(FAIR, "Rustling Plastic Bag.M.wav"), 4.30, 5.10)
    p.put(slam11 + 0.04, to_rms(lp(vin, 7000), -47), 0, fade=0.01, fade_out=0.3)
    # 14 맨발 걸음(보조기 — 고르지 않게) · 상자를 내려놓음(판 3.3~3.6초 → 화면 30.5초): 종이 바스락 + 작은 툭
    for t, k in ((28.80, 0), (29.38, 1), (30.10, 2)):
        st = lp(seg(flip, [2.20, 3.20, 4.85][k], [2.20, 3.20, 4.85][k] + 0.32), 3200)
        p.put(t, to_rms(st, -46 if k != 1 else -49), 0, fade=0.002)
    paper = seg(os.path.join(SON, "344 Audio - Christmas Vol. 1", "MAGMisc_Wrapping Paper, Opening Present 1_344 Audio_Christmas.wav"), 2.36, 3.0)
    p.put(30.40, to_rms(lp(paper, 7000), -44), 0, fade=0.01, fade_out=0.2)
    thud = lp(C.load(os.path.join(HS_SFX, "thud.wav")), 900)
    p.put(30.62, to_rms(thud, -44), 0, fade=0.002, fade_out=0.1)
    # 19 문고리 딸깍(판 1.4초 → 42.48초) · 문 열림(판 1.6초부터)
    p.put(42.48, to_rms(seg(door, 16.46, 16.75), -36), 0, fade=0.002)
    p.put(42.66, to_rms(seg(door, 20.55, 21.7), -40), 0, fade=0.004, fade_out=0.35)
    # 22 침대에 앉음(판 0.5~1.6초 → 컷 뒤 0.5~1.6초): 이불 스침 + 나무 틀 삐걱
    bedm = seg(os.path.join(FAIR, "Cloth Bed Movement.M.wav"), 0.0, 1.6)
    p.put(T[14] + 0.44, to_rms(lp(bedm, 7000), -47), 0, fade=0.05, fade_out=0.4)
    creak = seg(os.path.join(FAIR, "Wood Chair Creaks.M.wav"), 7.32, 7.95)
    p.put(T[14] + 1.32, to_rms(lp(creak, 5000), -48), 0, fade=0.004, fade_out=0.2)
    # 22 현관 도어락(멀리, 거실 너머)
    dlx, marks = doorlock()
    dl = reverb(lp(hp(dlx, 300), 4200), 0.7, -9, tone=3200, pre=0.03, seed=9)   # 울림을 줄여(0.9 → 0.7초) 버저가 종처럼 남지 않게
    p.put(END_DOORLOCK, to_rms(dl, -32), 0, fade=0.002)
    marks = {k: round(END_DOORLOCK + v, 3) for k, v in marks.items()}
    print("  도어락", marks)

    p.m.finish(out_wav, boost_db=0.0)
    json.dump({"lines": L, "narr_at": NARR_AT, "brand_at": BRAND_AT, "doorlock": marks, "call": END_CALL}, open(timing_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return L
