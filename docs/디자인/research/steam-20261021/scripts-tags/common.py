# -*- coding: utf-8 -*-
"""Shared helpers for the Steam life-sim universe crawl (SYNK steam-A).

Only standard library. All raw responses are written under ../raw/.
"""
import gzip
import io
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
RAW = os.path.join(BASE, 'raw')
KST = timezone(timedelta(hours=9))

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')

# Age gate / mature content cookies for store pages and search.
COOKIES = ('birthtime=0; wants_mature_content=1; lastagecheckage=1-0-1990; '
           'mature_content=1; Steam_Language=english')


def now_kst_iso():
    return datetime.now(KST).isoformat(timespec='seconds')


def now_utc_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def ensure_dir(p):
    os.makedirs(p, exist_ok=True)
    return p


def _decode_body(data, enc):
    enc = (enc or '').lower()
    if 'gzip' in enc:
        return gzip.GzipFile(fileobj=io.BytesIO(data)).read()
    if 'deflate' in enc:
        try:
            return zlib.decompress(data)
        except zlib.error:
            return zlib.decompress(data, -zlib.MAX_WBITS)
    return data


def http_get(url, cookies=COOKIES, timeout=40, retries=4, backoff=6.0,
             accept='*/*', log=None):
    """GET with gzip, retries on network errors / 429 / 5xx.

    Returns dict(status, body(bytes), headers(dict), url, tries, error).
    """
    last_err = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(url)
        req.add_header('User-Agent', UA)
        req.add_header('Accept', accept)
        req.add_header('Accept-Language', 'en-US,en;q=0.9')
        req.add_header('Accept-Encoding', 'gzip, deflate')
        if cookies:
            req.add_header('Cookie', cookies)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                body = _decode_body(raw, resp.headers.get('Content-Encoding'))
                return {
                    'status': resp.status,
                    'body': body,
                    'wire_bytes': len(raw),
                    'headers': dict(resp.headers.items()),
                    'url': resp.geturl(),
                    'tries': attempt,
                    'error': None,
                }
        except urllib.error.HTTPError as e:
            code = e.code
            try:
                raw = e.read()
                body = _decode_body(raw, e.headers.get('Content-Encoding'))
            except Exception:
                raw, body = b'', b''
            last_err = 'HTTP %s' % code
            if code in (429, 500, 502, 503, 504, 403) and attempt < retries:
                wait = backoff * attempt * (3 if code in (429, 403) else 1)
                if log:
                    log('  retry %s after %s (%.0fs)' % (url, last_err, wait))
                time.sleep(wait)
                continue
            return {'status': code, 'body': body, 'wire_bytes': len(raw),
                    'headers': dict(e.headers.items()) if e.headers else {},
                    'url': url, 'tries': attempt, 'error': last_err}
        except Exception as e:  # network / timeout
            last_err = '%s: %s' % (type(e).__name__, e)
            if attempt < retries:
                wait = backoff * attempt
                if log:
                    log('  retry %s after %s (%.0fs)' % (url, last_err, wait))
                time.sleep(wait)
                continue
    return {'status': None, 'body': b'', 'wire_bytes': 0, 'headers': {},
            'url': url, 'tries': retries, 'error': last_err}


def wilson_lower(pos, n, z=1.96):
    if not n:
        return None
    p = pos / n
    return (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n)


def write_json(path, obj):
    ensure_dir(os.path.dirname(path))
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def read_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


class Logger:
    def __init__(self, path):
        ensure_dir(os.path.dirname(path))
        self.f = open(path, 'a', encoding='utf-8', newline='\n')

    def __call__(self, msg):
        line = '[%s] %s' % (datetime.now(KST).strftime('%H:%M:%S'), msg)
        self.f.write(line + '\n')
        self.f.flush()
        try:
            print(line, flush=True)
        except Exception:
            pass


# ---------- search results parsing ----------

ROW_RE = re.compile(r'<a\s+href="(?P<href>[^"]+)"\s+(?P<attrs>[^>]*?)class="search_result_row[^"]*"(?P<attrs2>[^>]*)>(?P<inner>.*?)</a>', re.S)
APPID_RE = re.compile(r'data-ds-appid="([^"]+)"')
BUNDLE_RE = re.compile(r'data-ds-bundleid="([^"]+)"')
PKG_RE = re.compile(r'data-ds-packageid="([^"]+)"')
TAGIDS_RE = re.compile(r'data-ds-tagids="\[([^\]]*)\]"')
TITLE_RE = re.compile(r'<span class="title">(.*?)</span>', re.S)
RELEASED_RE = re.compile(r'<div class="search_released[^"]*">(.*?)</div>', re.S)
REVIEW_RE = re.compile(r'class="search_review_summary\s+(?P<cls>[^"]*)"\s+data-tooltip-html="(?P<tip>[^"]*)"', re.S)
PRICE_FINAL_RE = re.compile(r'data-price-final="(\d+)"')
DISCOUNT_FINAL_RE = re.compile(r'<div class="discount_final_price[^"]*">(.*?)</div>', re.S)
TIP_RE = re.compile(r'(?P<pct>\d+)% of the (?P<n>[\d,]+) user reviews', re.S)
TIP_LABEL_RE = re.compile(r'^(?P<label>[^<]+)<br>', re.S)


def html_unescape(s):
    import html
    return html.unescape(s)


def parse_search_rows(results_html):
    rows = []
    for m in ROW_RE.finditer(results_html):
        attrs = m.group('attrs') + ' ' + m.group('attrs2')
        inner = m.group('inner')
        href = m.group('href')
        appid = APPID_RE.search(attrs)
        bundle = BUNDLE_RE.search(attrs)
        pkg = PKG_RE.search(attrs)
        tagids = TAGIDS_RE.search(attrs)
        title = TITLE_RE.search(inner)
        rel = RELEASED_RE.search(inner)
        rev = REVIEW_RE.search(inner)
        price_final = PRICE_FINAL_RE.search(inner)
        disc_final = DISCOUNT_FINAL_RE.search(inner)
        row = {
            'href': html_unescape(href),
            'appid_raw': appid.group(1) if appid else None,
            'bundleid': bundle.group(1) if bundle else None,
            'packageid': pkg.group(1) if pkg else None,
            'tagids': [int(x) for x in tagids.group(1).split(',') if x.strip()] if tagids else [],
            'name': html_unescape(title.group(1).strip()) if title else None,
            'released': html_unescape(re.sub(r'<[^>]+>', '', rel.group(1)).strip()) if rel else None,
            'review_class': rev.group('cls').strip() if rev else None,
            'review_tip': html_unescape(rev.group('tip')) if rev else None,
            'price_final_cents': int(price_final.group(1)) if price_final else None,
            'price_text': html_unescape(re.sub(r'<[^>]+>', ' ', disc_final.group(1))).strip() if disc_final else None,
        }
        tip = row['review_tip'] or ''
        t = TIP_RE.search(tip.replace(' ', ' '))
        if t:
            row['search_pct'] = int(t.group('pct'))
            row['search_n'] = int(t.group('n').replace(',', ''))
        else:
            row['search_pct'] = None
            row['search_n'] = None
        lab = TIP_LABEL_RE.search(tip)
        row['search_label'] = lab.group('label').strip() if lab else None
        rows.append(row)
    return rows
