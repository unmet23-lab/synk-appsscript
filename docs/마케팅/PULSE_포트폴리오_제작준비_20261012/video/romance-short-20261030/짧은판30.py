# 로맨스 「다 비침」 30초 판(2026-11-08, Claude) — 유호님 「지금 약간 내용이 잘 이해가 안가거든? 필요없고 이해 못하는 부분 빼서 30초 내외로
#   만들어볼수있어? 처음 10초는 참 괜찮은데 이 이후로 뭔 스토리인지 잘 모르겠어」. 받아 둔 판만(새로 굽지 않음, 크레딧 0).
# 왜 안 읽혔나: 38초 판(짧은판.py)은 제목 카드 뒤 회상이 회식(민재 질문 · 시계) → 빗길(「어깨 다 젖으셨네…」, 그는 멀리 흐림) → 가게
#   (「제가 투명한 거 좋아하는 건 어떻게 알아요?」, 앞 장면 없이) → 속말 → 다시 「저 좋아하죠?」로 15초 안에 세 곳을 2~4초씩 오갔다. 어느 회상도
#   「그가 숨긴 게 어떻게 보였나」를 끝까지 보여 주지 않아, 처음 10초(묻고 · 말 못 하고 · 다시 묻고 · 시선을 떨굼)의 물음에 답이 이어지지 않았다.
# 고침: 처음 10초 · 제목 카드 · 끝(손 「다 보여요,」 → 「…과장님」 → 입맞춤 위 팩샷)은 그대로 두고, 회상을 한 줄기로 줄인다. 어느 줄기가 낯선 사람에게
#   읽히는지는 판 셋을 서로 모르게 시험해 고른다(Gemini 영상+소리 맹검 — 한 문장 요약 · 막히는 곳).
#   가 「회식 속말」: 시계 하트가 뛰다 손이 덮음 + 속말 「몰랐다 / 숨긴다고 숨긴 게,」 → 그를 바라보는 그녀 + 「다 보이고 있었다는 걸」 → 다시 「저 좋아하죠?」
#   나 「가게」: 「제가 투명한 거 좋아하는 건 어떻게 알아요?」 → 목덜미를 문지르는 그 뒤로 그녀가 투명 우산을 빼 듦 + 속말 세 줄
#   다 「회식 대사 + 가게 속말」: 민재 「이 자리에 좋아하는 사람 있죠?」 · 시계 「에이, 없어요」 → 목덜미 그 + 속말 세 줄(38초 판에서 빗길 · 가게 물음 · 되물음만 뺀 판)
#   python -X utf8 짧은판30.py <판> [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/rs/짧은판30/<판>/다비침_30초_<판>.mp4 · _보내기.mp4
# 얼굴 · 판 고르기 · 대사 떼기는 38초 판과 같다(①무리 태준 · 밤 유나, 다른 얼굴로 갈린 컷은 쓰지 않음, 빌린 말은 입이 안 보이는 컷 위에만 — 02_콘티 10 · 11절).
# 후보정 없음(결정 10-24) — 화면 처리(회상 띠 · 제목 카드 뿌연 판)는 최종편집.py 것을 그대로 쓴다.
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
from 짧은판 import heartbeat   # noqa: E402  (시계 하트 아래 낮은 심장 소리)

C = E.C
FPS, W, H = E.FPS, E.W, E.H
OUT0 = os.path.join(E.OUT, "짧은판30")
PUB = os.path.join(E.ROOT, "최종", "자막시안_public", "rs30")
REMO = os.path.join(E.CAP, "remotion")
TIMING = os.path.join(REMO, "src", "rs", "timing30.json")
END_IN = 1.2     # 끝 장면(C34) 들어서 몇 초 뒤 팩샷 · 표어 · 로고가 뜨나
TITLE_IN = 0.9   # 제목 카드(C06) 들어서 몇 초 뒤 「다 비치는 우산」 · 로고가 뜨나

