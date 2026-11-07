# 로맨스 「다 비침」 짧은 판(41.08초, 2026-11-08, Claude) — 유호님 「짧은 판 시험」(11-07 밤 전수 검수 뒤 · 새로 굽지 않음, 크레딧 0)
# 둘째 판(첫 판 44.79초 교차 검수 뒤 — Gemini 「고치고 통과」 · 그록 「고치고 통과」 · Fable 「기각」): 제목 카드를 끝에서 앞(C05 뒤, 원본 6번 자리)으로,
#   김 서림 · 손글씨를 빼고 C23은 목덜미 · 그녀가 우산을 빼 드는 판 그대로 + 속말 자막, 끝은 입맞춤 직전 장면 위 팩샷 · 표어 · 로고(RS60.tsx),
#   시계 하트 아래 낮은 심장 소리, 「거기, 투명한 거요」는 그가 멀리 선 C20 끝으로, 민재 질문은 탁자 건너편처럼(off), 자막 50px · 띠 짙게, 작은 로고 뺌.
# 셋째 판(38.12초, 유호님 11-08 「이게 왜 내가 아니고 다른사람이야?」): C20 뒤 남자는 초점이 옮겨 가 또렷해지면 유호님 얼굴이 아니었다 —
#   C20을 초점 이동 전(판 4.08초)에서 끊고 「하나 사야겠다, 어디 있더라」 · 「거기, 투명한 거요」를 뺐다.
#   python -X utf8 짧은판.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/rs/짧은판/다비침_짧은판.mp4 · _폰.mp4
#   python -X utf8 짧은판.py 낱장 <장> [<장> …]     → 최종/rs/짧은판/_낱장/f<장>.png(Remotion still)
# 왜: 4분 35초 판은 태준 얼굴이 한 사람으로 안 묶여(Claude · Fable · 그록 전수 검수, 02_콘티 10절) 그대로 못 쓴다. 전부 다시 굽기(약 6,300크레딧) 대신
#   4번 「결채」 15초처럼 받아 둔 판만으로 시작 편(밤 고백) 하나를 짧게 엮는다. 얼굴은 세 검수가 모두 같은 사람으로 본 ①무리 태준(C03 · C05 · C22 ·
#   C23 · C34)과 밤 유나(C02 · C04 · C16 · C20 · C24 · C29)만 — 다른 얼굴로 갈린 컷(C08 · C09 · C11 · C12 · C14 · C17 · C18 · C19 · C25 · C27 · C31),
#   고리 손잡이 진열대(C21), 멈춘 손(C14), 마른 머리(C28), 물보라가 약한 C32는 뺐다. 그 컷의 대사 둘(C14 민재 · 태준, C21 태준)은 화면 밖 목소리로만 쓴다.
# 이야기(둘째 판 41초): 처마 밑 「저 좋아하죠?」(시작 0.6초 — 훅) → 말문이 막힌 그 → 「좋아하냐고요」 → 시선을 떨굼 → 제목 카드(김 서린 유리 너머
#   투명 우산 · 「다 비치는 우산」 · 로고) → 회상(4:3 띠) 회식 자리에서 민재 「이 자리에 좋아하는 사람 있죠?」 위로 그녀 얼굴 → 「에이, 없어요」 위로
#   시계 심박 하트가 뛰다 손이 덮음(거짓말이 비침 · 심장 소리) → 빗길 처마 「어깨 다 젖으셨네…」(뒤에 흐리게 선 그) →
#   「제가 투명한 거 좋아하는 건 어떻게 알아요?」 → 목덜미를 문지르는 그 뒤로 그녀가 접은 투명 우산을 빼 듦 · 속말 「몰랐다 / 숨긴다고 숨긴 게, /
#   다 보이고 있었다는 걸」 → 지금: 다시 「저 좋아하죠?」 → 「다 보여요, 과장님」 → 손을 잡음 → 입맞춤 직전 위로 팩샷 · 「비 오는 날, 서로가 보이게」 · 로고.
#   원본 시작 편의 짜임(지금 → 제목 → 회상 → 지금)과 「다 보인다」 말장난은 그대로, 사무실 · 엘리베이터 · 우산 같이 쓰기 장면만 덜었다.
# 후보정 없음(결정 10-24) — 판 · 판 안 장만 고르고, 화면 처리(회상 띠 · 김 서림 · 제목 카드 뿌연 판)는 최종편집.py의 것을 그대로 쓴다.
import json
import os
import shutil
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집 as E   # noqa: E402  (판 자르기 · 화면 처리 · 경로)
import 최종소리 as S   # noqa: E402  (목소리 떼기 · 곡 · 바탕 · 섞기 도구)

