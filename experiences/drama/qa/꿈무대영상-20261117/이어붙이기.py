"""
꿈 무대 영상 시험(2026-11-17) — 받은 컷 넷과 끝 화면을 한 편으로 잇는다.
컷마다 쓸 구간(시작 초 · 끝 초)을 주면 그 구간만 잘라 차례로 붙이고, 끝 카드 그림을 주면 맨 뒤에 그 그림을 몇 초 세운다.
모든 컷을 같은 길(24장/초, 1280×720, yuv420p)로 다시 짜서 컷 사이에 색이 달라지지 않게 한다(시댄스 판은 색 꼬리표가 없다 — 현장 노트 · 영상).
소리는 컷에 든 소리를 그대로 쓰고 컷 앞뒤 0.08초만 살짝 줄였다 늘린다. 끝 카드에는 --끝소리로 준 구간(말이 없는 바람 소리)을 깔고 끝 1.5초 동안 줄인다.
--끝소리가 없으면 끝 카드는 소리 없이 선다.

    python -I -X utf8 이어붙이기.py <밖.mp4> [--끝카드 <그림> <초>] [--끝소리 <컷.mp4>:<시작>:<끝>]
                                      [--끝글자 <투명 PNG>:<나타나는 초>]… [--끝밀기 <퍼센트>] [--끝녹임 <초>] <컷.mp4>:<시작>:<끝> …

끝 화면(후반 가이드 「엔드카드」를 따른다 — 11-17 유호님 「마지막 폰트가 너무 슬롭인데」 뒤에 더함):
- --끝글자: 조판해서 뽑은 투명 PNG 층(`끝글자.cjs`)을 끝 카드 위에 얹는다. 준 초(끝 카드가 시작한 때부터)에 0.4초 동안 12px 올라오며 나타난다.
  여러 번 주면 차례로 나타난다(제목 → 크레딧).
- --끝밀기: 끝 카드 그림을 그 길이 동안 천천히 이만큼 당긴다(3이면 3%). 멈춘 그림으로 서 있지 않게 한다.
- --끝녹임: 마지막 컷에서 끝 카드로 이 초만큼 겹쳐 넘어간다. 주지 않으면 앞 판처럼 검은 화면에서 0.5초 동안 밝아진다.
"""
import subprocess
import sys


def 꺼냄(a, 이름, 개수=1):
    """a에서 이름 뒤 값들을 모두 꺼내 목록으로 돌려준다(여러 번 준 것까지)."""
    out = []
    while 이름 in a:
        i = a.index(이름)
        out.append(a[i + 1] if 개수 == 1 else a[i + 1:i + 1 + 개수])
        del a[i:i + 1 + 개수]
    return out


def main():
    a = sys.argv[1:]
    밖 = a.pop(0)
    카드 = 꺼냄(a, "--끝카드", 2)
    카드, 카드초 = (카드[0][0], float(카드[0][1])) if 카드 else (None, 0.0)
    끝소리 = 꺼냄(a, "--끝소리")
    if 끝소리:
        p_, s_, e_ = 끝소리[0].rsplit(":", 2)
        끝소리 = (p_, float(s_), float(e_))
    글자 = [(x.rsplit(":", 1)[0], float(x.rsplit(":", 1)[1])) for x in 꺼냄(a, "--끝글자")]
    밀기 = 꺼냄(a, "--끝밀기")
    밀기 = float(밀기[0]) / 100 if 밀기 else 0.0
    녹임 = 꺼냄(a, "--끝녹임")
    녹임 = float(녹임[0]) if 녹임 else 0.0
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
    본편초 = sum(e - s for _, s, e in 컷)
    vs = "".join(f"[v{i}]" for i in range(n))
    as_ = "".join(f"[a{i}]" for i in range(n))
    if not 카드:
        f.append(f"{vs}concat=n={n}:v=1:a=0[v]")
        f.append(f"{as_}concat=n={n}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
    else:
        k = n
        장 = int(round(카드초 * 24))
        if 밀기:
            # 그림 한 장을 길이만큼의 장으로 늘리며 천천히 당긴다(큰 원본에서 줄여 뽑아 떨림을 줄인다)
            ins += ["-i", 카드]
            f.append(f"[{k}:v]scale=2560:1440:force_original_aspect_ratio=increase:flags=lanczos,crop=2560:1440,"
                     f"zoompan=z='1+{밀기}*on/{장}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={장}:s=1280x720:fps=24,setsar=1,format=yuv420p[c0]")
        else:
            ins += ["-loop", "1", "-t", str(카드초), "-i", 카드]
            f.append(f"[{k}:v]fps=24,scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720,setsar=1,format=yuv420p[c0]")
        k += 1
        앞 = "c0"
        for j, (png, t0) in enumerate(글자):
            ins += ["-loop", "1", "-t", str(카드초), "-i", png]
            f.append(f"[{k}:v]fps=24,scale=1280:720:flags=lanczos,format=rgba,fade=t=in:st={t0}:d=0.4:alpha=1[g{j}]")
            # 12px 아래에서 0.4초 동안 올라온다(빠르게 나와 천천히 멈춘다)
            y = f"if(lt(t,{t0}),12,if(lt(t,{t0 + 0.4}),12*pow(1-(t-{t0})/0.4,5),0))"
            f.append(f"[{앞}][g{j}]overlay=x=0:y='{y}':format=auto[c{j + 1}]")
            앞 = f"c{j + 1}"
            k += 1
        꼬리 = f"fade=t=out:st={카드초 - 0.4:.3f}:d=0.4"
        if 녹임:
            f.append(f"[{앞}]{꼬리},format=yuv420p,fps=24,settb=AVTB[vc]")
        else:
            f.append(f"[{앞}]fade=t=in:d=0.5,{꼬리},format=yuv420p[vc]")
        if 끝소리:
            ins += ["-i", 끝소리[0]]
            f.append(f"[{k}:a]atrim={끝소리[1]}:{끝소리[2]},asetpts=PTS-STARTPTS,aresample=48000,apad=whole_dur={카드초},atrim=0:{카드초},afade=t=in:d=0.08,afade=t=out:st={max(0.0, 카드초 - 1.5):.3f}:d=1.5[ac]")
        else:
            ins += ["-f", "lavfi", "-t", str(카드초), "-i", "anullsrc=r=48000:cl=stereo"]
            f.append(f"[{k}:a]anull[ac]")
        if 녹임:
            f.append(f"{vs}concat=n={n}:v=1:a=0,fps=24,settb=AVTB,format=yuv420p[vm]")
            f.append(f"{as_}concat=n={n}:v=0:a=1[am]")
            f.append(f"[vm][vc]xfade=transition=fade:duration={녹임}:offset={본편초 - 녹임:.3f}[v]")
            f.append(f"[am][ac]acrossfade=d={녹임}:c1=tri:c2=tri,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
        else:
            f.append(f"{vs}[vc]concat=n={n + 1}:v=1:a=0[v]")
            f.append(f"{as_}[ac]concat=n={n + 1}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *ins, "-filter_complex", ";".join(f), "-map", "[v]", "-map", "[a]",
           "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", 밖]
    r = subprocess.run(cmd)
    print("끝", r.returncode, 밖)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
