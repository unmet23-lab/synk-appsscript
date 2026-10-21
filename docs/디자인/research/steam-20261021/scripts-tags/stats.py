# -*- coding: utf-8 -*-
"""Collect scope / coverage numbers for report.md (reads local files only)."""
import collections
import gzip
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE, RAW, read_json, wilson_lower  # noqa: E402
from queries import QUERIES  # noqa: E402
import tables as T  # noqa: E402

OLD24 = [413150, 433340, 2142790, 2133760, 972660, 1657630, 2495100, 2418520, 2508780, 1245560,
         894940, 2195120, 1062520, 666140, 2993780, 1118520, 1158160, 1458100, 2707930, 1084600,
         1139980, 1222670, 1432860, 2456740]


def jl(path):
    out = []
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(json.loads(line))
    return out


def main():
    meta, apps = T.load()
    idx = {r['appid']: r for r in apps}
    S = {}
    # ---- search passes
    per = meta['per_query']
    counts = read_json(os.path.join(RAW, 'search', 'counts.json'), {}) or {}
    qrows = []
    pages = collections.Counter()
    for qid, tags, layer, name in QUERIES:
        p = per.get(qid, {})
        a = p.get('A') or {}
        c = p.get('C') or {}
        cn = counts.get(qid) or {}
        pages['A'] += a.get('pages') or 0
        pages['C'] += c.get('pages') or 0
        qrows.append({'qid': qid, 'tags': tags, 'layer': layer, 'name': name,
                      'scored_total': a.get('total_count'), 'scored_unique': a.get('unique_apps'),
                      'scored_skipped': a.get('skipped_non_app'), 'released_total': c.get('total_count') or cn.get('released_maxvis'),
                      'released_unique': c.get('unique_apps'), 'relevance_total': cn.get('relevance_maxvis'),
                      'kr_default_scored': cn.get('reviews_krdefault'), 'pagesA': a.get('pages'), 'pagesC': c.get('pages'),
                      'failA': len(a.get('failures') or []), 'failC': len(c.get('failures') or [])})
    S['queries'] = qrows
    S['pages'] = dict(pages)
    S['n_queries'] = collections.Counter(q[2] for q in QUERIES)
    mism = [q for q in qrows if q['scored_total'] is not None and (q['scored_unique'] or 0) + (q['scored_skipped'] or 0) != q['scored_total']]
    S['mismatch_A'] = [(q['qid'], q['scored_total'], q['scored_unique'], q['scored_skipped']) for q in mism]
    misc = [q for q in qrows if q['released_unique'] is not None and q['released_total'] is not None and q['released_unique'] != q['released_total']]
    S['mismatch_C'] = [(q['qid'], q['released_total'], q['released_unique']) for q in misc]
    S['skipped_non_app_total'] = sum(q['scored_skipped'] or 0 for q in qrows)
    # ---- universe funnel
    n = len(apps)
    S['apps_total'] = n
    S['apps_scored'] = sum(1 for r in apps if r['in_scored_maxvis'])
    S['apps_released_only'] = sum(1 for r in apps if not r['in_scored_maxvis'])
    lay = collections.Counter()
    for r in apps:
        L = set(r['layers'])
        key = 'U1' if 'U1' in L else ('U2' if 'U2' in L else ('L' if 'L' in L else 'L2'))
        lay[key] += 1
    S['apps_by_first_layer'] = dict(lay)
    S['sb_items'] = sum(1 for r in apps if r['sb_ok'])
    S['metric_basis'] = dict(collections.Counter(r['metric_basis'] for r in apps))
    S['main'] = sum(1 for r in apps if r['in_main'])
    S['main_exact'] = sum(1 for r in apps if r['in_main'] and r['metric_basis'] == 'all')
    S['main_approx'] = sum(1 for r in apps if r['in_main'] and r['metric_basis'] == 'display_approx')
    S['lang'] = sum(1 for r in apps if r['in_lang'])
    S['lang_exact'] = sum(1 for r in apps if r['in_lang'] and r['metric_basis'] == 'all')
    S['lang_approx'] = sum(1 for r in apps if r['in_lang'] and r['metric_basis'] == 'display_approx')
    rel = collections.Counter()
    for r in apps:
        if r['in_main']:
            k = 'adult' if r['adult'] else ('tool' if r.get('tool') else r['relevance_life'])
            rel[k] += 1
    S['main_relevance'] = dict(rel)
    S['rank_life'] = sum(1 for r in apps if r['rank_life'])
    S['rank_life_ge1000'] = sum(1 for r in apps if r['rank_life'] and (r['metric_total'] or 0) >= 1000)
    S['rank_lang'] = sum(1 for r in apps if r['rank_lang'])
    rl = collections.Counter()
    for r in apps:
        if r['in_lang']:
            rl['adult' if r['adult'] else r['relevance_lang']] += 1
    S['lang_relevance'] = dict(rl)
    S['dominated_examples'] = [(r['name'], r['relevance_dominated_by']) for r in apps if r['in_main'] and r.get('relevance_dominated_by')][:12]
    S['n_dominated'] = sum(1 for r in apps if r['in_main'] and r.get('relevance_dominated_by'))
    S['n_tool'] = sum(1 for r in apps if r['in_main'] and r.get('tool'))
    S['n_adult_main'] = sum(1 for r in apps if r['in_main'] and r['adult'])
    S['n_adult_all'] = sum(1 for r in apps if r['adult'])
    # ---- fetch logs
    api = jl(os.path.join(RAW, 'api_all', '_index.jsonl'))
    S['api_all'] = {'fetched': len(api), 'ok': sum(1 for x in api if x.get('ok')),
                    'first_kst': min(x['fetched_kst'] for x in api), 'last_kst': max(x['fetched_kst'] for x in api)}
    st = jl(os.path.join(RAW, 'reviews_all', '_index.jsonl'))
    S['store_appreviews'] = {'fetched': len(st), 'ok': sum(1 for x in st if x.get('ok'))}
    sp = jl(os.path.join(RAW, 'store', '_index.jsonl'))
    fails = [x for x in sp if not x.get('ok')]
    reasons = collections.Counter()
    for x in fails:
        u = x.get('final_url') or ''
        title = None
        p = os.path.join(RAW, 'store', '%s.html.gz' % x['appid'])
        if os.path.exists(p):
            try:
                h = gzip.open(p).read().decode('utf-8', 'replace')
                m = re.search(r'<title>(.*?)</title>', h, re.S)
                title = m.group(1).strip() if m else None
            except Exception:
                pass
        if 'login' in u:
            reasons['로그인 요구(성인 전용)'] += 1
        elif 'agecheck' in u:
            reasons['나이 확인 페이지'] += 1
        elif title and 'Site Error' in title:
            reasons['Site Error 페이지'] += 1
        elif u.rstrip('/').endswith('store.steampowered.com'):
            reasons['상점 첫 화면으로 돌려보냄(지역 제한 추정)'] += 1
        else:
            reasons['기타(%s)' % (x.get('status'))] += 1
    S['store_pages'] = {'fetched': len(sp), 'ok': len(sp) - len(fails), 'fail': len(fails), 'fail_reasons': dict(reasons),
                        'with_recent': sum(1 for x in sp if x.get('ok') and (x.get('parsed') or {}).get('recent')),
                        'first_kst': min(x['fetched_kst'] for x in sp), 'last_kst': max(x['fetched_kst'] for x in sp),
                        'fail_appids': [x['appid'] for x in fails]}
    spy = jl(os.path.join(RAW, 'steamspy', '_index.jsonl'))
    S['steamspy_appdetails'] = {'fetched': len(spy), 'ok': sum(1 for x in spy if x.get('ok'))}
    S['steamspy_tag_meta'] = read_json(os.path.join(RAW, 'steamspy_tag', '_meta.json'), {})
    S['owners_coverage_main'] = sum(1 for r in apps if r['in_main'] and r.get('owners'))
    S['owners_inconsistent_main'] = sum(1 for r in apps if r['in_main'] and r.get('owners') and r.get('metric_total')
                                        and int(r['owners'].split('..')[1].strip().replace(',', '')) < r['metric_total'])
    S['recent_coverage_ge1000'] = (sum(1 for r in apps if r['rank_life'] and (r['metric_total'] or 0) >= 1000 and r.get('recent_pct') is not None),
                                   sum(1 for r in apps if r['rank_life'] and (r['metric_total'] or 0) >= 1000))
    sbu = jl(os.path.join(RAW, 'storebrowse_us', '_items.jsonl'))
    sbk = jl(os.path.join(RAW, 'storebrowse_kr', '_items.jsonl'))
    S['storebrowse'] = {'us': len(sbu), 'kr': len(sbk),
                        'us_first': min(x['item']['_fetched_kst'] for x in sbu if x.get('item')),
                        'us_last': max(x['item']['_fetched_kst'] for x in sbu if x.get('item'))}
    S['kr_invisible_main'] = sum(1 for r in apps if r['in_main'] and r.get('kr_visible') is False)
    # ---- ratio all/display among exact rows (prefilter check)
    ratios = []
    for r in apps:
        if r['metric_basis'] == 'all' and r.get('display_all_n') and r['display_all_n'] >= 100:
            ratios.append(r['cum_total'] / r['display_all_n'])
    ratios.sort()
    if ratios:
        S['ratio_all_over_display'] = {'n': len(ratios), 'p50': ratios[len(ratios) // 2], 'p90': ratios[int(len(ratios) * 0.9)],
                                       'p99': ratios[int(len(ratios) * 0.99)], 'max': ratios[-1],
                                       'ge2': sum(1 for x in ratios if x >= 2), 'ge5': sum(1 for x in ratios if x >= 5)}
    # ---- 10-08 comparison
    ranked = sorted([r for r in apps if r['rank_life'] and (r['metric_total'] or 0) >= 1000], key=lambda r: -r['metric_wilson'])
    rank_of = {r['appid']: i + 1 for i, r in enumerate(ranked)}
    comp = []
    for a in OLD24:
        r = idx.get(a)
        o = T.OLD_1008.get(a)
        if not r:
            comp.append({'appid': a, 'in_universe': False})
            continue
        comp.append({'appid': a, 'name': r['name'], 'in_universe': True, 'layers': r['layers'], 'relevance': r['relevance_life'],
                     'old_pos': o[0], 'old_total': o[1], 'old_wilson': o[2], 'old_rank': o[3],
                     'display_n': r.get('display_all_n'), 'display_pct': r.get('display_all_pct'),
                     'all_pos': r.get('cum_positive'), 'all_total': r.get('cum_total'), 'all_wilson': r.get('cum_wilson'),
                     'new_rank': rank_of.get(a), 'recent_pct': r.get('recent_pct'), 'recent_n': r.get('recent_n'),
                     'early_access': r.get('early_access')})
    S['compare_1008'] = comp
    S['n_ranked_ge1000'] = len(ranked)
    with open(os.path.join(BASE, 'report_stats.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(S, f, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in S.items() if k not in ('queries', 'compare_1008')}, ensure_ascii=False, indent=1)[:6000])


if __name__ == '__main__':
    main()
