# 8번 「캐스팅북」 소리(2026-11-07, Claude) — 최종편집.py 「소리」가 부른다. 02_콘티 1 · 2절 소리 줄을 받은 판 · 화면 시각에 맞춰 놓는다.
#   사람 소리: 1번 한숨 · 「음…」 = 다시 낸 p8-01c가 낸 시댄스 소리(Demucs로 뗌 — 제작 규칙 「말 아닌 소리도 첫 시도는 시댄스」),
#     19번 손님 「포스터 보고 왔어요」 = (가) p8-19b 시댄스 목소리(기본) · (나) 일레븐 v4(목소리후보.py) — 유호님이 고르신다. 손님은 뒷모습이라 말 자리를 콘티 시각(23.8초)으로 옮긴다.
#     19번 소연 웃음 = p8-19b 판 소리(판 안 자리 그대로 — 얼굴이 웃는 장에).
#   내레이션: 일레븐 v4 후보(목소리후보.py) 가운데 고른 판 — 「손님을 부르는 모델」 26.72초 · 쉼 · 「펄스 캐스팅북에서」 28.45초(콘티 1절).
#   노래: 곡후보(허깅페이스 ZeroGPU)에서 맹검으로 고른 곡 — 4.10초 시작, 19.5~20.3초 한 박 숨, 22.4초부터 고조, 28.0초 한 박 멈춤(콘티 1절).
#   효과음: 녹음 모음(Fairlight · Sonniss — 상업 이용 가능)을 화면 사건 장에 놓는다. 판이 낸 효과음은 5 · 7 · 8 · 11번에 피아노가 깔려 있어 쓰지 않는다(Gemini 듣기 11-07).
#   MMAudio는 체크포인트가 비상업이라 쓰지 않는다. 일레븐 효과음은 웹 로그인 · 키 권한이 없어 못 쓴다(11-07).
import json
import os
import subprocess

import numpy as np
import scipy.signal as S

import 최종편집공통 as C

RATE = C.RATE
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p8/소리"
VOX = os.path.join(ROOT, "목소리")
CAND = os.path.join(ROOT, "목소리후보")
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
FAIR = os.path.join(LIB, "fairlight", "Media Files")
SON = os.path.join(LIB, "sonniss_gdc2026", "풀림")
END = 30.0

# 고르기(유호님) — 기본은 시댄스 손님 · 내레이터는 맹검 1위로 바꿔 넣는다
GUEST = os.environ.get("P8_GUEST", "시댄스")          # 시댄스 | 수리 | 코코 | 루나
NARR = os.environ.get("P8_NARR", "아이작")            # 아이작 | 에스엠 | 애셔 | 헨리
# 곡: 곡후보.py(허깅페이스 ZeroGPU stable-audio-3 연주곡 셋) 가운데 나1 — 소리 맹검 두 번(Gemini Lite 둘, 순서 바꿈)이 모두 1위
#   (「진짜 연주 같음」 8 · 7점, 「이 광고에 맞음」 9 · 9점 — Flash 무료 몫이 다 차 Lite로 들음). 83.4 BPM, 곡 4.21초를 편집 4.10초에 두면 곡 박이 6.00초,
#   곡 22.6초 오름이 콘티 고조 22.4초에 온다. 가사 노래(ACE-Step)는 GPU 중단으로 0판 — 콘티의 「There you are」 노래는 이번 판에 없다.
SONG = os.environ.get("P8_SONG", "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p8/소리/곡후보/나1.wav")
SONG_AT = float(os.environ.get("P8_SONG_AT", "4.21"))   # 곡의 몇 초를 편집 4.10초에 놓나
SONG_END = (48.3, 49.4)   # 곡의 마지막 치기를 찾을 자리(초) — 28.0초 한 박 멈춤 뒤 끝 화면(28.43초)에 이어 붙인다

