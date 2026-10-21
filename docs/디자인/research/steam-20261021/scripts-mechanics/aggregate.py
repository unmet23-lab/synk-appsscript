# -*- coding: utf-8 -*-
"""stats.json의 낱말 묶음을 게임 전체로 합쳐, 묶음을 언급한 리뷰의 추천률이 표본 전체 추천률보다 얼마나 낮거나 높은지 본다.
사용: python -I -X utf8 aggregate.py <out_dir> [lens_filter]
- 게임마다 표본 추천률이 다르므로, 기대 추천 수(= 언급 수 × 그 게임의 표본 추천률)와 실제 추천 수를 비교한다.
"""
import json, sys, pathlib

def main():
    out = pathlib.Path(sys.argv[1])
    lens = set(int(x) for x in sys.argv[2].split(",")) if len(sys.argv) > 2 and sys.argv[2] else None
    S = json.loads((out / "stats.json").read_text(encoding="utf-8"))
    for lang in ("english", "koreana"):
        agg = {}
        games = 0; total = 0
        for s in S:
            if lens and not (set(s["lens"]) & lens): continue
            g = s.get(f"groups_{lang}"); smp = s.get(f"sample_{lang}", {})
            if not g or smp.get("n", 0) < 50: continue
            games += 1; total += smp["n"]
            base = smp["pos_rate"]
            for k, v in g.items():
                a = agg.setdefault(k, {"n": 0, "pos": 0, "exp": 0.0, "games": 0})
                a["n"] += v["n"]; a["pos"] += v["pos"]; a["exp"] += v["n"] * base
                if v["n"]: a["games"] += 1
        print(f"## {lang}: games={games} reviews={total}")
        rows = []
        for k, a in agg.items():
            if a["n"] == 0: continue
            rows.append((k, a["n"], a["games"], a["pos"] / a["n"], a["exp"] / a["n"], (a["pos"] - a["exp"]) / a["n"]))
        rows.sort(key=lambda r: r[5])
        for k, n, gm, pr, er, d in rows:
            print(f"{k:20s} mentions={n:5d} games={gm:3d} pos={pr*100:5.1f}% expected={er*100:5.1f}% diff={d*100:+5.1f}pt")

if __name__ == "__main__":
    main()
