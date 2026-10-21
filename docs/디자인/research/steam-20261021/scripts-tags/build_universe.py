# -*- coding: utf-8 -*-
"""Merge search + GetItems + appreviews + store page + histogram + SteamSpy (+appdetails sample)
into steam_life_universe.json, steam_life_universe.csv (main>=500 / lang>=100) and _all.csv.
"""
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE, RAW, read_json, wilson_lower, write_json, now_kst_iso  # noqa: E402
from queries import QUERIES  # noqa: E402
from segments import classify, adult_flag, relevance  # noqa: E402

QNAME = {q[0]: q[3] for q in QUERIES}
OLD_TOP10 = [413150, 433340, 2142790, 2133760, 972660, 1657630, 2495100, 2418520, 2508780, 1245560]
OLD_24 = OLD_TOP10 + [894940, 2195120, 1062520, 666140, 2993780, 1118520, 1158160, 1458100, 2707930, 1084600,
                      1139980, 1222670, 1432860, 2456740]
SPY_BAD_TAGS = {'Decorating', 'Organizing', 'Cleaning', 'Desktop Companion', 'Dogs', 'Animals', 'Foxes',
                'Capybaras', 'Wolves', 'Zoo', 'Base Building', 'Incremental', 'Language Learning', 'Shop Keeper'}
KOREAN = 4


def load_jsonl_index(path, key='appid', prefer_ok=True):
    idx = {}
    if not os.path.exists(path):
        return idx
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            k = str(d[key])
            prev = idx.get(k)
            if prev_ok(prev) and not prev_ok(d):
                continue
            idx[k] = d
    return idx


def prev_ok(d):
    if not d:
        return False
    if 'ok' in d:
        return bool(d.get('ok'))
    return d.get('item') is not None


def load_raw_json(kind, appid):
    p = os.path.join(RAW, kind, '%s.json' % appid)
    if not os.path.exists(p):
        return None
    try:
        with open(p, 'rb') as f:
            return json.loads(f.read().decode('utf-8'))
    except Exception:
        return None


def tag_names():
    j = read_json(os.path.join(RAW, 'tag_list_api.json'), {}) or {}
    m = {t['tagid']: t['name'] for t in (j.get('response') or {}).get('tags') or []}
    for t in read_json(os.path.join(RAW, 'populartags_english.json'), []) or []:
        m.setdefault(t['tagid'], t['name'])
    return m


def steamspy_tag_owners():
    d = os.path.join(RAW, 'steamspy_tag')
    out = {}
    if not os.path.isdir(d):
        return out
    for fn in os.listdir(d):
        if not fn.endswith('.json') or fn.startswith('_'):
            continue
        tag = fn[:-5].replace('_', ' ')
        if tag in SPY_BAD_TAGS:
            continue
        try:
            j = json.load(open(os.path.join(d, fn), encoding='utf-8'))
        except Exception:
            continue
        if not isinstance(j, dict) or len(j) == 70:
            continue
        for a, v in j.items():
            if isinstance(v, dict) and v.get('owners'):
                out.setdefault(str(a), v)
    return out


def parse_appdetails(j, appid):
    if not j:
        return None
    node = j.get(str(appid)) or {}
    if not node.get('success'):
        return {'success': False}
    d = node.get('data') or {}
    langs = d.get('supported_languages') or ''
    plain = re.sub(r'<[^>]+>', '', langs)
    m = re.search(r'Korean(<strong>\*</strong>)?', langs)
    genres = [g.get('description') for g in (d.get('genres') or [])]
    genre_ids = [str(g.get('id')) for g in (d.get('genres') or [])]
    po = d.get('price_overview') or {}
    return {
        'success': True, 'type': d.get('type'), 'is_free': d.get('is_free'),
        'short_description': d.get('short_description'),
        'korean_listed': 'Korean' in plain, 'korean_full_audio': bool(m and m.group(1)),
        'release_date': (d.get('release_date') or {}).get('date'),
        'coming_soon': (d.get('release_date') or {}).get('coming_soon'),
        'genres': genres, 'early_access_genre': '70' in genre_ids,
        'price_currency': po.get('currency'), 'price_final': po.get('final'),
        'content_descriptor_ids': (d.get('content_descriptors') or {}).get('ids') or [],
    }


