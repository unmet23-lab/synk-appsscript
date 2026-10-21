# -*- coding: utf-8 -*-
"""Parse a Steam store app page (English) into a compact dict."""
import html as htmlmod
import json
import re

SUMROW_RE = re.compile(r'<a class="user_reviews_summary_row"(?P<attrs>[^>]*)>(?P<inner>.*?)</a>', re.S)
TIPATTR_RE = re.compile(r'data-tooltip-html="(?P<tip>[^"]*)"')
SUBTITLE_RE = re.compile(r'<div class="subtitle column[^"]*">(.*?)</div>', re.S)
SUMMARY_LABEL_RE = re.compile(r'<span class="game_review_summary[^"]*"[^>]*>(.*?)</span>', re.S)
COUNT_RE = re.compile(r'\(([\d,]+)\)')
TIP_RECENT_RE = re.compile(r'(?P<pct>\d+)% of the (?P<n>[\d,]+) user reviews in the last 30 days are positive')
TIP_ALL_RE = re.compile(r'(?P<pct>\d+)% of the (?P<n>[\d,]+) user reviews (?:for this game|in your language) are positive')
TAGMODAL_RE = re.compile(r'InitAppTagModal\(\s*\d+,\s*(\[.*?\])\s*,', re.S)
APPTAG_RE = re.compile(r'<a[^>]*class="app_tag"[^>]*>\s*(.*?)\s*</a>', re.S)
RELEASE_RE = re.compile(r'<div class="release_date">.*?<div class="date">(.*?)</div>', re.S)
DEV_RE = re.compile(r'<div class="dev_row">\s*<div class="subtitle column">Developer:</div>\s*<div class="summary column" id="developers_list">(.*?)</div>', re.S)
PUB_RE = re.compile(r'<div class="subtitle column">Publisher:</div>\s*<div class="summary column">(.*?)</div>', re.S)
SNIPPET_RE = re.compile(r'<div class="game_description_snippet">(.*?)</div>', re.S)
EA_RE = re.compile(r'class="early_access_header"|<h1 class="inset">Early Access Game</h1>|This game is in Early Access|Early Access Game', re.S)
GENRE_BLOCK_RE = re.compile(r'<b>Genre:</b>(.*?)<br>', re.S)
LANG_TABLE_RE = re.compile(r'<table\s+class="game_language_options"[^>]*>(.*?)</table>', re.S)
LANG_ROW_RE = re.compile(r'<tr[^>]*>\s*<td[^>]*class="ellipsis"[^>]*>\s*(?P<name>.*?)\s*</td>(?P<cells>.*?)</tr>', re.S)
CELL_RE = re.compile(r'<td[^>]*class="checkcol"[^>]*>(.*?)</td>', re.S)
PRICE_RE = re.compile(r'<div class="game_purchase_price price"[^>]*data-price-final="(\d+)"[^>]*>\s*(.*?)\s*</div>', re.S)
DISC_RE = re.compile(r'<div class="discount_final_price"[^>]*>(.*?)</div>', re.S)
TITLE_RE = re.compile(r'<div id="appHubAppName" class="apphub_AppName"[^>]*>(.*?)</div>', re.S)
AGEGATE_RE = re.compile(r'agegate_birthday_selector|id="app_agegate"', re.S)
NOREVIEWS_RE = re.compile(r'No user reviews', re.S)


def strip_tags(s):
    return htmlmod.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def parse_store(html_text):
    out = {}
    out['agegate'] = bool(AGEGATE_RE.search(html_text)) and 'InitAppTagModal' not in html_text
    t = TITLE_RE.search(html_text)
    out['title'] = strip_tags(t.group(1)) if t else None
    rows = []
    for m in SUMROW_RE.finditer(html_text):
        ta = TIPATTR_RE.search(m.group('attrs'))
        tip = htmlmod.unescape(ta.group('tip')) if ta else ''
        inner = m.group('inner')
        sub = SUBTITLE_RE.search(inner)
        lab = SUMMARY_LABEL_RE.search(inner)
        cnt = COUNT_RE.search(strip_tags(inner))
        rows.append({'subtitle': strip_tags(sub.group(1)) if sub else None,
                     'label': strip_tags(lab.group(1)) if lab else None,
                     'count_paren': int(cnt.group(1).replace(',', '')) if cnt else None,
                     'tip': tip})
    out['summary_rows'] = rows
    recent = None
    allr = None
    for r in rows:
        tip = (r['tip'] or '').replace(' ', ' ')
        mr = TIP_RECENT_RE.search(tip)
        ma = TIP_ALL_RE.search(tip)
        sub = (r['subtitle'] or '').lower()
        if mr and recent is None:
            recent = {'pct': int(mr.group('pct')), 'n': int(mr.group('n').replace(',', '')), 'label': r['label'], 'subtitle': r['subtitle']}
        elif ma and allr is None:
            allr = {'pct': int(ma.group('pct')), 'n': int(ma.group('n').replace(',', '')), 'label': r['label'], 'subtitle': r['subtitle'], 'tip': r['tip']}
        elif 'recent' in sub and recent is None:
            recent = {'pct': None, 'n': r['count_paren'], 'label': r['label'], 'subtitle': r['subtitle'], 'tip': r['tip']}
    out['recent'] = recent
    out['all_display'] = allr
    tm = TAGMODAL_RE.search(html_text)
    tags = None
    if tm:
        try:
            tags = json.loads(tm.group(1))
        except Exception:
            tags = None
    if tags is not None:
        out['tags'] = [{'tagid': x.get('tagid'), 'name': x.get('name'), 'count': x.get('count')} for x in tags]
    else:
        out['tags'] = [{'tagid': None, 'name': strip_tags(x), 'count': None} for x in APPTAG_RE.findall(html_text)]
    rd = RELEASE_RE.search(html_text)
    out['release_date'] = strip_tags(rd.group(1)) if rd else None
    dv = DEV_RE.search(html_text)
    out['developers'] = strip_tags(dv.group(1)) if dv else None
    pb = PUB_RE.search(html_text)
    out['publishers'] = strip_tags(pb.group(1)) if pb else None
    sn = SNIPPET_RE.search(html_text)
    out['snippet'] = strip_tags(sn.group(1)) if sn else None
    out['early_access_marker'] = bool(EA_RE.search(html_text))
    gb = GENRE_BLOCK_RE.search(html_text)
    out['genres'] = [strip_tags(x) for x in re.findall(r'<a[^>]*>(.*?)</a>', gb.group(1))] if gb else []
    langs = {}
    lt = LANG_TABLE_RE.search(html_text)
    if lt:
        for lr in LANG_ROW_RE.finditer(lt.group(1)):
            name = strip_tags(lr.group('name'))
            cells = CELL_RE.findall(lr.group('cells'))
            flags = ['&#10004;' in c or '✔' in c or 'check' in c for c in cells]
            langs[name] = flags  # [interface, full audio, subtitles]
    out['languages'] = langs
    pr = PRICE_RE.search(html_text)
    if pr:
        out['price_final'] = int(pr.group(1))
        out['price_text'] = strip_tags(pr.group(2))
    else:
        d = DISC_RE.search(html_text)
        out['price_final'] = None
        out['price_text'] = strip_tags(d.group(1)) if d else None
    return out