# ---------- 초반 말(11-08 — 02_콘티 9절 · 슬롭 점검표 30번) ----------
#   원본은 4.2초부터 여자 목소리 가사 노래 · 17.35초 주인공 혼잣말이 끌던 0~19초가, 곡이 연주곡이 되며 말 · 가사 · 글 하나 없이 비었다.
#   내레이션_초반.py가 원고 전체를 한 번에 구운 판(일레븐 v4)을 받아쓰기(Scribe) 낱말 사이 가장 조용한 20ms에서 잘라, 토막 첫 낱말을 화면 초에 놓는다
#   (10번 21절 · 현장노트 영상 「한 번에 구운 내레이션을 토막으로 놓을 때 … 받아쓰기 낱말 시작에 맞춘다」). P8_OPEN=""이면 v5 소리 그대로.
OPEN_DIR = os.path.join(ROOT, "내레이션초반")
#   칸나_E11 — 목소리 넷(수리 · 한 · 수지 · 칸나)을 같은 자리에 놓은 이름 가린 Gemini 3.7 Flash 맹검 두 번(순서 바꿈) 모두 칸나 1위(31 · 31).
#   「광고」를 넣은 칸나_C는 둘째 줄이 1.78초라 4.88초까지 가 두 검수자가 비우라 한 4번 컷(눈 멎음 · 곡 들어옴)을 덮어 「광고」를 뺐고(Fable 대비책 · Opus 고친 판),
#   1위 까닭이던 「얘면」 앞 헛웃음은 꼬리표로 살려 씨앗 셋(E11 · E23 · E37)을 구웠다. 무료 키 Flash 몫이 다 차 Lite 둘에 순서를 바꿔 물으니 E11이 35 · 34(두 번 1 · 2위),
#   E23은 23 · 35로 갈렸다(「얘면이 애면처럼 뭉개짐」). git 밖 최종/p8/_검수/속마음목소리_* · 칸나E세판_*.
OPEN = os.environ.get("P8_OPEN", "칸나_E11")
OPEN_WHO = "소연"        # 속말이면 소연(자막 inner) — 내레이터 원고면 「내레이션」
OPEN_LVL = -20.0         # 한 판 전체 RMS(dBFS) — 끝 내레이션(−19) · 손님(−21) 사이
# (첫 낱말을 놓을 화면 초, 그 아래 곡 전체를 내릴 dB, 목소리 띠 250~4000 Hz를 더 내릴 dB, [(자막 글, 그 화면 마지막 낱말 머리)], 자막 가운데 x 또는 None)
#   자리는 원고 맹검(Fable 고친 판)대로 — 4.1~9초(곡이 들어오고 눈이 멈춤 · 쇼핑백 얼굴 → 폰 얼굴 그림 라임)와 12~15초(집중 · 빠른 사진 격자),
#   19.1~21.8초(화면 글 1 · 2)는 말 없이 둔다. 12번 컷(15.83~16.67 「딸기 라떼 신메뉴」 폰 글)에 말이 걸리지 않게 냉장고 줄은 10번 끝에서 J컷으로 들어간다.
#   자막 자리(다섯째 칸) — 「L」 속말 왼쪽 기둥(글 왼쪽 끝 x 176) · 「R」 오른쪽 거울 자리(글 오른쪽 끝 1744) · None 가운데.
#   11-08 Fable 자막 검수: 첫 판은 컷마다 가운데 · x 470 · 330 · 1720(가운데 기준)으로 옮겨 「자막이 떠돈다」 → 속말은 한 기둥, 사람 말만 가운데.
#   첫 칸이 ("끝", 초)이면 그 줄 마지막 낱말이 그 초에 끝나게 놓는다(둘째 줄 — 4.45초 곡의 첫 큰 박 앞에서 끝나게, 목소리마다 줄 길이가 달라서).
OPEN_AT = [
    (0.90, 0.0, 0.0, [("거꾸로 봐도 손님이 없네", "없네")], "L"),           # 기 — 1 거꾸로 얼굴(0.5초 한숨 뒤) → 2 빈 가게 와이드. 곡 전(바탕 소리뿐)
    (("끝", 4.50), 0.0, 0.0, [("모델 쓰면 좀 오려나", "오려나")], "L"),     # 기 — 3 캐스팅북 모델 목록. 곡은 4.10에 작게 들어와 4.56에 첫 큰 박(83.4 BPM 격자, 6.00 박의 두 박 앞) — 그 앞에서 끝나 곡을 내리지 않는다
    (7.60, -3.0, -6.0, [("어디서 봤더라", "봤더라")], "R"),                  # 승 — 5 쇼핑백 얼굴 직후 6 폰 속 같은 얼굴(보는 사람이 먼저 답을 안다), 8.79 일어남 · 삐걱 앞. 폰 속 얼굴이 화면을 채워 자막은 오른쪽 거울 자리
    (11.50, -3.0, -10.0, [("저 집은 좋겠다", "좋겠다")], "L"),              # 승 — 8 포스터 앞에 멈춰 선 두 행인 → 9 사장 얼굴(그림이 못 하는 「부럽다」). 곡 멜로디가 목소리 띠에 가장 찬 자리라 띠만 더 비운다
    (15.12, -3.0, -6.0, [("우리 냉장고에도?", "냉장고에도")], "L"),         # 승 — 11 내 가게 냉장고 스티커(15.17 — 「냉장고」가 11번에 떨어지고 자막도 11번 첫 장부터, 12번 폰 글은 첫 0.2초만 걸침)
    (17.65, -3.0, -8.0, [("얘면 손님 오겠다", "오겠다")], "L"),             # 승→전 — 14 빠져든 얼굴. 오려나 → 오겠다 → 23.8 손님 「포스터 보고 왔어요」 → 26.7 「손님을 부르는 모델」
]
SUB_COL = {"L": ("left", 176), "R": ("right", 1744), None: ("center", 960)}
# 곡 내림(둘째 · 셋째 칸 = 곡 전체 dB · 목소리 띠 250~4000 Hz를 더 내릴 dB) — 11-08 2차. 10번 세션이 알린 유호님 말씀 「백그라운드뮤직도 갑자기 끊겼다 다시 시작되는 느낌」
#   (곡 전체를 −8 dB 넘게 0.28초 만에 누르면 말 끝 · 쉼에서 섞음이 꺼졌다가 곡이 다시 솟는다)과 같은 꼴이 8번 첫 판에도 있었다 — 0.25초 창으로 재니
#   줄이 끝난 뒤 곡이 아직 눌린 자리에서 섞음이 v5보다 4~6 dB 꺼졌다(8.75 · 12.75 · 16.0 · 18.75~19.0초, 끝 줄은 19.45초 한 박 숨으로 이어져 1.5초가 빔).
#   그래서 곡 전체는 −3 dB까지만, 비우는 몫은 목소리 띠에만 두고, 내림 0.35초 · 풀기 0.8초(말 끝에서 바로)로 천천히 한다. 그래도 목소리 띠에서 목소리가
#   곡보다 VO_TARGET dB 위에 못 서면 그 줄 목소리를 올린다(LIFT_MAX까지 — 10번 「곡이 큰 자리의 줄은 목소리를 +3~4 dB」).
DUCK_ATTACK, DUCK_RELEASE = 0.35, 0.8
DUCK_EARLY = float(os.environ.get("P8_DUCK_EARLY", "0.2"))   # 풀기는 마지막 낱말이 끝나기 이만큼 앞에서(끝 음절 꼬리는 작다) — 말 끝 뒤 0.25초 칸의 꺼짐: 말 끝에서 풀면 −3.2 · 0.1초 앞 −2.8 · 0.2초 앞 −2.3 dB(v5 대비)
VO_TARGET, LIFT_MAX = 10.3, 4.0
BREATH = (19.45, 20.35)     # 곡 크기 자국의 한 박 숨(원본도 19.5~20.3초 −25 dB) — 이 앞에서 끝나는 줄은 내림을 숨까지 들고 간다
GUEST_DUCK = (-3.0, -5.0)   # 손님 말 아래 — v5는 곡을 +2에서 0.15초 만에 −8로(10 dB 뚝) 눌렀다. 초반 말이 있는 판(P8_OPEN)부터 같은 짜임으로
OPEN_TRIM = 3.0          # 줄마다 크기 차를 판 가운데값 쪽으로 당기는 한도(dB) — 꼬리표 연기로 줄 사이가 9 dB까지 벌어졌다(「저 집은 좋겠다」 −32.5 · 「우리 냉장고에도?」 −23.6, 11-08 첫 굽기)
OPEN_ENDS = ["없네", "오려나", "봤더라", "좋겠다", "냉장고에도"]   # 토막을 끊는 낱말 머리(그 낱말 뒤 쉼에서 자름)
#   의자 삐걱은 7.6초 줄이 앞으로 옮겨 다시 겹치지 않지만, 꼬리(9.76초까지)는 9초대 줄을 쓸 때를 위해 다 앉는 장(9.46초)에서 끊어 둔다


