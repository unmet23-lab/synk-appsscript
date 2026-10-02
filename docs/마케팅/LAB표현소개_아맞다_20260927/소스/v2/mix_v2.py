# -*- coding: utf-8 -*-
"""v2 소리 — 음악(Lyria 3) 바닥 + 내레이션 + 몽글 목소리 + UI 소리를 샘플 단위로 섞는다.
음악은 내레이션 아래에서 6dB, 몽글 소리 아래에서 2.5dB, 따라 말하기 여백에서 4dB 내려간다(80ms 내림·200ms 올림).
마스터: −14 LUFS(통합) · 트루피크 −1.5 dBTP 이하(4배 오버샘플 피크로 룩어헤드 리미터) — AAC 인코딩 뒤 −1.0 이하를 지키기 위한 여유.
사용: python mix_v2.py --video <영상> --out <mp4> [--wav <마스터 wav>]"""
import sys, os, json, re, argparse, subprocess
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from scipy.signal import resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); BASE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import render_v2 as R
SR = 48000
N = int(round(round(R.DUR * R.FPS) / R.FPS * SR))  # 영상 프레임 수에 딱 맞춘 길이
TARGET_I, CEIL_TP = -14.0, -1.5
BGM_FILE = os.path.join(HERE, "bgm", "lyria3_b.mp3")
BGM_LUFS = -27.0  # 내레이션 줄(−18 LUFS)보다 9dB 아래가 기본
def load(path, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()
def measure(x):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[1]), "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode("utf-8", "replace")
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", p)[-1]); LRA = float(re.findall(r"LRA:\s+([\d.]+) LU", p)[-1])
    tp = re.findall(r"Peak:\s+(-?[\d.inf]+) dBFS", p); TP = float(tp[-1]) if tp and tp[-1] not in ("-inf",) else -99.0
    return I, TP, LRA
def env_for(windows, depth_db, n, down=0.08, up=0.20):
    """windows: [(a,b)] 초 — 그 구간에서 depth_db 만큼 내려가는 게인 곡선(선형 램프)."""
    g = np.zeros(n, np.float32)
    for a, b in windows:
        ia, ib = int(a * SR), int(b * SR)
        ra, rb = int(down * SR), int(up * SR)
        seg = np.zeros(n, np.float32)
        s0 = max(0, ia - ra); seg[s0:ia] = np.linspace(0, 1, ia - s0) if ia > s0 else 0
        seg[ia:ib] = 1.0
        e1 = min(n, ib + rb); seg[ib:e1] = np.linspace(1, 0, e1 - ib) if e1 > ib else 0
        g = np.maximum(g, seg)
    return g * depth_db
LIM_STATS = {}
def limiter(x, ceil_db, look=0.004, rel=0.08):
    over = np.max(np.abs(np.stack([resample_poly(x[:, c], 4, 1) for c in range(x.shape[1])], axis=1)), axis=1)
    peak = over[: (len(over) // 4) * 4].reshape(-1, 4).max(axis=1)
    peak = np.pad(peak, (0, len(x) - len(peak)), mode="edge")
    ceil = 10 ** (ceil_db / 20); need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    L = int(look * SR)
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * L + 1, mode="nearest")
    a = np.exp(-1.0 / (rel * SR)); out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):  # 즉시 내려가고 천천히 돌아온다
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]; out[i] = cur
    from scipy.ndimage import uniform_filter1d
    out = np.minimum(uniform_filter1d(out, size=int(0.001 * SR), mode="nearest"), g + 1e-6)  # 가장자리 0 채움 없이 1ms 다듬기
    grdb = 20 * np.log10(out); LIM_STATS.update(over3=round(float((grdb < -3).mean() * 100), 3), over1=round(float((grdb < -1).mean() * 100), 3))
    return x * out[:, None], float(grdb.min())
