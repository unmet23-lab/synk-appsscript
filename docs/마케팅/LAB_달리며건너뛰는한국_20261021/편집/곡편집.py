# 「달리며 건너뛰는 한국」 곡 편집(2026-11-07, Claude) — Gemini 소리 맹검 1위 드롭_c(stable-audio-3, 120.01 BPM · 첫 박 0.01초)를 콘티 v2 박표에 맞춰 박 자리에서 잇는다.
#   python -X utf8 편집/곡편집.py   → git 밖 편집/소리/곡.wav(48 kHz 스테레오 30.0초) · remotion/public/audio/music.wav
# 곡을 잰 짜임(곡재기.py · 0.5초 대역 크기): 0~15초 가벼운 앞 · 15.0~16.0초 숨(베이스 빠짐, 상승음) · 16.0초 드롭 · 16~24 / 24~32초 꽉 찬 두 구절(24.0초 심벌) · 32.0초 끝 한 타와 잦아듦.
# 화면 박표: 9.88~10.0초 비움 → 10.0초 드롭 · 18.85초 다이빙 · 20.0초 다리가 솟음 · 21.0초 답 · 27.5초 다리가 꽃 속으로(끝 한 타) · 28.0초 보내기 · 30.0초 끝.
# 잇기: 화면 0~9.5 = 곡 6.0~15.5 · 9.5~10.0 비움 · 10.0~18.0 = 곡 16~24 · 18.0~20.0 = 곡 22~24(한 마디 되풀이 — 둘째 구절의 심벌이 다리가 솟는 20.0초에 오게)
#   · 20.0~27.47 = 곡 24~31.47 · 27.47~30.0 = 곡 31.97~34.5(넷째 박을 빼고 끝 한 타와 잦아듦, v6). 이음마다 12 ms 겹친다(딸깍 막기). 빠르기 · 음높이는 손대지 않는다.
# 소리 앞쪽(0~6초 걸어옴 · 테이프 · 폰 시점)은 효과음이 들리게 곡을 낮게 · 거른 소리로 두고 6.0초 열차 출발부터 9.0초까지 거른 소리 → 원래 소리로 연다.
import os
import shutil
import subprocess
import wave

import numpy as np

R = 48000
DIR = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/편집/소리"
SRC = os.path.join(DIR, "곡", "드롭_c.wav")
OUT = os.path.join(DIR, "곡.wav")
PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "remotion", "public", "audio")
END = 30.0
PHASE = 0.01   # 곡의 첫 박(곡재기.py) — 곡 시각에 더한다
# (곡 시작초, 곡 끝초, 화면 시작초)
# v4(Fable 맹검 v2 P1 「9.5~10.0초 완전 무음 0.5초는 폰에서 소리 끊김으로 들린다」): 곡의 숨(상승음)을 9.88초까지 두고 비움은 0.12초만
# v6(Fable 맹검 v4 P1 「27.46~27.52 쓰러짐과 곡 끝 한 타(28.02)가 0.5초 어긋나 한 타가 빈 들판에 떨어진다」): 다리가 솟는 20.0초(곡 24.0 심벌)부터
#   꽃 속으로 사라지는 27.5초까지가 영상으로 7.5초라 곡 24~32(8초)보다 한 박 짧다 — 곡 끝 마디의 넷째 박(곡 31.5~32.0)을 빼 끝 한 타를 27.5초에 놓는다.
#   이음은 박 머리 40 ms 앞(곡 31.47 → 31.97, 앞 박의 잦아드는 꼬리끼리)에서 겹쳐 넷째 박 첫소리가 새지 않게 한다. 빠르기 · 음높이는 그대로.
PIECES = [
    (6.0, 15.88, 0.0),
    (16.0, 24.0, 10.0),
    (22.0, 24.0, 18.0),
    (24.0, 31.47, 20.0),
    (31.97, 34.5, 27.47),
]
XF = 0.012
# 크기(dB) 자국 — 사이는 직선. 앞 6초는 효과음 아래로, 열차 출발부터 연다. 답 · 보내기 아래는 조금 낮춘다
# v4: 첫 6초를 −9 → −5 dB(Fable 「0~5.3초 소리가 발소리 · 테이프뿐이라 비어 들린다」)
# v6: 드롭 구간(10~18초)을 −2 dB(Fable v4 P2 · Gemini v5 「10~17초가 앞보다 너무 크다」), 끝 한 타가 27.5초로 와 답 아래 낮춤을 27.35초에 푼다
# v7(Fable 맹검 v6 P2 「단기 크기 3~10초 −23.8 · 10~17초 −17.6 = +6.2 LU — 인트로 +2, 드롭 −1로 차이 3~4 LU」): 앞 6초 −5 → −3, 드롭 −2 → −3
# v10(Fable v9 P2 「끝 한 타를 키워도 천장에 눌려 봉우리가 같다 — 타격 150 ms 동안 곡을 3 dB 비켜 줘야 한 방이 된다」): 27.47~27.62초 −3 dB 뒤 울림에서 연다
GAIN = [(0.0, -3.0), (5.8, -3.0), (9.0, -2.5), (9.85, -2.5), (10.0, -3.0), (17.9, -3.0), (18.0, 0.0), (20.9, 0.0), (21.3, -2.5), (27.35, -2.5), (27.47, -3.0), (27.62, -3.0), (27.75, 0.0), (END, 0.0)]
# 거른 소리(낮은 통과 1.2 kHz)와 원래 소리를 섞는 몫 — 1이면 거른 소리만
LP_MIX = [(0.0, 1.0), (6.0, 1.0), (9.2, 0.0), (END, 0.0)]
# v7 끝 고리(Fable 맹검 v6 「원본은 쓰러짐 뒤 0.7초 빈 들판 · 음악이 끝까지 가 처음으로 돈다 — 우리 판은 마지막 1초가 거의 무음이라 처음으로 튄다」 ·
#   Gemini Lite v5 · v6 · v7 세 번 「28~30초가 다 풀려 끝이 약하다」): 끝 한 타(27.5) 뒤 한 박 쉬고, 28.0초부터 첫 2초와 같은 곡 6.0~8.0(거른 소리)을
#   작게 다시 깔아 30.0초에 곡 8.0초(마디 머리)로 끝낸다 — 되풀이 재생에서 0.0초(곡 6.0초, 마디 머리)로 박이 이어진다. (곡 시작초, 곡 끝초, 화면 시작초)
# v10(Fable v9 P2 「28.0초 톡이 반주 첫 쿵(28.02)에 묻힌다 — 반주를 28.52초부터」 · 「점점 커지면 끝맺음을 흐린다 — 작게 고정」): 곡 6.5초(둘째 박)를
#   28.5초에 놓아 30.0초가 곡 8.0초(마디 머리)인 것은 그대로, 크기는 −12 dB로 고정
TAIL = (6.5, 8.0, 28.5)
TAIL_GAIN = [(28.5, -12.0), (END, -12.0)]