def load(path, stereo=False):
    return C.load_stereo(path) if stereo else C.load(path)


def seg(path, a, b, stereo=False):
    x = load(path, stereo)
    return x[int(a * RATE):int(b * RATE)].copy()


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


def to_rms(x, db):
    return (x * 10 ** ((db - rms_db(x)) / 20)).astype(np.float32)


def fades(x, fin=0.01, fout=0.01):
    x = x.copy()
    a, b = int(fin * RATE), int(fout * RATE)
    if a:
        x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x


def loop_to(x, seconds):
    n = int(seconds * RATE)
    reps = int(np.ceil(n / len(x))) + 1
    return np.concatenate([x] * reps, axis=0)[:n]


def lp(x, hz, order=4):
    return S.sosfiltfilt(S.butter(order, hz, "low", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def hp(x, hz, order=2):
    return S.sosfiltfilt(S.butter(order, hz, "high", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def peak_at(x, after=0.0):
    """소리의 첫 어택(봉우리 −12 dB를 처음 넘는 곳, 초)."""
    m = np.abs(x if x.ndim == 1 else x.mean(axis=1))
    env = np.convolve(m, np.ones(240) / 240, mode="same")
    i0 = int(after * RATE)
    thr = env[i0:].max() * 10 ** (-12 / 20)
    return (i0 + int(np.argmax(env[i0:] > thr))) / RATE


def voice_chunks(x, floor_db=-42, gap=0.12, min_len=0.12):
    """말 덩어리(초) — 50ms 크기 곡선에서 floor_db 위 구간, gap보다 짧은 틈은 잇는다."""
    hop = int(0.01 * RATE)
    env = np.array([rms_db(x[i:i + hop * 5]) for i in range(0, len(x) - hop * 5, hop)])
    on = env > floor_db
    out, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and (on[j] or (j + int(gap / 0.01) < len(on) and on[j:j + int(gap / 0.01)].any())):
                j += 1
            if (j - i) * 0.01 >= min_len:
                out.append((i * 0.01, j * 0.01 + 0.05))
            i = j
        else:
            i += 1
    return out


def bp(x, lo, hi, order=2):
    return S.sosfiltfilt(S.butter(order, [lo, hi], "band", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def tame(x, over_db=9.0, release=0.06, look=0.002):
    """봉우리만 누른다(앞보기 리미터 — 10번 최종소리.py와 같음). 말머리 파열음이 한 판 마감의 봉우리를 정하지 않게"""
    from scipy.ndimage import minimum_filter1d
    a = np.abs(x) if x.ndim == 1 else np.abs(x).max(axis=1)
    thr = 10 ** ((rms_db(x) + over_db) / 20)
    g = np.minimum(1.0, thr / (a + 1e-9))
    g = minimum_filter1d(g, size=max(1, int(look * RATE)) * 2 + 1)
    k = np.exp(-1.0 / (release * RATE))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * k
        out[i] = cur
    return (x * (out if x.ndim == 1 else out[:, None])).astype(np.float32)


def opening(name):
    """한 번에 구운 초반 말을 토막으로 — [(판 a초, 판 b초, 기준 낱말 판 초, 놓을 화면 초, 곡 dB, 띠 dB, 첫 낱말 판 초, [(자막 글, 판 시작, 판 끝)], 자막 x)]"""
    x = C.load(os.path.join(OPEN_DIR, name + ".mp3"))
    words = [w for w in json.load(open(os.path.join(OPEN_DIR, name + "_받아쓰기.json"), encoding="utf-8"))["words"] if w.get("type") == "word"]
    n20 = int(0.02 * RATE)
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + n20] ** 2)) + 1e-9) for i in range(0, len(x) - n20, n20)])

    def quietest(a, b):
        i, j = int(a / 0.02), max(int(a / 0.02) + 1, int(b / 0.02))
        return (i + int(np.argmin(db[i:j]))) * 0.02 + 0.01

    def word_idx(stem, after=0):
        for k in range(after, len(words)):
            if words[k]["text"].strip(" .,?!…").replace(" ", "").startswith(stem):
                return k
        raise SystemExit(f"초반 말 {name}: 받아쓰기에 「{stem}」이 없다 — {[w['text'] for w in words]}")

    cuts, k = [0.0], 0
    for stem in OPEN_ENDS:
        k = word_idx(stem, k)
        cuts.append(quietest(words[k]["end"], words[k + 1]["start"]))
        print(f"  자름 「{words[k]['text']}」 뒤 쉼 {words[k + 1]['start'] - words[k]['end']:.2f}초 → 판 {cuts[-1]:.2f}초")
        k += 1
    cuts.append(len(x) / RATE)
    cuts[0] = max(0.0, words[0]["start"] - 0.08)   # 첫 토막은 말 앞 들숨을 덜어낸다 — 0.5초 시댄스 한숨(0.50~0.84) 바로 뒤라 숨이 두 번 겹친다
    out, k0 = [], 0
    for p, (at, duck, mid, subs, sx) in enumerate(OPEN_AT):
        a, b = cuts[p], cuts[p + 1]
        first = words[k0]["start"]
        sl = []
        for text, last in subs:
            kk = word_idx(last, k0)
            sl.append((text, words[k0]["start"], words[kk]["end"]))
            k0 = kk + 1
        if isinstance(at, tuple):   # ("끝", 초) — 마지막 낱말이 그 초에 끝나게. 앞 줄과는 0.3초 넘게 띄운다(앞 줄이 긴 목소리면 그만큼 늦게 끝난다)
            at = at[1] - (sl[-1][2] - first)
            if out:
                pa, pb, pon, pat, *_r, psl, _psx = out[-1]
                at = max(at, pat + (psl[-1][2] - pon) + 0.3)
        out.append((a, b, first, at, duck, mid, first, sl, sx))
    for p in range(1, len(out)):    # 앞 줄 끝 → 다음 줄 첫 낱말 틈
        gap = out[p][3] - (out[p - 1][3] + out[p - 1][7][-1][2] - out[p - 1][2])
        if gap < 0.3:
            print(f"  ⚠ 초반 말 {p}→{p + 1}번 줄 틈 {gap:.2f}초 — 0.3초 아래")
    return x, out