def owners_mid(s):
    if not s:
        return None
    m = re.match(r'^\s*([\d,]+)\s*\.\.\s*([\d,]+)\s*$', s)
    if not m:
        return None
    return (int(m.group(1).replace(',', '')) + int(m.group(2).replace(',', ''))) / 2


def unix_to_date(ts):
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime('%Y-%m-%d')


def main():
    merged = read_json(os.path.join(RAW, 'merged_search.json'))
    apps = merged['apps']
    tn = tag_names()
    sb_us = load_jsonl_index(os.path.join(RAW, 'storebrowse_us', '_items.jsonl'))
    sb_kr = load_jsonl_index(os.path.join(RAW, 'storebrowse_kr', '_items.jsonl'))
    rv_all = load_jsonl_index(os.path.join(RAW, 'reviews_all', '_index.jsonl'))
    rv_api = load_jsonl_index(os.path.join(RAW, 'api_all', '_index.jsonl'))
    rv_steam = load_jsonl_index(os.path.join(RAW, 'reviews_steam', '_index.jsonl'))
    store = load_jsonl_index(os.path.join(RAW, 'store', '_index.jsonl'))
    hist = load_jsonl_index(os.path.join(RAW, 'hist', '_index.jsonl'))
    ad_idx = load_jsonl_index(os.path.join(RAW, 'appdetails', '_index.jsonl'))
    spy_idx = load_jsonl_index(os.path.join(RAW, 'steamspy', '_index.jsonl'))
    spy_tag = steamspy_tag_owners()
    out = []
    for a, e in apps.items():
        layers = [l for l in e['layers'] if l != 'X'] or ['U1']
        rec = {'appid': int(a), 'name': e.get('name'), 'layers': layers,
               'source_queries': sorted(e['queries'].keys()),
               'in_scored_maxvis': e['in_scored_maxvis'], 'in_released_maxvis': e['in_released_maxvis']}
        sA = e['search'].get('A') or e['search'].get('C') or {}
        rec['search_released'] = sA.get('released')
        rec['search_kst'] = None
        # ---- GetItems (US)
        it = (sb_us.get(a) or {}).get('item') or {}
        rec['sb_ok'] = bool(it)
        rec['sb_fetched_kst'] = it.get('_fetched_kst')
        if it.get('name'):
            rec['name'] = it['name']
        rel = it.get('release') or {}
        rec['release_iso'] = unix_to_date(rel.get('steam_release_date') or rel.get('original_release_date'))
        rec['early_access'] = bool(it.get('is_early_access') or rel.get('is_early_access')) if it else None
        rec['is_free'] = bool(it.get('is_free')) if it else None
        tags = [{'tagid': t.get('tagid'), 'name': tn.get(t.get('tagid'), str(t.get('tagid'))), 'weight': t.get('weight')}
                for t in (it.get('tags') or [])]
        tags.sort(key=lambda t: -(t['weight'] or 0))
        rec['tags'] = tags
        rec['top_tags'] = [t['name'] for t in tags[:10]]
        rv = (it.get('reviews') or {})
        sf = rv.get('summary_filtered') or {}
        sl = rv.get('summary_language_specific') or {}
        rec['display_all_n'] = sf.get('review_count')
        rec['display_all_pct'] = sf.get('percent_positive')
        rec['display_all_label'] = sf.get('review_score_label')
        rec['display_en_n'] = sl.get('review_count')
        bi = it.get('basic_info') or {}
        rec['short_description'] = bi.get('short_description')
        rec['developers'] = ', '.join(x.get('name') for x in (bi.get('developers') or []) if x.get('name')) or None
        rec['publishers'] = ', '.join(x.get('name') for x in (bi.get('publishers') or []) if x.get('name')) or None
        ko = None
        for l in it.get('supported_languages') or []:
            if l.get('elanguage') == KOREAN:
                ko = l
        rec['korean_interface'] = bool(ko and ko.get('supported')) if it else None
        rec['korean_audio'] = bool(ko and ko.get('full_audio')) if it else None
        rec['korean_subtitles'] = bool(ko and ko.get('subtitles')) if it else None
        bpo = it.get('best_purchase_option') or {}
        rec['price_usd'] = (int(bpo['final_price_in_cents']) / 100.0) if bpo.get('final_price_in_cents') not in (None, '') else (0.0 if rec['is_free'] else None)
        rec['content_descriptor_ids'] = it.get('content_descriptorids') or []
        itk = (sb_kr.get(a) or {}).get('item') or {}
        bpk = itk.get('best_purchase_option') or {}
        rec['price_krw'] = (int(bpk['final_price_in_cents']) / 100.0) if bpk.get('final_price_in_cents') not in (None, '') else (0.0 if itk.get('is_free') else None)
        rec['kr_visible'] = (bool(itk.get('visible')) and itk.get('success') == 1) if a in sb_kr else None
        # ---- cumulative reviews, purchase_type=all (api host first, then the store-host appreviews run)
        r = rv_api.get(a) or {}
        src = 'api_all' if (r.get('ok') and r.get('query_summary')) else None
        if not src:
            r = rv_all.get(a) or {}
            src = 'store_appreviews' if (r.get('ok') and r.get('query_summary')) else None
        q = (r.get('query_summary') or {}) if src else {}
        n = q.get('total_reviews')
        pos = q.get('total_positive')
        rec['cum_source'] = src
        rec['cum_positive'] = pos
        rec['cum_total'] = n
        rec['cum_ratio'] = (pos / n) if n else None
        rec['cum_wilson'] = wilson_lower(pos, n) if n else None
        rec['cum_score_desc'] = q.get('review_score_desc')
        rec['reviews_fetched_kst'] = r.get('fetched_kst') if src else None
        # metric used for thresholds / ranking: exact purchase_type=all when collected, otherwise the
        # GetItems display basis (all languages; Steam purchasers for paid, everyone for free) as an approximation
        if n:
            rec['metric_basis'] = 'all'
            rec['metric_total'] = n
            rec['metric_ratio'] = rec['cum_ratio']
            rec['metric_wilson'] = rec['cum_wilson']
        elif sf.get('review_count'):
            dn = sf['review_count']
            dp = (sf.get('percent_positive') or 0) / 100.0
            rec['metric_basis'] = 'display_approx'
            rec['metric_total'] = dn
            rec['metric_ratio'] = dp
            rec['metric_wilson'] = wilson_lower(round(dn * dp), dn)
        else:
            rec['metric_basis'] = None
            rec['metric_total'] = None
            rec['metric_ratio'] = None
            rec['metric_wilson'] = None
        n = rec['metric_total']
        rs = rv_steam.get(a) or {}
        qs = rs.get('query_summary') or {}
        rec['steam_positive'] = qs.get('total_positive')
        rec['steam_total'] = qs.get('total_reviews')
        rec['steam_ratio'] = (qs['total_positive'] / qs['total_reviews']) if qs.get('total_reviews') else None
        rec['steam_wilson'] = wilson_lower(qs['total_positive'], qs['total_reviews']) if qs.get('total_reviews') else None
        rec['steam_fetched_kst'] = rs.get('fetched_kst')
        # ---- store page (recent 30 days)
        st = store.get(a) or {}
        p = st.get('parsed') or {}
        rec['store_ok'] = bool(st.get('ok'))
        rec['store_fetched_kst'] = st.get('fetched_kst')
        recent = p.get('recent') or {}
        rec['recent_n'] = recent.get('n')
        rec['recent_pct'] = recent.get('pct')
        rec['recent_label'] = recent.get('label')
        if rec['store_ok'] and not recent:
            rec['recent_note'] = 'store page shows no Recent Reviews row (<10 in 30 days)'
        alld = p.get('all_display') or {}
        rec['store_display_basis'] = (alld.get('subtitle') or '').replace(':', '').strip() or None
        rec['store_display_n'] = alld.get('n')
        rec['store_display_pct'] = alld.get('pct')
        h = hist.get(a) or {}
        rec['hist_recent_up'] = h.get('recent_up')
        rec['hist_recent_down'] = h.get('recent_down')
        rec['hist_fetched_kst'] = h.get('fetched_kst')
        # ---- SteamSpy owners
        sp = None
        if (spy_idx.get(a) or {}).get('ok'):
            sp = load_raw_json('steamspy', a)
        if sp and sp.get('owners'):
            rec['owners'] = sp.get('owners')
            rec['owners_source'] = 'steamspy appdetails'
            rec['steamspy_fetched_kst'] = (spy_idx.get(a) or {}).get('fetched_kst')
            rec['spy_ccu'] = sp.get('ccu')
        elif a in spy_tag:
            rec['owners'] = spy_tag[a].get('owners')
            rec['owners_source'] = 'steamspy tag list'
            rec['steamspy_fetched_kst'] = None
            rec['spy_ccu'] = spy_tag[a].get('ccu')
        else:
            rec['owners'] = None
            rec['owners_source'] = None
            rec['steamspy_fetched_kst'] = None
            rec['spy_ccu'] = None
        rec['owners_mid'] = owners_mid(rec['owners'])
        # ---- appdetails (cross-check sample)
        ad = parse_appdetails(load_raw_json('appdetails', a), a) if (ad_idx.get(a) or {}).get('ok') else None
        rec['appdetails'] = ad
        # ---- derived
        rec['adult'] = adult_flag(rec)
        rv_ = relevance(rec, tn)
        rec['relevance_life'] = rv_['life']
        rec['relevance_life_hits'] = rv_['life_hits']
        rec['relevance_dominated_by'] = rv_['dominated_by']
        rec['tool'] = rv_['tool']
        rec['relevance_lang'] = rv_['lang']
        rec['in_main'] = any(l in ('U1', 'U2') for l in layers) and (n or 0) >= 500
        rec['in_lang'] = any(l in ('L', 'L2') for l in layers) and (n or 0) >= 100
        rec['rank_life'] = rec['in_main'] and rec['relevance_life'] in ('core', 'adjacent') and not rec['adult']
        rec['rank_lang'] = rec['in_lang'] and rec['relevance_lang'] in ('lang_core', 'lang_adjacent') and not rec['adult']
        rec['segments'] = classify(rec) if (rec['rank_life'] or rec['rank_lang']) else []
        out.append(rec)
    out.sort(key=lambda r: (-(r['metric_wilson'] if r['metric_wilson'] is not None else -1), r['appid']))
    meta = {
        'built_kst': now_kst_iso(),
        'n_apps': len(out),
        'n_main': sum(1 for r in out if r['in_main']),
        'n_lang': sum(1 for r in out if r['in_lang']),
        'n_rank_life': sum(1 for r in out if r['rank_life']),
        'n_rank_lang': sum(1 for r in out if r['rank_lang']),
        'per_query': merged['per_query'],
        'search_counts': read_json(os.path.join(RAW, 'search', 'counts.json'), {}),
        'queries': [{'qid': q[0], 'tags': q[1], 'layer': q[2], 'name': q[3]} for q in QUERIES],
    }
    write_json(os.path.join(BASE, 'steam_life_universe.json'), {'meta': meta, 'apps': out})
    cols = ['appid', 'name', 'release_iso', 'early_access', 'is_free', 'layers', 'relevance_life', 'relevance_lang',
            'rank_life', 'rank_lang', 'segments', 'top_tags',
            'cum_positive', 'cum_total', 'cum_ratio', 'cum_wilson', 'cum_source', 'metric_basis', 'metric_total',
            'metric_ratio', 'metric_wilson', 'steam_positive', 'steam_total', 'steam_wilson',
            'recent_n', 'recent_pct', 'hist_recent_up', 'hist_recent_down', 'display_all_n', 'display_all_pct',
            'owners', 'owners_source', 'korean_interface', 'korean_audio', 'korean_subtitles', 'price_usd', 'price_krw',
            'adult', 'source_queries', 'sb_fetched_kst', 'reviews_fetched_kst', 'store_fetched_kst', 'developers',
            'publishers', 'short_description']

    def cell(v):
        if isinstance(v, list):
            return '|'.join(str(x) for x in v)
        if isinstance(v, float):
            return ('%.6f' % v) if abs(v) < 10 else ('%.2f' % v)
        if v is None:
            return ''
        return v

    for fname, cond in (('steam_life_universe.csv', lambda r: r['in_main'] or r['in_lang']),
                        ('steam_life_universe_all.csv', lambda r: True)):
        with open(os.path.join(BASE, fname), 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f)
            w.writerow(cols)
            for r in out:
                if cond(r):
                    w.writerow([cell(r.get(c)) for c in cols])
    print('apps', meta['n_apps'], 'main', meta['n_main'], 'lang', meta['n_lang'])


if __name__ == '__main__':
    main()
