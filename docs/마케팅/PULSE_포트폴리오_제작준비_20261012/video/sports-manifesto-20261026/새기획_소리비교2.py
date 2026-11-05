# 5번 새 기획(11-05 밤) 소리 둘째 판 — 유호님 「둘다 너무 맹하고 영상 분위기랑 안어울려 … 영상컨셉은 약간 기대감있고 약간 웅장한 컨셉 …
#   나레이션은 갑자기 한국어 선생님이 나와서 티칭하는 느낌이야」 → 기대감 · 웅장으로 새로 뽑은 곡(일레븐 넷 · 수노 둘 중 짜임이 맞는 셋)에 영어 한 줄.
# 짜임(15초): 0~2.87초 조용히 모음(기대감) → 2.87초 첫 딛기에 큰 타격 → 쌓아 감 → 11.4초 밑창 컷에 숨 멎은 정적 → 12.87초 로고에 가장 큰 한 방 → 14.6초 뚝.
# 말: 「Out of breath, … into joy.」 한 판을 쉼에서 둘로 갈라 「Out of breath,」는 N10(10.05초부터), 「into joy.」는 정적 속(12.70초에 끝)에 둔다.
# 곡 편집은 박 자리에서만 자르고 붙인다(30ms 겹침). 크기는 한 번에 −16 LUFS로 올리고 봉우리만 −1.5 dBFS로 누른다
#   — 앞 판(소리비교.py)의 한 번 loudnorm은 조용한 앞부분을 끌어올려 짜임을 평평하게 만들 수 있었다.
#   python -X utf8 새기획_소리비교2.py   → 콘티/p5n/가편집/p5n_소리비교2_<이름>.mp4 · p5n_목소리비교.mp4 · 소리/p5n/비교2/<이름>.wav · 비교2.json
import json, re, subprocess
from pathlib import Path
import numpy as np

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024")
S = V / "소리/p5n"
VID = V / "콘티/p5n/가편집/p5n_콘티가편집_15초.mp4"
OUT_A, OUT_V = S / "비교2", V / "콘티/p5n/가편집"
NAR = S / "내레이션_영어_20261105"
SR = 48000
CUT, END = 14.6, 15.0
A_AT, B_END = 10.05, 12.70
# 곡마다 편집표: (우리 시작초, 원곡 시작초) — 다음 줄의 우리 시작초까지 이어 튼다. 끝은 END.
EDITS = {
    # 일레븐 Vertical Beam: 원곡 6.41 큰 타격 → 2.89, 원곡 10.80~11.17 한 박(0.37초)을 한 번 더 틀어 16.015 가장 큰 타격 → 12.865.
    #   원곡 14.4~15.4의 거의 무음이 우리 11.2~12.3에 와 「숨 멎음」이 된다. 편집으로 따로 걷어 낼 것 없음.
    "일레븐_VerticalBeam": {"곡": S / "음악_일레븐2/Vertical_Beam.wav", "표": [(0.0, 3.52), (7.65, 10.80)], "정적": None, "말밑": -3},
    # 수노 Gappeum Rise 1(재 본 빠르기 152.1 BPM · 한 박 0.3945초): 원곡 3.19 들어옴 → 2.87. 11.4초 컷에서 끝 무렵 큰 타격 110.63이 12.87에 오게 원곡 109.16으로 건너뛴다
    #   — 두 쪽의 박 어긋남 2ms가 되는 타격 가운데 고름. 수노 곡에는 쉼이 따로 없어 11.4~12.8초를 10 dB 낮추고 저역만 남긴다(편집으로 만든 정적 — 기록에 남김).
    "수노_GappeumRise1": {"곡": S / "음악_수노2/Gappeum_Rise_1.mp3", "표": [(0.0, 0.32), (11.40, 109.16)], "정적": (11.40, 12.80), "말밑": -6},
    # 수노 Gappeum Rise 2(151.8 BPM): 원곡 3.165 → 2.87, 11.4초에서 원곡 96.69로 건너뛰어 98.16 타격 → 12.87(박 어긋남 5ms).
    "수노_GappeumRise2": {"곡": S / "음악_수노2/Gappeum_Rise_2.mp3", "표": [(0.0, 0.295), (11.40, 96.69)], "정적": (11.40, 12.80), "말밑": -6},
}
VOICES = ["JaxMeridian_1", "Julian_1", "TitanEpic_1", "AutumnVeil_1", "Katherine_1"]
MAIN_VOICE = "JaxMeridian_1"   # 곡 비교판에 넣는 목소리(깊고 낮은 결) — 목소리는 따로 다섯을 견준다


