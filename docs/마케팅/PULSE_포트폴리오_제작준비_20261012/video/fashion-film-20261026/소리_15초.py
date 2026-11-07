# 4번 「결채」 15초 소리(2026-11-07, Claude) — 편집_15초.py 「소리」가 부른다. 30초 판(최종소리.py)과 같은 재료를 15초 차례에 다시 놓는다.
#   곡: 통째_a(stable-audio-3, D단조 · 86 BPM)를 2.713초 당겨(화면 = 곡 − 2.713) 이음 없이 0 ~ 12.0초 —
#     곡 패드 앞머리가 스튜디오(0~2.9초), 곡 5.63초 첫 박이 억새밭 첫 장(2.917초), 곡 11.21초 한 단 세짐이 밤 첫 장(8.5초), 끝 화면 11.29초는 그다음 마디 첫 박(곡 14.0초).
#     곡은 끝 화면 첫 장에서 한꺼번에 멈추고 `끝` 타격의 잔향만 남는다(30초 판과 같은 끝).
#   빈자리: 창틀 빛이 꺼지는 8.0~8.5초는 곡을 비켜 조용히 두고(해가 짐), 밤 첫 장에 트레일러 붐 하나.
#   효과음 · 폴리(30초 판과 같은 녹음): 억새밭으로 넘어가는 바람 러시 · 붐(2.917초) · 억새 바람 · 흙길 부츠 한 걸음 · 번쩍의 짧은 바람.
import os

import numpy as np

import 최종소리 as S0

C = S0.C
RATE = S0.RATE
OFF = 5.626 - 70 / 24   # 곡 5.626초 첫 박 → 화면 70장(2.917초)


def build(out_wav, M, total):
    m = C.Mix(total + 0.5)
    END = M["끝"]          # 12.0
    B, Cc, D = M["B1"], M["C1"], M["D1"]

    # ===== 곡: 통째_a — 0 ~ 12.0초
    s1 = C.load_stereo(os.path.join(S0.SONG, "통째_a.wav"))
    body = s1[int(OFF * S0.RATE):int((END + OFF) * S0.RATE)].copy()
    t1 = np.arange(len(body)) / RATE
    # 8.05~8.47초는 곡을 크게 비킨다 — 곡이 8.29초(곡 11.0초)에 먼저 세져 −7 dB로는 그 자리가 −15 dB로 남았다(첫 판). 빛이 꺼지는 숨 → 밤 첫 장에 곡 · 붐이 함께
    #   (창가 빛은 끝 8장 = 8.17초부터 꺼진다)
    pts = [(0.0, -9.0), (1.6, -6.0), (2.55, -3.0), (B - 0.02, -2.0), (B + 0.05, 0.0), (4.6, 1.0), (Cc, 3.0), (7.4, 4.0), (8.10, 3.0),
           (8.22, -12.0), (8.32, -15.0), (D - 0.03, -15.0), (D + 0.02, 0.0), (11.9, 1.0), (END, 1.0)]
    body = body * S0.envelope(t1, pts)[:, None].astype(np.float32)
    body = S0.fades(S0.tame(body, 11.0), 0.45, 0.006)
    m.put(0.0, S0.to_rms(body, -21.0), 0, fade=0.0)

    # ===== 붐: 앞_패드(곡 0.99초) → 억새밭 첫 장
    p = C.load_stereo(os.path.join(S0.SONG, "앞_패드.wav"))
    hit, b0 = 0.99, 0.45
    boom = p[int(b0 * RATE):int(4.6 * RATE)].copy()
    tb0 = np.arange(len(boom)) / RATE
    boom = boom * S0.envelope(tb0, [(0.0, 0.0), (hit - b0 + 0.25, 0.0), (hit - b0 + 1.2, -7.0), (hit - b0 + 2.6, -16.0), (len(boom) / RATE, -30.0)])[:, None].astype(np.float32)
    m.put(B - (hit - b0), S0.to_rms(S0.fades(S0.tame(boom, 10.0), 0.30, 0.4), -23.0), 0, fade=0.0)

    # ===== 끝 타격 — 끝 화면 첫 장. 원본 끝 화면(65.0 타격 −5 → 66.0 −15 → 67.0 −25 → 68.0 −32)과 같은 감쇠 — 30초 판과 같은 자국
    #   (끝 화면이 3초였던 판의 빠른 감쇠는 +1초에 −23 dB로 원본보다 일찍 꺼졌다)
    e = C.load_stereo(os.path.join(S0.SONG, "끝.wav"))
    tail = e[:int((total - END) * RATE)].copy()
    tt = np.arange(len(tail)) / RATE
    tail = tail * S0.envelope(tt, [(0.0, 0.0), (0.5, -3.0), (1.0, -9.0), (1.5, -14.0), (2.0, -19.0), (2.5, -24.0), (3.0, -30.0), (total - END, -60.0)])[:, None].astype(np.float32)
    m.put(END - 0.004, S0.to_rms(S0.fades(S0.tame(tail, 10.0), 0.004, 0.05), -19.0), 0, fade=0.0)

    # ===== 트레일러 붐 — 밤 첫 장(곡이 한 단 세지는 자리)
    tb = S0.seg(os.path.join(S0.SON, "Federico Soler - Effective Trailer Booms Vol. 2", "EffectiveTrailer_Booms_Vol2_075.wav"), 0.15, 3.0, True)
    m.put(D - 0.15, S0.to_rms(S0.fades(S0.tame(S0.lp(tb, 2500), 6.0), 0.01, 1.2), -22.0), 0, fade=0.0)

    # ===== 효과음
    # 억새밭으로 넘어가는 바람 러시 — 번쩍(2.83초) 조금 앞에서 일어나 억새밭 첫 0.5초를 지난다
    rush = S0.seg(os.path.join(S0.SON, "344 Audio - Elemental Palette Designed Vol. 1", "WINDDsgn_Wind, Rush, Whoosh, Long x5 01_344 Audio_Elemental Palette Designed Vol 1.wav"), 0.0, 1.0, True)
    m.put(B - 0.22, S0.to_rms(S0.tame(S0.fades(rush, 0.12, 0.35), 4.0), -20.0), 0, fade=0.0)
    # 억새 바람(억새밭 내내) — 아주 작게
    grass = S0.seg(os.path.join(S0.FAIR, "Grass Moving With The Win.M.wav"), 2.0, 12.0)
    g1 = S0.loop_to(grass, Cc - B + 0.2)
    m.put(B, S0.to_rms(S0.fades(g1, 0.10, 0.25), -37.0), 0, fade=0.0)
    # 흙길 부츠 한 걸음 — 판 57장에 앞발이 닿는다(C1은 38장부터)
    st = S0.seg(os.path.join(S0.FAIR, "Boots On Rough Dirt Footsteps.M.wav"), 2.34, 2.80)
    m.put(Cc + (57 - 38) / 24 - 0.06, S0.to_rms(S0.fades(st, 0.004, 0.15), -33.0), 0, fade=0.0)
    # 흰 빛 번쩍 — 짧은 바람(30초 판 번쩍과 같은 녹음)
    lw = S0.seg(os.path.join(S0.FAIR, "Low Whoosh x2.wav"), 0.08, 0.40)
    m.put(B - 0.12, S0.to_rms(S0.fades(lw, 0.02, 0.12), -29.0), 0, fade=0.0)

    m.finish(out_wav, boost_db=1.5)
    print("소리", out_wav)