def sub_timing(pieces, T, who, inner):
    """자막 화면마다 {a, b, s} — 목소리보다 0.06초 먼저, 1.0초 이상, 소리 끝 뒤 0.3초 꼬리, 다음 화면 0.12초 앞에서 내림.
    뜨는 때가 컷 경계 3장(0.125초) 안이면 경계에, 지는 때가 경계 0.6초 앞이면 경계 2장 앞까지(10번 subtitle_timing과 같은 규칙)"""
    cuts = list(T[1:-1])
    raw = []
    for a, b, on, at, duck, mid, first, lines, sx in pieces:
        shift = at - on
        for text, s, e in lines:
            al, ax = SUB_COL[sx]
            raw.append({"a": s + shift - 0.06, "e": e + shift, "s": text, "who": who, "inner": inner, "align": al, "x": ax})
    for r in raw:
        near = [c for c in cuts if abs(c - r["a"]) <= 0.125]
        if near:
            r["a"] = near[0]
    for i, r in enumerate(raw):
        want = max(r["e"] + 0.3, r["a"] + 1.0)
        nxt = raw[i + 1]["a"] - 0.12 if i + 1 < len(raw) else want
        b = min(want, nxt)
        after = [c for c in cuts if b < c <= b + 0.6 and c - 2 / 24 <= nxt and c - 2 / 24 - r["e"] <= 0.5]   # 목소리 끝 뒤 0.5초 넘게는 늘이지 않는다(냉장고 줄이 12번 폰 컷 내내 남았다)
        if after:
            b = after[0] - 2 / 24
        just = [c for c in cuts if r["e"] - 0.05 < c < b and b - c < 0.3]   # 목소리가 끝난 뒤 경계를 조금 넘으면 그 컷 끝 장까지만(끝 줄이 19.08 화면 글 1과 겹쳤다 · Fable 「컷까지 들고 가기」)
        if just:
            b = just[0]
        r["a"], r["b"] = round(r["a"], 3), round(b, 3)
        del r["e"]
        if r["align"] == "center":
            del r["align"], r["x"]
    return raw


def guest_line():
    """19번 손님 「포스터 보고 왔어요」와 그 판의 웃음 덩이 — (손님 말, 웃음 덩이 목록, 판 소리)"""
    if GUEST == "시댄스":
        v19 = C.load(os.path.join(VOX, "p8-19b.wav"))
        ch = voice_chunks(v19, -40)
        line = next(c for c in ch if c[0] > 1.2)          # 「포스터 보고 왔어요」(판 1.6~2.8초)
        g = v19[int((line[0] - 0.03) * RATE):int(line[1] * RATE)]
        return g, [c for c in ch if c[0] > line[1] + 0.2], v19
    return C.load(os.path.join(CAND, f"손님_{GUEST}.mp3")), [], None