def load(p, ch=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def build_music(src, table):
    out = np.zeros((int(END * SR), 2), np.float32); xf = int(0.03 * SR)
    for k, (t0, s0) in enumerate(table):
        t1 = table[k + 1][0] if k + 1 < len(table) else END
        a, n = int(t0 * SR), int((t1 - t0) * SR)
        seg = src[int(s0 * SR): int(s0 * SR) + n + xf].copy()
        if len(seg) < n + xf: seg = np.vstack([seg, np.zeros((n + xf - len(seg), 2), np.float32)])
        if k > 0: seg[:xf] *= np.linspace(0, 1, xf)[:, None]          # 들어오는 쪽 30ms
        if k + 1 < len(table): seg[n:n + xf] *= np.linspace(1, 0, xf)[:, None]   # 나가는 쪽 30ms
        else: seg = seg[:n]
        out[a: a + len(seg)] += seg[: len(out) - a]
    return out


def lowpass(x, hz=300):
    al = np.exp(-2 * np.pi * hz / SR); y = np.empty_like(x); s = np.zeros(x.shape[1], np.float32)
    for i in range(len(x)):
        s = (1 - al) * x[i] + al * s; y[i] = s
    return y


def split_take(x):
    """한 판의 「Out of breath,」와 「into joy.」를 사이 쉼에서 가른다 — 10ms 크기 곡선에서 0.8~2.2초 사이 가장 긴 조용한 구간."""
    m = x.mean(1); h = int(0.01 * SR); n = len(m) // h
    e = 20 * np.log10(np.sqrt((m[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-7)
    on = np.where(e > e.max() - 38)[0]; first, last = on[0], on[-1]
    quiet = e < e.max() - 32
    best = (0, 0, 0); i = int(0.8 / 0.01)
    while i < min(n, int(2.2 / 0.01)):
        if quiet[i]:
            j = i
            while j < n and quiet[j]: j += 1
            if j - i > best[0]: best = (j - i, i, j)
            i = j
        else: i += 1
    _, g0, g1 = best
    A = x[max(0, first - 3) * h: (g0 + 3) * h]; B = x[(g1 - 3) * h: (last + 8) * h]
    return A, B, round(g0 * 0.01, 2), round(g1 * 0.01, 2)


def place_voice(mix, voice, under_db):
    A, B, g0, g1 = split_take(load(NAR / f"{voice}.mp3"))
    a0 = int(A_AT * SR); b0 = int(B_END * SR) - len(B)
    g = np.ones(len(mix), np.float32); low = 10 ** (under_db / 20); r = int(0.15 * SR)
    # 맹검(Gemini 3.6 Flash가 실제로 들음, 11-05): 첫 낱말 「Out」 앞(9.5~9.9초)의 쌓이는 소리를 조금 더 일찍 낮춰 말이 들어갈 자리를 내라 → 앞말만 0.45초 앞부터 낮춤
    for s, L, rr in ((a0, len(A), int(0.45 * SR)), (b0, len(B), r)):
        g[s - rr: s] = np.minimum(g[s - rr: s], np.linspace(1, low, rr)); g[s: s + L] = np.minimum(g[s: s + L], low)
        g[s + L: s + L + r] = np.minimum(g[s + L: s + L + r], np.linspace(low, 1, r))
    out = mix * g[:, None]
    out[a0: a0 + len(A)] += A; out[b0: b0 + len(B)] += B
    return out, {"쉼": [g0, g1], "앞말": [A_AT, round(A_AT + len(A) / SR, 2)], "뒷말": [round(b0 / SR, 2), B_END]}


def finish(x, wav):
    raw = OUT_A / "_raw.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", str(raw)], input=x.astype(np.float32).tobytes())
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", f"volume={-16 - I:.2f}dB,alimiter=limit=0.84:level=false:attack=2:release=60", "-ar", str(SR), str(wav)])
    raw.unlink()
    return I


def mux(wav, mp4, vid=VID):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vid), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", str(mp4)])


OUT_A.mkdir(parents=True, exist_ok=True)
rec = {}
music = {}
for name, e in EDITS.items():
    m = build_music(load(e["곡"]), e["표"])
    if e["정적"]:
        t0, t1 = e["정적"]; i0, i1 = int(t0 * SR), int(t1 * SR); f = int(0.08 * SR)
        lp = lowpass(m[i0 - f: i1 + f]) * (10 ** (-10 / 20))
        w = np.ones(len(lp), np.float32); w[:f] = np.linspace(0, 1, f); w[-f:] = np.linspace(1, 0, f)
        m[i0 - f: i1 + f] = m[i0 - f: i1 + f] * (1 - w[:, None]) + lp * w[:, None]
    c0, f = int(CUT * SR), int(0.02 * SR)
    m[c0 - f: c0] *= np.linspace(1, 0, f)[:, None]; m[c0:] = 0
    music[name] = m
    mix, where = place_voice(m, MAIN_VOICE, e["말밑"])
    wav = OUT_A / f"{name}.wav"; I = finish(mix, wav)
    mux(wav, OUT_V / f"p5n_소리비교2_{name}.mp4")
    rec[name] = {"곡": e["곡"].name, "편집표_우리초_원곡초": e["표"], "편집으로_만든_정적": e["정적"], "말": where, "목소리": MAIN_VOICE, "올리기전_LUFS": round(I, 1)}
    print(name, rec[name])

# 목소리 다섯 — 일레븐 Vertical Beam 위에서 9.0~15.0초만 이어 붙인 한 편(판 사이 0.5초 검정)
base = music["일레븐_VerticalBeam"]; parts = []; vrec = {}
for v in VOICES:
    mix, where = place_voice(base, v, EDITS["일레븐_VerticalBeam"]["말밑"])
    w = OUT_A / f"목소리_{v}.wav"; finish(mix, w); vrec[v] = where
    clip = OUT_A / f"_목소리_{v}.mp4"
    label = v.replace("_1", "")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "9.0", "-t", "6.0", "-i", str(VID), "-ss", "9.0", "-t", "6.0", "-i", str(w),
                    "-filter_complex", f"[0:v]drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='{VOICES.index(v) + 1}  {label}':x=40:y=60:fontsize=44:fontcolor=white@0.9[v];"
                    "[v]tpad=stop_mode=add:stop_duration=0.5:color=black[vv];[1:a]apad=pad_dur=0.5[aa]",
                    "-map", "[vv]", "-map", "[aa]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "256k", "-ar", str(SR), str(clip)])
    parts.append(clip)
lst = OUT_A / "_목소리목록.txt"; lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(OUT_V / "p5n_목소리비교.mp4")])
for p in parts: p.unlink()
lst.unlink()
rec["목소리비교"] = {"곡": "일레븐_VerticalBeam", "순서": VOICES, "말": vrec}
(OUT_A / "비교2.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
print("목소리 비교", [v for v in VOICES])
