# 10번 이미지 콘티 — 얼굴 없는 컷을 GPT 이미지 2.5로 굽는다(2026-10-26). 블프 세일 2차처럼 얼굴이 없는 컷은 GPT, 준호 얼굴 컷은 Gemini(공용 차례).
# 지시문 · 참조는 지시문/풀기.py가 만든 git 밖 콘티/p10/ego/jobs.json을 그대로 쓰고, 굽기는 굽기_gpt.cjs(codex계정.js 계정 돌려 쓰기)에 맡긴다.
#   python -X utf8 이미지콘티_gpt굽기.py S02 S03 …     → 콘티/p10/받음_gpt/판/S02_<시각>.png …
#   python -X utf8 이미지콘티_gpt굽기.py 얼굴없음        → jobs.json에서 who가 「준호」가 아닌 컷 모두(이미 구운 컷은 건너뜀)
import json, os, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
B = Path(os.environ["USERPROFILE"]) / "Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10"
jobs = json.load(open(B / "ego/jobs.json", encoding="utf-8"))
done = {p.name.split("_")[0] for p in (B / "받음_gpt/판").glob("S*_*.png")} if (B / "받음_gpt/판").exists() else set()
ids = sys.argv[1:]
if ids == ["얼굴없음"]:
    ids = [k for k, j in sorted(jobs.items()) if j["who"] != "준호" and k not in done]
for k in ids:
    j = jobs[k]
    if any(r.startswith("(") for r in j["refs"]):
        print(k, "참조가 아직 없다 — 건너뜀", j["refs"])
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as fh:
        fh.write(j["prompt"] + "\n")
        pf = fh.name
    r = subprocess.run(["node", str(HERE / "굽기_gpt.cjs"), "받음_gpt", pf, k, *j["refs"]], cwd=REPO, capture_output=True, text=True, encoding="utf-8")
    os.unlink(pf)
    print((r.stdout.strip().splitlines() or [""])[-1] or (r.stderr.strip().splitlines() or ["?"])[-1], flush=True)
    if r.returncode == 3:
        print("쓸 수 있는 굽기 계정이 없다 — 멈춤")
        break
