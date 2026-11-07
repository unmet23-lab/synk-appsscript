# 「달리며 건너뛰는 한국」 소리 섞기(2026-11-07, Claude) — 곡(곡편집.py) 위에 효과음을 화면 사건 장에 맞춰 표본 단위로 놓는다.
#   python -X utf8 편집/소리편집.py   → git 밖 편집/소리/섞음.wav(48 kHz 스테레오 30.0초) · remotion/public/audio/mix.wav
# 효과음은 stable-audio-3로 소리 종류마다 구운 것(효과음후보.py) 가운데 CLAP(효과음재기.py)이 바라는 소리로 잡은 씨앗만 쓴다. 영상 판에 붙어 온 소리는 쓰지 않는다.
#   걷는 발소리 후보는 모두 「구두 · 박수」로 잡혀 달리기2c(운동화 질주)에서 디딤 한 타씩 떼어 V01의 디딤(0.17초부터 약 0.5초마다 — 발 띠로 봄)에 작게 놓는다.
# 놓는 자리(화면 초, v6): 4.52 유리에 손 · 5.30 문 닫힘 · 6.0~9.45 열차 출발 · 8.3~9.45 질주 발소리 · 9.70 기둥 휙 · 9.97 상승음 · 10.0 드롭 한 방
#   · 18.05 다이빙 휙 · 18.85 꽃밭 착지(털썩 + 합성 쿵) · 20.98 답 카드 · 21.0~23.75 줄마다 톡 · 23.48 이름 끝말 카드 · 27.5 다리가 꽃 속으로(합성 쿵 + 한 방, 곡 끝 한 타) · 28.0 보내기 톡.
import os
import shutil
import subprocess
import wave

import numpy as np

R = 48000
END = 30.0
DIR = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/편집/소리"
E = os.path.join(DIR, "효과음")
OUT = os.path.join(DIR, "섞음.wav")
PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "remotion", "public", "audio")

