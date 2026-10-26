# 2번 남성 향수 · 이미지 콘티 — 얼굴 없는 물 · 잎 · 안개 컷을 GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 굽는다. 비용 0(구독 몫).
# 지시문 지시문/이미지콘티_GPT.json · 굽기 계정은 tools/codex계정.js가 돌린다(혜택포스터/굽기.py와 같은 호출).
#   python -I -X utf8 이미지콘티_GPT.py [컷 …] [--판=2] [--동시=2]   → git 밖 콘티/p2/받음/<컷>_g<판>.png (있으면 건너뜀)
import json
import os
import re
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, *([".."] * 5)))
밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p2")
ROTATE = os.path.join(REPO, "tools", "codex계정.js")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = {a.split("=")[0]: (a.split("=") + [""])[1] for a in sys.argv[1:] if a.startswith("--")}
판 = opt.get("--판", "1")
동시 = int(opt.get("--동시", "2") or 2)
spec = json.load(open(os.path.join(HERE, "지시문", "이미지콘티_GPT.json"), encoding="utf-8"))
HEAD = ("Use your built-in image generation tool to create exactly ONE image. Do not run any shell commands and do not "
        "create or edit any files yourself. After the image is generated, reply with only the absolute path of the saved image file.\n\n")
os.makedirs(os.path.join(밖, "받음"), exist_ok=True)
os.makedirs(os.path.join(밖, "gpt_log"), exist_ok=True)


def bake(cut):
    j = spec["컷"][cut]
    out = os.path.join(밖, "받음", f"{cut}_g{판}.png")
    if os.path.exists(out):
        return f"있음 {cut}"
    refs = [os.path.join(밖, r) for r in j["참고"]]
    text = HEAD + (spec["공통_사람"] if j.get("사람") else spec["공통"]) + "\n\n" + j["지시"]   # 얼굴 없는 사람 컷(01 · 04)은 사람 금지가 없는 공통
    if any("흐림" in r for r in j["참고"]):
        text += "\n\n" + spec["배치_문단"]
    last = os.path.join(밖, "gpt_log", f"{cut}_g{판}.last.txt")
    cmd = ["node", ROTATE, "exec", "--skip-git-repo-check", "-C", 밖, "-s", "read-only"]
    for r in refs:
        cmd += ["-i", r]
    cmd += ["-o", last, "-"]
    t0 = time.time()
    p = subprocess.run(cmd, input=text.encode("utf-8"), capture_output=True)
    log = p.stdout.decode("utf-8", "replace") + "\n---stderr---\n" + p.stderr.decode("utf-8", "replace")
    open(os.path.join(밖, "gpt_log", f"{cut}_g{판}.txt"), "w", encoding="utf-8").write(text + "\n\n===\n" + log)
    answer = open(last, encoding="utf-8").read() if os.path.exists(last) else ""
    found = re.findall(r"[A-Za-z]:[\\/][^\s\"'`]+?\.png", answer + "\n" + log)
    src = next((x for x in reversed(found) if os.path.exists(x) and "generated_images" in x), None)
    if not src:
        return f"실패 {cut} 종료 {p.returncode} {answer[-200:]} {log[-300:]}"
    shutil.copyfile(src, out)
    return f"완료 {cut} {time.time() - t0:.0f}초 {out}"


if __name__ == "__main__":
    cuts = args or list(spec["컷"].keys())
    with ThreadPoolExecutor(동시) as ex:
        for line in ex.map(bake, cuts):
            print(line, flush=True)