C = E.C
FPS, W, H = E.FPS, E.W, E.H
OUT = os.path.join(E.OUT, "짧은판")
NAME = "다비침_짧은판"
PUB = os.path.join(E.ROOT, "최종", "자막시안_public", "rs60")
REMO = os.path.join(E.CAP, "remotion")
TIMING = os.path.join(REMO, "src", "rs", "timing60.json")

# (컷, 판, 판 안 시작 장, 장 수) — 판은 4분 35초 판(최종편집.py CUTS)과 같은 받아 둔 판, 장만 짧은 판에 맞춰 골랐다. 장은 실제 24장/초 차례.
SEQ = [
    ("C02", "rs-C02", 11, 62),        # 「저 좋아하죠?」 판 0.96–1.95 → 컷 0.50
    ("C03", "rs-C03", 24, 47),        # 말문이 막혀 입술이 열렸다 닫힘(판 1.5–2.5)
    ("C04", "rs-C04", 62, 59),        # 「좋아하냐고요」 판 3.54–4.56 → 컷 0.96(판 끝까지)
    ("C05", "rs-C05m2", 47, 53),      # 4분 판 C05의 뒤 2.2초 — 끝에서 시선을 떨굼
    ("C06", "rs-C06", 0, 67),         # 제목 카드 — 김 서린 유리 너머 투명 우산 + 「다 비치는 우산」 · 로고(원본 시작 편 6번 자리).
                                      #   둘째 판: 첫 판은 제품이 40.5초 끝 카드에서야 나와 Fable이 시계 하트(11.5초)를 상품으로 읽었다(「스마트워치 광고로 오해」) —
                                      #   원본처럼 첫 주고받음 뒤에 제품을 먼저 세운다. 뿌연 판은 4분 판(0.8–2.1초)보다 빨리(0.2–1.1초)
    ("C16", "rs-C15-16", 66, 55),     # 회상 첫 컷: 회식 자리의 그녀(두 샷 판 둘째 샷) — 위로 민재 질문(화면 밖)
    ("C15", "rs-C15h", 6, 40),        # 시계 심박 하트가 뛰다(판 0.5–1.46) 다른 손이 덮음 — 위로 「에이, 없어요」(화면 밖) · 낮은 심장 소리
    ("C20", "rs-C20n", 44, 54),       # 빗길 처마 — 「어깨 다 젖으셨네…」 판 2.50–3.65 → 컷 0.67. 셋째 판: 판 4.08초(98장)에서 끊는다 — 그 뒤 초점이 뒤 남자에게
                                      #   옮겨 가며(판 4.4–5.0) 또렷해진 얼굴이 유호님이 아니었다(유호님 11-08 「이게 왜 내가 아니고 다른사람이야?」 — 원본에서도 이 남자는
                                      #   태준). 끊은 뒤의 대사 「하나 사야겠다, 어디 있더라」 · 그의 「거기, 투명한 거요」는 뺐다 — 다음 C22 「제가 투명한 거 좋아하는 건
                                      #   어떻게 알아요?」가 그가 투명한 걸 골라 줬음을 말한다. 뒤 남자는 이 컷 내내 흐리다
    ("C22", "rs-C22", 34, 102),       # 우산 꽂이 너머 둘 — 「제가 투명한 거 …」 판 2.56–5.08 → 컷 1.14
    ("C23", "rs-C23", 1, 108),        # 목덜미를 문지르는 그 · 뒤에서 그녀가 꽂이에서 접은 투명 우산을 빼 듦(판 0–4.5초, 멈춘 장 없음) — 위로 속말 세 줄(자막).
                                      #   둘째 판: 김 서림 · 손글씨 효과를 뺐다 — 첫 판(4분 판 컷 그대로 7.96초)을 세 검수가 모두 짚음: 「24~25초에서 넘김」(Gemini) ·
                                      #   「굳은 목 손 뒤 하얗게 날아감」(그록) · 「평평한 흰 안개 + 붓 글꼴이 찍힌 자막 효과 · 멈춘 5초」(Fable)
    ("C24", "rs-C24", 40, 52),        # 다시 「저 좋아하죠?」 판 2.38–3.34 → 컷 0.71
    ("C29", "rs-C28-29", 145, 48),    # 「…과장님」 판 7.02–7.70 → 컷 0.98(앞 「다 보여요,」는 C24 끝에서 J컷)
    ("C30", "rs-C30h", 24, 59),       # 그녀 손이 그의 손을 잡음(판 1.0–3.46)
    ("C34", "rs-C34m", 12, 109),      # 입맞춤 직전 — 판 끝까지. 끝 장면: 원본 시작 편처럼 이 장면 위에 제품(펼친 두 우산 팩샷) · 표어 · 그린 로고(RS60.tsx).
                                      #   첫 판의 끝 카드(C06 김 서린 유리 너머 우산 혼자)는 「가장 슬롭한 3초 · 템플릿 엔드카드」(그록) · 「밋밋함」(Gemini) — 뺐다
]
NAMES = [s[0] for s in SEQ]
F = [0]
for s in SEQ:
    F.append(F[-1] + s[3])
