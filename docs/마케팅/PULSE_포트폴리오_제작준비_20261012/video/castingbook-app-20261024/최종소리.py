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


def build(out_wav, timing_json, T):
    mix = C.Mix(END)
    lines = []

    def cut(n):   # n번 컷 시작 초
        return T[n - 1]

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
    mix.put(cut(7) + 0.27 - k, fades(to_rms(chair[:int((k + 0.7) * RATE)], -29), 0.005, 0.15))

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
    if GUEST == "시댄스":
        v19 = C.load(os.path.join(VOX, "p8-19b.wav"))
        ch = voice_chunks(v19, -40)
        line = next(c for c in ch if c[0] > 1.2)          # 「포스터 보고 왔어요」(판 1.6~2.8초)
        g = v19[int((line[0] - 0.03) * RATE):int(line[1] * RATE)]
        laugh = [c for c in ch if c[0] > line[1] + 0.2]
    else:
        g = C.load(os.path.join(CAND, f"손님_{GUEST}.mp3"))
        laugh = []
    mix.put(23.80, to_rms(g, -21), fade=0.01)
    lines.append({"a": 23.80, "b": round(23.80 + len(g) / RATE, 2), "who": "손님", "s": "포스터 보고 왔어요"})
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
        mix.put(28.43, fades(tail, 0.004, 0.08))
        print(f"  곡 끝 한 방: 곡 {hit:.2f}초 → 편집 28.43초")
        s = full[int(SONG_AT * RATE):]
        n = int((END - 4.10) * RATE)
        s = s[:n] if len(s) >= n else np.pad(s, ((0, n - len(s)), (0, 0)))
        t = 4.10 + np.arange(len(s)) / RATE
        s = (s / (ref + 1e-9) * 10 ** (-21 / 20)).astype(np.float32)   # 곡 바닥 크기 −21 dBFS(목소리 −19 · −21보다 낮게, 효과음 −27~−33보다 높게) — 아래 자국은 여기서 더하고 뺀다
        # 크기 자국(편집 초, dB): 들어옴 · 12.9~16.0 「거리마다 그 얼굴」(원본 후렴 자리)에 조금 올림 · 19.5~20.3 숨 · 22.4 고조 · 손님 말 아래 · 내레이션 아래 · 28.0 한 박 멈춤(28.43부터 끝 조각)
        gain = np.interp(t, [4.10, 4.40, 12.85, 13.05, 15.9, 16.2, 19.45, 19.65, 20.15, 20.35, 22.30, 22.60, 23.70, 23.85, 25.1, 25.3, 26.62, 26.75, 27.92, 28.0],
                         [-14, 0, 0, 2, 2, 0, 0, -8, -8, 0, 0, 2, 2, -8, -8, 1, 1, -4, -4, -60])   # 손님 말 아래 −8(v1 −5 — Lite 「대사가 음악에 조금 묻힘」)
        s = s * (10 ** (gain / 20))[:, None]
        mix.put(4.10, s.astype(np.float32), fade=0.0)

    # 30.0초 끝 — 원본처럼 끝에서 끊되 곡 잔향이 「뚝」 잘린 소리로 들리지 않게 마지막 0.2초만 줄인다(Lite 두 번 모두 「끝이 뚝 끊김」, 11-07)
    n = int(END * RATE)
    mix.a[n - int(0.2 * RATE):n] *= np.linspace(1, 0, int(0.2 * RATE))[:, None]
    mix.finish(out_wav, boost_db=0.0)
    json.dump({"lines": lines, "guest": GUEST, "narr": NARR, "song": os.path.basename(SONG), "song_at": SONG_AT}, open(timing_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for l in lines:
        print(f"  {l['a']:6.2f} {l['who']} {l['s']}")
    return lines