# (파일, 화면 초, 크기 dB(봉우리 −6 dBFS로 맞춘 뒤), 길이 초(없으면 끝까지), 첫소리를 그 초에 맞춤(True) / 파일 0초를 그 초에(False))
EVENTS = [
    # v6: 테이프 소리를 뺐다(Gemini v5 「테이프보다 전자 기기 잡음 같다」 · Fable v4 P2 「−18로 낮추거나 뺀다」) — STEP 1 라벨의 톡만 남김
    ("유리2b.wav", 4.52, -11, 0.8, True),       # v8: −8 → −11(Gemini Lite v5 · v8 두 번 「3~6초 효과음이 어색 · 너무 크다」)
    ("문닫힘2b.wav", 5.30, -11, 1.4, True),
    ("열차_출발.wav", 6.00, -10, 3.45, False),
    ("달리기2c.wav", 8.30, -13, 1.15, False),
    ("휙2c.wav", 9.70, -7, 0.6, False),         # v4: 기둥 휙이 0.12초 비움(9.88~10.0)에 걸쳐 드롭으로 넘어가게
    ("상승a.wav", 9.97, -11, None, "peak"),     # v5: 역재생 상승음 — 가장 큰 자리가 드롭 바로 앞(Gemini v4 「10초 드롭에 한 방이 약함」)
    ("한방b.wav", 10.0, -9, 1.6, True),         # v5: 드롭 한 방 · v7: −7 → −9(Gemini v6 「10초 타격음이 귀를 찌른다」, 드롭을 1 dB 내린 것과 함께)
    ("휙2c.wav", 18.05, -10, 0.6, False),
    # v6: 착지(Gemini v5 「다이빙이 물에 들어가는 소리 같다」 · Fable v4 P2) — 털썩b는 −12로 내리고(CLAP 물 몫 0.003) 아래에 합성한 낮은 쿵(효과음합성.py)을 깐다
    # v7: Gemini Lite v6 · v7 두 번 「착지에 힘이 없다 · 더 묵직한 저음」 — 합성 쿵 −10 → −6, 종이처럼 들리는 털썩b −12 → −15
    ("털썩b.wav", 18.85, -15, 1.4, True),
    ("합성_몸쿵.wav", 18.85, -6, 0.9, True),
    # v6: 다리 솟음의 바스락2a는 뺐다(CLAP 「종이 바스락」 0.86) — 20.0초는 곡의 심벌이 맡는다
    # v6(Fable v4 P1): 다리가 꽃 속으로 사라지는 27.5초에 곡 끝 한 타(곡편집.py)와 함께 부드러운 쿵 + 가벼운 한 방. 옛 27.85 바스락2c는 뺐다
    # v7: Gemini Lite 세 번(v5 · v6 · v7) 「27.5초 쓰러짐 소리가 약하다」 — 끝 쿵 −12 → −8, 한 방 −14 → −9
    ("합성_몸쿵_끝.wav", 27.50, -8, 0.8, True),
    ("한방b.wav", 27.50, -9, 1.6, True),
    ("종이2a.wav", 20.98, -12, 0.6, True),
    ("종이2a.wav", 23.48, -12, 0.6, True),      # v6: 이름 끝말 24.0 → 23.5
    ("톡2b.wav", 28.00, -8, 0.4, True),         # v6: 보내기 27.5 → 28.0(끝 한 타 뒤 한 박) · v7: −12 → −8(Fable v6 「보내기가 소리 없이 뜸」)
    ("톡2b.wav", 3.12, -18, 0.3, True),         # STEP 1 라벨
    ("톡2b.wav", 4.52, -20, 0.3, True),         # ● REC 켜짐
    ("톡2b.wav", 6.17, -18, 0.3, True),         # STEP 2 라벨
    ("톡2b.wav", 20.12, -16, 0.3, True),        # 「Finish line!」
] + [("톡2b.wav", 21.0 + 0.25 * i, -22, 0.25, True) for i in range(12)]   # 답 한 줄 0.25초
# 깔리는 소리(공간음): (파일, 시작 초, 끝 초, 크기 dB, 들어옴 · 나감 초) — v5(Gemini v4 「폰 시점 소리가 비어 있음 · 끝이 갑자기 사그라듦」)
# v6: 꽃밭 바람을 27.0초부터(카드가 걷히는 26.75초 뒤, 쓰러짐 앞) — 끝 한 타 뒤 빈 들판이 비지 않게
# v7: 승강장 −27 → −25(앞 6초를 2 dB 올린 곡과 같이), 꽃밭 바람 −24 → −20(Fable v6 「마지막 1초가 거의 무음」 · Gemini v6 「28~30초가 너무 정적」 — 끝 한 타 뒤 멈춤은 남기고 빈 소리만 막는다)
BEDS = [("승강장a.wav", 0.0, 6.4, -25, 0.3, 0.6), ("꽃밭바람a.wav", 27.0, 30.0, -20, 0.6, 0.25)]
# v8 끝 잔향(Gemini Lite v8 「28~30초 여운이 너무 급격히 줄어든다」): 끝 한 타 둘레(27.45~27.75, 곡 + 효과음)를 2.2초짜리 어두운 잔향에 걸어 −14 dB로 더한다.
#   잔향은 수식으로 만든다(감쇠하는 잡음, 4 kHz 위는 깎음, 좌우 다른 잡음). 30.0초 앞 0.4초에 잦아들게 한다.
REVERB = {"from": 27.45, "to": 27.75, "rt60": 2.2, "db": -14.0}
STEPS = [0.17, 0.67, 1.17, 1.67, 2.17, 2.67]   # V01 걷는 디딤(화면 초)
STEP_DB = -20


def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "2", "-ar", str(R), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def onset(x, thr_db=-30):
    m = np.abs(x).max(axis=1)
    peak = m.max() + 1e-9
    idx = np.where(m > peak * 10 ** (thr_db / 20))[0]
    return int(idx[0]) if len(idx) else 0


