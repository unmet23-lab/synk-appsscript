# -*- coding: utf-8 -*-
"""Per-app fetchers (appreviews, store page, histogram, appdetails, SteamSpy).

Each fetcher is resumable: raw responses go to raw/<kind>/<appid>.<ext>,
and a status line per app goes to raw/<kind>/_index.jsonl (last line wins).

Usage:
  python fetchers.py <kind> <appid_list_file> [--workers N] [--interval S]
kinds: reviews_all, reviews_steam, store, hist, appdetails, steamspy
"""
import gzip
import json
import os
import sys
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, Logger, ensure_dir, http_get, now_kst_iso, now_utc_iso  # noqa: E402
from storeparse import parse_store  # noqa: E402

KINDS = {
    'reviews_all': {
        'url': 'https://store.steampowered.com/appreviews/{a}?json=1&language=all&review_type=all&purchase_type=all&num_per_page=0&filter_offtopic_activity=1',
        'ext': 'json', 'interval': 0.35, 'workers': 3, 'accept': 'application/json'},
    'reviews_steam': {
        'url': 'https://store.steampowered.com/appreviews/{a}?json=1&language=all&review_type=all&purchase_type=steam&num_per_page=0&filter_offtopic_activity=1',
        'ext': 'json', 'interval': 0.35, 'workers': 3, 'accept': 'application/json'},
    'store': {
        'url': 'https://store.steampowered.com/app/{a}/?l=english',
        'ext': 'html.gz', 'interval': 1.1, 'workers': 2, 'accept': 'text/html'},
    'hist': {
        'url': 'https://store.steampowered.com/appreviewhistogram/{a}?l=english&review_score_preference=0',
        'ext': 'json', 'interval': 0.6, 'workers': 2, 'accept': 'application/json'},
    'appdetails': {
        'url': 'https://store.steampowered.com/api/appdetails?appids={a}&l=english',
        'ext': 'json', 'interval': 1.6, 'workers': 1, 'accept': 'application/json'},
    'steamspy': {
        'url': 'https://steamspy.com/api.php?request=appdetails&appid={a}',
        'ext': 'json', 'interval': 1.15, 'workers': 1, 'accept': 'application/json'},
    # Official Web API path for the same review summary (api.steampowered.com).
    # purchase_type enum verified 2026-10-21: 0=steam, 1=all, 2=non-steam; languages ["all"];
    # off-topic filter is on by default (= store filter_offtopic_activity=1).
    'api_all': {
        'url_fn': lambda a: 'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=' + urllib.parse.quote(
            json.dumps({'appid': int(a), 'languages': ['all'], 'purchase_type': 1, 'num_per_page': 0}, separators=(',', ':'))),
        'ext': 'json', 'interval': 0.25, 'workers': 3, 'accept': 'application/json', 'nocookie': True},
    'api_steam': {
        'url_fn': lambda a: 'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=' + urllib.parse.quote(
            json.dumps({'appid': int(a), 'languages': ['all'], 'purchase_type': 0, 'num_per_page': 0}, separators=(',', ':'))),
        'ext': 'json', 'interval': 0.25, 'workers': 3, 'accept': 'application/json', 'nocookie': True},
}


class Pacer:
    def __init__(self, interval):
        self.interval = interval
        self.lock = threading.Lock()
        self.next_t = 0.0
        self.pause_until = 0.0

    def wait(self):
        with self.lock:
            now = time.time()
            t = max(now, self.next_t, self.pause_until)
            self.next_t = t + self.interval
        d = t - time.time()
        if d > 0:
            time.sleep(d)

    def pause(self, secs):
        with self.lock:
            self.pause_until = max(self.pause_until, time.time() + secs)


def summarize(kind, body_bytes, status):
    """Return a compact parsed dict for the index."""
    if status != 200:
        return {'ok': False}
    try:
        if kind.startswith('reviews_'):
            j = json.loads(body_bytes.decode('utf-8'))
            q = j.get('query_summary') or {}
            return {'ok': bool(j.get('success') == 1), 'query_summary': {k: q.get(k) for k in (
                'review_score', 'review_score_desc', 'total_positive', 'total_negative', 'total_reviews')}}
        if kind.startswith('api_'):
            j = json.loads(body_bytes.decode('utf-8'))
            q = (j.get('response') or {}).get('query_summary')
            if q is None:
                return {'ok': False, 'parse_error': 'no query_summary'}
            return {'ok': True, 'query_summary': {k: q.get(k) for k in (
                'review_score', 'review_score_desc', 'total_positive', 'total_negative', 'total_reviews')}}
        if kind == 'hist':
            j = json.loads(body_bytes.decode('utf-8'))
            res = j.get('results') or {}
            rec = res.get('recent') or []
            up = sum(int(x.get('recommendations_up') or 0) for x in rec)
            dn = sum(int(x.get('recommendations_down') or 0) for x in rec)
            dates = [x.get('date') for x in rec if x.get('date')]
            return {'ok': bool(j.get('success') == 1), 'recent_up': up, 'recent_down': dn, 'recent_days': len(rec),
                    'recent_first': min(dates) if dates else None, 'recent_last': max(dates) if dates else None,
                    'rollup_type': res.get('rollup_type')}
        if kind == 'store':
            p = parse_store(body_bytes.decode('utf-8', 'replace'))
            p.pop('summary_rows', None)
            return {'ok': bool(p.get('title') or p.get('tags')), 'parsed': p}
        if kind == 'appdetails':
            j = json.loads(body_bytes.decode('utf-8'))
            k = list(j.keys())[0] if j else None
            node = j.get(k) or {}
            return {'ok': bool(node.get('success'))}
        if kind == 'steamspy':
            j = json.loads(body_bytes.decode('utf-8'))
            return {'ok': bool(j.get('appid')), 'name': j.get('name'), 'owners': j.get('owners')}
    except Exception as e:
        return {'ok': False, 'parse_error': '%s: %s' % (type(e).__name__, e)}
    return {'ok': True}


