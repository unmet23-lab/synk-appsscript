# 시안_장면.json → ComfyUI 작업 목록(C:\SYNK-LoRA\tools\comfy_run.py 형식). 2026-10-21 1차 다섯 명 영상 게이트.
#   python -X utf8 시안_작업.py <작업.json> [코드…] [--장면 S1,S2] [--시드 11,12]
#   → <ComfyUI venv python> C:\SYNK-LoRA\tools\comfy_run.py <작업.json> <결과.json>
#   결과 그림: C:\SYNK-LoRA\tools\ComfyUI\output\pulse_gate\mock\<코드>_<장면>_s<시드>_00001_.png
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def prompt(m, scene, can):
    return f"{m['앞']}, {scene['text'].replace('{can}', can)}, {m['뒤']}"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    out = args.pop(0)
    only_scenes = only_seeds = None
    if "--장면" in args:
        i = args.index("--장면")
        only_scenes = set(args[i + 1].split(","))
        del args[i:i + 2]
    if "--시드" in args:
        i = args.index("--시드")
        only_seeds = [int(s) for s in args[i + 1].split(",")]
        del args[i:i + 2]
    spec = json.load(open(os.path.join(HERE, "시안_장면.json"), encoding="utf-8"))
    codes = args or list(spec["모델"])
    w, h = spec["크기"]
    jobs = []
    for code in codes:
        m = spec["모델"][code]
        for s in m["장면"]:
            if only_scenes and s["id"] not in only_scenes:
                continue
            for seed in only_seeds or spec["시드"]:
                jobs.append({"name": f"{code}_{s['id']}_s{seed}", "seed": seed, "lora": m["lora"], "lora_strength": 1.0,
                             "width": w, "height": h, "prompt": prompt(m, s, spec["캔"])})
    json.dump({"defaults": {"folder": "pulse_gate/mock", "width": w, "height": h}, "jobs": jobs},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(jobs)}개 → {out}")
