# 오미톡 15초 사람판 편집(2026-11-07 밤, Claude) — 01_새판_기획 11절. 치익톡 2판 기각(유호님 「사람은 자연스럽고 연기도 좋은데 cg나 이런게 너무 진짜 쓰레기급」) 뒤
# 효과 컷 없이 살린 사람 컷 둘(om2-2 · om2-6c)과 새 컷 셋(om2-s1 · s2 · s4 — 사람판_꾸러미.py, 장부 S44 친구 폰 판 방법)을 프레임 번호로 잘라 하드컷으로 잇는다.
#   python -X utf8 사람판편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/om2/오미톡15_9x16.mp4 · _폰.mp4 · _반초.jpg
# 후보정 없음(결정 10-24): 색 · 속도 · 얼굴 손질 없이 프레임 번호로만 자른다. 소리는 판이 낸 소리(목소리 · 숨 · 캔 따기 · 꿀꺽 · 건배)가 바탕이다.
import os
import shutil
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import 최종편집공통 as C   # noqa: E402
import 라벨다시얹기 as L    # noqa: E402
from 최종편집 import (END_CUTS, END_VO, FAIR, FPS, H, MUSIC, OUT, RATE, SND, W, rms_db, seg, tame, to_peak, to_rms)   # noqa: E402

NAME = os.environ.get("OM2_NAME", "오미톡15_9x16")
START = "C:/Users/q1212/Documents/synk-vendor/pulse-rehearsal-20261029/새판/사람판_1107"
S1 = os.environ.get("OM2_S1", "om2-s1")
S2 = os.environ.get("OM2_S2", "om2-s2")
S2B = os.environ.get("OM2_S2B", "om2-s2b")
S4 = os.environ.get("OM2_S4", "om2-s4")

