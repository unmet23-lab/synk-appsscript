# -*- coding: utf-8 -*-
"""SteamSpy request=tag for every tag name used in the query plan (1 req / 2 s)."""
import json
import os
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import RAW, Logger, ensure_dir, http_get, now_kst_iso  # noqa: E402

TAGS = ['Life Sim', 'Cozy', 'Farming Sim', 'Farming', 'Agriculture', 'Wholesome', 'Colony Sim', 'Dating Sim',
        'Shop Keeper', 'Hobby Sim', 'Decorating', 'Organizing', 'Cleaning', 'Fishing', 'Cooking', 'Job Simulator',
        'Desktop Companion', 'Cats', 'Dogs', 'Animals', 'Horses', 'Birds', 'Foxes', 'Capybaras', 'Wolves', 'Zoo',
        'Creature Collector', 'City Builder', 'Building', 'Base Building', 'Crafting', 'Sandbox', 'Management',
        'God Game', 'Idler', 'Incremental', 'Romance', 'Otome', 'Asynchronous Multiplayer', 'Education',
        'Language Learning', 'Word Game', 'Spelling', 'Typing', 'Trivia', 'Relaxing']


def main():
    d = ensure_dir(os.path.join(RAW, 'steamspy_tag'))
    log = Logger(os.path.join(RAW, 'logs', 'steamspy_tag.log'))
    meta = {}
    for t in TAGS:
        fn = os.path.join(d, t.replace(' ', '_') + '.json')
        if os.path.exists(fn) and os.path.getsize(fn) > 2:
            try:
                n = len(json.load(open(fn, encoding='utf-8')))
                meta[t] = {'n': n, 'cached': True}
                continue
            except Exception:
                pass
        url = 'https://steamspy.com/api.php?request=tag&tag=' + urllib.parse.quote_plus(t)
        r = http_get(url, accept='application/json', cookies=None, retries=3, backoff=10)
        if r['status'] == 200:
            with open(fn, 'wb') as f:
                f.write(r['body'])
            try:
                n = len(json.loads(r['body'].decode('utf-8')))
            except Exception:
                n = None
        else:
            n = None
        meta[t] = {'n': n, 'status': r['status'], 'at_kst': now_kst_iso(), 'url': url}
        log('steamspy tag %-26s status=%s n=%s' % (t, r['status'], n))
        time.sleep(2.0)
    with open(os.path.join(d, '_meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
