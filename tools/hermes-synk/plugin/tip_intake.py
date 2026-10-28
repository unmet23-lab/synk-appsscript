"""Private tip receipts. No model, message delivery, downloads or ledger writes.

The official Hermes transcript remains the original message store. This module
only retains enough references to notice an unprocessed share after an API error.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import errno
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import stat
import time
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit
from uuid import uuid4

if os.name == "nt":
    import msvcrt
else:
    import fcntl

MAX_REFS = 10
MAX_RECEIPTS = 2000
MAX_RECEIPT_BYTES = 32_000
ID_RE = re.compile(r"tip-[a-f0-9]{24}")
URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)
TRACKING = {"fbclid", "gclid", "dclid", "msclkid"}
PRIVATE_QUERY = re.compile(r"token|auth|secret|password|signature|credential|api.?key|^key$|^sig$|^x-amz-", re.I)
CODE_CONTEXT = re.compile(r"코드|파일|저장소|레포(?:지토리)?|\b(?:code|files?|repo(?:sitory)?|git|source|script)\b|\b[\w.-]+\.(?:py|js|cjs|mjs|ts|tsx|html|css|json|yaml|yml)\b", re.I)
WORK_ACTION = re.compile(r"고쳐(?:줘|주세요)|수정해|구현해|배포해|적용해|만들어(?:줘|주세요)|진행해|(?:커밋|푸시|push|commit)해|(?:(?:^|[.!?\n])\s*(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?|,\s*(?:can|could|would|will)\s+you\s+(?:please\s+)?)(?:fix|implement|deploy|commit|push|update|change|build|create)\b", re.I)
CLI_DELEGATION = re.compile(r"(?:클로드|코덱스|claude|codex)(?:\s*cli)?.{0,50}(?:맡겨|실행해|돌려|작업시켜|수정해|구현해)", re.I)


def _is_work_request(text):
    # A local receipt neither routes nor executes the message. Only explicit
    # code/CLI requests are excluded; a general 'make/apply this' share is kept.
    return bool((CODE_CONTEXT.search(text) and WORK_ACTION.search(text)) or CLI_DELEGATION.search(text))


class IntakeError(Exception):
    """A fixed non-sensitive error code, never arbitrary input or subprocess text."""


def _now():
    return datetime.now(timezone.utc).isoformat()


def owner_hash(route):
    return hashlib.sha256(("telegram:dm:" + str(route["chat_id"]) + ":" + str(route["user_id"])).encode()).hexdigest()


def _safe_path(home, path):
    home, path = Path(home).absolute(), Path(path).absolute()
    try:
        parts = path.relative_to(home).parts
    except ValueError:
        raise IntakeError("TIP_PATH_OUTSIDE_HOME") from None
    current = home
    for part in ("", *parts):
        if part in {".", ".."}:
            raise IntakeError("TIP_PATH_INVALID")
        current = current / part if part else current
        if current.is_symlink() or getattr(current, "is_junction", lambda: False)():
            raise IntakeError("TIP_PATH_LINK")
    return path


def _directory(home):
    return _safe_path(home, Path(home) / "runtime" / "synk-tip-intake")


def canonical_url(raw):
    """Return a public, bounded reference; None means keep only message identity.

    Unknown query/fragment identity is deliberately not eligible for completion.
    """
    if not isinstance(raw, str) or len(raw) > 2048 or any(ord(c) < 32 for c in raw):
        return None
    try:
        raw_path = urlsplit(raw).path
        # Check before punctuation trimming so a final /.. cannot become /.
        path_ambiguous = "\\" in raw_path or any(re.sub(r"%2e", ".", part, flags=re.I) in {".", ".."}
                                                 for part in raw_path.split("/"))
        value = urlsplit(raw if path_ambiguous else raw.rstrip(".,);!！。"))
        host = (value.hostname or "").lower().rstrip(".")
        if value.scheme.lower() not in {"http", "https"} or not host or value.username or value.password:
            return None
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            if "." not in host or not re.fullmatch(r"[a-z0-9.-]+", host):
                return None
        query = parse_qsl(value.query, keep_blank_values=True)
        if any(PRIVATE_QUERY.search(key) for key, _ in query):
            return None
        if host in {"api.telegram.org", "telegram.org"} or host.endswith(".telegram.org"):
            return None
        if host == "t.me" and (value.path.startswith(("/+", "/joinchat/")) or query):
            return None
        port = value.port
    except (ValueError, UnicodeError):
        return None
    tracking = lambda key: key.lower().startswith("utm_") or key.lower() in TRACKING
    remaining = [(key, val) for key, val in query if not tracking(key)]
    # WHATWG parsers remove literal and percent-encoded dot segments. Keep such
    # input ineligible rather than claiming the normalized URL is the same tip.
    instagram = host in {"instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am"}
    match = re.fullmatch(r"/(reel|reels|p|tv)/([A-Za-z0-9_-]+)/?", value.path) if instagram else None
    if match and not path_ambiguous:
        exact = all(key.lower() in {"igsh", "igshid", "img_index"} for key, _ in remaining)
        url = "https://www.instagram.com/" + ("reel" if match[1] in {"reel", "reels"} else match[1]) + "/" + match[2] + "/"
        return {"kind": "url", "url": url, "lookupKey": match[2] if exact else None, "exact": exact}
    youtube = host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"}
    video = None
    if youtube:
        if host.endswith("youtu.be"):
            video = value.path.strip("/")
        elif value.path == "/watch":
            ids = [val for key, val in remaining if key == "v"]
            video = ids[0] if len(ids) == 1 else None
        else:
            match = re.fullmatch(r"/(?:shorts|embed|live)/([A-Za-z0-9_-]+)/?", value.path)
            video = match[1] if match else None
        if video and re.fullmatch(r"[A-Za-z0-9_-]{11}", video) and not path_ambiguous:
            exact = all(key.lower() in {"v", "si", "feature", "t", "start", "list", "index"} for key, _ in remaining)
            url = "https://www.youtube.com/watch?" + urlencode({"v": video})
            return {"kind": "url", "url": url, "lookupKey": url if exact else None, "exact": exact}
    netloc = host if not port or (value.scheme.lower(), port) in {("http", 80), ("https", 443)} else host + ":" + str(port)
    path = quote(value.path or "/", safe="/!$&'()*+,-.:;=@_~%[]|")
    url = urlunsplit((value.scheme.lower(), netloc, path, "", ""))
    exact = not remaining and not value.fragment and not path_ambiguous
    return {"kind": "url", "url": url, "lookupKey": url if exact else None, "exact": exact}


def lookup_key(value):
    if not isinstance(value, str):
        return None
    if value.startswith(("https://", "http://")):
        ref = canonical_url(value)
        return ref.get("lookupKey") if ref else None
    return value if re.fullmatch(r"[A-Za-z0-9_-]{3,100}", value) else None


def _event_refs(home, event, message_id):
    text = str(getattr(event, "text", "") or "")
    refs = []
    for index, raw in enumerate(URL_RE.findall(text)[:MAX_REFS]):
        refs.append(canonical_url(raw) or {"kind": "message", "reference": f"platform-message:{message_id}#url{index}",
                                         "reason": "url-redacted", "lookupKey": None, "exact": False})
    media = getattr(event, "media_urls", None) or []
    media_types = getattr(event, "media_types", None) or []
    for index, raw in enumerate(media[:MAX_REFS]):
        reference = f"platform-message:{message_id}#media{index}"
        try:
            if isinstance(raw, str) and len(raw) <= 2048 and not re.match(r"^[a-z]+://", raw, re.I):
                candidate = _safe_path(home, Path(raw))
                relative = candidate.relative_to(Path(home).absolute())
                if relative.parts and relative.parts[0] in {"cache", "media", "attachments"}:
                    reference = relative.as_posix()
        except (IntakeError, ValueError, OSError):
            pass
        kind = str(media_types[index] if index < len(media_types) else "unknown").lower()
        kind = kind if re.fullmatch(r"(?:image|video|audio|application)/[a-z0-9.+-]{1,40}|image|video|audio|document", kind) else "unknown"
        refs.append({"kind": "media", "reference": reference, "mediaType": kind, "lookupKey": None, "exact": False})
    unique = list({json.dumps(ref, sort_keys=True): ref for ref in refs}.values())
    # Do not silently mark a truncated multi-share as fully processed.
    if len(URL_RE.findall(text)) + len(media) > MAX_REFS:
        unique = unique[:MAX_REFS - 1] + [{"kind": "message", "reference": f"platform-message:{message_id}",
                                          "reason": "reference-limit", "lookupKey": None, "exact": False}]
    return unique[:MAX_REFS]


@contextmanager
def _locked(home, receipt_id):
    folder = _directory(home)
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = _safe_path(home, folder / (receipt_id + ".lock"))
    fd = os.open(lock, os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0), 0o600)
    acquired = False
    try:
        opened = os.fstat(fd)
        current = lock.stat(follow_symlinks=False)
        if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1 or (opened.st_dev, opened.st_ino) != (current.st_dev, current.st_ino):
            raise IntakeError("TIP_PATH_LINK")
        for _ in range(50):
            try:
                if os.name == "nt":
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                else:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                acquired = True
                break
            except OSError as error:
                if error.errno not in {errno.EACCES, errno.EAGAIN, errno.EDEADLK}:
                    raise
                time.sleep(0.01)
        if not acquired:
            raise IntakeError("TIP_RECEIPT_BUSY")
        yield folder / (receipt_id + ".json")
    finally:
        # The persistent file must not be unlinked: another waiter may already
        # hold its descriptor. Closing the OS lock also releases it on a crash.
        try:
            if acquired:
                if os.name == "nt":
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)


def _write(home, path, record):
    _safe_path(home, path)
    data = json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8")
    if len(data) > MAX_RECEIPT_BYTES:
        raise IntakeError("TIP_RECEIPT_TOO_LARGE")
    temporary = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _read(home, path):
    _safe_path(home, path)
    if path.stat().st_size > MAX_RECEIPT_BYTES or path.stat().st_nlink != 1:
        raise IntakeError("TIP_RECEIPT_INVALID")
    record = json.loads(path.read_text(encoding="utf-8"))
    if (record.get("schemaVersion") != 1 or record.get("id") != path.stem
            or not ID_RE.fullmatch(str(record.get("id", "")))
            or not isinstance(record.get("refs"), list) or not 1 <= len(record["refs"]) <= MAX_REFS
            or record.get("status") not in {"pending", "reconciled", "ambiguous"}):
        raise IntakeError("TIP_RECEIPT_INVALID")
    return record


def capture(home, event, allowed_users, *, now=None):
    source = getattr(event, "source", None)
    platform = getattr(source, "platform", None)
    platform = getattr(platform, "value", platform)
    user, chat = str(getattr(source, "user_id", "") or ""), str(getattr(source, "chat_id", "") or "")
    message_id = str(getattr(event, "message_id", "") or "")
    text = str(getattr(event, "text", "") or "")
    if (getattr(event, "internal", False) or platform != "telegram" or getattr(source, "chat_type", "") != "dm"
            or not user.isdecimal() or user not in allowed_users or chat != user
            or not re.fullmatch(r"[0-9]{1,24}", message_id) or len(text) > 16000
            or text.lstrip().startswith("/")
            or getattr(event, "prompt_response", None) or _is_work_request(URL_RE.sub("", text))):
        return None
    refs = _event_refs(home, event, message_id)
    if not refs:
        return None
    owner = owner_hash({"chat_id": chat, "user_id": user})
    receipt_id = "tip-" + hashlib.sha256((owner + ":" + message_id).encode()).hexdigest()[:24]
    with _locked(home, receipt_id) as path:
        if path.exists():
            record = _read(home, path)
            if record.get("ownerHash") != owner or record.get("messageId") != message_id:
                raise IntakeError("TIP_IDENTITY_MISMATCH")
            combined = list({json.dumps(ref, sort_keys=True): ref for ref in record["refs"] + refs}.values())
            if combined == record["refs"]:
                return record
            if len(combined) > MAX_REFS:
                raise IntakeError("TIP_REFERENCE_CAPACITY")
            record.update(refs=combined, status="pending", updatedAt=now or _now())
            record.pop("errorCode", None)
        else:
            if len(list(path.parent.glob("tip-*.json"))) >= MAX_RECEIPTS:
                raise IntakeError("TIP_INTAKE_CAPACITY")
            record = {"schemaVersion": 1, "id": receipt_id, "ownerHash": owner, "messageId": message_id,
                      "receivedAt": now or _now(), "updatedAt": now or _now(), "status": "pending", "refs": refs,
                      "ledgerMatches": []}
        _write(home, path, record)
        return record


def list_receipts(home, owner, limit=100):
    folder = _directory(home)
    if not folder.exists():
        return {"items": [], "complete": True, "unreadable": 0}
    paths = sorted(folder.glob("tip-*.json"), key=lambda p: p.stat().st_mtime_ns, reverse=True)
    items, unreadable = [], 0
    for path in paths[:MAX_RECEIPTS]:
        try:
            record = _read(home, path)
            if record.get("ownerHash") == owner:
                items.append(record)
        except (IntakeError, OSError, ValueError, TypeError):
            unreadable += 1
    return {"items": items[:limit], "complete": len(paths) <= MAX_RECEIPTS and len(items) <= limit and not unreadable,
            "unreadable": unreadable}


def read_receipt(home, owner, receipt_id):
    """A known receipt ID does not depend on the bounded listing window."""
    if not isinstance(receipt_id, str) or not ID_RE.fullmatch(receipt_id):
        raise IntakeError("TIP_ID_INVALID")
    record = _read(home, _directory(home) / (receipt_id + ".json"))
    if record.get("ownerHash") != owner:
        raise IntakeError("TIP_NOT_OWNED")
    return record


def reconcile(home, owner, receipt_id, read_ledger, *, now=None):
    """Explicit find/recent reads only. A substring find is not proof of identity."""
    before = read_receipt(home, owner, receipt_id)
    keys = list(dict.fromkeys(ref.get("lookupKey") for ref in before["refs"]
                             if ref.get("kind") == "url" and ref.get("exact") is True and ref.get("lookupKey")))
    matches, errors, ambiguous = [], [], False
    try:
        recent = read_ledger("recent", "50") if keys else {"ok": True, "rows": []}
        if recent.get("ok") is not True or not isinstance(recent.get("rows"), list):
            raise IntakeError("TIP_LEDGER_UNAVAILABLE")
        for key in keys:
            exact = [row for row in recent["rows"] if lookup_key(row.get("게시물ID")) == key]
            # A shortened YouTube URL may be the ledger's original ID. Query
            # that exact stored key after normalizing its identity locally.
            find_key = exact[0]["게시물ID"] if len(exact) == 1 else key
            found = read_ledger("find", find_key)
            if found.get("ok") is not True or not isinstance(found.get("rows"), list):
                raise IntakeError("TIP_LEDGER_UNAVAILABLE")
            rows = found["rows"]
            if len(exact) > 1:
                ambiguous = True
            elif len(rows) == 1 and len(exact) == 1 and rows[0].get("row") == exact[0].get("row") and isinstance(rows[0].get("row"), int) and not isinstance(rows[0]["row"], bool):
                matches.append({"lookupKey": key, "row": rows[0]["row"]})
            elif rows:
                errors.append("TIP_LEDGER_IDENTITY_UNVERIFIED")
    except (IntakeError, OSError, ValueError, TypeError, KeyError):
        errors.append("TIP_LEDGER_UNAVAILABLE")
    exact_refs = all(ref.get("kind") == "url" and ref.get("exact") is True and ref.get("lookupKey") for ref in before["refs"])
    state = "ambiguous" if ambiguous else "reconciled" if exact_refs and len(matches) == len(keys) and not errors else "pending"
    with _locked(home, receipt_id) as locked:
        current = _read(home, locked)
        if current != before:
            raise IntakeError("TIP_RECEIPT_CHANGED")
        current.update(status=state, ledgerMatches=matches, updatedAt=now or _now())
        current["reconciliation"] = {"checkedAt": now or _now(), "coverage": "recent-50", "status": state}
        if errors:
            current["errorCode"] = errors[0]
        else:
            current.pop("errorCode", None)
        _write(home, locked, current)
        return current
