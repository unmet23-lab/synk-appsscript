#!/usr/bin/env python3
"""Bounded, anonymous reads of public creative sources. No LLM or credentials.

The model can write only work/, so receipts and the run's source inventory live
outside it. A fresh HTTP observation is required before a report can be saved.
"""
from datetime import datetime, timezone
from html.parser import HTMLParser
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import stat
import tempfile
import time
from urllib.parse import parse_qs, urlsplit, urljoin

HOME = Path('/var/lib/synk-argon-77yuhbs')
ROLES = ('full', 'yt-tt', 'meta-brand')
MAX_BODY = 5 * 1024 * 1024


class Refused(Exception):
    pass


def canonical(url):
    if not isinstance(url, str) or len(url) > 2048 or re.search(r'[\s\\\x00-\x1f]', url):
        raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
    u = urlsplit(url)
    if u.scheme != 'https' or u.username or u.password or u.port or u.fragment:
        raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
    host, path, query = u.hostname, u.path, parse_qs(u.query, keep_blank_values=True)
    if any(len(v) != 1 for v in query.values()):
        raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
    video = None
    if host in ('www.youtube.com', 'youtube.com'):
        if path == '/watch' and set(query) == {'v'}:
            video = query['v'][0]
        elif not query and re.fullmatch(r'/(shorts|embed)/[A-Za-z0-9_-]{11}/?', path):
            video = path.split('/')[2]
    elif host == 'youtu.be' and not query:
        video = path.strip('/')
    if video and re.fullmatch(r'[A-Za-z0-9_-]{11}', video):
        return 'https://www.youtube.com/watch?v=' + video
    if host in ('www.instagram.com', 'instagram.com') and not query and re.fullmatch(r'/(p|reel)/[A-Za-z0-9_-]{5,80}/?', path):
        return 'https://www.instagram.com/p/' + path.split('/')[2] + '/'
    if host == 'ads.tiktok.com' and re.fullmatch(r'/business/creativecenter/topads/\d{8,25}/pc/(en|ko)/?', path) and set(query) <= {'countryCode', 'period'}:
        if query.get('countryCode') and not re.fullmatch(r'[A-Z]{2}', query['countryCode'][0]):
            raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
        if query.get('period') and query['period'][0] not in ('7', '30', '180'):
            raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
        return 'https://ads.tiktok.com/business/creativecenter/topads/' + path.split('/')[4] + '/pc/en'
    if host in ('www.facebook.com', 'facebook.com', 'm.facebook.com'):
        if path.rstrip('/') == '/ads/library' and set(query) == {'id'} and re.fullmatch(r'\d{5,30}', query['id'][0]):
            return 'https://www.facebook.com/ads/library/?id=' + query['id'][0]
        if path.rstrip('/') == '/watch' and set(query) == {'v'} and re.fullmatch(r'\d{5,30}', query['v'][0]):
            return 'https://www.facebook.com/reel/' + query['v'][0] + '/'
        if not query and re.fullmatch(r'/(reel/\d{5,30}|[A-Za-z0-9._-]+/(posts|videos)/[A-Za-z0-9_-]{5,120})/?', path):
            video = re.fullmatch(r'/[^/]+/videos/(\d{5,30})/?', path)
            return 'https://www.facebook.com' + ('/reel/' + video[1] if video else path.rstrip('/')) + '/'
    raise Refused('PUBLIC_SOURCE_URL_REQUIRED')


def role_url(role, url):
    if role not in ROLES:
        raise Refused('CREATIVE_ROLE_REQUIRED')
    url = canonical(url)
    video = urlsplit(url).hostname in ('www.youtube.com', 'ads.tiktok.com')
    if role == 'yt-tt' and not video or role == 'meta-brand' and video:
        raise Refused('SOURCE_ROLE_MISMATCH')
    return url


