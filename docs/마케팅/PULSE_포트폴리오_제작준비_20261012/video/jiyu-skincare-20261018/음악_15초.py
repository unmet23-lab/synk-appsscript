# 지유 스킨케어 · 고른 곡 A1(「MALGEUM 아침 A 피아노」, 10-18 유호님 「A1로 가자」)에서 15초 광고 음악을 마디 단위로 잘라 붙인다.
#   python -X utf8 음악_15초.py   → Documents/synk-vendor/jiyu-skincare-20261018/음악/지유_음악_15초_A1.wav · .mp3 · _박딸깍.mp3
# 곡 재기(음악_마디격자.py · 음악_마디표.py, 원본 시각):
#   - 빠르기가 고르지 않다: 앞 120.4 → 끝 121.2 BPM. 곡 전체를 한 비율로 늘이면 앞쪽이 119.3 BPM이 되어 어긋나서,
#     조각마다 그 자리 마디 길이로 늘여 2.0초 마디에 맞춘다.
#   - 조성 B♭장조. 0~1.685초 못갖춘마디(피아노만) → 1~4마디 성긴 도입(가끔 베이스) → 5마디(9.653초) 밴드가 으뜸화음으로 들어옴
#     → 19~20마디 베이스가 빠지는 숨 → 21마디(41.492초) 후렴(밝아짐, 21 B♭ · 22 F) → … → 61마디 마지막 으뜸화음(121.020초, 끝에서 느려짐), 62마디에서 잦아듦.
# 광고 시간선(콘티 v2 2절, 마디 2초):
#    0.0   4마디(성긴 도입, 넷째 박에 베이스가 이어 줌)
#    2.0   5마디 밴드 들어옴(원곡 그대로 이어짐), 6·7마디, 8마디 셋째 박까지 → 9.5~10.0 완전히 빔
#   10.0   21마디 후렴, 22마디(F, 딸림화음) 넷째 박 반까지 → 13.75~14.0 숨(0.25초 빔)
#   14.0   61마디 마지막 으뜸화음(F → B♭로 끝남)을 바로 친다, 15.0초까지 울리다 끝 0.35초 페이드
# 이음매: 빔 앞은 15ms 페이드, 후렴·마지막 화음 머리는 4ms 앞당겨 5ms 페이드인으로 어택을 살린다.
# 10-18 Fable 검수: 원곡 마지막 화음은 어택이 약해(+6.8dB) 후렴에 25ms 교차로 이으면 14.0초 타격이 안 들렸다 → 앞에 0.25초 숨을 둔다.
import os
import subprocess
import sys

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "음악")
SRC = os.path.join(V, "MALGEUM_아침A_A1_064fe5fe.wav")
OUT = os.path.join(V, "지유_음악_15초_A1.wav")
PRE = 0.004  # 어택 앞 여유

# (원본 시작, 원본 끝, 광고에서 차지할 길이) — 원본 마디 첫 박은 마디격자.json
SEG_A = (7.661, 17.123, 9.5)       # 4마디 ~ 8마디 셋째 박 끝(7.661 + 4.75마디)
SEG_HOOK = (41.492, 45.468, 4.0)   # 21·22마디(마디 길이 재기용) — 실제로는 앞 3.75초만 쓴다
HOOK_USE = 3.75
LAST = 121.020                     # 61마디 마지막 으뜸화음 어택(끝에서 느려져 격자 120.800보다 0.22초 늦게 친다)
TAIL = 1.0                         # 14.0~15.0


def fit(label, length):
    # atempo는 조각 끝을 10ms 남짓 덜 늘인다 → 무음으로 채운 뒤 정확한 길이로 자른다(이음매 시각이 밀리지 않게).
    # 채우기 길이는 못 박는다: 끝없는 apad는 ffmpeg 9에서 때때로 멈춘다(현장 노트 영상_ffmpeg_자막.md)
    return f"apad=whole_dur={length:.6f},atrim=0:{length:.6f}[{label}]"


def build():
    a0, a1, aL = SEG_A
    ra = (a1 - a0) / aL
    h0, h1, hL = SEG_HOOK
    rh = (h1 - h0) / hL
    h_end = h0 + HOOK_USE * rh
    # 페이드는 늘이기(atempo) 전 원본 구간에 건다. 10-18 Fable 3차: 늘인 뒤 aL-15ms에 건 페이드는 atempo가 끝을 12ms쯤
    # 덜 만들어 거의 먹지 않았고, 9.489·13.739초가 한 표본 만에 0.39 → 0으로 끊겨 딸깍 날 수 있었다
    seg_a = a1 - a0
    seg_h = HOOK_USE * rh
    parts = [
        f"[0:a]atrim={a0:.6f}:{a1:.6f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d=0.03,afade=t=out:st={seg_a - 0.02:.6f}:d=0.02,atempo={ra:.6f}," + fit("pa", aL),
        "anullsrc=r=48000:cl=stereo,atrim=0:0.5[pz]",
        f"[0:a]atrim={h0 - PRE * rh:.6f}:{h_end - PRE * rh:.6f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d=0.003,afade=t=out:st={seg_h - 0.02:.6f}:d=0.02,atempo={rh:.6f}," + fit("ph", HOOK_USE),
        "anullsrc=r=48000:cl=stereo,atrim=0:0.25[pz2]",
        # 10-18 Fable 재검수: 원곡 마지막 화음은 후렴보다 6dB 작아(RMS -18.8 대 -12.4) 「타격」이 아니라 「내려앉음」으로 들렸다 → 2배(+6dB)
        f"[0:a]atrim={LAST - PRE:.6f}:{LAST - PRE + TAIL:.6f},asetpts=PTS-STARTPTS,volume=2.0,"
        f"afade=t=in:st=0:d=0.005,afade=t=out:st={TAIL - 0.35:.6f}:d=0.35," + fit("pt", TAIL),
        "[pa][pz][ph][pz2][pt]concat=n=5:v=0:a=1[out]",
    ]
    return ";".join(parts), ra, rh


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def main():
    graph, ra, rh = build()
    run(["-i", SRC, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s16le", OUT])
    run(["-i", OUT, "-c:a", "libmp3lame", "-b:a", "192k", OUT[:-4] + ".mp3"])
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT],
                               capture_output=True, text=True).stdout)
    # 확인용: 마디 첫 박(높은 딸깍)과 컷 경계(낮은 딸깍)
    downbeats = [float(i * 2) for i in range(8)]
    cuts = [0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0]
    clicks = [(t, 2000) for t in downbeats] + [(t + 0.06, 700) for t in cuts]
    inputs, mix = [], []
    for i, (t, f) in enumerate(clicks):
        inputs += ["-f", "lavfi", "-i", f"sine=f={f}:d=0.04"]
        mix.append(f"[{i + 1}:a]adelay={int(t * 1000)}|{int(t * 1000)},volume=0.5[c{i}]")
    g = ";".join(mix) + ";[0:a]" + "".join(f"[c{i}]" for i in range(len(clicks))) + f"amix=inputs={len(clicks) + 1}:normalize=0[m]"
    run(["-i", OUT, *inputs, "-filter_complex", g, "-map", "[m]", "-t", f"{dur:.3f}", "-c:a", "libmp3lame", "-b:a", "192k",
         OUT[:-4] + "_박딸깍.mp3"])
    print(f"{OUT} · {dur:.3f}초 · 늘임 비율 도입·들어옴 {ra:.5f}, 후렴 {rh:.5f}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
