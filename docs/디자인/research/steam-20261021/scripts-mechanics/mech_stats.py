# -*- coding: utf-8 -*-
"""게임별 기능(메커니즘) 낱말이 든 리뷰의 수·비율·추천률과 자주 나온 낱말을 센다.
사용: python -I -X utf8 mech_stats.py <mech.json> <raw_dir> <out_dir>
"""
import json, sys, re, html, pathlib, csv, collections, datetime

def clean(t):
    t = html.unescape(t or "")
    t = re.sub(r"\[/?[a-z0-9*]+(=[^\]]*)?\]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def load(raw, folder, appid, lang):
    files = sorted((raw / folder).glob(f"{appid}_{lang}_p*.json")) + sorted((raw / folder).glob(f"{appid}_{lang}_d*_p*.json"))
    out, seen = [], set()
    for fp in files:
        d = json.loads(fp.read_text(encoding="utf-8"))
        for r in d.get("reviews", []) or []:
            if r["recommendationid"] in seen: continue
            seen.add(r["recommendationid"]); out.append(r)
    return out

def stat(revs, pat):
    rx = re.compile(pat, re.I)
    n = len(revs); hits = []; terms = collections.Counter()
    for r in revs:
        t = clean(r.get("review", ""))
        ms = rx.findall(t)
        found = [m if isinstance(m, str) else m[0] for m in ms]
        if rx.search(t):
            hits.append(r)
            for m in set(x.group(0).lower() for x in rx.finditer(t)):
                terms[m] += 1
    pos_all = sum(1 for r in revs if r.get("voted_up"))
    pos_hit = sum(1 for r in hits if r.get("voted_up"))
    dates = [r["timestamp_created"] for r in revs]
    f = lambda x: datetime.datetime.fromtimestamp(x, datetime.timezone.utc).strftime("%Y-%m-%d")
    return {"n": n, "from": f(min(dates)) if dates else None, "to": f(max(dates)) if dates else None,
            "pos_all": round(pos_all / n, 3) if n else None, "hits": len(hits),
            "hit_share": round(len(hits) / n, 3) if n else None,
            "pos_hit": round(pos_hit / len(hits), 3) if hits else None,
            "neg_hits": len(hits) - pos_hit,
            "top_terms": terms.most_common(8)}

def main():
    mech = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    raw = pathlib.Path(sys.argv[2]); out = pathlib.Path(sys.argv[3]); out.mkdir(exist_ok=True)
    res = {}
    for appid, m in mech.items():
        r = {"name": m["name"]}
        en_pat = r"\b(?:" + m["en"] + r")\b"
        for key, folder, lang, pat in (("recent_en", "reviews", "english", en_pat), ("recent_ko", "reviews", "koreana", m["ko"]),
                                       ("helpful_en", "reviews_helpful", "english", en_pat)):
            revs = load(raw, folder, appid, lang) if (raw / folder).exists() else []
            r[key] = stat(revs, pat) if revs else {"n": 0}
        res[appid] = r
    (out / "mech_stats.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    with open(out / "mech_stats.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["appid", "name", "sample", "n", "from", "to", "pos_all", "hits", "hit_share", "pos_hit", "neg_hits", "top_terms"])
        for appid, r in res.items():
            for key in ("recent_en", "recent_ko", "helpful_en"):
                s = r[key]
                w.writerow([appid, r["name"], key, s.get("n"), s.get("from"), s.get("to"), s.get("pos_all"), s.get("hits"), s.get("hit_share"),
                            s.get("pos_hit"), s.get("neg_hits"), "; ".join(f"{a}:{b}" for a, b in s.get("top_terms", []))])
    print("ok", len(res))

if __name__ == "__main__":
    main()
