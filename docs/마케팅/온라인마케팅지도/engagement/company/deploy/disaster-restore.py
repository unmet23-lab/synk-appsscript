#!/usr/bin/env python3
"""Verify a private server-recovery archive and prepare an OFFLINE copy.

This program never writes to live /etc, /opt or /srv paths, loads images,
starts a service, removes the acceptance marker, or contacts a network.
Supply the archive SHA256 from its independently retained upload receipt.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sqlite3
import stat
import sys
import tarfile

FORMAT = "synk-server-recovery/v1"
MANIFEST = "recovery-manifest.json"
MAX_FILES = 25000
MAX_BYTES = 16 * 1024 ** 3
MAX_MANIFEST = 8 * 1024 ** 2
MAX_VERIFY_CACHE = 32 * 1024 ** 2
SHA = re.compile(r"[0-9a-f]{64}\Z")
IMAGE = re.compile(r"sha256:[0-9a-f]{64}\Z")
CAPTURE_SCHEMA = "synk-server-recovery-capture/v2"
HA_RUNTIME = tuple("/opt/synk/ha/" + name for name in
                   ("controller.mjs", "failover-policy.mjs", "node-agent.mjs", "node-host.py")) + ("/opt/synk/ha-runtime/node",)
HA_PRIVATE = ("/etc/synk/ha/node.json", "/etc/synk/ha/plan.json", "/srv/synk/HA_VOLUME_IDENTITY.json")
HA_UNIT = "/etc/systemd/system/synk-ha-node.service"
HA_GUARD_NAMES = ("cloud-common.sh", "company-stack.sh", "company-health.sh", "company-backup.sh",
                  "company-backup-watch.sh", "spaceship-stack.sh", "company-compose.yaml",
                  "spaceship-compose.yaml", "check-maintenance.mjs", "maintenance-stage.sh")


class Rejected(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Rejected(code)


def file_sha(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_name(name):
    require(isinstance(name, str) and name and "\\" not in name and ":" not in name
            and "\x00" not in name and not name.startswith("/"), "UNSAFE_ARCHIVE_PATH")
    require(all(part not in ("", ".", "..") for part in name.split("/")), "UNSAFE_ARCHIVE_PATH")
    require(str(PurePosixPath(name)) == name, "UNSAFE_ARCHIVE_PATH")
    return name


def safe_absolute(name):
    require(isinstance(name, str) and name.startswith("/") and name != "/", "INVALID_HOST_PATH")
    safe_name(name[1:])
    return name


def regular_file(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and not path.is_symlink(), "REGULAR_ARCHIVE_REQUIRED")


def read_json_member(archive, member, maximum=MAX_MANIFEST):
    require(member.isfile() and member.size <= maximum, "MANIFEST_SIZE_OR_TYPE")
    with archive.extractfile(member) as stream:
        return json.loads(stream.read(maximum + 1))


def ha_reference_allowed(name):
    safe_absolute(name)
    return bool(name in (*HA_RUNTIME, *HA_PRIVATE, HA_UNIT, "/etc/synk/company.env", "/etc/synk/spaceship.env",
                         "/opt/synk/spaceship/current/deploy/compose.yaml")
                or re.fullmatch(r"/opt/synk/ha/guards/[0-9a-f]{16}/[A-Za-z0-9][A-Za-z0-9._-]{0,127}", name)
                or re.fullmatch(r"/etc/systemd/system/synk-[a-z0-9-]+\.(?:service|timer)(?:\.d/[A-Za-z0-9._-]+\.conf)?", name))


def validate_ha_recovery(manifest, planned, read_payload):
    """Validate exact inert HA dependencies; never reapply captured authority."""
    ha = manifest.get("haRecovery")
    evidence_paths = [p for p in planned if p.startswith(("host/opt/synk/ha/", "host/etc/synk/ha/"))
                      or p == "host" + HA_UNIT or "/50-synk-ha.conf" in p]
    if ha is None:
        require(manifest.get("captureSchema") != CAPTURE_SCHEMA or not evidence_paths, "HA_RECOVERY_CONTRACT_MISSING")
        return False  # Legacy v1 archives remain readable, without an HA claim.
    require(isinstance(ha, dict) and ha.get("schema") == "synk-ha-recovery/v1"
            and ha.get("automaticActivationAllowed") is False and ha.get("cloudAuthorityRestored") is False,
            "HA_RECOVERY_CONTRACT_INVALID")

    def record(name, private=False):
        require(ha_reference_allowed(name), "HA_REFERENCE_OUTSIDE_ALLOWLIST")
        item = planned.get("host" + name)
        require(item is not None, "HA_REQUIRED_FILE_MISSING")
        require(item["uid"] == 0 and (item["mode"] == 0o600 if private else not item["mode"] & 0o022), "HA_FILE_PERMISSIONS")
        return item

    def body(name):
        require(record(name)["size"] <= MAX_MANIFEST, "HA_CONFIG_TOO_LARGE")
        return json.loads(read_payload("host" + name))

    for name in (*HA_RUNTIME, HA_UNIT):
        record(name)
    for name in HA_PRIVATE:
        record(name, True)
    node, plan, marker = [body(p) for p in HA_PRIVATE]
    require(node.get("schema") == "synk-ha-node/v1" and plan.get("schema") == "synk-ha-plan/v1", "HA_CONFIG_SCHEMA")
    nodes = [plan.get("nodes", {}).get(k, {}) for k in ("primary", "standby")]
    identities = [n for n in nodes if n.get("instanceId") == node.get("nodeId")]
    require(len(identities) == 1 and identities[0].get("name") == node.get("nodeName")
            and identities[0].get("zone") == node.get("zone"), "HA_NODE_IDENTITY")
    require(node.get("planPath") == HA_PRIVATE[1] and node.get("helperPath") == HA_RUNTIME[3], "HA_RUNTIME_REFERENCE")
    require(node.get("releaseRoot") == manifest["releaseRoot"] and node.get("companyVolume") == manifest["companyVolume"]
            and node.get("releaseSha256") == manifest["releaseManifestSha256"] == plan.get("release", {}).get("manifestSha256"),
            "HA_RELEASE_CONTRACT")
    require(node.get("mount") == "/srv/synk" and node.get("diskId") == plan.get("data", {}).get("diskId") == marker.get("diskId")
            and node.get("diskName") == plan.get("data", {}).get("name")
            and isinstance(node.get("filesystemUuid"), str) and node["filesystemUuid"] == marker.get("filesystemUuid"), "HA_DISK_IDENTITY")
    require(isinstance(node.get("originalKeySha256"), str) and SHA.fullmatch(node["originalKeySha256"]), "HA_ORIGINAL_KEY_REQUIRED")
    expected = set((*HA_RUNTIME, *HA_PRIVATE, HA_UNIT))
    guards = node.get("guardFiles")
    require(isinstance(guards, list) and guards, "HA_GUARDS_REQUIRED")
    guard_paths = set()
    for item in guards:
        name = item.get("path")
        require(name not in guard_paths and record(name)["sha256"] == item.get("sha256"), "HA_GUARD_HASH_MISMATCH")
        guard_paths.add(name)
    bases = {str(PurePosixPath(p).parent) for p in guard_paths if p.startswith("/opt/synk/ha/guards/")}
    require(len(bases) == 1, "HA_GUARD_RELEASE_REQUIRED")
    base = next(iter(bases))
    require(all(base + "/" + name in guard_paths for name in HA_GUARD_NAMES), "HA_GUARD_DEPENDENCY_MISSING")
    expected.update(guard_paths)
    env_files = node.get("envFiles")
    require(isinstance(env_files, list) and len(env_files) == 2
            and {x.get("path") for x in env_files} == {"/etc/synk/company.env", "/etc/synk/spaceship.env"}, "HA_ENV_CONTRACT")
    for item in env_files:
        require(record(item["path"], True)["sha256"] == item.get("sha256"), "HA_ENV_HASH_MISMATCH")
        expected.add(item["path"])
    require(ha.get("requiredFiles") == sorted(expected), "HA_FILE_CLOSURE_MISMATCH")
    require(ha.get("runtimeSha256") == {p: record(p)["sha256"] for p in HA_RUNTIME}, "HA_RUNTIME_HASH_MISMATCH")
    require(ha.get("nodeId") == node["nodeId"] and ha.get("releaseSha256") == node["releaseSha256"]
            and ha.get("originalKeySha256") == node["originalKeySha256"], "HA_CAPTURE_IDENTITY")
    # Check literal HA references in captured systemd and guard entry points.
    # Runtime modules have an explicit fixed closure above, including dynamic imports.
    for name in guard_paths | {HA_UNIT}:
        if not name.endswith((".service", ".timer", ".conf", ".sh", ".mjs")):
            continue
        require(record(name)["size"] <= MAX_MANIFEST, "HA_ENTRYPOINT_TOO_LARGE")
        text = read_payload("host" + name).decode("utf8")
        for ref in re.findall(r'''/(?:opt/synk/ha(?:-runtime)?|etc/synk/ha)/[^\s'"`),;]+''', text):
            require(ref in expected, "HA_ENTRYPOINT_REFERENCE_MISSING")
    return True


def members_checked(archive):
    members, total = {}, 0
    for member in archive:
        # Tar directories conventionally end with '/'. No other normalization.
        name = member.name[:-1] if member.isdir() and member.name.endswith("/") else member.name
        safe_name(name)
        require(name not in members, "DUPLICATE_ARCHIVE_PATH")
        require(member.isfile() or member.isdir(), "LINK_OR_SPECIAL_FILE")
        require(member.size >= 0, "INVALID_MEMBER_SIZE")
        total += member.size
        require(len(members) < MAX_FILES and total <= MAX_BYTES, "ARCHIVE_LIMIT_EXCEEDED")
        members[name] = member
    for name in members:
        parent = PurePosixPath(name).parent
        while str(parent) != ".":
            require(str(parent) not in members or members[str(parent)].isdir(), "FILE_DIRECTORY_CONFLICT")
            parent = parent.parent
    return members


def verify_archive(archive_path, expected_sha):
    archive_path = Path(archive_path)
    regular_file(archive_path)
    require(isinstance(expected_sha, str) and SHA.fullmatch(expected_sha), "TRUSTED_SHA256_REQUIRED")
    require(file_sha(archive_path) == expected_sha, "ARCHIVE_SHA256_MISMATCH")
    with tarfile.open(archive_path, "r:gz") as archive:
        members = members_checked(archive)
        require(MANIFEST in members, "MANIFEST_MISSING")
        manifest = read_json_member(archive, members[MANIFEST])
        require(isinstance(manifest, dict) and manifest.get("format") == FORMAT, "UNSUPPORTED_FORMAT")
        require(manifest.get("captureSchema") in (None, CAPTURE_SCHEMA), "UNSUPPORTED_CAPTURE_SCHEMA")
        require(isinstance(manifest.get("files"), list) and manifest["files"], "FILE_MANIFEST_REQUIRED")
        planned = {}
        for item in manifest["files"]:
            require(isinstance(item, dict), "INVALID_FILE_RECORD")
            name = safe_name(item.get("path"))
            require(name != MANIFEST and name not in planned, "DUPLICATE_MANIFEST_PATH")
            require(type(item.get("size")) is int and 0 <= item["size"] <= MAX_BYTES, "INVALID_FILE_RECORD")
            require(isinstance(item.get("sha256"), str) and SHA.fullmatch(item["sha256"]), "INVALID_FILE_RECORD")
            require(type(item.get("mode")) is int and 0 <= item["mode"] <= 0o777, "INVALID_FILE_MODE")
            require(type(item.get("uid")) is int and item["uid"] >= 0
                    and type(item.get("gid")) is int and item["gid"] >= 0, "INVALID_FILE_OWNER")
            planned[name] = item
        actual = {name for name, member in members.items() if member.isfile() and name != MANIFEST}
        require(actual == set(planned), "ARCHIVE_FILE_SET_MISMATCH")
        # Unlisted directories must be parents of a declared payload file.
        for name, member in members.items():
            if member.isdir():
                require(any(p.startswith(name + "/") for p in planned), "UNLISTED_DIRECTORY")
        # Gzip seeks backwards by inflating again from the beginning. Manifest
        # order is independent of tar order, so hash each payload in physical
        # order and retain bounded small metadata needed by the closure checks.
        payload_cache, cache_bytes = {}, 0
        for name, item in sorted(planned.items(), key=lambda row: members[row[0]].offset_data):
            member = members[name]
            require(member.size == item["size"], "PAYLOAD_SIZE_MISMATCH")
            host_name = name[4:] if name.startswith("host/") else None
            metadata = name.endswith("/release-manifest.json") or host_name in HA_PRIVATE or (
                host_name and ha_reference_allowed(host_name)
                and host_name.endswith((".service", ".timer", ".conf", ".sh", ".mjs")))
            pieces = [] if metadata and member.size <= MAX_MANIFEST and cache_bytes + member.size <= MAX_VERIFY_CACHE else None
            digest = hashlib.sha256()
            with archive.extractfile(member) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(block)
                    if pieces is not None:
                        pieces.append(block)
            require(digest.hexdigest() == item["sha256"], "PAYLOAD_SHA256_MISMATCH")
            if pieces is not None:
                payload_cache[name] = b"".join(pieces)
                cache_bytes += member.size

        def read_payload(name):
            if name in payload_cache:
                return payload_cache[name]
            # Oversized or adversarial metadata sets retain bounded memory and
            # the original verifier's acceptance rules, at the cost of a seek.
            with archive.extractfile(members[name]) as stream:
                return stream.read(MAX_MANIFEST + 1)
        release_root = safe_absolute(manifest.get("releaseRoot"))
        safe_absolute(manifest.get("companyVolume"))
        require(isinstance(manifest.get("releaseManifestSha256"), str)
                and SHA.fullmatch(manifest["releaseManifestSha256"]), "RELEASE_HASH_REQUIRED")
        release_file = "host" + release_root + "/release-manifest.json"
        require(release_file in planned and planned[release_file]["sha256"] == manifest["releaseManifestSha256"],
                "RELEASE_MANIFEST_MISMATCH")
        require(members[release_file].isfile() and members[release_file].size <= MAX_MANIFEST, "MANIFEST_SIZE_OR_TYPE")
        release = json.loads(read_payload(release_file))
        require(isinstance(release.get("files"), list) and release["files"], "RELEASE_FILES_REQUIRED")
        seen_release = set()
        for row in release["files"]:
            relative = safe_name(row.get("path"))
            require(relative not in seen_release, "DUPLICATE_RELEASE_PATH")
            seen_release.add(relative)
            name = "host" + release_root + "/" + relative
            require(name in planned and planned[name]["sha256"] == row.get("sha256")
                    and planned[name]["size"] == row.get("bytes"), "RELEASE_PAYLOAD_MISMATCH")
        require(manifest.get("dataArchive") == "data/workspace.tar.gz"
                and "data/workspace.tar.gz" in planned, "DATA_ARCHIVE_MISSING")
        require("images/images.tar" in planned, "IMAGE_ARCHIVE_MISSING")
        require("host/etc/synk/company.env" in planned, "RUNTIME_ENVIRONMENT_MISSING")
        require(planned["host/etc/synk/company.env"]["mode"] == 0o600, "RUNTIME_ENVIRONMENT_MODE")
        images = manifest.get("images")
        require(isinstance(images, list) and images, "IMAGE_RECORDS_REQUIRED")
        for image in images:
            require(isinstance(image, dict) and isinstance(image.get("imageId"), str)
                    and IMAGE.fullmatch(image["imageId"]), "INVALID_IMAGE_RECORD")
        validate_ha_recovery(manifest, planned, read_payload)
        require(file_sha(archive_path) == expected_sha, "ARCHIVE_CHANGED_DURING_VERIFY")
        return manifest


def create_destination(destination):
    destination = Path(destination).absolute()
    require(not destination.exists() and not destination.is_symlink(), "DESTINATION_ALREADY_EXISTS")
    parent = destination.parent.resolve(strict=True)
    require(parent == destination.parent, "SYMLINK_DESTINATION_PARENT")
    if os.name == "posix":
        info = parent.stat()
        require(not info.st_mode & 0o022, "UNSAFE_DESTINATION_PARENT")
    destination.mkdir(mode=0o700)
    return destination


def extract_regular(archive, members, destination, modes=None):
    for name, member in members.items():
        if member.isdir():
            continue
        target = destination.joinpath(*name.split("/"))
        target.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        with archive.extractfile(member) as source, open(target, "xb") as output:
            shutil.copyfileobj(source, output, 1024 * 1024)
        # Keep every staged file private. The original mode is retained in the
        # manifest and is applied only by a separately accepted recovery step.
        target.chmod(0o600)


def validate_images(image_archive, expected_images):
    with tarfile.open(image_archive, "r:") as archive:
        members = members_checked(archive)
        require("manifest.json" in members, "DOCKER_MANIFEST_MISSING")
        entries = read_json_member(archive, members["manifest.json"])
        require(isinstance(entries, list) and entries, "DOCKER_MANIFEST_INVALID")
        found = set()
        for entry in entries:
            require(isinstance(entry, dict), "DOCKER_MANIFEST_INVALID")
            config = safe_name(entry.get("Config"))
            require(config in members and members[config].isfile(), "DOCKER_CONFIG_MISSING")
            require(members[config].size <= MAX_MANIFEST, "DOCKER_CONFIG_TOO_LARGE")
            with archive.extractfile(members[config]) as stream:
                raw = stream.read(MAX_MANIFEST + 1)
            require(isinstance(json.loads(raw), dict), "DOCKER_CONFIG_INVALID")
            found.add("sha256:" + hashlib.sha256(raw).hexdigest())
            require(isinstance(entry.get("Layers"), list) and entry["Layers"], "DOCKER_LAYERS_MISSING")
            for layer in entry["Layers"]:
                require(safe_name(layer) in members and members[layer].isfile(), "DOCKER_LAYER_MISSING")
        expected = {item["imageId"] for item in expected_images}
        if "index.json" in members or found != expected:
            # Docker's containerd image store identifies an image by the OCI
            # index/manifest digest instead of its config digest. docker save
            # keeps only locally available platforms of a multi-platform index.
            require("index.json" in members, "DOCKER_IMAGE_SET_MISMATCH")
            index = read_json_member(archive, members["index.json"])
            require(isinstance(index, dict) and isinstance(index.get("manifests"), list), "OCI_INDEX_INVALID")
            roots = index["manifests"]
            require({row.get("digest") for row in roots} == expected, "DOCKER_IMAGE_SET_MISMATCH")
            checked, configs = {}, set()

            def blob(descriptor, json_body=False):
                require(isinstance(descriptor, dict) and isinstance(descriptor.get("digest"), str)
                        and IMAGE.fullmatch(descriptor["digest"]), "OCI_DESCRIPTOR_INVALID")
                name = "blobs/sha256/" + descriptor["digest"][7:]
                require(name in members and members[name].isfile(), "OCI_BLOB_MISSING")
                require(type(descriptor.get("size")) is int and members[name].size == descriptor["size"], "OCI_BLOB_SIZE_MISMATCH")
                require(not json_body or members[name].size <= MAX_MANIFEST, "OCI_JSON_TOO_LARGE")
                digest, pieces = hashlib.sha256(), []
                with archive.extractfile(members[name]) as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(block)
                        if json_body:
                            pieces.append(block)
                require("sha256:" + digest.hexdigest() == descriptor["digest"], "OCI_BLOB_HASH_MISMATCH")
                return json.loads(b"".join(pieces)) if json_body else None

            def visit(descriptor, depth=0):
                require(depth <= 8 and isinstance(descriptor, dict), "OCI_GRAPH_INVALID")
                digest = descriptor.get("digest")
                require(isinstance(digest, str) and IMAGE.fullmatch(digest), "OCI_DESCRIPTOR_INVALID")
                if digest in checked:
                    return checked[digest]
                body = blob(descriptor, True)
                require(isinstance(body, dict), "OCI_GRAPH_INVALID")
                reachable = set()
                attestation = (descriptor.get("annotations") or {}).get("vnd.docker.reference.type") == "attestation-manifest" \
                    or body.get("artifactType") == "application/vnd.docker.attestation.manifest.v1+json"
                if isinstance(body.get("manifests"), list):
                    for child in body["manifests"]:
                        require(isinstance(child, dict) and isinstance(child.get("digest"), str)
                                and IMAGE.fullmatch(child["digest"]), "OCI_DESCRIPTOR_INVALID")
                        if "blobs/sha256/" + child["digest"][7:] in members:
                            reachable.update(visit(child, depth + 1))
                else:
                    require(isinstance(body.get("config"), dict) and isinstance(body.get("layers"), list)
                            and body["layers"], "OCI_IMAGE_MANIFEST_INVALID")
                    require(isinstance(blob(body["config"], True), dict), "DOCKER_CONFIG_INVALID")
                    for layer in body["layers"]:
                        blob(layer)
                    # Attestations have fully verified blobs but are not the
                    # executable configs listed in Docker's legacy manifest.
                    if not attestation:
                        reachable.add(body["config"]["digest"])
                require(reachable or attestation, "OCI_NO_COMPLETE_PLATFORM")
                checked[digest] = reachable
                return reachable

            for descriptor in roots:
                runnable = visit(descriptor)
                require(runnable, "OCI_NO_COMPLETE_PLATFORM")
                configs.update(runnable)
            require(configs == found, "OCI_CONFIG_SET_MISMATCH")
        return len(expected)


def validate_database(path):
    require(path.is_file() and not path.is_symlink(), "DATABASE_MISSING")
    uri = path.resolve().as_uri() + "?mode=ro&immutable=1"
    with closing(sqlite3.connect(uri, uri=True)) as db:
        require(db.execute("PRAGMA integrity_check").fetchall() == [("ok",)], "DATABASE_INTEGRITY_FAILED")
        require(not db.execute("PRAGMA foreign_key_check").fetchall(), "DATABASE_FOREIGN_KEY_FAILED")
        return len(db.execute("SELECT name FROM sqlite_schema WHERE type='table'").fetchall())


def prepare_data(data_archive, destination):
    with tarfile.open(data_archive, "r:gz") as archive:
        members = members_checked(archive)
        roots = {name.split("/")[0] for name in members}
        require(len(roots) == 1, "DATA_SNAPSHOT_ROOT_INVALID")
        root = next(iter(roots))
        require(re.fullmatch(r"synk-workspace-[0-9TZ-]+", root), "DATA_SNAPSHOT_ROOT_INVALID")
        required = ["COMPLETE", "integration-manifest.json", "company/company.sqlite",
                    "company/encryption.key", "messenger/messenger.sqlite"]
        for name in required:
            require(root + "/" + name in members and members[root + "/" + name].isfile(), "DATA_SNAPSHOT_INCOMPLETE")
        with archive.extractfile(members[root + "/COMPLETE"]) as stream:
            require(stream.read(16) == b"ok\n", "DATA_COMPLETE_INVALID")
        require(members[root + "/company/encryption.key"].size == 32, "ORIGINAL_KEY_MISSING")
        for name, member in members.items():
            require(not name.endswith(".sqlite-wal") or member.size == 0, "SNAPSHOT_NONEMPTY_WAL")
        extract_regular(archive, members, destination)
    snapshot = destination / root
    manifest = json.loads((snapshot / "integration-manifest.json").read_text(encoding="utf8"))
    require(manifest.get("version") == 1 and manifest.get("company") == "company"
            and manifest.get("messenger") == "messenger" and isinstance(manifest.get("identityLinks"), list),
            "DATA_MANIFEST_INVALID")
    company = snapshot / "company/company.sqlite"
    messenger = snapshot / "messenger/messenger.sqlite"
    table_counts = [validate_database(company), validate_database(messenger)]
    with closing(sqlite3.connect(company.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)) as a, \
            closing(sqlite3.connect(messenger.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)) as b:
        company_users = {row[0] for row in a.execute("SELECT id FROM documents WHERE kind='users'")}
        messenger_users = {row[0] for row in b.execute("SELECT id FROM users")}
        seen_company, seen_messenger = set(), set()
        for link in manifest["identityLinks"]:
            require(isinstance(link, dict), "IDENTITY_LINK_INVALID")
            left, right = link.get("companyUserId"), link.get("messengerUserId")
            require(left in company_users and right in messenger_users
                    and left not in seen_company and right not in seen_messenger, "IDENTITY_LINK_INVALID")
            seen_company.add(left)
            seen_messenger.add(right)
    volume = destination.parent / "prepared-company"
    volume.mkdir(mode=0o700)
    (volume / "PREPARATION_INCOMPLETE").write_text("Offline recovery only; production acceptance required.\n", encoding="utf8")
    (volume / "PREPARATION_INCOMPLETE").chmod(0o600)
    for part in (snapshot / "company").iterdir():
        require(part.name not in ("messenger", "PREPARATION_INCOMPLETE", "RECOVERY_ACCEPTANCE.json"), "DATA_LAYOUT_CONFLICT")
        if part.is_dir():
            shutil.copytree(part, volume / part.name)
        else:
            shutil.copyfile(part, volume / part.name)
    shutil.copytree(snapshot / "messenger", volume / "messenger")
    # Recorded links are preserved; paths are supplied by /data and the caller.
    (volume / "workspace-integration.json").write_text(json.dumps({"identityLinks": manifest["identityLinks"]}), encoding="utf8")
    for path in volume.rglob("*"):
        path.chmod(0o700 if path.is_dir() else 0o600)
    return {"databaseCount": 2, "tableCounts": table_counts, "identityLinkCount": len(seen_company),
            "originalKeyLength": 32, "productionTrafficAllowed": False,
            "crossDatabaseSameInstant": False, "preparedDirectory": "prepared-company"}


def restore_archive(archive_path, expected_sha, destination):
    manifest = verify_archive(archive_path, expected_sha)
    destination = create_destination(destination)
    (destination / "PREPARATION_INCOMPLETE").write_text("Do not activate this staged server without recovery acceptance.\n", encoding="utf8")
    (destination / "PREPARATION_INCOMPLETE").chmod(0o600)
    with tarfile.open(archive_path, "r:gz") as archive:
        extract_regular(archive, members_checked(archive), destination)
    for item in manifest["files"]:
        require(file_sha(destination / item["path"]) == item["sha256"], "EXTRACTED_PAYLOAD_MISMATCH")
    image_count = validate_images(destination / "images/images.tar", manifest["images"])
    snapshots = destination / "data-snapshots"
    snapshots.mkdir(mode=0o700)
    data_report = prepare_data(destination / manifest["dataArchive"], snapshots)
    if manifest.get("haRecovery"):
        require(file_sha(destination / "prepared-company/encryption.key") == manifest["haRecovery"]["originalKeySha256"],
                "HA_ORIGINAL_KEY_MISMATCH")
    require(file_sha(archive_path) == expected_sha, "ARCHIVE_CHANGED_DURING_RESTORE")
    report = {"status": "offline-candidate-prepared", "payloadFiles": len(manifest["files"]),
              "imageCount": image_count, "data": data_report, "servicesStarted": 0,
              "networkRequests": 0, "livePathsWritten": 0, "acceptanceMarkerPreserved": True,
              "credentialDecryptionChecked": False, "applicationStartupChecked": False}
    report.update({"haDependencyClosureVerified": bool(manifest.get("haRecovery")),
                   "haAutomaticActivationAllowed": False, "cloudAuthorityRestored": False})
    receipt = destination / "OFFLINE-RESTORE-RESULT.json"
    receipt.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    receipt.chmod(0o600)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["verify", "prepare"])
    parser.add_argument("archive")
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--destination")
    args = parser.parse_args()
    try:
        os.umask(0o077)
        if args.action == "prepare":
            require(args.destination, "NEW_DESTINATION_REQUIRED")
            report = restore_archive(args.archive, args.sha256, args.destination)
        else:
            require(not args.destination, "VERIFY_DOES_NOT_EXTRACT")
            manifest = verify_archive(args.archive, args.sha256)
            report = {"status": "archive-verified", "payloadFiles": len(manifest["files"]),
                      "productionTrafficAllowed": False, "servicesStarted": 0}
        print(json.dumps(report))
        return 0
    except Rejected as error:
        print(json.dumps({"status": "rejected", "code": str(error)}))
    except Exception:
        # Tar paths, database content and exception bodies may be private.
        print(json.dumps({"status": "rejected", "code": "RECOVERY_READ_OR_FORMAT_FAILED"}))
    return 2


if __name__ == "__main__":
    sys.exit(main())
