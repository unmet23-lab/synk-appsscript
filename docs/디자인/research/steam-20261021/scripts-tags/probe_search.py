# -*- coding: utf-8 -*-
"""Probe Steam store search behaviour (pagination, tag intersection, sort, cc)."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, http_get, parse_search_rows, ensure_dir, now_kst_iso, write_json  # noqa: E402

OUT = ensure_dir(os.path.join(RAW, 'probe'))


def search(tags, start=0, count=100, sort='Reviews_DESC', extra=''):
    url = ('https://store.steampowered.com/search/results/?query&start=%d&count=%d&tags=%s'
           '&category1=998&infinite=1&sort_by=%s&l=english%s' % (start, count, tags, sort, extra))
    r = http_get(url, accept='application/json, text/javascript, */*')
    try:
        j = json.loads(r['body'].decode('utf-8'))
    except Exception as e:
        return url, r, None
    return url, r, j


def main():
    report = {'at_kst': now_kst_iso(), 'checks': []}
    mode = sys.argv[1] if len(sys.argv) > 1 else 'basic'
    if mode == 'basic':
        url, r, j = search('10235', 0, 100)
        rows = parse_search_rows(j['results_html']) if j else []
        with open(os.path.join(OUT, 'lifesim_p0.json'), 'wb') as f:
            f.write(r['body'])
        print('status', r['status'], 'wire', r['wire_bytes'], 'total_count', j and j.get('total_count'), 'start', j and j.get('start'), 'rows', len(rows))
        for x in rows[:40]:
            print(x['appid_raw'], '|', x['name'], '|', x['released'], '|', x['search_label'], x['search_pct'], x['search_n'], '|', x['price_final_cents'], '|', x['href'][:60])
        print('keys', list(j.keys()) if j else None)
    elif mode == 'counts':
        for tags in sys.argv[2:]:
            url, r, j = search(tags, 0, 1)
            print(tags, 'status', r['status'], 'total_count', j and j.get('total_count'))
            time.sleep(1.2)
    elif mode == 'tail':
        tags = sys.argv[2]
        url, r, j = search(tags, 0, 1)
        total = j['total_count']
        for st in [total - 120, total - 50, total - 3, total + 50]:
            url, r, j2 = search(tags, max(st, 0), 100)
            rows = parse_search_rows(j2['results_html']) if j2 else []
            print('start', st, 'status', r['status'], 'total', j2 and j2.get('total_count'), 'rows', len(rows))
            for x in rows[-5:]:
                print('   ', x['appid_raw'], '|', x['name'], '|', x['released'], '|', x['search_label'], x['search_pct'], x['search_n'])
            time.sleep(1.2)
    elif mode == 'cc':
        tags = sys.argv[2]
        for extra in ['', '&cc=us', '&cc=kr', '&cc=us&ignore_preferences=1', '&ignore_preferences=1']:
            url, r, j = search(tags, 0, 1, extra=extra)
            print(repr(extra), 'status', r['status'], 'total_count', j and j.get('total_count'))
            time.sleep(1.2)
    elif mode == 'sort':
        tags = sys.argv[2]
        start = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        url, r, j = search(tags, start, 100)
        rows = parse_search_rows(j['results_html']) if j else []
        for x in rows:
            print(x['appid_raw'], '|', (x['name'] or '')[:40], '|', x['search_label'], x['search_pct'], x['search_n'])


if __name__ == '__main__':
    main()
