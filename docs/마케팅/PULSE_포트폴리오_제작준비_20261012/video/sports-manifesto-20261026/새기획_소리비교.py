# 5번 새 기획(11-05) 음악 비교판 — 일레븐 음악 · MonoGPT Suno v5.5 곡을 같은 잣대로 15초 콘티 가편집에 얹는다(유호님 「일레븐랩스판이랑 수노판 둘 다 뽑아서 비교해볼까」).
# 잣대: 곡마다 우리 박 자리의 크기 모양(0~1.63초 조용 → 1.63초 크게 오름 → 11.4초부터 낮아짐 → 14.6초 뚝)에 가장 맞는 15초 구간을 고르고,
#   14.6초에서 끊고(20ms 줄임), 같은 내레이션(Jian.K 「숨이 가쁠수록, 기쁨.」 — 「기쁨」이 12.85초에 끝남)을 얹고 그 밑에서 곡을 5 dB 낮춘다.
#   곡이 11.4초 뒤에 낮아지지 않으면(수노는 시각 지시를 못 따름) 11.4초부터 저역만 남기고 6 dB 낮춰 「드럼 걷음」을 흉내 낸다 — 그 손질을 기록에 남긴다.
# 효과음은 아직 없다(음악과 말만 견준다). 결과는 git 밖.
#   python -X utf8 새기획_소리비교.py   → 콘티/p5n/가편집/p5n_소리비교_<이름>.mp4 · 소리/p5n/비교/<이름>.wav · 비교.json
import json, subprocess
from pathlib import Path
import numpy as np

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024")
S = V / "소리/p5n"
VID = V / "콘티/p5n/가편집/p5n_콘티가편집_15초.mp4"
OUT_A, OUT_V = S / "비교", V / "콘티/p5n/가편집"
SR = 48000
SONGS = {"일레븐_GraniteRun": S / "음악_일레븐/Granite_Run.wav", "일레븐_GranularRun": S / "음악_일레븐/Granular_Run.wav",
         "수노_GappeumRun1": S / "음악_수노/Gappeum_Run_1.mp3", "수노_GappeumRun2": S / "음악_수노/Gappeum_Run_2.mp3"}
NARR, NARR_AT = S / "내레이션_20261105/JianK_1.mp3", 10.31
CUT, END, DUCK_AT = 14.6, 15.0, 11.4


def load(p, ch=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def env_db(x, step=0.1):
    m = x.mean(1); h = int(SR * step); n = len(m) // h
    return 20 * np.log10(np.sqrt((m[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-6)


def target(step=0.1):
    t = np.arange(0, CUT, step)
    return np.where(t < 1.63, -32.0, np.where(t < DUCK_AT, -14.0, -24.0))


def best_offset(x):
    """크기 모양이 목표와 가장 닮은 시작 초(0.05초 간격, 곡 끝 15초 앞까지). 1.63초 자리의 오름도 점수에 더한다."""
    d = env_db(x, 0.05); tg = np.repeat(target(0.1), 2)[: int(CUT / 0.05)]
    best = (-9, 0.0)
    for k in range(0, len(d) - len(tg) - int(0.4 / 0.05)):
        w = d[k: k + len(tg)]
        c = np.corrcoef(w, tg)[0, 1]
        i = int(1.63 / 0.05); rise = (w[i: i + 6].mean() - w[max(0, i - 8): i].mean()) / 20
        sc = c + 0.3 * np.clip(rise, -1, 1)
        if sc > best[0]: best = (sc, k * 0.05)
    return best


def lowpass(x, hz=380):
    a = np.exp(-2 * np.pi * hz / SR); y = np.empty_like(x); s = np.zeros(x.shape[1], np.float32)
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s; y[i] = s
    return y


narr = load(NARR)
OUT_A.mkdir(parents=True, exist_ok=True)
rec = {}
for name, p in SONGS.items():
    x = load(p)
    sc, off = best_offset(x)
    seg = x[int(off * SR): int((off + END) * SR)].copy()
    if len(seg) < END * SR:
        seg = np.vstack([seg, np.zeros((int(END * SR) - len(seg), 2), np.float32)])
    d = env_db(seg, 0.1)
    before, after = d[int(9.4 / 0.1): int(11.4 / 0.1)].mean(), d[int(11.6 / 0.1): int(14.4 / 0.1)].mean()
    edited = False
    if before - after < 4:  # 11.4초 뒤에 스스로 낮아지지 않음 → 저역만 남기고 6 dB 낮춤
        i0 = int(DUCK_AT * SR); fade = int(0.12 * SR)
        lp = lowpass(seg[i0 - fade:]) * (10 ** (-6 / 20))
        w = np.clip(np.arange(len(lp)) / fade, 0, 1)[:, None]
        seg[i0 - fade:] = seg[i0 - fade:] * (1 - w) + lp * w
        edited = True
    # 14.6초 뚝(20ms) — 뒤는 무음
    c0 = int(CUT * SR); f = int(0.02 * SR)
    seg[c0 - f: c0] *= np.linspace(1, 0, f)[:, None]; seg[c0:] = 0
    # 내레이션 밑에서 곡 5 dB 낮춤(앞뒤 0.15초)
    n0 = int(NARR_AT * SR); n1 = n0 + len(narr)
    g = np.ones(len(seg), np.float32); ramp = int(0.15 * SR); low = 10 ** (-5 / 20)
    g[n0 - ramp: n0] = np.linspace(1, low, ramp); g[n0: n1] = low; g[n1: n1 + ramp] = np.linspace(low, 1, ramp)
    seg *= g[:, None]
    mix = seg.copy(); mix[n0: n0 + len(narr)] += narr[: len(mix) - n0] * 1.0
    wav = OUT_A / f"{name}_raw.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(wav)], input=mix.astype(np.float32).tobytes())
    fin = OUT_A / f"{name}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), str(fin)])
    wav.unlink()
    mp4 = OUT_V / f"p5n_소리비교_{name}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(VID), "-i", str(fin), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", str(mp4)])
    rec[name] = {"곡": str(p.name), "시작초": round(off, 2), "점수": round(float(sc), 3), "11.4초_전후_dB": [round(float(before), 1), round(float(after), 1)], "드럼걷음_손질": edited}
    print(name, rec[name])
(OUT_A / "비교.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