def song_parts(duck_spans=(), guest_dip=True):
    """곡 — (끝 한 방 조각, 4.10초부터 놓을 본 곡). duck_spans: [(시작, 끝, 곡 전체 dB, 목소리 띠 dB)] — 그 말 아래만 천천히 내린다.
    guest_dip=True는 v5 크기 자국(손님 말 아래 −8 dB) 그대로 — P8_OPEN을 비운 v5 소리는 이 길로 바이트까지 같다."""
    full = C.load_stereo(SONG)
    ref = np.sqrt(np.mean(np.square(full[int(SONG_AT * RATE):int((SONG_AT + 24) * RATE)])))   # 본 조각 크기 — 끝 조각도 같은 배율로
    # 끝 한 방: SONG_END 안에서 크기가 가장 가파르게 오르는 곳(치기 어택) 20ms 앞부터, 끝 화면 28.43초에
    m = np.abs(full.mean(axis=1))
    env = np.convolve(m, np.ones(480) / 480, mode="same")
    i0, i1 = int(SONG_END[0] * RATE), int(SONG_END[1] * RATE)
    d = np.diff(env[i0:i1:240])
    hit = (i0 + 240 * int(np.argmax(d))) / RATE - 0.02
    tail = full[int(hit * RATE):int((hit + (END - 28.43)) * RATE)]
    tail = (tail / (ref + 1e-9) * 10 ** (-21 / 20) * 10 ** (-3 / 20)).astype(np.float32)   # 본 곡과 같은 배율 · 내레이션 아래 −3 dB
    s = full[int(SONG_AT * RATE):]
    n = int((END - 4.10) * RATE)
    s = s[:n] if len(s) >= n else np.pad(s, ((0, n - len(s)), (0, 0)))
    t = 4.10 + np.arange(len(s)) / RATE
    s = (s / (ref + 1e-9) * 10 ** (-21 / 20)).astype(np.float32)   # 곡 바닥 크기 −21 dBFS(목소리 −19 · −21보다 낮게, 효과음 −27~−33보다 높게) — 아래 자국은 여기서 더하고 뺀다
    # 크기 자국(편집 초, dB): 들어옴 · 12.9~16.0 「거리마다 그 얼굴」(원본 후렴 자리)에 조금 올림 · 19.5~20.3 숨 · 22.4 고조 · 손님 말 아래 · 내레이션 아래 · 28.0 한 박 멈춤(28.43부터 끝 조각)
    if guest_dip:
        gain = np.interp(t, [4.10, 4.40, 12.85, 13.05, 15.9, 16.2, 19.45, 19.65, 20.15, 20.35, 22.30, 22.60, 23.70, 23.85, 25.1, 25.3, 26.62, 26.75, 27.92, 28.0],
                         [-14, 0, 0, 2, 2, 0, 0, -8, -8, 0, 0, 2, 2, -8, -8, 1, 1, -4, -4, -60])   # 손님 말 아래 −8(v1 −5 — Lite 「대사가 음악에 조금 묻힘」)
    else:   # 손님 말 아래는 duck_spans(GUEST_DUCK)가 천천히 내린다
        gain = np.interp(t, [4.10, 4.40, 12.85, 13.05, 15.9, 16.2, 19.45, 19.65, 20.15, 20.35, 22.30, 22.60, 25.3, 26.62, 26.75, 27.92, 28.0],
                         [-14, 0, 0, 2, 2, 0, 0, -8, -8, 0, 0, 2, 1, 1, -4, -4, -60])
    s = s * (10 ** (gain / 20))[:, None]
    if duck_spans:
        g_all = np.ones(len(s), np.float32)
        g_mid = np.ones(len(s), np.float32)
        for a, e, duck, mid in duck_spans:
            if e < 4.10:
                continue
            for g, dd in ((g_all, duck), (g_mid, mid)):
                if dd:
                    if e < BREATH[0] < e - DUCK_EARLY + DUCK_RELEASE + 0.6:
                        # 풀리자마자 19.45초 한 박 숨이 오는 줄(끝 줄 「얘면 손님 오겠다」) — 곡이 다시 솟았다 곧바로 꺼지는 출렁임을
                        #   Lite 둘이 같이 짚었다(17~19초 5 · 3점) → 내림을 숨까지 들고 가고 숨 안에서 푼다(곡은 숨 끝 20.35초에 한 번만 돌아온다)
                        pts_t = [0.0, a - DUCK_ATTACK, a, BREATH[0], BREATH[1], END + 1]
                    else:
                        pts_t = [0.0, a - DUCK_ATTACK, a, e - DUCK_EARLY, e - DUCK_EARLY + DUCK_RELEASE, END + 1]
                    g *= (10 ** (np.interp(t, pts_t, [0, 0, dd, dd, 0, 0]) / 20)).astype(np.float32)
        s = s * g_all[:, None] - bp(s, 250, 4000) * ((1 - g_mid) * g_all)[:, None]
    return hit, tail, s.astype(np.float32)


def band_db(x):
    return 20 * np.log10(np.sqrt(np.mean(bp(x, 250, 4000) ** 2)) + 1e-9)


