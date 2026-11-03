"""
주문 폭주 캠퍼스 판 2판 — Suno 연주곡(공식 내려받기 WAV)에서 게임 배경음악 고리를 만든다(2026-11-03).

    python -I -X utf8 experiences/order-rush/qa/world-campus-20261103/음악고리.py

하는 일(곡마다):
  1. 빠르기 — 스펙트럼 변화(onset) 곡선의 자기상관으로 BPM(60~180), 박 자리 맞춤(빗살 거르개), 4/4 마디 첫 박은 저역(킥) 세기로 고른다.
  2. 고리 — 앞의 도입(소리가 고르게 차기 전)과 끝(마무리 · 줄어듦)을 빼고, 8 · 16 · 24 · 32마디 길이 가운데
     「끝 마디의 소리 결(멜 대역 로그 에너지)이 첫 마디와 가장 닮은」 길이를 고른다(45초 이상). 이음매는 게임이 80ms 겹쳐 잇는다(world-music.mjs).
  3. 파일 — 고리 앞뒤로 0.6초씩 더 붙여(겹쳐 잇는 몫 · 디코더 앞 여백 몫) −18 LUFS · 최대 −1.5 dBTP로 맞춘 MP3 160kbps(44.1kHz 스테레오).
     게임은 파일 안의 고리 자리(loopStart · loopEnd)만 되풀이한다.
  4. 목소리 섞임 — Demucs로 뗀 목소리 층(떼기/<이름>_목소리.wav)이 있으면 그 크기를 원곡과 견준다(노랫말 없는 곡이어야 듣기 게임에 쓴다).
나가는 것: experiences/order-rush/assets/world/music/<이름>.mp3 · music.json(곡마다 bpm · 마디 · loopStart · loopEnd · 음량 · 목소리 비율 · 원곡 정보)
원곡 WAV · 뗀 층은 git 밖 공용 작업본 .tmp/order-rush-world-20261103/음악/. 후보정(EQ · 압축)은 하지 않고 크기만 맞춘다.
"""
import json
import os
import warnings
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

여기 = Path(__file__).resolve().parent
뿌리 = 여기.parents[3]
공용 = Path(os.environ.get("SYNK_SHARED", r"C:\Users\q1212\Documents\SYNK-appsscript"))
원곡 = 공용 / ".tmp" / "order-rush-world-20261103" / "음악"
낼 = 뿌리 / "experiences" / "order-rush" / "assets" / "world" / "music"
낼.mkdir(parents=True, exist_ok=True)
warnings.filterwarnings("ignore", message="Chunk")
SR = 22050
HOP = 256
여백 = 0.6

# 이름 → (모드, Suno 곡 id, 제목, 지시한 BPM)
곡 = {
    "open-a1b7366a": ("calm", "a1b7366a-3fda-4352-bd31-4b8543410e55", "Order Rush Open C", 88),
    "open-5b24e08e": ("calm", "5b24e08e-8ecd-443c-a0e9-3c5e6136c0a3", "Order Rush Open C", 88),
    "lunch-fa1490bb": ("rush", "fa1490bb-cd8b-4b2a-918b-c0a058cf02d4", "Order Rush Lunch G", 108),
    "lunch-65feca30": ("rush", "65feca30-bd2f-4e78-ab37-4774ccbf0bf9", "Order Rush Lunch G", 108),
}


def 읽기(p):
    sr, x = wavfile.read(p)
    x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim == 1:
        x = x[:, None]
    return sr, x


