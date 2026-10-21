# -*- coding: utf-8 -*-
"""Probe appreviews query_summary under different filters."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import http_get  # noqa: E402


def q(appid, **kw):
    params = {'json': '1', 'language': 'all', 'purchase_type': 'all', 'num_per_page': '0',
              'filter_offtopic_activity': '1'}
    params.update({k: str(v) for k, v in kw.items()})
    qs = '&'.join('%s=%s' % (k, v) for k, v in params.items())
    url = 'https://store.steampowered.com/appreviews/%s?%s' % (appid, qs)
    r = http_get(url, accept='application/json')
    try:
        j = json.loads(r['body'].decode('utf-8'))
    except Exception:
        return url, r['status'], None
    return url, r['status'], j


def main():
    appids = sys.argv[1].split(',')
    variants = []
    for spec in sys.argv[2:]:
        kv = dict(x.split('=', 1) for x in spec.split(';') if x)
        variants.append(kv)
    if not variants:
        variants = [{}]
    for a in appids:
        for v in variants:
            url, st, j = q(a, **v)
            qsum = (j or {}).get('query_summary')
            nrev = len((j or {}).get('reviews') or [])
            print(a, v, st, 'success', (j or {}).get('success'), json.dumps(qsum, ensure_ascii=False), 'reviews_in_page', nrev)
            time.sleep(0.6)


if __name__ == '__main__':
    main()
