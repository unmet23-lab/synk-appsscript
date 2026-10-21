# -*- coding: utf-8 -*-
"""정해진 낱말이 든 리뷰 조각을 읽기 위해 출력한다(분석용, 보고서에는 풀어 쓴다).
사용: python -I -X utf8 snippets.py <raw_dir> <appid> <lang> <regex> [max_n] [window] [pos|neg|all]
출력: 맞은 리뷰 수, 그중 추천 비율, 그리고 조각(추천 여부·날짜·플레이 시간)
"""
import json, sys, re, html, pathlib, datetime

def clean(t):
    t = html.unescape(t or "")
    t = re.sub(r"\[/?[a-z0-9*]+(=[^\]]*)?\]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

def main():
    raw = pathlib.Path(sys.argv[1]); appid = sys.argv[2]; lang = sys.argv[3]
    rx = re.compile(sys.argv[4], re.I)
    max_n = int(sys.argv[5]) if len(sys.argv) > 5 else 12
    win = int(sys.argv[6]) if len(sys.argv) > 6 else 170
    which = sys.argv[7] if len(sys.argv) > 7 else "all"
    src = sys.argv[8] if len(sys.argv) > 8 else "reviews"
    revs, seen = [], set()
    files = []
    if src in ("reviews", "both"):
        files += sorted((raw / "reviews").glob(f"{appid}_{lang}_p*.json"))
    if src in ("reviews_helpful", "both"):
        files += sorted((raw / "reviews_helpful").glob(f"{appid}_{lang}_p*.json"))
        files += sorted((raw / "reviews_helpful").glob(f"{appid}_{lang}_d*_p*.json"))
    for fp in files:
        d = json.loads(fp.read_text(encoding="utf-8"))
        for r in d.get("reviews", []) or []:
            if r["recommendationid"] in seen: continue
            seen.add(r["recommendationid"]); revs.append(r)
    hits = []
    for r in revs:
        t = clean(r.get("review", ""))
        m = rx.search(t)
        if m: hits.append((r, t, m))
    pos = sum(1 for r, _, _ in hits if r.get("voted_up"))
    print(f"# {appid} {lang} total={len(revs)} hits={len(hits)} pos={pos} neg={len(hits)-pos}")
    sel = [h for h in hits if which == "all" or (which == "pos") == bool(h[0].get("voted_up"))]
    # 긴 리뷰(설명이 많은 것) 먼저
    sel.sort(key=lambda h: -len(h[1]))
    for r, t, m in sel[:max_n]:
        a = max(0, m.start() - win); b = min(len(t), m.end() + win)
        d = datetime.datetime.fromtimestamp(r["timestamp_created"], datetime.timezone.utc).strftime("%Y-%m-%d")
        pt = round(r.get("author", {}).get("playtime_at_review", 0) / 60, 1)
        print(f"- [{'+' if r.get('voted_up') else '-'}] {d} {pt}h len={len(t)}: …{t[a:b]}…")

if __name__ == "__main__":
    main()
