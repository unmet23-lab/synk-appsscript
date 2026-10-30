# 드라마 말하기 영상 시험 — 클립 소리에 우리 녹음(깨끗한 원본)을 토막마다 맞춰 얹는다(2026-10-30).
# Seedance가 소리 참고를 따라 다시 낸 목소리와 우리 대사 녹음의 크기 곡선(10ms)을 맞대 어긋난 초를 찾고, 그 자리에 원본을 얹는다.
# 한 줄을 통째로 맞추지 않고 쉼(0.25초 이상)으로 나눈 토막마다 맞춘다 — 모델이 문장 사이를 원본보다 길게 쉬기도 한다
# (현장노트 higgsfield 「시간표와 대사가 지시문보다 늦게 온다」, 10-30 2.5 실사 5번: 첫 문장 2.44초 = 원본 2.40초, 둘째 문장 1.73초 ↔ 원본 1.10초).
# 토막 상관 0.94 이상이면 맞은 것, 토막 길이 차가 크면 입이 소리보다 오래 움직인다(「길이차」로 찍는다). 영상은 다시 인코딩하지 않는다.
#   python -X utf8 입맞춤.py <클립.mp4> <대사.mp3> <나갈.mp4>
import json
import subprocess
import sys

import numpy as np

SR = 16000
HOP = 160  # 10ms


def pcm(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def env(x):
    n = len(x) // HOP
    return np.sqrt((x[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1) + 1e-12)


def vdur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def ncc(a, b):
    a = (a - a.mean()) / (a.std() + 1e-9)
    b = (b - b.mean()) / (b.std() + 1e-9)
    return float((a * b).mean())


def runs(on, min_len):
    out, start = [], None
    for i, v in enumerate(list(on) + [False]):
        if v and start is None:
            start = i
        if not v and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    return out


def speech_spans(e):
    # 말 토막: 쉼 0.25초 이상으로 끊는다. 문턱은 봉우리의 8%.
    on = e > max(e.max() * 0.08, 1e-4)
    spans = runs(on, 3)
    merged = []
    for s, t in spans:
        if merged and s - merged[-1][1] < 25:
            merged[-1] = (merged[-1][0], t)
        else:
            merged.append((s, t))
    return merged


clip, line, dst = sys.argv[1:4]
c = env(pcm(clip))
x = pcm(line)
l = env(x)
toks = speech_spans(l)
placed, prev_end = [], 0
for s, t in toks:
    seg = l[max(0, s - 5): t + 5]
    lo = max(prev_end, 0)
    hi = len(c) - len(seg)
    best = (-2.0, lo)
    for lag in range(lo, max(lo + 1, hi + 1)):
        r = ncc(c[lag: lag + len(seg)], seg)
        if r > best[0]:
            best = (r, lag)
    r, lag = best
    start_clip = lag + (s - max(0, s - 5))
    placed.append({"원본": [round(s * HOP / SR, 2), round(t * HOP / SR, 2)], "클립자리": round(start_clip * HOP / SR, 2), "상관": round(r, 3)})
    prev_end = start_clip + (t - s)
# 클립 쪽 말 토막과 길이 비교(입이 소리보다 오래 움직이는지)
ctoks = speech_spans(c)
for p in placed:
    a0 = p["클립자리"]
    near = [q for q in ctoks if abs(q[0] * HOP / SR - a0) < 0.6]
    if near:
        q = near[0]
        p["클립토막"] = [round(q[0] * HOP / SR, 2), round(q[1] * HOP / SR, 2)]
        p["길이차"] = round((q[1] - q[0]) * HOP / SR - (p["원본"][1] - p["원본"][0]), 2)
dur = vdur(clip)
# 토막마다 원본을 잘라 제자리에 얹는다(앞뒤 40ms 여유, 겹치지 않게)
parts, labels = [], []
for i, p in enumerate(placed):
    a, b = max(0.0, p["원본"][0] - 0.04), p["원본"][1] + 0.04
    ms = int(round(max(0.0, p["클립자리"] - 0.04) * 1000))
    parts.append(f"[1]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,aresample=48000,adelay={ms}|{ms}[s{i}]")
    labels.append(f"[s{i}]")
fc = ";".join(parts) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:normalize=0,apad,atrim=0:{dur:.3f}[a]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", clip, "-i", line, "-filter_complex", fc,
                "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", f"{dur:.3f}", dst], check=True)
print(json.dumps({"클립": clip, "영상초": round(dur, 3), "말시작": placed[0]["클립자리"] if placed else None, "토막": placed}, ensure_ascii=False))