def compress(v, thr_db=-16.0, ratio=2.5, att=0.001, rel=0.10, knee=6.0):
    """내레이션 버스 압축 — 첫소리 튐을 부드럽게 눌러 리미터가 거의 일하지 않게 한다(피크 검출, 소프트 니)."""
    a_att, a_rel = np.exp(-1.0 / (att * SR)), np.exp(-1.0 / (rel * SR))
    env = np.empty_like(v); e = 0.0; ax = np.abs(v)
    for i in range(len(v)):
        c = ax[i]; e = (a_att * e + (1 - a_att) * c) if c > e else (a_rel * e + (1 - a_rel) * c); env[i] = e
    over = 20 * np.log10(np.maximum(env, 1e-9)) - thr_db
    gr = np.where(over <= -knee / 2, 0.0, np.where(over >= knee / 2, over * (1 / ratio - 1), (1 / ratio - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    return v * (10 ** (gr / 20)), float(gr.min())
def build(voice=True):
    n = N; bus_v = np.zeros((n, 2), np.float32); bus_s = np.zeros((n, 2), np.float32)
    vwin, mwin = [], []
    for t, bus, f, gdb, what in R.AUDIO:
        if bus == "voice" and not voice: continue
        y = load(os.path.join(BASE, f), 1)[:, 0] * (10 ** (gdb / 20))
        i = int(round(t * SR)); j = min(n, i + len(y))
        tgt = bus_v if bus == "voice" else bus_s
        tgt[i:j] += y[: j - i, None]
        (vwin if bus == "voice" else mwin if bus == "mascot" else []).append((t, t + len(y) / SR))
    m = load(BGM_FILE, 2); o = int(R.MUSIC_OFFSET * SR); m = m[o:o + n]
    if len(m) < n: m = np.pad(m, ((0, n - len(m)), (0, 0)))
    I_m, _, _ = measure(m); m *= 10 ** ((BGM_LUFS - I_m) / 20)
    pa, pb, pd = R.DUCK["practice"]
    duck = np.minimum.reduce([env_for(vwin, R.DUCK["voice"], n), env_for(mwin, R.DUCK["mascot"], n), env_for([(pa, pb)], pd, n)]) if voice else \
           np.minimum.reduce([env_for(mwin, R.DUCK["mascot"], n), env_for([(pa, pb)], pd, n)])
    m *= (10 ** (duck / 20))[:, None]
    fi, fo = int(0.01 * SR), int(0.30 * SR)
    m[:fi] *= np.linspace(0, 1, fi)[:, None]; m[-fo:] *= (np.linspace(1, 0, fo) ** 1.5)[:, None]
    comp_gr = 0.0
    if voice:
        I_pre = measure(bus_v)[0]; vc, comp_gr = compress(bus_v[:, 0].copy())
        vc *= 10 ** ((I_pre - measure(np.repeat(vc[:, None], 2, axis=1))[0]) / 20)  # 압축 전과 같은 음량으로 되돌림
        bus_v = np.repeat(vc[:, None], 2, axis=1)
    mix = bus_v + bus_s + m
    return mix, {"bgm_measured_lufs": round(I_m, 2), "voice_comp_max_gr_db": round(comp_gr, 2), "voice_windows": [(round(a, 2), round(b, 2)) for a, b in vwin]}
def master(mix):
    I0, TP0, _ = measure(mix); g = TARGET_I - I0; info = {}
    for it in range(6):
        y, gr = limiter(mix * 10 ** (g / 20), CEIL_TP)
        I2, TP2, LRA2 = measure(y)
        info = {"iter": it + 1, "gain_db": round(g, 2), "limiter_max_gr_db": round(gr, 2), "I": I2, "TP": TP2, "LRA": LRA2}
        if abs(I2 - TARGET_I) <= 0.1 and TP2 <= CEIL_TP + 0.05: break
        g += TARGET_I - I2
    info["limiter_over3db_pct"] = LIM_STATS.get("over3"); info["limiter_over1db_pct"] = LIM_STATS.get("over1")
    return y, info
if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--video", required=True); ap.add_argument("--out", required=True); ap.add_argument("--wav"); ap.add_argument("--no-voice", action="store_true")
    a = ap.parse_args()
    mix, meta = build(voice=not a.no_voice); y, info = master(mix)
    wav = a.wav or (os.path.splitext(a.out)[0] + "_master.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", wav], input=y.astype(np.float32).tobytes(), check=True)
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", a.video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", a.out], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    print(json.dumps({"out": a.out, "master": info, **meta}, ensure_ascii=False))
