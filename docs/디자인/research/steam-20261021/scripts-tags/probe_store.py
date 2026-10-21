# -*- coding: utf-8 -*-
"""Probe store app page + review histogram for a few appids."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, http_get, ensure_dir  # noqa: E402
from storeparse import parse_store  # noqa: E402

OUT = ensure_dir(os.path.join(RAW, 'probe'))


def main():
    for a in sys.argv[1].split(','):
        url = 'https://store.steampowered.com/app/%s/?l=english' % a
        r = http_get(url, accept='text/html')
        body = r['body'].decode('utf-8', 'replace')
        with open(os.path.join(OUT, 'store_%s.html' % a), 'w', encoding='utf-8') as f:
            f.write(body)
        p = parse_store(body)
        print(a, 'status', r['status'], 'wire', r['wire_bytes'], 'len', len(body), 'final_url', r['url'][:80])
        print('  title', p['title'], '| agegate', p['agegate'], '| EA', p['early_access_marker'], '| rel', p['release_date'], '| dev', p['developers'], '| pub', p['publishers'])
        print('  recent', p['recent'])
        print('  all', p['all_display'])
        print('  rows', json.dumps(p['summary_rows'], ensure_ascii=False)[:600])
        print('  tags', [(t['name'], t['count']) for t in p['tags']][:20])
        print('  genres', p['genres'], '| price', p['price_final'], p['price_text'])
        print('  korean', p['languages'].get('Korean'), '| nlang', len(p['languages']))
        print('  snippet', (p['snippet'] or '')[:200])
        time.sleep(1.0)
        hu = 'https://store.steampowered.com/appreviewhistogram/%s?l=english&review_score_preference=0' % a
        h = http_get(hu, accept='application/json')
        try:
            hj = json.loads(h['body'].decode('utf-8'))
            res = hj.get('results') or {}
            rec = res.get('recent') or []
            up = sum(x.get('recommendations_up', 0) for x in rec)
            dn = sum(x.get('recommendations_down', 0) for x in rec)
            print('  hist status', h['status'], 'wire', h['wire_bytes'], 'recent days', len(rec), 'up', up, 'down', dn,
                  'pct', round(100 * up / (up + dn), 1) if up + dn else None, 'keys', list(res.keys()))
            if rec:
                print('  hist first/last', rec[0], rec[-1])
        except Exception as e:
            print('  hist parse error', e, h['status'])
        time.sleep(1.0)


if __name__ == '__main__':
    main()
