"""Offline preservation checks: python -B tests/git-storage-restore.test.py."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import zipfile


sys.dont_write_bytecode = True
TOOL = Path(__file__).absolute().parents[1] / "tools/git-storage-restore.py"
SPEC = importlib.util.spec_from_file_location("storage_restore", TOOL)
restore = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(restore)


def sha(data):
    return hashlib.sha256(data).hexdigest()


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="synk-storage-test-")
        self.root = Path(self.temp.name)
        self.archives = self.root / "archives"
        self.archives.mkdir()
        self.destination = self.root / "destination"
        self.cache = self.root / "cache"
        self.manifest_path = self.root / "manifest.json"
        self.payload = {"docs/그림/원본.png": b"original image", "docs/qa/second.png": b"second image"}
        self.manifest = {"version": 1, "repository": "example/private", "release": {"tag": "archive-test", "id": 1},
                         "archives": [], "files": [], "createdAt": "2026-10-17", "baseCommit": "0" * 40}
        self.make_archive()

    def tearDown(self):
        self.temp.cleanup()

    def save(self):
        self.manifest_path.write_text(json.dumps(self.manifest, ensure_ascii=False), encoding="utf-8")

    def make_archive(self, extra=None):
        filename = self.archives / "source.zip"
        with zipfile.ZipFile(filename, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in self.payload.items():
                archive.writestr(name, data)
            if extra:
                archive.writestr(*extra)
        content = filename.read_bytes()
        self.manifest["archives"] = [{"name": filename.name, "assetId": 2, "bytes": len(content), "sha256": sha(content)}]
        self.manifest["files"] = [{"path": name, "archive": filename.name, "entry": name,
                                   "bytes": len(data), "sha256": sha(data), "gitBlob": "0" * 40,
                                   "classification": "qa"} for name, data in self.payload.items()]
        self.save()

    def args(self, *extra, online=False):
        args = ["--manifest", str(self.manifest_path), "--destination", str(self.destination), "--cache", str(self.cache)]
        if not online:
            args += ["--archive-dir", str(self.archives)]
        return restore.parser().parse_args(args + list(extra))

    def test_default_is_summary_without_network_or_writes(self):
        with mock.patch.object(restore.subprocess, "run", side_effect=AssertionError("network")):
            result = restore.run(self.args(online=True))
        self.assertEqual(result["mode"], "summary")
        self.assertFalse(self.destination.exists())
        self.assertFalse(self.cache.exists())

    def test_all_restores_exact_bytes_then_skips_existing_files(self):
        result = restore.run(self.args("--all"))
        self.assertEqual(result["restored"], 2)
        for name, data in self.payload.items():
            self.assertEqual((self.destination / name).read_bytes(), data)
        result = restore.run(self.args("--all"))
        self.assertEqual(result["unchanged"], 2)
        self.assertEqual(result["restored"], 0)

    def test_partial_restore_writes_only_exact_selected_path(self):
        name = next(iter(self.payload))
        result = restore.run(self.args("--path", name))
        self.assertEqual(result["selected"], 1)
        self.assertTrue((self.destination / name).is_file())
        self.assertFalse((self.destination / "docs/qa/second.png").exists())

    def test_all_existing_files_skip_packages_without_network_or_cache_writes(self):
        restore.run(self.args("--all"))
        with mock.patch.object(restore.subprocess, "run", side_effect=AssertionError("network")):
            result = restore.run(self.args("--all", online=True))
        self.assertEqual(result, {"mode": "restore", "restored": 0, "unchanged": 2, "selected": 2})
        self.assertFalse(self.cache.exists())

    def test_existing_modified_original_blocks_every_destination_write(self):
        changed = self.destination / "docs/qa/second.png"
        changed.parent.mkdir(parents=True)
        changed.write_bytes(b"new user original")
        with self.assertRaisesRegex(restore.RestoreError, "Existing file differs"):
            restore.run(self.args("--all"))
        self.assertEqual(changed.read_bytes(), b"new user original")
        self.assertFalse((self.destination / next(iter(self.payload))).exists())

    def test_archive_sha_mismatch_prevents_creation(self):
        filename = self.archives / "source.zip"
        data = bytearray(filename.read_bytes())
        data[-1] ^= 1
        filename.write_bytes(data)
        with self.assertRaisesRegex(restore.RestoreError, "archive size or SHA-256 mismatch"):
            restore.run(self.args("--all"))
        self.assertFalse(self.destination.exists())

    def test_entry_sha_mismatch_prevents_all_creation(self):
        self.manifest["files"][-1]["sha256"] = "0" * 64
        self.save()
        with self.assertRaisesRegex(restore.RestoreError, "ZIP entry SHA-256 mismatch"):
            restore.run(self.args("--all"))
        self.assertFalse(self.destination.exists())

    def test_manifest_path_traversal_and_windows_absolute_names_are_rejected(self):
        for bad in ("../outside.png", "/outside.png", "C:/outside.png", "docs/../outside.png", "docs\\outside.png", "docs/NUL.png"):
            with self.subTest(path=bad):
                self.manifest["files"][0]["path"] = bad
                self.save()
                with self.assertRaises(restore.RestoreError):
                    restore.run(self.args("--all"))
                self.assertFalse(self.destination.exists())

    def test_unselected_zip_traversal_is_rejected_before_creation(self):
        self.make_archive(extra=("../escape.png", b"bad"))
        with self.assertRaisesRegex(restore.RestoreError, "Unsafe ZIP entry"):
            restore.run(self.args("--path", next(iter(self.payload))))
        self.assertFalse(self.destination.exists())

    def test_manifest_file_directory_collision_is_rejected_before_writes(self):
        self.manifest["files"][0]["path"] = "docs"
        self.save()
        with self.assertRaisesRegex(restore.RestoreError, "parent directory"):
            restore.run(self.args("--all"))
        self.assertFalse(self.destination.exists())

    def test_case_colliding_manifest_paths_are_rejected(self):
        self.manifest["files"][1]["path"] = self.manifest["files"][0]["path"].upper()
        self.save()
        with self.assertRaisesRegex(restore.RestoreError, "Duplicate manifest path"):
            restore.run(self.args("--all"))
        self.assertFalse(self.destination.exists())

    def test_zip_symlink_is_rejected(self):
        entry = zipfile.ZipInfo("docs/symlink")
        entry.create_system = 3
        entry.external_attr = (stat.S_IFLNK | 0o777) << 16
        self.make_archive(extra=(entry, b"../../outside"))
        with self.assertRaisesRegex(restore.RestoreError, "Non-regular ZIP entry"):
            restore.run(self.args("--all"))
        self.assertFalse(self.destination.exists())

    def test_destination_symlink_is_rejected(self):
        outside = self.root / "outside"
        outside.mkdir()
        try:
            self.destination.symlink_to(outside, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("This account cannot create directory symlinks")
        with self.assertRaisesRegex(restore.RestoreError, "Symlink or reparse point"):
            restore.run(self.args("--all"))
        self.assertEqual(list(outside.iterdir()), [])

    def test_destination_reparse_point_flag_is_rejected(self):
        target = self.root / "junction-like"
        target.mkdir()
        original = Path.lstat

        def lstat(candidate, *args, **kwargs):
            value = original(candidate, *args, **kwargs)
            if candidate == target:
                return type("ReparseStat", (), {"st_mode": value.st_mode, "st_file_attributes": 0x400})()
            return value

        with mock.patch.object(Path, "lstat", lstat), self.assertRaisesRegex(restore.RestoreError, "reparse point"):
            restore.check_no_links(target / "new.png")

    def test_tampered_cache_is_preserved_and_download_uses_new_location(self):
        self.cache.mkdir()
        damaged = self.cache / "source.zip"
        damaged.write_bytes(b"damaged cache")
        seen = []

        def download(argv, check):
            seen.append(argv)
            folder = Path(argv[argv.index("--dir") + 1])
            self.assertNotEqual(folder, self.cache)
            shutil.copyfile(self.archives / "source.zip", folder / "source.zip")

        with mock.patch.object(restore.subprocess, "run", side_effect=download):
            result = restore.run(self.args("--all", online=True))
        self.assertEqual(result["restored"], 2)
        self.assertEqual(damaged.read_bytes(), b"damaged cache")
        self.assertEqual(seen[0][:4], ["gh", "release", "download", "archive-test"])
        self.assertNotIn("--clobber", seen[0])

    def test_verified_cached_archive_requires_no_download(self):
        self.cache.mkdir()
        shutil.copyfile(self.archives / "source.zip", self.cache / "source.zip")
        with mock.patch.object(restore.subprocess, "run", side_effect=AssertionError("network")):
            self.assertEqual(restore.run(self.args("--all", online=True))["restored"], 2)

    def test_verify_archives_checks_all_payloads_without_restoring(self):
        result = restore.run(self.args("--verify-archives"))
        self.assertEqual(result["verifiedFiles"], 2)
        self.assertFalse(self.destination.exists())
        self.manifest["files"][-1]["sha256"] = "0" * 64
        self.save()
        with self.assertRaisesRegex(restore.RestoreError, "ZIP entry SHA-256 mismatch"):
            restore.run(self.args("--verify-archives", "--path", next(iter(self.payload))))

    def test_verify_rejects_unlisted_payload(self):
        self.make_archive(extra=("extra.txt", b"undeclared"))
        with self.assertRaisesRegex(restore.RestoreError, "payload list differs"):
            restore.run(self.args("--verify-archives"))
        self.assertFalse(self.destination.exists())

    def test_file_created_after_preflight_is_never_replaced(self):
        real_link = restore.os.link

        def competing_link(source, target):
            Path(target).write_bytes(b"concurrent user file")
            return real_link(source, target)

        with mock.patch.object(restore.os, "link", side_effect=competing_link), self.assertRaises(FileExistsError):
            restore.run(self.args("--path", next(iter(self.payload))))
        self.assertEqual((self.destination / next(iter(self.payload))).read_bytes(), b"concurrent user file")
        self.assertFalse(list(self.destination.rglob("*.part")))

    def test_cli_outputs_utf8_json(self):
        result = subprocess.run([sys.executable, "-B", str(TOOL), "--manifest", str(self.manifest_path)],
                                check=True, capture_output=True)
        self.assertEqual(json.loads(result.stdout.decode("utf-8"))["mode"], "summary")


if __name__ == "__main__":
    unittest.main(verbosity=2)
