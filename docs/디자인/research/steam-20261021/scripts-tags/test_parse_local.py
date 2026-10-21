# -*- coding: utf-8 -*-
"""Parse saved store pages offline (no network)."""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from storeparse import parse_store  # noqa: E402

for path in sys.argv[1:]:
    for f in glob.glob(path):
        body = open(f, encoding='utf-8').read()
        p = parse_store(body)
        print(os.path.basename(f), '| title', p['title'], '| EA', p['early_access_marker'], '| genres', p['genres'])
        print('   recent', p['recent'])
        print('   all', {k: v for k, v in (p['all_display'] or {}).items() if k != 'tip'})
        print('   korean', p['languages'].get('Korean'), '| nlang', len(p['languages']), '| price', p['price_final'], p['price_text'])
        print('   rows', [(r['subtitle'], r['label'], r['count_paren']) for r in p['summary_rows']])
