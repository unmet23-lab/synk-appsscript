# 이미지콘티.json을 컷별 작업(지시문 글 · 참조 그림 절대 경로)으로 푼다(2026-10-26, 블프 세일 지시문/풀기.py를 옮김).
#   python -X utf8 풀기.py            → git 밖 synk-vendor/pulse-portfolio12-20261024/콘티/p10/ego/jobs.json(ego 굽기 실행기가 읽는다)
#   python -X utf8 풀기.py --보기 S01  → 그 컷의 지시문과 참조만 찍는다
# 참조: 준호x4 = 명세서 참조 넷(C:/SYNK-LoRA/validation/M05_junho/refs), 배치:S01 = 배치도(콘티/p10/배치 — 원본 프레임은 넣지 않는다),
# R1~R6 = 고른 기준 그림(콘티/p10/참조/<이름>.png). 모두 긴 변 1,400px JPEG 사본을 올린다(현장 노트 gemini_사진 — 올리기가 빠르고 hard link 거절이 없다).
import json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p10")
REFS = os.path.join(B, "ego", "refs")
REF4 = [f"C:/SYNK-LoRA/validation/M05_junho/refs/{n}.jpg" for n in ("01_hero", "02_left90", "03_right90", "04_fullbody")]
MODELS = {"준호x4": REF4}
spec = json.load(open(os.path.join(HERE, "이미지콘티.json"), encoding="utf-8"))


def small(src, dst):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return dst
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.open(src).convert("RGB")
    im.thumbnail((1400, 1400))
    im.save(dst, quality=92)
    return dst


def refs_of(cut):
    out = []
    for r in cut["refs"]:
        if r.startswith("배치:"):
            src = os.path.join(B, "배치", r[3:] + ".png")
            dst = os.path.join(REFS, "배치_" + r[3:] + ".jpg")
        elif r in MODELS:
            for s in MODELS[r]:
                out.append(small(s, os.path.join(REFS, "준호_" + os.path.splitext(os.path.basename(s))[0] + ".jpg")) if os.path.exists(s) else f"(아직 없음) {s}")
            continue
        else:
            src = os.path.join(B, "참조", r + ".png")
            dst = os.path.join(REFS, r + ".jpg")
        out.append(small(src, dst) if os.path.exists(src) else f"(아직 없음) {src}")
    return out


def text_of(cut):
    t = cut["text"]
    for _ in range(3):
        def sub(m):
            k, n = m.group(1), m.group(2)
            if k not in spec["공통"]:
                raise SystemExit(f"{cut['id']}: 모르는 칸 {k}")
            v = spec["공통"][k]
            return v.replace("{n}", n) if n else v
        t = re.sub(r"\{([^}:\s]+)(?::(\d+))?\}", sub, t)
    return re.sub(r"\s+", " ", t).strip()


only = sys.argv[sys.argv.index("--보기") + 1] if "--보기" in sys.argv else None
jobs = {}
for cut in spec["컷"]:
    if only and cut["id"] != only:
        continue
    p = text_of(cut)
    if len(p) > 4300:
        raise SystemExit(f"{cut['id']}: 지시문 {len(p)}자 — 4,300자 안으로(현장 노트)")
    if re.search(r"video", p, re.I):
        raise SystemExit(f"{cut['id']}: 지시문에 video — Gemini가 영상을 만들기 시작한다(현장 노트 10-23)")
    jobs[cut["id"]] = {"id": cut["id"], "who": cut["who"], "ratio": cut.get("ratio", "16:9"), "prompt": p, "refs": refs_of(cut)}
if only:
    print(json.dumps(jobs[only], ensure_ascii=False, indent=1))
else:
    out = os.path.join(B, "ego", "jobs.json")
    old = json.load(open(out, encoding="utf-8")) if os.path.exists(out) else {}
    old.update(jobs)
    json.dump(old, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for j in jobs.values():
        print(j["id"], len(j["prompt"]), "자", "참조", len(j["refs"]), "— 참조 기다림" if any(r.startswith("(") for r in j["refs"]) else "")
    print("→", out)
