"""Verify every delivered ZIP byte against the current local game source."""
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
archive = root.parent / (sys.argv[1] if len(sys.argv)>1 else "story-classroom-play-20261002-v2.zip")
records = []
with ZipFile(archive) as package:
    assert package.testzip() is None, "Archive CRC failure"
    for info in package.infolist():
        if info.is_dir():
            continue
        relative = info.filename.replace("\\", "/")
        target = (root / relative).resolve()
        assert target.is_relative_to(root), "Archive traversal path"
        data = package.read(info)
        digest = hashlib.sha256(data).hexdigest()
        assert target.is_file(), f"Unexpected entry {relative}"
        assert digest == hashlib.sha256(target.read_bytes()).hexdigest(), f"Stale entry {relative}"
        records.append({"file": relative, "bytes": len(data), "sha256": digest})
    delivered = {item["file"] for item in records}
    expected = {str(p.relative_to(root)).replace("\\", "/") for p in root.rglob("*") if p.is_file() and not p.name.startswith("package-results")}
    assert expected <= delivered, f"Missing entries {expected - delivered}"
result = {"pass": True, "archive": archive.name, "archiveBytes": archive.stat().st_size, "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "files": len(records), "entries": records}
(root / "qa" / "package-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in result.items() if key != "entries"}, ensure_ascii=False))