# ---------- 화면 — (컷, 판, 처음 장, 장수, 라벨 다시 얹기 [(시작 그림, 캔 칸(시작 그림 화소), 멈춘 캔인가), …] 또는 None)
# 받은 판(11-07 밤 두 벌씩): s1 두 벌은 거의 같아 첫 벌(1.48초에 닿는 소리 · 눈이 동그래짐 → 곁눈질 미소). s2는 두 벌 모두 따는 순간(0.4~0.75초) 주황 물안개가
#   얼굴 앞을 덮고(기각 사유와 같은 「빛나는 효과」), 둘째 벌은 3초 내내 두 손으로 얼굴을 가려 마심 → 첫 벌에서 물안개 뒤 1.0초부터 · 「크…」 「…살았다」(받아쓰기 「으 살았다」).
#   s4 두 벌은 거의 같아 첫 벌(친구 캔이 물러났다가 1.84초 「톡」, 끝까지 두 캔 + 눈웃음).
# 라벨: 판이 작은 한글 줄을 다시 그려(「오미톡 오미자 스파클링」이 「오미륵 … 스파를링」에 가까움) 캔이 크게 보이는 2 · 6번은 시작 그림의 라벨 화소를 프레임마다 다시 얹는다.
PACK = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_om2사람판_1107"
CUTS = [
    # 1 친구 폰이 땡볕 코트에 뻗은 한결 얼굴로 다가가며 「아… 목 타 죽겠다」(치익톡 2판의 2번 그대로)
    #   (판 2.17초부터 — 2번 컷 머리를 닿는 순간 가까이 두려고 이 컷을 0.25초 앞에서 연다. 말은 0.41초에 시작)
    #   다섯 맛 판에서 저녁 「후—」 1초를 다시 넣느라 판 2.42초부터(말은 0.16초에 시작)
    (1, "om2-2", 58, 42, None),
    # 2 볼에 찬 캔 — 1.48초에 닿아 움찔 · 눈이 동그래졌다가 캔을 곁눈질하며 씩 웃음(손이 캔에 닿기 전 3.5초까지).
    #   판 1.25초부터 — 1.0초부터 열었더니 Fable 재검 「닿고 → 부릅뜸이 0.75~1초로 늦어짐, 옛 판의 빠른 움찔이 더 셌다」
    #   다섯 맛 판에서는 곁눈질 미소(판 3.25초)에서 끊는다 — 이 컷 끝에 캔 따는 「치익」(친구가 따 주는 것으로 읽힘)
    (2, S1, 30, 48, [(PACK + "/001_om2-s1/1_시작.jpg", (690, 560, 1110, 1250), False)]),
    # 11-07 밤 opus 볼 이유 2점 「다섯 가지 맛을 말로만」 → 유호님 「다섯 맛 표정 굽기」: 옛 3 · 4번(om2-s2 「크…」 「…살았다」)과 저녁 「후—」(om2-6c)를
    #   이미 딴 캔에서 시작한 om2-s2b 한 판으로 바꿨다(그 앞 판은 커밋 97b9558). s2b 두 벌 중 첫 벌 — 일레븐 받아쓰기 「새콤(3.84) 달고(4.80) 끝은(6.30) 알싸해(7.32~7.72)」,
    #   둘째 벌은 「새콤달고」가 붙음.
    # 3 한 모금(판 0.75~1.75초) — 캔 따는 「치익」은 실제 녹음을 이 컷 머리에 얹는다
    (3, S2B, 18, 24, None),
    # 4 다섯 맛 — 신 표정 → 「새콤…」 → 「달고…」 → 놀람 → 「끝은… 알싸해」 → 활짝 웃음(판 2.75~7.79초, 끊지 않고 한 번에). 캔이 가슴 앞에 서 있어 라벨을 얹는다
    #   (판이 그린 작은 줄이 「오미륵 오미자 스타클링」)
    (4, S2B, 66, 121, [(PACK + "/004_om2-s2b/1_시작.jpg", (400, 960, 800, 1660), False)]),
    # 5 해가 지고 조명이 켜진 코트에 누워 「후—」 1초(om2-6c 판 1.83~2.83초, 숨은 om2-6b 2.15~2.4초) — Fable 「노을 활짝 웃음 → 밤 건배가 다리 없이 뛰어
    #   「목 타 죽겠다」의 보상이 없다」
    (5, "om2-6c", 44, 24, None),
    # 6 저녁 건배 「톡」 · 눈웃음 — 끝까지(두 캔 라벨을 차례로 얹음). 판 0.33초부터 — 두 캔이 붙은 첫 장을 빼고 친구 캔이 물러나는 데서 연다(Fable),
    #   1.84초에 닿는다
    (6, S4, 8, 101, [(PACK + "/003_om2-s4/1_시작.jpg", (170, 200, 585, 920), False),
                     (PACK + "/003_om2-s4/1_시작.jpg", (575, 220, 930, 920), False)]),
]
TI = next(i for i, c in enumerate(CUTS) if c[1] == S4)          # 건배 컷 자리
DI = next(i for i, c in enumerate(CUTS) if c[1] == "om2-6c")    # 저녁 「후—」 컷 자리 — 낮 → 저녁 소리가 여기서 바뀐다
F = [0]
for c in CUTS:
    F.append(F[-1] + c[3])
T = [f / FPS for f in F]
TOTAL = T[-1]
assert F[-1] == 360, f"15.00초(360장)여야 하는데 {F[-1]}장"
CLINK_IN_S4 = float(os.environ.get("OM2_CLINK", "1.84"))   # S4 판 안에서 두 캔이 닿는 때(소리 봉우리 1.84초, 주변보다 +29 dB)
CLINK = T[TI] + CLINK_IN_S4 - CUTS[TI][2] / FPS


