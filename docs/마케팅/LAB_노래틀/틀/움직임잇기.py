# 몽글이 움직이는 판 잇기(2026-11-14 유호님 「나로 가자」 · 「노래만으로」) — Flow 옴니 클립 몇 개를 이어 편의 public/move.mp4로 두고
# song.json 무대(stage)를 그 영상으로 바꾼다. 틀 src/Song.tsx가 stage.video를 그림 위에 같은 자리 · 같은 카메라로 얹는다.
#
#   python -X utf8 docs/마케팅/LAB_노래틀/틀/움직임잇기.py <편 폴더> <클립.json> [--캠 <가로,세로,줌> <가로,세로,줌>]
#     클립.json = [{"f": "<클립.mp4>", "ss": 0, "to": null}, …] — 차례로 잇고(앞을 ss초 · 뒤를 to초에서 자름), 노래 끝까지 마지막 장으로 채운다.
#     속도는 바꾸지 않는다(색 · 얼굴 · 떨림 · 속도는 손보지 않고 길이가 안 맞으면 그 길이로 다시 굽는다 — 노래 틀 README 「몽글 움직임」).
#     --캠: 16:9 영상용 카메라 시작 · 끝(가로 · 세로 = 화면에 둘 영상 속 자리 0~1, 줌). 없으면 song.json 것을 그대로 둔다.
#   → <편>/remotion/public/move.mp4(git 밖 — mp4는 저장소에 넣지 않는다, remotion/.gitignore에 더함) · move_first.jpg(그 첫 장, git 안)
#     song.json stage: video · videoAt 0 · aspect 16/9 · img move_first.jpg · _출처.움직임(클립 목록 — 다시 만들 때 쓴다. 경로는 「~/…」 꼴 — 이식경로.py)
#   게시 · 돌림은 공용 작업본에서 판본 자산 지문을 다시 세니, 워크트리에서 만들었으면 move.mp4를 공용 작업본 같은 자리에도 둔다(판본 영상과 함께).
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import 이식경로 as ep  # noqa: E402 — 클립 경로는 「~/…」 · 「synk-vendor/…」 꼴로 적고 읽는다(11-15, 공개 저장소)

ap = argparse.ArgumentParser()
ap.add_argument("편")
ap.add_argument("클립")
ap.add_argument("--캠", nargs=2, metavar=("시작", "끝"))
a = ap.parse_args()

pub = Path(a.편) / "remotion" / "public"
songf = pub / "song.json"
doc = json.loads(songf.read_text(encoding="utf-8"))
segs = json.loads(Path(a.클립).read_text(encoding="utf-8"))
segs = [{**s, "f": ep.풀기(s["f"])} for s in segs]  # song.json _출처.움직임을 그대로 넘겨도 된다
dur = float(doc["duration"])

ins, fc = [], []
for i, s in enumerate(segs):
    if not Path(s["f"]).exists():
        raise SystemExit(f"클립 없음: {s['f']}")
    ins += ["-i", s["f"]]
    tr = f"trim=start={s.get('ss', 0)}" + (f":end={s['to']}" if s.get("to") is not None else "")
    fc.append(f"[{i}:v]{tr},setpts=PTS-STARTPTS,fps=24[v{i}]")
fc.append("".join(f"[v{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[c]")
fc.append(f"[c]tpad=stop_duration={dur + 1}:stop_mode=clone,trim=end={dur + 0.5}[o]")
move = pub / "move.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(fc), "-map", "[o]", "-an",
                "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", str(move)], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(move), "-vf", "select=eq(n\\,0)", "-frames:v", "1", "-q:v", "2",
                str(pub / "move_first.jpg")], check=True)

# 이은 길이 — 클립이 노래보다 많이 짧으면 끝에서 그림이 선다(마지막 장으로 채움)
got = 0.0
for s in segs:
    full = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", s["f"]],
                                capture_output=True, text=True, check=True).stdout.strip())
    got += (s["to"] if s.get("to") is not None else full) - s.get("ss", 0)
held = dur - got

st = dict(doc["stage"])
st.update({"video": "move.mp4", "videoAt": 0, "aspect": round(16 / 9, 6), "img": "move_first.jpg"})
if a.캠:
    cam = dict(st.get("cam", {}))
    cam["from"], cam["to"] = [[float(v) for v in c.split(",")] for c in a.캠]
    st["cam"] = cam
doc["stage"] = st
doc.setdefault("_출처", {})["움직임"] = [{**s, "f": ep.줄이기(s["f"])} for s in segs]
songf.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")

gi = Path(a.편) / "remotion" / ".gitignore"
lines = gi.read_text(encoding="utf-8").splitlines() if gi.exists() else []
if "public/move.mp4" not in lines:
    gi.write_text("\n".join(lines + ["public/move.mp4"]) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"영상": str(move), "노래": dur, "클립합": round(got, 3), "끝에서멈춤": round(max(0, held), 3)}, ensure_ascii=False))
if held > 0.6:
    print(f"확인할 것: 노래 끝 {held:.2f}초 동안 마지막 장이 멈춰 있다 — 클립을 그 길이로 다시 굽는다")
