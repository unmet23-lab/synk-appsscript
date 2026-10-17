#!/usr/bin/env python3
"""Inspect, verify or selectively restore GitHub archive assets without overwrites.

No selection: print the manifest summary without network access or filesystem writes.
--path PATH (repeatable) / --all: restore the explicitly selected files.
--verify-archives: verify all payloads in the selected packages, without restoring.
--archive-dir DIR: use local ZIPs only, including during verification.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import zipfile


REPO = Path(__file__).absolute().parents[1]
CHUNK = 1024 * 1024


class RestoreError(Exception):
    """An archive or destination failed a preservation check."""


def relative_path(value, label="path"):
    if not isinstance(value, str) or not value or "\\" in value:
        raise RestoreError(f"Unsafe {label}: {value!r}")
    parts = value.split("/")
    for part in parts:
        if (part in ("", ".", "..") or part.endswith((".", " "))
                or any(ord(c) < 32 or c in ':<>"|?*' for c in part)
                or re.fullmatch(r"(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?", part)):
            raise RestoreError(f"Unsafe {label}: {value!r}")
    return value


def file_record(row, label):
    if not isinstance(row, dict):
        raise RestoreError(f"Invalid {label}")
    if type(row.get("bytes")) is not int or row["bytes"] < 0:
        raise RestoreError(f"Invalid byte count: {label}")
    if not isinstance(row.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", row["sha256"]):
        raise RestoreError(f"Invalid SHA-256: {label}")


def load_manifest(filename):
    with Path(filename).open("r", encoding="utf-8-sig") as stream:
        manifest = json.load(stream)
    if not isinstance(manifest, dict) or type(manifest.get("version")) is not int or manifest["version"] != 1:
        raise RestoreError("Unsupported manifest version")
    repository = manifest.get("repository")
    if not isinstance(repository, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise RestoreError("Invalid GitHub repository")
    release = manifest.get("release")
    if not isinstance(release, dict):
        raise RestoreError("Invalid release record")
    tag = release.get("tag", "")
    if not isinstance(tag, str) or not tag or tag.startswith("-") or any(ord(c) < 32 for c in tag):
        raise RestoreError("Invalid release tag")
    archives = manifest.get("archives")
    rows = manifest.get("files")
    if not isinstance(archives, list) or not isinstance(rows, list):
        raise RestoreError("Manifest must contain archives and files lists")
    names = set()
    for archive in archives:
        file_record(archive, "archive")
        name = relative_path(archive.get("name"), "archive name")
        if "/" in name or "[" in name or "]" in name or not name.lower().endswith(".zip"):
            raise RestoreError(f"Invalid archive filename: {name}")
        if name.casefold() in names:
            raise RestoreError(f"Duplicate archive: {name}")
        names.add(name.casefold())
    archive_names = {archive["name"] for archive in archives}
    paths, entries = set(), set()
    for row in rows:
        file_record(row, "payload")
        name = relative_path(row.get("path"))
        entry = relative_path(row.get("entry"), "ZIP entry")
        if row.get("archive") not in archive_names:
            raise RestoreError(f"Unknown archive for {name}")
        if name.casefold() in paths or (row["archive"], entry.casefold()) in entries:
            raise RestoreError(f"Duplicate manifest path or entry: {name}")
        paths.add(name.casefold())
        entries.add((row["archive"], entry.casefold()))
    for name in paths:
        parts = name.split("/")
        if any("/".join(parts[:i]) in paths for i in range(1, len(parts))):
            raise RestoreError(f"Manifest file is also a parent directory: {name}")
    for archive, name in entries:
        parts = name.split("/")
        if any((archive, "/".join(parts[:i])) in entries for i in range(1, len(parts))):
            raise RestoreError(f"ZIP payload is also a parent directory: {name}")
    return manifest


def check_no_links(filename):
    """Reject symlinks and Windows reparse points in every existing component."""
    filename = Path(os.path.abspath(filename))
    for candidate in reversed((filename, *filename.parents)):
        try:
            info = candidate.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise RestoreError(f"Symlink or reparse point is not allowed: {candidate}")
        if candidate != filename and not stat.S_ISDIR(info.st_mode):
            raise RestoreError(f"Parent is not a directory: {candidate}")
    return filename


def hash_stream(stream):
    digest = hashlib.sha256()
    size = 0
    for chunk in iter(lambda: stream.read(CHUNK), b""):
        size += len(chunk)
        digest.update(chunk)
    return size, digest.hexdigest()


def matches_file(filename, record):
    filename = check_no_links(filename)
    try:
        info = filename.stat()
    except FileNotFoundError:
        return False
    if not stat.S_ISREG(info.st_mode) or info.st_size != record["bytes"]:
        return False
    with filename.open("rb") as stream:
        return hash_stream(stream) == (record["bytes"], record["sha256"])


def get_archive(manifest, record, cache, archive_dir=None):
    if archive_dir is not None:
        filename = check_no_links(Path(archive_dir) / record["name"])
        if not matches_file(filename, record):
            raise RestoreError(f"Local archive size or SHA-256 mismatch: {filename}")
        return filename
    cache = check_no_links(cache)
    stable_dir = cache / record["sha256"]
    for candidate in (cache / record["name"], stable_dir / record["name"]):
        if matches_file(candidate, record):
            return candidate
    # Never replace a damaged cache file. Each failed/stale download is preserved.
    cache.mkdir(parents=True, exist_ok=True)
    check_no_links(cache)
    if not stable_dir.exists():
        try:
            stable_dir.mkdir()
            download_dir = stable_dir
        except FileExistsError:
            download_dir = Path(tempfile.mkdtemp(prefix="download-", dir=cache))
    else:
        download_dir = Path(tempfile.mkdtemp(prefix="download-", dir=cache))
    check_no_links(download_dir)
    subprocess.run([
        "gh", "release", "download", manifest["release"]["tag"],
        "--repo", manifest["repository"], "--pattern", record["name"],
        "--dir", str(download_dir),
    ], check=True)
    filename = download_dir / record["name"]
    if not matches_file(filename, record):
        raise RestoreError(f"Downloaded archive size or SHA-256 mismatch: {filename}")
    return filename


def inspect_zip(archive, expected, full=False):
    seen, payloads = set(), set()
    for entry in archive.infolist():
        name = entry.filename[:-1] if entry.is_dir() else entry.filename
        relative_path(name, "ZIP entry")
        key = name.casefold()
        if key in seen:
            raise RestoreError(f"Duplicate ZIP entry: {name}")
        seen.add(key)
        mode = (entry.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
            raise RestoreError(f"Non-regular ZIP entry: {name}")
        if entry.flag_bits & 1:
            raise RestoreError(f"Encrypted ZIP entry: {name}")
        if not entry.is_dir():
            payloads.add(entry.filename)
    if full and payloads != set(expected):
        raise RestoreError("ZIP payload list differs from the manifest")
    for name, record in expected.items():
        if name not in payloads or archive.getinfo(name).file_size != record["bytes"]:
            raise RestoreError(f"ZIP entry missing or size mismatch: {name}")
        with archive.open(name, "r") as stream:
            if hash_stream(stream) != (record["bytes"], record["sha256"]):
                raise RestoreError(f"ZIP entry SHA-256 mismatch: {name}")


def target_state(destination, record):
    target = check_no_links(destination / record["path"])
    if target.exists():
        if matches_file(target, record):
            return target, "unchanged"
        raise RestoreError(f"Existing file differs; nothing will overwrite it: {target}")
    return target, "missing"


def write_new_file(target, archive, record):
    """Verify a sibling temporary file, then link it without replacing a target."""
    check_no_links(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    check_no_links(target)
    handle, name = tempfile.mkstemp(prefix=".git-storage-", suffix=".part", dir=target.parent)
    temporary = Path(name)
    try:
        digest = hashlib.sha256()
        size = 0
        with os.fdopen(handle, "wb") as output, archive.open(record["entry"], "r") as source:
            for chunk in iter(lambda: source.read(CHUNK), b""):
                output.write(chunk)
                digest.update(chunk)
                size += len(chunk)
            output.flush()
            os.fsync(output.fileno())
        if (size, digest.hexdigest()) != (record["bytes"], record["sha256"]):
            raise RestoreError(f"ZIP entry changed during restoration: {record['path']}")
        check_no_links(target)
        # link() is atomic and fails if another process created target after preflight.
        # A filesystem without hard links fails closed; do not fall back to overwrite.
        os.link(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def run(args):
    manifest = load_manifest(args.manifest)
    rows = manifest["files"]
    if not args.path and not args.all and not args.verify_archives:
        return {"mode": "summary", "repository": manifest["repository"],
                "release": manifest["release"]["tag"], "files": len(rows),
                "archives": len(manifest["archives"]),
                "bytes": sum(row["bytes"] for row in rows), "writes": 0, "network": False,
                "packages": [{"name": archive["name"], "bytes": archive["bytes"],
                              "files": sum(row["archive"] == archive["name"] for row in rows)}
                             for archive in manifest["archives"]]}
    selected_paths = set(args.path or [])
    for value in selected_paths:
        relative_path(value)
    missing = selected_paths - {row["path"] for row in rows}
    if missing:
        raise RestoreError("Paths are absent from manifest: " + ", ".join(sorted(missing)))
    selected = [row for row in rows if not selected_paths or row["path"] in selected_paths]
    package_names = {row["archive"] for row in selected}
    if args.verify_archives and not selected_paths:
        package_names = {archive["name"] for archive in manifest["archives"]}
    destination = Path(os.path.abspath(args.destination))
    missing_rows = selected
    initial_states = {}
    if not args.verify_archives:
        check_no_links(destination)
        if destination.exists() and not destination.is_dir():
            raise RestoreError("Destination is not a directory")
        for row in selected:
            initial_states[row["path"]] = target_state(destination, row)[1]
        missing_rows = [row for row in selected if initial_states[row["path"]] == "missing"]
        if not missing_rows:
            return {"mode": "restore", "restored": 0, "unchanged": len(selected), "selected": len(selected)}
        package_names = {row["archive"] for row in missing_rows}
    package_paths = {}
    for record in manifest["archives"]:
        if record["name"] in package_names:
            package_paths[record["name"]] = get_archive(manifest, record, args.cache, args.archive_dir)
    # Complete preflight of every selected package before creating destination files.
    verified = 0
    for name, filename in package_paths.items():
        check_rows = [row for row in (rows if args.verify_archives else missing_rows) if row["archive"] == name]
        with zipfile.ZipFile(filename, "r") as archive:
            inspect_zip(archive, {row["entry"]: row for row in check_rows}, full=args.verify_archives)
        verified += len(check_rows)
    if args.verify_archives:
        return {"mode": "verify", "archives": len(package_paths), "verifiedFiles": verified, "restored": 0}
    # Recheck all destinations after downloads, before the first write.
    states = [(row, *target_state(destination, row)) for row in selected]
    for row, _, state in states:
        if state == "missing" and initial_states[row["path"]] == "unchanged":
            raise RestoreError(f"Destination disappeared after preflight; retry: {row['path']}")
    restored = skipped = 0
    for row, target, state in states:
        if state == "unchanged":
            skipped += 1
            continue
        with zipfile.ZipFile(package_paths[row["archive"]], "r") as archive:
            write_new_file(target, archive, row)
        restored += 1
    return {"mode": "restore", "restored": restored, "unchanged": skipped, "selected": len(selected)}


def parser():
    result = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    result.add_argument("--manifest", type=Path, default=REPO / "docs/_ops/github-storage/archive-20261017.json")
    selection = result.add_mutually_exclusive_group()
    selection.add_argument("--path", action="append", help="Exact repository-relative path; repeat for multiple files")
    selection.add_argument("--all", action="store_true", help="Explicitly select every archived file")
    result.add_argument("--destination", type=Path, default=REPO)
    result.add_argument("--cache", type=Path, default=REPO / ".tmp/git-storage-cache")
    result.add_argument("--archive-dir", type=Path, help="Use local ZIPs only; never download")
    result.add_argument("--verify-archives", action="store_true", help="Verify package payloads only; no destination writes")
    return result


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        result = run(parser().parse_args(argv))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (RestoreError, OSError, ValueError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        print(f"Restore stopped: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
