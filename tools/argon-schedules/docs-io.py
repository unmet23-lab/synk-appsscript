#!/usr/bin/env python3
"""Restricted plain-text Google Docs I/O; no LLM calls or scheduling.

Config: root-owned /etc/synk-argon-77yuhbs/docs.json, a role -> Doc ID map.
plaintext excludes only the immutable final newline required by Google Docs.
Writes never retry; an ambiguous result must be investigated with a fresh read.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

HOME = Path('/var/lib/synk-argon-77yuhbs')
WORK = HOME / 'work'
BACKUPS = HOME / 'docs-backups'
CONFIG = Path('/etc/synk-argon-77yuhbs/docs.json')
GWS = '/opt/synk-google-workspace-cli/0.22.5-musl/bin/gws'
REPORT_NODE = '/opt/synk-argon-77yuhbs/bin/node'
REPORT_VALIDATOR = Path('/opt/synk-argon-77yuhbs/report-contract/validate-report.mjs')
FIXED_DOCS = {
    'full': '10LfWPhwWO1Lzk8V_HddA0a5vVNJ0NVQXZgNyUplcwvk',
    'yt-tt': '1aYwO_1qBcUs5uzeeRoeePBRo_qkWSFBwjr4Xj-LUXmI',
    'meta-brand': '1YTHEzSzgdm76sXUz5hEbwdTiOse575D3_malZz8LWwQ',
}
# Monday trend-scan collection (2026-10-19). Free-text Docs like synkbrief, but the
# body is one JSON object + a final marker line so the Monday review can parse it.
WEEKLY_ROLES = ('scan-lab', 'scan-ai', 'scan-platform')
ROLES = frozenset((*FIXED_DOCS, 'synkbrief', *WEEKLY_ROLES))
MARKER = 'SYNK_CREATIVE_RESEARCH_COMPLETE'
WEEKLY_MARKER = 'SYNK_WEEKLY_SCAN_COMPLETE'
WEEKLY_SOURCE_KINDS = frozenset(('공식', '보도', '업계', '내부'))
WEEKLY_MAX_ITEMS = 150
MAX_CONTENT = 1024 * 1024
MAX_JSON_ARGUMENT = 120 * 1024  # Linux has a 128 KiB single-argument ceiling.


class Refused(Exception):
    pass


def pack(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def strict_json(text):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise Refused('DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    def invalid_constant(_):
        raise Refused('NONFINITE_JSON_NUMBER')
    try:
        return json.loads(text, object_pairs_hook=unique, parse_constant=invalid_constant)
    except (ValueError, RecursionError) as exc:
        raise Refused('INVALID_JSON') from exc


def document_id(role):
    if role not in ROLES:
        raise Refused('UNKNOWN_ROLE')
    info = CONFIG.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise Refused('CONFIG_MUST_BE_ROOT_OWNED_AND_NOT_WRITABLE_BY_OTHERS')
    values = strict_json(CONFIG.read_text(encoding='utf-8'))
    if not isinstance(values, dict) or set(values) != ROLES:
        raise Refused('CONFIG_ROLE_SET_MISMATCH')
    if any(values.get(key) != value for key, value in FIXED_DOCS.items()):
        raise Refused('FIXED_CREATIVE_DOC_MISMATCH')
    target = values.get(role)
    if not isinstance(target, str) or not re.fullmatch(r'[A-Za-z0-9_-]{20,100}', target):
        raise Refused('DOC_ID_NOT_CONFIGURED')
    configured = [value for value in values.values() if value is not None]
    if len(configured) != len(set(configured)):
        raise Refused('DUPLICATE_DOC_DESTINATION')
    return target


def run_gws(method, params, body=None):
    if method not in ('get', 'batchUpdate'):
        raise Refused('UNSUPPORTED_GWS_METHOD')
    args = [GWS, 'docs', 'documents', method, '--params', pack(params)]
    if body is not None:
        encoded = pack(body)
        if len(encoded.encode('utf-8')) > MAX_JSON_ARGUMENT:
            raise Refused('GWS_ARGUMENT_LIMIT_120_KIB')
        args += ['--json', encoded]
    env = {
        'HOME': str(HOME), 'USER': 'synk-argon-ultra',
        'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8',
        'GOOGLE_WORKSPACE_CLI_CONFIG_DIR': str(HOME / '.config/gws-docs'),
        'GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND': 'file',
    }
    try:
        result = subprocess.run(args, shell=False, env=env, cwd=str(WORK),
                                stdin=subprocess.DEVNULL, capture_output=True,
                                text=True, encoding='utf-8', timeout=90, check=False)
    except subprocess.TimeoutExpired as exc:
        raise Refused('GWS_TIMEOUT_NO_RETRY_OUTCOME_UNKNOWN' if method == 'batchUpdate'
                      else 'GWS_READ_TIMEOUT') from exc
    # Never echo raw CLI diagnostics, which can contain account/authentication data.
    if result.returncode != 0:
        raise Refused('GWS_WRITE_FAILED_NO_RETRY_OUTCOME_UNKNOWN' if method == 'batchUpdate'
                      else 'GWS_READ_FAILED')
    if len(result.stdout.encode('utf-8')) > 8 * MAX_CONTENT:
        raise Refused('GWS_RESPONSE_TOO_LARGE')
    value = strict_json(result.stdout)
    if not isinstance(value, dict) or 'error' in value:
        raise Refused('GWS_INVALID_RESPONSE_NO_RETRY')
    return value


def utf16_length(text):
    try:
        return len(text.encode('utf-16-le')) // 2
    except UnicodeError as exc:
        raise Refused('INVALID_UNICODE') from exc


def flatten(document, expected_id):
    if document.get('documentId') != expected_id:
        raise Refused('RETURNED_DOC_ID_MISMATCH')
    revision = document.get('revisionId')
    if not isinstance(revision, str) or not revision:
        raise Refused('MISSING_REVISION')
    container, tab_id = document, None
    if 'tabs' in document:
        tabs = document['tabs']
        if not isinstance(tabs, list) or len(tabs) != 1 or tabs[0].get('childTabs'):
            raise Refused('MULTITAB_OR_INVALID_TABS_NOT_SUPPORTED')
        container = tabs[0].get('documentTab')
        tab_id = tabs[0].get('tabProperties', {}).get('tabId')
        if not isinstance(container, dict) or not isinstance(tab_id, str) or not tab_id:
            raise Refused('INVALID_SINGLE_TAB')
        if document.get('body', {}).get('content'):
            raise Refused('AMBIGUOUS_LEGACY_AND_TAB_BODY')
    if any(container.get(key) for key in ('inlineObjects', 'positionedObjects',
                                         'footnotes', 'headers', 'footers')):
        raise Refused('NON_BODY_CONTENT_NOT_SUPPORTED')
    content = container.get('body', {}).get('content')
    if not isinstance(content, list) or not content:
        raise Refused('MISSING_BODY')
    parts, cursor = [], 1
    for position, block in enumerate(content):
        if 'sectionBreak' in block:
            if position != 0 or block.get('endIndex') != 1:
                raise Refused('NONINITIAL_SECTION_BREAK_NOT_SUPPORTED')
            continue
        if set(block) - {'startIndex', 'endIndex', 'paragraph'} or 'paragraph' not in block:
            raise Refused('NON_PARAGRAPH_CONTENT_NOT_SUPPORTED')
        if block.get('startIndex') != cursor:
            raise Refused('NONCONTIGUOUS_BODY')
        paragraph = block['paragraph']
        if paragraph.get('positionedObjectIds') or any(
                key.startswith('suggested') and value for key, value in paragraph.items()):
            raise Refused('OBJECT_OR_SUGGESTION_NOT_SUPPORTED')
        for element in paragraph.get('elements', []):
            if set(element) - {'startIndex', 'endIndex', 'textRun'} or 'textRun' not in element:
                raise Refused('NON_TEXT_PARAGRAPH_ELEMENT_NOT_SUPPORTED')
            run = element['textRun']
            if any(key.startswith('suggested') and value for key, value in run.items()):
                raise Refused('SUGGESTION_NOT_SUPPORTED')
            text = run.get('content')
            if not isinstance(text, str) or element.get('startIndex') != cursor:
                raise Refused('INVALID_TEXT_RUN')
            cursor += utf16_length(text)
            if element.get('endIndex') != cursor:
                raise Refused('TEXT_INDEX_MISMATCH')
            parts.append(text)
        if block.get('endIndex') != cursor:
            raise Refused('PARAGRAPH_INDEX_MISMATCH')
    physical = ''.join(parts)
    if not physical.endswith('\n'):
        raise Refused('MISSING_DOC_FINAL_NEWLINE')
    logical = physical[:-1]
    return {'documentId': expected_id, 'title': document.get('title', ''),
            'revisionId': revision, 'plaintext': logical, 'sha256': sha(logical),
            '_endIndex': cursor, '_tabId': tab_id}


def read_document(target):
    raw = run_gws('get', {'documentId': target, 'includeTabsContent': True})
    return flatten(raw, target), raw


def content_file(filename):
    root = WORK.resolve(strict=True)
    path = Path(filename).resolve(strict=True)
    if not path.is_relative_to(root):
        raise Refused('CONTENT_FILE_OUTSIDE_WORK')
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(fd, 'rb') as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise Refused('CONTENT_MUST_BE_REGULAR_UNLINKED_FILE')
        if sys.platform.startswith('linux'):
            actual = Path('/proc/self/fd/' + str(handle.fileno())).resolve(strict=True)
            if not actual.is_relative_to(root):
                raise Refused('CONTENT_FILE_CHANGED_OUTSIDE_WORK')
        if info.st_size > MAX_CONTENT:
            raise Refused('CONTENT_EXCEEDS_1_MIB')
        data = handle.read(MAX_CONTENT + 1)
    if len(data) > MAX_CONTENT:
        raise Refused('CONTENT_EXCEEDS_1_MIB')
    try:
        text = data.decode('utf-8')
    except UnicodeError as exc:
        raise Refused('CONTENT_NOT_UTF8') from exc
    if not text or re.search(r'[\x00-\x08\x0b-\x1f\ue000-\uf8ff\ufeff]', text):
        raise Refused('EMPTY_OR_UNSUPPORTED_DOC_CHARACTERS')
    return text


def validate_weekly(role, text):
    """Light shape check only; the Monday review re-verifies every fact it uses."""
    cleaned = text.rstrip('\n')
    suffix = '\n' + WEEKLY_MARKER
    if not cleaned.endswith(suffix):
        raise Refused('MISSING_WEEKLY_COMPLETION_MARKER')
    value = strict_json(cleaned[:-len(suffix)])
    if not isinstance(value, dict) or type(value.get('schemaVersion')) is not int or value['schemaVersion'] != 1:
        raise Refused('INVALID_SCHEMA_VERSION')
    if value.get('kind') != 'synk-weekly-scan' or value.get('role') != role:
        raise Refused('WEEKLY_KIND_OR_ROLE_MISMATCH')
    week = value.get('weekOf')
    if not isinstance(week, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', week):
        raise Refused('WEEKLY_WEEK_OF_INVALID')
    items = value.get('items')
    if not isinstance(items, list) or not items or len(items) > WEEKLY_MAX_ITEMS:
        raise Refused('WEEKLY_ITEMS_INVALID')
    for item in items:
        if not isinstance(item, dict):
            raise Refused('WEEKLY_ITEM_NOT_OBJECT')
        title, url = item.get('title'), item.get('url')
        if not isinstance(title, str) or not title.strip() or len(title) > 400:
            raise Refused('WEEKLY_ITEM_TITLE_INVALID')
        if not isinstance(url, str) or not re.fullmatch(r'https?://\S{3,2000}', url):
            raise Refused('WEEKLY_ITEM_URL_INVALID')
        if item.get('sourceKind') not in WEEKLY_SOURCE_KINDS:
            raise Refused('WEEKLY_ITEM_SOURCE_KIND_INVALID')


def validate_creative(role, text):
    if role == 'synkbrief':
        return
    if role in WEEKLY_ROLES:
        validate_weekly(role, text)
        return
    cleaned = text.rstrip('\n')
    suffix = '\n' + MARKER
    if not cleaned.endswith(suffix):
        raise Refused('MISSING_FINAL_COMPLETION_MARKER')
    value = strict_json(cleaned[:-len(suffix)])
    if not isinstance(value, dict) or type(value.get('schemaVersion')) is not int or value['schemaVersion'] != 1:
        raise Refused('INVALID_SCHEMA_VERSION')
    if value.get('provider') != 'gemini-spark' or not isinstance(value.get('entries'), list):
        raise Refused('INVALID_PROVIDER_OR_ENTRIES')
    if len(value['entries']) > 30 or any(not isinstance(item, dict) for item in value['entries']):
        raise Refused('INVALID_ENTRIES')
    report = value.get('reportId')
    pattern = r'synk-creative-' + re.escape(role) + r'-\d{4}-\d{2}-\d{2}-\d{6}'
    if not isinstance(report, str) or not re.fullmatch(pattern, report):
        raise Refused('REPORT_ID_ROLE_OR_FORMAT_MISMATCH')
    validate_workspace_contract(role, value)


def validate_workspace_contract(role, value):
    # Fail before the first Docs read/write. Reuse the application's actual
    # strict validator; do not create a more permissive producer schema.
    try:
        result = subprocess.run(
            [REPORT_NODE, str(REPORT_VALIDATOR), role], input=pack(value),
            shell=False, capture_output=True, text=True, encoding='utf-8',
            timeout=20, check=False, cwd=str(REPORT_VALIDATOR.parent),
            env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'})
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise Refused('WORKSPACE_REPORT_VALIDATOR_UNAVAILABLE') from exc
    if len(result.stdout.encode('utf-8')) > 4096:
        raise Refused('WORKSPACE_REPORT_VALIDATOR_RESPONSE_INVALID')
    try:
        outcome = strict_json(result.stdout)
    except Refused as exc:
        raise Refused('WORKSPACE_REPORT_VALIDATOR_RESPONSE_INVALID') from exc
    if not isinstance(outcome, dict):
        raise Refused('WORKSPACE_REPORT_VALIDATOR_RESPONSE_INVALID')
    if result.returncode != 0 or outcome.get('valid') is not True:
        diagnostic = outcome.get('error', '')
        if not isinstance(diagnostic, str) or len(diagnostic) > 500 or re.search(r'[\x00-\x1f]', diagnostic):
            diagnostic = 'INVALID_REPORT'
        raise Refused('WORKSPACE_REPORT_CONTRACT_INVALID: ' + diagnostic)
    if outcome.get('entries') != len(value['entries']):
        raise Refused('WORKSPACE_REPORT_VALIDATOR_RESPONSE_INVALID')


def backup_document(role, state, raw):
    BACKUPS.mkdir(mode=0o700, parents=False, exist_ok=True)
    info = BACKUPS.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.getuid():
        raise Refused('BACKUP_DIRECTORY_NOT_PRIVATE')
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', prefix=role + '-',
                                     suffix='.json', dir=BACKUPS, delete=False) as handle:
        os.chmod(handle.name, 0o600)
        handle.write(pack({'savedAt': datetime.now(timezone.utc).isoformat(),
                           'state': public(state), 'document': raw}) + '\n')
        handle.flush()
        os.fsync(handle.fileno())
        return handle.name


def public(state):
    return {key: value for key, value in state.items() if not key.startswith('_')}


def compact(state):
    """Model-facing metadata; the body must never overflow command output."""
    value = {key: item for key, item in public(state).items() if key != 'plaintext'}
    value['characters'] = len(state['plaintext'])
    return value


def snapshot_document(role, target):
    if role not in ROLES:
        raise Refused('UNKNOWN_ROLE')
    info = WORK.lstat()
    if not stat.S_ISDIR(info.st_mode):
        raise Refused('SNAPSHOT_WORK_MUST_BE_DIRECTORY')
    if os.name == 'posix' and (info.st_mode & 0o077 or info.st_uid != os.getuid()):
        raise Refused('SNAPSHOT_WORK_NOT_PRIVATE')
    root = WORK.resolve(strict=True)
    destination = root / (role + '-prior.txt')
    if destination.exists() or destination.is_symlink():
        existing = destination.lstat()
        if not stat.S_ISREG(existing.st_mode) or existing.st_nlink != 1:
            raise Refused('SNAPSHOT_DESTINATION_MUST_BE_REGULAR_UNLINKED_FILE')
        if os.name == 'posix' and existing.st_uid != os.getuid():
            raise Refused('SNAPSHOT_DESTINATION_NOT_OWNED')
    state, _ = read_document(target)
    if len(state['plaintext'].encode('utf-8')) > MAX_CONTENT:
        raise Refused('SNAPSHOT_EXCEEDS_1_MIB')
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='',
                                         prefix='.' + role + '-prior-', suffix='.tmp',
                                         dir=root, delete=False) as handle:
            temporary = Path(handle.name)
            os.chmod(temporary, 0o600)
            handle.write(state['plaintext'])
            handle.flush()
            os.fsync(handle.fileno())
        # Replacing a path never opens an old destination or follows its link.
        os.replace(temporary, destination)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {'status': 'snapshot-saved', **compact(state), 'contentPath': str(destination)}


def write_document(role, target, filename, expected_revision):
    text = content_file(filename)
    validate_creative(role, text)
    before, raw = read_document(target)
    if before['revisionId'] != expected_revision:
        raise Refused('REVISION_CONFLICT_NO_WRITE')
    if before['plaintext'] == text:
        return {'status': 'unchanged', **public(before)}
    requests, tab = [], before['_tabId']
    if before['_endIndex'] > 2:
        span = {'startIndex': 1, 'endIndex': before['_endIndex'] - 1}
        if tab is not None:
            span['tabId'] = tab
        requests.append({'deleteContentRange': {'range': span}})
    location = {'index': 1}
    if tab is not None:
        location['tabId'] = tab
    requests.append({'insertText': {'location': location, 'text': text}})
    batch = {'writeControl': {'requiredRevisionId': expected_revision}, 'requests': requests}
    if len(pack(batch).encode('utf-8')) > MAX_JSON_ARGUMENT:
        raise Refused('GWS_ARGUMENT_LIMIT_120_KIB')
    saved = backup_document(role, before, raw)
    run_gws('batchUpdate', {'documentId': target}, batch)
    after, _ = read_document(target)
    if after['plaintext'] != text:
        raise Refused('READBACK_MISMATCH_NO_RETRY_BACKUP_PRESERVED')
    return {'status': 'saved-and-readback-verified', 'backup': saved, **public(after)}


def main(argv):
    if len(argv) not in (3, 4, 5) or argv[1] not in ('read', 'snapshot', 'validate', 'write'):
        raise Refused('USAGE: read ROLE | snapshot ROLE | validate ROLE CONTENT_FILE | write ROLE CONTENT_FILE EXPECTED_REVISION')
    action, role = argv[1:3]
    if (action in ('read', 'snapshot') and len(argv) != 3) or (action == 'validate' and len(argv) != 4) or (action == 'write' and len(argv) != 5):
        raise Refused('INVALID_ARGUMENT_COUNT')
    target = document_id(role)
    if action == 'validate':
        text = content_file(argv[3])
        validate_creative(role, text)
        value = {'status': 'content-validated', 'documentId': target,
                 'sha256': sha(text), 'utf8Bytes': len(text.encode('utf-8')),
                 'networkRequests': 0, 'writes': 0}
    elif action == 'read':
        value = public(read_document(target)[0])
    elif action == 'snapshot':
        value = snapshot_document(role, target)
    else:
        value = compact(write_document(role, target, argv[3], argv[4]))
    print(pack(value))


if __name__ == '__main__':
    try:
        main(sys.argv)
    except (Refused, OSError, UnicodeError) as exc:
        message = str(exc) if isinstance(exc, Refused) else type(exc).__name__
        print(pack({'error': message}), file=sys.stderr)
        sys.exit(1)
