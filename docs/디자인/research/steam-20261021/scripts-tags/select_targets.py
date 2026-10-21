# -*- coding: utf-8 -*-
"""Merge search passes into one app table and write fetch target lists.

Stage 1 (after search):   python select_targets.py search
  -> raw/merged_search.json, lists/reviews_all.txt
Stage 2 (after reviews):  python select_targets.py final
  -> lists/final.txt (main>=500 U1/U2, lang>=100 L/L2), lists/ge1000.txt,
     lists/reviews_steam.txt (>=1000 + 10-08 candidates)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE, RAW, ensure_dir, read_json, write_json, now_kst_iso  # noqa: E402
from queries import QUERIES  # noqa: E402

LISTS = ensure_dir(os.path.join(BASE, 'lists'))
LAYER_OF = {q[0]: q[2] for q in QUERIES}
LAYER_RANK = {'U1': 0, 'U2': 1, 'L': 2, 'L2': 3, 'X': 4}
OLD_1008 = [413150, 433340, 2142790, 2133760, 972660, 1657630, 2495100, 2418520, 2508780, 1245560,
            894940, 2195120, 1062520, 666140, 2993780, 1118520, 1158160, 1458100, 2707930, 1084600,
            1139980, 1222670, 1432860, 2456740]


def merge_search():
    apps = {}
    per_query = {}
    for p in ('A', 'B', 'C'):
        pdir = os.path.join(RAW, 'search', p)
        if not os.path.isdir(pdir):
            continue
        for fn in sorted(os.listdir(pdir)):
            if not fn.endswith('.json'):
                continue
            d = read_json(os.path.join(pdir, fn))
            qid = d['qid']
            per_query.setdefault(qid, {})[p] = {k: d.get(k) for k in (
                'tags', 'sort', 'extra', 'total_count', 'pages', 'unique_apps', 'rows_seen', 'skipped_non_app',
                'failures', 'complete', 'started_utc', 'finished_utc', 'finished_kst')}
            for a, row in d['rows'].items():
                e = apps.setdefault(a, {'appid': int(a), 'name': row.get('name'), 'queries': {}, 'search': {}})
                e['queries'].setdefault(qid, []).append(p)
                s = e['search'].setdefault(p, {})
                if not s:
                    s.update({k: row.get(k) for k in ('name', 'released', 'search_label', 'search_pct', 'search_n',
                                                       'price_final_cents', 'price_text', 'tagids', 'review_class')})
                    s['first_pos_%s' % qid] = row.get('first_pos')
                if p == 'A' and row.get('name'):
                    e['name'] = row.get('name')
    for a, e in apps.items():
        layers = sorted({LAYER_OF[q] for q in e['queries']}, key=lambda x: LAYER_RANK[x])
        e['layers'] = layers
        e['in_scored_maxvis'] = any('A' in v for v in e['queries'].values())
        e['in_scored_krdefault'] = any('B' in v for v in e['queries'].values())
        e['in_released_maxvis'] = any('C' in v for v in e['queries'].values())
    out = {'built_kst': now_kst_iso(), 'n_apps': len(apps), 'per_query': per_query, 'apps': apps}
    write_json(os.path.join(RAW, 'merged_search.json'), out)
    return out


def stage_search():
    m = merge_search()
    apps = m['apps']
    scored = [a for a, e in apps.items() if e['in_scored_maxvis'] or e['in_scored_krdefault']]
    unscored = [a for a, e in apps.items() if not (e['in_scored_maxvis'] or e['in_scored_krdefault'])]
    allapps = sorted(set(scored) | set(unscored) | {str(x) for x in OLD_1008}, key=int)
    with open(os.path.join(LISTS, 'reviews_all.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(allapps) + '\n')
    by_layer = {}
    for a, e in apps.items():
        by_layer.setdefault(e['layers'][0], 0)
        by_layer[e['layers'][0]] += 1
    print('apps', len(apps), 'scored', len(scored), 'unscored(released only)', len(unscored), 'by first layer', by_layer)
    print('reviews_all targets', len(allapps))


def stage_final():
    m = read_json(os.path.join(RAW, 'merged_search.json'))
    apps = m['apps']
    idx = {}
    path = os.path.join(RAW, 'reviews_all', '_index.jsonl')
    with open(path, encoding='utf-8') as f:
        for line in f:
            d = json.loads(line)
            idx[str(d['appid'])] = d
    main, lang, ge1000 = [], [], []
    for a, e in apps.items():
        q = (idx.get(a) or {}).get('query_summary') or {}
        n = q.get('total_reviews') or 0
        layers = e['layers']
        if any(l in ('U1', 'U2') for l in layers) and n >= 500:
            main.append(a)
        if any(l in ('L', 'L2') for l in layers) and n >= 100:
            lang.append(a)
        if n >= 1000:
            ge1000.append(a)
    final = sorted(set(main) | set(lang) | {str(x) for x in OLD_1008}, key=int)
    with open(os.path.join(LISTS, 'final.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(final) + '\n')
    steam = sorted(set(a for a in ge1000 if a in set(final)) | {str(x) for x in OLD_1008}, key=int)
    with open(os.path.join(LISTS, 'reviews_steam.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(steam) + '\n')
    print('main>=500', len(main), 'lang>=100', len(lang), 'final', len(final), 'ge1000(all apps)', len(ge1000), 'reviews_steam', len(steam))


def load_sb(cc='us'):
    path = os.path.join(RAW, 'storebrowse_%s' % cc, '_items.jsonl')
    sb = {}
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            for line in f:
                d = json.loads(line)
                if d.get('item') or str(d['appid']) not in sb:
                    sb[str(d['appid'])] = d.get('item')
    return sb


def sb_count(it):
    if not it:
        return None
    rv = (it.get('reviews') or {}).get('summary_filtered') or {}
    return rv.get('review_count')


def stage_sb():
    """Choose appreviews targets from GetItems display-basis counts."""
    import random
    m = merge_search()
    apps = m['apps']
    sb = load_sb('us')
    main_t, lang_t, nosb, sample_pool = [], [], [], []
    for a, e in apps.items():
        it = sb.get(a)
        c = sb_count(it)
        layers = e['layers']
        if it is None:
            nosb.append(a)
            continue
        c = c or 0
        if any(l in ('U1', 'U2', 'X') for l in layers) and c >= 100:
            main_t.append(a)
        elif any(l in ('L', 'L2') for l in layers) and c >= 20:
            lang_t.append(a)
        elif c < 10:
            sample_pool.append(a)
    random.seed(20261021)
    sample = random.sample(sample_pool, min(200, len(sample_pool)))
    targets = set(main_t) | set(lang_t) | set(nosb) | set(sample) | {str(x) for x in OLD_1008}
    # most-reviewed first, so a cut-off (if ever needed) only drops the boundary tail
    targets = sorted(targets, key=lambda a: (-(sb_count(sb.get(a)) or 0), int(a)))
    with open(os.path.join(LISTS, 'reviews_all.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(targets) + '\n')
    with open(os.path.join(LISTS, 'reviews_all_sample_unscored.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(sorted(sample, key=int)) + '\n')
    print('apps', len(apps), 'sb items', sum(1 for v in sb.values() if v), 'main(sb>=100)', len(main_t), 'lang(sb>=20)', len(lang_t),
          'no sb item', len(nosb), 'pool(<10)', len(sample_pool), 'sample', len(sample), 'targets', len(targets))


if __name__ == '__main__':
    {'search': stage_search, 'final': stage_final, 'sb': stage_sb}[sys.argv[1]]()
