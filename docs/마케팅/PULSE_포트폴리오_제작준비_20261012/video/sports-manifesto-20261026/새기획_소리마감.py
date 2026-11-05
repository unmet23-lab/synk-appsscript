# 5번 새 기획(11-05 밤) 소리 마감 — 유호님 「Vertical Beam + Jax」: 일레븐 Vertical Beam 편집 + Jax Meridian 영어 한 줄 + 효과음 일곱으로 15초 · 6초 판을 섞는다.
# 효과음은 일레븐 효과음 웹에서 네 판씩 구운 것(git 밖 소리/p5n/효과음/raw/) 가운데 Gemini 3.6 Flash가 직접 듣고 고른 판(효과음/맹검/답_gemini-3.6-flash.md) —
#   숨은 말소리 결(자기상관 75~400Hz)이 없는 판만 썼다. 자리는 글 콘티의 사건 초에 어택(봉우리 −20 dB 넘는 첫 2ms)을 맞추고, 휙은 봉우리를 컷에 맞춘다.
# 크기: 효과음은 음악의 공간을 지키는 만큼만(맹검 1차 뒤 — 아래 표 주석), 밑창 충격은 정적 속에서 가장 크게 — 꼬리(알갱이)는 「into joy.」 밑에서 6 dB 낮춘다.
# 마감은 공용 도구 `node tools/음량마감.mjs`(−14.5 LUFS · 봉우리만 누름). 줄기(음악 · 말 · 효과음)를 따로 남겨 영상 단계에서 다시 섞는다.
#   python -X utf8 새기획_소리마감.py   → 콘티/p5n/가편집/p5n_소리마감_15초_final.mp4 · _6초_final.mp4 · 소리/p5n/마감/<판>_<줄기>.wav · 마감.json
import json, subprocess
from pathlib import Path
import numpy as np

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024")
S = V / "소리/p5n"
OUT_A, OUT_V = S / "마감", V / "콘티/p5n/가편집"
REPO = Path(__file__).resolve().parents[5]
SR = 48000
SONG = S / "음악_일레븐2/Vertical_Beam.wav"
VOICE = S / "내레이션_영어_20261105/JaxMeridian_1.mp3"
FX = S / "효과음/raw"
# 판마다: 길이 · 음악 편집표(우리 시작초, 원곡 시작초) · 끊는 초 · 말 자리 · 효과음(이름, 사건초, 맞춤, 봉우리 dBFS)
CUTS = {
    "15초": {"len": 15.0, "vid": OUT_V / "p5n_콘티가편집_15초.mp4", "표": [(0.0, 3.52), (7.65, 10.80)], "끊음": 14.6, "앞말": 10.05, "뒷말끝": 12.70,
            # 맹검 1차(효과음 다 얹은 판)는 「효과음 없는 판이 더 비싸다 — 들숨이 가장 촌스럽고, 딛기 셋은 라이브러리를 찍어 얹은 듯 음악의 공간을 갉아먹는다」
            #   → 들숨을 빼고, 딛기 셋은 6 dB 낮추고 6kHz 위를 깎아 「들리기보다 느껴지게」, 날숨도 6 dB 낮추고 부드럽게 들어오게, 밑창 충격은 그대로 두고 알갱이 결만 2 dB.
            # 맹검 2차(절제한 판)는 「효과음 없는 판보다 낫다 — 딛기 · 날숨 · 충격은 알맞다」, 다만 「휙」 둘은 「영상 템플릿 · 싼 스포츠 광고 같다」 → 둘 다 뺀다.
            "효과음": [("step_rubber_1", 2.87, "어택", -17, {"lp": 6000}), ("step_wet_3", 3.27, "어택", -18, {"lp": 6000}),
                     ("step_turf_3", 3.67, "어택", -18, {"lp": 6000}), ("exhale_2", 7.10, "어택", -31, {"fadein": 0.15}),
                     # 맹검 3차: 「충격과 알갱이 긁힘이 조금 과해 트레일러 효과음처럼 들릴 여지」 → 2 dB 낮추고 알갱이 올림을 뺀다
                     ("impact_sole_1", 11.40, "어택", -9, {})]},
}