def prep(x, length=None, from_onset=True):
    a = max(0, onset(x) - int(0.008 * R)) if from_onset else 0
    y = x[a:a + int(length * R)] if length else x[a:]
    y = y / (np.abs(y).max() + 1e-9) * 10 ** (-6 / 20)
    f_in, f_out = int(0.004 * R), min(len(y) // 3, int(0.08 * R))
    y[:f_in] *= np.linspace(0, 1, f_in)[:, None]
    y[-f_out:] *= np.linspace(1, 0, f_out)[:, None]
    return y


def steps_from(run):
    """질주 소리에서 디딤 봉우리 한 타씩(앞 10 ms ~ 뒤 150 ms) — 가장 큰 넷을 돌려 쓴다."""
    m = np.abs(run).max(axis=1)
    env = np.convolve(m, np.ones(240) / 240, mode="same")
    peaks = [i for i in range(R // 10, len(env) - R // 10) if env[i] == env[i - 1200:i + 1200].max() and env[i] > env.max() * 0.35]
    peaks = sorted(peaks, key=lambda i: -env[i])[:4]
    out = []
    for p in sorted(peaks):
        seg = run[max(0, p - int(0.03 * R)): p + int(0.15 * R)].copy()
        seg = seg / (np.abs(seg).max() + 1e-9) * 10 ** (-6 / 20)
        f = int(0.006 * R)
        seg[:f] *= np.linspace(0, 1, f)[:, None]
        seg[-int(0.05 * R):] *= np.linspace(1, 0, int(0.05 * R))[:, None]
        out.append(seg)
    return out


def place(buf, y, t, db):
    a = int(t * R)
    m = min(len(y), len(buf) - a)
    if m > 0:
        buf[a:a + m] += y[:m] * 10 ** (db / 20)


def main():
    n = int(END * R)
    music = load(os.path.join(DIR, "곡.wav"))[:n]
    fx = np.zeros((n, 2), np.float32)
    for name, t, db, ln, how in EVENTS:
        x = load(os.path.join(E, name))
        if how == "peak":   # 가장 큰 자리를 그 초에 — 역재생 상승음
            y = prep(x, ln, False)
            pk = int(np.argmax(np.abs(y).max(axis=1)))
            y = y[:pk + int(0.03 * R)]
            y[-int(0.02 * R):] *= np.linspace(1, 0, int(0.02 * R), dtype=np.float32)[:, None]
            place(fx, y, t - pk / R, db)
        else:
            place(fx, prep(x, ln, how), t, db)
    for name, a, b, db, fi, fo in BEDS:
        x = load(os.path.join(E, name))
        y = x[:int((b - a) * R)].copy()
        if len(y) < int((b - a) * R):   # 짧으면 이어 붙여 늘린다(0.2초 겹침)
            reps = [y]
            while sum(len(r) for r in reps) < int((b - a) * R):
                reps.append(x.copy())
            y = np.concatenate(reps)[:int((b - a) * R)]
        y = y / (np.abs(y).max() + 1e-9) * 10 ** (-6 / 20)
        y[:int(fi * R)] *= np.linspace(0, 1, int(fi * R), dtype=np.float32)[:, None]
        y[-int(fo * R):] *= np.linspace(1, 0, int(fo * R), dtype=np.float32)[:, None]
        place(fx, y, a, db)
    hits = steps_from(load(os.path.join(E, "달리기2c.wav")))
    for k, t in enumerate(STEPS):
        h = hits[k % len(hits)]
        place(fx, h, t - 0.03, STEP_DB)
    mix = music + fx
    from scipy.signal import butter, fftconvolve, lfilter
    rng = np.random.default_rng(1107)
    L = int(2.5 * R)
    tt = np.arange(L) / R
    b, a = butter(2, 4000 / (R / 2), "low")
    ir = np.stack([lfilter(b, a, rng.normal(0, 1, L)) * np.exp(-tt * 6.91 / REVERB["rt60"]) for _ in range(2)], axis=1)
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    s0, s1 = int(REVERB["from"] * R), int(REVERB["to"] * R)
    src = mix[s0:s1].astype(np.float64)
    wet = np.stack([fftconvolve(src[:, c], ir[:, c]) for c in range(2)], axis=1)
    wet = wet / (np.abs(wet).max() + 1e-9) * np.abs(src).max() * 10 ** (REVERB["db"] / 20)
    m = min(len(wet), n - s0)
    wet = wet[:m]
    fo = int(0.4 * R)
    if s0 + m >= n - fo:
        k = n - fo - s0
        wet[k:] *= np.linspace(1, 0, m - k)[:, None]
    mix[s0:s0 + m] += wet.astype(np.float32)
    peak = float(np.abs(mix).max())
    os.makedirs(DIR, exist_ok=True)
    tmp = OUT + ".raw.wav"
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(R)
        w.writeframes((np.clip(mix / max(1.0, peak), -1, 1) * 32767).astype("<i2").tobytes())
    # 봉우리만 누르는 한계기(크기 맞춤은 영상 마감 때 tools/음량마감.mjs)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "alimiter=limit=0.84:attack=2:release=60:level=false", "-ar", str(R), "-c:a", "pcm_s16le", OUT], check=True)
    os.remove(tmp)
    os.makedirs(PUBLIC, exist_ok=True)
    shutil.copy2(OUT, os.path.join(PUBLIC, "mix.wav"))
    print(OUT, f"섞기 전 최대 {20 * np.log10(peak + 1e-9):.1f} dBFS · 효과음 {len(EVENTS)} + 디딤 {len(STEPS)}")


if __name__ == "__main__":
    main()
