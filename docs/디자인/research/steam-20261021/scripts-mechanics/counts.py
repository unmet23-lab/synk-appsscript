# -*- coding: utf-8 -*-
"""정해진 질문(게임·표본·정규식)마다 언급 리뷰 수와 추천률을 센다. 보고서 숫자 확인용.
사용: python -I -X utf8 counts.py <raw_dir> <questions.json>
questions.json: [{"id": "...", "appid": 123, "lang": "english", "src": "reviews|reviews_helpful|both", "re": "..."}]
"""
import json, sys, re, html, pathlib

def clean(t):
    t = html.unescape(t or "")
    t = re.sub(r"\[/?[a-z0-9*]+(=[^\]]*)?\]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def load(raw, appid, lang, src):
    files = []
    if src in ("reviews", "both"):
        files += sorted((raw / "reviews").glob(f"{appid}_{lang}_p*.json"))
    if src in ("reviews_helpful", "both"):
        files += sorted((raw / "reviews_helpful").glob(f"{appid}_{lang}_p*.json"))
        files += sorted((raw / "reviews_helpful").glob(f"{appid}_{lang}_d*_p*.json"))
    out, seen = [], set()
    for fp in files:
        for r in json.loads(fp.read_text(encoding="utf-8")).get("reviews", []) or []:
            if r["recommendationid"] in seen: continue
            seen.add(r["recommendationid"]); out.append(r)
    return out

def main():
    raw = pathlib.Path(sys.argv[1])
    qs = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
    for q in qs:
        revs = load(raw, q["appid"], q.get("lang", "english"), q.get("src", "reviews"))
        rx = re.compile(q["re"], re.I)
        hits = [r for r in revs if rx.search(clean(r.get("review", "")))]
        pos = sum(1 for r in hits if r.get("voted_up"))
        base = sum(1 for r in revs if r.get("voted_up"))
        print(f"{q['id']:28s} n={len(revs):4d} base_pos={base/len(revs)*100 if revs else 0:5.1f}% hits={len(hits):4d} pos={pos} neg={len(hits)-pos} pos_rate={pos/len(hits)*100 if hits else 0:5.1f}%")

if __name__ == "__main__":
    main()