def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "2", "-ar", str(R), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def lowpass(x, fc=1200.0):
    # 두 번 거는 1차 IIR(-12 dB/옥타브) — 앞뒤로 걸어 위상 밀림 없이
    a = np.exp(-2 * np.pi * fc / R)
    def one(y):
        out = np.empty_like(y)
        z = np.zeros(y.shape[1], np.float64)
        for i in range(len(y)):
            z = (1 - a) * y[i] + a * z
            out[i] = z
        return out
    y = one(one(x.astype(np.float64)))
    y = one(one(y[::-1]))[::-1]
    return y.astype(np.float32)


def env(points, n):
    t = np.arange(n) / R
    xs, ys = zip(*points)
    return np.interp(t, xs, ys).astype(np.float32)


def main():
    x = load(SRC)
    n = int(END * R)
    out = np.zeros((n, 2), np.float32)
    # v5(Gemini 소리 맹검 v4 「19초 뒤 반복 구간에서 미세한 끊김」): 이음마다 앞 조각을 XF만큼 더 끌고 뒤 조각을 XF 앞당겨 겹쳐 잇는다(같은 크기 합).
    #   옛 판은 앞 조각 끝 8 ms를 줄이고 뒤 조각 첫 8 ms를 올려 겹치지 않게 붙여, 곡이 원래 이어지는 20.0초(곡 24.0초)에서도 16 ms 동안 소리가 0으로 꺼졌다.
    f = int(XF * R)
    for k, (a, b, at) in enumerate(PIECES):
        lead = f if k > 0 and abs(PIECES[k - 1][2] + (PIECES[k - 1][1] - PIECES[k - 1][0]) - at) < 1e-6 else 0   # 바로 앞 조각에 붙는 이음만 겹침
        tail = f if k < len(PIECES) - 1 and abs(at + (b - a) - PIECES[k + 1][2]) < 1e-6 else 0
        s0, s1 = int((a + PHASE) * R) - lead, int((b + PHASE) * R) + tail
        seg = x[max(0, s0):s1].copy()
        if lead:
            seg[:2 * lead] *= np.linspace(0, 1, 2 * lead, dtype=np.float32)[:, None]   # 직선 겹침 — 같은 소리끼리 합이 1
        else:
            seg[:f] *= np.linspace(0, 1, f, dtype=np.float32)[:, None]
        if tail:
            seg[-2 * tail:] *= np.linspace(1, 0, 2 * tail, dtype=np.float32)[:, None]
        elif k < len(PIECES) - 1:
            seg[-f:] *= np.linspace(1, 0, f, dtype=np.float32)[:, None]
        d0 = int(at * R) - lead
        m = min(len(seg), n - d0)
        out[d0:d0 + m] += seg[:m]
    lp = lowpass(out)
    mix = env(LP_MIX, n)[:, None]
    y = lp * mix + out * (1 - mix)
    g = 10 ** (env(GAIN, n) / 20)
    y *= g[:, None]
    a, b, at = TAIL
    seg = lowpass(x[int((a + PHASE) * R):int((b + PHASE) * R)].copy())
    fi = int(0.03 * R)
    seg[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
    d0 = int(at * R)
    m = min(len(seg), n - d0)
    tg = 10 ** (env(TAIL_GAIN, n)[d0:d0 + m] / 20)
    y[d0:d0 + m] += seg[:m] * tg[:, None]
    tail = int(0.03 * R)   # 마지막 30 ms는 0으로 — 끝에서 딸깍 막기
    y[-tail:] *= np.linspace(1, 0, tail, dtype=np.float32)[:, None]
    peak = float(np.abs(y).max())
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(R)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
    os.makedirs(PUBLIC, exist_ok=True)
    shutil.copy2(OUT, os.path.join(PUBLIC, "music.wav"))
    print(OUT, f"{n / R:.2f}초 · 최대 {20 * np.log10(peak + 1e-9):.1f} dBFS")


if __name__ == "__main__":
    main()
