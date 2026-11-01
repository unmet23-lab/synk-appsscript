#!/usr/bin/env python3
"""Synthetic offline recovery contracts. Never reads production data or credentials."""
import copy
from contextlib import closing
import hashlib
import gzip
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("disaster-restore.py")
SPEC = importlib.util.spec_from_file_location("synk_disaster_restore_under_test", SCRIPT)
RESTORE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RESTORE)
ROOT = "synk-workspace-2026-10-11T10-00-00-000Z"
RELEASE = "/opt/synk/releases/synthetic-release"
RELEASE_FILE = "host" + RELEASE + "/release-manifest.json"
SECRET = "SYNTHETIC_PRIVATE_SENTINEL_NOT_A_CREDENTIAL"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf8")


def tar_bytes(records, compressed=True):
    """Records are (name, bytes[, tar type]); deliberate invalid members are supported."""
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode="w:gz" if compressed else "w", format=tarfile.USTAR_FORMAT) as archive:
        for record in records:
            name, data = record[:2]
            kind = record[2] if len(record) == 3 else tarfile.REGTYPE
            info = tarfile.TarInfo(name)
            info.type = kind
            info.mode = 0o600
            info.uid = info.gid = 1000
            info.mtime = 0
            info.size = len(data) if kind == tarfile.REGTYPE else 0
            if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                info.linkname = "../" + SECRET
            archive.addfile(info, io.BytesIO(data) if info.isfile() else None)
    return result.getvalue()


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="synk-synthetic-recovery-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.directory.chmod(0o700)
        self.serial = 0
        company = self.directory / "fixture-company.sqlite"
        messenger = self.directory / "fixture-messenger.sqlite"
        with closing(sqlite3.connect(company)) as database, database:
            database.execute("CREATE TABLE documents (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL)")
            database.execute("INSERT INTO documents VALUES (?, ?, ?)", ("synthetic-company-user", "users", json.dumps({"name": SECRET})))
        with closing(sqlite3.connect(messenger)) as database, database:
            database.execute("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL)")
            database.execute("INSERT INTO users VALUES (?, ?)", ("synthetic-messenger-user", SECRET))
        self.links = [{"companyUserId": "synthetic-company-user", "messengerUserId": "synthetic-messenger-user"}]
        self.data_manifest = {"version": 1, "company": "company", "messenger": "messenger", "identityLinks": self.links}
        self.data_records = [
            (ROOT + "/COMPLETE", b"ok\n"),
            (ROOT + "/integration-manifest.json", json_bytes(self.data_manifest)),
            (ROOT + "/company/company.sqlite", company.read_bytes()),
            (ROOT + "/company/encryption.key", bytes(range(32))),
            (ROOT + "/messenger/messenger.sqlite", messenger.read_bytes()),
            (ROOT + "/messenger/drive-storage.json", json_bytes({"fixture": SECRET})),
        ]
        layer = tar_bytes([("synthetic-layer.txt", b"synthetic image content")], compressed=False)
        self.image_config = json_bytes({"architecture": "amd64", "os": "linux", "rootfs": {"type": "layers", "diff_ids": ["sha256:" + sha(layer)]}})
        self.image_id = "sha256:" + sha(self.image_config)
        self.image_records = [
            ("manifest.json", json_bytes([{"Config": "config.json", "RepoTags": ["synthetic:recovery"], "Layers": ["layer/layer.tar"]}])),
            ("config.json", self.image_config),
            ("layer/layer.tar", layer),
        ]

    def new_path(self, name="prepared"):
        self.serial += 1
        return self.directory / (name + "-" + str(self.serial))

    def oci_image_records(self, *, absent_foreign_platform=False, incomplete_present_branch=False):
        """Docker29 save: index roots identify images while legacy entries identify configs."""
        index_type = "application/vnd.oci.image.index.v1+json"
        image_type = "application/vnd.oci.image.manifest.v1+json"
        config_type = "application/vnd.oci.image.config.v1+json"
        layer_type = "application/vnd.oci.image.layer.v1.tar"
        blobs = {}

        def descriptor(raw, media_type):
            digest = sha(raw)
            blobs["blobs/sha256/" + digest] = raw
            return {"mediaType": media_type, "digest": "sha256:" + digest, "size": len(raw)}

        config = descriptor(self.image_config, config_type)
        layer = descriptor(self.image_records[2][1], layer_type)
        image_value = {"schemaVersion": 2, "mediaType": image_type, "config": config, "layers": [layer]}
        local_image = descriptor(json_bytes(image_value), image_type)
        local_image["platform"] = {"architecture": "amd64", "os": "linux"}
        branches = [local_image]
        if absent_foreign_platform:
            # Its image manifest is not saved locally; this is valid for a
            # multi-platform index exported on one machine without --all.
            foreign_raw = json_bytes({"synthetic": "not-downloaded-arm64-image"})
            branches.append({"mediaType": image_type, "digest": "sha256:" + sha(foreign_raw), "size": len(foreign_raw),
                             "platform": {"architecture": "arm64", "os": "linux"}})
        incomplete_path = None
        if incomplete_present_branch:
            # This manifest IS present, so its referenced layer must exist.
            # Keep the complete local branch and legacy manifest valid to
            # ensure the graph validator cannot silently skip this damage.
            missing_layer = b"synthetic missing retained image layer"
            damaged_image = {"schemaVersion": 2, "mediaType": image_type, "config": config,
                             "layers": [{"mediaType": layer_type, "digest": "sha256:" + sha(missing_layer), "size": len(missing_layer)}]}
            retained_image = descriptor(json_bytes(damaged_image), image_type)
            retained_image["platform"] = {"architecture": "arm64", "os": "linux"}
            incomplete_path = "blobs/sha256/" + retained_image["digest"].split(":", 1)[1]
            branches.append(retained_image)
        root = descriptor(json_bytes({"schemaVersion": 2, "mediaType": index_type, "manifests": branches}), index_type)
        config_path = "blobs/sha256/" + config["digest"].split(":", 1)[1]
        layer_path = "blobs/sha256/" + layer["digest"].split(":", 1)[1]
        records = [
            ("oci-layout", json_bytes({"imageLayoutVersion": "1.0.0"})),
            ("index.json", json_bytes({"schemaVersion": 2, "mediaType": index_type, "manifests": [root]})),
            ("manifest.json", json_bytes([{"Config": config_path, "RepoTags": None, "Layers": [layer_path]}])),
            *blobs.items(),
        ]
        paths = {"root": "blobs/sha256/" + root["digest"].split(":", 1)[1],
                 "manifest": "blobs/sha256/" + local_image["digest"].split(":", 1)[1],
                 "config": config_path, "layer": layer_path, "incompleteManifest": incomplete_path}
        return records, root["digest"], paths

    def validate_oci_records(self, records, image_id):
        image_archive = self.new_path("oci-image").with_suffix(".tar")
        raw = tar_bytes(records, compressed=False)
        image_archive.write_bytes(raw)
        try:
            return RESTORE.validate_images(image_archive, [{"imageId": image_id}])
        finally:
            self.assertEqual(image_archive.read_bytes(), raw, "image validation must not change its input")

    def bundle(self, *, data=None, images=None, mutate_manifest=None, mutate_payload=None, extra=()):
        app = b"// synthetic pinned application\n"
        release = json_bytes({"files": [{"path": "app.mjs", "bytes": len(app), "sha256": sha(app)}]})
        payload = {
            "data/workspace.tar.gz": tar_bytes(self.data_records if data is None else data),
            "images/images.tar": tar_bytes(self.image_records if images is None else images, compressed=False),
            RELEASE_FILE: release,
            "host" + RELEASE + "/app.mjs": app,
            "host/etc/synk/company.env": ("SYNTHETIC_TOKEN=" + SECRET + "\n").encode(),
        }
        manifest = {
            "format": RESTORE.FORMAT,
            "releaseRoot": RELEASE,
            "companyVolume": "/srv/synk/synthetic-company",
            "releaseManifestSha256": sha(release),
            "dataArchive": "data/workspace.tar.gz",
            "images": [{"imageId": self.image_id}],
            "files": [{"path": name, "size": len(raw), "sha256": sha(raw), "mode": 0o600, "uid": 0, "gid": 0}
                      for name, raw in payload.items()],
        }
        if mutate_manifest:
            mutate_manifest(manifest)
        if mutate_payload:
            mutate_payload(payload)
        raw = tar_bytes([(RESTORE.MANIFEST, json_bytes(manifest)), *payload.items(), *extra])
        archive = self.new_path("recovery").with_suffix(".tar.gz")
        archive.write_bytes(raw)
        return archive, sha(raw), manifest

    def data_changed(self, relative, raw=None, remove=False):
        name = ROOT + "/" + relative
        return [record if record[0] != name else (name, raw) for record in self.data_records if not (remove and record[0] == name)]

    def rejected(self, code, *, prepare=False, **options):
        archive, trusted_sha, _ = self.bundle(**options)
        original = archive.read_bytes()
        target = self.new_path()
        with self.assertRaisesRegex(RESTORE.Rejected, "^" + code + "$"):
            if prepare:
                RESTORE.restore_archive(archive, trusted_sha, target)
            else:
                RESTORE.verify_archive(archive, trusted_sha)
        self.assertEqual(archive.read_bytes(), original)
        if target.exists():
            self.assertTrue((target / "PREPARATION_INCOMPLETE").is_file())
            self.assertFalse((target / "OFFLINE-RESTORE-RESULT.json").exists())
        return target

    def test_valid_prepare_preserves_sources_key_links_and_both_markers_without_claiming_live_acceptance(self):
        archive, trusted_sha, _ = self.bundle()
        original = {path.name: path.read_bytes() for path in self.directory.iterdir() if path.is_file()}
        target = self.new_path()
        result = RESTORE.restore_archive(archive, trusted_sha, target)
        self.assertEqual(result["status"], "offline-candidate-prepared")
        self.assertEqual(result["data"]["databaseCount"], 2)
        self.assertEqual(result["data"]["tableCounts"], [1, 1])
        self.assertEqual(result["data"]["identityLinkCount"], 1)
        self.assertEqual(result["imageCount"], 1)
        for key in ("credentialDecryptionChecked", "applicationStartupChecked"):
            self.assertIs(result[key], False)
        for key in ("productionTrafficAllowed", "crossDatabaseSameInstant"):
            self.assertIs(result["data"][key], False)
        for key in ("servicesStarted", "networkRequests", "livePathsWritten"):
            self.assertEqual(result[key], 0)
        volume = target / "prepared-company"
        self.assertTrue((target / "PREPARATION_INCOMPLETE").is_file())
        self.assertTrue((volume / "PREPARATION_INCOMPLETE").is_file())
        self.assertEqual((volume / "encryption.key").read_bytes(), bytes(range(32)))
        self.assertEqual(json.loads((volume / "workspace-integration.json").read_text()), {"identityLinks": self.links})
        self.assertEqual((volume / "company.sqlite").read_bytes(), original["fixture-company.sqlite"])
        self.assertEqual((volume / "messenger/messenger.sqlite").read_bytes(), original["fixture-messenger.sqlite"])
        self.assertEqual(json.loads((target / "OFFLINE-RESTORE-RESULT.json").read_text()), result)
        self.assertNotIn(SECRET, json.dumps(result))
        for name, raw in original.items():
            self.assertEqual((self.directory / name).read_bytes(), raw)
        if os.name == "posix":
            for path in target.rglob("*"):
                self.assertEqual(path.stat().st_mode & 0o077, 0, str(path.relative_to(target)))

    def test_verification_reads_payload_in_archive_order_with_bounded_rewinds(self):
        archive, _, manifest = self.bundle()
        with tarfile.open(archive, 'r:gz') as reader:
            payload = [(member.name, reader.extractfile(member).read()) for member in reader
                       if member.isfile() and member.name != RESTORE.MANIFEST]
        for index in range(32):
            name, raw = 'host/synthetic/file-%02d' % index, bytes([index]) * 65536
            payload.append((name, raw))
            manifest['files'].append({'path': name, 'size': len(raw), 'sha256': sha(raw), 'mode': 0o600, 'uid': 0, 'gid': 0})
        # Valid manifests need not have the same ordering as their tar members.
        raw = tar_bytes([(RESTORE.MANIFEST, json_bytes(manifest)), *reversed(payload)])
        archive.write_bytes(raw)
        backwards = []
        original = gzip.GzipFile.seek
        def seek(stream, offset, whence=0):
            if whence == 0 and offset < stream.tell():
                backwards.append((stream.tell(), offset))
            return original(stream, offset, whence)
        with patch.object(gzip.GzipFile, 'seek', seek):
            self.assertEqual(RESTORE.verify_archive(archive, sha(raw)), manifest)
        self.assertLessEqual(len(backwards), 2, 'gzip must not restart once per payload file')

    def test_metadata_cache_budget_falls_back_without_changing_validation(self):
        archive, trusted_sha, manifest = self.bundle()
        with patch.object(RESTORE, 'MAX_VERIFY_CACHE', 0):
            self.assertEqual(RESTORE.verify_archive(archive, trusted_sha), manifest)
            self.rejected('PAYLOAD_SHA256_MISMATCH', mutate_payload=lambda payload: payload.__setitem__(RELEASE_FILE, payload[RELEASE_FILE][:-1] + b'!'))

    def test_verify_does_not_extract_or_write(self):
        archive, trusted_sha, manifest = self.bundle()
        before = {p.name: p.read_bytes() for p in self.directory.iterdir()}
        self.assertEqual(RESTORE.verify_archive(archive, trusted_sha), manifest)
        self.assertEqual({p.name: p.read_bytes() for p in self.directory.iterdir()}, before)

    def test_wrong_or_missing_trusted_hash_rejects_before_destination_creation(self):
        archive, _, _ = self.bundle()
        for trusted_sha, code in [("0" * 64, "ARCHIVE_SHA256_MISMATCH"), ("not-a-hash", "TRUSTED_SHA256_REQUIRED"), (None, "TRUSTED_SHA256_REQUIRED")]:
            with self.subTest(code=code, sha=trusted_sha):
                target = self.new_path()
                with self.assertRaisesRegex(RESTORE.Rejected, "^" + code + "$"):
                    RESTORE.restore_archive(archive, trusted_sha, target)
                self.assertFalse(target.exists())

    def test_changed_payload_with_valid_outer_hash_rejects_manifest_hash_mismatch(self):
        self.rejected("PAYLOAD_SHA256_MISMATCH", mutate_payload=lambda payload: payload.__setitem__("host" + RELEASE + "/app.mjs", b"X" * len(payload["host" + RELEASE + "/app.mjs"])))

    def test_release_manifest_and_release_entry_hashes_are_independently_checked(self):
        self.rejected("RELEASE_MANIFEST_MISMATCH", mutate_manifest=lambda manifest: manifest.__setitem__("releaseManifestSha256", "0" * 64))
        def edit_release(payload):
            value = json.loads(payload[RELEASE_FILE])
            value["files"][0]["sha256"] = "0" * 64
            payload[RELEASE_FILE] = json_bytes(value)
        archive, _, manifest = self.bundle(mutate_payload=edit_release)
        with tarfile.open(archive, "r:gz") as stream:
            payload = {member.name: stream.extractfile(member).read() for member in stream if member.isfile() and member.name != RESTORE.MANIFEST}
        manifest["releaseManifestSha256"] = sha(payload[RELEASE_FILE])
        for row in manifest["files"]:
            row["size"], row["sha256"] = len(payload[row["path"]]), sha(payload[row["path"]])
        raw = tar_bytes([(RESTORE.MANIFEST, json_bytes(manifest)), *payload.items()])
        archive.write_bytes(raw)
        with self.assertRaisesRegex(RESTORE.Rejected, "^RELEASE_PAYLOAD_MISMATCH$"):
            RESTORE.verify_archive(archive, sha(raw))

    def test_missing_original_key_is_never_recreated(self):
        target = self.rejected("DATA_SNAPSHOT_INCOMPLETE", prepare=True, data=self.data_changed("company/encryption.key", remove=True))
        self.assertFalse((target / "prepared-company/encryption.key").exists())

    def test_invalid_original_key_length_rejects(self):
        for size in (0, 31, 33):
            with self.subTest(size=size):
                self.rejected("ORIGINAL_KEY_MISSING", prepare=True, data=self.data_changed("company/encryption.key", b"K" * size))

    def test_incomplete_snapshot_and_nonempty_wal_reject(self):
        self.rejected("DATA_COMPLETE_INVALID", prepare=True, data=self.data_changed("COMPLETE", b"incomplete\n"))
        self.rejected("SNAPSHOT_NONEMPTY_WAL", prepare=True, data=[*self.data_records, (ROOT + "/company/company.sqlite-wal", b"uncommitted synthetic bytes")])

    def test_missing_and_duplicate_identity_links_reject(self):
        for links in ([{"companyUserId": "absent", "messengerUserId": "synthetic-messenger-user"}],
                      [{"companyUserId": "synthetic-company-user", "messengerUserId": "absent"}], self.links * 2):
            with self.subTest(links=links):
                value = {**self.data_manifest, "identityLinks": links}
                self.rejected("IDENTITY_LINK_INVALID", prepare=True, data=self.data_changed("integration-manifest.json", json_bytes(value)))

    def test_missing_docker_layer_and_wrong_image_identity_reject(self):
        self.rejected("DOCKER_LAYER_MISSING", prepare=True, images=[record for record in self.image_records if record[0] != "layer/layer.tar"])
        self.rejected("DOCKER_IMAGE_SET_MISMATCH", prepare=True, mutate_manifest=lambda value: value.__setitem__("images", [{"imageId": "sha256:" + "0" * 64}]))

    def test_oci_root_image_digest_accepts_complete_chain_and_unsaved_foreign_platform(self):
        for unsaved_foreign in (False, True):
            with self.subTest(unsaved_foreign=unsaved_foreign):
                records, image_id, _ = self.oci_image_records(absent_foreign_platform=unsaved_foreign)
                self.assertNotEqual(image_id, self.image_id, "OCI root identity must not be confused with the config digest")
                self.assertEqual(self.validate_oci_records(records, image_id), 1)

    def test_oci_wrong_root_digest_or_different_legacy_config_set_reject(self):
        records, image_id, paths = self.oci_image_records()
        for incorrect in ("sha256:" + "0" * 64, self.image_id):
            with self.subTest(expected_image=incorrect):
                with self.assertRaises(RESTORE.Rejected):
                    self.validate_oci_records(records, incorrect)
        other_config = json_bytes({"architecture": "amd64", "os": "linux", "synthetic": "unrelated legacy config"})
        other_path = "blobs/sha256/" + sha(other_config)
        legacy = json_bytes([{"Config": other_path, "RepoTags": None, "Layers": [paths["layer"]]}])
        mismatched = [(name, legacy if name == "manifest.json" else body) for name, body in records]
        mismatched.append((other_path, other_config))
        with self.assertRaises(RESTORE.Rejected):
            self.validate_oci_records(mismatched, image_id)

    def test_oci_existing_blob_hash_tampering_rejects_at_every_graph_level(self):
        records, image_id, paths = self.oci_image_records()
        for level in ("root", "manifest", "config", "layer"):
            with self.subTest(level=level):
                changed = []
                for name, body in records:
                    # JSON remains parseable and byte length remains equal;
                    # layer mutation stays a regular tar payload. The digest,
                    # rather than an unrelated syntax/size check, must fail.
                    if name == paths[level]:
                        if level == "layer":
                            body = body.replace(b"synthetic image content", b"tampered! image content", 1)
                        elif level == "config":
                            body = body.replace(b'"amd64"', b'"arm64"', 1)
                        else:
                            body = body.replace(b': ', b':\t', 1)
                    changed.append((name, body))
                self.assertNotEqual(changed, records)
                with self.assertRaises(RESTORE.Rejected):
                    self.validate_oci_records(changed, image_id)

    def test_oci_no_complete_chain_or_missing_layer_of_present_manifest_reject(self):
        records, image_id, paths = self.oci_image_records(absent_foreign_platform=True)
        without_manifest = [(name, body) for name, body in records if name != paths["manifest"]]
        with self.subTest(case="no complete image config reachable from root"):
            with self.assertRaises(RESTORE.Rejected):
                self.validate_oci_records(without_manifest, image_id)
        records, image_id, paths = self.oci_image_records(incomplete_present_branch=True)
        self.assertTrue(any(name == paths["incompleteManifest"] for name, _ in records))
        with self.subTest(case="present manifest has missing layer despite another complete branch"):
            with self.assertRaises(RESTORE.Rejected):
                self.validate_oci_records(records, image_id)

    def test_oci_attestations_are_verified_but_never_count_as_runnable_images(self):
        def with_attestation(marker, only=False):
            records, _, paths = self.oci_image_records()
            values = dict(records)
            root = json.loads(values.pop(paths["root"]))
            runnable_digest = root["manifests"][0]["digest"]

            def add_blob(raw, media_type):
                digest = "sha256:" + sha(raw)
                path = "blobs/sha256/" + digest[7:]
                values[path] = raw
                return {"mediaType": media_type, "digest": digest, "size": len(raw)}, path

            config, config_path = add_blob(b"{}", "application/vnd.oci.image.config.v1+json")
            layer, layer_path = add_blob(json_bytes({"_type": "https://in-toto.io/Statement/v0.1", "predicateType": "synthetic"}), "application/vnd.in-toto+json")
            attestation = {"schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json", "config": config, "layers": [layer]}
            if marker in ("artifactType", "both"):
                attestation["artifactType"] = "application/vnd.docker.attestation.manifest.v1+json"
            descriptor, manifest_path = add_blob(json_bytes(attestation), attestation["mediaType"])
            descriptor["platform"] = {"architecture": "unknown", "os": "unknown"}
            if marker in ("annotation", "both"):
                descriptor["annotations"] = {"vnd.docker.reference.type": "attestation-manifest", "vnd.docker.reference.digest": runnable_digest}
            root["manifests"] = [descriptor] if only else [*root["manifests"], descriptor]
            root_descriptor, _ = add_blob(json_bytes(root), "application/vnd.oci.image.index.v1+json")
            index = json.loads(values["index.json"])
            index["manifests"] = [root_descriptor]
            values["index.json"] = json_bytes(index)
            return list(values.items()), root_descriptor["digest"], {"manifest": manifest_path, "config": config_path, "layer": layer_path}

        # The live Docker export contains both BuildKit's artifactType marker
        # and a Caddy attestation with only descriptor annotations.
        for marker in ("annotation", "artifactType", "both"):
            records, image_id, paths = with_attestation(marker)
            with self.subTest(marker=marker, case="complete image plus attestation"):
                self.assertEqual(self.validate_oci_records(records, image_id), 1)
            for level in ("manifest", "config", "layer"):
                with self.subTest(marker=marker, case="tampered attestation", level=level):
                    changed = []
                    for name, body in records:
                        if name == paths[level]:
                            if level == "config":
                                body = b"[]"
                            elif level == "layer":
                                body = body.replace(b"synthetic", b"tampered!", 1)
                            else:
                                body = body.replace(b": ", b":\t", 1)
                        changed.append((name, body))
                    self.assertNotEqual(changed, records)
                    with self.assertRaisesRegex(RESTORE.Rejected, "^OCI_BLOB_HASH_MISMATCH$"):
                        self.validate_oci_records(changed, image_id)
            records, image_id, _ = with_attestation(marker, only=True)
            with self.subTest(marker=marker, case="attestation-only root"):
                with self.assertRaisesRegex(RESTORE.Rejected, "^OCI_NO_COMPLETE_PLATFORM$"):
                    self.validate_oci_records(records, image_id)

    def test_outer_path_traversal_absolute_backslash_and_drive_paths_reject_without_escape(self):
        for name in ("../escaped", "/absolute", "host\\escaped", "C:/escaped", "host/./escaped", "host//escaped"):
            with self.subTest(name=name):
                self.rejected("UNSAFE_ARCHIVE_PATH", extra=[(name, SECRET.encode())])
        self.assertFalse((self.directory.parent / "escaped").exists())

    def test_nested_data_path_traversal_and_absolute_paths_reject(self):
        for name in (ROOT + "/../../escaped", "/absolute", ROOT + "\\escaped"):
            with self.subTest(name=name):
                self.rejected("UNSAFE_ARCHIVE_PATH", prepare=True, data=[*self.data_records, (name, SECRET.encode())])

    def test_outer_and_nested_links_special_files_reject(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE, tarfile.BLKTYPE):
            with self.subTest(layer="outer", kind=kind):
                self.rejected("LINK_OR_SPECIAL_FILE", extra=[("special", b"", kind)])
            with self.subTest(layer="data", kind=kind):
                self.rejected("LINK_OR_SPECIAL_FILE", prepare=True, data=[*self.data_records, (ROOT + "/special", b"", kind)])
            with self.subTest(layer="image", kind=kind):
                self.rejected("LINK_OR_SPECIAL_FILE", prepare=True, images=[*self.image_records, ("special", b"", kind)])

    def test_duplicate_archive_and_manifest_paths_reject(self):
        self.rejected("DUPLICATE_ARCHIVE_PATH", extra=[("host/etc/synk/company.env", SECRET.encode())])
        self.rejected("DUPLICATE_MANIFEST_PATH", mutate_manifest=lambda manifest: manifest["files"].append(copy.deepcopy(manifest["files"][0])))
        self.rejected("DUPLICATE_ARCHIVE_PATH", prepare=True, data=[*self.data_records, self.data_records[0]])
        self.rejected("DUPLICATE_ARCHIVE_PATH", prepare=True, images=[*self.image_records, self.image_records[0]])

    def test_unlisted_extra_file_directory_and_missing_declared_file_reject(self):
        self.rejected("ARCHIVE_FILE_SET_MISMATCH", extra=[("unlisted", SECRET.encode())])
        self.rejected("UNLISTED_DIRECTORY", extra=[("unlisted/", b"", tarfile.DIRTYPE)])
        self.rejected("ARCHIVE_FILE_SET_MISMATCH", mutate_payload=lambda payload: payload.pop("host/etc/synk/company.env"))

    def test_existing_destination_preserves_every_existing_byte(self):
        archive, trusted_sha, _ = self.bundle()
        target = self.new_path()
        target.mkdir()
        sentinel = target / "existing.txt"
        sentinel.write_text(SECRET)
        with self.assertRaisesRegex(RESTORE.Rejected, "^DESTINATION_ALREADY_EXISTS$"):
            RESTORE.restore_archive(archive, trusted_sha, target)
        self.assertEqual(list(target.iterdir()), [sentinel])
        self.assertEqual(sentinel.read_text(), SECRET)

    def make_link_or_skip(self, path, target, directory=False):
        try:
            path.symlink_to(target, target_is_directory=directory)
        except OSError as error:
            if os.name == "nt" and getattr(error, "winerror", None) == 1314:
                self.skipTest("Windows has not granted symlink creation; run this contract on Linux")
            raise

    def test_symlink_destination_is_rejected_without_writing_target(self):
        archive, trusted_sha, _ = self.bundle()
        real = self.new_path("real")
        real.mkdir()
        link = self.new_path("link")
        self.make_link_or_skip(link, real, directory=True)
        with self.assertRaisesRegex(RESTORE.Rejected, "^DESTINATION_ALREADY_EXISTS$"):
            RESTORE.restore_archive(archive, trusted_sha, link)
        self.assertEqual(list(real.iterdir()), [])

    def test_symlink_destination_parent_is_rejected_without_writing_target(self):
        archive, trusted_sha, _ = self.bundle()
        real = self.new_path("real")
        real.mkdir()
        link = self.new_path("link")
        self.make_link_or_skip(link, real, directory=True)
        with self.assertRaisesRegex(RESTORE.Rejected, "^SYMLINK_DESTINATION_PARENT$"):
            RESTORE.restore_archive(archive, trusted_sha, link / "prepared")
        self.assertEqual(list(real.iterdir()), [])

    def test_symlink_input_archive_is_rejected(self):
        archive, trusted_sha, _ = self.bundle()
        link = self.new_path("linked-archive")
        self.make_link_or_skip(link, archive)
        with self.assertRaisesRegex(RESTORE.Rejected, "^REGULAR_ARCHIVE_REQUIRED$"):
            RESTORE.verify_archive(link, trusted_sha)

    def test_cli_sanitizes_archive_format_and_sqlite_errors_without_secret_or_paths(self):
        cases = [
            self.bundle(extra=[("../" + SECRET, b"synthetic")]),
            self.bundle(data=self.data_changed("company/company.sqlite", (SECRET + " not sqlite").encode())),
            self.bundle(data=self.data_changed("integration-manifest.json", (SECRET + " not json").encode())),
        ]
        for archive, trusted_sha, _ in cases:
            with self.subTest(archive=archive.name):
                target = self.new_path()
                result = subprocess.run([sys.executable, str(SCRIPT), "prepare", str(archive), "--sha256", trusted_sha, "--destination", str(target)], capture_output=True, text=True, timeout=15)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stderr, "")
                output = json.loads(result.stdout)
                self.assertEqual(output["status"], "rejected")
                self.assertNotIn(SECRET, result.stdout)
                self.assertNotIn(str(self.directory), result.stdout)
                self.assertNotIn("Traceback", result.stdout)
                if target.exists():
                    self.assertTrue((target / "PREPARATION_INCOMPLETE").exists())
                    self.assertFalse((target / "OFFLINE-RESTORE-RESULT.json").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