def build(out_wav, timing_json, T):
    mix = C.Mix(END)
    lines = []
    subs = []
    vo_spans = []   # (시작, 끝, 곡 dB, 띠 dB) — 초반 말 아래 곡을 내린다
    vo_placed = []  # (놓은 초, 토막) — 확인 줄이 목소리만 따로 쌓아 잰다
    parts_pre = None  # 초반 말 판: 줄마다 목소리를 올릴지 정하려고 곡을 먼저 만든다(song_parts 결과)
    guest_lift = 0.0

    def cut(n):   # n번 컷 시작 초
        return T[n - 1]

    # ---------- 초반 말 — 한 판 전체를 한 크기로 맞춘 뒤 토막으로(토막마다 크기를 따로 맞추지 않아 말의 높낮이가 그대로) ----------
    if OPEN:
        vx, pieces = opening(OPEN)
        vx = tame(hp(to_rms(vx, OPEN_LVL), 70), 7.0)
        # 줄 크기 — 말하는 동안(−45 dB 위 20ms 창)의 크기를 판 가운데값 쪽으로 당긴다(OPEN_TRIM dB까지 — 연기의 높낮이는 남기고 묻히거나 튀는 줄만)
        def talk_db(z):
            n20 = int(0.02 * RATE)
            w = np.array([np.sqrt(np.mean(z[i:i + n20] ** 2)) for i in range(0, len(z) - n20, n20)])
            w = w[20 * np.log10(w + 1e-9) > -45]
            return 20 * np.log10(np.sqrt(np.mean(w ** 2)) + 1e-9) if len(w) else -90.0
        lv = [talk_db(vx[int(p[0] * RATE):int(p[1] * RATE)]) for p in pieces]
        mid_lv = float(np.median(lv))
        items = []
        for (a, b, on, at, duck, mid, first, sl, sx), l in zip(pieces, lv):
            trim = float(np.clip(mid_lv - l, -OPEN_TRIM, OPEN_TRIM))
            piece = fades(vx[int(a * RATE):int(b * RATE)], 0.01, 0.06) * (10 ** (trim / 20))
            t0 = at - (on - a)
            s0, e0 = at - (on - first), at + (sl[-1][2] - on)
            vo_spans.append((s0, e0, duck, mid))
            items.append((t0, piece, s0, e0, trim, l, sl, at, on))
        g_pre, _laugh, _v19 = guest_line()
        g_on = voice_chunks(g_pre, -40)
        guest_span = (23.80 + (g_on[0][0] if g_on else 0.03), 23.80 + (g_on[-1][1] if g_on else len(g_pre) / RATE))
        # 곡을 먼저 만들어 줄마다 목소리 띠에서 목소리 − 곡을 재고, VO_TARGET에 못 미치면 그 줄을 올린다(LIFT_MAX까지)
        parts_pre = song_parts(vo_spans + [(guest_span[0], guest_span[1], *GUEST_DUCK)], guest_dip=False)
        song_pre = parts_pre[2]

        def song_band(a, e):
            i, j = int((a - 4.10) * RATE), int((e - 4.10) * RATE)
            return band_db(song_pre[max(0, i):max(0, j)].mean(axis=1)) if j > 0 else -180.0

        for t0, piece, s0, e0, trim, l, sl, at, on in items:
            vb = band_db(piece[int(max(0.0, s0 - t0) * RATE):int((e0 - t0) * RATE)])
            lift = float(np.clip(VO_TARGET - (vb - song_band(s0, e0)), 0.0, LIFT_MAX)) if s0 >= 4.10 else 0.0   # 곡 위에서 시작하는 줄만(둘째 줄은 곡 들어오기 전)
            piece = piece * (10 ** (lift / 20))
            mix.put(t0, piece, fade=0.0)
            vo_placed.append((t0, piece))
            print(f"  초반 말 「{sl[0][0]}」 말 크기 {l:.1f} dB → {trim:+.1f} dB" + (f" · 곡 위로 {lift:+.1f} dB" if lift else ""))
            for text, s, e in sl:
                lines.append({"a": round(at + s - on, 2), "b": round(at + e - on, 2), "who": OPEN_WHO, "s": text})
            print(f"  초반 말 → 화면 {s0:.2f}–{e0:.2f}초 · " + " / ".join(f"{t} {at + s - on:.2f}" for t, s, e in sl))
        gb = band_db(to_rms(g_pre, -21)[int((guest_span[0] - 23.80) * RATE):int((guest_span[1] - 23.80) * RATE)])
        guest_lift = float(np.clip(VO_TARGET - (gb - song_band(*guest_span)), 0.0, 3.0))
        print(f"  손님 말 {guest_span[0]:.2f}–{guest_span[1]:.2f}초 목소리 띠: 손님 − 곡 {gb + guest_lift - song_band(*guest_span):+5.1f} dB(올림 {guest_lift:+.1f})")
        subs += sub_timing(pieces, T, OPEN_WHO, OPEN_WHO == "소연")

    def vo_over(a, b):   # 초반 말과 겹치나
        return any(s < b + 0.15 and a - 0.15 < e for s, e, *_ in vo_spans)

    # ---------- 바탕: 손님 없는 오후의 찬 카페(1~17), 밖 컷(5 · 8 · 13)은 거리 ----------
    fridge = seg(os.path.join(SON, "Jake Fielding - Fridge Hums Vol.2", "MACHAppl_Deep Fridge Hum, Buzz, Electric Tone, Deep_Jake Fielding_Fridge Hums Pt2.wav"), 1.0, 40.0, stereo=True)
    clock = seg(os.path.join(SON, "344 Audio - Antique Clocks", "CLOCKTick_Crooked Antique Clock_344 Audio_Antique Clocks.wav"), 0.0, 30.0, stereo=True)
    street = seg(os.path.join(FAIR, "Ext City Ambience, Car Drive-Bys, Pedestrian, Air.wav"), 3.0, 40.0, stereo=True)
    inside = [(0.0, cut(5)), (cut(6), cut(8)), (cut(9), cut(13)), (cut(14), cut(18))]
    outside = [(cut(5), cut(6)), (cut(8), cut(9)), (cut(13), cut(14))]
    for a, b in inside:
        lvl = -41 if a >= cut(4) else -36   # 노래 전(0~4.1초)은 바탕이 앞에 들린다(원본도 −30 dB 안팎)
        mix.put(a, fades(to_rms(hp(loop_to(fridge, b - a + 0.02), 60), lvl), 0.03, 0.03))
        mix.put(a, fades(to_rms(loop_to(clock, b - a + 0.02), lvl - 6), 0.03, 0.03))
    for a, b in outside:
        mix.put(a, fades(to_rms(loop_to(street, b - a + 0.02), -33), 0.03, 0.03))
    # 11번 냉장고 문 접사 — 웅 소리가 가까이
    mix.put(cut(11), fades(to_rms(hp(loop_to(fridge, cut(12) - cut(11)), 50), -31), 0.02, 0.05))

    # ---------- 1번 한숨 · 「음…」(p8-01c 시댄스 소리, 판 1.21초부터 쓰는 컷) ----------
    v01 = C.load(os.path.join(VOX, "p8-01c.wav"))
    a01 = 29 / 24   # 최종편집.py CUTS[1]
    for (a, b), at, who in zip(voice_chunks(v01, -45)[:2], (None, 1.45), ("한숨", "음…")):
        x = v01[int(a * RATE):int(b * RATE)]
        here = at if at is not None else (a - a01)
        if who == "음…" and vo_over(here, here + (b - a)):   # 초반 속말이 그 자리를 맡으면 시댄스 「음…」은 뺀다(한 사람 목소리 둘이 겹치지 않게). 0.5초 한숨은 둔다 — 한숨 → 속말
            print(f"  {who} 뺌 — 초반 말과 겹침")
            continue
        # 한숨은 v1에서 −30 dB였는데 Gemini Lite 소리 맹검이 「시작하자마자 한숨이 크고 거칠다」(11-07) — 3 dB 낮추고 6 kHz 위 숨결을 누른다
        mix.put(at if at is not None else (a - a01), to_rms(lp(x, 6000), -33 if who == "한숨" else -33), fade=0.03)
        lines.append({"a": round((at if at is not None else a - a01), 2), "who": "소연", "s": who})

    # ---------- 14번 말 없는 감탄 숨(17.8초) — p8-14 판이 낸 「흡」(판 2.3~3.7초, 모음이 또렷하지 않음 — Gemini Lite 11-07)을 입이 살짝 벌어지는 장에.
    #            음악보다 약 10 dB 아래(콘티 1절 · 제작 규칙 「모델 숨 · 웃음」 들릴락 말락) ----------
    v14 = C.load(os.path.join(VOX, "p8-14.wav"))
    ch14 = voice_chunks(v14, -45)
    if ch14:
        a, b = max(ch14, key=lambda c: c[1] - c[0])
        br = v14[int(a * RATE):int(min(b, a + 0.75) * RATE)]
        if vo_over(cut(14) + 0.28, cut(14) + 0.28 + len(br) / RATE):   # 원본 혼잣말 자리를 속말이 맡으면 숨은 뺀다
            print("  14번 감탄 숨 뺌 — 초반 말과 겹침")
        else:
            mix.put(cut(14) + 0.28, fades(to_rms(br, -32), 0.03, 0.2))
            lines.append({"a": round(cut(14) + 0.28, 2), "who": "소연", "s": "(감탄 숨)"})

    # ---------- 5번 보도: 운동화 걸음 · 종이 쇼핑백 ----------
    steps = seg(os.path.join(FAIR, "BG Footsteps Concrete City.wav"), 1.0, 3.0, stereo=True)
    mix.put(cut(5), fades(to_rms(steps[:int((cut(6) - cut(5)) * RATE)], -30), 0.02, 0.08))
    bag = seg(os.path.join(FAIR, "Paper Bag Movement.M.wav"), 0.0, 1.6, stereo=True)
    mix.put(cut(5) + 0.15, fades(to_rms(bag, -31), 0.02, 0.2))

    # ---------- 7번 의자 삐걱(p8-07d 판 0.33초에 일어나기 시작 → 컷 0.25초) ----------
    chair = load(os.path.join(FAIR, "Wood Chair Creaks.M.wav"), True)
    k = peak_at(chair)
    # 초반 말이 있으면 삐걱 꼬리를 다 앉는 장(9.46초)에서 끊는다 — 0.7초 꼬리(9.76초까지)가 9.55초 「이 얼굴 어디서 봤더라」 머리를 덮었다(목소리 띠 바탕 · 효과 −33 dB, 11-08)
    tail = 0.42 if OPEN else 0.7
    mix.put(cut(7) + 0.27 - k, fades(to_rms(chair[:int((k + 0.7) * RATE)], -29)[:int((k + tail) * RATE)], 0.005, 0.15))

    # ---------- 폰 누름 「톡」 — 15번(판 1.50초에 닿음 → 컷 0.46초) · 17번(판 1.62초 → 컷 0.87초) ----------
    taps = load(os.path.join(FAIR, "Cell phone taps.M.wav"), True)
    t0 = peak_at(taps)
    tap = fades(taps[max(0, int((t0 - 0.01) * RATE)):int((t0 + 0.09) * RATE)], 0.002, 0.03)
    mix.put(cut(15) + 0.46, to_rms(tap, -27))
    mix.put(cut(17) + 0.87, to_rms(tap, -26))
    ok = load(os.path.join(SON, "Cinematic Sound Design - Interface & Infographics", "Interface Pop High Short.wav"), True)
    mix.put(cut(17) + 0.9, fades(to_rms(ok, -33), 0.002, 0.05))   # 「패키지에 담김」 — 작은 한 방(알림이 뜨는 장)

    # ---------- 18번부터 따뜻해진 카페: 우유 붓기 · 웅성임 · 잔 ----------
    pour = load(os.path.join(FAIR, "Pouring Liquid.M.wav"), True)
    p0 = peak_at(pour)
    mix.put(cut(18) + 0.02, fades(to_rms(pour[max(0, int((p0 - 0.05) * RATE)):int((p0 + 1.25) * RATE)], -27), 0.02, 0.15))
    cafe = seg(os.path.join(FAIR, "Coffee Shop Ambience 1.wav"), 5.0, 20.0, stereo=True)
    mix.put(cut(18), fades(to_rms(loop_to(cafe, END - cut(18)), -33), 0.35, 0.02))
    glass = load(os.path.join(FAIR, "Bartender Glass Movements.M.wav"), True)
    g0 = peak_at(glass)
    mix.put(cut(19) + 0.55 - 0.01, fades(to_rms(glass[int((g0 - 0.01) * RATE):int((g0 + 0.35) * RATE)], -31), 0.003, 0.1))

    # ---------- 19번 손님 말 · 소연 웃음 ----------
    g, laugh, v19 = guest_line()
    if guest_lift:
        print(f"  손님 말 곡 위로 {guest_lift:+.1f} dB")
    mix.put(23.80, to_rms(g, -21 + guest_lift), fade=0.01)
    lines.append({"a": 23.80, "b": round(23.80 + len(g) / RATE, 2), "who": "손님", "s": "포스터 보고 왔어요"})
    if OPEN:   # 초반 말에 자막을 달면 손님 말도 같은 결로(한 편 안에서 말자막이 있다 없다 하지 않게). 끝 내레이션은 제목 · 로고가 같은 말이라 달지 않는다
        g_on = voice_chunks(g, -40)
        ga = 23.80 + (g_on[0][0] if g_on else 0.03)
        ge = 23.80 + (g_on[-1][1] if g_on else len(g) / RATE)
        subs.append({"a": round(ga - 0.06, 3), "b": round(min(ge + 0.3, cut(20) - 0.2), 3), "s": "포스터 보고 왔어요", "who": "손님"})
    if GUEST == "시댄스" and laugh:
        # 판 안 웃음은 3.1~3.7초(컷 끝 3.08초 뒤)라 20번 와이드로 밀린다 — 둘이 마주 웃는 장(컷 1.75초 = 25.38초, 콘티 25.3~26.6초)으로 옮긴다.
        # Gemini Lite(11-07)는 이 웃음을 손님 목소리 결로 들었다 — 손님은 뒷모습이고 소연은 그 장에 입꼬리를 올려 웃고 있어 누구 웃음이어도 입 맞춤이 어긋나지 않는다
        a, b = laugh[0]
        mix.put(cut(19) + 1.75, to_rms(v19[int(a * RATE):int(b * RATE)], -27), fade=0.02)
        lines.append({"a": round(cut(19) + 1.75, 2), "who": "웃음", "s": "(웃음)"})

    # ---------- 제목 휙 · 내레이션 · 끝 로고 ----------
    wh = load(os.path.join(FAIR, "Low Whoosh x2.wav"), True)
    w0 = peak_at(wh)
    mix.put(cut(20) - 0.18, fades(to_rms(wh[:int((w0 + 0.45) * RATE)], -30), 0.01, 0.2))
    nv = C.load(os.path.join(CAND, f"내레이션_{NARR}.mp3"))
    ch = voice_chunks(nv, -38, gap=0.18)
    split = max(range(1, len(ch)), key=lambda i: ch[i][0] - ch[i - 1][1]) if len(ch) > 1 else 1   # 가장 긴 쉼 = 쉼표 자리
    p1 = nv[int(max(0, ch[0][0] - 0.03) * RATE):int(ch[split - 1][1] * RATE)]
    p2 = nv[int(max(0, ch[split][0] - 0.03) * RATE):int(ch[-1][1] * RATE)]
    mix.put(26.72, to_rms(p1, -19), fade=0.01)
    mix.put(28.45, to_rms(p2, -19), fade=0.01)
    lines += [{"a": 26.72, "b": round(26.72 + len(p1) / RATE, 2), "who": "내레이션", "s": "손님을 부르는 모델"},
              {"a": 28.45, "b": round(28.45 + len(p2) / RATE, 2), "who": "내레이션", "s": "펄스 캐스팅북에서"}]
    logo = load(os.path.join(SON, "Cinematic Sound Design - User Interface", "Interface Plucks Happy.wav"), True)
    mix.put(cut(21) + 0.02, fades(to_rms(logo[:int(1.4 * RATE)], -31), 0.003, 0.3))

    # ---------- 노래 ----------
    if SONG:
        hit, tail, s = parts_pre if parts_pre is not None else song_parts()
        mix.put(28.43, fades(tail, 0.004, 0.08))
        print(f"  곡 끝 한 방: 곡 {hit:.2f}초 → 편집 28.43초")
        mix.put(4.10, s, fade=0.0)
        song_here = np.zeros_like(mix.a)
        song_here[int(4.10 * RATE):int(4.10 * RATE) + len(s)] = s[:len(song_here) - int(4.10 * RATE)]

    # 확인 — 초반 말마다 목소리 대 그 아래 곡 · 바탕(목소리 띠 250~4000 Hz). 목소리는 따로 쌓은 판으로 잰다
    if OPEN and SONG:
        vo = C.Mix(END)
        for t0, piece in vo_placed:
            vo.put(t0, piece, fade=0.0)
        for a, e, *_r in vo_spans:
            i, j = int(a * RATE), int(e * RATE)
            v = vo.a[i:j].mean(axis=1)
            rest = mix.a[i:j].mean(axis=1) - v
            sg = song_here[i:j].mean(axis=1)
            vb, rb, sb, ob = (bp(z, 250, 4000) for z in (v, rest, sg, rest - sg))
            r = lambda z: 20 * np.log10(np.sqrt(np.mean(z ** 2)) + 1e-9)
            print(f"  {a:5.2f}–{e:5.2f}초 목소리 띠: 목소리 − 곡 {r(vb) - r(sb):+5.1f} dB · 목소리 − 나머지 전부 {r(vb) - r(rb):+5.1f} dB"
                  f"  (띠 크기 목소리 {r(vb):.1f} · 곡 {r(sb):.1f} · 바탕 · 효과 {r(ob):.1f})")

    # 30.0초 끝 — 원본처럼 끝에서 끊되 곡 잔향이 「뚝」 잘린 소리로 들리지 않게 마지막 0.2초만 줄인다(Lite 두 번 모두 「끝이 뚝 끊김」, 11-07)
    n = int(END * RATE)
    mix.a[n - int(0.2 * RATE):n] *= np.linspace(1, 0, int(0.2 * RATE))[:, None]
    mix.finish(out_wav, boost_db=0.0)
    meta = {"lines": sorted(lines, key=lambda d: d["a"]), "guest": GUEST, "narr": NARR, "song": os.path.basename(SONG), "song_at": SONG_AT}
    if OPEN:
        meta["open"] = OPEN
        meta["subs"] = sorted(subs, key=lambda d: d["a"])
    json.dump(meta, open(timing_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for l in lines:
        print(f"  {l['a']:6.2f} {l['who']} {l['s']}")
    return lines