def load(p, ch=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def build_music(src, table, end):
    out = np.zeros((int(end * SR), 2), np.float32); xf = int(0.03 * SR)
    for k, (t0, s0) in enumerate(table):
        t1 = table[k + 1][0] if k + 1 < len(table) else end
        a, n = int(t0 * SR), int((t1 - t0) * SR)
        seg = src[int(s0 * SR): int(s0 * SR) + n + xf].copy()
        if len(seg) < n + xf: seg = np.vstack([seg, np.zeros((n + xf - len(seg), 2), np.float32)])
        if k > 0: seg[:xf] *= np.linspace(0, 1, xf)[:, None]
        if k + 1 < len(table): seg[n:n + xf] *= np.linspace(1, 0, xf)[:, None]
        else: seg = seg[:n]
        out[a: a + len(seg)] += seg[: len(out) - a]
    return out


def split_take(x):
    """「Out of breath,」 · 「into joy.」를 사이 쉼에서 가른다(새기획_소리비교2.py와 같은 셈)."""
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
    return x[max(0, first - 3) * h: (g0 + 3) * h], x[(g1 - 3) * h: (last + 8) * h]


def lowpass(x, hz):
    al = np.exp(-2 * np.pi * hz / SR); y = np.empty_like(x); s = np.zeros(x.shape[1], np.float32)
    for i in range(len(x)):
        s = (1 - al) * x[i] + al * s; y[i] = s
    return y


def attack_and_peak(x):
    m = np.abs(x).max(1); h = int(0.002 * SR); n = len(m) // h
    e = 20 * np.log10(m[: n * h].reshape(n, h).max(1) + 1e-9)
    return int(np.argmax(e > e.max() - 20)) * h, int(np.argmax(e)) * h, float(e.max())


def gain_env(n, spans, db, pre=0.15, post=0.15):
    g = np.ones(n, np.float32); low = 10 ** (db / 20)
    for s, L, p0 in spans:
        r0, r1 = int(p0 * SR), int(post * SR)
        g[max(0, s - r0): s] = np.minimum(g[max(0, s - r0): s], np.linspace(1, low, s - max(0, s - r0)))
        g[s: s + L] = np.minimum(g[s: s + L], low)
        e = min(n, s + L + r1); g[s + L: e] = np.minimum(g[s + L: e], np.linspace(low, 1, e - (s + L)))
    return g


def wav(x, p):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(p)], input=x.astype(np.float32).tobytes())