def 멜(mono):
    n = 2048
    win = np.hanning(n)
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(mono, (n // 2, n // 2)), n)[::HOP] * win
    mag = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    edges = np.geomspace(40, 10000, 41)
    bands = np.stack([mag[:, (freqs >= lo) & (freqs < hi)].sum(axis=1) for lo, hi in zip(edges[:-1], edges[1:])], axis=1)
    return np.log1p(bands * 10), mag, freqs


# 크룸한슬 조 윤곽(장 · 단) — 고리 구간의 음높이 무게(크로마)와 24조의 상관 중 가장 큰 조
_장 = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_단 = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_이름 = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def 조(mag, freqs, i0, i1):
    keep = (freqs >= 65) & (freqs <= 2000)
    f = freqs[keep]
    pc = np.round(12 * np.log2(f / 261.6256)).astype(int) % 12
    e = (mag[i0:i1][:, keep] ** 2).sum(axis=0)
    chroma = np.bincount(pc, weights=e, minlength=12)
    best = max(((float(np.corrcoef(np.roll(prof, k), chroma)[0, 1]), f"{_이름[k]} {mode}") for prof, mode in ((_장, "major"), (_단, "minor")) for k in range(12)))
    return {"name": best[1], "r": round(best[0], 3)}


def 분석(이름):
    sr, x = 읽기(원곡 / f"{이름}.wav")
    mono = resample_poly(x.mean(axis=1), SR, sr)
    band, mag, freqs = 멜(mono)
    flux = np.maximum(np.diff(band, axis=0), 0).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux = (flux - np.convolve(flux, np.ones(16) / 16, mode="same")).clip(0)
    fps = SR / HOP
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    lags = np.arange(len(ac))
    bpm_of = lambda lag: 60 * fps / lag
    cand = [(ac[l], bpm_of(l), l) for l in range(int(fps * 60 / 180), int(fps * 60 / 60))]
    # 지시한 빠르기 근처(±25%)를 먼저 보되, 자기상관 봉우리로 고른다
    want = 곡[이름][3]
    near = [c for c in cand if abs(c[1] - want) / want < 0.25] or cand
    _, bpm0, lag0 = max(near)
    # 봉우리를 소수점으로 다듬기(포물선)
    a, b, c = ac[lag0 - 1], ac[lag0], ac[lag0 + 1]
    lag = lag0 + 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else lag0
    beat = lag / fps
    bpm = 60 / beat
    # 박 자리: 빗살(박 간격)을 옮겨 가며 onset 합이 가장 큰 위상
    t = np.arange(len(flux)) / fps
    phases = np.linspace(0, beat, 64, endpoint=False)
    def comb(ph):
        idx = np.round((np.arange(ph, t[-1], beat)) * fps).astype(int)
        idx = idx[idx < len(flux)]
        return flux[idx].sum()
    phase = max(phases, key=comb)
    beats = np.arange(phase, t[-1], beat)
    # 마디 첫 박: 저역(40~160Hz) 세기가 가장 큰 4박 위상
    low = mag[:, (freqs >= 40) & (freqs < 160)].sum(axis=1)
    def lowat(k):
        idx = np.round(beats[k::4] * fps).astype(int)
        idx = idx[idx < len(low)]
        return low[idx].mean()
    k0 = max(range(4), key=lowat)
    bars = beats[k0::4]
    bar = 4 * beat
    # 소리 세기(짧은 창 RMS) — 도입 · 끝을 가른다
    cs = np.concatenate([[0], np.cumsum(mono ** 2)])   # 1초 창 이동 평균(누적합 — 합성곱은 너무 느리다)
    half = SR // 2
    idx = np.arange(len(mono))
    lo_, hi_ = np.clip(idx - half, 0, len(mono)), np.clip(idx + half, 0, len(mono))
    rms = np.sqrt((cs[hi_] - cs[lo_]) / np.maximum(hi_ - lo_, 1))
    med = np.median(rms)
    steady = lambda s: rms[int(s * SR)] > med * 0.7
    시작 = next((b for b in bars if b > 1.5 and steady(b) and steady(b + bar)), bars[1])
    # 끝: 마지막에서 세기가 줄어드는 곳 앞 마디
    끝한계 = len(mono) / SR - 2.0
    for s in np.arange(len(mono) / SR - 2.0, 시작, -0.25):
        if rms[int(s * SR)] > med * 0.75:
            끝한계 = s - bar   # 마무리 마디 하나는 남긴다
            break
    def 결(s):   # 한 마디 소리 결(멜 대역 평균)
        i0, i1 = int(s * fps), int((s + bar) * fps)
        return band[i0:i1].mean(axis=0)
    best = None
    for n in (32, 24, 16, 8):
        e = 시작 + n * bar
        if e + bar > 끝한계 or n * bar < 45:
            continue
        a1, b1 = 결(시작), 결(e)
        sim = float(np.dot(a1, b1) / (np.linalg.norm(a1) * np.linalg.norm(b1)))
        # 이음매 바로 앞뒤(마디 끝 → 첫 마디)도 본다 — 고리 앞에 한 마디가 없으면(도입이 짧은 곡) 첫 마디 비교만
        sim2 = None
        if 시작 - bar >= 0:
            a2, b2 = 결(시작 - bar), 결(e - bar)
            sim2 = float(np.dot(a2, b2) / (np.linalg.norm(a2) * np.linalg.norm(b2)))
        score = (sim + (sim if sim2 is None else sim2)) / 2 + n * 0.0008   # 같으면 긴 고리
        if best is None or score > best[0]:
            best = (score, n, e, sim, sim2)
    if best is None:
        raise SystemExit(f"{이름}: 45초 넘는 고리를 못 찾았다")
    _, n, 끝, sim, sim2 = best
    return {"bpm": round(bpm, 2), "bar": round(bar, 4), "bars": n, "start": round(float(시작), 4), "end": round(float(끝), 4),
            "seamSimilarity": round(sim, 4), "seamBefore": None if sim2 is None else round(sim2, 4), "duration": round(len(mono) / SR, 2),
            "key": 조(mag, freqs, int(시작 * fps), int(끝 * fps))}


def 목소리비율(이름):
    p = 원곡 / "떼기" / f"{이름}_목소리.wav"
    if not p.exists():
        return None
    _, v = 읽기(p)
    _, x = 읽기(원곡 / f"{이름}.wav")
    rv = np.sqrt(np.mean(v ** 2)); rx = np.sqrt(np.mean(x ** 2))
    # 목소리 층이 가장 큰 3초 창도 본다(짧은 허밍 · 구호 찾기)
    mv = v.mean(axis=1); w = 3 * 44100
    peak = max(np.sqrt(np.mean(mv[i:i + w] ** 2)) for i in range(0, max(1, len(mv) - w), w // 2))
    return {"rmsDb": round(20 * np.log10(rv / rx + 1e-12), 1), "loudest3sDb": round(20 * np.log10(peak / rx + 1e-12), 1)}


결과 = {"version": 1, "target": {"lufs": -18, "truePeakDb": -1.5, "codec": "mp3 160k 44.1kHz stereo"}, "margin": 여백, "tracks": {}}
출처 = {}   # 곡 출처 · 권리 — 공개 게임 파일(music.json)에 싣지 않고 qa/world-music-sources.json에(공개 빌드가 제작 도구 이름을 막는다, 11-04)
for 이름, (모드, sid, 제목, _) in 곡.items():
    a = 분석(이름)
    s, e = a["start"] - 여백, a["end"] + 여백
    out = 낼 / f"{이름}.mp3"
    # 1차: 크기 재기 → 2차: 맞춰 쓰기(loudnorm 두 번 돌리기)
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", f"{s}", "-to", f"{e}", "-i", str(원곡 / f"{이름}.wav"),
                            "-af", "loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    j = json.loads(probe.stderr[probe.stderr.rindex("{"):probe.stderr.rindex("}") + 1])
    af = (f"loudnorm=I=-18:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=44100")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{s}", "-to", f"{e}", "-i", str(원곡 / f"{이름}.wav"),
                    "-af", af, "-ac", "2", "-c:a", "libmp3lame", "-b:a", "160k", str(out)], check=True)
    결과["tracks"][이름] = {"mode": 모드, "file": f"assets/world/music/{이름}.mp3", "loopStart": 여백, "loopEnd": round(여백 + a["end"] - a["start"], 4),
                          **a, "inputLufs": float(j["input_i"]), "vocals": 목소리비율(이름), "bytes": out.stat().st_size}
    출처[이름] = {"file": 결과["tracks"][이름]["file"], "suno": sid, "title": 제목, "rights": "suno-premier-official-download"}
    print(이름, 결과["tracks"][이름]["bpm"], "BPM", a["key"]["name"], a["bars"], "마디", round(a["end"] - a["start"], 1), "초", "이음매", a["seamSimilarity"], a["seamBefore"], 결과["tracks"][이름]["vocals"])
(낼 / "music.json").write_text(json.dumps(결과, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
(여기.parent / "world-music-sources.json").write_text(json.dumps({"note": "곡 출처 · 권리(공개 게임 파일 music.json에는 싣지 않는다 — 공개 빌드의 제작 도구 이름 검사). 음악고리.py가 함께 쓴다.", "tracks": 출처}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
