# -*- coding: utf-8 -*-
"""Page through one tag query fully and report coverage vs total_count."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, http_get, parse_search_rows, ensure_dir  # noqa: E402

OUT = ensure_dir(os.path.join(RAW, 'probe'))


def fetch(tags, start, count, sort, extra):
    url = ('https://store.steampowered.com/search/results/?query&start=%d&count=%d&tags=%s'
           '&category1=998&infinite=1&sort_by=%s&l=english%s' % (start, count, tags, sort, extra))
    r = http_get(url, accept='application/json, text/javascript, */*')
    j = json.loads(r['body'].decode('utf-8'))
    return j


def main():
    tags = sys.argv[1]
    sort = sys.argv[2] if len(sys.argv) > 2 else 'Reviews_DESC'
    extra = sys.argv[3] if len(sys.argv) > 3 else ''
    count = int(sys.argv[4]) if len(sys.argv) > 4 else 100
    start = 0
    seen = {}
    order = []
    total = None
    pages = 0
    while True:
        j = fetch(tags, start, count, sort, extra)
        pages += 1
        total = j.get('total_count')
        rows = parse_search_rows(j.get('results_html') or '')
        new = 0
        for r in rows:
            k = r['appid_raw'] or r['bundleid'] or r['packageid'] or r['href']
            if k not in seen:
                seen[k] = r
                new += 1
            order.append(k)
        first = rows[0]['appid_raw'] if rows else None
        last = rows[-1]['appid_raw'] if rows else None
        print('start', start, 'ret_start', j.get('start'), 'rows', len(rows), 'new', new, 'total', total, 'first', first, 'last', last, flush=True)
        if not rows or start + count >= (total or 0) + 200:
            break
        start += len(rows)
        if start >= (total or 0):
            break
        time.sleep(1.0)
    noscore = sum(1 for v in seen.values() if v['search_n'] is None)
    print('pages', pages, 'unique', len(seen), 'total_count', total, 'rows_seen', len(order), 'no_review_summary', noscore)
    with open(os.path.join(OUT, 'full_%s_%s%s.json' % (tags.replace(',', '+'), sort, extra.replace('&', '_').replace('=', '-'))), 'w', encoding='utf-8') as f:
        json.dump({'tags': tags, 'sort': sort, 'extra': extra, 'total': total, 'order': order, 'rows': seen}, f, ensure_ascii=False)


if __name__ == '__main__':
    main()
