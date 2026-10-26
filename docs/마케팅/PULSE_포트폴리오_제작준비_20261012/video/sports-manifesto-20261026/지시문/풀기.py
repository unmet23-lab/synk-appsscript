# 이미지콘티.json을 컷별 작업(지시문 글 · 참조 그림 절대 경로)으로 푼다(2026-10-26, 8번 지시문/풀기.mjs와 같은 일을 파이썬으로).
#   python -X utf8 지시문/풀기.py            → synk-vendor/pulse-portfolio12-20261024/콘티/p5/ego/jobs.json (ego 실행기 gen.mjs가 읽는다)
#   python -X utf8 지시문/풀기.py --보기 S06  → 그 컷의 지시문과 참조만 찍는다
# 참조: 한결x4 · 채원x4 = 명세서 참조 4장(C:/SYNK-LoRA/validation/<코드>/refs), 한결몸 · 채원몸 = 전신 한 장, 배치:S06 = 배치도(git 밖 콘티/p5/배치),
# R1 · R2 · R3 = 고른 기준 그림(콘티/p5/정지컷/<이름>.png — 아직 없으면 「(R1 없음)」으로 남겨 실행기가 굽지 않는다). 모두 긴 변 1,400px JPEG 사본을 올린다.
import json, sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
P5 = Path.home() / "Documents" / "synk-vendor" / "pulse-portfolio12-20261024" / "콘티" / "p5"
REFS = P5 / "ego" / "refs"
spec = json.loads((HERE / "이미지콘티.json").read_text(encoding="utf-8"))
MODELS = {
    "한결x4": [f"C:/SYNK-LoRA/validation/M06_hangyeol/refs/{n}.jpg" for n in ("01_hero", "02_left90", "03_right90", "04_fullbody")],
    "채원x4": [f"C:/SYNK-LoRA/validation/F07_chaewon/refs/{n}.jpg" for n in ("01_hero", "02_left90", "03_right90", "04_fullbody")],
    "한결몸": ["C:/SYNK-LoRA/validation/M06_hangyeol/refs/04_fullbody.jpg"],
    "채원몸": ["C:/SYNK-LoRA/validation/F07_chaewon/refs/04_fullbody.jpg"],
}


def small(src: Path, tag: str) -> str:
    dst = REFS / f"{tag}.jpg"
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        REFS.mkdir(parents=True, exist_ok=True)
        im = Image.open(src).convert("RGB")
        im.thumbnail((1400, 1400))
        im.save(dst, quality=92)
    return str(dst).replace("\\", "/")


def refs_of(names):
    out = []
    for r in names:
        if r in MODELS:
            out += [small(Path(p), f"{r}_{k}") for k, p in enumerate(MODELS[r])]
        elif r.startswith("배치:"):
            out.append(small(P5 / "배치" / f"{r[3:]}.png", f"배치_{r[3:]}"))
        else:
            p = P5 / "정지컷" / f"{r}.png"
            out.append(small(p, f"기준_{r}") if p.exists() else f"({r} 없음)")
    return out


def prompt_of(c):
    parts = [spec["공통"][k] for k in c.get("글", [])] + [c["더"]]
    if c.get("끝"):   # true = 사람 컷 끝 문장, 이름(끝_사물) = 그 공통 문장
        parts.append(spec["공통"][c["끝"] if isinstance(c["끝"], str) else "끝"])
    return " ".join(parts)


jobs = {cid: {"id": cid, "who": c["who"], "ratio": "16:9", "prompt": prompt_of(c), "refs": refs_of(c["refs"])} for cid, c in spec["컷"].items()}
if "--보기" in sys.argv:
    j = jobs[sys.argv[sys.argv.index("--보기") + 1]]
    print(j["prompt"]); print(len(j["prompt"]), "자"); print("\n".join(j["refs"]))
else:
    (P5 / "ego").mkdir(parents=True, exist_ok=True)
    (P5 / "ego" / "jobs.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(jobs), "작업 →", P5 / "ego" / "jobs.json", "· 가장 긴 지시문", max(len(j["prompt"]) for j in jobs.values()), "자")
