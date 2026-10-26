# 2번 이미지 콘티 — 지시문/이미지콘티_Gemini.json을 Gemini 실행기(git 밖 콘티/p2/ego/gen.mjs)가 읽는 jobs.json으로 푼다.
# 참조는 태준 캐스팅북 사진 넷 + 배치도 하나 — 모두 긴 변 1,400px JPEG 사본(올리기가 빠르고 받는 크기로 충분, 8번 풀기.mjs와 같음).
#   python -I -X utf8 이미지콘티_풀기.py [--보기 P05]
import json
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
P2 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p2")
REFS = os.path.join(P2, "ego", "refs")
TAEJUN = [f"C:/SYNK-LoRA/validation/M02_taejun/refs/{n}.jpg" for n in ("01_hero", "02_left90", "03_right45", "04_fullbody")]
spec = json.load(open(os.path.join(HERE, "지시문", "이미지콘티_Gemini.json"), encoding="utf-8"))


def small(src, dst):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return dst
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.open(src).convert("RGB")
    im.thumbnail((1400, 1400))
    im.save(dst, quality=92)
    return dst


def text_of(t):
    for _ in range(3):
        t = re.sub(r"\{([^}\s]+)\}", lambda m: spec["공통"][m.group(1)], t)
    return t


jobs = {}
for cid, c in spec["컷"].items():
    refs = [small(p, os.path.join(REFS, "태준_" + os.path.basename(p))) for p in TAEJUN]
    refs.append(small(os.path.join(P2, "배치", c["배치"] + ".png"), os.path.join(REFS, "배치_" + c["배치"] + ".jpg")))
    jobs[cid] = {"id": cid, "who": "태준", "ratio": c.get("ratio", "16:9"), "prompt": text_of(c["text"]), "refs": refs}
    if len(jobs[cid]["prompt"]) > 4300:
        raise SystemExit(f"{cid} 지시문이 4,300자를 넘는다({len(jobs[cid]['prompt'])}) — 현장노트 gemini_사진")
if "--보기" in sys.argv:
    j = jobs[sys.argv[sys.argv.index("--보기") + 1]]
    print(j["prompt"], "\n", j["refs"])
else:
    os.makedirs(os.path.join(P2, "ego"), exist_ok=True)
    json.dump(jobs, open(os.path.join(P2, "ego", "jobs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print({k: len(v["prompt"]) for k, v in jobs.items()})