def picture():
    d = os.path.join(OUT, "_컷_사람판")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n, pid, a, k, lab in CUTS:
        src = C.clip(pid)
        if not os.path.exists(src):
            raise SystemExit(f"판이 없다: {src}")
        out = os.path.join(d, f"{n:02d}.mp4")
        if lab:
            cur, start = src, a
            for j, (ref, box, fixed) in enumerate(lab):   # 캔이 둘이면 차례로 — 둘째는 첫째를 얹은 판 위에
                tmp = os.path.join(d, f"{n:02d}_라벨720_{j}.mp4")
                L.overlay(cur, ref, box, start, k, tmp, fixed=fixed, track=not fixed)   # 캔이 오가는 컷이라 이차식 대신 장마다 따라감

                cur, start = tmp, 0
            C.cut_video(cur, 0, k, W, H, FPS, out)
        else:
            have = C.frames_of(src)
            if a + k > have:
                raise SystemExit(f"#{n} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
            C.cut_video(src, a, k, W, H, FPS, out)
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        paths.append(out)
        print(f"#{n} {pid} {a}장부터 {k}장 → {T[n - 1]:.3f}~{T[n]:.3f}초")
    C.join_videos(paths, os.path.join(OUT, "화면_사람판.mp4"))


# ---------- 소리 — 판이 낸 소리가 바탕. 더운 쪽(1~4번)은 매미, 저녁(5~6번)은 풀벌레 · 저녁 공기, 곡은 저녁 컷에서 깔려 건배 「톡」에 맺는다.
END_GAPS = (0.15, 0.35)


def end_times():
    t1 = CLINK - 0.03                                   # 「톡.」 조각 머리 — 말이 0.03초 뒤 터져 건배 소리와 겹친다
    a0 = t1 - (END_CUTS[0][1] - END_CUTS[0][0]) - END_GAPS[0]
    t2 = t1 + (END_CUTS[1][1] - END_CUTS[1][0]) + END_GAPS[1]
    return [a0, t1, t2]


def own(pid, a, k, db_rms, over=8):
    """판이 낸 소리 한 토막(스테레오) — 크기만 맞추고 봉우리를 누른다."""
    x = seg(C.clip(pid), a / FPS, (a + k) / FPS, stereo=True)
    return tame(to_rms(x, db_rms), over)


def sound():
    total = TOTAL
    m = C.Mix(total)
    ends = end_times()
    hot_end = T[DI]   # 저녁 「후—」 컷 머리에서 낮 → 저녁
    # 더위 바탕 — 매미(stable-audio 매미_a). 「아… 목 타 죽겠다」와 볼에 찬 캔(1~2번) 동안은 4 dB 숙이고(치익톡 2판 맹검 「대사가 매미에 묻힘」,
    # 사람판 맹검 둘 「볼에 닿는 반응이 안 들림」), 저녁 컷 머리에서 풀벌레와 0.8초 겹쳐 바뀐다(맹검 셋 「낮 → 저녁 7.5~8초에 소리가 뚝 끊김」)
    #   (셋째 맹검 둘 「0~8초 농구장 바탕 소리가 없어 건조 · 무음마다 끊긴 듯」 → 매미 −31에서 −29 dB, 숙임은 대사 컷만)
    cic = to_rms(C.load_stereo(SND + "/곡_스테이블/매미_a.wav")[:int((hot_end + 0.5) * RATE)], -29)
    g = np.ones(len(cic), np.float32)
    j0, j1, rr = int(T[0] * RATE), int(T[1] * RATE), int(0.25 * RATE)
    g[j0:j1] *= 10 ** (-4 / 20)
    g[j1:j1 + rr] *= np.linspace(10 ** (-4 / 20), 1, rr)
    k0, k1 = int((hot_end - 0.45) * RATE), int((hot_end + 0.35) * RATE)
    g[k0:k1] *= np.linspace(1, 0, k1 - k0)   # 고르게 — 1.5제곱으로 줄이면 앞에서 먼저 빠져 7.55~7.8초에 −32 dB 빈 틈이 났다
    g[k1:] = 0
    m.put(0, cic * g[:, None], fade=0.3)
    # 바깥 공기 — 판마다 바탕 소음이 달라 컷마다 「뚝뚝 끊긴다」(셋째 맹검 3.1 Lite) · 「낮 → 저녁에 무음」(3.6 Flash) → 처음부터 끝까지 한 겹을 낮게 깐다
    from 최종편집 import bp
    air = bp(seg(FAIR + "Ext City Ambience, Car Drive-Bys, Pedestrian, Air.wav", 60.0, 60.0 + total, stereo=True), 60, 6000)
    m.put(0, to_rms(air, -42), fade=0.4, fade_out=0.9)
    # 1~4, 6 — 판이 낸 소리 그대로(크기만 맞춤). 컷마다 판의 바탕 소음이 바뀌니 머리 · 꼬리를 조금 길게 풀고, 낮 → 저녁(4번 꼬리)은 0.3초에 걸쳐 뺀다.
    # 2번은 닿는 순간의 숨(판 1.48초)이 눌리지 않게, 6번은 건배 소리(판 1.84초, 주변보다 +29 dB)가 눌리지 않게 봉우리 누르기를 느슨하게
    for i, (n, pid, a, k, _) in enumerate(CUTS):
        if i == DI:
            continue   # 저녁 컷 숨은 아래 om2-6b 판 소리로
        # 꿀꺽은 셋째 맹검 셋 모두 「갑자기 커서 귀를 자극」이라 −24, 다섯 맛 말은 또렷하게 −21(3.1 Lite 「독백이 작아 묻힘」), 건배 컷은 봉우리 누르기를 느슨하게
        lvl = -24 if pid == S2B and a < 60 else -21 if pid == S2B else -24 if i == TI else -21
        over = 12 if pid == S1 else 14 if i == TI else 8
        m.put(T[i], own(pid, a, k, lvl, over), fade=0.03, fade_out=0.9 if i == TI else 0.15 if i == DI - 1 else 0.06)
    # 저녁 「후—」 — 그림은 om2-6c, 숨은 om2-6b 판(두 판 모두 2.15~2.4초, 6b가 4 dB 또렷 — 최종편집.py)
    v6 = seg(C.clip("om2-6b"), CUTS[DI][2] / FPS, (CUTS[DI][2] + CUTS[DI][3]) / FPS, stereo=True)
    m.put(T[DI], tame(to_rms(v6, -27), 8), fade=0.05, fade_out=0.1)
    # 건배 「톡」 — 실제 알루미늄 캔끼리 닿는 녹음(Fairlight 「Can Soda Pop Touches」 2.975초, 20ms에 꺼지는 깨끗한 한 번)을 판의 건배 소리에 겹친다
    #   (사람판 맹검 3.6 Flash 「건배 소리가 아예 안 들리거나 음악에 묻힘」 — 판 소리를 −24 dB에 맞추고 RMS+8 dB로 누르던 탓)
    clink = seg(FAIR + "Can Soda Pop Touches.M.wav", 2.955, 3.30)
    m.put(CLINK - 0.02, to_peak(clink, -7), fade=0.002, fade_out=0.15)
    # 캔 따는 「치익」 — 판에서 따는 순간은 물안개가 얼굴을 덮어 그림은 빼고, 소리만 이미 딴 캔을 드는 3번 컷 머리에(실제 녹음 Fairlight 「Soda Can Open Pour」 머리)
    #   (사람판 맹검 둘 「캔 따는 소리가 작고 건조 · 탄산 소리가 작다」 → −9에서 −6 dB)
    #   다섯 맛 판: 3번 컷 첫 장부터 캔이 입에 닿아 있어 Fable 「따는 그림 없이 마시는 입 위에 따는 소리」 → 2번 컷 끝(캔 보며 웃는 칸, 친구가 따 주는 것으로) 0.3초 앞으로
    can = seg(FAIR + "Soda Can Open Pour.M.wav", 0.95, 1.65)
    m.put(T[2] - 0.30, tame(to_peak(can, -6), 7), fade=0.003, fade_out=0.25)
    # 저녁 — 풀벌레가 건배 컷 앞 0.5초부터 매미와 겹쳐 들어온다
    crk = tame(to_rms(C.load_stereo(SND + "/곡_스테이블/풀벌레_a.wav"), -34), 8)
    m.put(T[DI] - 0.5, crk[:int((total - T[DI] + 0.5) * RATE)], fade=0.4, fade_out=0.9)   # 끝 1초는 바탕 · 곡 · 판 소리가 같이 잦아든다(3.5 Lite 「오미톡 뒤 칼같이 닫힘」)
    # 끝말 — Mr. K(1번 오미톡의 브랜드 목소리), 「톡.」이 건배 소리에 겹친다
    vo = C.load(END_VO)
    used = np.concatenate([vo[int(a * RATE):int(b * RATE)] for a, b in END_CUTS])
    vo = vo * (10 ** ((-19 - rms_db(used)) / 20))
    for (a, b), at, gdb in zip(END_CUTS, ends, (0.0, 0.0, -3.0)):
        m.put(at, tame(vo[int(a * RATE):int(b * RATE)], 8), db=gdb, fade=0.01, fade_out=0.05)
    # 곡 c — 저녁 컷 머리의 박부터 두 박에 걸쳐 차올라 맺는 박이 건배 「톡」에, 끝말 밑에서는 7 dB 아래
    path, hit, beat = MUSIC["c"]
    s = C.load_stereo(path)
    n_beats = max(4, int(np.ceil((CLINK - T[DI] + 0.05) / beat)))   # 저녁 컷 머리 앞 박부터 — 「알싸해」 끝 웃음에서 깔리기 시작해 저녁으로 넘어간다
    t_in = CLINK - n_beats * beat
    song_in = hit - n_beats * beat
    bed = s[int(song_in * RATE):][:int((total - t_in) * RATE)].copy()
    import scipy.signal as SG
    hi = SG.sosfiltfilt(SG.butter(2, 8000, "high", fs=RATE, output="sos"), bed, axis=0).astype(np.float32)
    bed = tame(to_rms(bed - hi * (1 - 10 ** (-4 / 20)), -28), 11)
    gb = np.ones(len(bed), np.float32)
    r = min(len(gb), int(2 * beat * RATE))
    gb[:r] = np.linspace(0, 1, r) ** 1.5
    v0 = int((ends[0] - 0.3 - t_in) * RATE)
    if 0 < v0 < len(gb):
        k = int(0.3 * RATE)
        gb[v0:v0 + k] *= np.linspace(1, 10 ** (-7 / 20), k)
        gb[v0 + k:] *= 10 ** (-7 / 20)
    # 건배 자리 0.25초는 곡을 5 dB 더 비켜 캔 소리가 들리게(곡의 맺는 박이 같은 자리)
    c0, c1, ramp = int((CLINK - 0.04 - t_in) * RATE), int((CLINK + 0.25 - t_in) * RATE), int(0.02 * RATE)
    hole = np.ones(len(gb), np.float32)
    hole[c0:c1] = 10 ** (-5 / 20)
    hole[c0 - ramp:c0] = np.linspace(1, 10 ** (-5 / 20), ramp)
    hole[c1:c1 + ramp * 5] = np.linspace(10 ** (-5 / 20), 1, ramp * 5)
    gb *= hole
    m.put(t_in, bed * gb[:, None], fade=0.0, fade_out=0.9)
    m.finish(os.path.join(OUT, "소리_사람판.wav"), boost_db=0)
    print(f"곡 c {t_in:.2f}초에 깔려 건배 「톡」 {CLINK:.2f}초에 맺음 · 끝말 {', '.join(f'{t:.2f}' for t in ends)}초")


def render():
    pic = os.path.join(OUT, "화면_사람판.mp4")
    wav = os.path.join(OUT, "소리_사람판.wav")
    tmp = os.path.join(OUT, "_소리붙임_사람판.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", pic, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "14", "-preset", "medium",
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "320k", "-shortest", tmp)
    old = os.path.join(OUT, NAME + ".mp4")
    keep = os.path.join(OUT, "_기각_치익톡2판")
    if os.path.exists(old) and not os.path.exists(os.path.join(keep, NAME + ".mp4")):   # 기각한 판은 지우지 않고 옆으로 옮겨 둔다
        os.makedirs(keep, exist_ok=True)
        for f in (NAME + ".mp4", NAME + "_폰.mp4", "_반초.jpg"):
            if os.path.exists(os.path.join(OUT, f)):
                shutil.move(os.path.join(OUT, f), os.path.join(keep, f))
    out = os.path.join(OUT, NAME + ".mp4")
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), tmp, out, "--목표", "-14", "--리미터", "0.78", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart", os.path.join(OUT, NAME + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=8x4:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for w in sys.argv[1:] or ["화면", "소리", "판"]:
        {"화면": picture, "소리": sound, "판": render}[w]()