class PublicConnection(http.client.HTTPSConnection):
    def connect(self):
        # Pin the checked address for this connection, including redirects. Never
        # inherit proxy settings or allow a second DNS lookup at connect time.
        addresses = socket.getaddrinfo(self.host, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise Refused('NONPUBLIC_SOURCE_ADDRESS')
        raw = socket.create_connection((addresses[0][4][0], 443), timeout=15)
        try:
            self.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def fetch(url, role):
    original = role_url(role, url)
    current = original
    deadline = time.monotonic() + 45
    for _ in range(4):
        u = urlsplit(current)
        connection = PublicConnection(u.hostname, timeout=15)
        try:
            connection.request('GET', u.path + ('?' + u.query if u.query else ''),
                               headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'identity'})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                target = urljoin(current, response.getheader('Location', ''))
                # Login, consent, off-site and different-content redirects stop.
                if role_url(role, target) != original:
                    raise Refused('SOURCE_REDIRECT_NOT_SAME_CONTENT')
                current = target
                continue
            if response.status != 200:
                raise Refused('SOURCE_HTTP_' + str(response.status))
            if 'text/html' not in response.getheader('Content-Type', ''):
                raise Refused('SOURCE_NOT_HTML')
            chunks, total = [], 0
            while total <= MAX_BODY:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise Refused('SOURCE_FETCH_TIMEOUT')
                if connection.sock:
                    connection.sock.settimeout(min(15, remaining))
                chunk = response.read1(min(65536, MAX_BODY + 1 - total))
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
            body = b''.join(chunks)
            if len(body) > MAX_BODY:
                raise Refused('SOURCE_TOO_LARGE')
            return body
        except http.client.HTTPException as exc:
            raise Refused('SOURCE_FETCH_FAILED') from exc
        finally:
            connection.close()
    raise Refused('SOURCE_REDIRECT_LIMIT')


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}
        self.identities = []

    def handle_starttag(self, tag, attrs):
        a = {key: value or '' for key, value in attrs}
        if tag == 'link' and 'canonical' in a.get('rel', '').lower().split():
            self.meta['canonicalUrl'] = a.get('href', '')[:2048]
            self.identities.append(a.get('href', ''))
        if tag == 'meta' and a.get('property', a.get('name', '')) in ('og:title', 'og:url', 'og:description', 'description', 'article:published_time'):
            self.meta[a.get('property', a.get('name'))] = a.get('content', '')[:12000]
            if a.get('property', a.get('name')) == 'og:url':
                self.identities.append(a.get('content', ''))


def find(value, key):
    if isinstance(value, dict):
        if key in value:
            yield value[key]
        for item in value.values():
            yield from find(item, key)
    elif isinstance(value, list):
        for item in value:
            yield from find(item, key)


def plain(value):
    if not isinstance(value, dict):
        return ''
    return value.get('simpleText') or value.get('content') or ''.join(x.get('text', '') for x in value.get('runs', []) if isinstance(x, dict))


def extract(body, url):
    html = body.decode('utf-8', errors='replace')
    parser = Metadata()
    parser.feed(html)
    meta = parser.meta
    result = {'title': meta.get('og:title', ''), 'description': meta.get('og:description') or meta.get('description', ''), 'metrics': {},
              'limitations': ['Public page text/metadata only; video, audio, frame timing and retention were not observed.']}
    if urlsplit(url).hostname == 'www.youtube.com':
        match = re.search(r'(?:var )?ytInitialData\s*=\s*', html)
        if not match:
            raise Refused('SOURCE_CONTENT_NOT_AVAILABLE')
        try:
            data = json.JSONDecoder().raw_decode(html[match.end():])[0]
        except ValueError as exc:
            raise Refused('SOURCE_CONTENT_NOT_AVAILABLE') from exc
        # The root endpoint identifies the requested video, unlike recommended
        # videos elsewhere in ytInitialData or generic/undefined canonical tags.
        video_id = data.get('currentVideoEndpoint', {}).get('watchEndpoint', {}).get('videoId')
        if video_id != parse_qs(urlsplit(url).query).get('v', [None])[0]:
            raise Refused('SOURCE_PAGE_IDENTITY_UNPROVEN')
        primary = next(find(data, 'videoPrimaryInfoRenderer'), {})
        secondary = next(find(data, 'videoSecondaryInfoRenderer'), {})
        result['title'] = plain(primary.get('title'))
        result['creator'] = plain(next(find(secondary, 'videoOwnerRenderer'), {}).get('title'))
        result['publishedText'] = plain(primary.get('dateText'))
        result['description'] = plain(secondary.get('attributedDescription')) or plain(secondary.get('description'))
        views = next(find(primary, 'originalViewCount'), '')
        if isinstance(views, str) and re.fullmatch(r'\d+', views):
            result['metrics']['views'] = int(views)
        for text in find(primary, 'accessibilityText'):
            m = re.fullmatch(r'like this video along with ([\d,]+) other people', text) if isinstance(text, str) else None
            if m:
                result['metrics']['likes'] = int(m[1].replace(',', ''))
                break
        if 'LOGIN_REQUIRED' in html:
            result['limitations'].append('YouTube playback requires login on this server; only the publicly returned watch-page metadata was read.')
        if not result['title'] or not result['description'] and not result['publishedText']:
            raise Refused('SOURCE_CONTENT_NOT_AVAILABLE')
    else:
        generic = ('facebook', 'instagram', 'tiktok', 'login • instagram', 'log into facebook', 'top ads: high-performing auction ads')
        if not result['title'] or result['title'].strip().lower() in generic or len(result['description'].strip()) < 80 or re.search(r'log (?:in|into) (?:facebook|instagram)|sign up (?:for|to) (?:facebook|instagram)', result['description'], re.I):
            raise Refused('SOURCE_CONTENT_NOT_AVAILABLE')
        identities = set()
        for value in parser.identities:
            if not value.strip():
                continue
            try:
                identities.add(history_canonical(urljoin(url, value)))
            except (Refused, ValueError) as exc:
                raise Refused('SOURCE_PAGE_IDENTITY_UNPROVEN') from exc
        if identities != {canonical(url)}:
            raise Refused('SOURCE_PAGE_IDENTITY_UNPROVEN')
    for key in ('title', 'description', 'creator', 'publishedText'):
        if key in result:
            result[key] = str(result[key])[:12000]
    return result


