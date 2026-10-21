# -*- coding: utf-8 -*-
"""Batch app info via IStoreBrowseService/GetItems (api.steampowered.com).

python fetch_storebrowse.py <appid_list_file> <country_code> [batch=100] [interval=1.0]
Raw batches: raw/storebrowse_<cc>/batch_<n>.json.gz ; index: raw/storebrowse_<cc>/_items.jsonl
"""
import gzip
import json
import os
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, Logger, ensure_dir, http_get, now_kst_iso, now_utc_iso  # noqa: E402

DATA_REQUEST = {
    'include_assets': False, 'include_release': True, 'include_platforms': False,
    'include_all_purchase_options': False, 'include_screenshots': False, 'include_trailers': False,
    'include_ratings': True, 'include_tag_count': 20, 'include_reviews': True,
    'include_basic_info': True, 'include_supported_languages': True, 'include_full_description': False,
    'include_included_items': False,
}


def main():
    listfile, cc = sys.argv[1], sys.argv[2]
    batch = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    interval = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    with open(listfile, encoding='utf-8') as f:
        appids = [int(x) for x in f.read().split() if x.strip()]
    d = ensure_dir(os.path.join(RAW, 'storebrowse_%s' % cc.lower()))
    log = Logger(os.path.join(RAW, 'logs', 'storebrowse_%s.log' % cc.lower()))
    items_path = os.path.join(d, '_items.jsonl')
    done = set()
    if os.path.exists(items_path):
        with open(items_path, encoding='utf-8') as f:
            for line in f:
                try:
                    done.add(int(json.loads(line)['appid']))
                except Exception:
                    pass
    todo = [a for a in appids if a not in done]
    log('storebrowse %s: %d requested, %d done, %d todo' % (cc, len(appids), len(appids) - len(todo), len(todo)))
    fout = open(items_path, 'a', encoding='utf-8', newline='\n')
    nb = len([x for x in os.listdir(d) if x.startswith('batch_')])
    wire = 0
    for i in range(0, len(todo), batch):
        chunk = todo[i:i + batch]
        req = {'ids': [{'appid': a} for a in chunk],
               'context': {'language': 'english', 'country_code': cc.upper(), 'steam_realm': 1},
               'data_request': DATA_REQUEST}
        url = ('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' +
               urllib.parse.quote(json.dumps(req, separators=(',', ':'))))
        for attempt in range(1, 7):
            r = http_get(url, accept='application/json', cookies=None, retries=1)
            if r['status'] == 200:
                break
            wait = min(30 * attempt, 180)
            log('  batch %d status=%s err=%s wait %ds' % (nb, r['status'], r['error'], wait))
            time.sleep(wait)
        wire += r['wire_bytes'] or 0
        if r['status'] != 200:
            log('  FAIL batch starting %s' % chunk[0])
            continue
        with gzip.open(os.path.join(d, 'batch_%05d.json.gz' % nb), 'wb') as f:
            f.write(r['body'])
        nb += 1
        j = json.loads(r['body'].decode('utf-8'))
        items = (j.get('response') or {}).get('store_items') or []
        got = set()
        t = now_kst_iso()
        for it in items:
            a = it.get('appid') or it.get('id')
            got.add(a)
            it['_fetched_kst'] = t
            fout.write(json.dumps({'appid': a, 'item': it}, ensure_ascii=False) + '\n')
        for a in chunk:
            if a not in got:
                fout.write(json.dumps({'appid': a, 'item': None, '_fetched_kst': t}) + '\n')
        fout.flush()
        if (i // batch) % 10 == 0:
            log('  %s batch %d: %d/%d apps, wire %.1fMB' % (cc, nb, i + len(chunk), len(todo), wire / 1e6))
        time.sleep(interval)
    fout.close()
    log('storebrowse %s done, wire %.1fMB' % (cc, wire / 1e6))


if __name__ == '__main__':
    main()
