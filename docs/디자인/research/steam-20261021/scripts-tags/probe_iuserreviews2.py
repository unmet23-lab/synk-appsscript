# -*- coding: utf-8 -*-
"""Map IUserReviewsService/GetAppReviews (api host) to the store appreviews filters."""
import json
import os
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import http_get  # noqa: E402

API = 'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json='
STORE = 'https://store.steampowered.com/appreviews/%d?json=1&language=all&review_type=all&purchase_type=%s&num_per_page=0&filter_offtopic_activity=%d'


def api(appid, **kw):
    req = {'appid': appid, 'languages': ['all'], 'num_per_page': 0}
    req.update(kw)
    r = http_get(API + urllib.parse.quote(json.dumps(req, separators=(',', ':'))), accept='application/json', cookies=None, retries=1)
    try:
        return r['status'], (json.loads(r['body'].decode('utf-8')).get('response') or {}).get('query_summary')
    except Exception:
        return r['status'], None


def store(appid, pt, off):
    r = http_get(STORE % (appid, pt, off), accept='application/json', retries=1)
    try:
        return r['status'], json.loads(r['body'].decode('utf-8')).get('query_summary')
    except Exception:
        return r['status'], None


for appid in [int(x) for x in sys.argv[1].split(',')]:
    for kw in [{'purchase_type': 1}, {'purchase_type': 1, 'filter_offtopic_activity': True},
               {'purchase_type': 1, 'filter_offtopic_activity': False}, {'purchase_type': 1, 'filter_offtopic_activity': 0},
               {'purchase_type': 0}]:
        st, q = api(appid, **kw)
        print('API', appid, kw, st, q and (q.get('total_positive'), q.get('total_reviews'), q.get('review_score_desc')))
        time.sleep(0.4)
    for pt, off in [('all', 1), ('all', 0), ('steam', 1)]:
        st, q = store(appid, pt, off)
        print('STORE', appid, pt, 'offtopic', off, st, q and (q.get('total_positive'), q.get('total_reviews'), q.get('review_score_desc')))
        time.sleep(0.8)
