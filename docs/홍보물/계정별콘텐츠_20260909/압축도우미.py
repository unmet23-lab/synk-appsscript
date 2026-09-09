"""Package delivery artifacts with portable Unicode names and readback hashes."""
import hashlib
import json
from pathlib import Path
import sys
from datetime import datetime, timezone
from zipfile import ZipFile, ZIP_DEFLATED
from html.parser import HTMLParser
import posixpath
from urllib.parse import urlsplit, unquote


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend(value for key, value in attrs if key in ("href", "src") and value)


def digest(stream):
    sha = hashlib.sha256()
    while chunk := stream.read(1024 * 1024):
        sha.update(chunk)
    return sha.hexdigest()


plan = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
reports = []
for spec in plan["archives"]:
    target = Path(spec["destination"])
    names = [f["entry"] for f in spec["files"]]
    assert len(names) == len(set(names)), f"Duplicate entries: {spec['id']}"
    with ZipFile(target, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for item in spec["files"]:
            archive.write(item["source"], item["entry"])
    verified = []
    broken_links = []
    with ZipFile(target, "r") as archive:
        assert set(archive.namelist()) == set(names), f"Entry mismatch: {spec['id']}"
        for item in spec["files"]:
            with archive.open(item["entry"]) as stream:
                actual = digest(stream)
            with open(item["source"], "rb") as stream:
                expected = digest(stream)
            assert actual == expected, f"Readback mismatch: {item['entry']}"
            verified.append({"entry": item["entry"], "bytes": archive.getinfo(item["entry"]).file_size, "sha256": actual})
        for name in names:
            if not name.endswith(".html"):
                continue
            parser = References()
            parser.feed(archive.read(name).decode("utf-8"))
            for link in parser.links:
                parsed = urlsplit(link)
                if parsed.scheme or not parsed.path:
                    continue
                destination = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(parsed.path)))
                if destination not in names:
                    broken_links.append({"from": name, "to": link})
        assert not broken_links, f"Broken packaged links: {broken_links}"
    with target.open("rb") as stream:
        archive_hash = digest(stream)
    reports.append({"id": spec["id"], "file": target.name, "bytes": target.stat().st_size, "sha256": archive_hash, "entries": len(verified), "verified": True, "brokenHtmlLinks": broken_links, "files": verified})
    print(f"{spec['id']}: {len(verified)} UTF-8 entries read back and SHA-256 matched", flush=True)
Path(plan["report"]).write_text(json.dumps({"checkedAt": datetime.now(timezone.utc).isoformat(), "archives": reports, "passed": True}, ensure_ascii=False, indent=2), encoding="utf-8")
