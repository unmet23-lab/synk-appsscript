# -*- coding: utf-8 -*-
"""Build ranked tables from steam_life_universe.json (shared by report + checks)."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE  # noqa: E402

OLD_TOP10 = [413150, 433340, 2142790, 2133760, 972660, 1657630, 2495100, 2418520, 2508780, 1245560]
OLD_1008 = {  # appid: (positive, total, wilson, rank) from docs/디자인/research/steam-life-20261008.json
    413150: (884544, 897795, 0.984988976761508, 1), 433340: (137236, 139994, 0.9795578806477264, 2),
    2142790: (31759, 32772, 0.9671599173880124, 3), 2133760: (6769, 7050, 0.9553190708182551, 4),
    972660: (44887, 47306, 0.9468431377521432, 5), 1657630: (41458, 43885, 0.9425186227710092, 6),
    2495100: (9070, 9721, 0.9278893890767269, 7), 2418520: (4200, 4493, 0.9271899988979441, 8),
    2508780: (2965, 3167, 0.9271666681664207, 9), 1245560: (3539, 3791, 0.9251499112893343, 10),
    894940: (5664, 6085, 0.9241615969444721, 11), 2195120: (2333, 2502, 0.9219423596436664, 12),
    1062520: (22787, 24667, 0.9204070824632227, 13), 666140: (31883, 34854, 0.9117811808776078, 14),
    2993780: (10750, 11777, 0.9075649941238545, 15), 1118520: (18227, 20347, 0.8915348613386959, 16),
    1158160: (19572, 21934, 0.8881419991589116, 17), 1458100: (6704, 7516, 0.8847443850334071, 18),
    1084600: (21285, 24160, 0.8768580804762562, 19), 1139980: (14597, 16606, 0.8739717848004867, 20),
    1222670: (71190, 83367, 0.8515212793809973, 21), 1432860: (17708, 22161, 0.7937340464923608, 22),
    2456740: (23565, 30289, 0.7732897975540737, 23), 2707930: (57, 59, 0.8845621301839242, None),
}


def load():
    j = json.load(open(os.path.join(BASE, 'steam_life_universe.json'), encoding='utf-8'))
    return j['meta'], j['apps']


def overall(apps, k=40, min_n=1000):
    rows = [r for r in apps if r.get('rank_life') and (r.get('metric_total') or 0) >= min_n]
    rows.sort(key=lambda r: -r['metric_wilson'])
    return rows[:k]


def overall_hidden(apps, k=40, min_n=1000):
    """Games that would sit inside the overall top-k but were held out (adult / peripheral tags)."""
    top = overall(apps, k, min_n)
    cutoff = top[-1]['metric_wilson'] if top else 1
    adult, peri = [], []
    for r in apps:
        if not r.get('in_main') or (r.get('metric_total') or 0) < min_n or r['metric_wilson'] < cutoff:
            continue
        if r.get('rank_life'):
            continue
        if r.get('adult'):
            adult.append(r)
        elif r.get('relevance_life') == 'peripheral':
            peri.append(r)
    adult.sort(key=lambda r: -r['metric_wilson'])
    peri.sort(key=lambda r: -r['metric_wilson'])
    return adult, peri


def by_scale(apps, k=20):
    rows = [r for r in apps if r.get('rank_life') and r.get('metric_total')]
    rows.sort(key=lambda r: -r['metric_total'])
    return rows[:k]


def recent_releases(apps, since='2025-01-01', k=20, min_n=500):
    rows = [r for r in apps if r.get('rank_life') and (r.get('metric_total') or 0) >= min_n
            and r.get('release_iso') and r['release_iso'] >= since]
    rows.sort(key=lambda r: -r['metric_total'])
    return rows[:k]


def recent_releases_wilson(apps, since='2025-01-01', k=10, min_n=1000):
    rows = [r for r in apps if r.get('rank_life') and (r.get('metric_total') or 0) >= min_n
            and r.get('release_iso') and r['release_iso'] >= since]
    rows.sort(key=lambda r: -r['metric_wilson'])
    return rows[:k]


def matched_cum_ratio(r):
    """Cumulative ratio on the store display basis (= basis of the Recent Reviews line):
    Steam purchasers for paid games, all reviews for free games."""
    if r.get('is_free'):
        return r.get('metric_ratio'), 'all'
    if r.get('steam_ratio') is not None:
        return r.get('steam_ratio'), 'steam'
    return r.get('metric_ratio'), ('all*' if r.get('metric_basis') == 'all' else 'display')


def recent_shift(apps, min_recent=50, min_n=1000, thr=0.10):
    up, down = [], []
    for r in apps:
        if not (r.get('rank_life') or r.get('rank_lang')):
            continue
        if (r.get('metric_total') or 0) < min_n or r.get('recent_pct') is None or (r.get('recent_n') or 0) < min_recent:
            continue
        cr, basis = matched_cum_ratio(r)
        if cr is None:
            continue
        d = r['recent_pct'] / 100.0 - cr
        r['_shift'] = d
        r['_shift_basis'] = basis
        if d >= thr:
            up.append(r)
        elif d <= -thr:
            down.append(r)
    up.sort(key=lambda r: -r['_shift'])
    down.sort(key=lambda r: r['_shift'])
    return up, down


def segment_rows(apps, seg):
    return [r for r in apps if seg in (r.get('segments') or [])]


def segment_table(apps, seg, k=8, min_n=1000, fallback_min=500):
    pool = segment_rows(apps, seg)
    rows = [r for r in pool if (r.get('metric_total') or 0) >= min_n]
    used_min = min_n
    if len(rows) < 5 and fallback_min < min_n:
        rows = [r for r in pool if (r.get('metric_total') or 0) >= fallback_min]
        used_min = fallback_min
    rows.sort(key=lambda r: -r['metric_wilson'])
    return rows[:k], used_min, len(pool)


def steam_basis_rank(apps, k=10, min_n=1000):
    rows = [r for r in apps if r.get('rank_life') and (r.get('steam_total') or 0) >= min_n]
    rows.sort(key=lambda r: -r['steam_wilson'])
    return rows[:k], rows
