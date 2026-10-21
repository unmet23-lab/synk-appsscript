# -*- coding: utf-8 -*-
"""Steam 공개 엔드포인트에서 상점 정보·누적 리뷰 요약·최근 리뷰를 받아 raw 폴더에 그대로 저장한다.
사용: python -I -X utf8 fetch_steam.py <games.json> <raw_dir> [en_pages] [ko_pages] [only_appids_comma]
- 이미 받은 파일은 건너뛴다(다시 돌려도 이어 받는다).
- 모든 호출은 raw_dir/fetch_log.jsonl 에 URL·UTC 시각·HTTP Date·상태를 남긴다.
"""
import json, sys, time, urllib.parse, urllib.request, urllib.error, pathlib, datetime, os

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
COOKIE = "birthtime=470682001; lastagecheckage=1-0-1985; mature_content=1; wants_mature_content=1; Steam_Language=english"
SLEEP = float(os.environ.get("STEAM_SLEEP", "1.1"))
BACKOFF = float(os.environ.get("STEAM_BACKOFF", "20"))

def log(raw, rec):
    with open(raw / "fetch_log.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

def get(raw, url, binary=False):
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8", "Cookie": COOKIE})
        t0 = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read()
                log(raw, {"url": url, "utc": t0, "status": r.status, "http_date": r.headers.get("Date")})
                time.sleep(SLEEP)
                return body if binary else body.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            log(raw, {"url": url, "utc": t0, "status": e.code, "err": str(e)})
            if e.code in (429, 500, 502, 503, 504):
                wait = BACKOFF * (attempt + 1)
                print(f"   HTTP {e.code}, wait {wait}s", flush=True)
                time.sleep(wait)
                continue
            return None
        except Exception as e:
            log(raw, {"url": url, "utc": t0, "status": None, "err": repr(e)})
            time.sleep(10 * (attempt + 1))
    return None

def fetch_reviews(raw, appid, lang, pages):
    d = raw / "reviews"
    d.mkdir(exist_ok=True)
    cursor = "*"
    got = 0
    seen = set()
    for p in range(pages):
        fp = d / f"{appid}_{lang}_p{p}.json"
        if fp.exists():
            data = json.loads(fp.read_text(encoding="utf-8"))
        else:
            url = (f"https://store.steampowered.com/appreviews/{appid}?json=1&filter=recent&language={lang}"
                   f"&num_per_page=100&purchase_type=all&review_type=all&cursor={urllib.parse.quote(cursor, safe='')}")
            body = get(raw, url)
            if body is None:
                print(f"   reviews {lang} p{p} FAILED", flush=True)
                break
            try:
                data = json.loads(body)
            except Exception:
                print(f"   reviews {lang} p{p} bad json", flush=True)
                break
            data["_fetch"] = {"url": url, "utc": datetime.datetime.now(datetime.timezone.utc).isoformat()}
            fp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        revs = data.get("reviews", []) or []
        new = [r for r in revs if r.get("recommendationid") not in seen]
        for r in new:
            seen.add(r.get("recommendationid"))
        got += len(new)
        nc = data.get("cursor")
        if len(revs) < 100 or not nc or nc == cursor or not new:
            break
        cursor = nc
    return got

def main():
    games = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    raw = pathlib.Path(sys.argv[2]); raw.mkdir(parents=True, exist_ok=True)
    en_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    ko_pages = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    only = set(int(x) for x in sys.argv[5].split(",")) if len(sys.argv) > 5 and sys.argv[5] else None
    for sub in ("details", "summary", "store"):
        (raw / sub).mkdir(exist_ok=True)
    for g in games:
        appid = g["appid"]
        if only and appid not in only:
            continue
        print(f"== {appid} {g['name']}", flush=True)
        fp = raw / "details" / f"{appid}.json"
        if not fp.exists():
            body = get(raw, f"https://store.steampowered.com/api/appdetails?appids={appid}&l=english&cc=us")
            if body: fp.write_text(body, encoding="utf-8")
        skip_rev = os.environ.get("STEAM_SKIP_REVIEWS") == "1"
        for lang in (() if skip_rev else ("all", "english", "koreana")):
            fp = raw / "summary" / f"{appid}_{lang}.json"
            if not fp.exists():
                body = get(raw, f"https://store.steampowered.com/appreviews/{appid}?json=1&language={lang}&purchase_type=all&review_type=all&num_per_page=0")
                if body: fp.write_text(body, encoding="utf-8")
        fp = raw / "store" / f"{appid}.html"
        if not fp.exists():
            body = get(raw, f"https://store.steampowered.com/app/{appid}/?l=english&cc=us", binary=True)
            if body: fp.write_bytes(body)
        if skip_rev:
            print("   (reviews skipped)", flush=True)
            continue
        n_en = fetch_reviews(raw, appid, "english", en_pages)
        n_ko = fetch_reviews(raw, appid, "koreana", ko_pages)
        print(f"   en={n_en} ko={n_ko}", flush=True)
    print("DONE", flush=True)

if __name__ == "__main__":
    main()