TF = [f / FPS for f in F]
T = {n: TF[i] for i, n in enumerate(NAMES)}
START = {s[0]: s[2] / FPS for s in SEQ}
END_IN = 1.2     # 끝 장면(C34) 들어서 몇 초 뒤 팩샷 · 표어 · 로고가 뜨나
TITLE_IN = 0.9   # 제목 카드(C06) 들어서 몇 초 뒤 「다 비치는 우산」 · 로고가 뜨나(뿌연 판이 걷히는 1.1초 언저리)
# 오른쪽 위 작은 로고는 뺐다 — 첫 판은 30.5초부터만 떠 「워터마크가 중간에 생김」(Fable). 제목 카드 · 끝 장면이 브랜드를 맡는다


def process(name):
    if name == "C06":
        return lambda img, t: E.haze(img, t, 0.2, 1.1)
    if name == "C23":
        return lambda img, t: E.bars(img)   # 회상 띠만(김 서림 · 손글씨 · 띠 열림 없음 — 다음 컷에서 띠가 하드컷으로 걷힌다)
    return E.process(name)


def heartbeat(beats=4, bpm=112):
    """시계 하트 아래 낮은 심장 소리 — 「쿵-쿵」 두 박(60 · 48 Hz 사인 + 낮은 잡음 몸통, 빨리 줄어듦)을 bpm대로. 들리기보다 느껴지게."""
    RATE = S.RATE
    period = 60.0 / bpm
    n = int((beats * period + 0.4) * RATE)
    x = np.zeros(n, np.float32)
    rng = np.random.default_rng(5)

    def hit(at, f, dur, amp):
        k = int(dur * RATE)
        t = np.arange(k) / RATE
        env = np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.28))
        body = np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * 2 * f * t) + 0.3 * np.sin(2 * np.pi * 3 * f * t)
        thump = S.lp(rng.standard_normal(k).astype(np.float32), 180) * 2.2
        i = int(at * RATE)
        x[i:i + k] += (amp * env * (body + thump)).astype(np.float32)[:len(x) - i]

    for b in range(beats):
        t0 = b * period
        hit(t0, 62.0, 0.17, 1.0)            # 쿵
        hit(t0 + 0.23, 50.0, 0.14, 0.7)     # 쿵
    return S.lp(x, 420)   # 휴대폰 스피커에도 몸통이 들리게 배음(2 · 3배)을 남긴다


