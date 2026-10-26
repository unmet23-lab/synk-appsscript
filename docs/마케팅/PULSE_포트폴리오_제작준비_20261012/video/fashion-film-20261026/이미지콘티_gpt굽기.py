# 4번 이미지 콘티 — 얼굴이 안 나오는 컷을 GPT 이미지 2.5로 굽는다(2026-10-27). 10번 · 블프 세일처럼 얼굴 없는 컷은 GPT, 유나 얼굴 컷은 Gemini(공용 차례).
# Gemini 차례가 길어(10-27 00:30 줄 열째) 옷 펼침(O4) · 옷감 · 소품 · 장소 열넷을 따로 굽는다. 지시문 · 참조는 이미지콘티_지시문.py가 만든
# git 밖 콘티/p4/ego/jobs_p4.json을 그대로 쓰고, 굽기는 굽기_gpt.cjs(codex계정.js 계정 돌려 쓰기 — 구독 안, 돈 안 나감)에 맡긴다.
#   python -X utf8 이미지콘티_gpt굽기.py O4            → 콘티/p4/받음_gpt/판/O4_<시각>.png
#   python -X utf8 이미지콘티_gpt굽기.py 얼굴없음       → GPT 몫 가운데 아직 안 받은 것 모두(참조가 없으면 건너뜀 — 컷은 받음/O4.png 뒤)
# 구운 판은 받음/<번호>_gpt<시각>.png로 옮기고 ego/_받기기록.jsonl에 적어, Gemini 줄 스크립트가 같은 컷을 또 굽지 않게 한다.
import json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
V = Path(os.environ["USERPROFILE"]) / "Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p4"
GPT = ["O4", "C02", "C03", "C04", "C05", "C06", "C07", "C09", "C16", "C18", "C19", "C27", "C29", "CEND", "C26", "C28"]   # 26 · 28은 얼굴이 안 보이는 사람 컷
jobs = json.load(open(V / "ego/jobs_p4.json", encoding="utf-8"))
log = V / "ego/_받기기록.jsonl"
done = {json.loads(l)["id"] for l in log.read_text(encoding="utf-8").splitlines() if l.strip()} if log.exists() else set()
ids = sys.argv[1:]
if ids == ["얼굴없음"]:
    ids = [k for k in GPT if k not in done]
for k in ids:
    j = jobs[k]
    miss = [r for r in j["refs"] if not Path(r).exists()]
    if miss:
        print(k, "참조가 아직 없다 — 건너뜀", [Path(m).name for m in miss], flush=True)
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as fh:
        fh.write(j["prompt"] + "\n")
        pf = fh.name
    r = subprocess.run(["node", str(HERE / "굽기_gpt.cjs"), "받음_gpt", pf, k, *j["refs"]], cwd=REPO, capture_output=True, text=True, encoding="utf-8")
    os.unlink(pf)
    line = (r.stdout.strip().splitlines() or [""])[-1] or (r.stderr.strip().splitlines() or ["?"])[-1]
    print(line, flush=True)
    if r.returncode == 3:
        print("쓸 수 있는 굽기 계정이 없다 — 멈춤")
        break
    m = re.search(r"→ (\S+\.(?:png|jpe?g|webp))", line)
    if r.returncode == 0 and m:
        src = REPO / m.group(1)
        dst = V / "받음" / f"{k}_gpt{time.strftime('%H%M%S')}{src.suffix}"
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        with open(log, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"id": k, "engine": "gpt-image-2.5", "file": str(dst), "at": time.strftime("%Y-%m-%dT%H:%M:%S")}, ensure_ascii=False) + "\n")
