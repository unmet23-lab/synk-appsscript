# -*- coding: utf-8 -*-
"""Probe api.steampowered.com IUserReviewsService/GetAppReviews parameter forms."""
import json
import os
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import http_get  # noqa: E402

BASE = 'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/'
VARIANTS = [
    '?appid=413150&language=all&purchase_type=all&num_per_page=1',
    '?appid=413150&languages=all&purchase_type=all&num_per_page=1',
    '?appid=413150&language=all&purchase_type=0&num_per_page=1',
    '?appid=413150&language=all&purchase_type=1&num_per_page=1',
    '?appid=413150&language=all&purchase_type=2&num_per_page=1',
    '?input_json=' + urllib.parse.quote(json.dumps({'appid': 413150, 'language': 'all', 'purchase_type': 'all', 'num_per_page': 1})),
    '?input_json=' + urllib.parse.quote(json.dumps({'appid': 413150, 'language': 'all', 'purchase_type': 0, 'num_per_page': 1})),
    '?input_json=' + urllib.parse.quote(json.dumps({'appid': 413150, 'languages': ['all'], 'num_per_page': 1})),
    '?appid=413150&language=schinese&num_per_page=1',
    '?appid=413150&filter_offtopic_activity=0&num_per_page=1',
]

for v in VARIANTS:
    r = http_get(BASE + v, accept='application/json', cookies=None, retries=1)
    try:
        j = json.loads(r['body'].decode('utf-8'))
        q = (j.get('response') or {}).get('query_summary')
    except Exception:
        q = r['body'][:150]
    print(r['status'], v[:110], '->', q)
    time.sleep(0.5)