def private_dir(path):
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or path.resolve() != path.absolute() or os.name == 'posix' and (info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700):
        raise Refused('EVIDENCE_DIRECTORY_UNSAFE')
    return path


def read_json(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 8 * 1024 * 1024:
        raise Refused('EVIDENCE_FILE_UNSAFE')
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value):
    private_dir(path.parent)
    fd, name = tempfile.mkstemp(prefix='.evidence-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(value, f, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def run_state(role):
    if role not in ROLES:
        raise Refused('CREATIVE_ROLE_REQUIRED')
    run = read_json(HOME / 'run-status' / (role + '.json'))
    if run.get('status') != 'running' or not re.fullmatch(r'[a-f0-9]{32}', run.get('invocationId', '')):
        raise Refused('ACTIVE_RESEARCH_RUN_REQUIRED')
    return run


def evidence_dir(role):
    return private_dir(private_dir(HOME / 'source-evidence') / role)


def source_read(role, url):
    run = run_state(role)
    url = role_url(role, url)
    body = fetch(url, role)
    result = {'sourceUrl': url, 'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
              'invocationId': run['invocationId'], 'sha256': hashlib.sha256(body).hexdigest(), **extract(body, url)}
    write_json(evidence_dir(role) / (hashlib.sha256(url.encode()).hexdigest() + '.json'), result)
    return result


def history_canonical(url):
    """Normalize historical share links only; never use this to fetch a URL."""
    u = urlsplit(url)
    if u.scheme != 'https' or u.username or u.password or u.port:
        raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
    host = u.hostname
    if host in ('m.youtube.com', 'music.youtube.com'):
        host = 'www.youtube.com'
    path = u.path
    if host in ('instagram.com', 'www.instagram.com'):
        match = re.fullmatch(r'/(?:[A-Za-z0-9._-]{1,80}/)?(p|reel|reels|tv)/([A-Za-z0-9_-]{5,80})/?', path)
        if match:
            path = '/p/' + match[2] + '/'
    if host in ('youtube.com', 'www.youtube.com') and re.fullmatch(r'/live/[A-Za-z0-9_-]{11}/?', path):
        path = '/shorts/' + path.split('/')[2]
    query = parse_qs(u.query)
    kept = ''
    if host in ('youtube.com', 'www.youtube.com') and u.path == '/watch':
        if len(query.get('v', [])) != 1:
            raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
        kept = '?v=' + query['v'][0]
    elif host in ('facebook.com', 'www.facebook.com', 'm.facebook.com') and u.path.rstrip('/') in ('/watch', '/ads/library'):
        key = 'v' if u.path.rstrip('/') == '/watch' else 'id'
        if len(query.get(key, [])) != 1:
            raise Refused('PUBLIC_SOURCE_URL_REQUIRED')
        kept = '?' + key + '=' + query[key][0]
    return canonical('https://' + str(host) + path + kept)


def report_urls(text, stats=None):
    stats = stats if stats is not None else {}
    text = text.lstrip('\ufeff')
    if not text.strip():
        return set()
    try:
        report = json.JSONDecoder().raw_decode(text.lstrip())[0]
        entries = report.get('entries', [])
        if not isinstance(entries, list):
            raise ValueError('invalid entries')
    except (ValueError, AttributeError):
        # Old Docs sometimes contain literal newlines inside a JSON string. Only
        # recover individually valid sourceUrl strings; do not parse other claims.
        matches = re.findall(r'"sourceUrl"\s*:\s*("(?:[^"\\]|\\.)*")', text)
        entries = []
        for value in matches:
            try:
                entries.append({'sourceUrl': json.loads(value)})
            except ValueError:
                pass
        if not entries and text.strip():
            raise Refused('SOURCE_HISTORY_UNREADABLE')
        stats['recoveredDocumentCount'] = stats.get('recoveredDocumentCount', 0) + 1
    urls = set()
    for entry in entries:
        try:
            urls.add(history_canonical(entry['sourceUrl']))
        except (Refused, ValueError, KeyError, TypeError):
            stats['unsupportedHistoryUrlCount'] = stats.get('unsupportedHistoryUrlCount', 0) + 1
    return urls


def inventory(role, current_texts):
    run = run_state(role)
    stats = {'recoveredDocumentCount': 0, 'unsupportedHistoryUrlCount': 0}
    urls = set().union(*(report_urls(text, stats) for text in current_texts))
    for other in ROLES:
        for path in (HOME / 'docs-backups').glob(other + '-*.json'):
            backup = read_json(path)
            urls.update(report_urls(backup.get('state', {}).get('plaintext', ''), stats))
    value = {'invocationId': run['invocationId'], 'sourceUrls': sorted(urls)}
    write_json(evidence_dir(role) / 'inventory.json', value)
    # Public sources only. This copy is model-readable; validation uses private copy.
    write_json(HOME / 'work' / (role + '-sources.json'), value)
    return {'knownSourceCount': len(urls), **stats}


def validate(role, report):
    run = run_state(role)
    previous = read_json(evidence_dir(role) / 'inventory.json')
    if previous.get('invocationId') != run['invocationId']:
        raise Refused('SOURCE_INVENTORY_NOT_CURRENT')
    known = set(previous['sourceUrls'])
    new, seen = 0, set()
    for entry in report['entries']:
        url = role_url(role, entry['sourceUrl'])
        if url in seen:
            raise Refused('DUPLICATE_REPORT_SOURCE')
        seen.add(url)
        if entry['sourceUrl'] != url:
            raise Refused('CANONICAL_SOURCE_URL_REQUIRED')
        try:
            proof = read_json(evidence_dir(role) / (hashlib.sha256(url.encode()).hexdigest() + '.json'))
        except FileNotFoundError as exc:
            raise Refused('CURRENT_SOURCE_READ_REQUIRED') from exc
        if proof.get('invocationId') != run['invocationId'] or proof.get('sourceUrl') != url:
            raise Refused('CURRENT_SOURCE_READ_REQUIRED')
        timestamp = datetime.fromisoformat(proof['checkedAt'].replace('Z', '+00:00'))
        if datetime.fromisoformat(entry['checkedAt'].replace('Z', '+00:00')) != timestamp or not datetime.fromisoformat(report['researchStartedAt'].replace('Z', '+00:00')) <= timestamp <= datetime.fromisoformat(report['researchCompletedAt'].replace('Z', '+00:00')):
            raise Refused('SOURCE_OBSERVATION_TIME_MISMATCH')
        if entry.get('research', {}).get('evidenceLevel') != 'page-read':
            raise Refused('PAGE_TEXT_IS_NOT_VIDEO_OBSERVATION')
        # The application validator runs first and owns the complete field/type
        # allowlist. Here every permitted observation is tied to this extractor.
        for key in ('title', 'creator'):
            if entry.get(key, '') != proof.get(key, ''):
                raise Refused('SOURCE_TEXT_NOT_OBSERVED:' + key)
        for key in ('periodDays', 'interest', 'budgetLabel', 'durationSeconds', 'ctrTopPercent', 'channelId', 'objective', 'industry', 'hook', 'structure'):
            if entry.get(key) not in (None, ''):
                raise Refused('SOURCE_FIELD_NOT_OBSERVED:' + key)
        if entry.get('region', 'GLOBAL') != 'GLOBAL' or entry['research'].get('publishedAt') is not None:
            raise Refused('SOURCE_FIELD_NOT_OBSERVED:region_or_publishedAt')
        for key, value in entry.get('metrics', {}).items():
            if value is not None and value != proof.get('metrics', {}).get(key):
                raise Refused('SOURCE_METRIC_NOT_OBSERVED')
        if not entry.get('research', {}).get('productionGuide'):
            raise Refused('PRODUCTION_GUIDE_REQUIRED')
        new += url not in known
    if role == 'full' and new == 0:
        raise Refused('NO_NEW_SOURCE_CANDIDATES')
    return {'freshSourceCount': len(report['entries']), 'newCandidateCount': new}
