# 7번 「사랑 한 칸」 영상 가편집(2026-11-18) — 받은 시댄스 판을 잘라 차례대로 잇는다. 음악 · 자막 · 효과음 없이 판 소리 그대로.
#   유호님 11-17 「1분만 먼저 테스트해보고싶어」 → 11-18 「30초정도만 구워봐」 — 앞 30초(1-1 ~ 1-25)를 먼저 이어 보인다.
#   python -X utf8 영상가편집.py [--편집표 가편집표_1화.json] [--끝 1-25] [--받음 <폴더>] [--띠]
#     → git 밖 synk-vendor/…/콘티/p7/영상가편집/사랑한칸_<처음>-<끝>_가편집.mp4 (1080×1920 · 24fps)
#     --띠: 위에 컷 이름 · 판 · 쓰는 구간을 작게 얹은 검수용 판을 따로 만든다(_띠.mp4).
#   편집표가 없으면 컷표의 쓰는 구간(in · out)을 그대로 쓴다. 그런데 받은 판은 말이 컷표 길이보다 길고 늦게 나와서(11-18 받아쓰기),
#   편집표에서 컷마다 그림 구간과 소리 구간을 따로 정한다 — 그림은 차례대로 잇고, 소리는 그 판의 시간 그대로 겹쳐 깐다.
#     그림: {"컷", "판", "in", "out", "소리"?}
#       소리가 없으면 그 그림 구간의 판 소리(입이 맞는다).
#       소리: {"in", "out", "밀기"} — 같은 판의 [in, out] 소리를 그 그림과 같은 시간축에 놓고 「밀기」초만큼 옮긴다.
#         out이 그림보다 길면 다음 컷 위로 말이 이어지고(L컷), in이 그림보다 이르면 앞 컷 끝에서 말이 먼저 들린다(J컷).
#         입이 보이는 말은 밀기 0으로 둔다(입이 맞는다). 입이 안 보이는 말만 밀어 겹침을 푼다.
#       소리: "없음" — 이 컷에는 소리를 두지 않는다(앞 컷의 말이 이어 덮을 때 · 한 판을 둘로 자른 둘째 샷).
#   받은 판이 없는 컷은 회색 화면에 컷 이름을 넣어 길이만 채운다(빠진 곳이 보이게).
import json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
VEN = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p7"
args = sys.argv[1:]
값 = lambda k, d=None: args[args.index(k) + 1] if k in args else d
받음 = 값("--받음", f"{VEN}/영상받음")
편집표 = 값("--편집표")
끝컷 = 값("--끝")
띠 = "--띠" in args
W, H, FPS = 1080, 1920, 24
번 = lambda c: (int(c.split("-")[0]), int(c.split("-")[1]))

if 편집표:
    그림 = json.load(open(os.path.join(HERE, 편집표) if not os.path.isabs(편집표) else 편집표, encoding="utf-8"))["그림"]
else:
    표 = json.load(open(os.path.join(HERE, "컷표.json"), encoding="utf-8"))
    그림 = [{"컷": d["cut"], "판": d.get("판") or d["cut"], "in": float(d["in"]), "out": float(d["out"])}
          for d in 표["detail"] if d["cut"].startswith((끝컷 or "1-25").split("-")[0] + "-")]
if 끝컷:
    그림 = [g for g in 그림 if 번(g["컷"]) <= 번(끝컷)]


def 받은파일(판):
    후보 = [f for f in os.listdir(받음) if re.fullmatch(re.escape(판) + r"(__\d+)?\.mp4", f)]
    if not 후보:
        return None
    후보.sort(key=lambda f: int(re.search(r"__(\d+)", f).group(1)) if "__" in f else 1)
    return os.path.join(받음, 후보[-1])


out_dir = f"{VEN}/영상가편집"
os.makedirs(out_dir, exist_ok=True)
tmp = tempfile.mkdtemp(prefix="가편집_")
FONT = "C\\:/Windows/Fonts/malgunbd.ttf"
조각, 소리, 빠짐 = [], [], []
T = 0.0   # 지금 컷이 시작하는 시각(장 수로 맞춘 초)
for g in 그림:
    c, 판 = g["컷"], g["판"]
    a, b = float(g["in"]), float(g["out"])
    n = max(1, round((b - a) * FPS))
    dst = os.path.join(tmp, f"{len(조각):03d}.mp4")
    src = 받은파일(판)
    # 판 끝(4.04초)까지 쓰는 구간은 장이 한둘 모자라 뒤 컷의 입이 그만큼 어긋난다 — 끝 장을 늘여 장 수를 늘 n으로 맞춘다
    vf = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,tpad=stop_mode=clone:stop_duration=1"
    if 띠:
        vf += f",drawtext=fontfile='{FONT}':text='{c}  판 {판} {a:.2f}-{b:.2f}':x=24:y=24:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.45:boxborderw=8"
    if src:
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-i", src, "-vf", vf, "-frames:v", str(n), "-an",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", dst]
        s = g.get("소리")
        if s != "없음":
            s = s or {}
            sa, sb, 밀기 = float(s.get("in", a)), float(s.get("out", b)), float(s.get("밀기", 0))
            at = T + (sa - a) + 밀기
            if at < 0:
                sa, at = sa - at, 0.0
            소리.append((src, sa, sb, at))
    else:
        빠짐.append(c)
        txt = f"drawtext=fontfile='{FONT}':text='{c} 아직 없음':x=(w-tw)/2:y=(h-th)/2:fontsize=64:fontcolor=gray"
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x222226:s={W}x{H}:r={FPS}", "-vf", txt,
               "-frames:v", str(n), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", dst]
    subprocess.run(cmd, check=True)
    g["_T"] = round(T, 3)
    조각.append(dst)
    T += n / FPS

lst = os.path.join(tmp, "목록.txt")
open(lst, "w", encoding="utf-8").write("".join(f"file '{p}'\n" for p in 조각))
그림만 = os.path.join(tmp, "그림.mp4")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", 그림만], check=True)

# 소리: 조각마다 그 판의 시간대로 놓고 겹쳐 섞는다(정규화 없이 — 판 소리 크기 그대로)
cmd = ["ffmpeg", "-y", "-v", "error", "-i", 그림만]
fl = []
for k, (src, sa, sb, at) in enumerate(소리, 1):
    cmd += ["-ss", f"{sa:.3f}", "-t", f"{sb - sa:.3f}", "-i", src]
    ms = int(round(at * 1000))
    fl.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.02,afade=t=out:st={max(0, sb - sa - 0.03):.3f}:d=0.03,adelay={ms}|{ms}[a{k}]")
fl.append("".join(f"[a{k}]" for k in range(1, len(소리) + 1)) + f"amix=inputs={len(소리)}:normalize=0:dropout_transition=0,apad,atrim=0:{T:.3f}[mix]")
이름 = f"사랑한칸_{그림[0]['컷']}-{그림[-1]['컷']}_가편집{'' if 편집표 else '_컷표구간'}{'_띠' if 띠 else ''}.mp4"   # 편집표 없이 만든 판은 이름을 나눠 덮어쓰지 않는다
out = os.path.join(out_dir, 이름)
cmd += ["-filter_complex", ";".join(fl), "-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
print("만듦", out, f"{float(dur):.2f}초", f"컷 {len(조각)}", ("빠짐 " + " ".join(빠짐)) if 빠짐 else "빠짐 없음")
print("컷 시작:", " ".join(f"{g['컷']}@{g['_T']:.2f}" for g in 그림))