# (컷, 판, 판 안 시작 장, 장 수) — 38초 판과 같은 판 · 같은 장(장은 실제 24장/초 차례)
OPEN = [
    ("C02", "rs-C02", 11, 62),        # 「저 좋아하죠?」
    ("C03", "rs-C03", 24, 47),        # 말문이 막힘
    ("C04", "rs-C04", 62, 59),        # 「좋아하냐고요」
    ("C05", "rs-C05m2", 47, 53),      # 시선을 떨굼
]
TITLE = [("C06", "rs-C06", 0, 67)]    # 제목 카드 — 김 서린 유리 너머 투명 우산 · 「다 비치는 우산」 · 로고
TAIL = [
    ("C30", "rs-C30h", 24, 59),       # 그녀 손이 그의 손을 잡음 — 위로 「다 보여요,」(화면 밖, 입이 안 보이는 컷)
    ("C29", "rs-C28-29", 150, 43),    # 「…과장님」(그녀 입이 실제로 이 말을 함)
    ("C34", "rs-C34m", 12, 109),      # 입맞춤 직전 + 팩샷 · 표어 · 로고(RS60.tsx End)
]
V = {
    "가": {"이름": "회식 속말", "back": "C24",
          "mid": [("C15", "rs-C15h", 0, 60),       # 하트가 뛰다(판 0–1.46초) 다른 손이 덮음(판 1.5초) — 덮은 뒤 1초
                  ("C16", "rs-C15-16", 66, 55),    # 맥주잔을 든 그녀가 그를 바라봄(앞 흐린 어깨가 그)
                  ("C24", "rs-C24", 40, 52)]},     # 지금: 다시 「저 좋아하죠?」
    "나": {"이름": "가게", "back": "C30",
          "mid": [("C22", "rs-C22", 34, 102),      # 우산 걸이 너머 둘 — 「제가 투명한 거 좋아하는 건 어떻게 알아요?」
                  ("C23", "rs-C23", 1, 108)]},     # 목덜미를 문지르는 그 · 뒤에서 그녀가 투명 우산을 빼 듦
    "다": {"이름": "회식 대사 + 가게 속말", "back": "C30",
          "mid": [("C16", "rs-C15-16", 66, 55),    # 그녀 위로 민재 질문(화면 밖)
                  ("C15", "rs-C15h", 6, 40),       # 시계 하트 위로 「에이, 없어요」 · 손이 덮음
                  ("C23", "rs-C23", 1, 108)]},     # 목덜미 그 + 속말 세 줄
    # 라 · 마 — 첫 맹검(가 이해 8 · 나 7 · 다 9) 뒤: 「다」가 가장 잘 읽혔으나 시험관이 민재 질문을 「여자가 묻자」로 들었다 — 화면 밖 남자 목소리를
    #   그녀 얼굴(C16) 위에 얹어서다(빌린 말은 보이는 입 위에 두지 않는다 — 11-08 「다 보여요」와 같은 결). 질문 · 대답을 둘 다 시계 컷(입 없음)으로 옮긴다:
    #   하트가 뛰는 동안 「이 자리에 좋아하는 사람 있죠?」 → 손이 덮으며 「에이, 없어요」 → 그를 바라보는 그녀(말 없음) → 목덜미 그 + 속말.
    #   세 시험관 모두 9~11초 제목 카드에서 흐름이 끊긴다(이탈 지점)고 해 제목 카드가 있는 판(라) · 없는 판(마)을 견준다 — 없는 판은 제품을 가게의 투명 우산 ·
    #   끝 팩샷 · 표어 · 로고가 맡는다.
    "라": {"이름": "회식 대사(시계 위) + 가게 속말 · 제목 카드", "back": "C30", "title": True,
          "mid": [("C15", "rs-C15h", 0, 72),       # 하트가 뛰다(판 0–1.25초) 손이 덮음(1.25–1.6초) — 질문 · 대답 둘 다 이 컷 위
                  ("C16", "rs-C15-16", 66, 55),    # 그를 바라보는 그녀(말 없음)
                  ("C23", "rs-C23", 1, 108)]},     # 목덜미 그 · 뒤에서 투명 우산을 빼 드는 그녀 + 속말 세 줄
    "마": {"이름": "회식 대사(시계 위) + 가게 속말 · 제목 카드 없음", "back": "C30", "title": False,
          "mid": [("C15", "rs-C15h", 0, 72),
                  ("C16", "rs-C15-16", 66, 55),
                  ("C23", "rs-C23", 1, 108)]},
}
# 최종 = 마(27.79초). 고른 까닭: 맹검 넷(Gemini 영상+소리 · 아르곤 · Fable · 그록)이 모두 9~11초 제목 카드를 이탈 · 「광고가 끝난 줄」 지점으로 꼽았다
#   (가 · 나 · 다 · 라 Gemini 넷 다, 라 Fable 1번 · 그록 4번). 제품은 가게의 투명 우산 · 끝 팩샷 · 표어 · 로고가 맡는다.
#   마 판 맹검 뒤 고친 것: 흰 셔츠 위 속말 자막이 묻힘(Fable · 그록) → RS60.tsx에서 속말일 때만 아래 띠를 짙게 · 글자 그림자를 세게.
V["최종"] = dict(V["마"], 이름="최종 — 마 + 속말 자막 대비", 대사="마")   # 대사 · 소리 짜임은 마와 같다(대사 = 어느 판의 줄을 쓰나)


