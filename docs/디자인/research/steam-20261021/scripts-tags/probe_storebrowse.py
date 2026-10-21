# -*- coding: utf-8 -*-
"""Probe IStoreBrowseService/GetItems (api.steampowered.com) for batch app info."""
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, http_get, ensure_dir  # noqa: E402

OUT = ensure_dir(os.path.join(RAW, 'probe'))


def main():
    ids = [int(x) for x in sys.argv[1].split(',')]
    req = {
        'ids': [{'appid': a} for a in ids],
        'context': {'language': 'english', 'country_code': 'US', 'steam_realm': 1},
        'data_request': {
            'include_assets': False, 'include_release': True, 'include_platforms': False,
            'include_all_purchase_options': False, 'include_screenshots': False, 'include_trailers': False,
            'include_ratings': True, 'include_tag_count': 20, 'include_reviews': True,
            'include_basic_info': True, 'include_supported_languages': True, 'include_full_description': False,
            'include_included_items': False,
        },
    }
    url = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' + urllib.parse.quote(json.dumps(req, separators=(',', ':')))
    r = http_get(url, accept='application/json', cookies=None)
    print('status', r['status'], 'wire', r['wire_bytes'], 'len', len(r['body']), r['error'])
    body = r['body'].decode('utf-8', 'replace')
    with open(os.path.join(OUT, 'storebrowse_probe.json'), 'w', encoding='utf-8') as f:
        f.write(body)
    try:
        j = json.loads(body)
    except Exception:
        print(body[:500])
        return
    items = (j.get('response') or {}).get('store_items') or []
    print('items', len(items))
    for it in items[:3]:
        print(json.dumps(it, ensure_ascii=False)[:3000])
        print('---')


if __name__ == '__main__':
    main()