def one(i, d):
    name, pid, a, k = SEQ[i]
    out = os.path.join(d, f"{name}.mp4")
    if pid is None:
        src = os.path.join(E.OUT, "_컷", f"{name}.mp4")
        if C.frames_of(src) != k:
            raise SystemExit(f"{src}: {k}장이어야 하는데 {C.frames_of(src)}장")
        shutil.copyfile(src, out)
        print(f"{name} 4분 판 컷 그대로 {k}장 → {TF[i]:.2f}–{TF[i + 1]:.2f}초")
        return out
    have = C.frames_of(C.clip(pid))
    if a + k > have:
        raise SystemExit(f"{name} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
    C.cut_video(C.clip(pid), a, k, W, H, FPS, out)
    f = process(name)
    if f:
        E.apply(out, f)
    got = C.frames_of(out)
    if got != k:
        raise SystemExit(f"{out}: {k}장이어야 하는데 {got}장")
    print(f"{name} {pid} {a}장({a / FPS:.2f}초)부터 {k}장 → {TF[i]:.2f}–{TF[i + 1]:.2f}초{' · 화면 처리' if f else ''}")
    return out


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    for i in range(len(SEQ)):
        one(i, d)
    C.join_videos([os.path.join(d, f"{n}.mp4") for n in NAMES], os.path.join(OUT, "화면.mp4"))
    print("화면", C.frames_of(os.path.join(OUT, "화면.mp4")), "장 ·", f"{TF[-1]:.2f}초")


def sound():
    RATE = S.RATE
    total = TF[-1]
    N = int((total + 1.0) * RATE)
    V = np.zeros((N, 2), np.float32)
    M = np.zeros((N, 2), np.float32)
    B = np.zeros((N, 2), np.float32)
    L = []

    def put(track, t, x, db=0.0, fade=0.004):
        x = S.stereo(x).copy() * (10 ** (db / 20))
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
        x = S.voice(path, a, b, kind, level)
        put(V, at, x)
        if not sub:
            return
        m = x.mean(axis=1)
        n = int(0.02 * RATE)
        e = np.array([np.sqrt(np.mean(m[i:i + n] ** 2) + 1e-12) for i in range(0, len(m) - n, n)])
        db = 20 * np.log10(e + 1e-12)
        on = np.where(db > db.max() - 30)[0]
        L.append({"a": round(at + on[0] * 0.02, 3), "b": round(at + (on[-1] + 1) * 0.02, 3), "who": who, "s": text, "inner": inner})

    v = lambda key: os.path.join(S.VOX, key + "_목소리.wav")
    vi = lambda key: os.path.join(S.INNER, key + "_목소리.wav")

    def sync(cut, key, a, b, kind, level, who, text, sub=True):
        say(v(key), a, b, T[cut] + a - START[cut], kind, level, who, text, sub=sub)

    # ===== 대사(4분 판과 같은 떼기 · 같은 크기) =====
    sync("C02", "rs-C02", 0.96, 1.95, "street", -21, "유나", "저 좋아하죠?")
    sync("C04", "rs-C04", 3.54, 4.56, "street", -21, "유나", "좋아하냐고요")
    # 회식 — C14(민재 얼굴이 셋으로 갈림 · 멈춘 손)는 화면에서 빼고 목소리만: 그녀 얼굴 위로 질문, 시계 하트 위로 대답
    # 민재 질문 · 태준 대답이 같은 판의 비슷한 목소리(바탕 높이 104 · 106 Hz)라 혼잣말로 들릴 수 있어(Fable 11-08) 민재는 탁자 건너편처럼 멀고 먹먹하게(off)
    say(v("rs-C14m"), 1.00, 2.38, T["C16"] + 0.28, "off", -24, "민재", "이 자리에 좋아하는 사람 있죠?")
    say(v("rs-C14m"), 5.06, 6.42, T["C15"] + 0.06, "pub", -22, "태준", "에이, 없어요")
    put(B, T["C15"] - 0.05, S.to_rms(heartbeat(3, 112), -31))   # 시계 하트 아래 「쿵쿵」 — 거짓말이 들킴(첫 판은 하트가 「스티커」 · 「한 번에 안 읽힘」)
    sync("C20", "rs-C20n", 2.42, 3.72, "street", -22, "유나", "어깨 다 젖으셨네…")   # 셋째 판: 줄 앞 덩어리만(판 2.50–3.65) — 컷이 초점 이동 전에 끝난다
    sync("C22", "rs-C22", 2.56, 5.08, "store", -22, "유나", "제가 투명한 거 좋아하는 건 어떻게 알아요?")
    # C23 속말 세 줄 — 김 서림 손글씨를 뺐으니 자막(속말 결)으로
    say(vi("rs-말-태준-1"), 0.80, 1.56, T["C23"] + 0.10, "inner", -23, "태준", "몰랐다", inner=True)
    say(vi("rs-말-태준-1"), 2.96, 4.36, T["C23"] + 0.95, "inner", -23, "태준", "숨긴다고 숨긴 게,", inner=True)
    say(vi("rs-말-태준-1"), 5.46, 7.07, T["C23"] + 2.45, "inner", -23, "태준", "다 보이고 있었다는 걸", inner=True)
    sync("C24", "rs-C24", 2.38, 3.34, "street", -21, "유나", "저 좋아하죠?")
    say(v("rs-C28-29"), 2.16, 3.16, T["C29"] - 0.42, "street", -22, "유나", "다 보여요,")   # 화면 밖 J컷(원본 「끝 0.4초에 그녀 말이 먼저」)
    sync("C29", "rs-C28-29", 7.02, 7.70, "street", -22, "유나", "과장님")
    # 「다 보여요,」 · 「과장님」은 한 자막으로(1초 사이 두 줄이 깜빡이지 않게)
    k = next(i for i, l in enumerate(L) if l["s"] == "다 보여요,")
    if L[k + 1]["s"] == "과장님":
        L[k:k + 2] = [{**L[k], "b": L[k + 1]["b"], "s": "다 보여요, 과장님"}]

    # ===== 곡(4분 판과 같은 세 곡 — stable-audio-3) =====
    cello = S.load(os.path.join(S.MUS, "첼로_a.wav"), True)
    piano = S.load(os.path.join(S.MUS, "피아노_a.wav"), True)

    def music(src, s0, s1, at, fin, fout, level, gain_db=None):
        x = S.fades(src[int(s0 * RATE):int(s1 * RATE)].copy(), fin, fout)
        g = gain_db if gain_db is not None else level - S.rms_db(src[int(s0 * RATE):int(s1 * RATE)])
        put(M, at, x * 10 ** (g / 20))
        return g

    # 말문이 막힌 얼굴(C05)에 피아노 동기 → 회상 빗길(C20)에서 첼로 주제가 넘겨받아 손글씨 · 띠 열림(C23 끝)에 풀림 → 지금은 빗소리만 →
    #   손을 잡는 C30에서 같은 첼로가 다시 부풀고(곡 33–36초), 끝 카드에서 곡의 맺음(89–93.4초)으로 건너 끝 장에 거의 사라짐
    p_at = T["C05"] + 0.9
    music(piano, 0.0, T["C20"] + 2.2 - p_at, p_at, 0.25, 1.8, -27)
    music(cello, 9.7, 9.7 + (T["C24"] + 0.3 - (T["C20"] - 0.1)), T["C20"] - 0.1, 2.0, 2.2, -24)
    tail = 93.4 - 89.0
    tail_at = total - tail + 0.05
    fg = music(cello, 33.0, 33.0 + (tail_at + 0.5 - T["C30"]), T["C30"], 0.8, 0.5, -21)
    music(cello, 89.0, 93.4, tail_at, 0.5, 0.4, 0, gain_db=fg)   # 끝 장면 글이 뜨는 동안 곡의 맺음으로 건너 끝 장에 거의 사라짐

    # ===== 바탕 =====
    def bed(a, b, x, level, fin=0.45, fout=0.5, lpf=None, hpf=None):
        x = S.loop_to(S.stereo(x), b - a + 0.01)
        x = S.lp(x, lpf) if lpf else S.lp(x, 12000, order=2)
        if hpf:
            x = S.hp(x, hpf)
        x = S.fades(S.to_rms(x, level), fin, fout)
        put(B, a, x, fade=0.002)

    rain = S.load(S.RAIN_CITY, True)
    window = S.load(S.RAIN_WIN, True)
    drips = S.load(S.DRIPS)
    bed(0.0, T["C06"] + 0.3, rain[int(5 * RATE):], -35, fin=0.05, fout=0.3)           # 밤비 · 처마 밑
    bed(0.0, T["C06"], drips, -48, lpf=6000)
    bed(T["C06"], T["C16"] + 0.2, rain[int(40 * RATE):], -42, fin=0.3, fout=0.3, lpf=2500)   # 제목 카드 — 유리 너머 먹먹하게(4분 판과 같은 결)
    bed(T["C16"] - 0.1, T["C20"] + 0.25, S.load(S.PUB, True)[int(60 * RATE):], -39, fin=0.3, lpf=7000)   # 회식 웅성
    bed(T["C20"] - 0.2, T["C22"] + 0.3, rain[int(70 * RATE):], -34)                    # 빗길 처마
    bed(T["C20"], T["C22"], drips, -48, lpf=6000)
    bed(T["C22"], T["C24"], window, -43, lpf=1800)                                     # 가게 안 — 창의 비 · 냉장고
    bed(T["C22"], T["C24"], S.load(S.FRIDGE, True)[int(30 * RATE):], -49, lpf=900)
    bed(T["C24"], total + 0.3, rain[int(95 * RATE):], -35, fin=0.4, fout=1.6)         # 지금 — 처마 밑(끝 장면 위로 잦아듦)
    bed(T["C24"], total, drips, -48, lpf=6000, fout=1.2)

    # ===== 섞기(4분 판과 같은 대사 아래 곡 낮춤 · 압축) =====
    vm = np.abs(V).max(axis=1)
    hop = int(0.01 * RATE)
    act = np.array([vm[i:i + hop].max() for i in range(0, N, hop)]) > 10 ** (-40 / 20)
    g = np.where(act, 10 ** (-9 / 20), 1.0).astype(np.float32)
    a_att, a_rel = 1 - np.exp(-1 / (0.15 * 100)), 1 - np.exp(-1 / (0.45 * 100))
    out_g = np.ones_like(g)
    cur = 1.0
    for i, tgt in enumerate(g):
        cur += (tgt - cur) * (a_att if tgt < cur else a_rel)
        out_g[i] = cur
    duck = np.repeat(out_g, hop)[:N][:, None]
    bduck = 1 - (1 - duck) * 0.55
    mix = C.Mix(total + 1.0)
    Vc = S.compress(V, thr_db=-32.0, ratio=3.0, att=0.003, rel=0.12)
    Vc *= 10 ** ((S.rms_db(V) - S.rms_db(Vc)) / 20)
    mix.a[:N] = S.compress(Vc + M * duck + B * bduck)
    os.makedirs(OUT, exist_ok=True)
    mix.finish(os.path.join(OUT, "소리.wav"), boost_db=0.0)
    meta = {"frames": F[-1], "F": F, "names": NAMES, "lines": L,
            "title": [T["C06"] + TITLE_IN, T["C16"]], "end": T["C34"] + END_IN}
    json.dump(meta, open(TIMING, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for l in L:
        print(f"  {l['a']:6.2f}–{l['b']:6.2f} {l['who']} {l['s']}")


def publish():
    os.makedirs(PUB, exist_ok=True)
    for src, to in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav")):
        dst = os.path.join(PUB, to)
        if not os.path.exists(dst) or C.md5(src) != C.md5(dst):
            shutil.copyfile(src, dst)
    E.publish()   # 로고(rs/logo_*.png)는 4분 판과 같은 그린 획


def stills(*frames):
    publish()
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    for f in frames:
        C.run(shutil.which("npx"), "remotion", "still", "src/index.ts", "rs60", os.path.join(d, f"f{int(f):04d}.png"), f"--frame={int(f)}", "--log=error", cwd=REMO)
    print(d)


def render(jobs=3):
    publish()
    out, raw = os.path.join(OUT, NAME + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", "rs60", raw, f"--concurrency={jobs}", "--log=error", cwd=REMO)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--리미터", "0.74", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "26", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(OUT, NAME + "_폰.mp4"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()