def load_index(kind):
    path = os.path.join(RAW, kind, '_index.jsonl')
    idx = {}
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                idx[str(d['appid'])] = d
    return idx


def run(kind, appids, workers=None, interval=None):
    cfg = KINDS[kind]
    kdir = ensure_dir(os.path.join(RAW, kind))
    log = Logger(os.path.join(RAW, 'logs', 'fetch_%s.log' % kind))
    idx = load_index(kind)
    todo = [a for a in appids if not (idx.get(str(a)) or {}).get('ok')]
    log('%s: %d requested, %d already ok, %d to fetch' % (kind, len(appids), len(appids) - len(todo), len(todo)))
    pacer = Pacer(interval or cfg['interval'])
    lock = threading.Lock()
    index_path = os.path.join(kdir, '_index.jsonl')
    fidx = open(index_path, 'a', encoding='utf-8', newline='\n')
    counter = {'n': 0, 'fail': 0, 'wire': 0}

    def one(a):
        a = str(a)
        url = cfg['url_fn'](a) if 'url_fn' in cfg else cfg['url'].format(a=a)
        for attempt in range(1, 4):
            pacer.wait()
            if cfg.get('nocookie'):
                r = http_get(url, accept=cfg['accept'], retries=2, backoff=8.0, cookies=None)
            else:
                r = http_get(url, accept=cfg['accept'], retries=2, backoff=8.0)
            st = r['status']
            if st in (429, 403) or (st is None and attempt < 3):
                pacer.pause(45 * attempt)
                log('  %s %s status=%s err=%s -> pause %ds' % (kind, a, st, r['error'], 45 * attempt))
                continue
            break
        body = r['body'] or b''
        summ = summarize(kind, body, st)
        if st == 200 and body:
            if cfg['ext'].endswith('.gz'):
                with gzip.open(os.path.join(kdir, '%s.%s' % (a, cfg['ext'])), 'wb') as f:
                    f.write(body)
            else:
                with open(os.path.join(kdir, '%s.%s' % (a, cfg['ext'])), 'wb') as f:
                    f.write(body)
        rec = {'appid': a, 'status': st, 'error': r['error'], 'fetched_utc': now_utc_iso(), 'fetched_kst': now_kst_iso(),
               'http_date': (r['headers'] or {}).get('Date'), 'final_url': r['url'], 'wire_bytes': r['wire_bytes']}
        rec.update(summ)
        with lock:
            fidx.write(json.dumps(rec, ensure_ascii=False) + '\n')
            fidx.flush()
            counter['n'] += 1
            counter['wire'] += r['wire_bytes'] or 0
            if not rec.get('ok'):
                counter['fail'] += 1
            if counter['n'] % 200 == 0:
                log('  %s progress %d/%d fail=%d wire=%.1fMB' % (kind, counter['n'], len(todo), counter['fail'], counter['wire'] / 1e6))

    with ThreadPoolExecutor(max_workers=workers or cfg['workers']) as ex:
        list(ex.map(one, todo))
    fidx.close()
    log('%s done: fetched %d, fail %d, wire %.1fMB' % (kind, counter['n'], counter['fail'], counter['wire'] / 1e6))


def main():
    kind = sys.argv[1]
    listfile = sys.argv[2]
    workers = None
    interval = None
    if '--workers' in sys.argv:
        workers = int(sys.argv[sys.argv.index('--workers') + 1])
    if '--interval' in sys.argv:
        interval = float(sys.argv[sys.argv.index('--interval') + 1])
    with open(listfile, encoding='utf-8') as f:
        appids = [line.strip() for line in f if line.strip()]
    run(kind, appids, workers, interval)


if __name__ == '__main__':
    main()