def plan(key):
    seq = OPEN + (TITLE if V[key].get("title", True) else []) + V[key]["mid"] + TAIL
    names = [s[0] for s in seq]
    F = [0]
    for s in seq:
        F.append(F[-1] + s[3])
    T = {n: F[i] / FPS for i, n in enumerate(names)}
    start = {s[0]: s[2] / FPS for s in seq}
    return seq, names, F, T, start


def process(name):
    if name == "C06":
        return lambda img, t: E.haze(img, t, 0.2, 1.1)
    if name == "C23":
        return lambda img, t: E.bars(img)   # 회상 띠만(김 서림 · 손글씨 · 띠 열림 없음 — 38초 판 둘째 판과 같음)
    return E.process(name)


def out_dir(key):
    return os.path.join(OUT0, key)


def picture(key):
    seq, names, F, T, _ = plan(key)
    d = os.path.join(out_dir(key), "_컷")
    os.makedirs(d, exist_ok=True)
    for i, (name, pid, a, k) in enumerate(seq):
        out = os.path.join(d, f"{name}.mp4")
        have = C.frames_of(C.clip(pid))
        if a + k > have:
            raise SystemExit(f"{name} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
        C.cut_video(C.clip(pid), a, k, W, H, FPS, out)
        f = process(name)
        if f:
            E.apply(out, f)
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        print(f"{name} {pid} {a}장({a / FPS:.2f}초)부터 {k}장 → {F[i] / FPS:.2f}–{F[i + 1] / FPS:.2f}초{' · 화면 처리' if f else ''}")
    C.join_videos([os.path.join(d, f"{n}.mp4") for n in names], os.path.join(out_dir(key), "화면.mp4"))
    print("화면", C.frames_of(os.path.join(out_dir(key), "화면.mp4")), "장 ·", f"{F[-1] / FPS:.2f}초")


def sound(key):
    seq, names, F, T, START = plan(key)
    RATE = S.RATE
    total = F[-1] / FPS
    N = int((total + 1.0) * RATE)
    Vx = np.zeros((N, 2), np.float32)
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

    def say(path, a, b, at, kind, level, who, text, inner=False):
        x = S.voice(path, a, b, kind, level)
        put(Vx, at, x)
        m = x.mean(axis=1)
        n = int(0.02 * RATE)
        e = np.array([np.sqrt(np.mean(m[i:i + n] ** 2) + 1e-12) for i in range(0, len(m) - n, n)])
        db = 20 * np.log10(e + 1e-12)
        on = np.where(db > db.max() - 30)[0]
        L.append({"a": round(at + on[0] * 0.02, 3), "b": round(at + (on[-1] + 1) * 0.02, 3), "who": who, "s": text, "inner": inner})

    v = lambda k: os.path.join(S.VOX, k + "_목소리.wav")
    vi = lambda k: os.path.join(S.INNER, k + "_목소리.wav")

    def sync(cut, k, a, b, kind, level, who, text):
        say(v(k), a, b, T[cut] + a - START[cut], kind, level, who, text)

    def inner(a, b, at, text):
        say(vi("rs-말-태준-1"), a, b, at, "inner", -23, "태준", text, inner=True)

    # ===== 대사(38초 판과 같은 떼기 · 같은 크기) =====
    sync("C02", "rs-C02", 0.96, 1.95, "street", -21, "유나", "저 좋아하죠?")
    sync("C04", "rs-C04", 3.54, 4.56, "street", -21, "유나", "좋아하냐고요")
    줄 = V[key].get("대사", key)   # 판 이름과 대사 짜임을 떼어 둔다(최종 = 마의 대사)
    if 줄 == "가":
        # 속말이 회상을 이끈다 — 하트를 덮는 손 위에 「숨긴다고 숨긴 게,」, 그를 바라보는 그녀 위에 「다 보이고 있었다는 걸」
        inner(0.80, 1.56, T["C15"] + 0.15, "몰랐다")
        inner(2.96, 4.36, T["C15"] + 1.00, "숨긴다고 숨긴 게,")
        put(B, T["C15"] - 0.05, S.to_rms(heartbeat(3, 112), -31))   # 하트가 뛰는 동안만 「쿵쿵」, 손이 덮으면 멎는다
        inner(5.46, 7.07, T["C16"] + 0.20, "다 보이고 있었다는 걸")
        sync("C24", "rs-C24", 2.38, 3.34, "street", -21, "유나", "저 좋아하죠?")
    if 줄 == "나":
        sync("C22", "rs-C22", 2.56, 5.08, "store", -22, "유나", "제가 투명한 거 좋아하는 건 어떻게 알아요?")
    if 줄 == "다":
        say(v("rs-C14m"), 1.00, 2.38, T["C16"] + 0.28, "off", -24, "민재", "이 자리에 좋아하는 사람 있죠?")
        say(v("rs-C14m"), 5.06, 6.42, T["C15"] + 0.06, "pub", -22, "태준", "에이, 없어요")
        put(B, T["C15"] - 0.05, S.to_rms(heartbeat(3, 112), -31))
    if 줄 in ("라", "마"):
        # 질문은 하트가 뛰는 동안(탁자 건너편처럼 멀고 먹먹하게), 대답은 손이 하트를 덮는 때(판 1.25–1.6초) — 둘 다 입이 없는 시계 컷 위
        say(v("rs-C14m"), 1.00, 2.38, T["C15"] + 0.08, "off", -24, "민재", "이 자리에 좋아하는 사람 있죠?")
        put(B, T["C15"] - 0.05, S.to_rms(heartbeat(3, 112), -31))
        say(v("rs-C14m"), 5.06, 6.42, T["C15"] + 1.50, "pub", -22, "태준", "에이, 없어요")
    if 줄 in ("나", "다", "라", "마"):
        inner(0.80, 1.56, T["C23"] + 0.10, "몰랐다")
        inner(2.96, 4.36, T["C23"] + 0.95, "숨긴다고 숨긴 게,")
        inner(5.46, 7.07, T["C23"] + 2.45, "다 보이고 있었다는 걸")
    say(v("rs-C28-29"), 2.16, 3.16, T["C30"] + 0.55, "street", -22, "유나", "다 보여요,")   # 손 잡는 컷 위(화면 밖)
    sync("C29", "rs-C28-29", 7.02, 7.70, "street", -22, "유나", "과장님")

    # ===== 곡(38초 판과 같은 곡) — 시선을 떨굼(C05)에 피아노 → 회상 내내 → 지금으로 돌아오며 잦아듦 → 손을 잡는 C30에서 첼로가 부풀어 끝의 맺음으로 =====
    cello = S.load(os.path.join(S.MUS, "첼로_a.wav"), True)
    piano = S.load(os.path.join(S.MUS, "피아노_a.wav"), True)

    def music(src, s0, s1, at, fin, fout, level, gain_db=None):
        x = S.fades(src[int(s0 * RATE):int(s1 * RATE)].copy(), fin, fout)
        g = gain_db if gain_db is not None else level - S.rms_db(src[int(s0 * RATE):int(s1 * RATE)])
        put(M, at, x * 10 ** (g / 20))
        return g

    back = V[key]["back"]
    p_at = T["C05"] + 0.9
    music(piano, 0.0, T[back] + 0.3 - p_at, p_at, 0.25, 1.8, -27)
    tail = 93.4 - 89.0
    tail_at = total - tail + 0.05
    fg = music(cello, 33.0, 33.0 + (tail_at + 0.5 - T["C30"]), T["C30"], 0.8, 0.5, -21)
    music(cello, 89.0, 93.4, tail_at, 0.5, 0.4, 0, gain_db=fg)

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
    pub = S.load(S.PUB, True)
    fridge = S.load(S.FRIDGE, True)
    has_title = "C06" in names
    first = names[names.index("C06") + 1] if has_title else names[names.index("C05") + 1]   # 회상 첫 컷
    now_end = T["C06"] if has_title else T[first]
    bed(0.0, now_end + 0.3, rain[int(5 * RATE):], -35, fin=0.05, fout=0.3)            # 밤비 · 처마 밑
    bed(0.0, now_end, drips, -48, lpf=6000)
    if has_title:
        bed(T["C06"], T[first] + 0.2, rain[int(40 * RATE):], -42, fin=0.3, fout=0.3, lpf=2500)   # 제목 카드 — 유리 너머 먹먹하게
    flash = [n for n in names if n in E.FLASH]
    pub_cuts = [n for n in flash if n in ("C15", "C16")]
    store_cuts = [n for n in flash if n in ("C22", "C23")]
    nxt = lambda n: names[names.index(n) + 1]
    if pub_cuts:
        a, b = T[pub_cuts[0]], T[nxt(pub_cuts[-1])]
        bed(a - 0.1, b + 0.25, pub[int(60 * RATE):], -39, fin=0.3, lpf=7000)              # 회식 웅성
    if store_cuts:
        a, b = T[store_cuts[0]], T[nxt(store_cuts[-1])]
        bed(a, b, window, -43, lpf=1800)                                                  # 가게 안 — 창의 비 · 냉장고
        bed(a, b, fridge[int(30 * RATE):], -49, lpf=900)
    bed(T[back], total + 0.3, rain[int(95 * RATE):], -35, fin=0.4, fout=1.6)             # 지금 — 처마 밑(끝 장면 위로 잦아듦)
    bed(T[back], total, drips, -48, lpf=6000, fout=1.2)

    # ===== 섞기(38초 판과 같은 대사 아래 곡 낮춤 · 압축) =====
    vm = np.abs(Vx).max(axis=1)
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
    Vc = S.compress(Vx, thr_db=-32.0, ratio=3.0, att=0.003, rel=0.12)
    Vc *= 10 ** ((S.rms_db(Vx) - S.rms_db(Vc)) / 20)
    mix.a[:N] = S.compress(Vc + M * duck + B * bduck)
    os.makedirs(out_dir(key), exist_ok=True)
    mix.finish(os.path.join(out_dir(key), "소리.wav"), boost_db=0.0)
    meta = {"판": key, "frames": F[-1], "F": F, "names": names, "lines": L,
            "title": [T["C06"] + TITLE_IN, T[first]] if has_title else [0, 0], "end": T["C34"] + END_IN}
    json.dump(meta, open(os.path.join(out_dir(key), "timing30.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for l in L:
        print(f"  {l['a']:6.2f}–{l['b']:6.2f} {l['who']} {l['s']}")


def publish(key):
    os.makedirs(PUB, exist_ok=True)
    for src, to in ((os.path.join(out_dir(key), "화면.mp4"), "picture.mp4"), (os.path.join(out_dir(key), "소리.wav"), "sound.wav")):
        shutil.copyfile(src, os.path.join(PUB, to))
    shutil.copyfile(os.path.join(out_dir(key), "timing30.json"), TIMING)
    E.publish()   # 로고 · 팩샷(rs/*.png)은 4분 판과 같은 것


def render(key, jobs=3):
    publish(key)
    name = f"다비침_30초_{key}"
    out, raw = os.path.join(out_dir(key), name + ".mp4"), os.path.join(out_dir(key), "_렌더.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", "rs30", raw, f"--concurrency={jobs}", "--log=error", cwd=REMO)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--리미터", "0.74", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(out_dir(key), name + "_보내기.mp4"))
    print(out)


if __name__ == "__main__":
    key = sys.argv[1]
    if key not in V:
        raise SystemExit(f"판은 {' · '.join(V)} 중 하나")
    what = sys.argv[2:] or ["화면", "소리", "판"]
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w](key)
