# -*- coding: utf-8 -*-
"""Crawl Steam store search for every tag query in queries.QUERIES.

Writes raw gzip pages under raw/search/<pass>/<qid>/<start>.json.gz and a
parsed summary to raw/search_results.json (resumable via per-query files).
"""
import gzip
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, Logger, ensure_dir, http_get, now_kst_iso, now_utc_iso, parse_search_rows, read_json, write_json  # noqa: E402
from queries import PASSES, QUERIES  # noqa: E402

SDIR = ensure_dir(os.path.join(RAW, 'search'))
log = Logger(os.path.join(RAW, 'logs', 'crawl_search.log'))
SLEEP = 1.5
STATS = {'requests': 0, 'r429': 0, 'wire': 0}


def search_url(tags, start, count, sort, extra):
    return ('https://store.steampowered.com/search/results/?query&start=%d&count=%d&tags=%s'
            '&category1=998&infinite=1&sort_by=%s&l=english%s' % (start, count, tags, sort, extra))


def get_json(url, cache_path=None):
    if cache_path and os.path.exists(cache_path):
        try:
            with gzip.open(cache_path, 'rb') as f:
                body = f.read()
            return {'status': 200, 'body': body, 'error': None, 'cached': True}, json.loads(body.decode('utf-8'))
        except Exception:
            pass
    r = None
    for attempt in range(1, 9):
        r = http_get(url, accept='application/json, text/javascript, */*', retries=1, log=log)
        STATS['requests'] += 1
        STATS['wire'] += r.get('wire_bytes') or 0
        if r['status'] in (429, 403) or r['status'] is None or (r['status'] or 0) >= 500:
            if r['status'] == 429:
                STATS['r429'] += 1
            wait = min(45 * attempt, 300)
            log('  wait %ds after status=%s err=%s (attempt %d) %s' % (wait, r['status'], r['error'], attempt, url[-110:]))
            time.sleep(wait)
            continue
        break
    if r['status'] != 200:
        return r, None
    try:
        return r, json.loads(r['body'].decode('utf-8'))
    except Exception as e:
        log('  json error %s %s' % (url, e))
        return r, None


def crawl_query(pass_id, qid, tags, sort, extra):
    out_path = os.path.join(SDIR, pass_id, '%s.json' % qid)
    done = read_json(out_path)
    if done and done.get('complete'):
        return done
    qdir = ensure_dir(os.path.join(SDIR, pass_id, qid))
    rows = {}
    order = []
    skipped_non_app = 0
    failures = []
    pages = 0
    start = 0
    total = None
    t0 = now_utc_iso()
    while True:
        url = search_url(tags, start, 100, sort, extra)
        cache_path = os.path.join(qdir, '%06d.json.gz' % start)
        r, j = get_json(url, cache_path)
        pages += 1
        if j is None:
            failures.append({'start': start, 'status': r['status'], 'error': r['error']})
            log('  FAIL %s %s start=%d status=%s err=%s' % (pass_id, qid, start, r['status'], r['error']))
            if len(failures) > 5:
                break
            start += 100
            if total is not None and start >= total:
                break
            time.sleep(SLEEP * 3)
            continue
        if not r.get('cached'):
            with gzip.open(cache_path, 'wb') as f:
                f.write(r['body'])
        total = j.get('total_count')
        prow = parse_search_rows(j.get('results_html') or '')
        for x in prow:
            a = x['appid_raw']
            if not a or not a.isdigit() or '/app/' not in (x['href'] or ''):
                skipped_non_app += 1
                continue
            if a not in rows:
                x['first_pos'] = len(order)
                rows[a] = x
            order.append(a)
        if not prow:
            break
        start += 100
        if total is None or start >= total:
            break
        if not r.get('cached'):
            time.sleep(SLEEP)
    res = {
        'pass': pass_id, 'qid': qid, 'tags': tags, 'sort': sort, 'extra': extra,
        'total_count': total, 'pages': pages, 'unique_apps': len(rows), 'rows_seen': len(order),
        'skipped_non_app': skipped_non_app, 'failures': failures, 'started_utc': t0,
        'finished_utc': now_utc_iso(), 'finished_kst': now_kst_iso(),
        'complete': not failures, 'rows': rows,
    }
    write_json(out_path, res)
    log('%s %-20s tags=%-14s total=%s unique=%d pages=%d skipped=%d fail=%d | req=%d 429=%d wire=%.1fMB' % (
        pass_id, qid, tags, total, len(rows), pages, skipped_non_app, len(failures),
        STATS['requests'], STATS['r429'], STATS['wire'] / 1e6))
    return res


def count_only(tags, sort, extra):
    r, j = get_json(search_url(tags, 0, 1, sort, extra))
    time.sleep(SLEEP)
    return j.get('total_count') if j else None


def main():
    which = sys.argv[1:] or ['A', 'B', 'C', 'counts']
    meta_path = os.path.join(RAW, 'search_meta.json')
    meta = read_json(meta_path, {}) or {}
    meta.setdefault('runs', []).append({'started_kst': now_kst_iso(), 'which': which})
    write_json(meta_path, meta)
    for p in which:
        if p == 'counts':
            cpath = os.path.join(SDIR, 'counts.json')
            counts = read_json(cpath, {}) or {}
            for qid, tags, layer, name in QUERIES:
                if qid in counts and counts[qid].get('done'):
                    continue
                pa = read_json(os.path.join(SDIR, 'A', '%s.json' % qid)) or {}
                pc = read_json(os.path.join(SDIR, 'C', '%s.json' % qid)) or {}
                c = {
                    'tags': tags, 'layer': layer, 'name': name,
                    'reviews_maxvis': pa.get('total_count'),
                    'released_maxvis': pc.get('total_count') if pc else count_only(tags, 'Released_DESC', '&ignore_preferences=1&cc=us'),
                    'relevance_maxvis': count_only(tags, '_ASC', '&ignore_preferences=1&cc=us'),
                    'reviews_krdefault': count_only(tags, 'Reviews_DESC', '') if layer != 'X' else None,
                    'at_kst': now_kst_iso(), 'done': True,
                }
                counts[qid] = c
                write_json(cpath, counts)
                log('counts %-20s %s' % (qid, {k: v for k, v in c.items() if k.endswith('vis') or k.endswith('default')}))
            continue
        sort, extra, layers = PASSES[p]
        for qid, tags, layer, name in QUERIES:
            if layer not in layers:
                continue
            res = crawl_query(p, qid, tags, sort, extra)
            if res.get('total_count') is not None and res['unique_apps'] + res['skipped_non_app'] < res['total_count']:
                log('  WARN %s %s unique+skipped %d < total %d' % (p, qid, res['unique_apps'] + res['skipped_non_app'], res['total_count']))
    meta = read_json(meta_path, {}) or {}
    meta['runs'][-1]['finished_kst'] = now_kst_iso()
    write_json(meta_path, meta)
    log('done %s' % which)


if __name__ == '__main__':
    main()