OUT_A.mkdir(parents=True, exist_ok=True)
A, B = split_take(load(VOICE))
rec = {}
for name, c in CUTS.items():
    N = int(c["len"] * SR)
    music = build_music(load(SONG), c["표"], c["len"])
    voice = np.zeros((N, 2), np.float32)
    a0 = int(c["앞말"] * SR); b0 = int(c["뒷말끝"] * SR) - len(B)
    voice[a0: a0 + len(A)] += A; voice[b0: b0 + len(B)] += B
    spans = [(a0, len(A), 0.45), (b0, len(B), 0.15)]   # 앞말은 0.45초 앞부터 낮춤(소리비교2 맹검 제안)
    music *= gain_env(N, spans, -3)[:, None]
    if "뒤낮춤" in c:
        t0, dbv = c["뒤낮춤"]; i0 = int(t0 * SR); r = int(0.04 * SR)
        g = np.ones(N, np.float32); g[i0 - r: i0] = np.linspace(1, 10 ** (dbv / 20), r); g[i0:] = 10 ** (dbv / 20)
        music *= g[:, None]
    fx = np.zeros((N, 2), np.float32); placed = []
    for fn, t, mode, pk, opt in c["효과음"]:
        x = load(FX / f"{fn}.mp3"); at, pi, p_db = attack_and_peak(x)
        if "lp" in opt: x = lowpass(lowpass(x, opt["lp"]), opt["lp"])          # 6kHz 위를 깎는다(두 번 — 12 dB/옥타브)
        if "알갱이" in opt:                                                      # 충격 0.25초 뒤부터 1.5kHz 위(알갱이 결)만 더한다
            k = at + int(0.25 * SR); hi = x[k:] - lowpass(lowpass(x[k:], 1500), 1500)
            x[k:] += hi * (10 ** (opt["알갱이"] / 20) - 1)
        at, pi, p_db = attack_and_peak(x)
        x *= 10 ** ((pk - p_db) / 20)
        if "fadein" in opt: fi = int(opt["fadein"] * SR); x[at: at + fi] *= np.linspace(0, 1, fi)[:, None]
        f = int(0.01 * SR); x[:f] *= np.linspace(0, 1, f)[:, None]; x[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))[:, None]
        start = int(t * SR) - (at if mode == "어택" else pi)
        s0 = max(0, start); x = x[s0 - start:]; L = min(len(x), N - s0)
        fx[s0: s0 + L] += x[:L]
        placed.append({"소리": fn, "사건초": t, "맞춤": mode, "놓은초": round(start / SR, 3), "봉우리dBFS": pk, "손질": opt})
    fx *= gain_env(N, [(b0, len(B), 0.15)], -6)[:, None]   # 밑창 꼬리 알갱이를 「into joy.」 밑에서 낮춘다
    c0, f = int(c["끊음"] * SR), int(0.02 * SR)
    for st in (music, fx):
        st[c0 - f: c0] *= np.linspace(1, 0, f)[:, None]; st[c0:] = 0
    mix = music + voice + fx
    pk = float(np.abs(mix).max()); head = 10 ** (-3 / 20) / pk if pk > 10 ** (-3 / 20) else 1.0   # 섞은 판 봉우리를 −3 dBFS 아래로(마감 도구가 올린다)
    for stem, x in (("음악", music), ("말", voice), ("효과음", fx), ("섞음", mix)):
        wav(x * head, OUT_A / f"{name}_{stem}.wav")
    raw = OUT_V / f"p5n_소리마감_{name}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(c["vid"]), "-i", str(OUT_A / f"{name}_섞음.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "pcm_s24le", "-shortest", str(raw.with_suffix(".mov"))])
    r = subprocess.run(["node", str(REPO / "tools/음량마감.mjs"), str(raw.with_suffix(".mov")), str(OUT_V / f"p5n_소리마감_{name}_final.mp4"), "--덮어쓰기", "--json"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    raw.with_suffix(".mov").unlink()
    try: fin = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: fin = {"출력": r.stdout[-400:], "오류": r.stderr[-400:]}
    rec[name] = {"음악편집표_우리초_원곡초": c["표"], "끊음": c["끊음"], "말": {"앞말": [c["앞말"], round(c["앞말"] + len(A) / SR, 2)], "뒷말": [round(b0 / SR, 2), c["뒷말끝"]]}, "효과음": placed, "마감": fin}
    print(name, json.dumps(rec[name], ensure_ascii=False)[:900])
# 6초 판: 15초 줄기의 9.0~15.0초를 그대로 자른다(유호님 「너무 급하고 전달도 잘 안돼」 → 압축하지 않고 같은 빠르기). 말 1.05~2.22 · 2.59~3.70초, 한 방 3.865초, 뚝 5.6초.
t0 = int(9.0 * SR); fade = int(0.15 * SR); parts = {}   # 맹검(Gemini 3.8 Flash): 12ms로는 시작이 잘린 듯 들렸다 → 0.15초
for stem in ("음악", "말", "효과음"):
    x = load(OUT_A / f"15초_{stem}.wav")[t0: t0 + int(6.0 * SR)]
    x[:fade] *= np.linspace(0, 1, fade)[:, None]; parts[stem] = x; wav(x, OUT_A / f"6초_{stem}.wav")
wav(parts["음악"] + parts["말"] + parts["효과음"], OUT_A / "6초_섞음.wav")
raw = OUT_V / "p5n_소리마감_6초.mov"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT_V / "p5n_콘티가편집_6초.mp4"), "-i", str(OUT_A / "6초_섞음.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "pcm_s24le", "-shortest", str(raw)])
r = subprocess.run(["node", str(REPO / "tools/음량마감.mjs"), str(raw), str(OUT_V / "p5n_소리마감_6초_final.mp4"), "--덮어쓰기", "--json"], capture_output=True, text=True, encoding="utf-8", errors="replace")
raw.unlink()
try: fin = json.loads(r.stdout.strip().splitlines()[-1])
except Exception: fin = {"출력": r.stdout[-400:], "오류": r.stderr[-400:]}
rec["6초"] = {"짜임": "15초 줄기 9.0~15.0초를 그대로", "말": {"앞말": [1.05, 2.22], "뒷말": [2.59, 3.70]}, "한방": 3.865, "끊음": 5.6, "마감": fin}
print("6초", fin.get("after"))
(OUT_A / "마감.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
