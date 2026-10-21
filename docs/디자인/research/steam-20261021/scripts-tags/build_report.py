# -*- coding: utf-8 -*-
"""Fill report_template.md placeholders ({{NAME}}) from report_tables.md sections + report_stats.json.

python build_report.py -> report.md
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE  # noqa: E402
import tables as T  # noqa: E402


def num(x):
    return '{:,}'.format(int(x)) if x is not None else '—'


def sections():
    t = open(os.path.join(BASE, 'report_tables.md'), encoding='utf-8').read()
    out = {}
    for part in re.split(r'\n(?=## )', t):
        if not part.startswith('## '):
            continue
        head, _, body = part.partition('\n')
        key = head[3:].split(' ')[0]
        if key == 'T_SEG':
            key = 'T_SEG_' + head.split(' ')[2]
        out[key] = body.strip()
        out[key + '_HEAD'] = head[3:]
    return out


def qtable(S, layers):
    rows = [q for q in S['queries'] if q['layer'] in layers]
    head = '| 질의 | 태그(id) | 점수 있는 게임 (Reviews_DESC) | 출시작 전체 (Released_DESC) | 미출시 포함 전체 (관련도 정렬) | 한국 기본 노출·점수 있음 |'
    out = [head, '|---|---|---:|---:|---:|---:|']
    for q in rows:
        out.append('| %s | %s | %s | %s | %s | %s |' % (
            q['name'].replace(' AND ', ' ∩ '), q['tags'], num(q['scored_total']),
            num(q['released_total']), num(q['relevance_total']), num(q['kr_default_scored'])))
    return '\n'.join(out)


def compare_table(S):
    out = ['| 10-08 순서 | 게임 | 10-08 Steam 구매 경로 전체 / 하한 | 10-21 상점 표시 기준 전체(≈Steam 구매) / 긍정률 | 10-21 전체 경로 전체 / 하한 | 이번 생활형 1,000개 이상 순위 | 최근 30일 |',
           '|---:|---|---:|---:|---:|---:|---:|']
    for c in S['compare_1008']:
        if not c.get('in_universe'):
            out.append('| — | %s | — | — | — | 태그 범위 밖 | — |' % c['appid'])
            continue
        old_rank = c['old_rank'] if c['old_rank'] else '제외(59개)'
        nr = c['new_rank']
        if nr is None:
            nr = '순위 밖(%s)' % {'adjacent_weak': '약한 인접', 'peripheral': '주변'}.get(c['relevance'], c['relevance'])
        rec = ('%d%% (%s)' % (c['recent_pct'], num(c['recent_n']))) if c.get('recent_pct') is not None else '—'
        out.append('| %s | %s%s | %s / %.2f%% | %s / %s%% | %s / %s | %s | %s |' % (
            old_rank, c['name'], ' (EA)' if c.get('early_access') else '',
            num(c['old_total']), 100 * c['old_wilson'], num(c['display_n']), c['display_pct'],
            num(c['all_total']), ('%.2f%%' % (100 * c['all_wilson'])) if c.get('all_wilson') else '—', nr, rec))
    return '\n'.join(out)


def store_fail_list(S, meta_apps):
    names = {str(r['appid']): r['name'] for r in meta_apps}
    ids = S['store_pages']['fail_appids']
    return ', '.join('%s(%s)' % (names.get(a, '?'), a) for a in ids)


def main():
    S = json.load(open(os.path.join(BASE, 'report_stats.json'), encoding='utf-8'))
    meta, apps = T.load()
    sec = sections()
    vals = dict(sec)
    vals['Q_U1'] = qtable(S, {'U1'})
    vals['Q_U2'] = qtable(S, {'U2'})
    vals['Q_L'] = qtable(S, {'L', 'L2'})
    vals['Q_X'] = qtable(S, {'X'})
    vals['COMPARE_1008'] = compare_table(S)
    vals['STORE_FAILS'] = store_fail_list(S, apps)
    for k, v in S.items():
        if isinstance(v, (int, float, str)):
            vals['S_' + k] = num(v) if isinstance(v, int) else str(v)
    tpl = open(os.path.join(BASE, 'report_template.md'), encoding='utf-8').read()
    missing = set()

    def rep(m):
        k = m.group(1)
        if k in vals:
            return vals[k]
        missing.add(k)
        return m.group(0)
    out = re.sub(r'\{\{([A-Za-z0-9_]+)\}\}', rep, tpl)
    with open(os.path.join(BASE, 'report.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    print('report.md written,', len(out), 'chars; missing placeholders:', sorted(missing))


if __name__ == '__main__':
    main()
