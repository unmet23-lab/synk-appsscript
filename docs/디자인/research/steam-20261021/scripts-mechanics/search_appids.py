# -*- coding: utf-8 -*-
"""Steam 상점 검색으로 후보 게임의 appid를 확인한다.
사용: python -I -X utf8 search_appids.py <raw_dir> <term1> <term2> ...
결과: raw_dir/search_<n>.json 저장 + 상위 5개를 출력
"""
import json, sys, time, urllib.parse, urllib.request, pathlib

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SYNK-research/1.0"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def main():
    raw = pathlib.Path(sys.argv[1])
    raw.mkdir(parents=True, exist_ok=True)
    terms = sys.argv[2:]
    allres = {}
    for i, t in enumerate(terms):
        url = "https://store.steampowered.com/api/storesearch/?term=" + urllib.parse.quote(t) + "&l=english&cc=US"
        try:
            body = get(url)
            data = json.loads(body)
        except Exception as e:
            print(f"[{t}] ERROR {e}")
            continue
        allres[t] = data
        items = data.get("items", [])[:6]
        print(f"== {t}")
        for it in items:
            print(f"   {it.get('id')}\t{it.get('name')}\t{it.get('type')}")
        time.sleep(0.8)
    (raw / f"search_{int(time.time())}.json").write_text(json.dumps(allres, ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    main()
