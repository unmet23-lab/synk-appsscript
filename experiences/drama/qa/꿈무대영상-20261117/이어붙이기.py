"""
꿈 무대 영상 시험(2026-11-17) — 받은 컷 넷과 끝 카드를 한 편으로 잇는다.
컷마다 쓸 구간(시작 초 · 끝 초)을 주면 그 구간만 잘라 차례로 붙이고, 끝 카드 그림을 주면 맨 뒤에 그 그림을 몇 초 세운다.
모든 컷을 같은 길(24장/초, 1280×720, yuv420p)로 다시 짜서 컷 사이에 색이 달라지지 않게 한다(시댄스 판은 색 꼬리표가 없다 — 현장 노트 · 영상).
소리는 컷에 든 소리를 그대로 쓰고 컷 앞뒤 0.08초만 살짝 줄였다 늘린다. 끝 카드에는 --끝소리로 준 구간(말이 없는 바람 소리)을 깔고 끝 1.5초 동안 줄인다.
--끝소리가 없으면 끝 카드는 소리 없이 선다.

    python -I -X utf8 이어붙이기.py <밖.mp4> [--끝카드 <그림> <초>] [--끝소리 <컷.mp4>:<시작>:<끝>] <컷.mp4>:<시작>:<끝> …
"""
import subprocess
import sys


def main():
    a = sys.argv[1:]
    밖 = a.pop(0)
    카드, 카드초 = None, 0.0
    if a and a[0] == "--끝카드":
        카드, 카드초 = a[1], float(a[2])
        a = a[3:]
    끝소리 = None
    if a and a[0] == "--끝소리":
        p_, s_, e_ = a[1].rsplit(":", 2)
        끝소리 = (p_, float(s_), float(e_))
        a = a[2:]
    컷 = []
    for x in a:
        p, s, e = x.rsplit(":", 2)
        컷.append((p, float(s), float(e)))
    ins, f = [], []
    for i, (p, s, e) in enumerate(컷):
        ins += ["-i", p]
        d = e - s
        f.append(f"[{i}:v]trim={s}:{e},setpts=PTS-STARTPTS,fps=24,scale=1280:720:flags=lanczos,setsar=1,format=yuv420p[v{i}]")
        f.append(f"[{i}:a]atrim={s}:{e},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.08,afade=t=out:st={max(0.0, d - 0.08):.3f}:d=0.08[a{i}]")
    n = len(컷)
    vs = "".join(f"[v{i}]" for i in range(n))
    as_ = "".join(f"[a{i}]" for i in range(n))
    if 카드:
        ins += ["-loop", "1", "-t", str(카드초), "-i", 카드]
        if 끝소리:
            ins += ["-i", 끝소리[0]]
        else:
            ins += ["-f", "lavfi", "-t", str(카드초), "-i", "anullsrc=r=48000:cl=stereo"]
        f.append(f"[{n}:v]fps=24,scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720,setsar=1,format=yuv420p,fade=t=in:d=0.5,fade=t=out:st={카드초 - 0.5:.3f}:d=0.5[vc]")
        if 끝소리:
            f.append(f"[{n + 1}:a]atrim={끝소리[1]}:{끝소리[2]},asetpts=PTS-STARTPTS,aresample=48000,apad=whole_dur={카드초},atrim=0:{카드초},afade=t=in:d=0.08,afade=t=out:st={max(0.0, 카드초 - 1.5):.3f}:d=1.5[ac]")
        else:
            f.append(f"[{n + 1}:a]anull[ac]")
        vs += "[vc]"
        as_ += "[ac]"
        n += 1
    f.append(f"{vs}concat=n={n}:v=1:a=0[v]")
    f.append(f"{as_}concat=n={n}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *ins, "-filter_complex", ";".join(f), "-map", "[v]", "-map", "[a]",
           "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", 밖]
    r = subprocess.run(cmd)
    print("끝", r.returncode, 밖)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
