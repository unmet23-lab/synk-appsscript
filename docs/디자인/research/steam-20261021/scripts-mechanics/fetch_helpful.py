# -*- coding: utf-8 -*-
"""도움됨순(filter=all) 리뷰를 받는다. 기능을 자세히 설명한 긴 리뷰를 읽기 위한 보조 표본이다.
사용: python -I -X utf8 fetch_helpful.py <raw_dir> <pages> <lang> <appid,appid,...> [day_range]
저장: raw_dir/reviews_helpful/{appid}_{lang}_p{n}.json  (day_range를 주면 파일명에 _d{N})
"""
import json, sys, time, urllib.parse, urllib.request, urllib.error, pathlib, datetime

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

def get(raw, url):
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8"})
        t0 = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read().decode("utf-8", "replace")
                with open(raw / "fetch_log.jsonl", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"url": url, "utc": t0, "status": r.status, "http_date": r.headers.get("Date")}) + "\n")
                time.sleep(2.0)
                return body
        except urllib.error.HTTPError as e:
            with open(raw / "fetch_log.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps({"url": url, "utc": t0, "status": e.code}) + "\n")
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(60 * (attempt + 1)); continue
            return None
        except Exception as e:
            time.sleep(10 * (attempt + 1))
    return None

def main():
    raw = pathlib.Path(sys.argv[1]); pages = int(sys.argv[2]); lang = sys.argv[3]
    appids = [int(x) for x in sys.argv[4].split(",") if x]
    dr = sys.argv[5] if len(sys.argv) > 5 else ""
    d = raw / "reviews_helpful"; d.mkdir(exist_ok=True)
    for a in appids:
        cursor = "*"; got = 0; seen = set()
        for p in range(pages):
            fp = d / f"{a}_{lang}{'_d'+dr if dr else ''}_p{p}.json"
            if fp.exists():
                data = json.loads(fp.read_text(encoding="utf-8"))
            else:
                url = (f"https://store.steampowered.com/appreviews/{a}?json=1&filter=all&language={lang}&num_per_page=100"
                       f"&purchase_type=all&review_type=all{'&day_range='+dr if dr else ''}&cursor={urllib.parse.quote(cursor, safe='')}")
                body = get(raw, url)
                if not body: break
                data = json.loads(body)
                data["_fetch"] = {"url": url, "utc": datetime.datetime.now(datetime.timezone.utc).isoformat()}
                fp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            revs = data.get("reviews", []) or []
            new = [r for r in revs if r["recommendationid"] not in seen]
            for r in new: seen.add(r["recommendationid"])
            got += len(new)
            nc = data.get("cursor")
            if len(revs) < 100 or not nc or nc == cursor or not new: break
            cursor = nc
        print(a, lang, "helpful", got, flush=True)
    print("DONE", flush=True)

if __name__ == "__main__":
    main()
